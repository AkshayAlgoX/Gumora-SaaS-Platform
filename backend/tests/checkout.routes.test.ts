import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import type { Express } from "express";
import type { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app";
import { cashfree } from "../src/lib/cashfree";
import { signJwt } from "../src/lib/auth";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";
import { User } from "../src/models/Users";
import { clearCollections, startReplSet, stopMongo } from "./helpers/mongo";

/**
 * HTTP contract of the checkout routes against a real replica set. Only the
 * outbound Cashfree HTTP client is stubbed; no request reaches Cashfree.
 */

process.env.JWT_SECRET = "test-only-jwt-secret";
process.env.COOKIE_NAME = "gumora_test_session";
process.env.WEB_BASE_URL = "http://localhost:3000";
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
  await clearCollections();
});

async function buyer() {
  const user = await User.create({ name: "Test Buyer", email: `buyer-${new Types.ObjectId()}@example.test`, passwordHash: "x" });
  const cookie = `${process.env.COOKIE_NAME}=${signJwt({ userId: user.id })}`;
  return { user, cookie };
}

async function product(overrides: Record<string, unknown> = {}) {
  return Product.create({
    creatorId: new Types.ObjectId(),
    title: "Icons",
    price: 249,
    slug: `icons-${new Types.ObjectId()}`,
    visibility: "published",
    ...overrides,
  });
}

async function pendingOrder(buyerId: Types.ObjectId, productId: Types.ObjectId, amount = 249) {
  const id = new Types.ObjectId();
  return Order.create({ _id: id, buyerId, productId, amount, status: "pending", provider: "cashfree", providerOrderId: `gum_${id}` });
}

function stubCashfreeGet(data: unknown) {
  return vi.spyOn(cashfree, "get").mockResolvedValue({ data } as never);
}

describe("POST /api/checkout/create-session", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/checkout/create-session").send({ productId: new Types.ObjectId().toString(), customerPhone: "9876543210" });
    expect(res.status).toBe(401);
  });

  it.each([[undefined], [""], ["9999"], ["12345678901"], ["5876543210"], ["98765abcde"]])(
    "rejects missing or invalid phone %j without creating an order or calling Cashfree",
    async (customerPhone) => {
      const { cookie } = await buyer();
      const p = await product();
      const post = vi.spyOn(cashfree, "post");

      const res = await request(app).post("/api/checkout/create-session").set("Cookie", cookie).send({ productId: p.id, customerPhone });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ ok: false, code: "INVALID_PHONE" });
      expect(post).not.toHaveBeenCalled();
      expect(await Order.countDocuments()).toBe(0);
    }
  );

  it("forwards the buyer's normalised phone (never a placeholder) and a collision-free order id", async () => {
    const { user, cookie } = await buyer();
    const p = await product();
    const post = vi.spyOn(cashfree, "post").mockResolvedValue({ data: { payment_session_id: "session_test_123" } } as never);

    const res = await request(app).post("/api/checkout/create-session").set("Cookie", cookie).send({ productId: p.id, customerPhone: "+91 98765-43210" });

    expect(res.status).toBe(200);
    expect(post).toHaveBeenCalledTimes(1);
    const [path, body] = post.mock.calls[0] as [string, any];
    expect(path).toBe("/orders");
    expect(body.customer_details.customer_phone).toBe("9876543210");
    expect(body.customer_details.customer_id).toBe(user.id);
    expect(body.order_amount).toBe(249);
    expect(body.order_id).toMatch(/^gum_[0-9a-f]{24}$/);
    expect(body.order_id).toBe(`gum_${res.body.order.id}`);

    const order = await Order.findById(res.body.order.id).lean();
    expect(order).toMatchObject({ status: "pending", amount: 249, providerOrderId: body.order_id });
    expect(JSON.stringify(order)).not.toContain("9876543210");
  });

  it("refuses draft products", async () => {
    const { cookie } = await buyer();
    const p = await product({ visibility: "draft" });
    const res = await request(app).post("/api/checkout/create-session").set("Cookie", cookie).send({ productId: p.id, customerPhone: "9876543210" });
    expect(res.status).toBe(404);
  });

  it("refuses prices Cashfree cannot charge exactly", async () => {
    const { cookie } = await buyer();
    const p = await product({ price: 0.5 });
    const post = vi.spyOn(cashfree, "post");
    const res = await request(app).post("/api/checkout/create-session").set("Cookie", cookie).send({ productId: p.id, customerPhone: "9876543210" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PRODUCT_NOT_PAYABLE");
    expect(post).not.toHaveBeenCalled();
  });

  it("marks the order failed when Cashfree does not issue a session", async () => {
    const { cookie } = await buyer();
    const p = await product();
    vi.spyOn(cashfree, "post").mockRejectedValue(new Error("network down"));

    const res = await request(app).post("/api/checkout/create-session").set("Cookie", cookie).send({ productId: p.id, customerPhone: "9876543210" });

    expect(res.status).toBe(502);
    const orders = await Order.find().lean();
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe("failed");
  });
});

