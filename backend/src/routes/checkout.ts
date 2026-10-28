import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import z from "zod";
import { Types } from "mongoose";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { cashfree } from "../lib/cashfree";
import { SUPPORTED_CURRENCY, tryToMinorUnits } from "../lib/money";
import { settleOrderPayment, SettlementCode, SettlementResult } from "../services/settlement";

export const checkoutRouter = Router();

/**
 * Cashfree requires customer_details.customer_phone (10 digits). The buyer
 * must supply it; the server never substitutes a placeholder number. An
 * optional +91 / 91 / 0 prefix is accepted and stripped. The number is passed
 * to Cashfree only and is not stored by Gumora.
 */
const IndianMobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(?:\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));

const CreateSessionSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  customerPhone: IndianMobileSchema,
});

const ConfirmSchema = z.object({
  orderId: z.string().min(1).max(64),
});

/** HTTP status for each settlement outcome on the authenticated endpoint. */
const HTTP_STATUS: Record<SettlementCode, number> = {
  SETTLED: 200,
  ALREADY_SETTLED: 200,
  INVALID_ORDER_ID: 400,
  ORDER_NOT_FOUND: 404,
  ORDER_FAILED: 409,
  INVALID_ORDER_STATE: 409,
  INVALID_ORDER_AMOUNT: 409,
  PAYMENT_NOT_PAID: 409,
  PROVIDER_ORDER_MISMATCH: 409,
  AMOUNT_MISMATCH: 409,
  CURRENCY_MISMATCH: 409,
  PRODUCT_NOT_FOUND: 409,
  GATEWAY_UNAVAILABLE: 502,
  GATEWAY_RESPONSE_INVALID: 502,
  TRANSACTIONS_UNSUPPORTED: 503,
  OUTCOME_UNKNOWN: 503,
  SETTLEMENT_FAILED: 500,
};

/** Outcomes a client may retry later without risk of double settlement. */
const RETRYABLE = new Set<SettlementCode>([
  "PAYMENT_NOT_PAID",
  "GATEWAY_UNAVAILABLE",
  "TRANSACTIONS_UNSUPPORTED",
  "OUTCOME_UNKNOWN",
  "SETTLEMENT_FAILED",
]);

function logSettlement(route: string, result: SettlementResult) {
  if (result.ok) {
    console.info(`[settlement] ${route} order=${result.orderId} code=${result.code}`);
  } else {
    console.warn(`[settlement] ${route} order=${result.orderId ?? "-"} code=${result.code} detail=${result.detail ?? "-"}`);
  }
}

/* ================= PUBLIC CONFIRM ================= */

/**
 * Deprecated unauthenticated trigger, kept for clients built before the
 * library page switched to the authenticated /confirm call.
 *
 * It can only settle an order that Cashfree reports as PAID for the stored
 * amount, so it cannot grant anything by itself; purchased assets still
 * require an authenticated buyer (see routes/library.ts). To avoid acting as
 * an order-existence or payment-status oracle for guessed ObjectIds, every
 * well-formed request receives the same 202 response whatever the outcome.
 */
const publicConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests, please try again later" },
});

checkoutRouter.post("/confirm-public", publicConfirmLimiter, async (req: Request, res: Response) => {
  const parsed = ConfirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid request" });

  try {
    const result = await settleOrderPayment({ orderId: parsed.data.orderId });
    logSettlement("confirm-public", result);
  } catch (e) {
    console.error("[settlement] confirm-public unexpected error", e);
  }
  return res.status(202).json({ ok: true, accepted: true });
});

/* ================= AUTH BELOW ================= */

checkoutRouter.use(requireAuth);

/* ================= CREATE SESSION ================= */

checkoutRouter.post("/create-session", async (req: AuthedRequest, res: Response) => {
  const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    const phoneIssue = parsed.error.issues.some((i) => i.path[0] === "customerPhone");
    return res.status(400).json({
      ok: false,
      code: phoneIssue ? "INVALID_PHONE" : "INVALID_REQUEST",
      error: phoneIssue ? "Enter a valid 10-digit Indian mobile number" : "Invalid request",
    });
  }
  const { productId, customerPhone } = parsed.data;

  let dbOrderId: Types.ObjectId | null = null;
  try {
    const product = await Product.findById(productId).lean();
    if (!product || product.visibility !== "published") {
      return res.status(404).json({ ok: false, code: "PRODUCT_NOT_FOUND" });
    }

    // Cashfree accepts at most two decimals and a minimum of 1.00.
    const priceMinor = tryToMinorUnits(product.price);
    if (priceMinor === null || priceMinor < 100 || product.currency !== SUPPORTED_CURRENCY) {
      console.warn(`[checkout] product=${product._id} has an unpayable price=${product.price}`);
      return res.status(409).json({ ok: false, code: "PRODUCT_NOT_PAYABLE" });
    }

    // The provider order id is derived from our own unique ObjectId, so two
    // concurrent sessions can never collide (Date.now() suffixes could).
    dbOrderId = new Types.ObjectId();
    const providerOrderId = `gum_${dbOrderId.toString()}`;

    await Order.create({
      _id: dbOrderId,
      buyerId: req.user!.id,
      productId: product._id,
      amount: product.price,
      currency: SUPPORTED_CURRENCY,
      status: "pending",
      provider: "cashfree",
      providerOrderId,
    });

    const cfResp = await cashfree.post("/orders", {
      order_amount: product.price,
      order_currency: SUPPORTED_CURRENCY,
      order_id: providerOrderId,
      customer_details: {
        customer_id: req.user!.id,
        customer_name: req.user!.name || undefined,
        customer_email: req.user!.email,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `${process.env.WEB_BASE_URL}/library?db_order_id=${dbOrderId}`,
      },
    });

    const paymentSessionId = cfResp.data?.payment_session_id;
    if (typeof paymentSessionId !== "string" || paymentSessionId.length === 0) {
      throw new Error("Cashfree response did not include payment_session_id");
    }

    return res.json({
      ok: true,
      cashfree: { paymentSessionId, orderId: providerOrderId },
      order: { id: dbOrderId.toString() },
    });
  } catch (e: any) {
    // The provider never issued a usable session, so this order can never be
    // paid. Mark it failed (only if still pending) so it is not left dangling.
    if (dbOrderId) {
      await Order.updateOne({ _id: dbOrderId, status: "pending" }, { $set: { status: "failed" } }).catch(() => undefined);
    }
    console.error("[checkout] create-session error:", e.response?.status, e.response?.data?.message ?? e.message);
    return res.status(502).json({ ok: false, code: "GATEWAY_UNAVAILABLE" });
  }
});

/* ================= CONFIRM ================= */

checkoutRouter.post("/confirm", async (req: AuthedRequest, res: Response) => {
  const parsed = ConfirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, code: "INVALID_REQUEST" });

  try {
    const result = await settleOrderPayment({ orderId: parsed.data.orderId, buyerId: req.user!.id });
    logSettlement("confirm", result);
    return res.status(HTTP_STATUS[result.code]).json({
      ok: result.ok,
      code: result.code,
      orderId: result.orderId,
      retryable: !result.ok && RETRYABLE.has(result.code),
    });
  } catch (e) {
    console.error("[settlement] confirm unexpected error", e);
    return res.status(500).json({ ok: false, code: "SETTLEMENT_FAILED", retryable: true });
  }
});
