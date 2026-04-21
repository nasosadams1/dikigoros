import { ArrowUpRight, Scale } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { getPartnerSession } from "@/lib/platformRepository";
import { cn } from "@/lib/utils";

const publicNavLinks = [
  { label: "Για Δικηγόρους", path: "/for-lawyers" },
  { label: "Πλάνα", path: "/for-lawyers/plans" },
  { label: "Είσοδος Συνεργάτη", path: "/for-lawyers/login" },
  { label: "Αίτηση Συνεργασίας", path: "/for-lawyers/apply" },
];

const PartnerTopBar = () => {
  const location = useLocation();
  const partnerSession = getPartnerSession();
  const navLinks = partnerSession ? [] : publicNavLinks;

  return (
    <header className="border-b border-black/6 bg-[rgba(251,247,241,0.94)] backdrop-blur">
      <div className="mx-auto grid h-[72px] max-w-[1280px] grid-cols-[auto_1fr_auto] items-center gap-4 px-5 sm:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))]">
            <Scale className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">Dikigoros</p>
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Πρόσβαση συνεργατών</p>
          </div>
        </Link>

        <div className="flex justify-center">
          {navLinks.length > 0 ? (
          <nav className="hidden h-11 items-center rounded-[16px] border border-[hsl(var(--partner-line))] bg-white/70 p-1 md:flex">
            {navLinks.map((link) => {
              const [path, query = ""] = link.path.split("?");
              const active = query
                ? location.pathname === path && location.search === `?${query}`
                : location.pathname === path && !location.search;

              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "inline-flex h-9 items-center rounded-[12px] border px-4 text-sm font-semibold transition",
                    active
                      ? "border-[hsl(var(--partner-navy))] bg-[hsl(var(--partner-navy))] text-white"
                      : "border-transparent bg-transparent text-[hsl(var(--partner-navy-soft))] hover:border-[hsl(var(--partner-line))] hover:text-[hsl(var(--partner-ink))]",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Link
            to="/search"
            className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[hsl(var(--partner-line))] bg-white/70 px-4 text-sm font-medium text-[hsl(var(--partner-ink))] transition hover:bg-white"
          >
            Επιστροφή στην Πλατφόρμα
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
};

export default PartnerTopBar;
