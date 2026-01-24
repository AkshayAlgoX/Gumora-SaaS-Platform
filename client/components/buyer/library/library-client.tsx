"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export type LibraryItem = {
  productId: string;
  title: string;
  price: number;
  currency: "INR";
  paidAt: string | null;
};

type Asset = {
  _id: string;
  secureUrl: string;
  width: number;
  height: number;
  orderIndex: number;
};

type AssetRes = { ok: boolean; assets?: Asset[]; error?: string };


function formatDate(input: string | null) {
  if (!input) return "-";

  return new Date(input).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

async function downloadAsset(assetId: string) {
  try {
    const res = await fetch(`${API_BASE}/api/library/assets/${assetId}/download`, {
      credentials: "include",
      redirect: "follow",
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || "Download failed. Please try again.");
      return;
    }
    
    // Get the final URL after redirect and open it
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asset-${assetId}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Download error:", e);
    alert("Download failed. Please try again.");
  }
}

function LibraryClient({ items }: { items: LibraryItem[] }) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<LibraryItem | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const dbOrderId = searchParams.get("db_order_id");
    if (dbOrderId) {
      // Remove query param from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      const verifyPayment = async () => {
        try {
          await apiClient.post("/api/checkout/confirm", {
            orderId: dbOrderId,
          });
          router.refresh();
        } catch (e) {
          console.error("Payment verification failed", e);
        }
      };

      verifyPayment();
    }
  }, [searchParams, router]);

  async function openItem(item: LibraryItem) {
    setActive(item);
    setAssets([]);
    setOpen(true);

    try {
      setLoading(true);
      const { data } = await apiClient.get<AssetRes>(
        `/api/library/${item.productId}/assets`
      );

      if (!data.ok) throw new Error("Failed to load assets");
      setAssets(data.assets ?? []);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!items.length ? (
        <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-16">
          <Card className="p-8 w-full border bg-card shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">
              You haven&apos;t bought any product yet
            </h1>
            <div className="mt-6">
              <Button asChild className="w-full rounded-none h-12">
                <Link href="/discover">Back to Discover</Link>
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-background">
          <div className="grid grid-cols-12 border-b px-4 py-3 text-xs font-medium text-muted-foreground">
            <div className="col-span-6">Title</div>
            <div className="col-span-3">Purchased</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-1" />
          </div>

          {items.map((libraryItem) => (
            <button
              key={libraryItem.productId}
              type="button"
              onClick={() => openItem(libraryItem)}
              className="grid w-full grid-cols-12 px-4 py-3 border-b text-left transition hover:bg-muted/40"
            >
              <div className="col-span-6 min-w-0">
                <div className="truncate font-medium">
                  {libraryItem.title}
                </div>
              </div>
              <div className="col-span-3 text-sm text-muted-foreground">
                {formatDate(libraryItem.paidAt)}
              </div>
              <div className="col-span-2 text-right font-semibold">
                INR {libraryItem.price}
              </div>
              <div className="col-span-1 flex justify-end">
                <span className="text-sm underline underline-offset-4 cursor-pointer">
                  View
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-none w-[96vw] md:w-[92vw] lg:w-[90vw] p-0">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle>List of Assets</DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 max-h-[72vh] overflow-y-auto">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {assets.map((asset) => (
                <div
                  key={asset._id}
                  className="overflow-hidden rounded-2xl border bg-background transition"
                >
                  <div className="aspect-16/10 bg-muted">
                    <img
                      src={asset.secureUrl}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      alt=""
                    />
                  </div>
                  <div className="p-4">
                    <Button 
                      className="mt-3 w-full cursor-pointer"
                      onClick={() => downloadAsset(asset._id)}
                    >
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LibraryClient;
