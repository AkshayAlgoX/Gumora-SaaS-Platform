import { apiServerGet } from "@/lib/api/server";
import { Plus } from "lucide-react";
import Link from "next/link";

type ProductResponse = {
  ok: boolean;
  products: Array<{
    _id: string;
    title: string;
    price: number;
    visibility: string;
    stats: { assetCount: number };
  }>;
};



async function CreatorProductListPage() {
  
    const data=await apiServerGet<ProductResponse>("/api/creator/products")
    const products=data.products ?? [];
  return <main className="flex-1 overflow-y-auto">
         <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-border bg-white p-4 md:p-8">
    <div className="flex items-center justify-between gap-2">
        <h1 className="line-clamp-2 hidden text-2xl font-semibold sm:block">
            Products
        </h1>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-none md:-my-2">
           
           <Link href={"/dashboard/products/new"} 
           className="inline-flex h-9 items-center justify-center gap-2 rounded-none border border-border  bg-[#ff90e8] px-4 text-sm font-medium "
           >
            <Plus className="h-5 w-5"/>
            <span>Add New Product</span>
           </Link>

        </div>
        </div>
        </header>
        
        <section className="p-4 md:p-8">
  {!products.length ? (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">No products yet</p>
    </div>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <div
          key={p._id}
          className="rounded-xl border border-border bg-card p-4 transition hover:bg-card/80"
        > 
        <div className="flex items-start justify-between gap-3">
  <Link
    href={`/dashboard/products/${p._id}`}
    className="no-underline"
  >
    <h3 className="truncate text-base font-semibold">
      {p.title}
    </h3>
  </Link>
   <div className="mt-1 text-sm text-muted-foreground">
  INR {p.price} - {p.stats.assetCount} assets
</div>
</div>

<div className="mt-4 flex items-center justify-between gap-2">
  <div className="text-sm text-muted-foreground">
    ID: <span className="font-mono">{p._id.slice(-6)}</span>
  </div>
   
    <Link href={`/dashboard/products/${p._id}`}
    className="inline-flex h-9 items-center justify-center gap-2 rounded-none border border-border  bg-[#ff90e8] px-4 text-sm font-medium "
    >
  Open
</Link>


</div>
</div>
      ))}
    </div>
  )}
</section>



  </main>
}

export default CreatorProductListPage;
