import mongoose, { Types } from "mongoose";
import { Order, OrderDoc } from "../models/Order";
import { Product } from "../models/Product";
import { cashfree as defaultCashfree } from "../lib/cashfree";

export interface SettleOrderParams {
  orderId: string;
  buyerId?: string;
  cashfreeClient?: {
    get: (url: string) => Promise<{ data: any }>;
  };
}

export type SettlementStatusCode =
  | "SETTLED_SUCCESS"
  | "ALREADY_SETTLED"
  | "INVALID_ORDER_ID"
  | "ORDER_NOT_FOUND"
  | "ORDER_PREVIOUSLY_FAILED"
  | "INVALID_ORDER_STATE"
  | "GATEWAY_ERROR"
  | "PAYMENT_NOT_PAID"
  | "PROVIDER_ORDER_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "SETTLEMENT_TRANSACTION_FAILED";

export interface SettlementResult {
  ok: boolean;
  status: "paid" | "already_settled" | "failed" | "rejected" | "error";
  code: SettlementStatusCode;
  message: string;
  orderId?: string;
  order?: OrderDoc | null;
  soldCountIncremented: boolean;
}

/**
 * Robust, idempotent payment settlement engine.
 *
 * Guarantees:
 * 1. Conditional state transition: only transitions orders from 'pending' to 'paid'.
 * 2. Idempotency: repeated or concurrent calls return 'already_settled' with no secondary increment.
 * 3. Exact-once stats: Product.stats.soldCount increments exactly once per settled order.
 * 4. Gateway reconciliation: verifies provider status, order identity, amount, and currency.
 * 5. Atomicity & rollback: uses MongoDB transaction when available, with compensating rollback in standalone mode.
 */
