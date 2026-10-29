import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import type { MongoMemoryReplSet } from "mongodb-memory-server";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";
import { resolveUnknownCommit, settleOrderPayment, supportsTransactions } from "../src/services/settlement";
import type { PaymentGateway } from "../src/lib/cashfreeOrders";
import { clearCollections, clearFailPoint, failCommand, startReplSet, stopMongo } from "./helpers/mongo";

/**
 * Settlement against a real single-node replica set. Each test inspects the
 * documents in MongoDB afterwards; a result object alone is not evidence.
 */

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await startReplSet();
}, 120_000);

afterAll(async () => {
  await stopMongo(replSet);
});

afterEach(async () => {
  await clearFailPoint();
  await clearCollections();
});

const PRICE = 499.5;

async function seed(overrides: Partial<{ status: string; amount: number; currency: string }> = {}) {
  const product = await Product.create({
    creatorId: new Types.ObjectId(),
    title: "UI Kit",
    price: PRICE,
    slug: "ui-kit",
    visibility: "published",
  });
  const orderId = new Types.ObjectId();
  const order = await Order.create({
    _id: orderId,
    buyerId: new Types.ObjectId(),
    productId: product._id,
    amount: overrides.amount ?? PRICE,
    currency: overrides.currency ?? "INR",
    status: overrides.status ?? "pending",
    provider: "cashfree",
    providerOrderId: `gum_${orderId}`,
  });
  return { product, order };
}

function gatewayReturning(payload: unknown): PaymentGateway & { getOrder: ReturnType<typeof vi.fn> } {
  return { getOrder: vi.fn().mockResolvedValue(payload) };
}

function paidPayload(order: { providerOrderId: string }, overrides: Record<string, unknown> = {}) {
  return {
    order_id: order.providerOrderId,
    order_status: "PAID",
    order_amount: PRICE,
    order_currency: "INR",
    cf_order_id: "2149460581",
    ...overrides,
  };
}

async function soldCount(productId: Types.ObjectId) {
  return (await Product.findById(productId).lean())!.stats.soldCount;
}

async function orderStatus(orderId: Types.ObjectId) {
  return (await Order.findById(orderId).lean())!.status;
}

describe("transaction capability", () => {
  it("detects a replica set from the server hello response", async () => {
    await expect(supportsTransactions()).resolves.toBe(true);
  });
});

describe("happy path and idempotency", () => {
  it("settles a verified pending order and increments soldCount exactly once", async () => {
    const { product, order } = await seed();
    const gateway = gatewayReturning(paidPayload(order));

    const result = await settleOrderPayment({ orderId: order.id, buyerId: order.buyerId.toString(), gateway });

    expect(result).toMatchObject({ ok: true, code: "SETTLED", settledNow: true, orderId: order.id });
    expect(gateway.getOrder).toHaveBeenCalledWith(order.providerOrderId);
    const stored = await Order.findById(order._id).lean();
    expect(stored!.status).toBe("paid");
    expect(stored!.paidAt).toBeInstanceOf(Date);
    expect(await soldCount(product._id)).toBe(1);
  });

  it("returns ALREADY_SETTLED on a repeat call without contacting the gateway or incrementing again", async () => {
    const { product, order } = await seed();
    const gateway = gatewayReturning(paidPayload(order));
    await settleOrderPayment({ orderId: order.id, gateway });
    gateway.getOrder.mockClear();

    const again = await settleOrderPayment({ orderId: order.id, gateway });

    expect(again).toMatchObject({ ok: true, code: "ALREADY_SETTLED", settledNow: false });
    expect(gateway.getOrder).not.toHaveBeenCalled();
    expect(await soldCount(product._id)).toBe(1);
  });

  it("settles exactly once under 25 concurrent confirmations of the same order", async () => {
    const { product, order } = await seed();
    const gateway = gatewayReturning(paidPayload(order));

    const results = await Promise.all(
      Array.from({ length: 25 }, () => settleOrderPayment({ orderId: order.id, gateway }))
    );

    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.settledNow)).toHaveLength(1);
    expect(results.filter((r) => r.code === "ALREADY_SETTLED")).toHaveLength(24);
    expect(await soldCount(product._id)).toBe(1);
  });

  it("keeps per-product counts exact when different orders for one product settle concurrently", async () => {
    const { product, order } = await seed();
    const others = await Promise.all(
      Array.from({ length: 9 }, async () => {
        const id = new Types.ObjectId();
        return Order.create({
          _id: id,
          buyerId: new Types.ObjectId(),
          productId: product._id,
          amount: PRICE,
          currency: "INR",
          status: "pending",
          provider: "cashfree",
          providerOrderId: `gum_${id}`,
        });
      })
    );
    const all = [order, ...others];
    const gateway: PaymentGateway = {
      getOrder: async (providerOrderId) => paidPayload({ providerOrderId }),
    };

    const results = await Promise.all(all.map((o) => settleOrderPayment({ orderId: o.id, gateway })));

    expect(results.every((r) => r.code === "SETTLED")).toBe(true);
    expect(await soldCount(product._id)).toBe(10);
  });
});

