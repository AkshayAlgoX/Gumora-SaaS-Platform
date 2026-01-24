"use client";

import { apiClient } from "@/lib/api/client";
import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  {
    label: "Discover",
    href: "/discover",
  },
  {
    label: "Library",
    href: "/library",
  },
];

type LogoutResponse = {
  ok: boolean;
};

function BuyerNavbar({ isUserLoggedIn }: { isUserLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    try {
      setLoading(true);
      const res = await apiClient.post<LogoutResponse>("/api/auth/logout");
      if (res?.data?.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-black">
      <div className="h-20 lg:pl-8 px-4 lg:pr-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center">
  <img
    src="/logo/gumora.svg"
    alt="Gumora"
    className="h-7 lg:h-8"
  />
</Link>

        </div>

        {/* desktop nav i   tems to render */}
        <div className="hidden lg:flex items-center h-full">
          <div className="flex items-center gap-1 px-6">
            {NAV_ITEMS.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                className="flex items-center justify-center whitespace-nowrap text-black text-base no-underline border border-transparent rounded-full py-2 px-4 hover:border-black"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {isUserLoggedIn ? (
            <div className="h-full flex items-center border-l border-black">
              <Link
                className="h-full flex items-center justify-center no-underline bg-black text-white px-6 border-l hover:bg-[#ff90e8] hover:text-black"
                href={"/dashboard/products"}
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="h-full flex items-center justify-center px-5 text-black"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="h-full flex items-center justify-center no-underline bg-black text-white px-6 border-l hover:bg-[#ff90e8] hover:text-black"
            >
              Login
            </Link>
          )}
        </div>

        {/* mobile */}
        <button
          onClick={() => setOpen(!open)}
          type="button"
          className="lg:hidden h-10 w-10 grid place-items-center"
        >
          {open ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
        </button>
      </div>
      <div
        className={`lg:hidden border-black bg-black text-white ${
          open ? "block" : "hidden"
        }`}
      >
        <div className="flex flex-col items-center">
          {NAV_ITEMS.map((item) => (
            <Link
              href={item.href}
              key={item.href}
              className="w-full text-center p-4 text-lg no-underline border border-transparent hover:border-black"
            >
              {item.label}
            </Link>
          ))}

          {isUserLoggedIn && (
            <>
              <Link
                href="/dashboard"
                className="w-full text-center p-4 text-lg no-underline border border-transparent hover:border-black"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                type="button"
                className="w-full text-center p-4 text-lg no-underline border border-transparent hover:border-black"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BuyerNavbar;
