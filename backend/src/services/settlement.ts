import mongoose, { ClientSession, Types } from "mongoose";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { CashfreeOrderSchema, PaymentGateway, cashfreeGateway } from "../lib/cashfreeOrders";
import { SUPPORTED_CURRENCY, tryToMinorUnits } from "../lib/money";

/**
 * Payment settlement for Cashfree orders.
 *
 * Invariant: an order moves from "pending" to "paid" and its product's
 * stats.soldCount is incremented by exactly one in the SAME MongoDB
 * transaction, or neither happens. The pending -> paid filter makes every
 * retry, duplicate callback and concurrent request idempotent: only one
 * transaction can match a pending order, and a write conflict between two
 * concurrent transactions aborts one of them, whose retry then sees "paid".
 *
 * Settlement refuses to run (TRANSACTIONS_UNSUPPORTED) when the connected
 * deployment cannot run multi-document transactions. There is deliberately
 * no non-transactional fallback: a conditional update followed by a separate
 * counter update cannot guarantee the invariant across crashes.
 */

export type SettlementCode =
  | "SETTLED"
  | "ALREADY_SETTLED"
  | "INVALID_ORDER_ID"
  | "ORDER_NOT_FOUND"
  | "ORDER_FAILED"
  | "INVALID_ORDER_STATE"
  | "INVALID_ORDER_AMOUNT"
  | "GATEWAY_UNAVAILABLE"
  | "GATEWAY_RESPONSE_INVALID"
  | "PAYMENT_NOT_PAID"
  | "PROVIDER_ORDER_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "PRODUCT_NOT_FOUND"
  | "TRANSACTIONS_UNSUPPORTED"
  | "OUTCOME_UNKNOWN"
  | "SETTLEMENT_FAILED";

export interface SettlementResult {
  /** True only when the order is durably paid (now or previously). */
  ok: boolean;
  code: SettlementCode;
  /** True only for the single call whose transaction committed the change. */
  settledNow: boolean;
  orderId?: string;
  /** Internal diagnostic detail for logs; never returned to clients. */
  detail?: string;
}

export interface SettleOrderParams {
  orderId: string;
  /** When given, the order must belong to this buyer. */
  buyerId?: string;
  gateway?: PaymentGateway;
  connection?: mongoose.Connection;
}

const TRANSACTION_OPTIONS = {
  readConcern: { level: "snapshot" as const },
  writeConcern: { w: "majority" as const },
};

/* ---------------- transaction capability ---------------- */

const transactionCapable = new WeakSet<mongoose.Connection>();

/**
 * Ask the server whether it is a replica-set member or a mongos router with
 * logical sessions. Connection readyState alone says nothing about transaction
 * support: a standalone mongod is "connected" but rejects transactions.
 * Positive answers are cached per connection; negative answers are re-checked.
 */
export async function supportsTransactions(
  connection: mongoose.Connection = mongoose.connection
): Promise<boolean> {
  if (transactionCapable.has(connection)) return true;
  if (connection.readyState !== 1 || !connection.db) return false;
  const hello = await connection.db.admin().command({ hello: 1 });
  const topologyOk = typeof hello.setName === "string" || hello.msg === "isdbgrid";
  const sessionsOk = hello.logicalSessionTimeoutMinutes != null;
  const capable = topologyOk && sessionsOk;
  if (capable) transactionCapable.add(connection);
  return capable;
}

/* ---------------- settlement ---------------- */

