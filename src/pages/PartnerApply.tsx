import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  FolderLock,
  Globe,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, CSSProperties, ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";
import {
  createPartnerApplication,
  type StoredPartnerApplication,
} from "@/lib/platformRepository";
import { trackFunnelEvent } from "@/lib/funnelAnalytics";
import { allowedMarketplaceCityNames, legalPracticeAreaLabels } from "@/lib/marketplaceTaxonomy";
import { cn } from "@/lib/utils";

const specialtiesOptions = [...legalPracticeAreaLabels];

const steps = [
  {
    title: "Στοιχεία",
    railTitle: "Επαγγελματικά στοιχεία",
    railDescription: "Βασικά στοιχεία επικοινωνίας και παρουσίας.",
    checklist: [
      "Χρησιμοποιήστε επαγγελματικό ηλεκτρονικό ταχυδρομείο",
      "Συμπληρώστε πραγματικά στοιχεία επικοινωνίας",
      "Προσθέστε προαιρετικά γραφείο και επαγγελματικό σύνδεσμο",
    ],
  },
  {
    title: "Άδεια",
    railTitle: "Άδεια και ειδικότητες",
    railDescription: "Σύλλογος, μητρώο, εμπειρία και τομείς πρακτικής.",
    checklist: [
      "Επιλέξτε πραγματικές ειδικότητες",
      "Χρησιμοποιήστε τον ακριβή αριθμό μητρώου",
      "Περιορίστε σε έως 5 ενεργούς τομείς πρακτικής",
    ],
  },
  {
    title: "Πρακτική",
    railTitle: "Βιογραφικό και έγγραφα",
    railDescription: "Σύντομο επαγγελματικό προφίλ και αρχεία επαλήθευσης.",
    checklist: [
      "Γράψτε βιογραφικό τουλάχιστον 120 χαρακτήρων",
      "Ανεβάστε έγγραφα επαλήθευσης",
      "Ελέγξτε ότι τα αρχεία είναι ευανάγνωστα",
    ],
  },
  {
    title: "Έλεγχος",
    railTitle: "Τελικός έλεγχος",
    railDescription: "Τελική επιβεβαίωση πριν από την υποβολή.",
    checklist: [
      "Ελέγξτε τα στοιχεία αιτούντος",
      "Επιβεβαιώστε ειδικότητες και αρχεία",
      "Υποβάλετε μόνο όταν ο φάκελος είναι πλήρης",
    ],
  },
] as const;

const minBioLength = 120;
const maxSpecialties = 5;
const maxFileSize = 10 * 1024 * 1024;
const supportedDocumentTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);
const supportedDocumentExtensions = [".pdf", ".png", ".jpg", ".jpeg"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isSupportedDocument = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return supportedDocumentTypes.has(file.type) || supportedDocumentExtensions.some((extension) => lowerName.endsWith(extension));
};

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
  professionalBio: string;
}

