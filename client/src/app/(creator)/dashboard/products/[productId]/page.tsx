"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProductEditor from "../../../../../../components/creator/dashboard/products/product-editor/product-editor";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Product = {
  _id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  visibility: string;
  coverImageAssetId: string | null;
  slug: string;
};

type ImageAsset = {
  _id: string;
  cloudinary: {
    publicId: string;
    secureUrl: string;
    width: number;
    height: number;
  };
  orderIndex: number;
};

export default function ProductEditorPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.productId as string;

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [assets, setAssets] = useState<ImageAsset[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productRes, assetsRes] = await Promise.all([
          fetch(`${API_URL}/api/creator/products/${productId}`, {
            credentials: "include",
          }),
          fetch(`${API_URL}/api/creator/products/${productId}/assets`, {
            credentials: "include",
          }),
        ]);

        const productData = await productRes.json();
        const assetsData = await assetsRes.json();

        if (!productData?.ok) {
          router.push("/dashboard/products");
          return;
        }

        setProduct(productData.product);
        setAssets(assetsData?.assets ?? []);
      } catch (err) {
        console.error("Failed to load product:", err);
        router.push("/dashboard/products");
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      loadData();
    }
  }, [productId, router]);

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-center h-64">Loading...</div>
      </main>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-border bg-white p-4 md:p-8">
        <div className="flex items-center justify-between gap-2">
          <h1 className="line-clamp-2 hidden text-2xl font-semibold sm:block">
            Product Details
          </h1>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-none md:-my-2">
            <Link
              href={"/dashboard/products"}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-none border border-border bg-[#ff90e8] px-4 text-sm font-medium"
            >
              <span>Back</span>
            </Link>
          </div>
        </div>
      </header>
      <section className="p-4 md:p-8">
        <ProductEditor
          productId={productId}
          initialProduct={product}
          initialAssets={assets}
        />
      </section>
    </main>
  );
}