export async function settleOrderPayment(params: SettleOrderParams): Promise<SettlementResult> {
  const { orderId, buyerId, gateway = cashfreeGateway, connection = mongoose.connection } = params;

  if (!isObjectIdString(orderId) || (buyerId !== undefined && !isObjectIdString(buyerId))) {
    return { ok: false, code: "INVALID_ORDER_ID", settledNow: false };
  }

  const filter: Record<string, Types.ObjectId> = { _id: new Types.ObjectId(orderId) };
  if (buyerId !== undefined) filter.buyerId = new Types.ObjectId(buyerId);

  const order = await Order.findOne(filter).lean();
  if (!order) return { ok: false, code: "ORDER_NOT_FOUND", settledNow: false };

  const id = order._id.toString();
  if (order.status === "paid") return { ok: true, code: "ALREADY_SETTLED", settledNow: false, orderId: id };
  if (order.status === "failed") return { ok: false, code: "ORDER_FAILED", settledNow: false, orderId: id };
  if (order.status !== "pending") return { ok: false, code: "INVALID_ORDER_STATE", settledNow: false, orderId: id };

  const expectedMinor = tryToMinorUnits(order.amount);
  if (expectedMinor === null || order.currency !== SUPPORTED_CURRENCY) {
    return { ok: false, code: "INVALID_ORDER_AMOUNT", settledNow: false, orderId: id, detail: `stored amount=${order.amount} currency=${order.currency}` };
  }

  // Refuse before calling the gateway so an unsafe deployment is visible immediately.
  if (!(await supportsTransactions(connection))) {
    return { ok: false, code: "TRANSACTIONS_UNSUPPORTED", settledNow: false, orderId: id };
  }

  /* -- verify with the payment provider -- */
  let raw: unknown;
  try {
    raw = await gateway.getOrder(order.providerOrderId);
  } catch (err) {
    return { ok: false, code: "GATEWAY_UNAVAILABLE", settledNow: false, orderId: id, detail: errorText(err) };
  }

  const parsed = CashfreeOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "GATEWAY_RESPONSE_INVALID", settledNow: false, orderId: id, detail: parsed.error.message };
  }
  const provider = parsed.data;

  if (provider.order_id !== order.providerOrderId) {
    return { ok: false, code: "PROVIDER_ORDER_MISMATCH", settledNow: false, orderId: id, detail: `provider order_id=${provider.order_id}` };
  }
  if (provider.order_status !== "PAID") {
    return { ok: false, code: "PAYMENT_NOT_PAID", settledNow: false, orderId: id, detail: `provider status=${provider.order_status}` };
  }
  if (provider.order_currency !== SUPPORTED_CURRENCY) {
    return { ok: false, code: "CURRENCY_MISMATCH", settledNow: false, orderId: id, detail: `provider currency=${provider.order_currency}` };
  }
  const providerMinor = tryToMinorUnits(provider.order_amount);
  if (providerMinor === null || providerMinor !== expectedMinor) {
    return { ok: false, code: "AMOUNT_MISMATCH", settledNow: false, orderId: id, detail: `provider amount=${provider.order_amount} expected minor=${expectedMinor}` };
  }

  /* -- commit the state change and the counter together -- */
  const session = await connection.startSession();
  try {
    let outcome: SettlementResult | undefined;
    await session.withTransaction(async () => {
      // withTransaction may re-run this callback after a transient error, so
      // the outcome is recomputed from scratch on every attempt.
      outcome = await applySettlement(session, order._id, order.productId, id);
    }, TRANSACTION_OPTIONS);
    // The callback either assigned an outcome or threw, which skips this line.
    return outcome!;
  } catch (err) {
    if (err instanceof ProductMissingError) {
      return { ok: false, code: "PRODUCT_NOT_FOUND", settledNow: false, orderId: id };
    }
    if (hasErrorLabel(err, "UnknownTransactionCommitResult")) {
      return resolveUnknownCommit(order._id, id, err);
    }
    return { ok: false, code: "SETTLEMENT_FAILED", settledNow: false, orderId: id, detail: errorText(err) };
  } finally {
    await session.endSession();
  }
}

class ProductMissingError extends Error {}

async function applySettlement(
  session: ClientSession,
  orderObjectId: Types.ObjectId,
  productId: Types.ObjectId,
  id: string
): Promise<SettlementResult> {
  const transitioned = await Order.findOneAndUpdate(
    { _id: orderObjectId, status: "pending" },
    { $set: { status: "paid", paidAt: new Date() } },
    { new: true, session }
  ).lean();

  if (!transitioned) {
    // Another transaction committed first; report the state it left behind.
    const current = await Order.findById(orderObjectId, { status: 1 }, { session }).lean();
    if (current?.status === "paid") return { ok: true, code: "ALREADY_SETTLED", settledNow: false, orderId: id };
    return { ok: false, code: "INVALID_ORDER_STATE", settledNow: false, orderId: id, detail: `status=${current?.status ?? "missing"}` };
  }

  const counter = await Product.updateOne(
    { _id: productId },
    { $inc: { "stats.soldCount": 1 } },
    { session }
  );
  if (!counter.acknowledged || counter.matchedCount !== 1 || counter.modifiedCount !== 1) {
    // Throwing aborts the transaction, so the order stays pending.
    throw new ProductMissingError();
  }

  return { ok: true, code: "SETTLED", settledNow: true, orderId: id };
}

/**
 * The driver retries commitTransaction for UnknownTransactionCommitResult
 * before giving up. If it still cannot tell, read the order back with majority
 * read concern: "paid" means our commit (or a concurrent one) was applied.
 */
export async function resolveUnknownCommit(
  orderObjectId: Types.ObjectId,
  id: string,
  err: unknown
): Promise<SettlementResult> {
  try {
    const current = await Order.findById(orderObjectId, { status: 1 }).readConcern("majority").lean();
    if (current?.status === "paid") {
      return { ok: true, code: "ALREADY_SETTLED", settledNow: false, orderId: id, detail: "resolved after unknown commit result" };
    }
  } catch {
    // Fall through: the outcome is still unknown.
  }
  return { ok: false, code: "OUTCOME_UNKNOWN", settledNow: false, orderId: id, detail: errorText(err) };
}

function isObjectIdString(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);
}

function hasErrorLabel(err: unknown, label: string): boolean {
  const candidate = err as { hasErrorLabel?: (l: string) => boolean } | null;
  return typeof candidate?.hasErrorLabel === "function" && candidate.hasErrorLabel(label);
}

function errorText(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
