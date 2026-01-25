import { Router } from "express";
import { Product } from "../models/Product";
import { ImageAsset } from "../models/ImageAsset";
import { cacheGet, cacheSet, CACHE_KEYS, CACHE_TTL } from "../lib/cache";

export const publicProductsRouter = Router();

publicProductsRouter.get("/", async (_req, res) => {
  try {
    // Try cache first
    const cached = await cacheGet<{ ok: boolean; products: unknown[] }>(CACHE_KEYS.PRODUCTS_LIST);
    if (cached) {
      return res.json(cached);
    }

    const products = await Product.aggregate([
      {
        $match: { visibility: "published" },
      },
      {
        $lookup: {
          from: ImageAsset.collection.name,
          localField: "coverImageAssetId",
          foreignField: "_id",
          as: "cover",
        },
      },
      {
        $addFields: {
          coverUrl: {
            $ifNull: [{ $first: "$cover.cloudinary.secureUrl" }, null],
          },
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          price: 1,
          slug: 1,
          creatorId: 1,
          coverUrl: 1,
        },
      },
    ]);

    const response = { ok: true, products };
    
    // Cache the result
    await cacheSet(CACHE_KEYS.PRODUCTS_LIST, response, CACHE_TTL.PRODUCTS_LIST);

    return res.json(response);
  } catch (e) {
    console.log(e);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

publicProductsRouter.get("/:id", async (req, res) => {
  try {
    const slug = String(req.params.id || "").trim();

    if (!slug) {
      return res.status(400).json({
        ok: false,
        error: "Slug required",
      });
    }

    const products = await Product.aggregate([
      {
        $match: {
          slug,
          visibility: "published",
        },
      },
      {
        $lookup: {
          from: ImageAsset.collection.name,
          localField: "coverImageAssetId",
          foreignField: "_id",
          as: "cover",
        },
      },
      {
        $addFields: {
          coverUrl: {
            $ifNull: [{ $first: "$cover.cloudinary.secureUrl" }, null],
          },
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          price: 1,
          currency: 1,
          slug: 1,
          visibility: 1,
          stats: 1,
          coverImageAssetId: 1,
          creatorId: 1,
          coverUrl: 1,
        },
      },
    ]);

    const product = products[0];

    if (!product) {
      return res.status(404).json({ ok: false, error: "Product not found" });
    }

    return res.json({
      ok: true,
      product,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});
