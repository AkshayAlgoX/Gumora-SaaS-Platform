import BuyerSell from "../../components/buyer/common/buyer-shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <BuyerSell>
      <header className="relative overflow-hidden">
        <div className="relative px-8 lg:px-[8vw] py-32 md:py-44 flex items-center justify-center">
          <div className="z-10 max-w-3xl text-center flex flex-col items-center gap-6">
            <h1 className="leading-none tracking-tight text-6xl md:text7xl lg:text-8xl">
              Go from idea <br className="sm:hidden" />
              <span className="whitespace-nowrap">to income</span>
            </h1>
            <p className="text-xl lg:text-2xl max-w-md lg:max-w3xl">
                   Turn your ideas into digital products.
                   Create once, sell anytime.
            </p>
            <div className="mt-2 w-full max-w-[384px] sm:max-w-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button
                asChild
                className="cursor-pointer hover:bg-[#ff90e8] hover:text-black text-white bg-black inline-flex w-full sm:w-auto items-center justify-center h-14 px-8 text-xl lg:h-16 lg:px-10 lg:text-xl rounded-none vorder border-black"
              >
                <Link href="/dashboard/products">Start Selling</Link>
              </Button>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0">
            <img
              src={
                "https://assets.gumroad.com/assets/about/coin-1-900b86390de4f6f0cd6bda6618b44a31a6e0971ce1c598f4ad793302a19970ad.svg"
              }
              alt="home icon 1"
              className="hidden md:block absolute w-40 lg:w-48 top-40 right-10 lg:right-45"
            />
            <img
              alt="Decorative coin 2"
              className="absolute w-36 md:w-44 top-28 left-[-10vw] md:left-[3vw]"
              src="https://assets.gumroad.com/assets/about/coin-2-93b4c6a1ced616c34caa743dc0097585ba3c52b96b2a9f6f72c70901c6895f3a.svg"
            />
            <img
              alt="Decorative coin 3"
              className="hidden sm:block absolute w-32 md:w-36 -top-8 right-[-4vw] md:right-[6vw]"
              src="https://assets.gumroad.com/assets/about/coin-3-720e0c9f6945039630ec07090143a614014e43d788e379be6ffafbe5f86fe31c.svg"
            />
            <img
              alt="Decorative coin 4"
              className="absolute w-40 md:w-44 top-[60%] right-[-14vw] sm:-right-16 lg:-right-12"
              src="https://assets.gumroad.com/assets/about/coin-4-8106d7fc3defa7992ba9b872525de187219f20a26e17dd9530f21f2ba8511fd9.svg"
            />
            <img
              alt="Decorative coin 5"
              className="absolute w-44 md:w-56 top-[72%] -left-8 sm:left-12 md:-left-24 lg:-left-12"
              src="https://assets.gumroad.com/assets/about/coin-5-8ca4434c469ed3cbc16bb17fdeb924e694f2656bb5fb34ddceb6a0f0167b4c52.svg"
            />
          </div>
        </div>
      </header>
    </BuyerSell>
  );
}
