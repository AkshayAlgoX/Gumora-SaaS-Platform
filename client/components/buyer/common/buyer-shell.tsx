import { ReactNode } from "react";
import BuyerNavbar from "./navbar";

export default function BuyerShell({ 
  children, 
  isUserLoggedIn = false 
}: { 
  children: ReactNode;
  isUserLoggedIn?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#f5f5f2] text-black">
      <BuyerNavbar isUserLoggedIn={isUserLoggedIn} />
      {children}
    </div>
  );
}
