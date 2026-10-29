import mongoose from "mongoose";
import { Order } from "../models/Order";
import { PaymentGateway, cashfreeGateway } from "../lib/cashfreeOrders";
import { SettlementCode, settleOrderPayment } from "./settlement";

/**
 * Server-side recovery for payments whose buyer never came back.
 *
 * Settlement normally runs when the library page calls /confirm, or when a
 * Cashfree webhook arrives. If the buyer closes the tab after paying and the
 * webhook is lost or not configured, the order would stay pending forever.
 * The sweep re-checks pending Cashfree orders with the provider and settles
 * the paid ones through settleOrderPayment, so it inherits every guarantee
 * of that function: provider verification, exact amount match and the
 * transactional pending -> paid transition. Running several sweeps at once
 * (several instances, or a sweep racing /confirm) is safe for the same
 * reason: only one transaction can move an order out of pending.
 */

export interface ReconcileOptions {
  /** Skip orders younger than this, so in-flight checkouts are left alone. */
  minAgeMs?: number;
  /** Stop re-checking orders older than this. */
  maxAgeMs?: number;
  /** Maximum orders checked per run. */
  limit?: number;
  now?: Date;
  gateway?: PaymentGateway;
  connection?: mongoose.Connection;
}

export interface ReconcileSummary {
  checked: number;
  settled: number;
  byCode: Partial<Record<SettlementCode, number>>;
}

export const RECONCILE_DEFAULTS = {
  minAgeMs: 2 * 60 * 1000,
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  limit: 100,
};

export async function reconcilePendingOrders(options: ReconcileOptions = {}): Promise<ReconcileSummary> {
  const minAgeMs = options.minAgeMs ?? RECONCILE_DEFAULTS.minAgeMs;
  const maxAgeMs = options.maxAgeMs ?? RECONCILE_DEFAULTS.maxAgeMs;
  const limit = options.limit ?? RECONCILE_DEFAULTS.limit;
  const now = options.now ?? new Date();
  const gateway = options.gateway ?? cashfreeGateway;
  const connection = options.connection ?? mongoose.connection;

  const candidates = await Order.find(
    {
      status: "pending",
      provider: "cashfree",
      createdAt: { $lte: new Date(now.getTime() - minAgeMs), $gte: new Date(now.getTime() - maxAgeMs) },
    },
    { _id: 1 }
  )
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();

  const summary: ReconcileSummary = { checked: 0, settled: 0, byCode: {} };
  // Sequential on purpose: bounded load on the Cashfree API.
  for (const candidate of candidates) {
    const result = await settleOrderPayment({ orderId: candidate._id.toString(), gateway, connection });
    summary.checked += 1;
    if (result.settledNow) summary.settled += 1;
    summary.byCode[result.code] = (summary.byCode[result.code] ?? 0) + 1;
    if (result.settledNow) {
      console.info(`[reconcile] settled order=${result.orderId}`);
    } else if (!result.ok && result.code !== "PAYMENT_NOT_PAID") {
      console.warn(`[reconcile] order=${result.orderId ?? "-"} code=${result.code} detail=${result.detail ?? "-"}`);
    }
  }
  return summary;
}

/**
 * Runs the sweep every intervalMs in this process. Overlapping runs are
 * skipped, and the timer does not keep the process alive.
 */
export function startReconciliationLoop(intervalMs: number, options: ReconcileOptions = {}): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const summary = await reconcilePendingOrders(options);
      if (summary.checked > 0) console.info(`[reconcile] run checked=${summary.checked} settled=${summary.settled}`);
    } catch (err) {
      console.error("[reconcile] run failed", err);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