type ValidationField = keyof ApplicationForm | "specialties" | "documents";

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
  professionalBio: "",
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const LabelRow = ({ label, optional = false }: { label: string; optional?: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <label className="partner-label">{label}</label>
    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
      {optional ? "Προαιρετικό" : "Υποχρεωτικό"}
    </span>
  </div>
);

const ReviewCard = ({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) => (
  <div className="partner-soft-card p-5">
    <div className="flex items-start justify-between gap-4">
      <p className="font-sans text-[20px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{title}</p>
      <button type="button" onClick={onEdit} className="text-sm font-semibold text-[hsl(var(--partner-navy-soft))] transition hover:text-[hsl(var(--partner-ink))]">
        Επεξεργασία
      </button>
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

const DetailRow = ({ label, value, muted = false }: { label: string; value: ReactNode; muted?: boolean }) => (
  <div className="grid grid-cols-[136px_minmax(0,1fr)] gap-4 border-t border-[hsl(var(--partner-line))]/60 py-3 first:border-t-0 first:pt-0 last:pb-0">
    <span className="text-[12px] font-semibold text-[hsl(var(--partner-navy-soft))]">{label}</span>
    <div className={cn("text-sm leading-6 text-[hsl(var(--partner-ink))]", muted && "text-muted-foreground")}>{value}</div>
  </div>
);

const UploadedFileRow = ({ file, onRemove, compact = false }: { file: File; onRemove?: () => void; compact?: boolean }) => (
  <div className={cn("flex items-center justify-between gap-4 rounded-[14px] border border-[hsl(var(--partner-line))]/70 bg-white px-4 py-3", compact && "px-3 py-2.5")}>
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[hsl(var(--partner-navy))]/10 text-[hsl(var(--partner-navy))]">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[hsl(var(--partner-ink))]">{file.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-3">
      <span className="rounded-full border border-sage/20 bg-sage/10 px-2.5 py-1 text-[11px] font-semibold text-sage-foreground">Έτοιμο</span>
      {onRemove ? (
        <button type="button" onClick={onRemove} className="text-sm font-medium text-[hsl(var(--partner-navy-soft))] transition hover:text-[hsl(var(--partner-ink))]">
          Αφαίρεση
        </button>
      ) : null}
    </div>
  </div>
);

const PartnerApply = () => {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<ApplicationForm>(initialForm);
  const [documents, setDocuments] = useState<File[]>([]);
  const [specialtyQuery, setSpecialtyQuery] = useState("");
  const [touched, setTouched] = useState<Partial<Record<ValidationField, boolean>>>({});
  const [attemptedStep, setAttemptedStep] = useState<number | null>(null);
  const [fileNotice, setFileNotice] = useState("");
  const [showFullBio, setShowFullBio] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [submittedApplication, setSubmittedApplication] = useState<StoredPartnerApplication | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = steps[step];
  useEffect(() => {
    setAttemptedStep(null);
    setShowFullBio(false);
  }, [step]);

  useEffect(() => {
    setShowAllSuggestions(false);
  }, [specialtyQuery, form.specialties]);

  const errors = useMemo<Record<ValidationField, string>>(() => {
    const nextErrors: Record<ValidationField, string> = {
      fullName: form.fullName.trim().length >= 4 ? "" : "Το πεδίο είναι υποχρεωτικό.",
      workEmail: emailPattern.test(form.workEmail.trim()) ? "" : "Συμπληρώστε έγκυρο επαγγελματικό ηλεκτρονικό ταχυδρομείο.",
      phone: form.phone.replace(/\D/g, "").length >= 10 ? "" : "Συμπληρώστε έγκυρο αριθμό τηλεφώνου.",
      city: allowedMarketplaceCityNames.includes(form.city) ? "" : "Επιλέξτε μία από τις διαθέσιμες πόλεις.",
      lawFirmName: "",
      websiteOrLinkedIn: "",
      barAssociation: form.barAssociation.trim() ? "" : "Το πεδίο είναι υποχρεωτικό.",
      registrationNumber: form.registrationNumber.trim() ? "" : "Το πεδίο είναι υποχρεωτικό.",
      yearsOfExperience: form.yearsOfExperience.trim() && Number(form.yearsOfExperience) >= 0 ? "" : "Το πεδίο είναι υποχρεωτικό.",
      specialties: form.specialties.length > 0 ? "" : "Επιλέξτε τουλάχιστον μία ειδικότητα.",
      professionalBio: form.professionalBio.trim().length >= minBioLength ? "" : `Το βιογραφικό πρέπει να περιλαμβάνει τουλάχιστον ${minBioLength} χαρακτήρες.`,
      documents: documents.length > 0 ? "" : "Ανεβάστε τουλάχιστον ένα έγγραφο επαλήθευσης.",
    };

    return nextErrors;
  }, [documents.length, form]);

  const canContinue = useMemo(() => {
    if (step === 0) return !errors.fullName && !errors.workEmail && !errors.phone && !errors.city;
    if (step === 1) return !errors.barAssociation && !errors.registrationNumber && !errors.yearsOfExperience && !errors.specialties;
    if (step === 2) return !errors.professionalBio && !errors.documents;
    return true;
  }, [errors, step]);

  const specialtyResults = useMemo(() => {
    const query = specialtyQuery.trim().toLowerCase();
    return specialtiesOptions.filter((specialty) => {
      const matchesQuery = !query || specialty.toLowerCase().includes(query);
      return matchesQuery && !form.specialties.includes(specialty);
    });
  }, [form.specialties, specialtyQuery]);

  const visibleSpecialtyResults = showAllSuggestions ? specialtyResults : specialtyResults.slice(0, 6);
  const hiddenSpecialtyCount = Math.max(0, specialtyResults.length - visibleSpecialtyResults.length);

  const disabledReason = useMemo(() => {
    if (step === 0) return errors.fullName || errors.workEmail || errors.phone || errors.city;
    if (step === 1) return errors.barAssociation || errors.registrationNumber || errors.yearsOfExperience || errors.specialties;
    if (step === 2) return errors.professionalBio || errors.documents;
    return "";
  }, [errors, step]);

  const bioNeedsToggle = form.professionalBio.trim().length > 340;
  const wrapStyle: CSSProperties = { overflowWrap: "anywhere", wordBreak: "break-word" };
  const bioPreviewStyle: CSSProperties = showFullBio
    ? wrapStyle
    : { ...wrapStyle, display: "-webkit-box", overflow: "hidden", WebkitBoxOrient: "vertical", WebkitLineClamp: 6 };

  const shouldShowError = (field: ValidationField) => Boolean(touched[field] || attemptedStep === step);
  const updateField = (field: keyof ApplicationForm, value: string | string[]) => setForm((current) => ({ ...current, [field]: value }));
  const markTouched = (field: ValidationField) => setTouched((current) => ({ ...current, [field]: true }));

  const markCurrentStepTouched = () => {
    const fieldsByStep: ValidationField[][] = [
      ["fullName", "workEmail", "phone", "city"],
      ["barAssociation", "registrationNumber", "yearsOfExperience", "specialties"],
      ["professionalBio", "documents"],
      [],
    ];

    const nextTouched = { ...touched };
    fieldsByStep[step].forEach((field) => {
      nextTouched[field] = true;
    });
    setTouched(nextTouched);
  };

  const toggleSpecialty = (specialty: string) => {
    setTouched((current) => ({ ...current, specialties: true }));

    if (form.specialties.includes(specialty)) {
      updateField("specialties", form.specialties.filter((item) => item !== specialty));
      return;
    }

    if (form.specialties.length >= maxSpecialties) {
      setFileNotice(`Μπορείτε να επιλέξετε έως ${maxSpecialties} ειδικότητες.`);
      return;
    }

    setFileNotice("");
    updateField("specialties", [...form.specialties, specialty]);
  };

  const removeSpecialty = (specialty: string) => {
    updateField("specialties", form.specialties.filter((item) => item !== specialty));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files || []);
    const supportedFiles = nextFiles.filter(isSupportedDocument);
    const unsupported = nextFiles.filter((file) => !isSupportedDocument(file));
    const oversized = supportedFiles.filter((file) => file.size > maxFileSize);
    const validFiles = supportedFiles.filter((file) => file.size <= maxFileSize);

    setFileNotice(
      unsupported.length > 0
        ? "Ο τύπος αρχείου δεν υποστηρίζεται."
        : oversized.length > 0
          ? "Το αρχείο υπερβαίνει το επιτρεπόμενο μέγεθος των 10MB."
          : "",
    );

    if (validFiles.length > 0) {
      setDocuments((current) => {
        const byKey = new Map(current.map((file) => [`${file.name}-${file.lastModified}-${file.size}`, file]));
        validFiles.forEach((file) => {
          byKey.set(`${file.name}-${file.lastModified}-${file.size}`, file);
        });
        return Array.from(byKey.values());
      });
    }

    setTouched((current) => ({ ...current, documents: true }));
    event.target.value = "";
  };

  const removeDocument = (fileToRemove: File) => {
    setDocuments((current) =>
      current.filter((file) => `${file.name}-${file.lastModified}-${file.size}` !== `${fileToRemove.name}-${fileToRemove.lastModified}-${fileToRemove.size}`),
    );
    setTouched((current) => ({ ...current, documents: true }));
  };

  const handleNext = () => {
    if (!canContinue) {
      setAttemptedStep(step);
      markCurrentStepTouched();
      return;
    }

    setStep((current) => Math.min(steps.length - 1, current + 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const result = await createPartnerApplication({
        fullName: form.fullName.trim(),
        workEmail: form.workEmail.trim().toLowerCase(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        lawFirmName: form.lawFirmName.trim() || undefined,
        websiteOrLinkedIn: form.websiteOrLinkedIn.trim() || undefined,
        barAssociation: form.barAssociation.trim(),
        registrationNumber: form.registrationNumber.trim(),
        yearsOfExperience: form.yearsOfExperience.trim(),
        specialties: form.specialties,
        professionalBio: form.professionalBio.trim(),
        documents: documents.map((document) => ({
          name: document.name,
          size: document.size,
          type: document.type || "unknown",
        })),
      });

      setSubmittedApplication(result.record);
      trackFunnelEvent("lawyer_application_submitted", {
        applicationId: result.record.id,
        referenceId: result.record.referenceId,
        city: result.record.city,
        specialties: result.record.specialties.length,
      });
      setSubmitted(true);
    } catch {
      setSubmitError("Δεν ήταν δυνατή η υποβολή της αίτησης. Προσπαθήστε ξανά.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PartnerShell className="flex min-h-[calc(100vh-120px)] items-center">
        <section className="mx-auto grid w-full max-w-[1120px] gap-5 lg:grid-cols-[308px_minmax(0,1fr)]">
          <aside className="partner-dark-panel p-6">
            <p className="partner-kicker text-[hsl(var(--partner-gold))]">Αίτηση συνεργασίας</p>
            <h1 className="mt-3 font-sans text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white">Ο φάκελος στάλθηκε για έλεγχο.</h1>
            <p className="mt-3 text-sm leading-6 text-white/72">
              Η ομάδα ένταξης θα εξετάσει τα στοιχεία, τις ειδικότητες και τα έγγραφα που υποβάλατε.
            </p>

            <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
              <div>
                <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-white/46">Χρόνος ελέγχου</p>
                <p className="mt-2 text-sm leading-6 text-white/78">Συνήθως 2–3 εργάσιμες ημέρες όταν ο φάκελος είναι πλήρης.</p>
              </div>
              <div>
                <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-white/46">Επικοινωνία</p>
                <p className="mt-2 text-sm leading-6 text-white/78">Αν χρειαστεί συμπλήρωση, θα επικοινωνήσουμε στο ηλεκτρονικό ταχυδρομείο που δηλώσατε.</p>
              </div>
            </div>
          </aside>

          <div className="partner-panel p-7 sm:p-8">
            <div className="max-w-[780px]">
              <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[hsl(var(--partner-navy))] text-white shadow-[0_16px_36px_rgba(18,30,44,0.14)]">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h2 className="mt-5 font-serif text-[2.65rem] leading-[0.98] tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Η αίτηση υποβλήθηκε επιτυχώς.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Ο φάκελος θα εξεταστεί από την ομάδα Dikigoros και θα λάβετε ενημέρωση με μήνυμα ηλεκτρονικού ταχυδρομείου για το επόμενο βήμα.
              </p>
              <p className="mt-2 text-sm leading-6 text-[hsl(var(--partner-navy-soft))]">Καμία πρόσβαση συνεργάτη δεν ενεργοποιείται πριν ολοκληρωθεί ο έλεγχος.</p>
              <div className="mt-4 inline-flex rounded-full border border-[hsl(var(--partner-line))] bg-white px-4 py-2 text-sm font-semibold text-[hsl(var(--partner-ink))]">
                Κωδικός αίτησης: {submittedApplication?.referenceId || "—"}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="partner-soft-card p-5">
                  <p className="font-sans text-[18px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">Στοιχεία αιτούντος</p>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p style={wrapStyle}>Ονοματεπώνυμο: {form.fullName}</p>
                    <p style={wrapStyle}>Ηλεκτρονικό ταχυδρομείο επικοινωνίας: {form.workEmail}</p>
                    <p style={wrapStyle}>Τηλέφωνο: {form.phone}</p>
                  </div>
                </div>

                <div className="partner-soft-card p-5">
                  <p className="font-sans text-[18px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">Φάκελος ελέγχου</p>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p style={wrapStyle}>Σύλλογος: {form.barAssociation}</p>
                    <p>{form.specialties.length} ενεργές ειδικότητες δηλώθηκαν</p>
                    <p>{documents.length} αρχείο(α) υποβλήθηκαν για έλεγχο</p>
                    {submittedApplication?.persistenceSource === "local" ? (
                      <p className="text-[hsl(var(--partner-navy-soft))]">Ο φάκελος καταχωρίστηκε και θα περάσει από έλεγχο ένταξης.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="outline" className="h-[48px] rounded-[14px] border-[hsl(var(--partner-line))] bg-white px-5 text-sm font-semibold text-[hsl(var(--partner-ink))] hover:bg-white">
                  <Link to="/for-lawyers">Επιστροφή στην είσοδο</Link>
                </Button>
                <Button asChild className="h-[48px] rounded-[14px] bg-[hsl(var(--partner-navy))] px-5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(18,30,44,0.12)] hover:bg-[hsl(var(--partner-navy))]/94">
                  <Link to="/for-lawyers/login">Είσοδος Συνεργάτη</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </PartnerShell>
    );
  }

  return (
    <PartnerShell>
      <section className="grid gap-5 lg:grid-cols-[308px_minmax(0,1fr)] lg:items-start">
        <aside className="partner-dark-panel p-6 lg:sticky lg:top-[104px]">
          <p className="partner-kicker text-[hsl(var(--partner-gold))]">Αίτηση συνεργασίας</p>
          <h1 className="mt-3 font-sans text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white">Ένταξη στο δίκτυο συνεργατών του Dikigoros.</h1>
          <p className="mt-3 text-sm leading-6 text-white/72">Η αίτηση αφορά δικηγόρους που θέλουν να αξιολογηθούν πριν αποκτήσουν πρόσβαση στον πίνακα συνεργάτη και πριν ενεργοποιηθεί η παρουσία τους στο δίκτυο.</p>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-white/46">Τρέχον στάδιο</p>
              <p className="mt-2 font-sans text-[22px] font-semibold tracking-[-0.02em] text-white">{currentStep.railTitle}</p>
              <p className="mt-2 text-sm leading-6 text-white/72">{currentStep.railDescription}</p>
            </div>

            <div>
              <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-white/46">Πριν συνεχίσετε</p>
              <ul className="mt-3 space-y-3">
                {currentStep.checklist.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-white/78">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[hsl(var(--partner-gold))]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-white/46">Χρόνος ελέγχου</p>
              <p className="mt-2 text-sm leading-6 text-white/78">Συνήθως 2–3 εργάσιμες ημέρες, εφόσον ο φάκελος είναι πλήρης.</p>
            </div>

            <div className="flex items-start gap-3 border-t border-white/10 pt-5">
              <FolderLock className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--partner-gold))]" />
              <div>
                <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-white/46">Χρήση εγγράφων</p>
                <p className="mt-2 text-sm leading-6 text-white/78">Τα έγγραφα χρησιμοποιούνται μόνο για τον έλεγχο ένταξης και δεν εμφανίζονται δημόσια.</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="partner-panel min-w-0 p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="partner-kicker">Αίτηση Συνεργάτη</p>
              <h2 className="mt-3 font-serif text-[2.65rem] leading-[0.98] tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Ένταξη στο δίκτυο συνεργατών του Dikigoros</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Συμπληρώστε τα στοιχεία που απαιτούνται για την αξιολόγηση του φακέλου ένταξης.</p>
            </div>

            <Link to="/for-lawyers/login" className="inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--partner-navy-soft))] transition hover:text-[hsl(var(--partner-ink))]">
              <ArrowLeft className="h-4 w-4" />
              Έχετε ήδη εγκριθεί; Είσοδος Συνεργάτη
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {steps.map((item, index) => {
              const isActive = step === index;
              const isComplete = step > index;

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    if (index <= step) setStep(index);
                  }}
                  disabled={index > step}
                  className={cn(
                    "flex h-11 items-center gap-2.5 rounded-[14px] border px-3 text-left transition",
                    isActive && "border-[hsl(var(--partner-navy))] bg-[hsl(var(--partner-navy))] text-white",
                    isComplete && "border-[hsl(var(--partner-line))] bg-white text-[hsl(var(--partner-ink))]",
                    !isActive && !isComplete && "border-[hsl(var(--partner-line))] bg-[rgba(255,255,255,0.58)] text-muted-foreground",
                    index > step && "cursor-default",
                  )}
                >
                  <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", isActive && "bg-white/12 text-white", isComplete && "border border-[hsl(var(--partner-navy))]/18 bg-[hsl(var(--partner-navy))]/8 text-[hsl(var(--partner-navy))]", !isActive && !isComplete && "border border-[hsl(var(--partner-line))] bg-white text-muted-foreground")}>
                    {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </div>
                  <span className={cn("text-sm font-semibold", !isActive && !isComplete && "text-[hsl(var(--partner-ink))]")}>{item.title}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-5">
            {step === 0 ? (
              <div className="space-y-5">
                <div>
                  <h3 className="font-sans text-[26px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">Επαγγελματικά στοιχεία</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Συμπληρώστε τα βασικά στοιχεία επικοινωνίας που αντιστοιχούν στην επαγγελματική σας δραστηριότητα.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <LabelRow label="Ονοματεπώνυμο" />
                    <input className="partner-input" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} onBlur={() => markTouched("fullName")} placeholder="Όπως χρησιμοποιείται επαγγελματικά" />
                    {shouldShowError("fullName") && errors.fullName ? <p className="text-xs font-medium text-destructive">{errors.fullName}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <LabelRow label="Επαγγελματικό ηλεκτρονικό ταχυδρομείο" />
                    <input type="email" className="partner-input" value={form.workEmail} onChange={(event) => updateField("workEmail", event.target.value)} onBlur={() => markTouched("workEmail")} placeholder="name@lawfirm.gr" />
                    {shouldShowError("workEmail") && errors.workEmail ? <p className="text-xs font-medium text-destructive">{errors.workEmail}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <LabelRow label="Τηλέφωνο" />
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--partner-navy-soft))]" />
                      <input className="partner-input pl-10" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} onBlur={() => markTouched("phone")} placeholder="+30 69..." />
                    </div>
                    {shouldShowError("phone") && errors.phone ? <p className="text-xs font-medium text-destructive">{errors.phone}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <LabelRow label="Πόλη / Περιοχή" />
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--partner-navy-soft))]" />
                      <select className="partner-input pl-10" value={form.city} onChange={(event) => updateField("city", event.target.value)} onBlur={() => markTouched("city")}>
                        <option value="">Επιλέξτε πόλη</option>
                        {allowedMarketplaceCityNames.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                    {shouldShowError("city") && errors.city ? <p className="text-xs font-medium text-destructive">{errors.city}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <LabelRow label="Όνομα γραφείου" optional />
                    <input className="partner-input" value={form.lawFirmName} onChange={(event) => updateField("lawFirmName", event.target.value)} placeholder="Επωνυμία γραφείου" />
                  </div>

                  <div className="space-y-2">
                    <LabelRow label="Ιστοσελίδα ή LinkedIn" optional />
                    <div className="relative">
                      <Globe className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--partner-navy-soft))]" />
                      <input className="partner-input pl-10" value={form.websiteOrLinkedIn} onChange={(event) => updateField("websiteOrLinkedIn", event.target.value)} placeholder="https://..." />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-[hsl(var(--partner-line))] pt-4 text-sm text-muted-foreground md:grid-cols-2">
                  <p>Συμπληρώστε τα απαιτούμενα πεδία για να συνεχίσετε.</p>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <h3 className="font-sans text-[26px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">Άδεια και ειδικότητες</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Συμπληρώστε τα στοιχεία επαγγελματικής ιδιότητας και επιλέξτε μόνο τους τομείς πρακτικής στους οποίους δραστηριοποιείστε ενεργά.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <LabelRow label="Δικηγορικός σύλλογος" />
                    <input className="partner-input" value={form.barAssociation} onChange={(event) => updateField("barAssociation", event.target.value)} onBlur={() => markTouched("barAssociation")} placeholder="Δικηγορικός Σύλλογος Αθηνών" />
                    {shouldShowError("barAssociation") && errors.barAssociation ? <p className="text-xs font-medium text-destructive">{errors.barAssociation}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <LabelRow label="Αριθμός μητρώου" />
                    <input className="partner-input" value={form.registrationNumber} onChange={(event) => updateField("registrationNumber", event.target.value)} onBlur={() => markTouched("registrationNumber")} placeholder="A12345" />
                    {shouldShowError("registrationNumber") && errors.registrationNumber ? <p className="text-xs font-medium text-destructive">{errors.registrationNumber}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <LabelRow label="Χρόνια εμπειρίας" />
                    <input type="number" min="0" className="partner-input" value={form.yearsOfExperience} onChange={(event) => updateField("yearsOfExperience", event.target.value)} onBlur={() => markTouched("yearsOfExperience")} placeholder="12" />
                    {shouldShowError("yearsOfExperience") && errors.yearsOfExperience ? <p className="text-xs font-medium text-destructive">{errors.yearsOfExperience}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <LabelRow label="Όνομα γραφείου" optional />
                    <input className="partner-input" value={form.lawFirmName} onChange={(event) => updateField("lawFirmName", event.target.value)} placeholder="Επωνυμία γραφείου" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="partner-label">Ειδικότητες</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Αναζητήστε και επιλέξτε έως 5 ειδικότητες που αντιστοιχούν ενεργά στην πρακτική σας.</p>
                    </div>
                    <span className="text-[13px] font-medium text-[hsl(var(--partner-navy-soft))]">{form.specialties.length}/{maxSpecialties}</span>
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--partner-navy-soft))]" />
                    <input className="partner-input pl-10" value={specialtyQuery} onChange={(event) => setSpecialtyQuery(event.target.value)} placeholder="Αναζήτηση ειδικότητας" />
                  </div>

                  <div className="rounded-[14px] border border-[hsl(var(--partner-line))] bg-white px-4 py-3">
                    <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Επιλεγμένες ειδικότητες</p>
                    {form.specialties.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {form.specialties.map((specialty) => (
                          <button key={specialty} type="button" onClick={() => removeSpecialty(specialty)} className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--partner-navy))]/25 bg-[hsl(var(--partner-navy))] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[hsl(var(--partner-navy))]/92">
                            {specialty}
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Δεν έχετε επιλέξει ειδικότητα ακόμη.</p>
                    )}
                  </div>

                  <div className="partner-soft-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Διαθέσιμες προτάσεις</p>
                      {specialtyResults.length > 6 ? (
                        <button type="button" onClick={() => setShowAllSuggestions((current) => !current)} className="text-[12px] font-semibold text-[hsl(var(--partner-navy-soft))] transition hover:text-[hsl(var(--partner-ink))]">
                          {showAllSuggestions ? "Λιγότερες" : `+${hiddenSpecialtyCount} ακόμη`}
                        </button>
                      ) : null}
                    </div>
                    {visibleSpecialtyResults.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {visibleSpecialtyResults.map((specialty) => (
                          <button key={specialty} type="button" onClick={() => toggleSpecialty(specialty)} className="partner-chip border-[hsl(var(--partner-line))] bg-[rgba(255,255,255,0.72)] text-[hsl(var(--partner-ink))] hover:border-[hsl(var(--partner-navy))]/18 hover:bg-white">
                            {specialty}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Δεν υπάρχουν άλλες διαθέσιμες ειδικότητες για αυτό το φίλτρο.</p>
                    )}
                  </div>

                  {shouldShowError("specialties") && errors.specialties ? <p className="text-xs font-medium text-destructive">{errors.specialties}</p> : null}
                  {fileNotice && step === 1 ? <p className="text-sm text-[hsl(var(--partner-navy-soft))]">{fileNotice}</p> : null}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div>
                  <h3 className="font-sans text-[26px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">Πρακτική και έγγραφα</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Περιγράψτε συνοπτικά το αντικείμενο πρακτικής σας και ανεβάστε τα έγγραφα που απαιτούνται για την επαλήθευση της αίτησης.</p>
                </div>

                <div className="space-y-2">
                  <LabelRow label="Σύντομο επαγγελματικό βιογραφικό" />
                  <p className="text-sm leading-6 text-muted-foreground">Σύντομη, επαγγελματική περιγραφή που βοηθά στον έλεγχο ένταξης.</p>
                  <textarea
                    className="partner-textarea min-h-[160px]"
                    value={form.professionalBio}
                    onChange={(event) => updateField("professionalBio", event.target.value)}
                    onBlur={() => markTouched("professionalBio")}
                    placeholder="Περιγράψτε το αντικείμενο πρακτικής σας, την εμπειρία σας, βασικούς τομείς ενασχόλησης και τον τρόπο συνεργασίας σας με πελάτες ή μέσω ραντεβού."
                  />
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>Ελάχιστο 120 χαρακτήρες</span>
                    <span className={cn(form.professionalBio.trim().length >= minBioLength && "text-sage-foreground")}>{form.professionalBio.trim().length} / {minBioLength}+ χαρακτήρες</span>
                  </div>
                  {shouldShowError("professionalBio") && errors.professionalBio ? <p className="text-xs font-medium text-destructive">{errors.professionalBio}</p> : null}
                </div>

                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="partner-label">Έγγραφα επαλήθευσης</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Αρχεία ελέγχου ένταξης. Η ομάδα Dikigoros βλέπει μόνο τα αρχεία που απαιτούνται για την επαλήθευση.</p>
                    </div>
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Υποχρεωτικό</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[hsl(var(--partner-line))] bg-white px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--partner-ink))]">PDF</span>
                    <span className="rounded-full border border-[hsl(var(--partner-line))] bg-white px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--partner-ink))]">PNG</span>
                    <span className="rounded-full border border-[hsl(var(--partner-line))] bg-white px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--partner-ink))]">JPG</span>
                    <span className="rounded-full border border-[hsl(var(--partner-line))] bg-white px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--partner-ink))]">Έως 10MB ανά αρχείο</span>
                  </div>

                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-[16px] border border-dashed border-[hsl(var(--partner-line))] bg-white px-6 py-7 text-center transition hover:border-[hsl(var(--partner-navy))]/28 hover:bg-[rgba(255,255,255,0.92)]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[hsl(var(--partner-navy))] text-white">
                      <Upload className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-[hsl(var(--partner-ink))]">Σύρετε αρχεία εδώ ή επιλέξτε από τον υπολογιστή σας</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Βεβαίωση εγγραφής, άδεια άσκησης ή άλλο επίσημο έγγραφο που υποστηρίζει τον έλεγχο.</p>
                    </div>
                    <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileChange} />
                  </label>

                  {fileNotice ? <p className="text-sm text-[hsl(var(--partner-navy-soft))]">{fileNotice}</p> : null}
                  {shouldShowError("documents") && errors.documents ? <p className="text-xs font-medium text-destructive">{errors.documents}</p> : null}

                  {documents.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Αρχεία ελέγχου ένταξης</p>
                      {documents.map((document) => (
                        <UploadedFileRow key={`${document.name}-${document.lastModified}-${document.size}`} file={document} onRemove={() => removeDocument(document)} />
                      ))}
                    </div>
                  ) : (
                    <div className="partner-soft-card p-4">
                      <p className="text-[13px] font-semibold text-[hsl(var(--partner-ink))]">Τυπικά αρχεία που γίνονται δεκτά</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Βεβαίωση εγγραφής σε σύλλογο, άδεια άσκησης ή άλλο επίσημο επαγγελματικό έγγραφο που αποδεικνύει την ιδιότητα του αιτούντος.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <div>
                  <h3 className="font-sans text-[26px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">Τελικός έλεγχος υποβολής</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Ελέγξτε συνοπτικά τα στοιχεία πριν προχωρήσετε στην αποστολή για εξέταση.</p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <ReviewCard title="Στοιχεία αιτούντος" onEdit={() => setStep(0)}>
                    <DetailRow label="Ονοματεπώνυμο" value={<span style={wrapStyle}>{form.fullName}</span>} />
                    <DetailRow label="Ηλεκτρονικό ταχυδρομείο" value={<span style={wrapStyle}>{form.workEmail}</span>} />
                    <DetailRow label="Τηλέφωνο" value={<span style={wrapStyle}>{form.phone}</span>} />
                    <DetailRow label="Πόλη" value={<span style={wrapStyle}>{form.city}</span>} />
                    {form.lawFirmName ? <DetailRow label="Γραφείο" value={<span style={wrapStyle}>{form.lawFirmName}</span>} muted /> : null}
                  </ReviewCard>

                  <ReviewCard title="Στοιχεία άδειας" onEdit={() => setStep(1)}>
                    <DetailRow label="Σύλλογος" value={<span style={wrapStyle}>{form.barAssociation}</span>} />
                    <DetailRow label="Μητρώο" value={<span style={wrapStyle}>{form.registrationNumber}</span>} />
                    <DetailRow label="Εμπειρία" value={<span style={wrapStyle}>{form.yearsOfExperience} χρόνια</span>} />
                    {form.lawFirmName ? <DetailRow label="Γραφείο" value={<span style={wrapStyle}>{form.lawFirmName}</span>} muted /> : null}
                  </ReviewCard>

                  <ReviewCard title="Ειδικότητες και αρχεία" onEdit={() => setStep(1)}>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Ειδικότητες</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {form.specialties.map((specialty) => (
                            <span key={specialty} className="inline-flex items-center rounded-full border border-[hsl(var(--partner-navy))]/18 bg-[hsl(var(--partner-navy))]/8 px-3 py-1.5 text-xs font-semibold text-[hsl(var(--partner-navy))]">
                              {specialty}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-[hsl(var(--partner-line))]/60 pt-3">
                        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Αρχεία</p>
                        <div className="mt-3 space-y-2">
                          {documents.map((document) => (
                            <UploadedFileRow key={`${document.name}-${document.lastModified}-${document.size}`} file={document} compact />
                          ))}
                        </div>
                      </div>
                    </div>
                  </ReviewCard>

                  <ReviewCard title="Επαγγελματικό βιογραφικό" onEdit={() => setStep(2)}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Περίληψη βιογραφικού</p>
                        <span className="text-xs font-medium text-[hsl(var(--partner-navy-soft))]">{form.professionalBio.trim().length} χαρακτήρες</span>
                      </div>
                      <div className="h-[170px] overflow-auto rounded-[14px] bg-[rgba(247,241,231,0.78)] px-4 py-4 text-sm leading-6 text-muted-foreground" style={bioPreviewStyle}>
                        {form.professionalBio}
                      </div>
                      {bioNeedsToggle ? (
                        <button type="button" onClick={() => setShowFullBio((current) => !current)} className="text-sm font-medium text-[hsl(var(--partner-navy-soft))] transition hover:text-[hsl(var(--partner-ink))]">
                          {showFullBio ? "Λιγότερο κείμενο" : "Προβολή πλήρους κειμένου"}
                        </button>
                      ) : null}
                    </div>
                  </ReviewCard>
                </div>

                <div className="partner-soft-card-strong p-6">
                  <p className="font-sans text-[20px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">Δήλωση υποβολής</p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">Με την υποβολή επιβεβαιώνετε ότι τα στοιχεία, οι ειδικότητες και τα έγγραφα αντιστοιχούν στον αιτούντα δικηγόρο και μπορούν να χρησιμοποιηθούν για έλεγχο ένταξης στο δίκτυο Dikigoros.</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className={cn("mt-7 flex flex-col gap-4 border-t border-[hsl(var(--partner-line))] pt-5 sm:flex-row sm:items-start sm:justify-between", step === 3 && "sticky bottom-4 rounded-[16px] border bg-[rgba(255,252,247,0.98)] px-5 py-4 shadow-[0_10px_30px_rgba(18,30,44,0.06)] backdrop-blur")}>
            <div className="space-y-2">
              {step > 0 ? (
                <Button type="button" variant="outline" className="h-[48px] rounded-[14px] border-[hsl(var(--partner-line))] bg-white px-5 text-sm font-semibold text-[hsl(var(--partner-ink))] hover:bg-white" onClick={() => setStep((current) => Math.max(0, current - 1))}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Προηγούμενο
                </Button>
              ) : null}
              {step < 3 && !canContinue ? <p className="max-w-[360px] text-sm text-muted-foreground">{disabledReason}</p> : null}
            </div>

            {step < steps.length - 1 ? (
              <div className="space-y-2 sm:text-right">
                <Button type="button" onClick={handleNext} className={cn("h-[48px] rounded-[14px] px-5 text-sm font-semibold transition", canContinue ? "bg-[hsl(var(--partner-navy))] text-white shadow-[0_12px_26px_rgba(18,30,44,0.12)] hover:bg-[hsl(var(--partner-navy))]/94" : "bg-[#A6ADB8] text-white hover:bg-[#A6ADB8]")} disabled={!canContinue}>
                  Συνέχεια
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {!canContinue ? <p className="text-sm text-muted-foreground">Συμπληρώστε τα απαιτούμενα πεδία για να συνεχίσετε.</p> : null}
              </div>
            ) : (
              <Button type="button" className="h-[48px] rounded-[14px] bg-[hsl(var(--partner-navy))] px-6 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(18,30,44,0.14)] hover:bg-[hsl(var(--partner-navy))]/94" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Γίνεται υποβολή..." : "Υποβολή για έλεγχο"}
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
