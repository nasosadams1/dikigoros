import { Home, LogOut, Scale } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearPartnerSession, getPartnerSession } from "@/lib/platformRepository";
import { cn } from "@/lib/utils";

const publicNavLinks = [
  { label: "Για δικηγόρους", path: "/for-lawyers" },
  { label: "Είσοδος συνεργάτη", path: "/for-lawyers/login" },
  { label: "Αίτηση συνεργασίας", path: "/for-lawyers/apply" },
];

const PartnerTopBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const partnerSession = getPartnerSession();

  const handleSignOut = () => {
    clearPartnerSession();
    navigate("/for-lawyers/login", { replace: true });
  };

  return (
    <header className="border-b border-black/6 bg-[rgba(251,247,241,0.96)] backdrop-blur">
      <div className="mx-auto grid min-h-[62px] max-w-[1280px] grid-cols-[auto_1fr_auto] items-center gap-3 px-3 sm:px-5 lg:px-6">
        <Link to={partnerSession ? "/" : "/for-lawyers"} className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))]">
            <Scale className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">Dikigoros</p>
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {partnerSession ? "Πίνακας συνεργάτη" : "Πρόσβαση συνεργατών"}
            </p>
          </div>
        </Link>

        <div className="flex min-w-0 justify-center">
          {!partnerSession ? (
            <nav className="hidden h-10 items-center rounded-[14px] border border-[hsl(var(--partner-line))] bg-white/70 p-1 md:flex">
              {publicNavLinks.map((link) => {
                const [path, query = ""] = link.path.split("?");
                const active = query
                  ? location.pathname === path && location.search === `?${query}`
                  : location.pathname === path && !location.search;

                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "inline-flex h-8 items-center rounded-[11px] border px-4 text-sm font-semibold transition",
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

        <div className="flex min-w-0 items-center justify-end gap-2">
          {partnerSession ? (
            <>
              <Link
                to="/"
                className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-[hsl(var(--partner-line))] bg-white/70 px-3 text-xs font-bold text-[hsl(var(--partner-ink))] transition hover:bg-white sm:text-sm"
              >
                <Home className="h-4 w-4" />
                Αρχική
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-[hsl(var(--partner-line))] bg-white/70 px-3 text-xs font-bold text-[hsl(var(--partner-ink))] transition hover:bg-white sm:text-sm"
              >
                <LogOut className="h-4 w-4" />
                Αποσύνδεση
              </button>
            </>
          ) : (
            <Link
              to="/search"
              className="inline-flex h-9 items-center rounded-[12px] border border-[hsl(var(--partner-line))] bg-white/70 px-3 text-xs font-bold text-[hsl(var(--partner-ink))] transition hover:bg-white sm:text-sm"
            >
              Αναζήτηση δικηγόρου
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default PartnerTopBar;
