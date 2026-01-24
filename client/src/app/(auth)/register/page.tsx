"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RegisterForm from "../../../../components/auth/register-form";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data?.user) {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Auth check error:", err);
      }
    };

    checkAuth();
  }, [router]);

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
            <Link className="font-medium underline" href={"/login"}>
              Login
            </Link>
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Sign Up</h2>
      </header>
      <div className="p-8 sm:p-16">
        <div className="max-w-md">
          <RegisterForm />
        </div>
      </div>
    </>
  );
}
