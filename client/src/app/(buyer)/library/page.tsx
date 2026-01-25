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
        
        // If we have an order to confirm, do it FIRST (no auth required)
        if (dbOrderId) {
          setConfirmingPayment(true);
          // Remove query param from URL
          window.history.replaceState({}, "", "/library");
          // Clear stored order ID
          localStorage.removeItem("pending_order_id");
          
          // Confirm payment using PUBLIC endpoint (no auth required)
          console.log("Confirming payment for order:", dbOrderId);
          try {
            const confirmRes = await fetch(`${API}/api/checkout/confirm-public`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: dbOrderId }),
            });
            const confirmData = await confirmRes.json();
            console.log("Payment confirmation result:", confirmData);
            
            if (!confirmData.ok) {
              console.error("Payment confirmation failed:", confirmData.error);
            }
          } catch (confirmErr) {
            console.error("Payment confirmation error:", confirmErr);
          }
          setConfirmingPayment(false);
        }
        
        // Now check auth
        const authRes = await fetch(`${API}/api/auth/me`, { credentials: "include" });
        let authData = await authRes.json();
        
        console.log("Auth check result:", authData);
        
        // If not authenticated, try to restore session from stored token
        if (!authData?.user) {
          const storedToken = localStorage.getItem("session_token");
          if (storedToken) {
            console.log("Trying to restore session from stored token...");
            try {
              const refreshRes = await fetch(`${API}/api/auth/refresh-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ token: storedToken }),
              });
              const refreshData = await refreshRes.json();
              console.log("Session refresh result:", refreshData);
              
              if (refreshData?.ok && refreshData?.user) {
                authData = refreshData;
                // Clear the stored token after successful refresh
                localStorage.removeItem("session_token");
              }
            } catch (refreshErr) {
              console.error("Session refresh error:", refreshErr);
            }
          }
        }
        
        if (!authData?.user) {
          // Still not authenticated - clear stored token and redirect to login
          localStorage.removeItem("session_token");
          router.push("/login");
          return;
        }
        setIsAuth(true);
        
        // Load library items
        const libRes = await fetch(`${API}/api/library`, { credentials: "include" });
        const libData = await libRes.json();
        console.log("Library items loaded:", libData);
        setItems(libData?.items ?? []);
      } catch (err) {
        console.error("Library error:", err);
        localStorage.removeItem("pending_order_id");
        localStorage.removeItem("session_token");
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
