import BuyerSell from "../../../../../components/buyer/common/buyer-shell";
import BuyNewButton from "../../../../../components/buyer/discover/buy-new-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiServerGet } from "@/lib/api/server";
import { getMe } from "@/lib/auth/getMe";
import Link from "next/link";
import { redirect } from "next/navigation";

type LibraryItem = {
  productId: string;
  title: string;
  price: number;
  currency: "INR";
  paidAt: string | null;
};

type LibraryRes = { ok: boolean; items: LibraryItem[]; error?: string };

type ProductDetailRes = {
  ok: boolean;
  product?: {
    _id: string;
    creatorId: string;
    title: string;
    description: string;
    price: number;
    currency: "INR";
    slug: string;
    coverUrl: string | null;
  };
  error?: string;
};

function formatDate(input: string | null) {
  if (!input) return "-";

  return new Date(input).toLocaleDateString();
}

export default async function DiscoverDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const me = await getMe();

  const data = await apiServerGet<ProductDetailRes>(`/api/products/${slug}`);

  const getLibraryResponse = await apiServerGet<LibraryRes>("/api/library");
  const libraryItems = getLibraryResponse.items ?? [];

  if (!data.ok || !data.product) redirect("/discover");

  const productInfo = data.product;
  const coverUrl = productInfo.coverUrl;

  const isOwner = me.ok && me.user && me.user.id === productInfo.creatorId;

  return (
    <BuyerSell isUserLoggedIn={me.ok}>
      <main className="px-4 lg:px-[8vw] py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6">
            <Card className="bg-white border border-black/50 rounded-3xl overflow-hidden">
              <div className="relative aspect-square bg-[#efefea]">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Cover Image"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full grid place-items-center text-black/60">
                    No cover image yet!
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-6">
            <div className="lg:sticky lg:top-24 space-y-5">
              <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl leading-none tracking-tight">
                  {productInfo?.title}
                </h1>

                {productInfo?.description ? (
                  <p className="text-lg text-black/70 leading-relaxed">
                    {productInfo.description}
                  </p>
                ) : null}
              </div>

              <Card className="bg-white border-black/70 border rounded-3xl p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-sm text-black/60">Price</div>
                    <div className="text-3xl font-medium leading-none">
                      {productInfo.currency} {productInfo.price}
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  {!me.ok ? (
                    <Button asChild className="w-full h-12 rounded-xl">
                      <Link href="/login">Login To Buy</Link>
                    </Button>
                  ) : isOwner ? (
                    <div className="rounded-xl border border-black/50 bg-[#efefea] px-4 py-3 text-sm text-black">
                      You cant buy your own product
                    </div>
                  ) : libraryItems.filter(
                      (item) => item.productId === productInfo._id
                    ).length ? (
                    <Button className="w-full rounded-none border px-4 py-4 bg-black cursor-pointer text-sm disabled:opacity-65 font-medium">
                      You purchased this product{" "}
                      {formatDate(
                        libraryItems.find(
                          (item) => item.productId === productInfo._id
                        )?.paidAt || null
                      )}
                    </Button>
                  ) : (
                    <BuyNewButton productId={productInfo._id} />
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </BuyerSell>
  );
}
