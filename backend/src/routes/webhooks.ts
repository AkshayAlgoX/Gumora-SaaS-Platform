import express, { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { Order } from "../models/Order";
import { CashfreeWebhookSchema, PAYMENT_EVENT_TYPES, verifyCashfreeWebhook } from "../lib/cashfreeWebhook";
import { SettlementCode, settleOrderPayment } from "../services/settlement";

/**
 * POST /api/webhooks/cashfree
 *
 * Authenticated by the Cashfree signature, not by a user session. The
 * payload only identifies the order; settlement fetches the authoritative
 * status and amount from Cashfree before anything is written.
 *
 * Responses: 200 acknowledges (Cashfree stops retrying), 401 rejects an
 * unauthenticated delivery, and 503 asks Cashfree to retry because the
 * outcome is not yet final on our side.
 */
export const webhookRouter = Router();

/** Settlement outcomes after which a redelivery could still succeed. */
const RETRY_LATER = new Set<SettlementCode>([
  "GATEWAY_UNAVAILABLE",
  "TRANSACTIONS_UNSUPPORTED",
  "OUTCOME_UNKNOWN",
  "SETTLEMENT_FAILED",
]);

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

webhookRouter.post(
  "/cashfree",
  webhookLimiter,
  // Raw bytes are required: the signature covers the body exactly as sent.
  express.raw({ type: "*/*", limit: "256kb" }),
  async (req: Request, res: Response) => {
    const secret = process.env.CASHFREE_SECRET_KEY;
    if (!secret) {
      console.error("[webhook] CASHFREE_SECRET_KEY is not set; cannot verify deliveries");
      return res.status(503).json({ ok: false });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const verification = verifyCashfreeWebhook({
      rawBody,
      signature: req.header("x-webhook-signature"),
      timestamp: req.header("x-webhook-timestamp"),
      secret,
    });
    if (!verification.ok) {
      console.warn(`[webhook] rejected delivery: ${verification.reason}`);
      return res.status(401).json({ ok: false });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ ok: false });
    }
    const parsed = CashfreeWebhookSchema.safeParse(payload);
    if (!parsed.success) {
      // Authentic but not an order event we understand; retrying will not help.
      return res.status(200).json({ ok: true, ignored: true });
    }

    const { type, data } = parsed.data;
    if (!PAYMENT_EVENT_TYPES.has(type)) return res.status(200).json({ ok: true, ignored: true });

    const order = await Order.findOne({ provider: "cashfree", providerOrderId: data.order.order_id }, { _id: 1 }).lean();
    if (!order) {
      // Not ours (e.g. another environment sharing the Cashfree account).
      console.warn(`[webhook] ${type} for unknown provider order ${data.order.order_id}`);
      return res.status(200).json({ ok: true, ignored: true });
    }

    try {
      const result = await settleOrderPayment({ orderId: order._id.toString() });
      console.info(`[webhook] ${type} order=${result.orderId} code=${result.code}`);
      // A success event whose order Cashfree does not yet report as PAID is
      // retried; failure and drop events need no further action.
      const retry =
        RETRY_LATER.has(result.code) || (type === "PAYMENT_SUCCESS_WEBHOOK" && result.code === "PAYMENT_NOT_PAID");
      return res.status(retry ? 503 : 200).json({ ok: !retry });
    } catch (err) {
      console.error("[webhook] settlement error", err);
      return res.status(503).json({ ok: false });
    }
  }
);
