import BuyerSell from "../../../../../components/buyer/common/buyer-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

function CheckoutCancelPage() {
  return (
    <BuyerSell>
      <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-16">
        <Card className="p-8 w-full border bg-card shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            Payment Cancelled
          </h1>
          <div className="mt-6">
            <Button asChild className="w-full rounded-none h-12">
              <Link href="/discover">Back to Discover</Link>
            </Button>
          </div>
        </Card>
      </div>
    </BuyerSell>
  );
}

export default CheckoutCancelPage;
