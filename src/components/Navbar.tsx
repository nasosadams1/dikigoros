import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthContainer from "@/components/auth/AuthContainer";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const location = useLocation();

  const links = [
    { label: "Αρχική", path: "/#top" },
    { label: "Αναζήτηση Δικηγόρων", path: "/search" },
    { label: "Πως λειτουργεί", path: "/#how-it-works" },
    { label: "Συχνές ερωτήσεις", path: "/#faq" },
  ];

  const currentPath = useMemo(() => `${location.pathname}${location.hash}`, [location.hash, location.pathname]);

  const isActive = (path: string) => {
    if (path === "/#top") {
      return location.pathname === "/" && (location.hash === "" || location.hash === "#top");
    }

    return currentPath === path || location.pathname === path;
  };

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:h-[72px] lg:px-8">
          <Link to="/#top" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="font-serif text-lg text-primary-foreground">Δ</span>
            </div>
            <span className="font-serif text-xl tracking-tight text-foreground">Dikigoros</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors hover:text-foreground ${
                  isActive(link.path) ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Button
              variant="ghost"
              size="sm"
              className="text-sm font-medium text-muted-foreground"
              onClick={() => setAuthOpen(true)}
            >
              Σύνδεση
            </Button>
            <Button asChild size="sm" className="rounded-lg px-5 text-sm font-medium">
              <Link to="/for-lawyers">Είστε Δικηγόρος;</Link>
            </Button>
          </div>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Open navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-border bg-background px-5 pb-6 pt-4 md:hidden">
            <div className="flex flex-col gap-4">
              {links.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-base font-medium text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-3 border-t border-border pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setMobileOpen(false);
                    setAuthOpen(true);
                  }}
                >
                  Σύνδεση
                </Button>
                <Button asChild className="w-full">
                  <Link to="/for-lawyers" onClick={() => setMobileOpen(false)}>
                    Είστε Δικηγόρος;
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>
      <AuthContainer open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
};

export default Navbar;
