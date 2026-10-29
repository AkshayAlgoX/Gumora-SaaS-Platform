import crypto from "crypto";
import z from "zod";

/**
 * Cashfree PG webhook authentication.
 *
 * Cashfree signs each delivery as
 *   Base64(HMAC-SHA256(x-webhook-timestamp + rawBody, client secret))
 * and sends the result in x-webhook-signature
 * (docs: payments/online/webhooks/signature-verification). The signature
 * covers the raw bytes, so it must be checked before the body is parsed.
 *
 * Cashfree documents no replay window. A verified webhook is only used as a
 * trigger: settlement re-reads the order from the Cashfree API and applies
 * the same transactional, idempotent transition as /confirm. A replayed
 * delivery can therefore cause at most a redundant status check. The
 * timestamp tolerance below only bounds how old a delivery may be.
 */

export const DEFAULT_TIMESTAMP_TOLERANCE_MS = 24 * 60 * 60 * 1000;

export type WebhookVerification =
  | { ok: true }
  | { ok: false; reason: "MISSING_HEADERS" | "BAD_TIMESTAMP" | "STALE_TIMESTAMP" | "BAD_SIGNATURE" };

export interface VerifyParams {
  rawBody: Buffer;
  signature: string | undefined;
  timestamp: string | undefined;
  secret: string;
  nowMs?: number;
  toleranceMs?: number;
}

export function computeCashfreeSignature(timestamp: string, rawBody: Buffer, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(timestamp, "utf8"), rawBody]))
    .digest("base64");
}

export function verifyCashfreeWebhook(params: VerifyParams): WebhookVerification {
  const { rawBody, signature, timestamp, secret } = params;
  const nowMs = params.nowMs ?? Date.now();
  const toleranceMs = params.toleranceMs ?? DEFAULT_TIMESTAMP_TOLERANCE_MS;

  if (!signature || !timestamp) return { ok: false, reason: "MISSING_HEADERS" };
  // Cashfree's examples are 13-digit Unix milliseconds.
  if (!/^\d{10,16}$/.test(timestamp)) return { ok: false, reason: "BAD_TIMESTAMP" };
  if (Math.abs(nowMs - Number(timestamp)) > toleranceMs) return { ok: false, reason: "STALE_TIMESTAMP" };

  const expected = Buffer.from(computeCashfreeSignature(timestamp, rawBody, secret), "utf8");
  const received = Buffer.from(signature.trim(), "utf8");
  // timingSafeEqual throws on unequal lengths; a length mismatch is simply a bad signature.
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return { ok: false, reason: "BAD_SIGNATURE" };
  }
  return { ok: true };
}

/**
 * The fields the webhook handler reads. Everything else in the payload
 * (amounts, payment status) is deliberately ignored: settlement takes the
 * authoritative values from the Get Order API.
 */
export const CashfreeWebhookSchema = z.object({
  type: z.string().min(1),
  data: z.object({
    order: z.object({
      order_id: z.string().min(1).max(64),
    }),
  }),
});

export type CashfreeWebhook = z.infer<typeof CashfreeWebhookSchema>;

/** Payment events that can change whether an order is paid. */
export const PAYMENT_EVENT_TYPES = new Set([
  "PAYMENT_SUCCESS_WEBHOOK",
  "PAYMENT_FAILED_WEBHOOK",
  "PAYMENT_USER_DROPPED_WEBHOOK",
]);
