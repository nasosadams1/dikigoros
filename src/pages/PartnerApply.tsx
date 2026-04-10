import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  FolderLock,
  MapPin,
  Phone,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";

const specialtiesOptions = [
  "Οικογενειακό Δίκαιο",
  "Εργατικό Δίκαιο",
  "Ακίνητα",
  "Εμπορικό Δίκαιο",
  "Ποινικό Δίκαιο",
  "Κληρονομικό Δίκαιο",
  "Φορολογικό Δίκαιο",
  "Μεταναστευτικό Δίκαιο",
];

const steps = ["Στοιχεία", "Άδεια", "Πρακτική", "Έλεγχος"];

const stepMeta = [
  {
    title: "Επαγγελματικά στοιχεία",
    summary: "Συμπληρώστε τα βασικά στοιχεία επικοινωνίας σας.",
    checkpoint: "Χρησιμοποιήστε το email και το τηλέφωνο της πρακτικής σας.",
  },
  {
    title: "Άδεια και ειδικότητες",
    summary: "Συμπληρώστε στοιχεία συλλόγου, αριθμό μητρώου και τομείς πρακτικής.",
    checkpoint: "Επιλέξτε τις ειδικότητες με τις οποίες θέλετε να συνδεθεί το προφίλ σας.",
  },
  {
    title: "Πρακτική και έγγραφα",
    summary: "Προσθέστε ένα σύντομο βιογραφικό και τα έγγραφα επαλήθευσης.",
    checkpoint: "Ανεβάστε τα έγγραφα που επιβεβαιώνουν καλύτερα την επαγγελματική σας ιδιότητα.",
  },
  {
    title: "Τελικός έλεγχος",
    summary: "Ελέγξτε την αίτηση πριν περάσει σε εξέταση.",
    checkpoint: "Επιβεβαιώστε ότι τα στοιχεία ανήκουν στον αιτούντα δικηγόρο.",
  },
] as const;

interface ApplicationForm {
  fullName: string;
  workEmail: string;
  phone: string;
  city: string;
  barAssociation: string;
  registrationNumber: string;
  specialties: string[];
  yearsOfExperience: string;
  lawFirmName: string;
  professionalBio: string;
}

const initialForm: ApplicationForm = {
  fullName: "",
  workEmail: "",
  phone: "",
  city: "",
  barAssociation: "",
  registrationNumber: "",
  specialties: [],
  yearsOfExperience: "",
  lawFirmName: "",
  professionalBio: "",
};

