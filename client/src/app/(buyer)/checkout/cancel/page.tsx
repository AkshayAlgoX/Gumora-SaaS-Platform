"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BuyerShell from "../../../../../components/buyer/common/buyer-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function CheckoutCancelPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data?.user) {
          setIsAuth(true);
        } else {
          router.push("/login");
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!isAuth) {
    return null;
  }

  return (
    <BuyerShell>
      <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-16">
        <Card className="p-8 w-full border bg-card shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            Payment Cancelled
          </h1>
          <div className="mt-6">
            <Button asChild className="w-full rounded-none h-12">
              <Link href="/discover">Back to Discover</Link>
            </Button>
          </div>
        </Card>
      </div>
    </BuyerShell>
  );
}
