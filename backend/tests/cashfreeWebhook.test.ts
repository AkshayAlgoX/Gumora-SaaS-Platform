import { describe, expect, it } from "vitest";
import { computeCashfreeSignature, verifyCashfreeWebhook } from "../src/lib/cashfreeWebhook";

/**
 * Signature verification against an independently computed vector:
 *   printf '%s' "$TS$BODY" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64
 * The body keeps "170.00": Cashfree signs raw bytes, and re-serialising
 * parsed JSON would turn it into 170 and break the signature.
 */
const SECRET = "test-webhook-secret-not-real";
const TS = "1785401067911";
const BODY = Buffer.from('{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"gum_000000000000000000000001","order_amount":170.00}}}');
const OPENSSL_SIGNATURE = "KAkSyhzBrmFfnivSuYftdZuIINgVYSrJ35YzHew9y1Y=";
const NOW = Number(TS) + 1000;

function verify(overrides: Partial<Parameters<typeof verifyCashfreeWebhook>[0]> = {}) {
  return verifyCashfreeWebhook({ rawBody: BODY, signature: OPENSSL_SIGNATURE, timestamp: TS, secret: SECRET, nowMs: NOW, ...overrides });
}

describe("Cashfree webhook signature", () => {
  it("matches the openssl-computed vector", () => {
    expect(computeCashfreeSignature(TS, BODY, SECRET)).toBe(OPENSSL_SIGNATURE);
    expect(verify()).toEqual({ ok: true });
  });

  it("rejects a body changed by re-serialisation", () => {
    const reserialised = Buffer.from(JSON.stringify(JSON.parse(BODY.toString())));
    expect(verify({ rawBody: reserialised })).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects a tampered order id", () => {
    const tampered = Buffer.from(BODY.toString().replace("0001", "0002"));
    expect(verify({ rawBody: tampered })).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects the wrong secret", () => {
    expect(verify({ secret: "another-secret" })).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("binds the timestamp into the signature", () => {
    const ts = String(Number(TS) + 1);
    expect(verify({ timestamp: ts, nowMs: Number(ts) })).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it.each([
    [{ signature: undefined }, "MISSING_HEADERS"],
    [{ timestamp: undefined }, "MISSING_HEADERS"],
    [{ signature: "" }, "MISSING_HEADERS"],
    [{ timestamp: "17854010x7911" }, "BAD_TIMESTAMP"],
    [{ timestamp: "-1785401067911" }, "BAD_TIMESTAMP"],
    [{ nowMs: Number(TS) + 25 * 60 * 60 * 1000 }, "STALE_TIMESTAMP"],
    [{ nowMs: Number(TS) - 25 * 60 * 60 * 1000 }, "STALE_TIMESTAMP"],
    [{ signature: "short" }, "BAD_SIGNATURE"],
    [{ signature: OPENSSL_SIGNATURE.toLowerCase() }, "BAD_SIGNATURE"],
  ])("rejects %j as %s", (overrides, reason) => {
    expect(verify(overrides as never)).toEqual({ ok: false, reason });
  });

  it("accepts a delivery inside a custom tolerance and rejects outside it", () => {
    expect(verify({ nowMs: Number(TS) + 59_000, toleranceMs: 60_000 })).toEqual({ ok: true });
    expect(verify({ nowMs: Number(TS) + 61_000, toleranceMs: 60_000 })).toEqual({ ok: false, reason: "STALE_TIMESTAMP" });
  });
});
