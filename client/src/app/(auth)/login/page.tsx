"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "components/auth/login-form";
import Link from "next/link";
import { nextFromLocation } from "@/lib/auth/safe-next";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function LoginPage() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data?.user) {
          // Already logged in - redirect immediately, don't show anything
          window.location.href = nextFromLocation();
          return;
        }
      } catch (err) {
        console.error("Auth check error:", err);
      }
      // Only show form if not logged in
      setShowForm(true);
    };

    checkAuth();
  }, [router]);

  // Show nothing while checking or redirecting
  if (!showForm) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f6f6f4]">
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-4 border-b border-zinc-200 p-8 sm:p-16 md:p-8">
        <div className="flex items-center justify-between gap-2">
          <h1 className="hidden sm:block text-3xl">
            <Link href="/" className="font-semibold tracking-tight">
              Gumora
            </Link>
          </h1>
          <div className="flex items-center gap-4 text-md">
            <Link className="font-medium underline" href={"/register"}>
              Register
            </Link>
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Sign In</h2>
      </header>
      <div className="p-8 sm:p-16">
        <div className="max-w-md">
          <LoginForm />
        </div>
      </div>
    </>
  );
}