export async function settleOrderPayment(params: SettleOrderParams): Promise<SettlementResult> {
  const { orderId, buyerId, cashfreeClient = defaultCashfree } = params;

  // 1. Validate ObjectId format
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return {
      ok: false,
      status: "rejected",
      code: "INVALID_ORDER_ID",
      message: "Provided orderId is not a valid MongoDB ObjectId",
      soldCountIncremented: false,
    };
  }

  if (buyerId && !mongoose.Types.ObjectId.isValid(buyerId)) {
    return {
      ok: false,
      status: "rejected",
      code: "INVALID_ORDER_ID",
      message: "Provided buyerId is not a valid MongoDB ObjectId",
      soldCountIncremented: false,
    };
  }

  // 2. Locate order with ownership check when buyerId is supplied
  const query: Record<string, any> = { _id: new Types.ObjectId(orderId) };
  if (buyerId) {
    query.buyerId = new Types.ObjectId(buyerId);
  }

  const order = await Order.findOne(query);
  if (!order) {
    return {
      ok: false,
      status: "rejected",
      code: "ORDER_NOT_FOUND",
      message: buyerId
        ? "Order not found or does not belong to the authenticated user"
        : "Order not found",
      soldCountIncremented: false,
    };
  }

  // 3. Check current state for early idempotency return
  if (order.status === "paid") {
    return {
      ok: true,
      status: "already_settled",
      code: "ALREADY_SETTLED",
      message: "Order has already been confirmed as paid",
      orderId: order._id.toString(),
      order,
      soldCountIncremented: false,
    };
  }

  if (order.status === "failed") {
    return {
      ok: false,
      status: "failed",
      code: "ORDER_PREVIOUSLY_FAILED",
      message: "Order has previously been marked as failed",
      orderId: order._id.toString(),
      order,
      soldCountIncremented: false,
    };
  }

  if (order.status !== "pending") {
    return {
      ok: false,
      status: "rejected",
      code: "INVALID_ORDER_STATE",
      message: `Order cannot be confirmed from status '${order.status}'`,
      orderId: order._id.toString(),
      order,
      soldCountIncremented: false,
    };
  }

  // 4. Verify with payment provider (Cashfree)
  let cfResponse: { data: any };
  try {
    cfResponse = await cashfreeClient.get(`/orders/${order.providerOrderId}`);
  } catch (err: any) {
    return {
      ok: false,
      status: "error",
      code: "GATEWAY_ERROR",
      message: err.response?.data?.message || err.message || "Failed to reach payment gateway",
      orderId: order._id.toString(),
      soldCountIncremented: false,
    };
  }

  const cfData = cfResponse.data;

  // 5. Authoritative provider checks
  // 5a. Payment status
  if (cfData.order_status !== "PAID") {
    return {
      ok: false,
      status: "rejected",
      code: "PAYMENT_NOT_PAID",
      message: `Gateway order status is '${cfData.order_status}', expected 'PAID'`,
      orderId: order._id.toString(),
      soldCountIncremented: false,
    };
  }

  // 5b. Order identity
  if (cfData.order_id && cfData.order_id !== order.providerOrderId) {
    return {
      ok: false,
      status: "rejected",
      code: "PROVIDER_ORDER_MISMATCH",
      message: `Gateway order_id '${cfData.order_id}' does not match expected '${order.providerOrderId}'`,
      orderId: order._id.toString(),
      soldCountIncremented: false,
    };
  }

  // 5c. Currency verification
  if (cfData.order_currency && cfData.order_currency.toUpperCase() !== order.currency.toUpperCase()) {
    return {
      ok: false,
      status: "rejected",
      code: "CURRENCY_MISMATCH",
      message: `Gateway currency '${cfData.order_currency}' does not match order currency '${order.currency}'`,
      orderId: order._id.toString(),
      soldCountIncremented: false,
    };
  }

  // 5d. Amount verification (floating-point tolerance of 0.01)
  if (cfData.order_amount !== undefined && cfData.order_amount !== null) {
    const gatewayAmount = Number(cfData.order_amount);
    const orderAmount = Number(order.amount);
    if (Math.abs(gatewayAmount - orderAmount) > 0.01) {
      return {
        ok: false,
        status: "rejected",
        code: "AMOUNT_MISMATCH",
        message: `Gateway amount ${gatewayAmount} does not match expected order amount ${orderAmount}`,
        orderId: order._id.toString(),
        soldCountIncremented: false,
      };
    }
  }

  // Extract optional provider payment ID if present in gateway response
  const providerPaymentId =
    cfData.cf_payment_id?.toString() ||
    cfData.payment_id?.toString() ||
    (Array.isArray(cfData.payments) && cfData.payments[0]?.payment_id?.toString()) ||
    undefined;

  // 6. Execute atomic settlement transition
  const now = new Date();
  const updatePayload: Record<string, any> = {
    status: "paid",
    paidAt: now,
  };
  if (providerPaymentId) {
    updatePayload.providerPaymentId = providerPaymentId;
  }

  let session: mongoose.ClientSession | null = null;
  let inTransaction = false;

  // Only attempt to start a session/transaction if mongoose is actively connected (readyState === 1)
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      session = await mongoose.startSession();
      try {
        session.startTransaction();
        inTransaction = true;
      } catch {
        // Standalone MongoDB instances do not support transactions; fall back to atomic findOneAndUpdate
        inTransaction = false;
      }
    } catch {
      session = null;
    }
  }

  try {
    if (inTransaction && session) {
      // Transaction path (MongoDB Atlas / Replica Set)
      const transitionedOrder = await Order.findOneAndUpdate(
        { _id: order._id, status: "pending" },
        { $set: updatePayload },
        { new: true, session }
      );

      if (!transitionedOrder) {
        // Race condition: another request transitioned the order between our read and this write
        await session.abortTransaction();
        const fresh = await Order.findById(order._id);
        if (fresh?.status === "paid") {
          return {
            ok: true,
            status: "already_settled",
            code: "ALREADY_SETTLED",
            message: "Order was confirmed concurrently by another request",
            orderId: order._id.toString(),
            order: fresh,
            soldCountIncremented: false,
          };
        }
        return {
          ok: false,
          status: "rejected",
          code: "INVALID_ORDER_STATE",
          message: `Order state was modified concurrently to '${fresh?.status}'`,
          orderId: order._id.toString(),
          soldCountIncremented: false,
        };
      }

      // Increment product sales count in same transaction
      await Product.updateOne(
        { _id: order.productId },
        { $inc: { "stats.soldCount": 1 } },
        { session }
      );

      await session.commitTransaction();

      return {
        ok: true,
        status: "paid",
        code: "SETTLED_SUCCESS",
        message: "Order payment successfully settled and recorded",
        orderId: transitionedOrder._id.toString(),
        order: transitionedOrder,
        soldCountIncremented: true,
      };
    } else {
      // Non-transactional fallback (Standalone MongoDB / in-memory unit tests)
      // The conditional query `{ _id, status: 'pending' }` guarantees atomicity of the gate
      const transitionedOrder = await Order.findOneAndUpdate(
        { _id: order._id, status: "pending" },
        { $set: updatePayload },
        { new: true }
      );

      if (!transitionedOrder) {
        // Already transitioned by a concurrent process
        const fresh = await Order.findById(order._id);
        if (fresh?.status === "paid") {
          return {
            ok: true,
            status: "already_settled",
            code: "ALREADY_SETTLED",
            message: "Order was confirmed concurrently by another request",
            orderId: order._id.toString(),
            order: fresh,
            soldCountIncremented: false,
          };
        }
        return {
          ok: false,
          status: "rejected",
          code: "INVALID_ORDER_STATE",
          message: `Order state was modified concurrently to '${fresh?.status}'`,
          orderId: order._id.toString(),
          soldCountIncremented: false,
        };
      }

      // Transition succeeded — now update product sales counter
      try {
        await Product.updateOne(
          { _id: order.productId },
          { $inc: { "stats.soldCount": 1 } }
        );
      } catch (productErr) {
        // Compensating rollback: if counter fails to update, revert order status back to pending
        // so that subsequent retries can complete cleanly without permanent desynchronization
        await Order.updateOne(
          { _id: order._id, status: "paid" },
          { $set: { status: "pending", paidAt: null } }
        );
        throw productErr;
      }

      return {
        ok: true,
        status: "paid",
        code: "SETTLED_SUCCESS",
        message: "Order payment successfully settled and recorded",
        orderId: transitionedOrder._id.toString(),
        order: transitionedOrder,
        soldCountIncremented: true,
      };
    }
  } catch (err: any) {
    if (inTransaction && session) {
      try {
        await session.abortTransaction();
      } catch {
        // Ignore abort error
      }
    }
    return {
      ok: false,
      status: "error",
      code: "SETTLEMENT_TRANSACTION_FAILED",
      message: err.message || "Database operation failed during settlement",
      orderId: order._id.toString(),
      soldCountIncremented: false,
    };
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch {
        // Ignore session end error
      }
    }
  }
}
