import { Router } from "express";
import { AuthedRequest, requireAuth } from "../middleware/requireAuth";
import mongoose, { Types } from "mongoose";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { ImageAsset } from "../models/ImageAsset";

export const libraryRouter = Router();

libraryRouter.use(requireAuth);

function toAttachmentUrl(secureUrl: string) {
  return secureUrl.includes("/upload/")
    ? secureUrl.replace("/upload/", "/upload/fl_attachment/")
    : secureUrl;
}

libraryRouter.get("/", async (req: AuthedRequest, res) => {
  try {
    const buyerId = new Types.ObjectId(req.user!.id);

    console.log(buyerId, "buyerIdbuyerIdbuyerId");

    const items = await Order.aggregate([
      { $match: { buyerId, status: "paid" } },
      { $sort: { paidAt: -1, createdAt: -1 } },

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
        $project: {
          _id: 0,
          productId: { $toString: "$p._id" },
          title: "$p.title",
          price: "$p.price",
          currency: "$p.currency",
          paidAt: 1,
        },
      },
    ]);

    return res.json({ ok: true, items });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

libraryRouter.get("/:productId/assets", async (req: AuthedRequest, res) => {
  try {
    const buyerId = new Types.ObjectId(req.user!.id);
    const extractProductId = String(req.params.productId || "");

    if (!mongoose.isValidObjectId(extractProductId)) {
      return res.status(400).json({ ok: false, error: "Invalid product ID" });
    }

    const productId = new Types.ObjectId(extractProductId);

    const paid = await Order.exists({ buyerId, productId, status: "paid" });
    if (!paid) {
      return res
        .status(400)
        .json({ ok: false, error: "Product not purchased" });
    }

    const assets = await ImageAsset.find({ productId })
      .sort({ orderIndex: 1 })
      .select({
        "cloudinary.secureUrl": 1,
        "meta.width": 1,
        "meta.height": 1,
        orderIndex: 1,
      })
      .lean();

    console.log(assets, "assets");

    return res.json({
      ok: true,
      assets: assets.map((asset: any) => ({
        _id: String(asset._id),
        secureUrl: asset.cloudinary.secureUrl,
        width: asset.meta.width,
        height: asset.meta.height,
        orderIndex: asset.orderIndex,
      })),
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

libraryRouter.get(
  "/assets/:assetId/download",
  async (req: AuthedRequest, res) => {
    try {
      const buyerId = new Types.ObjectId(req.user!.id);
      const extractAssetId = String(req.params.assetId || "");

      console.log(buyerId, extractAssetId, "extractAssetId");

      if (!mongoose.isValidObjectId(extractAssetId)) {
        return res.status(400).json({ ok: false, error: "Invalid Asset ID" });
      }

      const asset = await ImageAsset.findById(extractAssetId)
        .select({ productId: 1, "cloudinary.secureUrl": 1 })
        .lean();

      if (!asset) {
        return res.status(400).json({ ok: false, error: "Asset not found" });
      }

      const paid = await Order.exists({
        buyerId,
        productId: asset.productId,
        status: "paid",
      });
      if (!paid) {
        return res.status(400).json({
          ok: false,
          error: "Asset not purchased! Please purchase it to access",
        });
      }

      return res.redirect(
        toAttachmentUrl(String((asset as any).cloudinary.secureUrl))
      );
    } catch (e) {
      console.log(e);
      res.status(500).json({
        ok: false,
        error: "Internal server error",
      });
    }
  }
);
