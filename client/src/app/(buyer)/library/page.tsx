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
        // Get order ID from URL or localStorage
        let dbOrderId = searchParams.get("db_order_id");
        const storedOrderId = localStorage.getItem("pending_order_id");
        
        // If we have a stored order ID, use it as fallback
        if (!dbOrderId && storedOrderId) {
          dbOrderId = storedOrderId;
        }
        
        // Check auth first
        const authRes = await fetch(`${API}/api/auth/me`, { credentials: "include" });
        const authData = await authRes.json();
        
        console.log("Auth check result:", authData);
        
        if (!authData?.user) {
          // Check if coming back from payment - might need to wait for cookie
          if (dbOrderId) {
            // Coming from payment but not authenticated
            console.log("Payment redirect detected but not authenticated, retrying...");
            // Wait a moment and retry auth
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryAuthRes = await fetch(`${API}/api/auth/me`, { credentials: "include" });
            const retryAuthData = await retryAuthRes.json();
            console.log("Retry auth result:", retryAuthData);
            
            if (!retryAuthData?.user) {
              // Still not authenticated - clear stored order and redirect to login
              localStorage.removeItem("pending_order_id");
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
        
        // Process payment confirmation if we have an order ID
        if (dbOrderId) {
          setConfirmingPayment(true);
          // Remove query param from URL
          window.history.replaceState({}, "", "/library");
          // Clear stored order ID
          localStorage.removeItem("pending_order_id");
          
          // Confirm payment
          console.log("Confirming payment for order:", dbOrderId);
          const confirmRes = await fetch(`${API}/api/checkout/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ orderId: dbOrderId }),
          });
          const confirmData = await confirmRes.json();
          console.log("Payment confirmation result:", confirmData);
          
          if (!confirmData.ok) {
            console.error("Payment confirmation failed:", confirmData.error);
          }
          setConfirmingPayment(false);
        }
        
        // Load library items (after payment confirmation if applicable)
        const libRes = await fetch(`${API}/api/library`, { credentials: "include" });
        const libData = await libRes.json();
        console.log("Library items loaded:", libData);
        setItems(libData?.items ?? []);
      } catch (err) {
        console.error("Library error:", err);
        localStorage.removeItem("pending_order_id");
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
