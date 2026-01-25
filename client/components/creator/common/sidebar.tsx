'use client'

import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  BadgeDollarSign,
  Compass,
  Library,
  LogOut,
  Menu,
  Home,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "../../ui/sheet";
import { Button } from "../../ui/button";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TOP: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Products", href: "/dashboard/products", icon: Package },
  { label: "Sales", href: "/dashboard/sales", icon: BadgeDollarSign },
];

const MID: NavItem[] = [
  { label: "Discover", href: "/discover", icon: Compass },
  { label: "Library", href: "/library", icon: Library },
];

type LogoutResponse = { ok: boolean };

function NavLink({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3 text-sm transition",
        "hover:bg-white/10",
        active && "bg-white/10",
        collapsed ? "justify-center" : "justify-start"
      )}
    >
      {/* Active indicator */}
      {active && (
        <span className="absolute left-0 top-0 h-full w-1 bg-fuchsia-400 rounded-r" />
      )}

      <Icon className="h-6 w-6 shrink-0" />

      {!collapsed && <span>{item.label}</span>}

      {/* Tooltip */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 rounded bg-black px-2 py-1 text-xs opacity-0 shadow group-hover:opacity-100 whitespace-nowrap">
          {item.label}
        </span>
      )}
    </Link>
  );
}

function LinksBlock({
  items,
  pathName,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  pathName: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="grid">
      {items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={item.href === pathName}
          collapsed={collapsed}
          onClick={onNavigate}
        />
      ))}
    </div>
  );
}

export default function CreatorSidebar() {
  const pathName = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    // Lazy initialization to avoid hydration mismatch
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("creator-sidebar-collapsed");
      return stored === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("creator-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  async function onLogout() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data?.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (e) {
      console.error("Logout failed:", e);
      // Force redirect anyway
      router.push("/login");
    }
  }

  return (
    <nav
      className={cn(
        "flex flex-col bg-black text-white transition-all duration-300",
        collapsed ? "lg:w-16" : "lg:w-56"
      )}
    >
      {/* MOBILE HEADER */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4 lg:hidden">
        <div className="text-base font-semibold">Dashboard</div>
        <div />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <SheetTitle className="sr-only">Dashboard Navigation</SheetTitle>
            <div className="bg-black text-white h-full">
              <div className="px-4 py-4 text-base font-semibold">
                Dashboard
              </div>

              <LinksBlock
                items={TOP}
                pathName={pathName}
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
              />

              <LinksBlock
                items={MID}
                pathName={pathName}
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
              />

              <button
                onClick={onLogout}
                className="mt-auto w-full flex items-center gap-3 px-6 py-4 hover:bg-white/10"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* DESKTOP SIDEBAR */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-4">
          {!collapsed && (
            <span className="text-lg font-semibold">Dashboard</span>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-1 hover:bg-white/10 rounded"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </header>

        <section className="mb-6">
          <LinksBlock
            items={TOP}
            pathName={pathName}
            collapsed={collapsed}
          />
        </section>

        <section className="mb-6">
          <LinksBlock
            items={MID}
            pathName={pathName}
            collapsed={collapsed}
          />
        </section>

        <footer className="mt-auto">
          <button
            onClick={onLogout}
            className={cn(
              "flex items-center gap-3 px-4 py-4 w-full hover:bg-white/10",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Logout</span>}
          </button>
        </footer>
      </div>
    </nav>
  );
}
