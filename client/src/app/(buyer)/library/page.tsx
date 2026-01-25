"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BuyerShell from "../../../../components/buyer/common/buyer-shell";
import LibraryClient, { LibraryItem } from "../../../../components/buyer/library/library-client";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function LibPage() {
  const r = useRouter();
  const searchParams = useSearchParams();
  const [l, setL] = useState(true);
  const [i, setI] = useState<LibraryItem[]>([]);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const a = await fetch(`${API}/api/auth/me`, { credentials: "include" });
        const d = await a.json();
        if (!d?.user) return r.push("/login");
        setIsAuth(true);
        
        // Check if coming back from payment
        const dbOrderId = searchParams.get("db_order_id");
        if (dbOrderId) {
          // Confirm payment first
          await fetch(`${API}/api/checkout/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ orderId: dbOrderId }),
          });
          // Remove query param from URL
          window.history.replaceState({}, "", "/library");
        }
        
        // Load library items
        const b = await fetch(`${API}/api/library`, { credentials: "include" });
        const e = await b.json();
        setI(e?.items ?? []);
      } catch {
        r.push("/login");
      } finally {
        setL(false);
      }
    })();
  }, [r, searchParams]);

  return (
    <BuyerShell isUserLoggedIn={isAuth}>
      {l ? (
        <div className="flex h-screen items-center justify-center">Loading...</div>
      ) : (
        <main className="px-4 py-10 lg:px-[8vw]">
          <h1 className="mb-8 text-5xl font-normal leading-none tracking-tight">Library</h1>
          <LibraryClient items={i} />
        </main>
      )}
    </BuyerShell>
  );
}
