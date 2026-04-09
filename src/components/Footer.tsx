import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground">
                <span className="font-serif text-lg text-primary">Δ</span>
              </div>
              <span className="font-serif text-xl tracking-tight">Dikigoros</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
              Η πιο αξιόπιστη πλατφόρμα στην Ελλάδα για να βρεις και να κλείσεις ραντεβού με πιστοποιημένους δικηγόρους.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Πλατφόρμα</h4>
            <ul className="space-y-3">
              <li><Link to="/search" className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">Αναζήτηση Δικηγόρων</Link></li>
              <li><Link to="/#how-it-works" className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">Πώς Λειτουργεί</Link></li>
              <li><Link to="/#categories" className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">Κατηγορίες Δικαίου</Link></li>
              <li><Link to="/#faq" className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">Συχνές Ερωτήσεις</Link></li>
            </ul>
          </div>

          {/* For Lawyers */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Για Δικηγόρους</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">Εγγραφή Δικηγόρου</a></li>
              <li><a href="#" className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">Πώς Λειτουργεί</a></li>
              <li><a href="#" className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">Τιμολόγηση</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">Νομικά</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">Όροι Χρήσης</a></li>
              <li><a href="#" className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">Πολιτική Απορρήτου</a></li>
              <li><a href="#" className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">Επικοινωνία</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/10 pt-8 md:flex-row">
          <p className="text-xs text-primary-foreground/50">© 2025 Dikigoros. Με επιφύλαξη παντός δικαιώματος.</p>
          <p className="text-xs text-primary-foreground/50">Σχεδιασμένο στην Ελλάδα 🇬🇷</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
