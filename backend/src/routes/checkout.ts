import { Router } from "express";
import { AuthedRequest, requireAuth } from "../middleware/requireAuth";
import z from "zod";
import { Product } from "../models/Product";
import { Cashfree } from "../lib/cashfree";
import { Order } from "../models/Order";

export const checkoutRouter = Router();
checkoutRouter.use(requireAuth);

// ---------------- SCHEMAS ----------------
const CreateSessionSchema = z.object({
  productId: z.string().min(1),
});

const ConfirmSchema = z.object({
  orderId: z.string().min(1),
});

// ---------------- CREATE SESSION ----------------
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

    // 🔥 IMPORTANT: Cast Cashfree to any (TS fix)
    const CashfreeAny = Cashfree as any;

    const cfResp = await CashfreeAny.PGCreateOrder(
      "2023-08-01",
      orderRequest
    );

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

    const CashfreeAny = Cashfree as any;

    const payments = await CashfreeAny.PGOrderFetchPayments(
      "2023-08-01",
      order.providerOrderId
    );

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
