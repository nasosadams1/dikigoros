import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
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
import {
  consultationModeLabels,
  lawyers,
  specialtyOptions,
  type ConsultationMode,
} from "@/data/lawyers";
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
import { cn } from "@/lib/utils";

const appointmentTypeOptions: Array<{ value: ConsultationMode; label: string; icon: LucideIcon }> = [
  { value: "video", label: consultationModeLabels.video, icon: Video },
  { value: "phone", label: consultationModeLabels.phone, icon: Phone },
  { value: "inPerson", label: consultationModeLabels.inPerson, icon: Users },
];

const priceOptions: Array<{ value: PriceRange; label: string }> = [
  { value: "30-50", label: "€30 – €50" },
  { value: "50-80", label: "€50 – €80" },
  { value: "80-120", label: "€80 – €120" },
  { value: "120+", label: "€120+" },
];

const sortOptions: Array<{ value: LawyerSort; label: string }> = [
  { value: "recommended", label: "Προτεινόμενοι" },
  { value: "rating", label: "Υψηλότερη αξιολόγηση" },
  { value: "price-low", label: "Χαμηλότερη τιμή" },
  { value: "experience", label: "Περισσότερη εμπειρία" },
  { value: "response", label: "Ταχύτερη απάντηση" },
];

const validAppointmentTypes = new Set<ConsultationMode>(appointmentTypeOptions.map((option) => option.value));
const validPriceRanges = new Set<PriceRange>(["all", ...priceOptions.map((option) => option.value)]);
const validSorts = new Set<LawyerSort>(sortOptions.map((option) => option.value));

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

