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
      <main className={cn("mx-auto max-w-[1280px] px-5 pb-10 pt-6 sm:px-8 lg:pt-8", className)}>{children}</main>
    </div>
  );
};

export default PartnerShell;
