import { Router, Request, Response } from "express";
import z from "zod";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { cashfree } from "../lib/cashfree";
import { settleOrderPayment } from "../services/settlement";

export const checkoutRouter = Router();

const CreateSessionSchema = z.object({
  productId: z.string().min(1),
  customerPhone: z.string().regex(/^\d{10}$/, "Customer phone must be a 10-digit number").optional(),
});

const ConfirmSchema = z.object({
  orderId: z.string().min(1),
});

/* ================= PUBLIC CONFIRM ================= */

checkoutRouter.post("/confirm-public", async (req: Request, res: Response) => {
  try {
    const { orderId } = ConfirmSchema.parse(req.body);

    const result = await settleOrderPayment({ orderId });

    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        code: result.code,
        message: result.message,
      });
    }

    return res.json({
      ok: true,
      status: result.status,
      alreadySettled: result.status === "already_settled",
      orderId: result.orderId,
    });
  } catch (e: any) {
    console.error("CONFIRM-PUBLIC ERROR:", e);
    return res.status(500).json({ ok: false, error: e.message || "Internal server error" });
  }
});

/* ================= AUTH BELOW ================= */

checkoutRouter.use(requireAuth);

/* ================= CREATE SESSION ================= */

checkoutRouter.post("/create-session", async (req: AuthedRequest, res) => {
  try {
    const { productId, customerPhone } = CreateSessionSchema.parse(req.body);

    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ ok: false });

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
        customer_phone: customerPhone || "9999999999",
      },
      order_meta: {
        return_url: `${process.env.WEB_BASE_URL}/library?db_order_id=${dbOrder._id}`,
      },
    };

    const cfResp = await cashfree.post("/orders", orderRequest);

    return res.json({
      ok: true,
      cashfree: {
        paymentSessionId: cfResp.data.payment_session_id,
        orderId: cfResp.data.order_id,
      },
      order: { id: dbOrder._id.toString() },
    });
  } catch (e: any) {
    console.error("CREATE SESSION ERROR:", e.response?.data || e);
    return res.status(500).json({ ok: false });
  }
});

/* ================= CONFIRM ================= */

checkoutRouter.post("/confirm", async (req: AuthedRequest, res: Response) => {
  try {
    const { orderId } = ConfirmSchema.parse(req.body);

    const result = await settleOrderPayment({
      orderId,
      buyerId: req.user!.id,
    });

    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        code: result.code,
        message: result.message,
      });
    }

    return res.json({
      ok: true,
      status: result.status,
      alreadySettled: result.status === "already_settled",
      orderId: result.orderId,
    });
  } catch (e: any) {
    console.error("CONFIRM ERROR:", e);
    return res.status(500).json({ ok: false, error: e.message || "Internal server error" });
  }
});
