import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import type { Express } from "express";
import type { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app";
import { cashfree } from "../src/lib/cashfree";
import { signJwt } from "../src/lib/auth";
import { computeCashfreeSignature } from "../src/lib/cashfreeWebhook";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";
import { User } from "../src/models/Users";
import { reconcilePendingOrders } from "../src/services/reconciliation";
import { clearCollections, startReplSet, stopMongo } from "./helpers/mongo";

/**
 * Recovery of payments whose buyer never returns to /library: the Cashfree
 * webhook and the reconciliation sweep, against a real replica set. Only the
 * outbound Cashfree HTTP client is stubbed; no request reaches Cashfree and
 * no real credentials are used.
 */

const SECRET = "test-only-cashfree-secret";
process.env.CASHFREE_SECRET_KEY = SECRET;
process.env.JWT_SECRET = "test-only-jwt-secret";
process.env.COOKIE_NAME = "gumora_test_session";
process.env.JWT_EXPIRES_IN = "1h";

let replSet: MongoMemoryReplSet;
let app: Express;

beforeAll(async () => {
  replSet = await startReplSet();
  app = createApp();
}, 120_000);

afterAll(async () => {
  await stopMongo(replSet);
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.env.CASHFREE_SECRET_KEY = SECRET;
  await clearCollections();
});

const MINUTE = 60 * 1000;

async function setup(opts: { amount?: number; ageMs?: number } = {}) {
  const buyer = await User.create({ name: "Buyer", email: `b-${new Types.ObjectId()}@example.test`, passwordHash: "x" });
  const product = await Product.create({
    creatorId: new Types.ObjectId(),
    title: "Icons",
    price: 249,
    slug: `icons-${new Types.ObjectId()}`,
    visibility: "published",
  });
  const id = new Types.ObjectId();
  const createdAt = new Date(Date.now() - (opts.ageMs ?? 10 * MINUTE));
  await Order.collection.insertOne({
    _id: id,
    buyerId: buyer._id,
    productId: product._id,
    amount: opts.amount ?? 249,
    currency: "INR",
    status: "pending",
    provider: "cashfree",
    providerOrderId: `gum_${id}`,
    paidAt: null,
    createdAt,
    updatedAt: createdAt,
  });
  return { buyer, product, orderId: id.toString(), providerOrderId: `gum_${id}` };
}

function cashfreeSays(status: string, extra: Record<string, unknown> = {}) {
  return vi.spyOn(cashfree, "get").mockImplementation(async (url: string) => {
    const providerOrderId = decodeURIComponent(url.split("/").pop()!);
    return { data: { order_id: providerOrderId, order_status: status, order_amount: 249, order_currency: "INR", ...extra } } as never;
  });
}

function webhookBody(providerOrderId: string, type = "PAYMENT_SUCCESS_WEBHOOK", paymentAmount = "249.00") {
  // Raw JSON text, as Cashfree sends it (note the two-decimal amount).
  return `{"data":{"order":{"order_id":"${providerOrderId}","order_amount":${paymentAmount},"order_currency":"INR"},"payment":{"cf_payment_id":"1","payment_status":"SUCCESS","payment_amount":${paymentAmount}}},"event_time":"2026-10-29T10:00:00+05:30","type":"${type}"}`;
}

function sendWebhook(body: string, opts: { secret?: string; timestamp?: string; signature?: string } = {}) {
  const timestamp = opts.timestamp ?? String(Date.now());
  const signature = opts.signature ?? computeCashfreeSignature(timestamp, Buffer.from(body), opts.secret ?? SECRET);
  return request(app)
    .post("/api/webhooks/cashfree")
    .set("Content-Type", "application/json")
    .set("x-webhook-timestamp", timestamp)
    .set("x-webhook-signature", signature)
    .send(body);
}

async function state(orderId: string, productId: Types.ObjectId) {
  const order = await Order.findById(orderId).lean();
  const product = await Product.findById(productId).lean();
  return { status: order?.status, soldCount: product?.stats?.soldCount ?? 0 };
}

describe("POST /api/webhooks/cashfree", () => {
  it("settles a paid order once, after re-checking Cashfree", async () => {
    const { orderId, product, providerOrderId } = await setup();
    const get = cashfreeSays("PAID");

    const res = await sendWebhook(webhookBody(providerOrderId));

    expect(res.status).toBe(200);
    expect(get).toHaveBeenCalledWith(`/orders/${providerOrderId}`);
    expect(await state(orderId, product._id)).toEqual({ status: "paid", soldCount: 1 });
  });

  it("is idempotent under concurrent duplicate deliveries", async () => {
    const { orderId, product, providerOrderId } = await setup();
    cashfreeSays("PAID");
    const body = webhookBody(providerOrderId);

    const results = await Promise.all(Array.from({ length: 8 }, () => sendWebhook(body)));

    expect(results.map((r) => r.status)).toEqual(Array(8).fill(200));
    expect(await state(orderId, product._id)).toEqual({ status: "paid", soldCount: 1 });
  });

  it("settles exactly once when the webhook races the buyer's /confirm", async () => {
    const { orderId, product, providerOrderId, buyer } = await setup();
    cashfreeSays("PAID");
    const cookie = `${process.env.COOKIE_NAME}=${signJwt({ userId: buyer.id })}`;

    const [hook, confirm] = await Promise.all([
      sendWebhook(webhookBody(providerOrderId)),
      request(app).post("/api/checkout/confirm").set("Cookie", cookie).send({ orderId }),
    ]);

    expect(hook.status).toBe(200);
    expect(confirm.status).toBe(200);
    expect([confirm.body.code]).toEqual([expect.stringMatching(/^(SETTLED|ALREADY_SETTLED)$/)]);
    expect(await state(orderId, product._id)).toEqual({ status: "paid", soldCount: 1 });
  });

  it("rejects an unsigned or mis-signed delivery without calling Cashfree", async () => {
    const { orderId, product, providerOrderId } = await setup();
    const get = cashfreeSays("PAID");
    const body = webhookBody(providerOrderId);

    const wrongKey = await sendWebhook(body, { secret: "attacker-guess" });
    const noSig = await request(app).post("/api/webhooks/cashfree").set("Content-Type", "application/json").send(body);
    const stale = await sendWebhook(body, { timestamp: String(Date.now() - 48 * 60 * MINUTE) });

    expect([wrongKey.status, noSig.status, stale.status]).toEqual([401, 401, 401]);
    expect(get).not.toHaveBeenCalled();
    expect(await state(orderId, product._id)).toEqual({ status: "pending", soldCount: 0 });
  });

  it("does not trust the webhook payload: Cashfree's Get Order decides", async () => {
    const { orderId, product, providerOrderId } = await setup();
    // Signed success event, but the provider record is not paid.
    cashfreeSays("ACTIVE");

    const res = await sendWebhook(webhookBody(providerOrderId));

    expect(res.status).toBe(503); // retried later by Cashfree
    expect(await state(orderId, product._id)).toEqual({ status: "pending", soldCount: 0 });
  });

  it("refuses an amount mismatch reported by Cashfree", async () => {
    const { orderId, product, providerOrderId } = await setup();
    cashfreeSays("PAID", { order_amount: 1 });

    const res = await sendWebhook(webhookBody(providerOrderId, "PAYMENT_SUCCESS_WEBHOOK", "1.00"));

    expect(res.status).toBe(200); // final: redelivery cannot fix a mismatch
    expect(await state(orderId, product._id)).toEqual({ status: "pending", soldCount: 0 });
  });

  it("acknowledges failure and drop events without changing the order", async () => {
    const { orderId, product, providerOrderId } = await setup();
    cashfreeSays("ACTIVE");

    const failed = await sendWebhook(webhookBody(providerOrderId, "PAYMENT_FAILED_WEBHOOK"));
    const dropped = await sendWebhook(webhookBody(providerOrderId, "PAYMENT_USER_DROPPED_WEBHOOK"));

    expect([failed.status, dropped.status]).toEqual([200, 200]);
    expect(await state(orderId, product._id)).toEqual({ status: "pending", soldCount: 0 });
  });

  it("asks for a retry when Cashfree is unreachable", async () => {
    const { orderId, product, providerOrderId } = await setup();
    vi.spyOn(cashfree, "get").mockRejectedValue(new Error("ECONNRESET"));

    const res = await sendWebhook(webhookBody(providerOrderId));

    expect(res.status).toBe(503);
    expect(await state(orderId, product._id)).toEqual({ status: "pending", soldCount: 0 });
  });

  it("acknowledges unknown orders and unrelated event types", async () => {
    const get = cashfreeSays("PAID");

    const unknown = await sendWebhook(webhookBody("gum_ffffffffffffffffffffffff"));
    const other = await sendWebhook(webhookBody("gum_ffffffffffffffffffffffff", "REFUND_STATUS_WEBHOOK"));
    const notOrder = await sendWebhook('{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{}}');

    expect([unknown.status, other.status, notOrder.status]).toEqual([200, 200, 200]);
    expect(get).not.toHaveBeenCalled();
  });

  it("fails closed when the Cashfree secret is not configured", async () => {
    const { providerOrderId } = await setup();
    const get = cashfreeSays("PAID");
    delete process.env.CASHFREE_SECRET_KEY;

    const res = await sendWebhook(webhookBody(providerOrderId));

    expect(res.status).toBe(503);
    expect(get).not.toHaveBeenCalled();
  });

  it("is not blocked by the JSON body parser or a user session", async () => {
    // A body that is not valid JSON must reach the signature check, not the parser.
    const res = await sendWebhook("not json");
    expect(res.status).toBe(400);
  });
});

describe("reconcilePendingOrders (buyer never returns, no webhook)", () => {
  it("settles a paid order nobody confirmed", async () => {
    const { orderId, product } = await setup({ ageMs: 10 * MINUTE });
    cashfreeSays("PAID");

    const summary = await reconcilePendingOrders();

    expect(summary).toMatchObject({ checked: 1, settled: 1, byCode: { SETTLED: 1 } });
    expect(await state(orderId, product._id)).toEqual({ status: "paid", soldCount: 1 });
  });

  it("leaves in-flight and expired-window orders alone", async () => {
    const young = await setup({ ageMs: 30 * 1000 });
    const old = await setup({ ageMs: 8 * 24 * 60 * MINUTE });
    const get = cashfreeSays("PAID");

    const summary = await reconcilePendingOrders();

    expect(summary.checked).toBe(0);
    expect(get).not.toHaveBeenCalled();
    expect((await state(young.orderId, young.product._id)).status).toBe("pending");
    expect((await state(old.orderId, old.product._id)).status).toBe("pending");
  });

  it("keeps going past a gateway failure and leaves unpaid orders pending", async () => {
    const a = await setup();
    const b = await setup();
    const c = await setup();
    vi.spyOn(cashfree, "get").mockImplementation(async (url: string) => {
      const providerOrderId = decodeURIComponent(url.split("/").pop()!);
      if (providerOrderId === a.providerOrderId) throw new Error("timeout");
      const status = providerOrderId === b.providerOrderId ? "ACTIVE" : "PAID";
      return { data: { order_id: providerOrderId, order_status: status, order_amount: 249, order_currency: "INR" } } as never;
    });

    const summary = await reconcilePendingOrders();

    expect(summary).toMatchObject({ checked: 3, settled: 1, byCode: { GATEWAY_UNAVAILABLE: 1, PAYMENT_NOT_PAID: 1, SETTLED: 1 } });
    expect((await state(a.orderId, a.product._id)).status).toBe("pending");
    expect((await state(b.orderId, b.product._id)).status).toBe("pending");
    expect(await state(c.orderId, c.product._id)).toEqual({ status: "paid", soldCount: 1 });
  });

  it("counts each sale once when sweeps, webhooks and /confirm overlap", async () => {
    const orders = await Promise.all(Array.from({ length: 5 }, () => setup()));
    cashfreeSays("PAID");

    await Promise.all([
      reconcilePendingOrders(),
      reconcilePendingOrders(),
      ...orders.map((o) => sendWebhook(webhookBody(o.providerOrderId))),
      ...orders.map((o) =>
        request(app)
          .post("/api/checkout/confirm")
          .set("Cookie", `${process.env.COOKIE_NAME}=${signJwt({ userId: o.buyer.id })}`)
          .send({ orderId: o.orderId })
      ),
    ]);

    for (const o of orders) {
      expect(await state(o.orderId, o.product._id)).toEqual({ status: "paid", soldCount: 1 });
    }
  });

  it("makes the purchase visible in the buyer's library", async () => {
    const { buyer, product } = await setup();
    cashfreeSays("PAID");
    await reconcilePendingOrders();

    const res = await request(app)
      .get("/api/library")
      .set("Cookie", `${process.env.COOKIE_NAME}=${signJwt({ userId: buyer.id })}`);

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain(product._id.toString());
  });
});
