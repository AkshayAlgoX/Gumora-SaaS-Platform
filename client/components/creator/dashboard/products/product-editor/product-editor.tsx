"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AssetsRes,
  ImageAsset,
  Product,
  ProductRes,
} from "@/lib/types/product";
import EditPanel from "./edit-panel";
import ImportPanel from "./import-panel";
import { useCallback, useMemo, useState } from "react";
import { apiClient } from "@/lib/api/client";

function ProductEditor({
  productId,
  initialProduct,
  initialAssets,
}: {
  productId: string;
  initialProduct: Product;
  initialAssets: ImageAsset[];
}) {
  const [product, setProduct] = useState<Product>(initialProduct);
  const [assets, setAssets] = useState<ImageAsset[]>(initialAssets);

  const coverUrl = useMemo(() => {
    const cover = assets.find(
      (a) => String(a._id) === String(product.coverImageAssetId)
    );

    return cover?.cloudinary?.secureUrl ?? null;
  }, [assets, product.coverImageAssetId]);

  const refreshAll = useCallback(async () => {
    const [p, a] = await Promise.all([
      apiClient.get<ProductRes>(`/api/creator/products/${productId}`),
      apiClient.get<AssetsRes>(`/api/creator/products/${productId}/assets`),
    ]);

    if (p?.data?.ok) setProduct(p.data.product);
    if (a?.data?.ok) setAssets(a.data.assets ?? []);
  }, [productId]);

  return (
    <Tabs defaultValue="edit" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="w-full sm:w-90 rounded-none border border-border bg-card p-1">
          <TabsTrigger
            className="rounded-none data-[state=active]:bg-[#ff90e8] data-[state=active]:text-black"
            value="edit"
          >
            Edit
          </TabsTrigger>
          <TabsTrigger
            className="rounded-none data-[state=active]:bg-[#ff90e8] data-[state=active]:text-black"
            value="import"
          >
            Firecrawl Import Suite
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="edit" className="space-y-6">
        <EditPanel
          productId={productId}
          product={product}
          assets={assets}
          coverUrl={coverUrl}
          onProductChange={setProduct}
          onAssetsChange={setAssets}
          onRefresh={refreshAll}
        />
      </TabsContent>

      <TabsContent value="import" className="space-y-6">
        <ImportPanel onAfterIngest={refreshAll} productId={productId} />
      </TabsContent>
    </Tabs>
  );
}

export default ProductEditor;
        