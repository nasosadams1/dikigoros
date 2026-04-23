import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  Phone,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Users,
  Video,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import LawyerPhoto from "@/components/LawyerPhoto";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import { useAuth } from "@/context/AuthContext";
import { consultationModeLabels, type ConsultationMode, type Lawyer } from "@/data/lawyers";
import { areLawyerIdsEqual, fetchPartnerLawyerId, getStoredPartnerLawyerId } from "@/lib/partnerIdentity";
import { getLawyers } from "@/lib/lawyerRepository";
import { getPartnerSession } from "@/lib/platformRepository";
import {
  getUserWorkspace,
  syncUserWorkspace,
  toggleComparedLawyer as toggleComparedLawyerWorkspace,
  toggleSavedLawyer,
} from "@/lib/userWorkspace";
import {
  defaultLawyerSearchFilters,
  searchLawyers,
  type LawyerSearchFilters,
  type LawyerSort,
  type PriceRange,
} from "@/lib/lawyerSearch";
import {
  consultationModeNames,
  formatCurrency,
  getLawyerMarketplaceSignals,
  getPriceFrom,
  type AvailabilityIntent,
  type LanguageIntent,
} from "@/lib/marketplace";
import {
  allowedMarketplaceCityNames,
  legalPracticeAreas,
  legalPracticeAreaLabels,
  normalizeAllowedMarketplaceCity,
  normalizeLegalPracticeArea,
} from "@/lib/marketplaceTaxonomy";
import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import { cn } from "@/lib/utils";

const appointmentTypeOptions: Array<{ value: ConsultationMode; label: string; icon: LucideIcon }> = [
  { value: "video", label: consultationModeLabels.video, icon: Video },
  { value: "phone", label: consultationModeLabels.phone, icon: Phone },
  { value: "inPerson", label: consultationModeLabels.inPerson, icon: Users },
];

const priceOptions: Array<{ value: PriceRange; label: string }> = [
  { value: "30-50", label: "€30 - €50" },
  { value: "50-80", label: "€50 - €80" },
  { value: "80-120", label: "€80 - €120" },
  { value: "120+", label: "€120+" },
];

const sortTabs: Array<{ value: LawyerSort; label: string }> = [
  { value: "recommended", label: "Πιο κατάλληλη επιλογή" },
  { value: "response", label: "Ταχύτερη απόκριση" },
  { value: "value", label: "Καλύτερη τιμή" },
];

const sortOptions: Array<{ value: LawyerSort; label: string }> = [
  ...sortTabs,
  { value: "available", label: "Πρώτη διαθέσιμη ώρα" },
  { value: "rating", label: "Υψηλότερη αξιολόγηση" },
  { value: "price-low", label: "Χαμηλότερη τιμή" },
  { value: "experience", label: "Περισσότερη εμπειρία" },
];

const languageOptions: Array<{ value: LanguageIntent; label: string }> = [
  { value: "Greek", label: "Ελληνικά" },
  { value: "English", label: "Αγγλικά" },
];

const validAppointmentTypes = new Set<ConsultationMode>(appointmentTypeOptions.map((option) => option.value));
const validPriceRanges = new Set<PriceRange>(["all", ...priceOptions.map((option) => option.value)]);
const validSorts = new Set<LawyerSort>(sortOptions.map((option) => option.value));
const validAvailability = new Set<AvailabilityIntent>(["any", "today", "tomorrow"]);
const validLanguages = new Set<LanguageIntent>(languageOptions.map((option) => option.value));

const readListParam = <T extends string>(value: string | null, validValues: Set<T>) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is T => validValues.has(item as T));

