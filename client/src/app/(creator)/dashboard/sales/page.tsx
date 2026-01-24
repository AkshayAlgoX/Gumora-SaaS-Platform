import { apiServerGet } from "@/lib/api/server";

type Sale = {
  productTitle: string;
  buyerEmail?: string;
  buyerName?: string;
  amount: number;
  currency: "INR";
  paidAt: string | null;
};
                                
function formatDate(input: string | null) {
  if (!input) return "-";

  return new Date(input).toLocaleDateString();
}

type SalesRes = { ok: boolean; sales: Sale[]; error?: string };

async function CreatorSalesPage() {
  const data = await apiServerGet<SalesRes>("/api/creator/sales");
  const sales = data.sales ?? [];

  return (
    <main className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-border bg-white p-4 md:p-8">
        <div className="flex items-center justify-between gap-2">
          <h1 className="line-clamp-2 hidden text-2xl font-semibold sm:block">
            Sales
          </h1>
        </div>
      </header>
      <section className="p-4 md:p-8">
        {sales.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">No Sales yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid grid-cols-12 border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">
              <div className="col-span-5">Product</div>
              <div className="col-span-3">Buyer</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2 text-right">Paid at</div>
            </div>
            {sales.map((saleItem, idx) => (
              <div
                key={`${saleItem.productTitle}-${idx}`}
                className="grid grid-cols-12 items-center border-b border-border px-4 py-3"
              >
                <div className="col-span-5">
                  <div className="text-sm font-medium">
                    {saleItem.productTitle}
                  </div>
                </div>

                <div className="col-span-3">
                  <div className="text-sm font-medium">
                    {saleItem.buyerName}
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  <div className="text-sm font-medium">
                    INR {saleItem.amount}
                  </div>
                </div>

                <div className="col-span-2 text-right">
                  <div className="text-sm font-medium">
                    {formatDate(saleItem.paidAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default CreatorSalesPage;
