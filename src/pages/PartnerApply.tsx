import { ArrowLeft, ArrowRight, Check, FileText, Search, ShieldCheck, Upload, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";
import { type ConsultationMode } from "@/data/lawyers";
import {
  createPartnerApplication,
  type PartnerApplicationAvailabilitySlot,
  type PartnerApplicationPaymentDetails,
  type PartnerApplicationPublicProfile,
  type StoredPartnerApplication,
} from "@/lib/platformRepository";
import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import { allowedMarketplaceCityNames, legalPracticeAreaLabels } from "@/lib/marketplaceTaxonomy";
import { minimumPartnerConsultationPrices } from "@/lib/partnerWorkspace";
import {
  availabilityBusinessHours,
  getAvailabilityValidationMessage,
  normalizeSessionDurationMinutes,
  validateAvailabilitySchedule,
  validateAvailabilitySlot,
} from "@/lib/availabilityRules";
import { cn } from "@/lib/utils";

const maxSpecialties = 5;
const minBioLength = 140;
const maxFileSize = 10 * 1024 * 1024;
const supportedDocumentTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);
const supportedDocumentExtensions = [".pdf", ".png", ".jpg", ".jpeg"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ibanPattern = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

const consultationModeLabels: Record<ConsultationMode, string> = {
  video: "Βιντεοκλήση",
  phone: "Τηλέφωνο",
  inPerson: "Στο γραφείο",
};

const steps = [
  {
    title: "Στοιχεία",
    railTitle: "Ταυτότητα συνεργάτη",
    railDescription: "Στοιχεία επικοινωνίας, σύλλογος και αριθμός μητρώου.",
    checklist: ["Επαγγελματικό email", "Στοιχεία άδειας", "Πόλη εξυπηρέτησης"],
  },
  {
    title: "Καταχώριση",
    railTitle: "Δημόσια καταχώριση αναζήτησης",
    railDescription: "Οι πληροφορίες που χρειάζονται για να εμφανιστείτε στην αναζήτηση μετά την έγκριση.",
    checklist: ["Ειδικότητες", "Γλώσσες", "Περιγραφή υπηρεσιών"],
  },
  {
    title: "Πληρωμές",
    railTitle: "Τιμές και διαθεσιμότητα",
    railDescription: "Τρόποι συνεδρίας, ελάχιστες τιμές και εβδομαδιαίο πρόγραμμα.",
    checklist: ["Τιμές πρώτης συνεδρίας", "Τρεις διαθέσιμες ημέρες", "Πολιτική ακύρωσης"],
  },
  {
    title: "Υποβολή",
    railTitle: "Έγγραφα και έλεγχος",
    railDescription: "Ανεβάστε τα έγγραφα επαλήθευσης και ελέγξτε τον φάκελο πριν την αποστολή.",
    checklist: ["Έγγραφα επαλήθευσης", "Σύνοψη αίτησης", "Τελικός έλεγχος"],
  },
] as const;

interface ApplicationForm {
  fullName: string;
  workEmail: string;
  phone: string;
  city: string;
  lawFirmName: string;
  websiteOrLinkedIn: string;
  barAssociation: string;
  registrationNumber: string;
  yearsOfExperience: string;
  specialties: string[];
  languages: string;
  serviceArea: string;
  bestFor: string;
  professionalBio: string;
  consultationModes: ConsultationMode[];
  videoPrice: string;
  phonePrice: string;
  inPersonPrice: string;
  sessionDurationMinutes: string;
  cancellationPolicy: string;
  invoiceName: string;
  taxId: string;
  taxOffice: string;
  billingAddress: string;
  settlementIban: string;
  settlementBeneficiary: string;
}

type ValidationField = keyof ApplicationForm | "documents" | "availability";

const initialAvailability: PartnerApplicationAvailabilitySlot[] = [
  { day: "Δευτέρα", enabled: true, start: "09:00", end: "17:00", note: "" },
  { day: "Τρίτη", enabled: true, start: "09:00", end: "17:00", note: "" },
  { day: "Τετάρτη", enabled: true, start: "09:00", end: "17:00", note: "" },
  { day: "Πέμπτη", enabled: false, start: "09:00", end: "17:00", note: "" },
  { day: "Παρασκευή", enabled: false, start: "09:00", end: "15:00", note: "" },
];

const initialForm: ApplicationForm = {
  fullName: "",
  workEmail: "",
  phone: "",
  city: "",
  lawFirmName: "",
  websiteOrLinkedIn: "",
  barAssociation: "",
  registrationNumber: "",
  yearsOfExperience: "",
  specialties: [],
  languages: "Ελληνικά",
  serviceArea: "",
  bestFor: "",
  professionalBio: "",
  consultationModes: ["video"],
  videoPrice: "60",
  phonePrice: "45",
  inPersonPrice: "80",
  sessionDurationMinutes: "30",
  cancellationPolicy: "Δωρεάν ακύρωση ή αλλαγή έως 24 ώρες πριν από το ραντεβού.",
  invoiceName: "",
  taxId: "",
  taxOffice: "",
  billingAddress: "",
  settlementIban: "",
  settlementBeneficiary: "",
};

const initialPartnerPlanId = "basic";

const formatEuro = (amount: number) =>
  `€${amount.toLocaleString("el-GR", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const formatMaskedIban = (value: string) => {
  const normalized = value.replace(/\s/g, "").toUpperCase();
  if (normalized.length < 8) return "-";
  return `${normalized.slice(0, 4)} ... ${normalized.slice(-4)}`;
};

const parseList = (value: string) =>
  Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));

const getNumericPrice = (value: string, mode: ConsultationMode) => {
  const numericValue = Number(value);
  return Math.max(minimumPartnerConsultationPrices[mode], Number.isFinite(numericValue) ? numericValue : minimumPartnerConsultationPrices[mode]);
};

const getPriceValue = (form: ApplicationForm, mode: ConsultationMode) =>
  mode === "phone" ? form.phonePrice : mode === "inPerson" ? form.inPersonPrice : form.videoPrice;

const isSupportedDocument = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return supportedDocumentTypes.has(file.type) || supportedDocumentExtensions.some((extension) => lowerName.endsWith(extension));
};

const LabelRow = ({ label, optional = false }: { label: string; optional?: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <label className="partner-label">{label}</label>
    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {optional ? "Προαιρετικό" : "Υποχρεωτικό"}
    </span>
  </div>
);

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-xs font-semibold text-destructive">{message}</p> : null;

const ReviewCard = ({ title, children, onEdit }: { title: string; children: ReactNode; onEdit: () => void }) => (
  <div className="rounded-[16px] border border-[hsl(var(--partner-line))] bg-white/70 p-4">
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-bold text-[hsl(var(--partner-ink))]">{title}</p>
      <button type="button" onClick={onEdit} className="text-sm font-semibold text-[hsl(var(--partner-navy-soft))]">
        Επεξεργασία
      </button>
    </div>
    <div className="mt-3 text-sm leading-6 text-muted-foreground">{children}</div>
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-4 border-t border-[hsl(var(--partner-line))]/70 py-2.5 first:border-t-0 first:pt-0">
    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
    <span className="min-w-0 break-words text-[hsl(var(--partner-ink))]">{value}</span>
  </div>
);

const UploadedFileRow = ({ file, onRemove }: { file: File; onRemove: () => void }) => (
  <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[hsl(var(--partner-line))] bg-white px-3 py-2.5">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[hsl(var(--partner-navy))]/10 text-[hsl(var(--partner-navy))]">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[hsl(var(--partner-ink))]">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
    </div>
    <button type="button" onClick={onRemove} className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-[hsl(var(--partner-ink))]">
      <X className="h-4 w-4" />
    </button>
  </div>
);

const PartnerApply = () => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ApplicationForm>(initialForm);
  const [availability, setAvailability] = useState<PartnerApplicationAvailabilitySlot[]>(initialAvailability);
  const [documents, setDocuments] = useState<File[]>([]);
  const [specialtyQuery, setSpecialtyQuery] = useState("");
  const [touched, setTouched] = useState<Partial<Record<ValidationField, boolean>>>({});
  const [attemptedStep, setAttemptedStep] = useState<number | null>(null);
  const [fileNotice, setFileNotice] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApplication, setSubmittedApplication] = useState<StoredPartnerApplication | null>(null);

  const currentStep = steps[step];
  const activeAvailabilityDays = validateAvailabilitySchedule(
    availability,
    normalizeSessionDurationMinutes(form.sessionDurationMinutes),
  ).validDays;

  useEffect(() => {
    setAttemptedStep(null);
    setSubmitError("");
  }, [step]);

  const updateField = <Field extends keyof ApplicationForm>(field: Field, value: ApplicationForm[Field]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const markTouched = (field: ValidationField) => setTouched((current) => ({ ...current, [field]: true }));
  const shouldShowError = (field: ValidationField) => Boolean(touched[field] || attemptedStep === step);

  const specialtyResults = useMemo(() => {
    const query = specialtyQuery.trim().toLowerCase();
    return legalPracticeAreaLabels.filter((specialty) => {
      const matchesQuery = !query || specialty.toLowerCase().includes(query);
      return matchesQuery && !form.specialties.includes(specialty);
    });
  }, [form.specialties, specialtyQuery]);

  const errors = useMemo<Record<ValidationField, string>>(() => {
    const activeModes = form.consultationModes;
    const priceError = activeModes.find((mode) => {
      const value = Number(getPriceValue(form, mode));
      return !Number.isFinite(value) || value < minimumPartnerConsultationPrices[mode];
    });
    const rawSessionDuration = Number(form.sessionDurationMinutes);
    const sessionDuration = normalizeSessionDurationMinutes(rawSessionDuration);
    const invalidAvailabilitySlot = availability.find((slot) => slot.enabled && !validateAvailabilitySlot(slot, sessionDuration).valid);
    const validAvailabilityDays = availability.filter((slot) => slot.enabled && validateAvailabilitySlot(slot, sessionDuration).valid).length;
    const normalizedTaxId = form.taxId.replace(/\D/g, "");
    const normalizedIban = form.settlementIban.replace(/\s/g, "").toUpperCase();

    return {
      fullName: form.fullName.trim().length >= 4 ? "" : "Συμπληρώστε ονοματεπώνυμο.",
      workEmail: emailPattern.test(form.workEmail.trim()) ? "" : "Συμπληρώστε έγκυρο επαγγελματικό email.",
      phone: form.phone.replace(/\D/g, "").length >= 10 ? "" : "Συμπληρώστε έγκυρο αριθμό τηλεφώνου.",
      city: allowedMarketplaceCityNames.includes(form.city) ? "" : "Επιλέξτε πόλη από τη λίστα.",
      lawFirmName: "",
      websiteOrLinkedIn: "",
      barAssociation: form.barAssociation.trim() ? "" : "Συμπληρώστε δικηγορικό σύλλογο.",
      registrationNumber: form.registrationNumber.trim() ? "" : "Συμπληρώστε αριθμό μητρώου.",
      yearsOfExperience: form.yearsOfExperience.trim() && Number(form.yearsOfExperience) >= 0 ? "" : "Συμπληρώστε έτη εμπειρίας.",
      specialties: form.specialties.length > 0 ? "" : "Επιλέξτε τουλάχιστον μία ειδικότητα.",
      languages: parseList(form.languages).length > 0 ? "" : "Συμπληρώστε τουλάχιστον μία γλώσσα.",
      serviceArea: form.serviceArea.trim().length >= 4 ? "" : "Συμπληρώστε περιοχή εξυπηρέτησης.",
      bestFor: form.bestFor.trim().length >= 35 ? "" : "Γράψτε σύντομα σε ποιες υποθέσεις βοηθάτε.",
      professionalBio: form.professionalBio.trim().length >= minBioLength ? "" : `Η περιγραφή πρέπει να έχει τουλάχιστον ${minBioLength} χαρακτήρες.`,
      consultationModes: activeModes.length > 0 ? "" : "Επιλέξτε τουλάχιστον έναν τρόπο συνεδρίας.",
      videoPrice: priceError === "video" ? `Ελάχιστη τιμή ${formatEuro(minimumPartnerConsultationPrices.video)}.` : "",
      phonePrice: priceError === "phone" ? `Ελάχιστη τιμή ${formatEuro(minimumPartnerConsultationPrices.phone)}.` : "",
      inPersonPrice: priceError === "inPerson" ? `Ελάχιστη τιμή ${formatEuro(minimumPartnerConsultationPrices.inPerson)}.` : "",
      sessionDurationMinutes: Number.isFinite(rawSessionDuration) && rawSessionDuration >= 20 ? "" : "Η ελάχιστη διάρκεια ραντεβού είναι 20 λεπτά.",
      cancellationPolicy: form.cancellationPolicy.trim().length >= 20 ? "" : "Συμπληρώστε πολιτική ακύρωσης.",
      invoiceName: form.invoiceName.trim().length >= 4 ? "" : "Συμπληρώστε την επωνυμία παραστατικού.",
      taxId: normalizedTaxId.length === 9 ? "" : "Συμπληρώστε ΑΦΜ 9 ψηφίων.",
      taxOffice: form.taxOffice.trim().length >= 2 ? "" : "Συμπληρώστε ΔΟΥ.",
      billingAddress: form.billingAddress.trim().length >= 8 ? "" : "Συμπληρώστε διεύθυνση τιμολόγησης.",
      settlementIban: ibanPattern.test(normalizedIban) ? "" : "Συμπληρώστε έγκυρο IBAN.",
      settlementBeneficiary: form.settlementBeneficiary.trim().length >= 4 ? "" : "Συμπληρώστε δικαιούχο λογαριασμού.",
      availability: validAvailabilityDays >= 3 && !invalidAvailabilitySlot
        ? ""
        : invalidAvailabilitySlot
          ? getAvailabilityValidationMessage(validateAvailabilitySlot(invalidAvailabilitySlot, sessionDuration), sessionDuration)
          : "Ορίστε τουλάχιστον τρεις διαθέσιμες ημέρες.",
      documents: documents.length > 0 ? "" : "Ανεβάστε τουλάχιστον ένα έγγραφο επαλήθευσης.",
    };
  }, [availability, activeAvailabilityDays, documents.length, form]);

  const stepFields: ValidationField[][] = [
    ["fullName", "workEmail", "phone", "city", "barAssociation", "registrationNumber", "yearsOfExperience"],
    ["specialties", "languages", "serviceArea", "bestFor", "professionalBio"],
    [
      "consultationModes",
      "videoPrice",
      "phonePrice",
      "inPersonPrice",
      "sessionDurationMinutes",
      "cancellationPolicy",
      "availability",
      "invoiceName",
      "taxId",
      "taxOffice",
      "billingAddress",
      "settlementIban",
      "settlementBeneficiary",
    ],
    ["documents"],
  ];

  const canContinue = stepFields[step].every((field) => !errors[field]);
  const disabledReason = stepFields[step].map((field) => errors[field]).find(Boolean);

  const toggleSpecialty = (specialty: string) => {
    const active = form.specialties.includes(specialty);
    const specialties = active
      ? form.specialties.filter((item) => item !== specialty)
      : form.specialties.length >= maxSpecialties
        ? form.specialties
        : [...form.specialties, specialty];
    updateField("specialties", specialties);
    markTouched("specialties");
  };

  const toggleMode = (mode: ConsultationMode) => {
    const active = form.consultationModes.includes(mode);
    const nextModes = active
      ? form.consultationModes.filter((item) => item !== mode)
      : [...form.consultationModes, mode];
    updateField("consultationModes", nextModes);
    markTouched("consultationModes");
  };

  const updateAvailability = (day: string, updates: Partial<PartnerApplicationAvailabilitySlot>) => {
    setAvailability((current) => current.map((slot) => (slot.day === day ? { ...slot, ...updates } : slot)));
    markTouched("availability");
  };

  const handleFileChange = (files: FileList | null) => {
    setFileNotice("");
    if (!files?.length) return;

    const accepted: File[] = [];
    const rejected: string[] = [];

    Array.from(files).forEach((file) => {
      if (!isSupportedDocument(file)) {
        rejected.push(`${file.name}: μη υποστηριζόμενος τύπος`);
        return;
      }
      if (file.size > maxFileSize) {
        rejected.push(`${file.name}: πάνω από 10 MB`);
        return;
      }
      accepted.push(file);
    });

    if (accepted.length) {
      setDocuments((current) => [...current, ...accepted]);
      markTouched("documents");
    }
    setFileNotice(rejected.length ? rejected.join(" · ") : "");
  };

  const removeDocument = (target: File) => {
    setDocuments((current) => current.filter((file) => file !== target));
    markTouched("documents");
  };

  const buildPublicProfile = (): PartnerApplicationPublicProfile => ({
    displayName: form.fullName.trim(),
    officeName: form.lawFirmName.trim() || undefined,
    city: form.city,
    primarySpecialty: form.specialties[0],
    serviceArea: form.serviceArea.trim(),
    bestFor: form.bestFor.trim(),
    bio: form.professionalBio.trim(),
    experienceYears: Number(form.yearsOfExperience) || 0,
    specialties: form.specialties,
    languages: parseList(form.languages),
    consultationModes: form.consultationModes,
    videoPrice: getNumericPrice(form.videoPrice, "video"),
    phonePrice: getNumericPrice(form.phonePrice, "phone"),
    inPersonPrice: getNumericPrice(form.inPersonPrice, "inPerson"),
    sessionDurationMinutes: normalizeSessionDurationMinutes(form.sessionDurationMinutes),
    cancellationPolicy: form.cancellationPolicy.trim(),
    autoConfirm: true,
    bookingWindowDays: 21,
    bufferMinutes: 15,
  });

  const buildPaymentDetails = (): PartnerApplicationPaymentDetails => ({
    invoiceName: form.invoiceName.trim(),
    taxId: form.taxId.replace(/\D/g, ""),
    taxOffice: form.taxOffice.trim(),
    billingAddress: form.billingAddress.trim(),
    settlementIban: form.settlementIban.replace(/\s/g, "").toUpperCase(),
    settlementBeneficiary: form.settlementBeneficiary.trim(),
  });

  const handleNext = () => {
    setAttemptedStep(step);
    if (!canContinue) return;
    setStep((current) => Math.min(steps.length - 1, current + 1));
  };

  const handleSubmit = async () => {
    setAttemptedStep(step);
    setSubmitError("");
    if (!canContinue) return;

    setIsSubmitting(true);
    try {
      const publicProfile = buildPublicProfile();
      const paymentDetails = buildPaymentDetails();
      const result = await createPartnerApplication({
        fullName: form.fullName.trim(),
        workEmail: form.workEmail.trim().toLowerCase(),
        phone: form.phone.trim(),
        city: form.city,
        lawFirmName: form.lawFirmName.trim() || undefined,
        websiteOrLinkedIn: form.websiteOrLinkedIn.trim() || undefined,
        barAssociation: form.barAssociation.trim(),
        registrationNumber: form.registrationNumber.trim(),
        yearsOfExperience: form.yearsOfExperience.trim(),
        specialties: form.specialties,
        professionalBio: form.professionalBio.trim(),
        preferredPlanId: initialPartnerPlanId,
        publicProfile,
        availability,
        paymentDetails,
        documents: documents.map((file) => ({ name: file.name, size: file.size, type: file.type || "unknown" })),
      });

      trackFunnelEvent("lawyer_application_submitted", {
        applicationId: result.record.id,
        preferredPlanId: initialPartnerPlanId,
        city: form.city,
        specialtyCount: form.specialties.length,
        availabilityDays: activeAvailabilityDays,
        source: result.source,
      });

      setSubmittedApplication(result.record);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Η αίτηση δεν υποβλήθηκε. Δοκιμάστε ξανά.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedApplication) {
    return (
      <PartnerShell className="py-10 lg:py-14">
        <section className="mx-auto max-w-3xl rounded-[24px] border border-[hsl(var(--partner-line))] bg-white/82 p-6 shadow-[0_18px_50px_rgba(18,30,44,0.08)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--sage))]/12 text-[hsl(var(--sage-foreground))]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="mt-5 partner-kicker">Η αίτηση καταχωρίστηκε</p>
          <h1 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Ο φάκελος είναι έτοιμος για έλεγχο.</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Κωδικός αίτησης: <span className="font-semibold text-[hsl(var(--partner-ink))]">{submittedApplication.referenceId}</span>. Η δημόσια καταχώριση, οι τιμές και η διαθεσιμότητα αποθηκεύτηκαν με την αίτηση. Όλοι οι νέοι συνεργάτες ξεκινούν στο Βασικό πλάνο και μπορούν να αλλάξουν πλάνο μετά την έγκριση.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white p-3">
              <p className="partner-kicker">Πόλη</p>
              <p className="mt-2 text-sm font-semibold text-[hsl(var(--partner-ink))]">{submittedApplication.city}</p>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white p-3">
              <p className="partner-kicker">Διαθεσιμότητα</p>
              <p className="mt-2 text-sm font-semibold text-[hsl(var(--partner-ink))]">{submittedApplication.availability.filter((slot) => slot.enabled).length} ημέρες</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="rounded-xl px-5">
              <Link to="/for-lawyers/login">Είσοδος συνεργάτη</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-[hsl(var(--partner-line))] bg-white px-5">
              <Link to="/for-lawyers">Επιστροφή</Link>
            </Button>
          </div>
        </section>
      </PartnerShell>
    );
  }

  return (
    <PartnerShell className="py-10 lg:py-14">
      <section className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-[24px] border border-[hsl(var(--partner-line))] bg-[hsl(var(--partner-navy))] p-5 text-white shadow-[0_20px_55px_rgba(18,30,44,0.18)] lg:sticky lg:top-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--partner-gold))]">Αίτηση συνεργάτη</p>
          <h1 className="mt-3 font-serif text-3xl tracking-[-0.03em]">Ένταξη με έτοιμη καταχώριση αναζήτησης.</h1>
          <p className="mt-3 text-sm leading-7 text-white/72">
            Συμπληρώνετε μία φορά τα στοιχεία που χρειάζονται για έλεγχο, πληρωμές, τιμές και δημόσια προβολή.
          </p>
          <div className="mt-6 grid gap-2">
            {steps.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setStep(index)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                  index === step ? "border-white/28 bg-white/12" : "border-white/10 bg-white/[0.04] text-white/72",
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-xs font-bold">{index + 1}</span>
                <span>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="block text-xs text-white/54">{item.railTitle}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <p className="text-sm font-semibold">{currentStep.railTitle}</p>
            <p className="mt-2 text-xs leading-5 text-white/64">{currentStep.railDescription}</p>
            <ul className="mt-3 space-y-2 text-xs text-white/72">
              {currentStep.checklist.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-[hsl(var(--partner-gold))]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="rounded-[24px] border border-[hsl(var(--partner-line))] bg-white/82 p-5 shadow-[0_18px_50px_rgba(18,30,44,0.07)]">
          {step === 0 ? (
            <div className="space-y-5">
              <div>
                <p className="partner-kicker">Στοιχεία</p>
                <h2 className="mt-1 font-serif text-2xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Ταυτότητα και άδεια</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <LabelRow label="Ονοματεπώνυμο" />
                  <input className="partner-input" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} onBlur={() => markTouched("fullName")} />
                  {shouldShowError("fullName") ? <FieldError message={errors.fullName} /> : null}
                </div>
                <div className="space-y-2">
                  <LabelRow label="Επαγγελματικό email" />
                  <input className="partner-input" type="email" value={form.workEmail} onChange={(event) => updateField("workEmail", event.target.value)} onBlur={() => markTouched("workEmail")} />
                  {shouldShowError("workEmail") ? <FieldError message={errors.workEmail} /> : null}
                </div>
                <div className="space-y-2">
                  <LabelRow label="Τηλέφωνο" />
                  <input className="partner-input" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} onBlur={() => markTouched("phone")} />
                  {shouldShowError("phone") ? <FieldError message={errors.phone} /> : null}
                </div>
                <div className="space-y-2">
                  <LabelRow label="Πόλη" />
                  <select className="partner-input" value={form.city} onChange={(event) => updateField("city", event.target.value)} onBlur={() => markTouched("city")}>
                    <option value="" disabled hidden>Επιλέξτε πόλη</option>
                    {allowedMarketplaceCityNames.map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                  {shouldShowError("city") ? <FieldError message={errors.city} /> : null}
                </div>
                <div className="space-y-2">
                  <LabelRow label="Γραφείο" optional />
                  <input className="partner-input" value={form.lawFirmName} onChange={(event) => updateField("lawFirmName", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <LabelRow label="Website ή LinkedIn" optional />
                  <input className="partner-input" value={form.websiteOrLinkedIn} onChange={(event) => updateField("websiteOrLinkedIn", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <LabelRow label="Δικηγορικός σύλλογος" />
                  <input className="partner-input" value={form.barAssociation} onChange={(event) => updateField("barAssociation", event.target.value)} onBlur={() => markTouched("barAssociation")} />
                  {shouldShowError("barAssociation") ? <FieldError message={errors.barAssociation} /> : null}
                </div>
                <div className="space-y-2">
                  <LabelRow label="Αριθμός μητρώου" />
                  <input className="partner-input" value={form.registrationNumber} onChange={(event) => updateField("registrationNumber", event.target.value)} onBlur={() => markTouched("registrationNumber")} />
                  {shouldShowError("registrationNumber") ? <FieldError message={errors.registrationNumber} /> : null}
                </div>
                <div className="space-y-2">
                  <LabelRow label="Έτη εμπειρίας" />
                  <input className="partner-input" type="number" min="0" value={form.yearsOfExperience} onChange={(event) => updateField("yearsOfExperience", event.target.value)} onBlur={() => markTouched("yearsOfExperience")} />
                  {shouldShowError("yearsOfExperience") ? <FieldError message={errors.yearsOfExperience} /> : null}
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <p className="partner-kicker">Καταχώριση αναζήτησης</p>
                <h2 className="mt-1 font-serif text-2xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Πληροφορίες που θα ελεγχθούν για δημόσια προβολή</h2>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <LabelRow label="Ειδικότητες" />
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input className="partner-input pl-9" value={specialtyQuery} onChange={(event) => setSpecialtyQuery(event.target.value)} placeholder="Αναζήτηση ειδικότητας" />
                    </div>
                    <div className="flex flex-wrap gap-2 rounded-2xl border border-[hsl(var(--partner-line))] bg-white/65 p-3">
                      {form.specialties.map((specialty) => (
                        <button key={specialty} type="button" onClick={() => toggleSpecialty(specialty)} className="partner-chip partner-chip-active">
                          {specialty}
                          <X className="ml-1 h-3.5 w-3.5" />
                        </button>
                      ))}
                      {specialtyResults.slice(0, 8).map((specialty) => (
                        <button key={specialty} type="button" onClick={() => toggleSpecialty(specialty)} className="partner-chip">
                          {specialty}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Έως {maxSpecialties} ειδικότητες. Η πρώτη επιλεγμένη χρησιμοποιείται ως κύρια κατηγορία.</p>
                    {shouldShowError("specialties") ? <FieldError message={errors.specialties} /> : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <LabelRow label="Γλώσσες" />
                      <input className="partner-input" value={form.languages} onChange={(event) => updateField("languages", event.target.value)} onBlur={() => markTouched("languages")} />
                      {shouldShowError("languages") ? <FieldError message={errors.languages} /> : null}
                    </div>
                    <div className="space-y-2">
                      <LabelRow label="Περιοχή εξυπηρέτησης" />
                      <input className="partner-input" value={form.serviceArea} onChange={(event) => updateField("serviceArea", event.target.value)} onBlur={() => markTouched("serviceArea")} placeholder="π.χ. Αθήνα και διαδικτυακά σε όλη την Ελλάδα" />
                      {shouldShowError("serviceArea") ? <FieldError message={errors.serviceArea} /> : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <LabelRow label="Σε ποιες υποθέσεις βοηθάτε καλύτερα" />
                    <textarea className="partner-textarea min-h-24" value={form.bestFor} onChange={(event) => updateField("bestFor", event.target.value)} onBlur={() => markTouched("bestFor")} />
                    {shouldShowError("bestFor") ? <FieldError message={errors.bestFor} /> : null}
                  </div>
                  <div className="space-y-2">
                    <LabelRow label="Επαγγελματική περιγραφή" />
                    <textarea className="partner-textarea min-h-36" value={form.professionalBio} onChange={(event) => updateField("professionalBio", event.target.value)} onBlur={() => markTouched("professionalBio")} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Ελάχιστο {minBioLength} χαρακτήρες</span>
                      <span className={cn(form.professionalBio.trim().length >= minBioLength && "text-[hsl(var(--sage-foreground))]")}>{form.professionalBio.trim().length} / {minBioLength}+</span>
                    </div>
                    {shouldShowError("professionalBio") ? <FieldError message={errors.professionalBio} /> : null}
                  </div>
                </div>
                <aside className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/66 p-4">
                  <p className="partner-kicker">Έλεγχος δημοσίευσης</p>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                    <p>Η καταχώριση ελέγχεται πριν εμφανιστεί στην αναζήτηση.</p>
                    <p>Δεν επιτρέπονται πρόχειρα κείμενα, ψευδείς ειδικότητες ή τιμές κάτω από τα ελάχιστα όρια.</p>
                  </div>
                </aside>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div>
                <p className="partner-kicker">Πληρωμές και πρόγραμμα</p>
                <h2 className="mt-1 font-serif text-2xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Τιμές συνεδρίας και διαθεσιμότητα</h2>
              </div>
              <div className="space-y-5">
                  <section className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/65 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="partner-kicker">Τρόποι συνεδρίας</p>
                        <p className="mt-1 text-sm text-muted-foreground">Οι τιμές εμφανίζονται δημόσια μετά την έγκριση.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(consultationModeLabels) as ConsultationMode[]).map((mode) => (
                          <button key={mode} type="button" onClick={() => toggleMode(mode)} className={`partner-chip ${form.consultationModes.includes(mode) ? "partner-chip-active" : ""}`}>
                            {consultationModeLabels[mode]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {shouldShowError("consultationModes") ? <FieldError message={errors.consultationModes} /> : null}

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {(Object.keys(consultationModeLabels) as ConsultationMode[]).map((mode) => {
                        const active = form.consultationModes.includes(mode);
                        if (!active) return null;
                        const priceField = mode === "phone" ? "phonePrice" : mode === "inPerson" ? "inPersonPrice" : "videoPrice";
                        return (
                          <div key={mode} className="space-y-2 rounded-2xl border border-[hsl(var(--partner-line))] bg-white p-3">
                            <LabelRow label={`${consultationModeLabels[mode]} - ελάχιστο ${formatEuro(minimumPartnerConsultationPrices[mode])}`} />
                            <div className="relative">
                              <input className="partner-input pr-8" type="number" min={minimumPartnerConsultationPrices[mode]} value={getPriceValue(form, mode)} onChange={(event) => updateField(priceField, event.target.value)} onBlur={() => markTouched(priceField)} />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">€</span>
                            </div>
                            {shouldShowError(priceField) ? <FieldError message={errors[priceField]} /> : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 max-w-xs space-y-2">
                      <LabelRow label="Διάρκεια ραντεβού" />
                      <div className="relative">
                        <input className="partner-input pr-16" type="number" min={20} step={1} value={form.sessionDurationMinutes} onChange={(event) => updateField("sessionDurationMinutes", event.target.value)} onBlur={() => markTouched("sessionDurationMinutes")} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">λεπτά</span>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">Ορίζετε πόσα λεπτά κρατά κάθε διαθέσιμο ραντεβού. Ελάχιστο 20 λεπτά.</p>
                      {shouldShowError("sessionDurationMinutes") ? <FieldError message={errors.sessionDurationMinutes} /> : null}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/65 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="partner-kicker">Εβδομαδιαία διαθεσιμότητα</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Χρειάζονται τουλάχιστον τρεις ενεργές ημέρες για δημόσια προβολή. Το σύστημα δέχεται ώρες μόνο {availabilityBusinessHours.start}-{availabilityBusinessHours.end}.
                        </p>
                      </div>
                      <span className="rounded-full border border-[hsl(var(--partner-line))] bg-white px-3 py-1 text-xs font-bold text-[hsl(var(--partner-ink))]">{activeAvailabilityDays} ημέρες</span>
                    </div>
                    <div className="mt-4 divide-y divide-[hsl(var(--partner-line))] rounded-2xl border border-[hsl(var(--partner-line))] bg-white">
                      {availability.map((slot) => {
                        const validation = validateAvailabilitySlot(slot, normalizeSessionDurationMinutes(form.sessionDurationMinutes));
                        return (
                          <div key={slot.day} className="p-3">
                            <div className="grid gap-3 md:grid-cols-[120px_120px_120px_minmax(0,1fr)] md:items-center">
                              <button type="button" onClick={() => updateAvailability(slot.day, { enabled: !slot.enabled })} className={`rounded-full border px-3 py-2 text-sm font-bold ${slot.enabled ? "border-[hsl(var(--sage))]/30 bg-[hsl(var(--sage))]/10 text-[hsl(var(--sage-foreground))]" : "border-[hsl(var(--partner-line))] bg-white text-muted-foreground"}`}>
                                {slot.day}
                              </button>
                              <input className="partner-input" type="time" min={availabilityBusinessHours.start} max={availabilityBusinessHours.end} step={60} value={slot.enabled ? slot.start : ""} disabled={!slot.enabled} onChange={(event) => updateAvailability(slot.day, { start: event.target.value })} placeholder={availabilityBusinessHours.start} aria-label={`${slot.day} ώρα έναρξης`} />
                              <input className={`partner-input ${slot.enabled && !validation.valid ? "border-destructive/35 bg-destructive/5" : ""}`} type="time" min={availabilityBusinessHours.start} max={availabilityBusinessHours.end} step={60} value={slot.enabled ? slot.end : ""} disabled={!slot.enabled} onChange={(event) => updateAvailability(slot.day, { end: event.target.value })} placeholder={availabilityBusinessHours.end} aria-label={`${slot.day} ώρα λήξης`} />
                              <input className="partner-input" value={slot.enabled ? slot.note : ""} disabled={!slot.enabled} onChange={(event) => updateAvailability(slot.day, { note: event.target.value })} placeholder={slot.enabled ? "Σημείωση" : "Κλειστή ημέρα"} />
                            </div>
                            {slot.enabled && !validation.valid ? (
                              <p className="mt-2 text-xs font-semibold text-destructive">
                                {getAvailabilityValidationMessage(validation, normalizeSessionDurationMinutes(form.sessionDurationMinutes))}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {shouldShowError("availability") ? <FieldError message={errors.availability} /> : null}
                  </section>

                  <div className="space-y-2">
                    <LabelRow label="Πολιτική ακύρωσης" />
                    <textarea className="partner-textarea min-h-24" value={form.cancellationPolicy} onChange={(event) => updateField("cancellationPolicy", event.target.value)} onBlur={() => markTouched("cancellationPolicy")} />
                    {shouldShowError("cancellationPolicy") ? <FieldError message={errors.cancellationPolicy} /> : null}
                  </div>

                  <section className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/65 p-4">
                    <div>
                      <p className="partner-kicker">Τιμολόγηση και εκκαθάριση</p>
                      <p className="mt-1 text-sm text-muted-foreground">Απαραίτητα στοιχεία για απόδοση πληρωμών και παραστατικά. Δεν εμφανίζονται δημόσια.</p>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <LabelRow label="Επωνυμία παραστατικού" />
                        <input className="partner-input" value={form.invoiceName} onChange={(event) => updateField("invoiceName", event.target.value)} onBlur={() => markTouched("invoiceName")} />
                        {shouldShowError("invoiceName") ? <FieldError message={errors.invoiceName} /> : null}
                      </div>
                      <div className="space-y-2">
                        <LabelRow label="ΑΦΜ" />
                        <input className="partner-input" inputMode="numeric" value={form.taxId} onChange={(event) => updateField("taxId", event.target.value)} onBlur={() => markTouched("taxId")} />
                        {shouldShowError("taxId") ? <FieldError message={errors.taxId} /> : null}
                      </div>
                      <div className="space-y-2">
                        <LabelRow label="ΔΟΥ" />
                        <input className="partner-input" value={form.taxOffice} onChange={(event) => updateField("taxOffice", event.target.value)} onBlur={() => markTouched("taxOffice")} />
                        {shouldShowError("taxOffice") ? <FieldError message={errors.taxOffice} /> : null}
                      </div>
                      <div className="space-y-2">
                        <LabelRow label="Διεύθυνση τιμολόγησης" />
                        <input className="partner-input" value={form.billingAddress} onChange={(event) => updateField("billingAddress", event.target.value)} onBlur={() => markTouched("billingAddress")} />
                        {shouldShowError("billingAddress") ? <FieldError message={errors.billingAddress} /> : null}
                      </div>
                      <div className="space-y-2">
                        <LabelRow label="IBAN εκκαθάρισης" />
                        <input className="partner-input uppercase" value={form.settlementIban} onChange={(event) => updateField("settlementIban", event.target.value)} onBlur={() => markTouched("settlementIban")} />
                        {shouldShowError("settlementIban") ? <FieldError message={errors.settlementIban} /> : null}
                      </div>
                      <div className="space-y-2">
                        <LabelRow label="Δικαιούχος λογαριασμού" />
                        <input className="partner-input" value={form.settlementBeneficiary} onChange={(event) => updateField("settlementBeneficiary", event.target.value)} onBlur={() => markTouched("settlementBeneficiary")} />
                        {shouldShowError("settlementBeneficiary") ? <FieldError message={errors.settlementBeneficiary} /> : null}
                      </div>
                    </div>
                  </section>
                </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div>
                <p className="partner-kicker">Υποβολή</p>
                <h2 className="mt-1 font-serif text-2xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Έγγραφα και τελικός έλεγχος</h2>
              </div>
              <section className="rounded-2xl border border-[hsl(var(--partner-line))] bg-white/65 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="partner-kicker">Έγγραφα επαλήθευσης</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Βεβαίωση εγγραφής, άδεια άσκησης ή άλλο επίσημο έγγραφο που στηρίζει τον έλεγχο.</p>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">PDF, PNG, JPG</span>
                </div>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[hsl(var(--partner-line))] bg-white px-5 py-6 text-center transition hover:border-[hsl(var(--partner-navy))]/35">
                  <Upload className="h-5 w-5 text-[hsl(var(--partner-navy-soft))]" />
                  <span className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Επιλέξτε αρχεία από τον υπολογιστή σας</span>
                  <span className="text-xs text-muted-foreground">Έως 10 MB ανά αρχείο</span>
                  <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(event) => handleFileChange(event.target.files)} />
                </label>
                {fileNotice ? <p className="mt-2 text-sm font-semibold text-destructive">{fileNotice}</p> : null}
                {shouldShowError("documents") ? <FieldError message={errors.documents} /> : null}
                {documents.length > 0 ? (
                  <div className="mt-4 grid gap-2">
                    {documents.map((file) => <UploadedFileRow key={`${file.name}-${file.size}-${file.lastModified}`} file={file} onRemove={() => removeDocument(file)} />)}
                  </div>
                ) : null}
              </section>

              <section className="grid gap-3 lg:grid-cols-2">
                <ReviewCard title="Στοιχεία" onEdit={() => setStep(0)}>
                  <DetailRow label="Όνομα" value={form.fullName || "-"} />
                  <DetailRow label="Email" value={form.workEmail || "-"} />
                  <DetailRow label="Πόλη" value={form.city || "-"} />
                  <DetailRow label="Σύλλογος" value={form.barAssociation || "-"} />
                </ReviewCard>
                <ReviewCard title="Καταχώριση" onEdit={() => setStep(1)}>
                  <DetailRow label="Κύρια" value={form.specialties[0] || "-"} />
                  <DetailRow label="Γλώσσες" value={parseList(form.languages).join(", ") || "-"} />
                  <DetailRow label="Περιγραφή" value={`${form.professionalBio.trim().length} χαρακτήρες`} />
                </ReviewCard>
                <ReviewCard title="Πληρωμές" onEdit={() => setStep(2)}>
                  <DetailRow label="Τρόποι" value={form.consultationModes.map((mode) => consultationModeLabels[mode]).join(", ")} />
                  <DetailRow label="Τιμές" value={`Από ${formatEuro(Math.min(...form.consultationModes.map((mode) => getNumericPrice(getPriceValue(form, mode), mode))))}`} />
                  <DetailRow label="Διάρκεια" value={`${Math.max(20, Number(form.sessionDurationMinutes) || 20)} λεπτά`} />
                  <DetailRow label="Ημέρες" value={`${activeAvailabilityDays} ενεργές`} />
                  <DetailRow label="Εκκαθάριση" value={formatMaskedIban(form.settlementIban)} />
                </ReviewCard>
                <ReviewCard title="Έγγραφα" onEdit={() => setStep(3)}>
                  <DetailRow label="Έγγραφα" value={`${documents.length} αρχεία`} />
                </ReviewCard>
              </section>
            </div>
          ) : null}

          <div className="mt-7 flex flex-col gap-4 border-t border-[hsl(var(--partner-line))] pt-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {step > 0 ? (
                <Button type="button" variant="outline" className="h-11 rounded-xl border-[hsl(var(--partner-line))] bg-white px-5 text-sm font-bold" onClick={() => setStep((current) => Math.max(0, current - 1))}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Προηγούμενο
                </Button>
              ) : null}
              {!canContinue && disabledReason ? <p className="mt-2 max-w-[360px] text-sm text-muted-foreground">{disabledReason}</p> : null}
            </div>

            {step < steps.length - 1 ? (
              <Button type="button" onClick={handleNext} disabled={!canContinue} className="h-11 rounded-xl px-5 text-sm font-bold">
                Επόμενο
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !canContinue} className="h-11 rounded-xl px-5 text-sm font-bold">
                {isSubmitting ? "Υποβολή..." : "Υποβολή αίτησης"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
          {submitError ? <p className="mt-3 text-sm font-semibold text-destructive">{submitError}</p> : null}
        </div>
      </section>
    </PartnerShell>
  );
};

export default PartnerApply;
