import BuyerSell from "../../../../components/buyer/common/buyer-shell";
import LibraryClient from "../../../../components/buyer/library/library-client";
import { apiServerGet } from "@/lib/api/server";
import { getMe } from "@/lib/auth/getMe";
import { redirect } from "next/navigation";

export type LibraryItem = {
  productId: string;
  title: string;
  price: number;
  currency: "INR";
  paidAt: string | null;
};

export type LibraryRes = { ok: boolean; items: LibraryItem[]; error?: string };

async function LibraryPage() {
  const me = await getMe();

  if (!me.ok) redirect("/login");

  const data = await apiServerGet<LibraryRes>("/api/library");
  const items = data.items ?? [];

  return (
    <BuyerSell>
      <main className="px-4 py-10 lg:px-[8vw]">
        <div className="mb-8 space-y-2">
          <h1 className="text-4xl leading-none tracking-tight md:text-5xl">
            Library
          </h1>
        </div>
        <LibraryClient items={items} />
      </main>
    </BuyerSell>
  );
}

export default LibraryPage;
