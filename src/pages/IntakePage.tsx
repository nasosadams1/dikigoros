import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock3, Euro, MapPin, Scale, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { getLawyers } from "@/lib/lawyerRepository";
import { allowedMarketplaceCities, legalPracticeAreas } from "@/lib/marketplaceTaxonomy";
import { formatCurrency, getPriceFrom } from "@/lib/marketplace";
import { createIntakeRequest, routeIntakeRequest, type IntakeRequestPayload, type StoredIntakeRequest } from "@/lib/intakeRepository";
import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import type { ConsultationMode } from "@/data/lawyers";
import type { IntakeBudget, IntakeUrgency } from "@/lib/level4Marketplace";

const budgetOptions: Array<{ value: IntakeBudget; label: string }> = [
  { value: "flexible", label: "Ευέλικτο" },
  { value: "under_50", label: "Έως €50" },
  { value: "50_80", label: "€50-€80" },
  { value: "80_120", label: "€80-€120" },
  { value: "120_plus", label: "Πάνω από €120" },
];

const urgencyOptions: Array<{ value: IntakeUrgency; label: string }> = [
  { value: "today", label: "Σήμερα" },
  { value: "this_week", label: "Μέσα στην εβδομάδα" },
  { value: "flexible", label: "Ευέλικτα" },
];

const modeOptions: Array<{ value: ConsultationMode | "any"; label: string }> = [
  { value: "any", label: "Οποιοσδήποτε τρόπος" },
  { value: "video", label: "Βιντεοκλήση" },
  { value: "phone", label: "Τηλέφωνο" },
  { value: "inPerson", label: "Από κοντά" },
];

