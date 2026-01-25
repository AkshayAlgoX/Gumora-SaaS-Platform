"use client";

import { apiClient } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CashfreeCheckoutOptions {
  paymentSessionId: string;
  redirectTarget?: string;
  appearance?: {
    rebrandly?: boolean;
  };
}

type CreateSessionRes = {
  ok: boolean;
  error?: string;
  cashfree?: {
    appId: string;
    orderId: string;
    orderToken: string;
    paymentSessionId: string;
    amount: number;
    currency: string;
  };
  order?: {
    id: string;
    title: string;
    description: string;
  };
};

type ConfirmRes = { ok: boolean; error?: string };

function waitForCashfree(timeout = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve();

    const t0 = Date.now();

    const t = setInterval(() => {
      if (window.Cashfree) {
        clearInterval(t);
        resolve();
      } else if (Date.now() - t0 > timeout) {
        clearInterval(t);
        reject(new Error("Cashfree not loaded"));
      }
    }, 25);
  });
}

function BuyNewButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onBuy() {
    if (loading) return;

    console.log('Buy button clicked');
    setLoading(true);

    try {
      console.log('Making API call to create session');
      const { data: res } = await apiClient.post<CreateSessionRes>(
        "/api/checkout/create-session",
        { productId }
      );

      console.log('API response:', res);

      if (!res.ok || !res.cashfree || !res.order) {
        console.error('Failed to create session:', res.error);
        alert("Failed to start checkout: " + (res.error || 'Unknown error'));
        return;
      }

      console.log('Waiting for Cashfree to load...');
      await waitForCashfree();
      if (!(window as any).Cashfree) {
        throw new Error("Cashfree SDK not found on the page");
      }

      console.log('Cashfree loaded, starting checkout');
      
      // Use production or sandbox based on environment
      const cashfreeMode = process.env.NEXT_PUBLIC_CASHFREE_ENV === "production" ? "production" : "sandbox";
      
      let cashfree: any;
      try {
        cashfree = (window as any).Cashfree({
          mode: cashfreeMode,
        });
      } catch (e) {
        console.error("Failed to initialize Cashfree SDK:", e);
        throw new Error("Failed to initialize payment gateway. Please try again.");
      }

      if (!res.cashfree.paymentSessionId) {
        throw new Error("No payment session ID received from server");
      }

      // Store order ID in localStorage before redirecting to Cashfree
      localStorage.setItem("pending_order_id", res.order.id);
      
      // Store auth token for session restoration after Cashfree redirect
      try {
        const tokenRes = await apiClient.get("/api/auth/token");
        if (tokenRes.data?.token) {
          localStorage.setItem("session_token", tokenRes.data.token);
        }
      } catch (e) {
        console.log("Could not store session token");
      }

      const options: CashfreeCheckoutOptions = {
        paymentSessionId: res.cashfree.paymentSessionId,
        redirectTarget: "_self", // Redirects the current page
      };

      // Set up event listeners for payment completion
      const handlePaymentSuccess = async () => {
        const confirmResp = await apiClient.post<ConfirmRes>(
          "/api/checkout/confirm",
          {
            orderId: res.order?.id!,
            orderToken: res.cashfree?.orderToken!,
            paymentSessionId: res.cashfree?.paymentSessionId!,
          }
        );

        if (confirmResp.data.ok) router.push("/library");
        else router.push("/checkout/cancel");
      };

      const handlePaymentFailure = () => {
        router.push("/checkout/cancel");
      };

      // Add event listeners
      window.addEventListener("cashfree_checkout_success", handlePaymentSuccess);
      window.addEventListener("cashfree_checkout_failure", handlePaymentFailure);

      // Start Cashfree checkout
      console.log('Starting Cashfree checkout with options:', options);
      cashfree.checkout(options);
    } catch (e) {
      console.error('Error in onBuy:', e);
      alert('Payment failed: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={loading}
      className="w-full rounded-none border px-4 py-4 bg-[#ff90e8] cursor-pointer text-sm disabled:opacity-65 font-medium"
    >
      {loading ? "Starting payment..." : "Buy Now"}
    </button>
  );
}

export default BuyNewButton;
