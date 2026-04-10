import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import PartnerTopBar from "./PartnerTopBar";

interface PartnerShellProps {
  children: ReactNode;
  className?: string;
}

const PartnerShell = ({ children, className }: PartnerShellProps) => {
  return (
    <div className="partner-shell min-h-screen">
      <PartnerTopBar />
      <main className={cn("mx-auto max-w-7xl px-4 pb-14 pt-7 sm:px-6 lg:px-8 lg:pt-9", className)}>{children}</main>
    </div>
  );
};

export default PartnerShell;
