import { apiServerGet } from "@/lib/api/server";
import { AssetsRes } from "@/lib/types/product";
import Link from "next/link";
import ProductEditor from "../../../../../../components/creator/dashboard/products/product-editor/product-editor";
import { redirect } from "next/navigation";

type ProductRes = {
  ok: boolean;
  product: any;
};

async function ProductEditorPage({params}:{
  params:Promise<{productId : string}>
}) {
  

  const {productId}=await params;

  
  const [productResponse,assetResponse] =await Promise.all([
    apiServerGet<ProductRes>(`/api/creator/products/${productId}`),
    apiServerGet<AssetsRes>(`/api/creator/products/${productId}/assets`)
  ])
  
  if(!productResponse.ok){
    redirect("/dashboard/products")
  }
  return <main className="flex-1 overflow-y-auto">

  <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-border bg-white p-4 md:p-8">
    <div className="flex items-center justify-between gap-2">
        <h1 className="line-clamp-2 hidden text-2xl font-semibold sm:block">
            Product Details
        </h1>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-none md:-my-2">
           <Link href={"/dashboard/products"} 
           className="inline-flex h-9 items-center justify-center gap-2 rounded-none border border-border bg-[#ff90e8] px-4 text-sm font-medium "
           >
            <span>Back</span>
           </Link>

        </div>
        </div>
        </header>
        <section className="p-4 md:p-8">
          <ProductEditor
          productId={productId} 
          initialProduct={productResponse.product}
          initialAssets={assetResponse.ok? assetResponse.assets : []} 
          />
        </section>

  </main>
   
}
export default ProductEditorPage;
