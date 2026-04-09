import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthContainer from "@/components/auth/AuthContainer";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const location = useLocation();

  const links = [
    { label: "Αρχική", path: "/" },
    { label: "Αναζήτηση Δικηγόρων", path: "/search" },
    { label: "Πώς Λειτουργεί", path: "/#how-it-works" },
    { label: "Συχνές Ερωτήσεις", path: "/#faq" },
  ];

  return (
    <>
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:h-[72px] lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="font-serif text-lg text-primary-foreground">Δ</span>
          </div>
          <span className="font-serif text-xl tracking-tight text-foreground">Dikigoros</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`text-sm font-medium transition-colors hover:text-foreground ${
                location.pathname === link.path ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            size="sm"
            className="text-sm font-medium text-muted-foreground"
            onClick={() => setAuthOpen(true)}
          >
            Σύνδεση
          </Button>
          <Button size="sm" className="rounded-lg px-5 text-sm font-medium">
            Είστε Δικηγόρος;
          </Button>
        </div>

        {/* Mobile Toggle */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
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
              <Button className="w-full">Είστε Δικηγόρος;</Button>
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