const IntakePage = () => {
  const [searchParams] = useSearchParams();
  const initialCity = searchParams.get("city") || allowedMarketplaceCities[0].slug;
  const initialCategory = searchParams.get("category") || legalPracticeAreas[0].slug;
  const { data: lawyers = [] } = useQuery({ queryKey: ["lawyers"], queryFn: getLawyers });
  const [payload, setPayload] = useState<IntakeRequestPayload>({
    city: initialCity,
    category: initialCategory,
    urgency: "this_week",
    budget: "flexible",
    consultationMode: "any",
    timing: "",
    issueSummary: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [savedRequest, setSavedRequest] = useState<StoredIntakeRequest | null>(null);
  const [error, setError] = useState("");

  const routedLawyers = useMemo(
    () => routeIntakeRequest(lawyers, payload).slice(0, 3),
    [lawyers, payload],
  );

  const selectedCity = allowedMarketplaceCities.find((city) => city.slug === payload.city);
  const selectedCategory = legalPracticeAreas.find((category) => category.slug === payload.category);

  const updatePayload = (updates: Partial<IntakeRequestPayload>) =>
    setPayload((current) => ({ ...current, ...updates }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const ranked = routeIntakeRequest(lawyers, payload);
      const saved = await createIntakeRequest(payload, ranked.map((result) => result.lawyer.id));
      setSavedRequest(saved);
      trackFunnelEvent("intake_submitted", {
        city: selectedCity?.title || payload.city,
        category: selectedCategory?.label || payload.category,
        source: "guided_intake",
      });
      if (ranked.length > 0) {
        trackFunnelEvent("intake_routed", {
          city: selectedCity?.title || payload.city,
          category: selectedCategory?.label || payload.category,
          lawyerId: ranked[0].lawyer.id,
          source: "guided_intake",
        });
      }
    } catch {
      setError("Δεν ήταν δυνατό να αποθηκευτεί το αίτημα.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Σύντομη περιγραφή υπόθεσης | Dikigoros"
        description="Συμπληρώστε πόλη, νομική κατηγορία, επείγον, προϋπολογισμό, τρόπο συμβουλευτικής και σύντομη περιγραφή για να δείτε κατάλληλους ελεγμένους δικηγόρους."
        path="/intake"
      />
      <Navbar />
      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Σύντομη περιγραφή υπόθεσης</p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight text-foreground">
              Πείτε μας τι χρειάζεστε και δείτε κατάλληλους δικηγόρους.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
              Χρησιμοποιούμε την πόλη, την κατηγορία, τη διαθεσιμότητα, την τιμή, τον χρόνο απόκρισης και τις αξιολογήσεις για να σας δείξουμε επιλογές που ταιριάζουν στην υπόθεσή σας. Η ενισχυμένη προβολή φαίνεται πάντα καθαρά και δεν αντικαθιστά τον έλεγχο του προφίλ.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <IntakeStat icon={MapPin} label="Πόλεις" value="5" helper="Όλες οι διαθέσιμες πόλεις" />
              <IntakeStat icon={Scale} label="Κατηγορίες" value="5" helper="Οι βασικές νομικές κατηγορίες" />
              <IntakeStat icon={Clock3} label="Επιλογές" value="Με σειρά" helper="Με βάση τα στοιχεία του αιτήματος" />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Πόλη">
                  <select
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
                    value={payload.city}
                    onChange={(event) => updatePayload({ city: event.target.value })}
                  >
                    {allowedMarketplaceCities.map((city) => (
                      <option key={city.slug} value={city.slug}>{city.title}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Νομική κατηγορία">
                  <select
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
                    value={payload.category}
                    onChange={(event) => updatePayload({ category: event.target.value })}
                  >
                    {legalPracticeAreas.map((category) => (
                      <option key={category.slug} value={category.slug}>{category.shortLabel}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Επείγον">
                  <select
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
                    value={payload.urgency}
                    onChange={(event) => updatePayload({ urgency: event.target.value as IntakeUrgency })}
                  >
                    {urgencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Προϋπολογισμός">
                  <select
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
                    value={payload.budget}
                    onChange={(event) => updatePayload({ budget: event.target.value as IntakeBudget })}
                  >
                    {budgetOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Τρόπος συμβουλευτικής">
                  <select
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
                    value={payload.consultationMode}
                    onChange={(event) => updatePayload({ consultationMode: event.target.value as ConsultationMode | "any" })}
                  >
                    {modeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Προτίμηση ώρας">
                <input
                  className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
                  value={payload.timing}
                  onChange={(event) => updatePayload({ timing: event.target.value })}
                  placeholder="Π.χ. καθημερινή απόγευμα, σήμερα μετά τις 16:00"
                />
              </Field>

              <Field label="Σύντομη περιγραφή">
                <textarea
                  className="min-h-32 rounded-lg border border-input bg-background px-3 py-3 text-sm leading-6"
                  value={payload.issueSummary}
                  onChange={(event) => updatePayload({ issueSummary: event.target.value })}
                  required
                  minLength={20}
                  placeholder="Περιγράψτε το θέμα, τυχόν προθεσμία, βασικά έγγραφα και τι χρειάζεστε από την πρώτη συμβουλευτική."
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Ονοματεπώνυμο">
                  <input className="h-11 rounded-lg border border-input bg-background px-3 text-sm" value={payload.clientName} onChange={(event) => updatePayload({ clientName: event.target.value })} />
                </Field>
                <Field label="Ηλεκτρονικό ταχυδρομείο">
                  <input type="email" className="h-11 rounded-lg border border-input bg-background px-3 text-sm" value={payload.clientEmail} onChange={(event) => updatePayload({ clientEmail: event.target.value })} />
                </Field>
                <Field label="Τηλέφωνο">
                  <input className="h-11 rounded-lg border border-input bg-background px-3 text-sm" value={payload.clientPhone} onChange={(event) => updatePayload({ clientPhone: event.target.value })} />
                </Field>
              </div>

              {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{error}</p> : null}

              <Button type="submit" className="rounded-lg font-bold" disabled={submitting}>
                <Send className="mr-2 h-4 w-4" />
                {submitting ? "Αποθήκευση..." : "Αποστολή αιτήματος"}
              </Button>
            </form>
          </section>
        </div>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          {routedLawyers.map((result, index) => (
            <article key={result.lawyer.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                <img src={result.lawyer.image} alt={result.lawyer.name} className="h-16 w-16 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Επιλογή #{index + 1}</p>
                  <h2 className="mt-1 truncate text-base font-bold text-foreground">{result.lawyer.name}</h2>
                  <p className="text-xs font-semibold text-muted-foreground">{result.lawyer.city}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-foreground">
                <span className="flex items-center gap-1"><Euro className="h-3.5 w-3.5" />{formatCurrency(getPriceFrom(result.lawyer))}</span>
                <span>{result.lawyer.response}</span>
                <span>{result.lawyer.rating}/5</span>
                <span>{result.sponsoredLabel || "Χωρίς ενισχυμένη προβολή"}</span>
              </div>
              <Button asChild className="mt-4 w-full rounded-lg font-bold">
                <Link to={`/lawyer/${result.lawyer.id}`}>
                  Άνοιγμα προφίλ
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </article>
          ))}
        </section>

        {savedRequest ? (
          <section className="mt-8 rounded-lg border border-sage/30 bg-sage/10 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-sage" />
              <div>
                <h2 className="text-base font-bold text-foreground">Το αίτημα αποθηκεύτηκε: {savedRequest.referenceId}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {savedRequest.rankedLawyerIds.length} επιλογές δικηγόρων συνδέθηκαν με το αίτημα.
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="grid gap-2 text-sm font-bold text-foreground">
    {label}
    {children}
  </label>
);

const IntakeStat = ({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
}) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </p>
    <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    <p className="mt-1 text-xs font-semibold text-muted-foreground">{helper}</p>
  </div>
);

export default IntakePage;
