import { Router, Request, Response } from "express";
import z from "zod";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { Cashfree } from "../lib/cashfree";

const CF = Cashfree as any;


export const checkoutRouter = Router();

/* ---------------- Schemas ---------------- */

const CreateSessionSchema = z.object({
  productId: z.string().min(1),
});

const ConfirmSchema = z.object({
  orderId: z.string().min(1),
});

/* ======================================================
   PUBLIC CONFIRM (called after redirect)
====================================================== */

checkoutRouter.post("/confirm-public", async (req: Request, res: Response) => {
  try {
    const { orderId } = ConfirmSchema.parse(req.body);

    const order = await Order.findById(orderId);
    if (!order) return res.status(400).json({ ok: false });

    if (order.status === "paid") return res.json({ ok: true });

    const payments = await CF.orders.fetchPayments(order.providerOrderId);

    const payment = payments.data?.[0];

    if (!payment || payment.payment_status !== "SUCCESS") {
      return res.status(400).json({ ok: false });
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
    return res.status(500).json({ ok: false });
  }
});

/* ======================================================
   AUTH REQUIRED BELOW
====================================================== */

checkoutRouter.use(requireAuth);

/* ---------------- CREATE SESSION ---------------- */

checkoutRouter.post("/create-session", async (req: AuthedRequest, res) => {
  try {
    const { productId } = CreateSessionSchema.parse(req.body);

    const product = await Product.findById(productId).lean();

    if (!product || product.visibility !== "published") {
      return res.status(404).json({ ok: false });
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

    const cfResp = await CF.orders.create(orderRequest);

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
    console.error(err?.response?.data || err);
    return res.status(500).json({ ok: false });
  }
});

/* ---------------- CONFIRM (AUTH) ---------------- */

checkoutRouter.post("/confirm", async (req: AuthedRequest, res) => {
  try {
    const { orderId } = ConfirmSchema.parse(req.body);

    const order = await Order.findOne({
      _id: orderId,
      buyerId: req.user!.id,
    });

    if (!order) return res.status(400).json({ ok: false });

    if (order.status === "paid") return res.json({ ok: true });

    const payments = await CF.orders.fetchPayments(order.providerOrderId);

    const payment = payments.data?.[0];

    if (!payment || payment.payment_status !== "SUCCESS") {
      return res.status(400).json({ ok: false });
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
    return res.status(500).json({ ok: false });
  }
});