const PartnerApply = () => {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<ApplicationForm>(initialForm);
  const [documents, setDocuments] = useState<File[]>([]);

  const currentStepMeta = stepMeta[step];

  const canContinue = useMemo(() => {
    if (step === 0) {
      return Boolean(form.fullName && form.workEmail && form.phone && form.city);
    }

    if (step === 1) {
      return Boolean(
        form.barAssociation &&
          form.registrationNumber &&
          form.specialties.length > 0 &&
          form.yearsOfExperience &&
          form.lawFirmName,
      );
    }

    if (step === 2) {
      return Boolean(form.professionalBio.trim().length >= 80 && documents.length > 0);
    }

    return true;
  }, [documents.length, form, step]);

  const updateField = (field: keyof ApplicationForm, value: string | string[]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleSpecialty = (specialty: string) => {
    setForm((current) => ({
      ...current,
      specialties: current.specialties.includes(specialty)
        ? current.specialties.filter((item) => item !== specialty)
        : [...current.specialties, specialty],
    }));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files || []);
    setDocuments(nextFiles);
  };

  if (submitted) {
    return (
      <PartnerShell className="flex min-h-[calc(100vh-120px)] items-center">
        <section className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="partner-dark-panel p-7 sm:p-9">
            <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[hsl(var(--partner-gold))]">Η Αίτηση Παραλήφθηκε</p>
            <h1 className="mt-5 font-serif text-[2.55rem] leading-[1.04] tracking-[-0.03em] text-[hsl(var(--partner-ivory))]">
              Ο έλεγχος της αίτησής σας εκκρεμεί.
            </h1>
            <p className="mt-5 text-sm leading-7 text-white/72">Τα στοιχεία και τα έγγραφά σας βρίσκονται πλέον υπό εξέταση.</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
              <div className="partner-dark-card-featured p-5">
                <p className="text-sm font-semibold text-white">Εκτιμώμενος χρόνος</p>
                <p className="mt-2 text-sm leading-6 text-white/68">Συνήθως 2 έως 3 εργάσιμες ημέρες.</p>
              </div>
              <div className="partner-dark-card p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Επικοινωνία</p>
                <p className="mt-3 text-sm font-semibold text-white">Μόνο μέσω email</p>
                <p className="mt-2 text-sm leading-6 text-white/62">Οποιαδήποτε συνέχεια θα σταλεί εκεί.</p>
              </div>
            </div>
          </aside>

          <div className="partner-panel p-7 sm:p-10">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.45rem] bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))] shadow-lg shadow-[rgba(14,25,39,0.14)]">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="partner-kicker mt-6">Αναμονή Τελικού Ελέγχου</p>
              <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Η αίτηση υποβλήθηκε επιτυχώς</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">Θα εξετάσουμε τα στοιχεία και το πακέτο επαλήθευσης πριν επιβεβαιώσουμε την πρόσβαση.</p>

              <div className="mt-8 grid gap-4 text-left md:grid-cols-2">
                <div className="partner-soft-card-strong p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Αιτών</p>
                  <p className="mt-3 text-base font-semibold text-[hsl(var(--partner-ink))]">{form.fullName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{form.workEmail}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{form.lawFirmName}</p>
                </div>
                <div className="partner-soft-card p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Πακέτο επαλήθευσης</p>
                  <p className="mt-3 text-base font-semibold text-[hsl(var(--partner-ink))]">{documents.length} αρχείο(α) ανέβηκαν</p>
                  <p className="mt-1 text-sm text-muted-foreground">{form.barAssociation} | Μητρ. {form.registrationNumber}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{form.specialties.join(", ")}</p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild variant="outline" className="h-12 rounded-xl border-[hsl(var(--partner-line))] bg-white/60 px-5 text-[hsl(var(--partner-ink))] hover:bg-white">
                  <Link to="/for-lawyers">Επιστροφή στην είσοδο</Link>
                </Button>
                <Button asChild size="lg" className="h-12 rounded-xl bg-[hsl(var(--partner-navy))] px-6 text-[hsl(var(--partner-ivory))] hover:bg-[hsl(var(--partner-navy))]/92">
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
      <section className="grid gap-6 lg:grid-cols-[0.84fr_1.16fr]">
        <aside className="partner-dark-panel p-7 sm:p-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[hsl(var(--partner-gold))]">Αίτηση Συνεργασίας</p>
          <h1 className="mt-5 font-serif text-[2.7rem] leading-[1.03] tracking-[-0.03em] text-[hsl(var(--partner-ivory))]">
            Δομημένη ένταξη για επαγγελματίες δικηγόρους.
          </h1>
          <p className="mt-5 text-sm leading-7 text-white/72">Αίτηση συνεργασίας ειδικά για δικηγόρους, όχι δημόσια εγγραφή.</p>

          <div className="mt-8 partner-dark-card-featured p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--partner-gold))]">Τρέχον στάδιο</p>
            <h2 className="mt-4 font-serif text-[2rem] leading-tight tracking-[-0.03em] text-white">{currentStepMeta.title}</h2>
            <p className="mt-4 text-sm leading-7 text-white/72">{currentStepMeta.summary}</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
            <div className="partner-dark-card p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--partner-gold))]" />
                <div>
                  <p className="text-sm font-semibold text-white">Σημείο ελέγχου</p>
                  <p className="mt-1 text-sm leading-6 text-white/64">{currentStepMeta.checkpoint}</p>
                </div>
              </div>
            </div>
            <div className="partner-dark-card p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Ρυθμός ελέγχου</p>
              <p className="mt-3 font-serif text-3xl tracking-[-0.03em] text-white">2-3ημ</p>
              <p className="mt-2 text-sm leading-6 text-white/62">Τυπικός χρόνος όταν ο φάκελος είναι πλήρης.</p>
            </div>
          </div>

          <div className="mt-3 partner-dark-card p-5">
            <div className="flex items-start gap-3">
              <FolderLock className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--partner-gold))]" />
              <div>
                <p className="text-sm font-semibold text-white">Χρήση εγγράφων</p>
                <p className="mt-1 text-sm leading-6 text-white/64">Τα αρχεία χρησιμοποιούνται μόνο για τον έλεγχο εισόδου.</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="partner-panel p-7 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="partner-kicker">Αίτηση Συνεργάτη</p>
              <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Ένταξη στο δίκτυο Dikigoros</h2>
            </div>
            <Link to="/for-lawyers/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--partner-navy-soft))] transition hover:text-[hsl(var(--partner-ink))]">
              <ArrowLeft className="h-4 w-4" />
              Έχετε ήδη εγκριθεί; Είσοδος Συνεργάτη
            </Link>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-4">
            {steps.map((label, index) => {
              const active = step === index;
              const complete = step > index;

              return (
                <div
                  key={label}
                  className={`rounded-[1.35rem] border px-4 py-4 transition ${
                    active
                      ? "border-[hsl(var(--partner-navy))] bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))] shadow-[0_18px_34px_rgba(18,30,44,0.14)]"
                      : complete
                        ? "border-[hsl(var(--partner-line))] bg-white/80 text-[hsl(var(--partner-ink))]"
                        : "border-[hsl(var(--partner-line))] bg-white/45 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-semibold ${
                        active
                          ? "bg-white/12 text-[hsl(var(--partner-gold))]"
                          : complete
                            ? "bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))]"
                            : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-[0.16em] ${active ? "text-white/55" : complete ? "text-[hsl(var(--partner-navy-soft))]" : "text-muted-foreground/70"}`}>
                      Βήμα
                    </span>
                  </div>
                  <p className={`mt-3 text-sm font-semibold ${active ? "text-white" : "text-inherit"}`}>{label}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            {step === 0 && (
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="fullName" className="partner-label">Ονοματεπώνυμο</label>
                    <input id="fullName" className="partner-input" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} placeholder="Ελένη Καραγιάννη" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="workEmail" className="partner-label">Επαγγελματικό email</label>
                    <input id="workEmail" type="email" className="partner-input" value={form.workEmail} onChange={(event) => updateField("workEmail", event.target.value)} placeholder="elena@karagiannilegal.gr" />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="phone" className="partner-label">Τηλέφωνο</label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input id="phone" className="partner-input pl-11" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+30 69..." />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="city" className="partner-label">Πόλη</label>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input id="city" className="partner-input pl-11" value={form.city} onChange={(event) => updateField("city", event.target.value)} placeholder="Αθήνα" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="partner-soft-card p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Τι εξετάζουμε εδώ</p>
                  <h3 className="mt-4 font-serif text-2xl tracking-[-0.02em] text-[hsl(var(--partner-ink))]">Επαγγελματική ταυτότητα</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">Χρησιμοποιήστε τα στοιχεία επικοινωνίας που αντιστοιχούν στην πρακτική σας.</p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="barAssociation" className="partner-label">Δικηγορικός σύλλογος</label>
                      <input id="barAssociation" className="partner-input" value={form.barAssociation} onChange={(event) => updateField("barAssociation", event.target.value)} placeholder="Δικηγορικός Σύλλογος Αθηνών" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="registrationNumber" className="partner-label">Αριθμός μητρώου</label>
                      <input id="registrationNumber" className="partner-input" value={form.registrationNumber} onChange={(event) => updateField("registrationNumber", event.target.value)} placeholder="A12345" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="yearsOfExperience" className="partner-label">Χρόνια εμπειρίας</label>
                      <input id="yearsOfExperience" type="number" min="0" className="partner-input" value={form.yearsOfExperience} onChange={(event) => updateField("yearsOfExperience", event.target.value)} placeholder="12" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="lawFirmName" className="partner-label">Όνομα γραφείου</label>
                      <input id="lawFirmName" className="partner-input" value={form.lawFirmName} onChange={(event) => updateField("lawFirmName", event.target.value)} placeholder="Karagianni Legal" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="partner-label">Ειδικότητες</p>
                    <div className="flex flex-wrap gap-2">
                      {specialtiesOptions.map((specialty) => {
                        const active = form.specialties.includes(specialty);
                        return (
                          <button
                            key={specialty}
                            type="button"
                            onClick={() => toggleSpecialty(specialty)}
                            className={`partner-chip ${active ? "partner-chip-active" : ""}`}
                          >
                            {specialty}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="partner-soft-card-strong p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Σημείωση αξιολόγησης</p>
                    <h3 className="mt-4 font-serif text-2xl tracking-[-0.02em] text-[hsl(var(--partner-ink))]">Άδεια και τοποθέτηση</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">Εξετάζουμε τόσο την επαγγελματική ιδιότητα όσο και το πώς τοποθετείται το προφίλ σας.</p>
                  </div>
                  <div className="partner-soft-card p-5">
                    <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Ενδεικτικές επιλογές</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">Επιλέξτε τους τομείς στους οποίους ασκείτε ενεργά δικηγορία.</p>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="professionalBio" className="partner-label">Σύντομο επαγγελματικό βιογραφικό</label>
                    <textarea
                      id="professionalBio"
                      className="partner-textarea"
                      value={form.professionalBio}
                      onChange={(event) => updateField("professionalBio", event.target.value)}
                      placeholder="Περιγράψτε το αντικείμενο πρακτικής σας, το προφίλ πελατών σας και τον τρόπο με τον οποίο προσεγγίζετε τις συνεργασίες μέσω Dikigoros."
                    />
                    <p className="text-xs text-muted-foreground">Τουλάχιστον 80 χαρακτήρες.</p>
                  </div>

                  <div className="partner-soft-card p-5">
                    <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Τι βοηθά σε ένα καλό βιογραφικό</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">Συνοψίστε την εστίαση της πρακτικής σας και τα νομικά θέματα που χειρίζεστε καλύτερα.</p>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-dashed border-[hsl(var(--partner-line))] bg-white/55 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="partner-label">Ανέβασμα εγγράφων επαλήθευσης</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Ανεβάστε απόδειξη εγγραφής ή άλλο επαγγελματικό έγγραφο.</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--partner-navy))] text-[hsl(var(--partner-ivory))]">
                      <Upload className="h-5 w-5" />
                    </div>
                  </div>

                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="mt-5 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-[hsl(var(--partner-navy))] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[hsl(var(--partner-ivory))]"
                  />

                  {documents.length > 0 ? (
                    <div className="mt-5 space-y-2">
                      {documents.map((document) => (
                        <div key={`${document.name}-${document.size}`} className="partner-soft-card flex items-center gap-2 px-4 py-3 text-sm text-[hsl(var(--partner-ink))]">
                          <FileText className="h-4 w-4 text-[hsl(var(--partner-navy-soft))]" />
                          <span className="font-medium">{document.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 partner-soft-card p-4">
                      <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Προτεινόμενα αρχεία</p>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">Βεβαίωση εγγραφής, άδεια άσκησης ή αντίστοιχο έγγραφο.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="partner-soft-card-strong p-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Τελικός έλεγχος υποβολής</p>
                  <h3 className="mt-4 font-serif text-[2.2rem] leading-tight tracking-[-0.03em] text-[hsl(var(--partner-ink))]">
                    Ελέγξτε τη σύνοψη πριν την αποστολή.
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">Επιβεβαιώστε τα στοιχεία πριν υποβάλετε.</p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="partner-soft-card p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Στοιχεία αιτούντος</p>
                    <div className="mt-4 space-y-2">
                      <p className="text-base font-semibold text-[hsl(var(--partner-ink))]">{form.fullName}</p>
                      <p className="text-sm text-muted-foreground">{form.workEmail}</p>
                      <p className="text-sm text-muted-foreground">{form.phone}</p>
                      <p className="text-sm text-muted-foreground">{form.city}</p>
                    </div>
                  </div>

                  <div className="partner-soft-card p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Στοιχεία άδειας</p>
                    <div className="mt-4 space-y-2">
                      <p className="text-base font-semibold text-[hsl(var(--partner-ink))]">{form.barAssociation}</p>
                      <p className="text-sm text-muted-foreground">Μητρώο: {form.registrationNumber}</p>
                      <p className="text-sm text-muted-foreground">{form.yearsOfExperience} χρόνια εμπειρίας | {form.lawFirmName}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
                  <div className="partner-soft-card p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Ειδικότητες</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {form.specialties.map((specialty) => (
                        <span key={specialty} className="partner-chip partner-chip-active">
                          {specialty}
                        </span>
                      ))}
                    </div>
                    <div className="mt-5 border-t border-black/6 pt-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Αρχεία επαλήθευσης</p>
                      <p className="mt-2 text-sm text-[hsl(var(--partner-ink))]">{documents.length} αρχείο(α) έτοιμα για έλεγχο</p>
                    </div>
                  </div>

                  <div className="partner-soft-card p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Επαγγελματικό βιογραφικό</p>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground">{form.professionalBio}</p>
                  </div>
                </div>

                <div className="partner-dark-panel p-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--partner-gold))]">Δήλωση υποβολής</p>
                  <p className="mt-4 text-base leading-8 text-[hsl(var(--partner-ivory))]">
                    Με την υποβολή, επιβεβαιώνετε ότι τα στοιχεία και τα έγγραφα ανήκουν στον αιτούντα δικηγόρο.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-xl border-[hsl(var(--partner-line))] bg-white/60 px-5 text-[hsl(var(--partner-ink))] hover:bg-white"
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Προηγούμενο
            </Button>

            {step < steps.length - 1 ? (
              <Button
                type="button"
                size="lg"
                disabled={!canContinue}
                className="h-12 rounded-xl bg-[hsl(var(--partner-navy))] px-6 text-[hsl(var(--partner-ivory))] shadow-[0_16px_32px_rgba(18,30,44,0.14)] transition hover:-translate-y-[1px] hover:bg-[hsl(var(--partner-navy))]/92 disabled:shadow-none"
                onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
              >
                Συνέχεια
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                className="h-12 rounded-xl bg-[hsl(var(--partner-navy))] px-6 text-[hsl(var(--partner-ivory))] shadow-[0_18px_34px_rgba(18,30,44,0.16)] transition hover:-translate-y-[1px] hover:bg-[hsl(var(--partner-navy))]/92"
                onClick={() => setSubmitted(true)}
              >
                Υποβολή για Έλεγχο
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </section>
    </PartnerShell>
  );
};

export default PartnerApply;
