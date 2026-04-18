import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
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
  { value: "recommended", label: "Καλύτερη αντιστοίχιση" },
  { value: "response", label: "Ταχύτερη απάντηση" },
  { value: "value", label: "Καλύτερη τιμή" },
  { value: "available", label: "Πιο άμεση ώρα" },
];

const sortOptions: Array<{ value: LawyerSort; label: string }> = [
  ...sortTabs,
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

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const partnerSession = getPartnerSession();
  const workspaceKey = user?.id || partnerSession?.email;
  const filters = useMemo(() => getFiltersFromParams(searchParams), [searchParams]);
  const [showFilters, setShowFilters] = useState(false);
  const filterScrollRef = useRef<HTMLDivElement | null>(null);
  const [showFilterScrollHint, setShowFilterScrollHint] = useState(false);
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

  useEffect(() => {
    const element = filterScrollRef.current;
    if (!element) return;

    const updateScrollHint = () => {
      const hasOverflow = element.scrollHeight > element.clientHeight + 4;
      const canScrollFurther = element.scrollTop + element.clientHeight < element.scrollHeight - 4;
      setShowFilterScrollHint(hasOverflow && canScrollFurther);
    };

    const timeoutId = window.setTimeout(updateScrollHint, 0);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollHint) : null;

    element.addEventListener("scroll", updateScrollHint, { passive: true });
    window.addEventListener("resize", updateScrollHint);
    resizeObserver?.observe(element);

    return () => {
      window.clearTimeout(timeoutId);
      element.removeEventListener("scroll", updateScrollHint);
      window.removeEventListener("resize", updateScrollHint);
      resizeObserver?.disconnect();
    };
  }, [showFilters, activeFilterCount, filters, availableCityOptions.length, availableSpecialtyOptions.length]);

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
        title="Σύγκριση δικηγόρων | Dikigoros"
        description="Συγκρίνετε ελεγμένα προφίλ δικηγόρων με βάση ειδίκευση, καταλληλότητα, πόλη, αξιολογήσεις, χρόνο απάντησης, διαθεσιμότητα, τρόπο συμβουλευτικής και τιμή από."
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
        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)_18rem]">
          <aside className={cn(showFilters ? "block" : "hidden", "lg:block")}>
            <div className="relative overflow-hidden rounded-lg border border-border/80 bg-card shadow-xl shadow-foreground/[0.04] lg:sticky lg:top-32">
              <div ref={filterScrollRef} className="premium-scrollbar max-h-[min(70vh,calc(100vh-13rem))] space-y-0 overflow-y-auto overscroll-contain px-4 py-2 lg:max-h-[calc(100vh-16rem)]">
                <div className="border-b border-border/70 bg-card/95 pb-4 pt-2 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Σύγκριση</p>
                      <h2 className="mt-1 text-sm font-bold text-foreground">Φίλτρα απόφασης</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Κρατήστε μόνο δικηγόρους που ταιριάζουν στην υπόθεση.</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {activeFilterCount > 0 ? (
                        <span className="rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground">
                          {activeFilterCount} ενεργά
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold text-foreground transition hover:border-primary/30 hover:text-primary"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Καθαρισμός
                      </button>
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

                <FilterGroup label="Πρόθεση κράτησης">
                  <RadioFilter name="availability" label="Διαθέσιμο σήμερα" checked={filters.availability === "today"} onChange={() => updateFilters({ ...filters, availability: filters.availability === "today" ? "any" : "today" })} />
                  <RadioFilter name="availability" label="Διαθέσιμο αύριο" checked={filters.availability === "tomorrow"} onChange={() => updateFilters({ ...filters, availability: filters.availability === "tomorrow" ? "any" : "tomorrow" })} />
                  <CheckboxFilter label="Απαντά εντός 1 ώρας" checked={filters.responseUnderMinutes === 60} onChange={() => updateFilters({ ...filters, responseUnderMinutes: filters.responseUnderMinutes === 60 ? null : 60 })} />
                  <CheckboxFilter label="Απαντά εντός 2 ωρών" checked={filters.responseUnderMinutes === 120} onChange={() => updateFilters({ ...filters, responseUnderMinutes: filters.responseUnderMinutes === 120 ? null : 120 })} />
                  <CheckboxFilter label="Βαθμολογία 4,8+" checked={filters.minRating === 4.8} onChange={() => updateFilters({ ...filters, minRating: filters.minRating === 4.8 ? null : 4.8 })} />
                  <CheckboxFilter label="10+ επαληθευμένες αξιολογήσεις" checked={filters.minReviews === 10} onChange={() => updateFilters({ ...filters, minReviews: filters.minReviews === 10 ? null : 10 })} />
                </FilterGroup>

                <FilterGroup label="Γλώσσα">
                  {languageOptions.map((option) => (
                    <CheckboxFilter key={option.value} label={option.label} checked={Boolean(filters.languages?.includes(option.value))} onChange={() => toggleLanguage(option.value)} />
                  ))}
                </FilterGroup>

                <FilterGroup label="Τρόπος συμβουλευτικής">
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
              </div>
              {showFilterScrollHint ? (
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-center bg-gradient-to-t from-card via-card/90 to-transparent pb-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/95 text-primary shadow-lg shadow-foreground/[0.08]">
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </div>
              ) : null}
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{results.length}</span>{" "}
                    {results.length === 1 ? "δικηγόρος βρέθηκε" : "δικηγόροι βρέθηκαν"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Σύγκριση με αποδείξεις από δημόσια προφίλ αγοράς.
                    {isFetching ? " Ανανεώνονται τα ζωντανά δεδομένα." : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground">
                  <Scale className="h-4 w-4 text-primary" />
                  {selectedLawyers.length}/3 στη σύγκριση
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {sortTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => updateFilters({ ...filters, sort: tab.value })}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-2 text-xs font-bold transition",
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
                  className="h-9 shrink-0 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground"
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
                            <img src={lawyer.image} alt={lawyer.name} className="h-24 w-24 rounded-lg object-cover shadow-lg ring-2 ring-background md:h-28 md:w-28" />
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
                              <SpecificTrustCopy>Κριτικές μόνο μετά από ολοκληρωμένη κράτηση</SpecificTrustCopy>
                              <SpecificTrustCopy>Πραγματικές ώρες κράτησης</SpecificTrustCopy>
                            </div>

                            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              <ProofCell icon={CalendarDays} label="Επόμενη ώρα" value={lawyer.available} />
                              <ProofCell icon={Scale} label="Τιμή από" value={formatCurrency(getPriceFrom(lawyer))} />
                              <ProofCell icon={Clock} label="Απάντηση" value={lawyer.response} />
                              <ProofCell icon={Star} label="Αξιολόγηση" value={`${lawyer.rating} (${lawyer.reviews})`} />
                              <ProofCell icon={Video} label="Τρόποι" value={lawyer.consultationModes.map((item) => consultationModeNames[item]).join(", ")} />
                              <ProofCell icon={MapPin} label="Πόλη" value={lawyer.city} />
                            </div>

                            <details className="mt-4 rounded-lg border border-border bg-background px-4 py-3">
                              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-muted-foreground">Σύνοψη προφίλ</summary>
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
                            {compared ? "Στη σύγκριση" : "Σύγκριση"}
                          </Button>
                          <Button asChild variant="outline" size="sm" className="h-9 rounded-lg px-4 text-xs font-bold">
                            <Link
                              to={`/lawyer/${lawyer.id}`}
                              data-testid={`lawyer-profile-${lawyer.id}`}
                              onClick={() => trackFunnelEvent("search_profile_opened", { lawyerId: lawyer.id, resultCount: results.length })}
                            >
                              Προφίλ απόφασης
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
                                Κράτηση
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
                  Δοκιμάστε πιο γενικό θέμα, κοντινή πόλη ή λιγότερα φίλτρα πρόθεσης κράτησης.
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
                    {formatCurrency(getPriceFrom(lawyer))} · {lawyer.response} · {lawyer.available}
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
  <div className="border-t border-border/70 py-4 first:border-t-0 first:pt-2 last:pb-7">
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    <div className="mt-3 space-y-2">{children}</div>
  </div>
);

const CheckboxFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
  <label
    className={cn(
      "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-semibold leading-5 transition",
      checked
        ? "border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/[0.04]"
        : "border-border/70 bg-background/70 text-foreground hover:border-primary/25 hover:bg-background",
    )}
  >
    <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary" />
    <span>{label}</span>
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
      "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-semibold leading-5 transition",
      checked
        ? "border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/[0.04]"
        : "border-border/70 bg-background/70 text-foreground hover:border-primary/25 hover:bg-background",
    )}
  >
    <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 border-border accent-primary" />
    <span>{label}</span>
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
  <div className="rounded-md border border-border bg-card px-2 py-1.5">
    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-0.5 truncate text-[11px] font-bold text-foreground">{value}</p>
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
    <div id="compare" className="sticky top-32 rounded-lg border border-border bg-card p-5">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Scale className="h-4 w-4 text-primary" />
        Κέντρο σύγκρισης
      </p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{selectedLawyers.length}/3 δικηγόροι επιλεγμένοι</p>

      {selectedLawyers.length > 1 ? (
        <div className="mt-4 rounded-lg border border-border bg-secondary/35 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Γρήγορη ανάγνωση</p>
          <div className="mt-2 grid gap-2 text-[11px] font-bold text-foreground">
            {cheapest ? <span>Καλύτερη τιμή: {cheapest.name}</span> : null}
            {fastest ? <span>Πιο γρήγορη απάντηση: {fastest.name}</span> : null}
            {mostReviewed ? <span>Περισσότερη κοινωνική απόδειξη: {mostReviewed.name}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {selectedLawyers.length > 0 ? selectedLawyers.map((lawyer) => {
          const signals = getLawyerMarketplaceSignals(lawyer);

          return (
            <div key={lawyer.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start gap-3">
                <img src={lawyer.image} alt={lawyer.name} className="h-10 w-10 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{lawyer.name}</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">{lawyer.specialty}</p>
                </div>
                <button type="button" onClick={() => onRemove(lawyer.id)} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={`Αφαίρεση ${lawyer.name}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <CompareMetric label="Τιμή" value={signals.priceFromLabel} />
                <CompareMetric label="Αξιολόγηση" value={`${lawyer.rating}/5`} />
                <CompareMetric label="Απάντηση" value={lawyer.response} />
                <CompareMetric label="Επόμενη ώρα" value={signals.availabilityLabel} />
                <CompareMetric label="Τρόπος" value={lawyer.consultationModes.map((item) => consultationModeNames[item]).join(" / ")} />
                <CompareMetric label="Κριτικές" value={`${lawyer.reviews}`} />
              </div>
            </div>
          );
        }) : (
          <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
            Προσθέστε έως τρεις δικηγόρους για να συγκρίνετε αποδείξεις, τιμή, απάντηση και επόμενη διαθέσιμη ώρα.
          </div>
        )}
      </div>

      <Button asChild className="mt-4 w-full rounded-lg text-xs font-bold">
        <Link to={`/compare?lawyers=${selectedLawyers.map((lawyer) => lawyer.id).join(",")}`}>
          Άνοιγμα πλήρους σύγκρισης
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
    {filters.responseUnderMinutes ? <FilterPill>{`Απαντά εντός ${filters.responseUnderMinutes / 60} ώ.`}</FilterPill> : null}
    {filters.minRating ? <FilterPill>{`Βαθμολογία ${filters.minRating}+`}</FilterPill> : null}
    {filters.minReviews ? <FilterPill>{`${filters.minReviews}+ επαληθευμένες κριτικές`}</FilterPill> : null}
    {filters.languages?.map((language) => <FilterPill key={language}>{getLanguageLabel(language)}</FilterPill>)}
    <button type="button" onClick={onClear} className="text-xs font-bold text-primary">Καθαρισμός όλων</button>
  </div>
);

const FilterPill = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">{children}</span>
);

export default SearchResults;