describe("ownership and order state", () => {
  it("does not reveal or settle another buyer's order", async () => {
    const { product, order } = await seed();
    const gateway = gatewayReturning(paidPayload(order));

    const result = await settleOrderPayment({ orderId: order.id, buyerId: new Types.ObjectId().toString(), gateway });

    expect(result).toMatchObject({ ok: false, code: "ORDER_NOT_FOUND" });
    expect(gateway.getOrder).not.toHaveBeenCalled();
    expect(await orderStatus(order._id)).toBe("pending");
    expect(await soldCount(product._id)).toBe(0);
  });

  it.each([
    ["", "INVALID_ORDER_ID"],
    ["not-an-id", "INVALID_ORDER_ID"],
    // 12-character strings are accepted by ObjectId.isValid but are not hex ids.
    ["abcdefghijkl", "INVALID_ORDER_ID"],
  ])("rejects malformed order id %j", async (orderId, code) => {
    const result = await settleOrderPayment({ orderId, gateway: gatewayReturning({}) });
    expect(result).toMatchObject({ ok: false, code });
  });

  it("returns ORDER_NOT_FOUND for a well-formed id with no order", async () => {
    const result = await settleOrderPayment({ orderId: new Types.ObjectId().toString(), gateway: gatewayReturning({}) });
    expect(result).toMatchObject({ ok: false, code: "ORDER_NOT_FOUND" });
  });

  it("refuses to settle a failed order even if the gateway says PAID", async () => {
    const { product, order } = await seed({ status: "failed" });
    const gateway = gatewayReturning(paidPayload(order));

    const result = await settleOrderPayment({ orderId: order.id, gateway });

    expect(result).toMatchObject({ ok: false, code: "ORDER_FAILED" });
    expect(gateway.getOrder).not.toHaveBeenCalled();
    expect(await orderStatus(order._id)).toBe("failed");
    expect(await soldCount(product._id)).toBe(0);
  });

  it("rejects an order whose stored amount is not an exact two-decimal value", async () => {
    const { order } = await seed({ amount: 0.1 + 0.2 });
    const gateway = gatewayReturning(paidPayload(order, { order_amount: 0.1 + 0.2 }));

    const result = await settleOrderPayment({ orderId: order.id, gateway });

    expect(result).toMatchObject({ ok: false, code: "INVALID_ORDER_AMOUNT" });
    expect(gateway.getOrder).not.toHaveBeenCalled();
  });
});

describe("gateway verification fails closed", () => {
  const cases: Array<[string, (o: { providerOrderId: string }) => unknown, string]> = [
    ["status ACTIVE", (o) => paidPayload(o, { order_status: "ACTIVE" }), "PAYMENT_NOT_PAID"],
    ["status EXPIRED", (o) => paidPayload(o, { order_status: "EXPIRED" }), "PAYMENT_NOT_PAID"],
    ["lower-case paid", (o) => paidPayload(o, { order_status: "paid" }), "PAYMENT_NOT_PAID"],
    ["different provider order id", (o) => paidPayload(o, { order_id: "gum_someone_else" }), "PROVIDER_ORDER_MISMATCH"],
    ["amount one paisa low", (o) => paidPayload(o, { order_amount: PRICE - 0.01 }), "AMOUNT_MISMATCH"],
    ["amount one paisa high", (o) => paidPayload(o, { order_amount: 499.51 }), "AMOUNT_MISMATCH"],
    ["amount with sub-paisa digits", (o) => paidPayload(o, { order_amount: 499.501 }), "AMOUNT_MISMATCH"],
    ["currency USD", (o) => paidPayload(o, { order_currency: "USD" }), "CURRENCY_MISMATCH"],
    ["currency lower-case inr", (o) => paidPayload(o, { order_currency: "inr" }), "CURRENCY_MISMATCH"],
    ["missing order_amount", (o) => { const { order_amount, ...rest } = paidPayload(o); return rest; }, "GATEWAY_RESPONSE_INVALID"],
    ["missing order_currency", (o) => { const { order_currency, ...rest } = paidPayload(o); return rest; }, "GATEWAY_RESPONSE_INVALID"],
    ["missing order_id", (o) => { const { order_id, ...rest } = paidPayload(o); return rest; }, "GATEWAY_RESPONSE_INVALID"],
    ["missing order_status", (o) => { const { order_status, ...rest } = paidPayload(o); return rest; }, "GATEWAY_RESPONSE_INVALID"],
    ["amount as string", (o) => paidPayload(o, { order_amount: "499.50" }), "GATEWAY_RESPONSE_INVALID"],
    ["amount null", (o) => paidPayload(o, { order_amount: null }), "GATEWAY_RESPONSE_INVALID"],
    ["empty body", () => ({}), "GATEWAY_RESPONSE_INVALID"],
    ["non-object body", () => "<html>error</html>", "GATEWAY_RESPONSE_INVALID"],
  ];

  it.each(cases)("%s -> %s, order untouched", async (_name, payload, code) => {
    const { product, order } = await seed();

    const result = await settleOrderPayment({ orderId: order.id, gateway: gatewayReturning(payload(order)) });

    expect(result).toMatchObject({ ok: false, code, settledNow: false });
    expect(await orderStatus(order._id)).toBe("pending");
    expect(await soldCount(product._id)).toBe(0);
  });

  it("reports GATEWAY_UNAVAILABLE when the gateway call throws, and a later retry settles", async () => {
    const { product, order } = await seed();
    const gateway = { getOrder: vi.fn().mockRejectedValueOnce(new Error("ETIMEDOUT")).mockResolvedValue(paidPayload(order)) };

    const first = await settleOrderPayment({ orderId: order.id, gateway });
    expect(first).toMatchObject({ ok: false, code: "GATEWAY_UNAVAILABLE" });
    expect(await orderStatus(order._id)).toBe("pending");

    const retry = await settleOrderPayment({ orderId: order.id, gateway });
    expect(retry).toMatchObject({ ok: true, code: "SETTLED" });
    expect(await soldCount(product._id)).toBe(1);
  });
});

