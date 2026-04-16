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
import Navbar from "@/components/Navbar";
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
  type AvailabilityIntent,
  type LanguageIntent,
} from "@/lib/marketplace";
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
  { value: "recommended", label: "Recommended" },
  { value: "response", label: "Fastest response" },
  { value: "value", label: "Best value" },
  { value: "available", label: "Available soon" },
];

const sortOptions: Array<{ value: LawyerSort; label: string }> = [
  ...sortTabs,
  { value: "rating", label: "Highest rating" },
  { value: "price-low", label: "Lowest price" },
  { value: "experience", label: "Most experience" },
];

const languageOptions: Array<{ value: LanguageIntent; label: string }> = [
  { value: "Greek", label: "Greek" },
  { value: "English", label: "English" },
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
    city: params.get("city") || "",
    specialties: readTextListParam(params.get("specialty")),
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

  const availableSpecialtyOptions = useMemo(
    () => Array.from(new Set(lawyerDataset.flatMap((lawyer) => [lawyer.specialty, ...lawyer.specialties]))).filter(Boolean).sort((a, b) => a.localeCompare(b, "el-GR")),
    [lawyerDataset],
  );
  const availableCityOptions = useMemo(
    () => Array.from(new Set(lawyerDataset.map((lawyer) => lawyer.city))).sort((a, b) => a.localeCompare(b, "el-GR")),
    [lawyerDataset],
  );
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
    updateFilters({ ...filters, query: queryDraft, city: cityDraft });
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
      <Navbar />

      <div className="sticky top-16 z-40 border-b border-border bg-card/95 backdrop-blur-md lg:top-[72px]">
        <form onSubmit={handleSearchSubmit} className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3.5 lg:px-8">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Legal issue or lawyer name"
              className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="relative hidden md:block md:w-56">
            <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={cityDraft}
              onChange={(event) => setCityDraft(event.target.value)}
              placeholder="City or area"
              className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <Button type="submit" className="h-11 rounded-lg px-6 text-sm font-bold">
            Search
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
            <div className="sticky top-32 rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground">Filters</h2>
                <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>

              <div className="mt-5 space-y-5">
                <div className="md:hidden">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City</label>
                  <input
                    value={cityDraft}
                    onChange={(event) => setCityDraft(event.target.value)}
                    onBlur={() => updateFilters({ ...filters, city: cityDraft })}
                    placeholder="City or area"
                    className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground"
                  />
                </div>

                <FilterGroup label="Booking intent">
                  <RadioFilter name="availability" label="Available today" checked={filters.availability === "today"} onChange={() => updateFilters({ ...filters, availability: filters.availability === "today" ? "any" : "today" })} />
                  <RadioFilter name="availability" label="Available tomorrow" checked={filters.availability === "tomorrow"} onChange={() => updateFilters({ ...filters, availability: filters.availability === "tomorrow" ? "any" : "tomorrow" })} />
                  <CheckboxFilter label="Responds under 1h" checked={filters.responseUnderMinutes === 60} onChange={() => updateFilters({ ...filters, responseUnderMinutes: filters.responseUnderMinutes === 60 ? null : 60 })} />
                  <CheckboxFilter label="Responds under 2h" checked={filters.responseUnderMinutes === 120} onChange={() => updateFilters({ ...filters, responseUnderMinutes: filters.responseUnderMinutes === 120 ? null : 120 })} />
                  <CheckboxFilter label="4.8+ rating" checked={filters.minRating === 4.8} onChange={() => updateFilters({ ...filters, minRating: filters.minRating === 4.8 ? null : 4.8 })} />
                  <CheckboxFilter label="10+ verified reviews" checked={filters.minReviews === 10} onChange={() => updateFilters({ ...filters, minReviews: filters.minReviews === 10 ? null : 10 })} />
                </FilterGroup>

                <FilterGroup label="Language">
                  {languageOptions.map((option) => (
                    <CheckboxFilter key={option.value} label={option.label} checked={Boolean(filters.languages?.includes(option.value))} onChange={() => toggleLanguage(option.value)} />
                  ))}
                </FilterGroup>

                <FilterGroup label="Consultation mode">
                  {appointmentTypeOptions.map((option) => (
                    <CheckboxFilter key={option.value} label={option.label} checked={filters.appointmentTypes.includes(option.value)} onChange={() => toggleAppointmentType(option.value)} />
                  ))}
                </FilterGroup>

                <FilterGroup label="Specialty">
                  {availableSpecialtyOptions.slice(0, 10).map((specialty) => (
                    <CheckboxFilter key={specialty} label={specialty} checked={filters.specialties.includes(specialty)} onChange={() => toggleSpecialty(specialty)} />
                  ))}
                </FilterGroup>

                <FilterGroup label="City">
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

                <FilterGroup label="Starting price">
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
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{results.length}</span>{" "}
                    {results.length === 1 ? "lawyer found" : "lawyers found"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Proof-first comparison from public marketplace profiles.
                    {isFetching ? " Refreshing live marketplace data." : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground">
                  <Scale className="h-4 w-4 text-primary" />
                  {selectedLawyers.length}/3 selected for compare
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
                  aria-label="Secondary sort"
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
                    <article key={lawyer.id} className="overflow-hidden rounded-lg border border-border bg-card transition hover:border-primary/20 hover:shadow-xl hover:shadow-foreground/[0.05]">
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
                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Starting price</p>
                                <p className="text-2xl font-bold text-foreground">{formatCurrency(lawyer.price)}</p>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              <ProofCell icon={MapPin} label="City" value={lawyer.city} />
                              <ProofCell icon={ShieldCheck} label="Experience" value={`${lawyer.experience} years`} />
                              <ProofCell icon={Star} label="Rating" value={`${lawyer.rating} (${lawyer.reviews} reviews)`} />
                              <ProofCell icon={Clock} label="Response time" value={lawyer.response} />
                              <ProofCell icon={CalendarDays} label="Next slot" value={lawyer.available} />
                              <ProofCell icon={Video} label="Modes" value={lawyer.consultationModes.map((item) => consultationModeNames[item]).join(", ")} />
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <SpecificTrustCopy>Bar association verified</SpecificTrustCopy>
                              <SpecificTrustCopy>Reviews after completed booking</SpecificTrustCopy>
                              <SpecificTrustCopy>Readiness checks passed</SpecificTrustCopy>
                            </div>

                            <details className="mt-4 rounded-lg border border-border bg-background px-4 py-3">
                              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-muted-foreground">Read profile summary</summary>
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
                            {saved ? "Saved to account" : "Save"}
                          </Button>
                          <Button type="button" variant={compared ? "default" : "outline"} size="sm" onClick={() => handleToggleComparedLawyer(lawyer.id)} className="h-9 rounded-lg px-3 text-xs font-bold">
                            <Scale className="h-3.5 w-3.5" />
                            {compared ? "In compare" : "Compare"}
                          </Button>
                          <Button asChild variant="outline" size="sm" className="h-9 rounded-lg px-4 text-xs font-bold">
                            <Link to={`/lawyer/${lawyer.id}`}>Decision page</Link>
                          </Button>
                          {isOwnLawyerProfile ? (
                            <Button type="button" size="sm" disabled className="h-9 rounded-lg px-5 text-xs font-bold">Your profile</Button>
                          ) : (
                            <Button asChild size="sm" className="h-9 rounded-lg px-5 text-xs font-bold">
                              <Link to={`/booking/${lawyer.id}`}>
                                Book
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
                <h2 className="mt-5 font-serif text-2xl tracking-tight text-foreground">No lawyers matched those filters</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Try a broader issue, a nearby city, or fewer booking-intent filters.
                </p>
                <Button onClick={clearFilters} variant="outline" className="mt-5 rounded-lg font-bold">
                  Clear filters
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
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">{selectedLawyers.length}/3 selected</p>
              <p className="text-xs font-semibold text-muted-foreground">Compare price, proof, and next slot</p>
            </div>
            <Button asChild className="rounded-lg text-xs font-bold">
              <Link to="/account?tab=saved">Open compare</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
};

const FilterGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    <div className="mt-2.5 space-y-2">{children}</div>
  </div>
);

const CheckboxFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
    <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-border accent-primary" />
    {label}
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
  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
    <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 border-border accent-primary" />
    {label}
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

const CompareRail = ({
  selectedLawyers,
  onRemove,
}: {
  selectedLawyers: Lawyer[];
  onRemove: (lawyerId: string) => void;
}) => (
  <div id="compare" className="sticky top-32 rounded-lg border border-border bg-card p-5">
    <p className="flex items-center gap-2 text-sm font-bold text-foreground">
      <Scale className="h-4 w-4 text-primary" />
      Compare destination
    </p>
    <p className="mt-1 text-xs font-semibold text-muted-foreground">{selectedLawyers.length}/3 selected lawyers</p>

    <div className="mt-4 space-y-3">
      {selectedLawyers.length > 0 ? selectedLawyers.map((lawyer) => (
        <div key={lawyer.id} className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-start gap-3">
            <img src={lawyer.image} alt={lawyer.name} className="h-10 w-10 rounded-md object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{lawyer.name}</p>
              <p className="text-[11px] font-semibold text-muted-foreground">{lawyer.specialty}</p>
            </div>
            <button type="button" onClick={() => onRemove(lawyer.id)} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={`Remove ${lawyer.name}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-foreground">
            <span>{formatCurrency(lawyer.price)}</span>
            <span>{lawyer.rating} rating</span>
            <span>{lawyer.response}</span>
            <span>{lawyer.available}</span>
          </div>
        </div>
      )) : (
        <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
          Add up to three lawyers to compare proof, price, response, and next availability.
        </div>
      )}
    </div>

    <Button asChild className="mt-4 w-full rounded-lg text-xs font-bold">
      <Link to="/account?tab=saved">Open account comparison</Link>
    </Button>
  </div>
);

const ActiveFilterSummary = ({ filters, onClear }: { filters: LawyerSearchFilters; onClear: () => void }) => (
  <div className="mb-5 flex flex-wrap items-center gap-2">
    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">Active filters</span>
    {filters.query ? <FilterPill>{filters.query}</FilterPill> : null}
    {filters.city ? <FilterPill>{filters.city}</FilterPill> : null}
    {filters.availability && filters.availability !== "any" ? <FilterPill>{filters.availability}</FilterPill> : null}
    {filters.responseUnderMinutes ? <FilterPill>{`under ${filters.responseUnderMinutes / 60}h`}</FilterPill> : null}
    {filters.minRating ? <FilterPill>{`${filters.minRating}+ rating`}</FilterPill> : null}
    {filters.minReviews ? <FilterPill>{`${filters.minReviews}+ reviews`}</FilterPill> : null}
    {filters.languages?.map((language) => <FilterPill key={language}>{language}</FilterPill>)}
    <button type="button" onClick={onClear} className="text-xs font-bold text-primary">Clear all</button>
  </div>
);

const FilterPill = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">{children}</span>
);

export default SearchResults;
