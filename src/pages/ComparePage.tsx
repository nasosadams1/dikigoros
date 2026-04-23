import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock, MapPin, ShieldCheck, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import LawyerPhoto from "@/components/LawyerPhoto";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import { getLawyers } from "@/lib/lawyerRepository";
import { scoreLawyerForMarketplace } from "@/lib/level4Marketplace";
import { consultationModeNames, formatCurrency, getLawyerMarketplaceSignals, getPriceFrom } from "@/lib/marketplace";

const ComparePage = () => {
  const [searchParams] = useSearchParams();
  const selectedIds = useMemo(
    () => (searchParams.get("lawyers") || "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 3),
    [searchParams],
  );
  const { data: lawyers = [] } = useQuery({ queryKey: ["lawyers"], queryFn: getLawyers });
  const selectedLawyers = selectedIds.map((id) => lawyers.find((lawyer) => lawyer.id === id)).filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Σύγκριση επιλογών | Dikigoros"
        description="Συγκρίνετε τιμή, διαθεσιμότητα, απάντηση, αξιολογήσεις, τρόπο ραντεβού και στοιχεία ελέγχου πριν την κράτηση."
        path="/compare"
      />
      <Navbar />
      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Σύγκριση επιλογών</p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight text-foreground">Διαλέξτε ποιος ταιριάζει τώρα</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              Η σύγκριση χρησιμοποιεί τα ίδια δεδομένα αγοράς με την αναζήτηση: τιμή από, επόμενη ώρα, απάντηση, κριτικές, τρόπους συμβουλευτικής και επαλήθευση.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-lg font-bold">
            <Link to="/search">Πίσω στην αναζήτηση</Link>
          </Button>
        </div>

        {selectedLawyers.length > 0 ? (
          <section className="mt-8 grid gap-4 lg:grid-cols-3">
            {selectedLawyers.map((lawyer) => {
              const signals = getLawyerMarketplaceSignals(lawyer);
              const ranking = scoreLawyerForMarketplace(lawyer, {
                city: lawyer.city,
                category: lawyer.specialty,
              });
              return (
                <article key={lawyer.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start gap-4">
                    <LawyerPhoto src={lawyer.image} alt={lawyer.name} className="h-16 w-16 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">{lawyer.specialty}</p>
                      {ranking.sponsoredLabel ? (
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-primary">{ranking.sponsoredLabel}</p>
                      ) : null}
                      <h2 className="mt-1 truncate text-lg font-bold text-foreground">{lawyer.name}</h2>
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {lawyer.city}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <CompareCell label="Τιμή από" value={formatCurrency(getPriceFrom(lawyer))} />
                    <CompareCell label="Επόμενη ώρα" value={signals.availabilityLabel} icon={CalendarDays} />
                    <CompareCell label="Απάντηση" value={lawyer.response} icon={Clock} />
                    <CompareCell label="Κριτικές" value={`${lawyer.rating}/5 · ${lawyer.reviews}`} icon={Star} />
                    <CompareCell label="Τρόποι" value={lawyer.consultationModes.map((mode) => consultationModeNames[mode]).join(" / ")} />
                    <CompareCell label="Επαλήθευση" value={signals.verified ? "Στοιχεία ελεγμένα" : "Χρειάζεται έλεγχος"} icon={ShieldCheck} />
                  </div>

                  <div className="mt-5 grid gap-2">
                    <Button asChild className="rounded-lg font-bold">
                      <Link to={`/booking/${lawyer.id}?source=compare`}>
                        Κράτηση με αυτόν
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-lg font-bold">
                      <Link to={`/lawyer/${lawyer.id}`}>Άνοιγμα προφίλ</Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="mt-8 rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <h2 className="font-serif text-2xl tracking-tight text-foreground">Δεν υπάρχουν επιλογές σύγκρισης</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Επιλέξτε έως τρεις δικηγόρους από την αναζήτηση για να δείτε τη σύγκριση εδώ.
            </p>
            <Button asChild className="mt-5 rounded-lg font-bold">
              <Link to="/search">Βρες δικηγόρο</Link>
            </Button>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

const CompareCell = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) => (
  <div className="rounded-lg border border-border bg-background p-3">
    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </p>
    <p className="mt-1 text-sm font-bold leading-5 text-foreground">{value}</p>
  </div>
);

export default ComparePage;