const getFiltersFromParams = (params: URLSearchParams): LawyerSearchFilters => {
  const price = params.get("price") as PriceRange | null;
  const sort = params.get("sort") as LawyerSort | null;

  return {
    query: params.get("q") || "",
    city: params.get("city") || "",
    specialties: readTextListParam(params.get("specialty")).filter((specialty) => specialtyOptions.includes(specialty)),
    appointmentTypes: readListParam(params.get("type"), validAppointmentTypes),
    priceRange: price && validPriceRanges.has(price) ? price : defaultLawyerSearchFilters.priceRange,
    sort: sort && validSorts.has(sort) ? sort : defaultLawyerSearchFilters.sort,
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

  return params;
};

const getActiveFilterCount = (filters: LawyerSearchFilters) =>
  (filters.query.trim() ? 1 : 0) +
  (filters.city.trim() ? 1 : 0) +
  filters.specialties.length +
  filters.appointmentTypes.length +
  (filters.priceRange !== "all" ? 1 : 0);

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
  const { data: lawyerDataset = lawyers, isFetching } = useQuery({
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

  const results = useMemo(() => searchLawyers(lawyerDataset, filters), [filters, lawyerDataset]);
  const availableSpecialtyOptions = useMemo(
    () => Array.from(new Set(lawyerDataset.map((lawyer) => lawyer.specialty))).sort((a, b) => a.localeCompare(b, "el-GR")),
    [lawyerDataset],
  );
  const availableCityOptions = useMemo(
    () => Array.from(new Set(lawyerDataset.map((lawyer) => lawyer.city))).sort((a, b) => a.localeCompare(b, "el-GR")),
    [lawyerDataset],
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

  const clearFilters = () => {
    setQueryDraft("");
    setCityDraft("");
    updateFilters(defaultLawyerSearchFilters);
  };

  const removeChip = (kind: "query" | "city" | "specialty" | "type" | "price", value?: string) => {
    if (kind === "query") updateFilters({ ...filters, query: "" });
    if (kind === "city") updateFilters({ ...filters, city: "" });
    if (kind === "specialty") updateFilters({ ...filters, specialties: filters.specialties.filter((item) => item !== value) });
    if (kind === "type") updateFilters({ ...filters, appointmentTypes: filters.appointmentTypes.filter((item) => item !== value) });
    if (kind === "price") updateFilters({ ...filters, priceRange: "all" });
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
              placeholder="Νομικό θέμα ή όνομα δικηγόρου"
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="relative hidden md:block md:w-56">
            <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={cityDraft}
              onChange={(event) => setCityDraft(event.target.value)}
              placeholder="Πόλη ή περιοχή"
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <Button type="submit" className="h-11 rounded-xl px-6 text-sm font-bold">
            Αναζήτηση
          </Button>
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className="relative flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground lg:hidden"
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

      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8 lg:py-8">
        <div className="lg:flex lg:gap-8">
          <aside className={cn(showFilters ? "block" : "hidden", "mb-6 shrink-0 lg:block lg:w-64")}>
            <div className="sticky top-32 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-sans text-sm font-bold text-foreground">Φίλτρα</h2>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition hover:text-primary/75"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Καθαρισμός
                </button>
              </div>

              <div className="mt-5 space-y-5">
                <div className="md:hidden">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Πόλη</label>
                  <div className="relative mt-2.5">
                    <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={cityDraft}
                      onChange={(event) => setCityDraft(event.target.value)}
                      onBlur={() => updateFilters({ ...filters, city: cityDraft })}
                      placeholder="Πόλη ή περιοχή"
                      className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <FilterGroup label="Ειδικότητα">
                  {availableSpecialtyOptions.map((specialty) => (
                    <CheckboxFilter
                      key={specialty}
                      label={specialty}
                      checked={filters.specialties.includes(specialty)}
                      onChange={() => toggleSpecialty(specialty)}
                    />
                  ))}
                </FilterGroup>

                <FilterGroup label="Τύπος ραντεβού">
                  {appointmentTypeOptions.map((option) => (
                    <CheckboxFilter
                      key={option.value}
                      label={option.label}
                      checked={filters.appointmentTypes.includes(option.value)}
                      onChange={() => toggleAppointmentType(option.value)}
                    />
                  ))}
                </FilterGroup>

                <FilterGroup label="Πόλη">
                  {availableCityOptions.map((city) => (
                    <RadioFilter
                      key={city}
                      name="city-filter"
                      label={city}
                      checked={filters.city === city}
                      onChange={() => {
                        setCityDraft(city);
                        updateFilters({ ...filters, city });
                      }}
                    />
                  ))}
                </FilterGroup>

                <FilterGroup label="Τιμή">
                  {priceOptions.map((option) => (
                    <RadioFilter
                      key={option.value}
                      name="price-filter"
                      label={option.label}
                      checked={filters.priceRange === option.value}
                      onChange={() => updateFilters({ ...filters, priceRange: option.value })}
                    />
                  ))}
                </FilterGroup>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">{results.length}</span>{" "}
                  {results.length === 1 ? "δικηγόρος βρέθηκε" : "δικηγόροι βρέθηκαν"}
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Τα αποτελέσματα ενημερώνονται με βάση τα κριτήρια που επιλέγετε.
                  {isFetching ? " Γίνεται συγχρονισμός με το διαθέσιμο μητρώο." : ""}
                </p>
              </div>

              <select
                value={filters.sort}
                onChange={(event) => updateFilters({ ...filters, sort: event.target.value as LawyerSort })}
                className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="Ταξινόμηση αποτελεσμάτων"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {activeFilterCount > 0 ? (
              <div className="mb-5 flex flex-wrap gap-2">
                {filters.query.trim() ? <FilterChip label={`Αναζήτηση: ${filters.query}`} onRemove={() => removeChip("query")} /> : null}
                {filters.city.trim() ? <FilterChip label={`Πόλη: ${filters.city}`} onRemove={() => removeChip("city")} /> : null}
                {filters.specialties.map((specialty) => (
                  <FilterChip key={specialty} label={specialty} onRemove={() => removeChip("specialty", specialty)} />
                ))}
                {filters.appointmentTypes.map((type) => (
                  <FilterChip key={type} label={consultationModeLabels[type]} onRemove={() => removeChip("type", type)} />
                ))}
                {filters.priceRange !== "all" ? (
                  <FilterChip label={priceOptions.find((option) => option.value === filters.priceRange)?.label || "Τιμή"} onRemove={() => removeChip("price")} />
                ) : null}
              </div>
            ) : null}

            {results.length > 0 ? (
              <div className="space-y-4">
                {results.map((lawyer) => (
                  <article
                    key={lawyer.id}
                    className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-border/80 hover:shadow-xl hover:shadow-foreground/[0.06]"
                  >
                    <div className="p-5 md:p-6">
                      <div className="flex flex-col gap-5 md:flex-row md:items-start">
                        <div className="relative shrink-0">
                          <img
                            src={lawyer.image}
                            alt={lawyer.name}
                            className="h-24 w-24 rounded-2xl object-cover shadow-lg ring-2 ring-background md:h-28 md:w-28"
                          />
                          <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sage ring-2 ring-card">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-sans text-lg font-bold text-foreground">{lawyer.name}</h3>
                              <p className="mt-0.5 text-sm font-semibold text-primary/80">{lawyer.specialty}</p>
                              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                                {lawyer.city} · {lawyer.experience} χρόνια εμπειρίας
                              </p>
                            </div>
                            <div className="hidden text-right md:block">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Από</p>
                              <p className="text-2xl font-bold text-foreground">€{lawyer.price}</p>
                              <p className="text-xs text-muted-foreground">ανά συνεδρία</p>
                            </div>
                          </div>

                          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {lawyer.bio}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                              <Star className="h-4 w-4 fill-gold text-gold" />
                              {lawyer.rating}
                              <span className="text-xs font-normal text-muted-foreground">({lawyer.reviews})</span>
                            </span>
                            <span className="h-3.5 w-px bg-border" />
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              Απάντηση {lawyer.response}
                            </span>
                            <span className="h-3.5 w-px bg-border" />
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-sage-foreground">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Ελεγμένος φάκελος
                            </span>
                            <span className="h-3.5 w-px bg-border" />
                            <div className="flex flex-wrap gap-1.5">
                              {lawyer.consultationModes.map((mode) => {
                                const Icon = appointmentTypeOptions.find((option) => option.value === mode)?.icon || Video;
                                return (
                                  <span key={mode} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground/70">
                                    <Icon className="h-3 w-3" />
                                    {consultationModeLabels[mode]}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border bg-secondary/40 px-5 py-3.5 md:flex-row md:items-center md:justify-between md:px-6">
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-bold text-foreground md:hidden">€{lawyer.price}</p>
                        <div className="flex items-center gap-1.5 rounded-full bg-sage/15 px-3 py-1 text-xs font-semibold text-sage-foreground">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage" />
                          Επόμενο: {lawyer.available}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                          type="button"
                          variant={workspace.savedLawyerIds.includes(lawyer.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggleSavedLawyer(lawyer.id)}
                          className="h-9 rounded-xl px-3 text-xs font-bold"
                        >
                          <Heart className={cn("h-3.5 w-3.5", workspace.savedLawyerIds.includes(lawyer.id) && "fill-current")} />
                          {workspace.savedLawyerIds.includes(lawyer.id) ? "Αποθηκευμένος" : "Αποθήκευση"}
                        </Button>
                        <Button
                          type="button"
                          variant={workspace.comparedLawyerIds.includes(lawyer.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggleComparedLawyer(lawyer.id)}
                          className="h-9 rounded-xl px-3 text-xs font-bold"
                        >
                          <Scale className="h-3.5 w-3.5" />
                          {workspace.comparedLawyerIds.includes(lawyer.id) ? "Σύγκριση" : "Σύγκρινε"}
                        </Button>
                        <Button asChild variant="outline" size="sm" className="h-9 rounded-xl px-4 text-xs font-bold">
                          <Link to={`/lawyer/${lawyer.id}`}>Προφίλ</Link>
                        </Button>
                        {areLawyerIdsEqual(currentPartnerLawyerId, lawyer.id) ? (
                          <Button type="button" size="sm" disabled className="h-9 rounded-xl px-5 text-xs font-bold">
                            Δικό σας προφίλ
                          </Button>
                        ) : (
                        <Button asChild size="sm" className="h-9 rounded-xl px-5 text-xs font-bold">
                          <Link to={`/booking/${lawyer.id}`}>
                            Κλείσε ραντεβού
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                  <Search className="h-6 w-6" />
                </div>
                <h2 className="mt-5 font-serif text-2xl tracking-tight text-foreground">Δεν βρέθηκαν δικηγόροι</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Δοκιμάστε λιγότερα φίλτρα, διαφορετική πόλη ή πιο γενικό νομικό θέμα.
                </p>
                <Button onClick={clearFilters} variant="outline" className="mt-5 rounded-xl font-bold">
                  Καθαρισμός φίλτρων
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>

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

const FilterChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <button
    type="button"
    onClick={onRemove}
    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary/25"
  >
    {label}
    <X className="h-3.5 w-3.5 text-muted-foreground" />
  </button>
);

export default SearchResults;
