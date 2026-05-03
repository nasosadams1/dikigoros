import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import PartnerTopBar from "./PartnerTopBar";

interface PartnerShellProps {
  children: ReactNode;
  className?: string;
  chrome?: "partner" | "profile";
}

const PartnerShell = ({ children, className, chrome = "partner" }: PartnerShellProps) => {
  const profileChrome = chrome === "profile";

  return (
    <div className={profileChrome ? "min-h-screen bg-background" : "partner-shell min-h-screen"}>
      {profileChrome ? <Navbar /> : <PartnerTopBar />}
      <main
        className={cn(
          profileChrome
            ? "mx-auto max-w-7xl px-4 py-4 lg:px-6 lg:py-6"
            : "mx-auto max-w-[1280px] px-3 pb-8 pt-4 sm:px-5 lg:px-6",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
};

export default PartnerShell;
