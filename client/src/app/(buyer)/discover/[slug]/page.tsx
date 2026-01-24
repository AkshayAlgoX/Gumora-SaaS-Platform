"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import BuyerShell from "../../../../../components/buyer/common/buyer-shell";
import BuyNewButton from "../../../../../components/buyer/discover/buy-new-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

type LibraryItem = {
  productId: string;
  title: string;
  price: number;
  currency: "INR";
  paidAt: string | null;
};

type ProductDetailRes = {
  ok: boolean;
  product?: {
    _id: string;
    creatorId: string;
    title: string;
    description: string;
    price: number;
    currency: "INR";
    slug: string;
    coverUrl: string | null;
  };
  error?: string;
};

type UserInfo = {
  ok: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  error?: string;
};

type LibraryRes = { ok: boolean; items: LibraryItem[]; error?: string };

function formatDate(input: string | null) {
  if (!input) return "-";
  return new Date(input).toLocaleDateString();
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function DiscoverDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const [product, setProduct] = useState<ProductDetailRes["product"]>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo["user"]>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check auth
        const authRes = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });
        const authData = await authRes.json();
        if (!authData?.user) {
          router.push("/login");
          return;
        }
        setIsAuth(true);
        setUserInfo(authData.user);

        // Load product details
        const productRes = await fetch(`${API_URL}/api/products/${slug}`, {
          credentials: "include",
        });
        const productData = await productRes.json();
        if (!productData.ok || !productData.product) {
          router.push("/discover");
          return;
        }
        setProduct(productData.product);

        // Load library items
        const libraryRes = await fetch(`${API_URL}/api/library`, {
          credentials: "include",
        });
        const libraryData = await libraryRes.json();
        setLibraryItems(libraryData?.items ?? []);
      } catch (err) {
        console.error("Error loading product details:", err);
        router.push("/discover");
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      loadData();
    }
  }, [slug, router]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!isAuth || !product || !userInfo) {
    return null;
  }

  const isOwner = userInfo.id === product.creatorId;
  const hasPurchased = libraryItems.filter(
    (item) => item.productId === product._id
  ).length > 0;

  return (
    <BuyerShell isUserLoggedIn={true}>
      <main className="px-4 lg:px-[8vw] py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6">
            <Card className="bg-white border border-black/50 rounded-3xl overflow-hidden">
              <div className="relative aspect-square bg-[#efefea]">
                {product.coverUrl ? (
                  <img
                    src={product.coverUrl}
                    alt="Cover Image"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full grid place-items-center text-black/60">
                    No cover image yet!
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-6">
            <div className="lg:sticky lg:top-24 space-y-5">
              <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl leading-none tracking-tight">
                  {product.title}
                </h1>

                {product.description ? (
                  <p className="text-lg text-black/70 leading-relaxed">
                    {product.description}
                  </p>
                ) : null}
              </div>

              <Card className="bg-white border-black/70 border rounded-3xl p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-sm text-black/60">Price</div>
                    <div className="text-3xl font-medium leading-none">
                      {product.currency} {product.price}
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  {isOwner ? (
                    <div className="rounded-xl border border-black/50 bg-[#efefea] px-4 py-3 text-sm text-black">
                      You cant buy your own product
                    </div>
                  ) : hasPurchased ? (
                    <Button className="w-full rounded-none border px-4 py-4 bg-black cursor-pointer text-sm disabled:opacity-65 font-medium">
                      You purchased this product{" "}
                      {formatDate(
                        libraryItems.find(
                          (item) => item.productId === product._id
                        )?.paidAt || null
                      )}
                    </Button>
                  ) : (
                    <BuyNewButton productId={product._id} />
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </BuyerShell>
  );
}
