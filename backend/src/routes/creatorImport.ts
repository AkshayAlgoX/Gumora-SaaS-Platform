import { Router, Response } from "express";
import { AuthedRequest, requireAuth } from "../middleware/requireAuth";
import { Product } from "../models/Product";
import {
  firecrawlSearch,
  getFirecrawl,
  PRODUCT_DESC_SCHEMA,
} from "../lib/firecrawl";
import { ImageAsset } from "../models/ImageAsset";
import mongoose from "mongoose";
import { downloadAndInspectImage } from "../lib/downloadImage";
import { uploadImageBufferToCloudinary } from "../lib/cloudinary";

export const creatorImportRouter = Router();
creatorImportRouter.use(requireAuth);
//
function uniq(arr: unknown[], cap: number) {
  const clean = (arr ?? [])
    .filter((item): item is String => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean);

  return [...new Set(clean)].slice(0, cap);
}
//

async function ownProductOrSend(req: AuthedRequest, res: Response) {
  const productId = req.params.productId;

  const product = await Product.findById(productId);

  if (!product) {
    res.status(400).json({ ok: false, error: "Invalid product ID" });
    return;
  }

  if (String(product?.creatorId) !== req.user!.id) {
    res.status(403).json({
      ok: false,
      error: "Forbidden. You are not owner of this product",
    });
    return;
  }

  return product;
}

creatorImportRouter.post(
  "/:productId/firecrawl/search",
  async (req: AuthedRequest, res) => {
    try {
      const product = await ownProductOrSend(req, res);

      if (!product) return;

      const query = String(req.body?.query || "").trim();
      const limit = Math.min(Math.max(Number(req.body?.limit || 6), 1), 10);

      if (!query) {
        res.status(400).json({
          ok: false,
          error: "Query required",
        });
      }

      const results = await firecrawlSearch({ query, limit });

      return res.json({ ok: true, results });
    } catch (e) {
      console.log(e);
      res.status(500).json({
        ok: false,
        error: "Internal server error",
      });
    }
  }
);

creatorImportRouter.get(
  "/:productId/assets",
  async (req: AuthedRequest, res) => {
    try {
      const product = await ownProductOrSend(req, res);

      if (!product) return;

      const assets = await ImageAsset.find({ productId: product._id })
        .sort({ orderIndex: 1 })
        .lean();

      return res.json({ ok: true, assets });
    } catch (err) {
      console.log(err);
      res.status(500).json({
        ok: false,
        error: "Internal server error",
      });
    }
  }
);
// 
creatorImportRouter.post(
  "/:productId/firecrawl/scrape",
  async (req: AuthedRequest, res) => {
    try {
      const product = await ownProductOrSend(req, res);

      if (!product) return;

      const url = String(req.body?.url || "").trim();
      const applyToProduct = Boolean(req.body?.applyToProduct);

      if (!url)
        return res.status(400).json({ ok: false, error: "url required" });

      const firecrawl = getFirecrawl();

      const scrape: any = await firecrawl.scrape(url, {
        formats: [
          "images",
          {
            type: "json",
            prompt:
              "Extract a short product description (2-3 sentences). If the page is not a product page, summarize what the page offers in 2-3 sentences.",
            schema: PRODUCT_DESC_SCHEMA,
          },
        ],
        proxy: "auto",
        timeout: 120000,
        onlyMainContent: false,
      });

      const images = scrape?.data?.images ?? scrape?.images ?? [];
      const descObj = scrape?.data?.json ?? scrape?.json ?? null;

      const description = String(descObj?.description || "").trim();

      const candidates = uniq(images, 10).map((imgUrl) => ({
        url: imgUrl,
        sourcePageUrl: url,
      }));

      if (applyToProduct && description) {
        product.description = description;
        await product.save();
      }

      return res.json({ ok: true, extracted: { description }, candidates });
    } catch (e) {
      console.log(e);
      res.status(500).json({
        ok: false,
        error: "Internal server error",
      });
    }
  }
);
//
//
creatorImportRouter.post(
  "/:productId/assets/ingest",
  async (req: AuthedRequest, res) => {
    try {
      const product = await ownProductOrSend(req, res);

      if (!product) return;

      const selected = req.body?.selected;

      if (!Array.isArray(selected) || selected.length === 0) {
        return res
          .status(400)
          .json({ ok: false, error: "selected images needed" });
      }

      const productId = new mongoose.Types.ObjectId(product._id);
      const creatorId = new mongoose.Types.ObjectId(req.user!.id);

      let orderIndex = await ImageAsset.countDocuments({ productId });
      const folder = `gumroad-ai-clone/products/${String(product._id)}`;

      const created: any[] = [];
      const failed: Array<{ url: string; reason: string }> = [];

      for (const item of selected) {
        const url = item?.url;
        const sourcePageUrl = item?.sourcePageUrl;

        if (!url || typeof url !== "string") continue;

        try {
          const inspected = await downloadAndInspectImage(url);

          const uploadedToCloud = await uploadImageBufferToCloudinary({
            buffer: inspected?.buffer,
            folder,
            fileNameNoExt: inspected?.fileNameNoExt,
          });

          const doc = await ImageAsset.create({
            productId,
            creatorId,
            source: {
              sourceUrl: url,
              sourcePageUrl,
            },
            cloudinary: {
              publicId: uploadedToCloud.publicId,
              secureUrl: uploadedToCloud.secureUrl,
              folder,
            },

            meta: {
              filename: inspected.fileName,
              contentType: inspected.contentType,
              sizeBytes: inspected.sizeBytes,
              width: inspected.width,
              height: inspected.height,
            },
            orderIndex,
          });

          created.push(doc);
          orderIndex++;
        } catch (e: any) {
          failed.push({ url, reason: e?.message || "failed" });
        }
      }

      const newCount = await ImageAsset.countDocuments({ productId });
      product.stats.assetCount = newCount;
      await product.save();

      return res.json({ ok: true, created, failed });
    } catch (err) {
      console.log(err);
      res.status(500).json({
        ok: false,
        error: "Internal server error",
      });
    }
  }
);

//        
