'use client'

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReactNode } from "react";

export function ImportModeTabs({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="space-y-6">
      <TabsList
        className="
          inline-flex
          rounded-lg
          border
          bg-white
          p-1
          shadow-sm
        "
      >
        <TabsTrigger
          value="search"
          className="
            rounded-md
            px-5
            py-2
            text-sm
            font-medium
            transition
            data-[state=active]:bg-[#ff90e8]
            data-[state=active]:text-black
          "
        >
          Search
        </TabsTrigger>

        <TabsTrigger
          value="scrape"
          className="
            rounded-md
            px-5
            py-2
            text-sm
            font-medium
            transition
            data-[state=active]:bg-[#ff90e8]
            data-[state=active]:text-black
          "
        >
          Quick Import (Scrape)
        </TabsTrigger>
      </TabsList>

      {children}
    </Tabs>
  );
}
