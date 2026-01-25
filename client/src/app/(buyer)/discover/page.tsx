"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BuyerShell from "../../../../components/buyer/common/buyer-shell";
import Link from "next/link";

type Product = {
  _id: string;
  title: string;
  price: number;
  slug: string;
  coverUrl: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function BuyerDiscoverPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check auth first
        const authRes = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });
        const authData = await authRes.json();
        if (!authData?.user) {
          router.push("/login");
          return;
        }
        setIsAuth(true);

        // Load products
        const productsRes = await fetch(`${API_URL}/api/products`, {
          credentials: "include",
        });
        const productsData = await productsRes.json();
        setProducts(productsData?.products ?? []);
      } catch (err) {
        console.error("Error loading discover page:", err);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!isAuth) {
    return null;
  }

  const wrap = "px-4 py-10 lg:px-[8vw]";
  const card =
    "rounded-none border border-border bg-card overflow-hidden transition hover:-translate-y-0.5";
  const chip =
    "inline-flex items-center rounded-none border border-black bg-black text-white px-2 py-1 text-xs font-medium";

  const priceChip =
    "inline-flex items-center rounded-none border border-black/20 bg-[#FF90E8]/20 px-3 py-1 text-sm font-medium text-black";

  const pinkBtn =
    "inline-flex h-9 items-center justify-center rounded-none bg-[#FF90E8] px-4 text-sm font-medium text-black hover:bg-[#FF90E8]/90 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";

  return (
    <BuyerShell isUserLoggedIn={isAuth}>
      <main className={wrap}>
        <div className="mb-8 space-y-2">
          <h1 className="text-4xl leading-none tracking-tight md:text-5xl">
            Discover
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Browse digital products from different creators.
          </p>
        </div>

        {!products.length ? (
          <div className="rounded-none border border-border bg-card p-8">
            <p>No published products yet.</p>
          </div>
        ) : (
          <div className="@container">
            <div className="grid grid-cols-2 gap-5 @xl:grid-cols-3 @3xl:grid-cols-4">
              {products.map((p) => (
                <div key={p._id} className={card}>
                  <Link href={`/discover/${p.slug}`} className="block">
                    <div className="relative aspect-square bg-muted">
                      {p.coverUrl ? (
                        <img
                          src={p.coverUrl}
                          alt={p.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                      <div className="absolute left-3 top-3">
                        <span className={chip}>Preview</span>
                      </div>
                    </div>
                  </Link>

                  <div className="p-4">
                    <Link href={`/discover/${p.slug}`} className="block">
                      <div className="line-clamp-2 text-base font-medium leading-snug">
                        {p.title}
                      </div>
                    </Link>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className={priceChip}>₹{p.price}</span>

                      <Link href={`/discover/${p.slug}`} className={pinkBtn}>
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </BuyerShell>
  );
}
