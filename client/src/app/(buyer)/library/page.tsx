"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BuyerShell from "../../../../components/buyer/common/buyer-shell";
import LibraryClient, { LibraryItem } from "../../../../components/buyer/library/library-client";

const API = process.env.NEXT_PUBLIC_API_URL;

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isAuth, setIsAuth] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        // Check auth first
        const authRes = await fetch(`${API}/api/auth/me`, { credentials: "include" });
        const authData = await authRes.json();
        if (!authData?.user) {
          router.push("/login");
          return;
        }
        setIsAuth(true);
        
        // Check if coming back from payment
        const dbOrderId = searchParams.get("db_order_id");
        if (dbOrderId) {
          setConfirmingPayment(true);
          // Remove query param from URL first
          window.history.replaceState({}, "", "/library");
          
          // Confirm payment
          const confirmRes = await fetch(`${API}/api/checkout/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ orderId: dbOrderId }),
          });
          const confirmData = await confirmRes.json();
          console.log("Payment confirmation result:", confirmData);
          setConfirmingPayment(false);
        }
        
        // Load library items (after payment confirmation if applicable)
        const libRes = await fetch(`${API}/api/library`, { credentials: "include" });
        const libData = await libRes.json();
        console.log("Library items loaded:", libData);
        setItems(libData?.items ?? []);
      } catch (err) {
        console.error("Library error:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };
    
    loadLibrary();
  }, [router, searchParams]);

  if (loading || confirmingPayment) {
    return (
      <BuyerShell isUserLoggedIn={isAuth}>
        <div className="flex h-screen items-center justify-center">
          {confirmingPayment ? "Confirming payment..." : "Loading..."}
        </div>
      </BuyerShell>
    );
  }

  return (
    <BuyerShell isUserLoggedIn={isAuth}>
      <main className="px-4 py-10 lg:px-[8vw]">
        <h1 className="mb-8 text-5xl font-normal leading-none tracking-tight">Library</h1>
        <LibraryClient items={items} />
      </main>
    </BuyerShell>
  );
}

export default function LibPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <LibraryContent />
    </Suspense>
  );
}