const readTextListParam = (value: string | null) =>
  (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const readNumberParam = (value: string | null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getFiltersFromParams = (params: URLSearchParams): LawyerSearchFilters => {
  const price = params.get("price") as PriceRange | null;
  const sort = params.get("sort") as LawyerSort | null;
  const availability = params.get("availability") as AvailabilityIntent | null;

  return {
    query: params.get("q") || "",
    city: normalizeAllowedMarketplaceCity(params.get("city")) || "",
    specialties: readTextListParam(params.get("specialty")).map(normalizeLegalPracticeArea).filter(Boolean),
    appointmentTypes: readListParam(params.get("type"), validAppointmentTypes),
    priceRange: price && validPriceRanges.has(price) ? price : defaultLawyerSearchFilters.priceRange,
    sort: sort && validSorts.has(sort) ? sort : defaultLawyerSearchFilters.sort,
    availability: availability && validAvailability.has(availability) ? availability : "any",
    responseUnderMinutes: readNumberParam(params.get("responseUnder")),
    minRating: readNumberParam(params.get("minRating")),
    minReviews: readNumberParam(params.get("minReviews")),
    languages: readListParam(params.get("language"), validLanguages),
  };
};

const writeFiltersToParams = (filters: LawyerSearchFilters) => {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.city.trim()) params.set("city", filters.city.trim());
  if (filters.specialties.length > 0) params.set("specialty", filters.specialties.join(","));
  if (filters.appointmentTypes.length > 0) params.set("type", filters.appointmentTypes.join(","));
  if (filters.priceRange !== "all") params.set("price", filters.priceRange);
  if (filters.sort !== "recommended") params.set("sort", filters.sort);
  if (filters.availability && filters.availability !== "any") params.set("availability", filters.availability);
  if (filters.responseUnderMinutes) params.set("responseUnder", String(filters.responseUnderMinutes));
  if (filters.minRating) params.set("minRating", String(filters.minRating));
  if (filters.minReviews) params.set("minReviews", String(filters.minReviews));
  if (filters.languages?.length) params.set("language", filters.languages.join(","));
  return params;
};

const getActiveFilterCount = (filters: LawyerSearchFilters) =>
  (filters.query.trim() ? 1 : 0) +
  (filters.city.trim() ? 1 : 0) +
  filters.specialties.length +
  filters.appointmentTypes.length +
  (filters.priceRange !== "all" ? 1 : 0) +
  (filters.availability && filters.availability !== "any" ? 1 : 0) +
  (filters.responseUnderMinutes ? 1 : 0) +
  (filters.minRating ? 1 : 0) +
  (filters.minReviews ? 1 : 0) +
  (filters.languages?.length || 0);

const availabilityFilterLabels: Record<AvailabilityIntent, string> = {
  any: "Οποιαδήποτε διαθεσιμότητα",
  today: "Διαθέσιμο σήμερα",
  tomorrow: "Διαθέσιμο αύριο",
};

const getLanguageLabel = (language: LanguageIntent) =>
  languageOptions.find((option) => option.value === language)?.label || language;

const getAvailabilityDisplay = (value: string) =>
  value
    .replace(/^Today,/i, "Σήμερα,")
    .replace(/^Tomorrow,/i, "Αύριο,")
    .replace(/^Monday,/i, "Δευτέρα,");

const getResponseDisplay = (lawyer: Pick<Lawyer, "response" | "responseMinutes">) => {
  const response = lawyer.response.trim().replace("minutes", "λεπτά");
  if (!response || response === "Απάντηση" || lawyer.responseMinutes <= 0) {
    return "Χωρίς διαθέσιμα στοιχεία απόκρισης";
  }
  return response;
};

const getRatingDisplay = (lawyer: Pick<Lawyer, "rating" | "reviews">) =>
  lawyer.reviews > 0 && lawyer.rating > 0 ? `${lawyer.rating}/5 (${lawyer.reviews})` : "Χωρίς αξιολογήσεις ακόμη";

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const partnerSession = getPartnerSession();
  const workspaceKey = user?.id || partnerSession?.email;
  const filters = useMemo(() => getFiltersFromParams(searchParams), [searchParams]);
  const [showFilters, setShowFilters] = useState(false);
  const [queryDraft, setQueryDraft] = useState(filters.query);
  const [cityDraft, setCityDraft] = useState(filters.city);
  const [workspace, setWorkspace] = useState(() => getUserWorkspace(workspaceKey));
  const [currentPartnerLawyerId, setCurrentPartnerLawyerId] = useState<string | null>(() => getStoredPartnerLawyerId(partnerSession?.email));
  const { data: lawyerDataset = [], isFetching } = useQuery({
    queryKey: ["lawyers"],
    queryFn: getLawyers,
  });

  useEffect(() => {
    setQueryDraft(filters.query);
    setCityDraft(filters.city);
  }, [filters.query, filters.city]);

  useEffect(() => {
    setWorkspace(getUserWorkspace(workspaceKey));
  }, [workspaceKey]);

  useEffect(() => {
    if (!partnerSession?.email) {
      setCurrentPartnerLawyerId(null);
      return;
    }

    let active = true;
    setCurrentPartnerLawyerId(getStoredPartnerLawyerId(partnerSession.email));
    void fetchPartnerLawyerId(partnerSession.email).then((lawyerId) => {
      if (active) setCurrentPartnerLawyerId(lawyerId);
    });

    return () => {
      active = false;
    };
  }, [partnerSession?.email]);

  const availableSpecialtyOptions = useMemo(() => [...legalPracticeAreaLabels], []);
  const availableCityOptions = useMemo(() => [...allowedMarketplaceCityNames], []);
  const results = useMemo(() => searchLawyers(lawyerDataset, filters), [filters, lawyerDataset]);
  const selectedLawyers = useMemo(
    () => workspace.comparedLawyerIds.map((id) => lawyerDataset.find((lawyer) => lawyer.id === id)).filter((lawyer): lawyer is Lawyer => Boolean(lawyer)),
    [lawyerDataset, workspace.comparedLawyerIds],
  );
  const activeFilterCount = getActiveFilterCount(filters);

  const updateFilters = (nextFilters: LawyerSearchFilters, replace = false) => {
    setSearchParams(writeFiltersToParams(nextFilters), { replace });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateFilters({ ...filters, query: queryDraft, city: normalizeAllowedMarketplaceCity(cityDraft) });
    setShowFilters(false);
  };

  const clearFilters = () => {
    setQueryDraft("");
    setCityDraft("");
    updateFilters(defaultLawyerSearchFilters);
  };

  const toggleSpecialty = (specialty: string) => {
    const specialties = filters.specialties.includes(specialty)
      ? filters.specialties.filter((item) => item !== specialty)
      : [...filters.specialties, specialty];
    updateFilters({ ...filters, specialties });
  };

  const toggleAppointmentType = (type: ConsultationMode) => {
    const appointmentTypes = filters.appointmentTypes.includes(type)
      ? filters.appointmentTypes.filter((item) => item !== type)
      : [...filters.appointmentTypes, type];
    updateFilters({ ...filters, appointmentTypes });
  };

  const toggleLanguage = (language: LanguageIntent) => {
    const languages = filters.languages?.includes(language)
      ? filters.languages.filter((item) => item !== language)
      : [...(filters.languages || []), language];
    updateFilters({ ...filters, languages });
  };

  const handleToggleSavedLawyer = (lawyerId: string) => {
    const nextWorkspace = toggleSavedLawyer(workspaceKey, lawyerId);
    setWorkspace(nextWorkspace);
    void syncUserWorkspace(workspaceKey, nextWorkspace, user?.id);
  };

  const handleToggleComparedLawyer = (lawyerId: string) => {
    const nextWorkspace = toggleComparedLawyerWorkspace(workspaceKey, lawyerId);
    setWorkspace(nextWorkspace);
    void syncUserWorkspace(workspaceKey, nextWorkspace, user?.id);
  };

  const removeComparedLawyer = (lawyerId: string) => {
    if (workspace.comparedLawyerIds.includes(lawyerId)) handleToggleComparedLawyer(lawyerId);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Βρες δικηγόρο | Dikigoros"
        description="Αναζητήστε ελεγμένα προφίλ δικηγόρων με βάση θέμα, πόλη, αξιολογήσεις, χρόνο απάντησης, διαθεσιμότητα, τρόπο ραντεβού και τιμή."
        path="/search"
      />
      <Navbar />

      <div className="sticky top-16 z-40 border-b border-border bg-card/95 backdrop-blur-md lg:top-[72px]">
        <form onSubmit={handleSearchSubmit} className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3.5 lg:px-8">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Νομικό θέμα ή όνομα δικηγόρου"
              className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="relative hidden md:block md:w-56">
            <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={cityDraft}
              onChange={(event) => setCityDraft(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Όλες οι πόλεις</option>
              {availableCityOptions.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          <Button type="submit" className="h-11 rounded-lg px-6 text-sm font-bold">
            Αναζήτηση
          </Button>
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className="relative flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground lg:hidden"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </form>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6 pb-28 lg:px-8 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)_16rem]">
          <aside className={cn(showFilters ? "block" : "hidden", "lg:block")}>
            <div className="relative overflow-hidden rounded-lg border border-border/80 bg-card shadow-[0_18px_48px_rgba(15,23,42,0.08)] lg:sticky lg:top-32">
              <div className="premium-scrollbar max-h-[calc(100vh-9rem)] space-y-0 overflow-y-auto overscroll-contain px-4 py-3">
                <div className="border-b border-border/70 pb-4 pt-1">
                  <div className="rounded-lg border border-border/70 bg-secondary/45 p-4 shadow-sm shadow-foreground/[0.02]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-card text-primary shadow-sm">
                          <SlidersHorizontal className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Σύγκριση</p>
                          <h2 className="mt-1 text-[17px] font-bold tracking-[-0.01em] text-foreground">Φίλτρα επιλογής</h2>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearFilters}
                        disabled={activeFilterCount === 0}
                        title="Καθαρισμός φίλτρων"
                        aria-label="Καθαρισμός φίλτρων"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">Δείτε μόνο δικηγόρους που ταιριάζουν στην υπόθεσή σας.</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Ενεργά φίλτρα</span>
                      <span className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                        activeFilterCount > 0
                          ? "border-primary/20 bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground",
                      )}>
                        {activeFilterCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-b border-border/70 pb-4 pt-2 md:hidden">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Πόλη</label>
                  <select
                    value={cityDraft}
                    onChange={(event) => {
                      setCityDraft(event.target.value);
                      updateFilters({ ...filters, city: event.target.value });
                    }}
                    className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground"
                  >
                    <option value="">Όλες οι πόλεις</option>
                    {availableCityOptions.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-border/70 bg-secondary/25 px-3">
                  <FilterGroup label="Διαθεσιμότητα και εμπιστοσύνη">
                    <RadioFilter name="availability" label="Διαθέσιμο αύριο" checked={filters.availability === "tomorrow"} onChange={() => updateFilters({ ...filters, availability: filters.availability === "tomorrow" ? "any" : "tomorrow" })} />
                    <CheckboxFilter label="Απαντά σε έως 2 ώρες" checked={filters.responseUnderMinutes === 120} onChange={() => updateFilters({ ...filters, responseUnderMinutes: filters.responseUnderMinutes === 120 ? null : 120 })} />
                    <CheckboxFilter label="10+ επιβεβαιωμένες αξιολογήσεις" checked={filters.minReviews === 10} onChange={() => updateFilters({ ...filters, minReviews: filters.minReviews === 10 ? null : 10 })} />
                  </FilterGroup>

                  <FilterGroup label="Τρόποι ραντεβού">
                    {appointmentTypeOptions.map((option) => (
                      <CheckboxFilter key={option.value} label={option.label} checked={filters.appointmentTypes.includes(option.value)} onChange={() => toggleAppointmentType(option.value)} />
                    ))}
                  </FilterGroup>

                  <FilterGroup label="Ειδίκευση">
                    {availableSpecialtyOptions.slice(0, 10).map((specialty) => (
                      <CheckboxFilter key={specialty} label={specialty} checked={filters.specialties.includes(specialty)} onChange={() => toggleSpecialty(specialty)} />
                    ))}
                  </FilterGroup>

                  <FilterGroup label="Πόλη">
                    {availableCityOptions.map((item) => (
                      <RadioFilter
                        key={item}
                        name="city-filter"
                        label={item}
                        checked={filters.city === item}
                        onChange={() => {
                          setCityDraft(item);
                          updateFilters({ ...filters, city: filters.city === item ? "" : item });
                        }}
                      />
                    ))}
                  </FilterGroup>

                  <FilterGroup label="Τιμή από">
                    {priceOptions.map((option) => (
                      <RadioFilter
                        key={option.value}
                        name="price-filter"
                        label={option.label}
                        checked={filters.priceRange === option.value}
                        onChange={() => updateFilters({ ...filters, priceRange: filters.priceRange === option.value ? "all" : option.value })}
                      />
                    ))}
                  </FilterGroup>

                  <FilterGroup label="Γλώσσα">
                    {languageOptions.map((option) => (
                      <CheckboxFilter key={option.value} label={option.label} checked={Boolean(filters.languages?.includes(option.value))} onChange={() => toggleLanguage(option.value)} />
                    ))}
                  </FilterGroup>
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {results.length === 1 ? "Βρέθηκε 1 δικηγόρος" : `Βρέθηκαν ${results.length} δικηγόροι`}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Η σύγκριση βασίζεται σε δημόσια στοιχεία προφίλ.
                    {isFetching ? " Ανανεώνονται τα στοιχεία." : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground">
                  <Scale className="h-4 w-4 text-primary" />
                  {selectedLawyers.length} από 3 δικηγόρους στη σύγκριση
                </div>
              </div>

              <div className="mt-4 flex flex-nowrap gap-2">
                {sortTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => updateFilters({ ...filters, sort: tab.value })}
                    className={cn(
                      "whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-bold transition",
                      filters.sort === tab.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/30",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
                <select
                  value={filters.sort}
                  onChange={(event) => updateFilters({ ...filters, sort: event.target.value as LawyerSort })}
                  className="h-9 min-w-[14.5rem] rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground"
                  aria-label="Επιπλέον ταξινόμηση"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeFilterCount > 0 ? <ActiveFilterSummary filters={filters} onClear={clearFilters} /> : null}

            {results.length > 0 ? (
              <div className="space-y-4">
                {results.map((lawyer) => {
                  const saved = workspace.savedLawyerIds.includes(lawyer.id);
                  const compared = workspace.comparedLawyerIds.includes(lawyer.id);
                  const isOwnLawyerProfile = areLawyerIdsEqual(currentPartnerLawyerId, lawyer.id);

                  return (
                    <article key={lawyer.id} data-testid={`lawyer-result-${lawyer.id}`} className="overflow-hidden rounded-lg border border-border bg-card transition hover:border-primary/20 hover:shadow-xl hover:shadow-foreground/[0.05]">
                      <div className="p-5 md:p-6">
                        <div className="flex flex-col gap-5 md:flex-row md:items-start">
                          <div className="relative shrink-0">
                            <LawyerPhoto src={lawyer.image} alt={lawyer.name} className="h-24 w-24 rounded-lg object-cover shadow-lg ring-2 ring-background md:h-28 md:w-28" />
                            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sage ring-2 ring-card">
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-primary">{lawyer.specialty}</p>
                                <h3 className="mt-1 text-xl font-bold text-foreground">{lawyer.name}</h3>
                                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-foreground/70">{lawyer.bestFor}</p>
                              </div>
                              <div className="rounded-lg border border-border bg-secondary/45 px-4 py-3 text-left md:text-right">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Τιμή από</p>
                                <p className="text-2xl font-bold text-foreground">{formatCurrency(getPriceFrom(lawyer))}</p>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <SpecificTrustCopy>Έλεγχος δικηγορικού συλλόγου</SpecificTrustCopy>
                              <SpecificTrustCopy>Αξιολογήσεις μόνο μετά από ολοκληρωμένη κράτηση</SpecificTrustCopy>
                              <SpecificTrustCopy>Πραγματικές ώρες κράτησης</SpecificTrustCopy>
                            </div>

                            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              <ProofCell icon={CalendarDays} label="Πρώτη διαθέσιμη ώρα" value={getAvailabilityDisplay(lawyer.available)} />
                              <ProofCell icon={Scale} label="Τιμή από" value={formatCurrency(getPriceFrom(lawyer))} />
                              <ProofCell icon={Clock} label="Συνήθης απόκριση" value={getResponseDisplay(lawyer)} />
                              <ProofCell icon={Star} label="Αξιολογήσεις" value={getRatingDisplay(lawyer)} />
                              <ProofCell icon={Video} label="Τρόποι ραντεβού" value={lawyer.consultationModes.map((item) => consultationModeNames[item]).join(", ")} />
                              <ProofCell icon={MapPin} label="Πόλη" value={lawyer.city} />
                            </div>

                            <details className="mt-4 rounded-lg border border-border bg-background px-4 py-3">
                              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-muted-foreground">Προβολή σύνοψης</summary>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{lawyer.bio}</p>
                            </details>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 border-t border-border bg-secondary/35 px-5 py-3.5 md:flex-row md:items-center md:justify-between md:px-6">
                        <div className="flex flex-wrap items-center gap-2">
                          {lawyer.consultationModes.map((mode) => {
                            const Icon = appointmentTypeOptions.find((option) => option.value === mode)?.icon || Video;
                            return (
                              <span key={mode} className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-[11px] font-bold text-foreground">
                                <Icon className="h-3 w-3" />
                                {consultationModeLabels[mode]}
                              </span>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant={saved ? "default" : "outline"} size="sm" onClick={() => handleToggleSavedLawyer(lawyer.id)} className="h-9 rounded-lg px-3 text-xs font-bold">
                            <Heart className={cn("h-3.5 w-3.5", saved && "fill-current")} />
                            {saved ? "Αποθηκευμένο" : "Αποθήκευση"}
                          </Button>
                          <Button type="button" variant={compared ? "default" : "outline"} size="sm" onClick={() => handleToggleComparedLawyer(lawyer.id)} className="h-9 rounded-lg px-3 text-xs font-bold">
                            <Scale className="h-3.5 w-3.5" />
                            {compared ? "Στη σύγκριση" : "Προσθήκη στη σύγκριση"}
                          </Button>
                          <Button asChild variant="outline" size="sm" className="h-9 rounded-lg px-4 text-xs font-bold">
                            <Link
                              to={`/lawyer/${lawyer.id}`}
                              data-testid={`lawyer-profile-${lawyer.id}`}
                              onClick={() => trackFunnelEvent("search_profile_opened", { lawyerId: lawyer.id, resultCount: results.length })}
                            >
                              Προφίλ Δικηγόρου
                            </Link>
                          </Button>
                          {isOwnLawyerProfile ? (
                            <Button type="button" size="sm" disabled className="h-9 rounded-lg px-5 text-xs font-bold">Το προφίλ σας</Button>
                          ) : (
                            <Button asChild size="sm" className="h-9 rounded-lg px-5 text-xs font-bold">
                              <Link
                                to={`/booking/${lawyer.id}?source=search`}
                                data-testid={`lawyer-booking-${lawyer.id}`}
                                onClick={() => trackFunnelEvent("profile_booking_start", { lawyerId: lawyer.id, source: "search_direct" })}
                              >
                                Κλείστε ραντεβού
                                <ArrowRight className="ml-1 h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Search className="h-6 w-6" />
                </div>
                <h2 className="mt-5 font-serif text-2xl tracking-tight text-foreground">Δεν βρέθηκε δικηγόρος με αυτά τα φίλτρα</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Δοκιμάστε πιο γενικό θέμα, κοντινή πόλη ή λιγότερα φίλτρα διαθεσιμότητας και απόκρισης.
                </p>
                <Button onClick={clearFilters} variant="outline" className="mt-5 rounded-lg font-bold">
                  Καθαρισμός φίλτρων
                </Button>
              </div>
            )}
          </main>

          <aside className="hidden lg:block">
            <CompareRail selectedLawyers={selectedLawyers} onRemove={removeComparedLawyer} />
          </aside>
        </div>
      </div>

      <section className="border-t border-border bg-secondary/35">
        <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sage">Νομικά θέματα</p>
              <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground">Ξεκινήστε από το θέμα σας</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Επιλέξτε το νομικό θέμα που σας αφορά για να δείτε σχετικούς δικηγόρους.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {legalPracticeAreas.map((area) => (
              <Link
                key={area.slug}
                to={`/lawyers/${area.slug}`}
                className="rounded-lg border border-border bg-card p-4 transition hover:border-primary/30 hover:shadow-md"
              >
                <h3 className="break-words text-base font-bold leading-6 text-foreground">{area.shortLabel}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                  {area.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary">
                  Δείτε δικηγόρους
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {selectedLawyers.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-3 shadow-2xl lg:hidden">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">{selectedLawyers.length} επιλεγμένοι</p>
                <p className="text-xs font-semibold text-muted-foreground">Τιμή · εμπιστοσύνη · διαθεσιμότητα</p>
              </div>
              <Button asChild className="rounded-lg text-xs font-bold">
                <Link to={`/compare?lawyers=${selectedLawyers.map((lawyer) => lawyer.id).join(",")}`}>Σύγκριση τώρα</Link>
              </Button>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {selectedLawyers.map((lawyer) => (
                <div key={lawyer.id} className="min-w-[13rem] rounded-lg border border-border bg-background px-3 py-2">
                  <p className="truncate text-xs font-bold text-foreground">{lawyer.name}</p>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">
                    {formatCurrency(getPriceFrom(lawyer))} · {getResponseDisplay(lawyer)} · {getAvailabilityDisplay(lawyer.available)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
};

const FilterGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="border-t border-border/70 py-5 first:border-t-0 first:pt-4 last:pb-7">
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    <div className="mt-3 space-y-2.5">{children}</div>
  </div>
);

const CheckboxFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
  <label
    className={cn(
      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm font-semibold leading-5 transition",
      checked
        ? "border-primary/35 bg-primary/10 text-primary shadow-sm shadow-primary/[0.06]"
        : "border-border/70 bg-card text-foreground hover:border-primary/25 hover:bg-secondary/40",
    )}
  >
    <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary" />
    <span className="min-w-0">{label}</span>
  </label>
);

const RadioFilter = ({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) => (
  <label
    className={cn(
      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm font-semibold leading-5 transition",
      checked
        ? "border-primary/35 bg-primary/10 text-primary shadow-sm shadow-primary/[0.06]"
        : "border-border/70 bg-card text-foreground hover:border-primary/25 hover:bg-secondary/40",
    )}
  >
    <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 border-border accent-primary" />
    <span className="min-w-0">{label}</span>
  </label>
);

const ProofCell = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-background p-3">
    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </p>
    <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
  </div>
);

const SpecificTrustCopy = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-sage/10 px-2.5 py-1 text-[11px] font-bold text-sage-foreground">
    <ShieldCheck className="h-3.5 w-3.5" />
    {children}
  </span>
);

const CompareMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="min-h-[4rem] rounded-md border border-border bg-card px-3 py-2">
    <p className="break-words text-[10px] font-bold uppercase leading-4 tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 break-words text-xs font-bold leading-5 text-foreground">{value}</p>
  </div>
);

const CompareRail = ({
  selectedLawyers,
  onRemove,
}: {
  selectedLawyers: Lawyer[];
  onRemove: (lawyerId: string) => void;
}) => {
  const cheapest = selectedLawyers.length
    ? [...selectedLawyers].sort((first, second) => getPriceFrom(first) - getPriceFrom(second))[0]
    : null;
  const fastest = selectedLawyers.length
    ? [...selectedLawyers].sort((first, second) => first.responseMinutes - second.responseMinutes)[0]
    : null;
  const mostReviewed = selectedLawyers.length
    ? [...selectedLawyers].sort((first, second) => second.reviews - first.reviews)[0]
    : null;

  return (
    <div id="compare" className="sticky top-32 flex max-h-[calc(100vh-9rem)] flex-col rounded-lg border border-border bg-card p-5">
      <div className="shrink-0">
        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Scale className="h-4 w-4 text-primary" />
          Πίνακας σύγκρισης
        </p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">{selectedLawyers.length} από 3 δικηγόρους στη σύγκριση</p>
      </div>

      <div className="premium-scrollbar mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {selectedLawyers.length > 1 ? (
          <div className="rounded-lg border border-border bg-secondary/35 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Με μια ματιά</p>
            <div className="mt-2 grid gap-2 text-[11px] font-bold text-foreground">
              {cheapest ? <span>Καλύτερη τιμή: {cheapest.name}</span> : null}
              {fastest ? <span>Ταχύτερη απόκριση: {fastest.name}</span> : null}
              {mostReviewed ? <span>Περισσότερες αξιολογήσεις: {mostReviewed.name}</span> : null}
            </div>
          </div>
        ) : null}

        {selectedLawyers.length > 0 ? selectedLawyers.map((lawyer) => {
          const signals = getLawyerMarketplaceSignals(lawyer);

          return (
            <div key={lawyer.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start gap-3">
                <LawyerPhoto src={lawyer.image} alt={lawyer.name} className="h-10 w-10 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-bold leading-5 text-foreground">{lawyer.name}</p>
                  <p className="break-words text-[11px] font-semibold leading-4 text-muted-foreground">{lawyer.specialty}</p>
                </div>
                <button type="button" onClick={() => onRemove(lawyer.id)} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={`Αφαίρεση ${lawyer.name}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                <CompareMetric label="Τιμή" value={signals.priceFromLabel} />
                <CompareMetric label="Αξιολογήσεις" value={getRatingDisplay(lawyer)} />
                <CompareMetric label="Συνήθης απόκριση" value={getResponseDisplay(lawyer)} />
                <CompareMetric label="Πρώτη διαθέσιμη ώρα" value={getAvailabilityDisplay(signals.availabilityLabel)} />
                <CompareMetric label="Τρόποι ραντεβού" value={lawyer.consultationModes.map((item) => consultationModeNames[item]).join(" / ")} />
                <CompareMetric label="Αριθμός αξιολογήσεων" value={`${lawyer.reviews}`} />
              </div>
            </div>
          );
        }) : (
          <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
            Προσθέστε έως τρεις δικηγόρους για να συγκρίνετε στοιχεία προφίλ, τιμή, απόκριση και πρώτη διαθέσιμη ώρα.
          </div>
        )}
      </div>

      <Button asChild className="mt-4 w-full shrink-0 rounded-lg text-xs font-bold">
        <Link to={`/compare?lawyers=${selectedLawyers.map((lawyer) => lawyer.id).join(",")}`}>
          Δείτε την πλήρη σύγκριση
        </Link>
      </Button>
    </div>
  );
};

const ActiveFilterSummary = ({ filters, onClear }: { filters: LawyerSearchFilters; onClear: () => void }) => (
  <div className="mb-5 flex flex-wrap items-center gap-2">
    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">Ενεργά φίλτρα</span>
    {filters.query ? <FilterPill>{filters.query}</FilterPill> : null}
    {filters.city ? <FilterPill>{filters.city}</FilterPill> : null}
    {filters.availability && filters.availability !== "any" ? <FilterPill>{availabilityFilterLabels[filters.availability]}</FilterPill> : null}
    {filters.responseUnderMinutes ? <FilterPill>{`Απαντά σε έως ${filters.responseUnderMinutes / 60} ώ.`}</FilterPill> : null}
    {filters.minRating ? <FilterPill>{`Βαθμολογία ${filters.minRating}+`}</FilterPill> : null}
    {filters.minReviews ? <FilterPill>{`${filters.minReviews}+ επιβεβαιωμένες αξιολογήσεις`}</FilterPill> : null}
    {filters.languages?.map((language) => <FilterPill key={language}>{getLanguageLabel(language)}</FilterPill>)}
    <button type="button" onClick={onClear} className="text-xs font-bold text-primary">Καθαρισμός όλων</button>
  </div>
);

const FilterPill = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">{children}</span>
);

export default SearchResults;
