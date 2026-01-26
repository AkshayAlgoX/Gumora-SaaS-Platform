import { Router, Request, Response } from "express";
import { AuthedRequest, requireAuth } from "../middleware/requireAuth";
import z from "zod";
import { Product } from "../models/Product";
import { Cashfree } from "../lib/cashfree";
import { Order } from "../models/Order";

export const checkoutRouter = Router();

// ---------------- SCHEMAS ----------------
const CreateSessionSchema = z.object({
  productId: z.string().min(1),
});

const ConfirmSchema = z.object({
  orderId: z.string().min(1),
});

// ---------------- PUBLIC: CONFIRM PAYMENT (no auth required) ----------------
// This endpoint is called after Cashfree redirect when cookies may be lost
checkoutRouter.post("/confirm-public", async (req: Request, res: Response) => {
  try {
    const { orderId } = ConfirmSchema.parse(req.body);
    console.log("🔥 PUBLIC CONFIRM HIT for order:", orderId);

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(400).json({ ok: false, error: "Order not found" });
    }

    if (order.status === "paid") {
      console.log("Order already paid");
      return res.json({ ok: true, alreadyPaid: true });
    }

    const CashfreeAny = Cashfree as any;

    const payments = await CashfreeAny.PGOrderFetchPayments(
      "2023-08-01",
      order.providerOrderId
    );

    console.log("Cashfree payments:", payments.data);

    const payment = payments.data?.[0];
    if (!payment || payment.payment_status !== "SUCCESS") {
      return res.status(400).json({
        ok: false,
        error: "Payment not successful",
      });
    }

    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          status: "paid",
          paidAt: new Date(),
          providerPaymentId: payment.cf_payment_id,
        },
      }
    );

    await Product.updateOne(
      { _id: order.productId },
      { $inc: { "stats.soldCount": 1 } }
    );

    console.log("✅ Order confirmed successfully");
    return res.json({ ok: true });
  } catch (err) {
    console.error("Public confirm error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

// Apply auth middleware only to routes below this
checkoutRouter.use(requireAuth);

// ---------------- CREATE SESSION (requires auth) ----------------
checkoutRouter.post("/create-session", async (req: AuthedRequest, res) => {
  try {
    console.log("🔥 CREATE SESSION HIT");
    console.log("ENV:", {
      APP_ID: process.env.CASHFREE_APP_ID,
      ENV: process.env.CASHFREE_ENV,
    });

    const { productId } = CreateSessionSchema.parse(req.body);

    const product = await Product.findById(productId).lean();
    if (!product || product.visibility !== "published") {
      return res.status(404).json({ ok: false, error: "Product not found" });
    }

    if (typeof product.price !== "number" || product.price <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid price" });
    }

    const providerOrderId = `prod_${product._id}_${Date.now()}`;

    const dbOrder = await Order.create({
      buyerId: req.user!.id,
      productId: product._id,
      amount: product.price,
      currency: "INR",
      status: "pending",
      provider: "cashfree",
      providerOrderId,
    });

    const orderRequest = {
      order_amount: product.price,
      order_currency: "INR",
      order_id: providerOrderId,
      customer_details: {
        customer_id: req.user!.id,
        customer_name: req.user!.name || "Customer",
        customer_email: req.user!.email,
        customer_phone: "9999999999",
      },
      order_meta: {
        return_url: `${process.env.WEB_BASE_URL}/library?db_order_id=${dbOrder._id}`,
      },
    };

    console.log("Cashfree order request:", orderRequest);

    // Use correct Cashfree SDK method
    const cfResp = await Cashfree.PG.orders.create(orderRequest);

    console.log("Cashfree order response:", cfResp.data);

    return res.json({
      ok: true,
      cashfree: {
        appId: process.env.CASHFREE_APP_ID,
        orderId: cfResp.data.order_id,
        orderToken: cfResp.data.order_token,
        paymentSessionId: cfResp.data.payment_session_id,
        amount: product.price,
        currency: "INR",
      },
      order: {
        id: dbOrder._id.toString(),
        title: product.title,
        description: product.description,
      },
    });
  } catch (err: any) {
    console.error("Checkout error:", err?.response?.data || err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

// ---------------- CONFIRM PAYMENT ----------------
checkoutRouter.post("/confirm", async (req: AuthedRequest, res) => {
  try {
    const { orderId } = ConfirmSchema.parse(req.body);

    const order = await Order.findOne({
      _id: orderId,
      buyerId: req.user!.id,
    });

    if (!order) {
      return res.status(400).json({ ok: false, error: "Order not found" });
    }

    if (order.status === "paid") return res.json({ ok: true });

    const payments = await Cashfree.PG.orders.fetchPayments(order.providerOrderId);

    const payment = payments.data?.[0];
    if (!payment || payment.payment_status !== "SUCCESS") {
      return res.status(400).json({
        ok: false,
        error: "Payment not successful",
      });
    }

    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          status: "paid",
          paidAt: new Date(),
          providerPaymentId: payment.cf_payment_id,
        },
      }
    );

    await Product.updateOne(
      { _id: order.productId },
      { $inc: { "stats.soldCount": 1 } }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});
