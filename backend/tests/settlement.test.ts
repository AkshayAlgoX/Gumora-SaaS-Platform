import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose, { Types } from "mongoose";
import { Order } from "../src/models/Order";
import { Product } from "../src/models/Product";
import { settleOrderPayment } from "../src/services/settlement";

describe("Gumora Settlement Service — Correctness & Idempotency", () => {
  const buyerId = new Types.ObjectId().toString();
  const productId = new Types.ObjectId().toString();
  const orderId = new Types.ObjectId().toString();
  const providerOrderId = `prod_${productId}_1730000000`;

  let mockOrder: any;
  let mockProduct: any;
  let mockSoldCounter: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockSoldCounter = 0;

    mockOrder = {
      _id: new Types.ObjectId(orderId),
      buyerId: new Types.ObjectId(buyerId),
      productId: new Types.ObjectId(productId),
      amount: 499,
      currency: "INR",
      status: "pending",
      provider: "cashfree",
      providerOrderId,
      paidAt: null,
      providerPaymentId: null,
    };

    mockProduct = {
      _id: new Types.ObjectId(productId),
      title: "Design System UI Kit",
      price: 499,
      currency: "INR",
      stats: {
        soldCount: 0,
      },
    };
  });

  const validCashfreeMock = {
    get: vi.fn().mockResolvedValue({
      data: {
        order_id: providerOrderId,
        order_status: "PAID",
        order_amount: 499,
        order_currency: "INR",
        cf_payment_id: "cf_pay_123456789",
      },
    }),
  };

  it("1. Successfully settles a valid pending order and increments soldCount by 1", async () => {
    vi.spyOn(Order, "findOne").mockResolvedValue(mockOrder as any);
    vi.spyOn(Order, "findOneAndUpdate").mockImplementation(async (query: any, update: any) => {
      if (query._id.toString() === orderId && mockOrder.status === "pending") {
        mockOrder.status = "paid";
        mockOrder.paidAt = new Date();
        mockOrder.providerPaymentId = update.$set?.providerPaymentId;
        return mockOrder;
      }
      return null;
    });
    vi.spyOn(Product, "updateOne").mockImplementation(async () => {
      mockSoldCounter += 1;
      return { acknowledged: true, modifiedCount: 1 } as any;
    });

    const result = await settleOrderPayment({
      orderId,
      buyerId,
      cashfreeClient: validCashfreeMock,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("paid");
    expect(result.code).toBe("SETTLED_SUCCESS");
    expect(result.soldCountIncremented).toBe(true);
    expect(mockSoldCounter).toBe(1);
    expect(mockOrder.status).toBe("paid");
  });

  it("2. Handles duplicate confirmation idempotently: no second soldCount increment", async () => {
    // Setup order as already 'paid'
    mockOrder.status = "paid";
    mockOrder.paidAt = new Date();
    mockSoldCounter = 1; // already recorded

    vi.spyOn(Order, "findOne").mockResolvedValue(mockOrder as any);
    const findOneAndUpdateSpy = vi.spyOn(Order, "findOneAndUpdate");
    const productUpdateSpy = vi.spyOn(Product, "updateOne");

    const result = await settleOrderPayment({
      orderId,
      buyerId,
      cashfreeClient: validCashfreeMock,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("already_settled");
    expect(result.code).toBe("ALREADY_SETTLED");
    expect(result.soldCountIncremented).toBe(false);

    // Verify neither database write was attempted
    expect(findOneAndUpdateSpy).not.toHaveBeenCalled();
    expect(productUpdateSpy).not.toHaveBeenCalled();
    // Counter remains exactly 1
    expect(mockSoldCounter).toBe(1);
  });

  it("3. Handles concurrent simultaneous confirmations: exactly 1 increment across parallel requests", async () => {
    let internalStateStatus = "pending";
    mockSoldCounter = 0;

    vi.spyOn(Order, "findOne").mockImplementation(async () => {
      return {
        ...mockOrder,
        status: internalStateStatus,
      } as any;
    });

    vi.spyOn(Order, "findById").mockImplementation(async () => {
      return {
        ...mockOrder,
        status: internalStateStatus,
      } as any;
    });

    // Atomic findOneAndUpdate: only transitions if status is pending at execution time
    vi.spyOn(Order, "findOneAndUpdate").mockImplementation(async (query: any) => {
      if (query.status === "pending" && internalStateStatus === "pending") {
        internalStateStatus = "paid";
        return { ...mockOrder, status: "paid", paidAt: new Date() };
      }
      return null;
    });

    vi.spyOn(Product, "updateOne").mockImplementation(async () => {
      mockSoldCounter += 1;
      return { acknowledged: true, modifiedCount: 1 } as any;
    });

    // Fire 5 simultaneous confirmation requests
    const promises = Array.from({ length: 5 }, () =>
      settleOrderPayment({
        orderId,
        cashfreeClient: validCashfreeMock,
      })
    );

    const results = await Promise.all(promises);

    // Exactly one must be 'paid' with soldCountIncremented=true
    const paidResults = results.filter((r) => r.status === "paid" && r.soldCountIncremented);
    const alreadySettledResults = results.filter((r) => r.status === "already_settled");

    expect(paidResults.length).toBe(1);
    expect(alreadySettledResults.length).toBe(4);
    // Crucial invariant: soldCounter must increment exactly once!
    expect(mockSoldCounter).toBe(1);
  });

  it("4. Rejects payment when gateway status is not PAID", async () => {
    vi.spyOn(Order, "findOne").mockResolvedValue(mockOrder as any);
    const productUpdateSpy = vi.spyOn(Product, "updateOne");

    const activeMock = {
      get: vi.fn().mockResolvedValue({
        data: {
          order_id: providerOrderId,
          order_status: "ACTIVE", // Not yet paid
          order_amount: 499,
          order_currency: "INR",
        },
      }),
    };

    const result = await settleOrderPayment({
      orderId,
      buyerId,
      cashfreeClient: activeMock,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("rejected");
    expect(result.code).toBe("PAYMENT_NOT_PAID");
    expect(result.soldCountIncremented).toBe(false);
    expect(productUpdateSpy).not.toHaveBeenCalled();
    expect(mockOrder.status).toBe("pending");
  });

  it("5. Rejects payment when amount paid does not match order amount", async () => {
    vi.spyOn(Order, "findOne").mockResolvedValue(mockOrder as any);
    const productUpdateSpy = vi.spyOn(Product, "updateOne");

    const underpaidMock = {
      get: vi.fn().mockResolvedValue({
        data: {
          order_id: providerOrderId,
          order_status: "PAID",
          order_amount: 1.00, // Tampered or discounted amount
          order_currency: "INR",
        },
      }),
    };

    const result = await settleOrderPayment({
      orderId,
      buyerId,
      cashfreeClient: underpaidMock,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("rejected");
    expect(result.code).toBe("AMOUNT_MISMATCH");
    expect(result.soldCountIncremented).toBe(false);
    expect(productUpdateSpy).not.toHaveBeenCalled();
    expect(mockOrder.status).toBe("pending");
  });

  it("6. Rejects payment when currency does not match", async () => {
    vi.spyOn(Order, "findOne").mockResolvedValue(mockOrder as any);

    const wrongCurrencyMock = {
      get: vi.fn().mockResolvedValue({
        data: {
          order_id: providerOrderId,
          order_status: "PAID",
          order_amount: 499,
          order_currency: "USD", // Mismatch
        },
      }),
    };

    const result = await settleOrderPayment({
      orderId,
      buyerId,
      cashfreeClient: wrongCurrencyMock,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("CURRENCY_MISMATCH");
    expect(result.soldCountIncremented).toBe(false);
  });

  it("7. Enforces ownership: rejects confirmation if buyerId does not match order", async () => {
    const wrongBuyerId = new Types.ObjectId().toString();
    vi.spyOn(Order, "findOne").mockResolvedValue(null); // findOne({ _id, buyerId }) finds nothing

    const result = await settleOrderPayment({
      orderId,
      buyerId: wrongBuyerId,
      cashfreeClient: validCashfreeMock,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("ORDER_NOT_FOUND");
    expect(result.soldCountIncremented).toBe(false);
  });

  it("8. Compensating rollback on database failure: reverts order status to pending for clean retry", async () => {
    vi.spyOn(Order, "findOne").mockResolvedValue(mockOrder as any);
    
    // First step: order status updated to paid
    vi.spyOn(Order, "findOneAndUpdate").mockImplementation(async () => {
      mockOrder.status = "paid";
      return mockOrder;
    });

    // Second step: Product update throws DB error
    vi.spyOn(Product, "updateOne").mockRejectedValue(new Error("Database write lock timeout"));

    // Rollback spy
    const orderUpdateSpy = vi.spyOn(Order, "updateOne").mockImplementation(async (filter: any, update: any) => {
      if (update.$set?.status === "pending") {
        mockOrder.status = "pending";
      }
      return { acknowledged: true } as any;
    });

    const result = await settleOrderPayment({
      orderId,
      buyerId,
      cashfreeClient: validCashfreeMock,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("SETTLEMENT_TRANSACTION_FAILED");
    // Verify rollback was invoked
    expect(orderUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid" }),
      expect.objectContaining({ $set: expect.objectContaining({ status: "pending" }) })
    );
    expect(mockOrder.status).toBe("pending");
    expect(mockSoldCounter).toBe(0);

    // Now verify successful retry:
    vi.spyOn(Product, "updateOne").mockImplementation(async () => {
      mockSoldCounter += 1;
      return { acknowledged: true, modifiedCount: 1 } as any;
    });

    const retryResult = await settleOrderPayment({
      orderId,
      buyerId,
      cashfreeClient: validCashfreeMock,
    });

    expect(retryResult.ok).toBe(true);
    expect(retryResult.status).toBe("paid");
    expect(mockSoldCounter).toBe(1);
    expect(mockOrder.status).toBe("paid");
  });

  it("9. Rejects invalid MongoDB ObjectId formats immediately", async () => {
    const result = await settleOrderPayment({
      orderId: "invalid-hex-id",
      cashfreeClient: validCashfreeMock,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_ORDER_ID");
  });

  it("10. Full replica-set transaction commits atomically when both writes succeed", async () => {
    // Mock mongoose connection as readyState === 1
    const originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true });

    let committed = false;
    let aborted = false;
    let sessionEnded = false;

    const mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn().mockImplementation(async () => {
        committed = true;
      }),
      abortTransaction: vi.fn().mockImplementation(async () => {
        aborted = true;
      }),
      endSession: vi.fn().mockImplementation(async () => {
        sessionEnded = true;
      }),
    };

    vi.spyOn(mongoose, "startSession").mockResolvedValue(mockSession as any);
    vi.spyOn(Order, "findOne").mockResolvedValue(mockOrder as any);
    vi.spyOn(Order, "findOneAndUpdate").mockResolvedValue({
      ...mockOrder,
      status: "paid",
    } as any);
    vi.spyOn(Product, "updateOne").mockResolvedValue({ acknowledged: true, modifiedCount: 1 } as any);

    try {
      const result = await settleOrderPayment({
        orderId,
        buyerId,
        cashfreeClient: validCashfreeMock,
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("paid");
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(committed).toBe(true);
      expect(aborted).toBe(false);
      expect(sessionEnded).toBe(true);
    } finally {
      Object.defineProperty(mongoose.connection, "readyState", { value: originalReadyState, configurable: true });
    }
  });

  it("11. Full replica-set transaction aborts when Product counter update fails", async () => {
    const originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true });

    let committed = false;
    let aborted = false;
    let sessionEnded = false;

    const mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn().mockImplementation(async () => {
        committed = true;
      }),
      abortTransaction: vi.fn().mockImplementation(async () => {
        aborted = true;
      }),
      endSession: vi.fn().mockImplementation(async () => {
        sessionEnded = true;
      }),
    };

    vi.spyOn(mongoose, "startSession").mockResolvedValue(mockSession as any);
    vi.spyOn(Order, "findOne").mockResolvedValue(mockOrder as any);
    vi.spyOn(Order, "findOneAndUpdate").mockResolvedValue({
      ...mockOrder,
      status: "paid",
    } as any);
    vi.spyOn(Product, "updateOne").mockRejectedValue(new Error("Disk full or replica timeout"));

    try {
      const result = await settleOrderPayment({
        orderId,
        buyerId,
        cashfreeClient: validCashfreeMock,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("SETTLEMENT_TRANSACTION_FAILED");
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(committed).toBe(false);
      expect(aborted).toBe(true);
      expect(sessionEnded).toBe(true);
    } finally {
      Object.defineProperty(mongoose.connection, "readyState", { value: originalReadyState, configurable: true });
    }
  });
});
