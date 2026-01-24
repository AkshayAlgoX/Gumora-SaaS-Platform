"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BuyerShell from "../../../../components/buyer/common/buyer-shell";
import LibraryClient from "../../../../components/buyer/library/library-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
        const data = await res.json();
        if (!data?.user) return router.push("/login");

        const lib = await fetch(`${API_URL}/api/library`, { credentials: "include" });
        const libData = await lib.json();
        setItems(libData?.items ?? []);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  if (loading) return <BuyerShell><div className="flex items-center justify-center h-screen">Loading...</div></BuyerShell>;

  return (
    <BuyerShell>
      <main className="px-4 py-10 lg:px-[8vw]">
        <div className="mb-8 space-y-2">
          <h1 className="text-4xl leading-none tracking-tight md:text-5xl">Library</h1>
        </div>
        <LibraryClient items={items} />
      </main>
    </BuyerShell>
  );
}
