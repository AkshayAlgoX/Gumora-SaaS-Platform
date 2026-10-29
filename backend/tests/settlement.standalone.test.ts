import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";
import { settleOrderPayment, supportsTransactions } from "../src/services/settlement";
import { startStandalone, stopMongo } from "./helpers/mongo";

/**
 * A standalone mongod accepts connections (readyState 1) but cannot run
 * transactions. Settlement must refuse rather than fall back to separate,
 * non-atomic writes.
 */

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await startStandalone();
}, 120_000);

afterAll(async () => {
  await stopMongo(server);
});

describe("standalone MongoDB", () => {
  it("is reported as not transaction-capable", async () => {
    await expect(supportsTransactions()).resolves.toBe(false);
  });

  it("refuses settlement, leaves the order pending and never calls the gateway", async () => {
    const product = await Product.create({ creatorId: new Types.ObjectId(), title: "Kit", price: 100, slug: "kit" });
    const order = await Order.create({
      buyerId: new Types.ObjectId(),
      productId: product._id,
      amount: 100,
      status: "pending",
      providerOrderId: "gum_standalone",
    });
    const gateway = { getOrder: vi.fn() };

    const result = await settleOrderPayment({ orderId: order.id, gateway });

    expect(result).toMatchObject({ ok: false, code: "TRANSACTIONS_UNSUPPORTED", settledNow: false });
    expect(gateway.getOrder).not.toHaveBeenCalled();
    expect((await Order.findById(order._id).lean())!.status).toBe("pending");
    expect((await Product.findById(product._id).lean())!.stats.soldCount).toBe(0);
  });
});
