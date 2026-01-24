"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AssetsRes,
  ImageAsset,
  Product,
  ProductRes,
} from "@/lib/types/product";
import { useState } from "react";
import AssetsGrid from "./asset-grid";
import { apiClient } from "@/lib/api/client";

type PatchProductBody = {
  title?: string;
  description?: string;
  price?: number;
};

function EditPanel({
  productId,
  product,
  assets,
  coverUrl,
  onProductChange,
  onAssetsChange,
  onRefresh,
}: {
  productId: string;
  product: Product;
  assets: ImageAsset[];
  coverUrl: string | null;
  onProductChange: (p: Product) => void;
  onAssetsChange: (a: ImageAsset[]) => void;
  onRefresh: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState<string>(product.title);
  const [description, setDescription] = useState<string>(
    (product as unknown as { description?: string }).description ?? ""
  );

  const [price, setPrice] = useState<number>(product.price);

  async function saveBasics() {
    setLoading(true);

    try {
      const body: PatchProductBody = {
        title,
        price,
      };

      if (typeof description === "string" && description.trim()) {
        body.description = description.trim();
      }
      const res = await apiClient.patch<ProductRes>(
        `/api/creator/products/${productId}`,
        body
      );

      if (!res.data.ok) throw new Error("Failed to update basic details");
      onProductChange(res.data.product);

      onProductChange(res.data.product);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  async function setCover(imageAssetId: string) {
    setLoading(true);

    try {
      const res = await apiClient.patch<ProductRes>(
        `/api/creator/products/${productId}/cover`,
        {
          imageAssetId,
        }
      );

      if (!res.data.ok) throw new Error("Failed to save cover image");

      onProductChange(res.data.product);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    setLoading(true);

    try {
      const res = await apiClient.patch<ProductRes>(
        `/api/creator/products/${productId}/publish`
      );

      if (!res.data.ok) throw new Error("Failed to publish");

      onProductChange(res.data.product);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAssetsOnly() {
    setLoading(true);
    try {
      const res = await apiClient.get<AssetsRes>(
        `/api/creator/products/${productId}/assets`
      );

      if (!res.data.ok) throw new Error("Failed to fetch assets");

      onAssetsChange(res.data.assets ?? []);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="rounded-none border border-border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-base font-medium">Basics</div>
            <div className="text-xs text-muted-foreground">
              Slug: <span className="text-foreground">{product?.slug}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`px-2 py-1 text-xs ${
                product?.visibility === "draft"
                  ? "border border-border bg-[#ff90e8] text-black"
                  : "border border-border bg-green-600 text-white"
              } `}
            >
              Status:{" "}
              <span>
                {product?.visibility === "draft" ? "Draft" : "Published"}
              </span>
            </div>

            <Button
              className="text-black hover:bg-[#ff90e8] hover:text-black rounded-none bg-[#ff90e8]"
              disabled={loading}
              onClick={saveBasics}
            >
              {loading ? "Saving..." : "Save"}
            </Button>
            {product.visibility === "draft" ? (
              <Button
                onClick={publish}
                className="text-black hover:bg-[#ff90e8] hover:text-black rounded-none bg-[#ff90e8]"
              >
                {loading ? "Publishing..." : "Publish"}
              </Button>
            ) : (
              <Button className="rounded-none" disabled={true}>
                Published
              </Button>
            )}

            <Button
              onClick={refreshAssetsOnly}
              className="text-black hover:bg-[#ff90e8] hover:text-black rounded-none bg-[#ff90e8]"
            >
              Refresh Assets
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-none border border-border bg-card p-4 md:p-5">
          <div className="grid gap-5">
            <div className="grid gap-2">
              <div>Title</div>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
                className="h-10 rounded-none bg-card shadown-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="grid gap-2">
              <div>Description</div>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description"
                className="h-32 rounded-none bg-card shadown-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="grid gap-2">
              <div>Price</div>
              <Input
                type="number"
                min={1}
                value={price}
                onChange={(event) => setPrice(Number(event.target.value))}
                placeholder="Price"
                className="h-10 rounded-none bg-card shadown-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
        </Card>

        <Card className="rounded-none border border-border bg-card p-4 md:p-5">
          <div className="text-base font-medium">Cover Image</div>
          <div className="mt-4 overflow-hidden border border-border bg-background">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Cover image of the digital asset"
                className="h-64 w-full object-cover"
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                No Cover set yet.
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="rounded-none border border-border bg-card p-4 md:p-5">
        <AssetsGrid
          assets={assets}
          title="Imported Assets"
          emptyText="No assets yet."
          actionLabel={(asset) => {
            const iscover =
              String(asset._id) === String(product.coverImageAssetId);
            return iscover ? "Cover" : "Set as cover";
          }}
          isActionActive={(asset) =>
            String(asset._id) === String(product.coverImageAssetId)
          }
          onAction={(asset) => setCover(asset._id)}
        />
      </Card>
    </div>
  );
}

export default EditPanel;
