"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BuyerShell from "../../../../components/buyer/common/buyer-shell";
import LibraryClient from "../../../../components/buyer/library/library-client";

type LibraryItem = {
  productId: string;
  title: string;
  price: number;
  currency: "INR";
  paidAt: string | null;
};

function LibraryPageComponent() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<LibraryItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          credentials: "include",
        });
        const meData = await meRes.json();

        if (!meData?.user) {
          router.push("/login");
          return;
        }

        const libRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/library`, {
          credentials: "include",
        });
        const libData = await libRes.json();
        setItems(libData.items ?? []);
      } catch (err) {
        console.error("Library error:", err);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [router]);

  if (isLoading) {
    return (
      <BuyerShell>
        <div className="flex items-center justify-center h-screen">Loading...</div>
      </BuyerShell>
    );
  }

  return (
    <BuyerShell>
      <main className="px-4 py-10 lg:px-[8vw]">
        <div className="mb-8 space-y-2">
          <h1 className="text-4xl leading-none tracking-tight md:text-5xl">
            Library
          </h1>
        </div>
        <LibraryClient items={items} />
      </main>
    </BuyerShell>
  );
}

export default LibraryPageComponent; // v2 - force rebuild
