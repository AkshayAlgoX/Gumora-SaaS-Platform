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
        
        console.log("Auth check result:", authData);
        
        if (!authData?.user) {
          // Check if coming back from payment - might need to wait for cookie
          const dbOrderId = searchParams.get("db_order_id");
          if (dbOrderId) {
            // Coming from payment but not authenticated
            // This can happen due to cookie timing issues
            console.log("Payment redirect detected but not authenticated, retrying...");
            // Wait a moment and retry auth
            await new Promise(resolve => setTimeout(resolve, 500));
            const retryAuthRes = await fetch(`${API}/api/auth/me`, { credentials: "include" });
            const retryAuthData = await retryAuthRes.json();
            console.log("Retry auth result:", retryAuthData);
            
            if (!retryAuthData?.user) {
              // Still not authenticated - redirect to login
              alert("Session expired after payment. Please login again to see your purchase in Library.");
              router.push("/login");
              return;
            }
            setIsAuth(true);
          } else {
            router.push("/login");
            return;
          }
        } else {
          setIsAuth(true);
        }
        
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
