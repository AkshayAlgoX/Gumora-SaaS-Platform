"use client";
import { useState, useEffect, useRef, Suspense } from "react";
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
  // Run once per page load. Removing db_order_id with replaceState updates
  // useSearchParams, which would otherwise re-run this effect and confirm
  // the same order a second time.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const loadLibrary = async () => {
      try {
        // Get order ID from URL or localStorage
        let dbOrderId = searchParams.get("db_order_id");
        const storedOrderId = localStorage.getItem("pending_order_id");
        
        // If we have a stored order ID, use it as fallback
        if (!dbOrderId && storedOrderId) {
          dbOrderId = storedOrderId;
        }
        
        // Remove the order id from the URL; it is confirmed below once the
        // session is known, through the authenticated endpoint.
        if (dbOrderId) {
          window.history.replaceState({}, "", "/library");
          // Survive a detour through /login if the session was lost on redirect.
          localStorage.setItem("pending_order_id", dbOrderId);
        }

        // Check auth first: settlement is confirmed as the logged-in buyer.
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

        if (dbOrderId) {
          setConfirmingPayment(true);
          try {
            const confirmRes = await fetch(`${API}/api/checkout/confirm`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ orderId: dbOrderId }),
            });
            const confirmData = await confirmRes.json();
            // Keep the pending id only when the server says a retry is safe
            // and useful (e.g. payment still processing, gateway unreachable).
            if (confirmData.ok || !confirmData.retryable) {
              localStorage.removeItem("pending_order_id");
            }
            if (!confirmData.ok) {
              console.error("Payment confirmation not completed:", confirmData.code);
            }
          } catch (confirmErr) {
            console.error("Payment confirmation error:", confirmErr);
          } finally {
            setConfirmingPayment(false);
          }
        }

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
