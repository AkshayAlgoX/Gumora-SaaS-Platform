"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BuyerShell from "../../../../components/buyer/common/buyer-shell";
import LibraryClient from "../../../../components/buyer/library/library-client";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function LibPage() {
  const r = useRouter();
  const [l, setL] = useState(true);
  const [i, setI] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const a = await fetch(`${API}/api/auth/me`, { credentials: "include" });
        const d = await a.json();
        if (!d?.user) return r.push("/login");
        const b = await fetch(`${API}/api/library`, { credentials: "include" });
        const e = await b.json();
        setI(e?.items ?? []);
      } catch {
        r.push("/login");
      } finally {
        setL(false);
      }
    })();
  }, [r]);

  return (
    <BuyerShell>
      {l ? (
        <div className="flex h-screen items-center justify-center">Loading...</div>
      ) : (
        <main className="px-4 py-10 lg:px-[8vw]">
          <h1 className="mb-8 text-5xl font-normal leading-none tracking-tight">Library</h1>
          <LibraryClient items={i} />
        </main>
      )}
    </BuyerShell>
  );
}
