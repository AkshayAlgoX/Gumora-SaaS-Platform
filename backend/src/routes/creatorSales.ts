import { Router } from "express";
import { AuthedRequest, requireAuth } from "../middleware/requireAuth";
import { Types } from "mongoose";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { User } from "../models/Users";

export const creatorSalesRouter = Router();

creatorSalesRouter.use(requireAuth);

creatorSalesRouter.get("/", async (req: AuthedRequest, res) => {
  try {
    if (!req.user!.isCreator) {
      return res.status(403).json({ ok: false, error: "Creator only" });
    }

    const creatorId = new Types.ObjectId(req.user!.id);

    const sales = await Order.aggregate([
      { $match: { status: "paid" } },
      {
        $lookup: {
          from: Product.collection.name,
          localField: "productId",
          foreignField: "_id",
          as: "p",
        },
      },
      {
        $unwind: "$p",
      },
      {
        $match: { "p.creatorId": creatorId },
      },
      {
        $lookup: {
          from: User.collection.name,
          localField: "buyerId",
          foreignField: "_id",
          as: "b",
        },
      },
      {
        $unwind: { path: "$b", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          _id: 0,
          productTitle: "$p.title",
          amount: 1,
          currency: 1,
          paidAt: 1,
          buyerEmail: "$b.email",
          buyerName: "$b.name",
        },
      },
      {
        $sort: { paidAt: -1, _id: -1 },
      },
      {
        $limit: 100,
      },
    ]);

    return res.json({ ok: true, sales });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});
