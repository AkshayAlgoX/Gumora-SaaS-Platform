"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CreatorSidebar from "components/creator/common/sidebar";
import { toast } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });
        const data = await res.json();
        if (data?.user) {
          setIsAuth(true);
        } else {
          toast.error("Please login first");
          router.push("/login");
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        toast.error("Auth error");
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
    <div
      id="dashboard-layout"
      className="flex h-screen flex-col lg:flex-row"
    >
      <CreatorSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