describe("POST /api/checkout/confirm (authenticated)", () => {
  it("settles the caller's paid order once and reports idempotent repeats", async () => {
    const { user, cookie } = await buyer();
    const p = await product();
    const order = await pendingOrder(user._id, p._id);
    stubCashfreeGet({ order_id: order.providerOrderId, order_status: "PAID", order_amount: 249, order_currency: "INR" });

    const first = await request(app).post("/api/checkout/confirm").set("Cookie", cookie).send({ orderId: order.id });
    const second = await request(app).post("/api/checkout/confirm").set("Cookie", cookie).send({ orderId: order.id });

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ok: true, code: "SETTLED" });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ ok: true, code: "ALREADY_SETTLED" });
    expect((await Product.findById(p._id).lean())!.stats.soldCount).toBe(1);
  });

  it("returns 404 for another buyer's order and does not settle it", async () => {
    const owner = await buyer();
    const other = await buyer();
    const p = await product();
    const order = await pendingOrder(owner.user._id, p._id);
    const get = stubCashfreeGet({});

    const res = await request(app).post("/api/checkout/confirm").set("Cookie", other.cookie).send({ orderId: order.id });

    expect(res.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
    expect((await Order.findById(order._id).lean())!.status).toBe("pending");
  });

  it("returns a retryable 409 while the payment is not yet PAID", async () => {
    const { user, cookie } = await buyer();
    const p = await product();
    const order = await pendingOrder(user._id, p._id);
    stubCashfreeGet({ order_id: order.providerOrderId, order_status: "ACTIVE", order_amount: 249, order_currency: "INR" });

    const res = await request(app).post("/api/checkout/confirm").set("Cookie", cookie).send({ orderId: order.id });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, code: "PAYMENT_NOT_PAID", orderId: order.id, retryable: true });
  });

  it("returns a non-retryable 409 on an amount mismatch without leaking provider values", async () => {
    const { user, cookie } = await buyer();
    const p = await product();
    const order = await pendingOrder(user._id, p._id);
    stubCashfreeGet({ order_id: order.providerOrderId, order_status: "PAID", order_amount: 1, order_currency: "INR" });

    const res = await request(app).post("/api/checkout/confirm").set("Cookie", cookie).send({ orderId: order.id });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, code: "AMOUNT_MISMATCH", orderId: order.id, retryable: false });
  });
});

describe("POST /api/checkout/confirm-public (unauthenticated, deprecated)", () => {
  it("rejects a malformed body", async () => {
    const res = await request(app).post("/api/checkout/confirm-public").send({});
    expect(res.status).toBe(400);
  });

  it("gives an identical response for missing, unpaid and paid orders", async () => {
    const owner = await buyer();
    const p = await product();
    const unpaid = await pendingOrder(owner.user._id, p._id);
    const paid = await pendingOrder(owner.user._id, p._id);
    vi.spyOn(cashfree, "get").mockImplementation(async (url: string) => {
      const providerOrderId = decodeURIComponent(url.split("/").pop()!);
      const status = providerOrderId === paid.providerOrderId ? "PAID" : "ACTIVE";
      return { data: { order_id: providerOrderId, order_status: status, order_amount: 249, order_currency: "INR" } } as never;
    });

    const responses = await Promise.all(
      [new Types.ObjectId().toString(), unpaid.id, paid.id].map((orderId) =>
        request(app).post("/api/checkout/confirm-public").send({ orderId })
      )
    );

    for (const res of responses) {
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ ok: true, accepted: true });
    }
    // The genuinely paid order is still settled; the unpaid one is not.
    expect((await Order.findById(paid._id).lean())!.status).toBe("paid");
    expect((await Order.findById(unpaid._id).lean())!.status).toBe("pending");
    expect((await Product.findById(p._id).lean())!.stats.soldCount).toBe(1);
  });

  it("does not grant library access by itself", async () => {
    const res = await request(app).get(`/api/library/${new Types.ObjectId()}/assets`);
    expect(res.status).toBe(401);
  });

  it("is rate limited to 20 requests per window per client", async () => {
    // The limiter is module-level, so earlier requests in this file count too;
    // 21 more requests must therefore hit the limit.
    const statuses: number[] = [];
    let limitHeader: string | undefined;
    for (let i = 0; i < 21; i++) {
      const res = await request(app).post("/api/checkout/confirm-public").send({ orderId: new Types.ObjectId().toString() });
      limitHeader ??= res.headers["ratelimit-limit"];
      statuses.push(res.status);
    }
    expect(limitHeader).toBe("20");
    expect(statuses.at(-1)).toBe(429);
  });
});