describe("transaction failure handling (server failpoints)", () => {
  it("rolls back the paid transition when the product no longer exists", async () => {
    const { product, order } = await seed();
    await Product.deleteOne({ _id: product._id });

    const result = await settleOrderPayment({ orderId: order.id, gateway: gatewayReturning(paidPayload(order)) });

    expect(result).toMatchObject({ ok: false, code: "PRODUCT_NOT_FOUND", settledNow: false });
    expect(await orderStatus(order._id)).toBe("pending");
  });

  it("rolls back the paid transition when the counter write fails with a non-transient error", async () => {
    const { product, order } = await seed();
    const triggered = await failCommand({ failCommands: ["update"], errorCode: 2 /* BadValue */ });

    const result = await settleOrderPayment({ orderId: order.id, gateway: gatewayReturning(paidPayload(order)) });

    await triggered();
    expect(result).toMatchObject({ ok: false, code: "SETTLEMENT_FAILED" });
    expect(await orderStatus(order._id)).toBe("pending");
    expect(await soldCount(product._id)).toBe(0);

    const retry = await settleOrderPayment({ orderId: order.id, gateway: gatewayReturning(paidPayload(order)) });
    expect(retry).toMatchObject({ ok: true, code: "SETTLED" });
    expect(await soldCount(product._id)).toBe(1);
  });

  it("retries a TransientTransactionError (write conflict) and settles once", async () => {
    const { product, order } = await seed();
    const triggered = await failCommand({ failCommands: ["update"], errorCode: 112 /* WriteConflict */, errorLabels: ["TransientTransactionError"] });

    const result = await settleOrderPayment({ orderId: order.id, gateway: gatewayReturning(paidPayload(order)) });

    await triggered();
    expect(result).toMatchObject({ ok: true, code: "SETTLED", settledNow: true });
    expect(await soldCount(product._id)).toBe(1);
  });

  it("retries a commit whose connection drops (unknown commit result) without double counting", async () => {
    const { product, order } = await seed();
    const triggered = await failCommand({ failCommands: ["commitTransaction"], closeConnection: true });

    const result = await settleOrderPayment({ orderId: order.id, gateway: gatewayReturning(paidPayload(order)) });

    await triggered();
    expect(result.ok).toBe(true);
    expect(["SETTLED", "ALREADY_SETTLED"]).toContain(result.code);
    expect(await orderStatus(order._id)).toBe("paid");
    expect(await soldCount(product._id)).toBe(1);
  });

  it("re-runs the whole transaction after a transient commit failure without double counting", async () => {
    // If the counter write were outside the transaction, the re-run would
    // increment it a second time.
    const { product, order } = await seed();
    const triggered = await failCommand({
      failCommands: ["commitTransaction"],
      errorCode: 251 /* NoSuchTransaction */,
      errorLabels: ["TransientTransactionError"],
    });

    const result = await settleOrderPayment({ orderId: order.id, gateway: gatewayReturning(paidPayload(order)) });

    await triggered();
    expect(result).toMatchObject({ ok: true, code: "SETTLED", settledNow: true });
    expect(await orderStatus(order._id)).toBe("paid");
    expect(await soldCount(product._id)).toBe(1);
  });

  it("resolves a persistent unknown commit result by reading the committed state", async () => {
    const paid = await seed({ status: "paid" });
    const pending = await seed();
    const err = Object.assign(new Error("commit outcome unknown"), {
      hasErrorLabel: (l: string) => l === "UnknownTransactionCommitResult",
    });

    await expect(resolveUnknownCommit(paid.order._id, paid.order.id, err)).resolves.toMatchObject({
      ok: true,
      code: "ALREADY_SETTLED",
      settledNow: false,
    });
    await expect(resolveUnknownCommit(pending.order._id, pending.order.id, err)).resolves.toMatchObject({
      ok: false,
      code: "OUTCOME_UNKNOWN",
    });
  });
});
