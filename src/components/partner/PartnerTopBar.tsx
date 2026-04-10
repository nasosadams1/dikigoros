import { ArrowUpRight, Scale } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Για Δικηγόρους", path: "/for-lawyers" },
  { label: "Είσοδος Συνεργάτη", path: "/for-lawyers/login" },
  { label: "Αίτηση Συνεργασίας", path: "/for-lawyers/apply" },
];

const PartnerTopBar = () => {
  const location = useLocation();

  return (
    <header className="border-b border-black/5 bg-[rgba(248,243,235,0.82)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))] shadow-lg shadow-[rgba(15,28,44,0.18)]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <p className="font-serif text-xl tracking-tight text-[hsl(var(--partner-ink))]">Dikigoros</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Πρόσβαση Συνεργατών</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-black/5 bg-white/40 p-1 md:flex">
            {navLinks.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition",
                    active && "bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))] shadow-sm",
                    !active && "hover:text-[hsl(var(--partner-ink))]",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <Link
          to="/search"
          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/50 px-4 py-2 text-sm font-semibold text-[hsl(var(--partner-ink))] transition hover:border-black/15 hover:bg-white/80"
        >
          Δημόσια Πλατφόρμα
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
};

export default PartnerTopBar;
