import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarX, CreditCard, FileText, KeyRound, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import {
  createOperationalCase,
  type OperationalCasePriority,
} from "@/lib/operationsRepository";
import { supportWorkflows, type OperationalArea } from "@/lib/operations";

const supportTopics = [
  { type: "booking", icon: CalendarX, title: "Αποτυχίες κράτησης", text: "Σύγκρουση ώρας, ακύρωση δικηγόρου, αλλαγή ραντεβού, μη εμφάνιση και επείγουσες αλλαγές συμβουλευτικής." },
  { type: "payment", icon: CreditCard, title: "Προβλήματα πληρωμής", text: "Διακοπή ροής πληρωμής, πιθανή διπλή χρέωση, επιλεξιμότητα επιστροφής, πρόσβαση απόδειξης και επιβεβαίωση πληρωμής." },
  { type: "account", icon: KeyRound, title: "Πρόσβαση λογαριασμού", text: "Σύνδεση, προφίλ, ιστορικό ραντεβού, αποθηκευμένοι δικηγόροι, λίστες σύγκρισης και μέθοδος πληρωμής." },
  { type: "documents", icon: FileText, title: "Έγγραφα", text: "Ορατότητα σε δικηγόρο κρατημένου ραντεβού, αιτήματα διαγραφής, λήψη εγγράφων και διαδρομή αιτήματος απορρήτου." },
  { type: "complaint", icon: MessageSquareWarning, title: "Παράπονα", text: "Διαφωνίες αξιολόγησης, θέματα συμπεριφοράς, ακρίβεια προφίλ, διαφωνία κράτησης και κλιμάκωση υποστήριξης." },
  { type: "security", icon: ShieldAlert, title: "Ασφάλεια ή απόρρητο", text: "Ανησυχία για ευαίσθητα νομικά δεδομένα, αναφορά περιστατικού, αίτημα δεδομένων, διαγραφή λογαριασμού και έλεγχος πρόσβασης." },
];

const supportFlow = [
  { title: "Επείγοντα κράτησης ή πληρωμής", text: "Μπαίνουν πρώτα, ειδικά όταν υπάρχει ώρα που πλησιάζει, χρέωση που δεν ξεκαθαρίζει ή ακύρωση από δικηγόρο." },
  { title: "Επιστροφές και αλλαγές", text: "Η υποστήριξη ελέγχει τον κανόνα 24 ωρών, την αιτία ακύρωσης, την κατάσταση πληρωμής και την αρχική μέθοδο πληρωμής." },
  { title: "Παράπονα και έλεγχος", text: "Μπορεί να ζητηθούν στοιχεία, να κρατηθεί δημοσίευση, να αφαιρεθεί κριτική ή να παγώσει προφίλ μέχρι να ολοκληρωθεί ο έλεγχος." },
];

const visibleOperatingRules = [
  {
    title: "Διαφωνία κράτησης",
    owner: "Υποστήριξη κρατήσεων",
    sla: "Ίδια εργάσιμη ημέρα για σύγκρουση ώρας ή μη εμφάνιση.",
    evidence: "κωδικός κράτησης, ώρα, κατάσταση πληρωμής, email χρήστη",
    outcome: "άλλη ώρα, ακύρωση χωρίς χρέωση, επιστροφή υπό έλεγχο ή υπόθεση υποστήριξης",
    escalation: "σε πληρωμές όταν έχει γίνει χρέωση",
  },
  {
    title: "Αποτυχία πληρωμής",
    owner: "Υπεύθυνος πληρωμών",
    sla: "Ίδια εργάσιμη ημέρα, άμεσα για πιθανή διπλή χρέωση.",
    evidence: "κωδικός κράτησης, κωδικός πληρωμής, email, ορατή κατάσταση πληρωμής",
    outcome: "επανάληψη ασφαλούς πληρωμής, επιβεβαίωση αποτυχίας ή άνοιγμα υποστήριξης",
    escalation: "άμεσα αν ο χρήστης βλέπει χρέωση που δεν εμφανίζεται στον λογαριασμό",
  },
  {
    title: "Έλεγχος επιστροφής",
    owner: "Υπεύθυνος πληρωμών",
    sla: "Ίδια εργάσιμη ημέρα για ακύρωση δικηγόρου, έως 2 εργάσιμες για εκπρόθεσμο αίτημα.",
    evidence: "κράτηση, πληρωμή, χρόνος ακύρωσης, λόγος ακύρωσης",
    outcome: "επιστροφή στην αρχική μέθοδο, παρακολούθηση αιτήματος ή αιτιολογημένη απόρριψη",
    escalation: "σε υπεύθυνο υποστήριξης όταν τα γεγονότα της ακύρωσης συγκρούονται",
  },
  {
    title: "Ακύρωση από δικηγόρο",
    owner: "Υποστήριξη κρατήσεων",
    sla: "Ίδια εργάσιμη ημέρα, επείγον αν το ραντεβού είναι εντός 24 ωρών.",
    evidence: "κράτηση, δικηγόρος, λόγος ακύρωσης, πληρωμή, διαθέσιμες εναλλακτικές",
    outcome: "αλλαγή ώρας, αντίστοιχη εναλλακτική ή έλεγχος επιστροφής",
    escalation: "σε έλεγχο συνεργάτη όταν οι ακυρώσεις επαναλαμβάνονται",
  },
  {
    title: "Πρόσβαση λογαριασμού",
    owner: "Υπεύθυνος υποστήριξης",
    sla: "Έως 2 εργάσιμες, ίδια ημέρα όταν μπλοκάρει πληρωμένο ραντεβού.",
    evidence: "email λογαριασμού, κωδικός κράτησης ή πληρωμής, περιγραφή πρόσβασης",
    outcome: "ανάκτηση πρόσβασης ή σαφής εξήγηση για το ποια εγγραφή ελέγχεται",
    escalation: "άμεσα σε ασφάλεια αν υπάρχει υποψία πρόσβασης τρίτου",
  },
  {
    title: "Έγγραφα και διαγραφή",
    owner: "Υπεύθυνος απορρήτου",
    sla: "Έως 2 εργάσιμες, ίδια ημέρα για πιθανή έκθεση εγγράφου.",
    evidence: "email, όνομα ή κωδικός εγγράφου, συνδεδεμένη κράτηση, ορατότητα",
    outcome: "ιδιωτικό, ορατό στον δικηγόρο, διαγραμμένο ή διατηρημένο με λόγο",
    escalation: "σε ασφάλεια/απόρρητο για μη εξουσιοδοτημένη πρόσβαση",
  },
  {
    title: "Διαφωνία κριτικής",
    owner: "Έλεγχος εμπιστοσύνης",
    sla: "48 ώρες, ίδια ημέρα για κατάχρηση ή ιδιωτικά στοιχεία υπόθεσης.",
    evidence: "κράτηση, κριτική, λόγος διαφωνίας, τυχόν δημόσια απάντηση",
    outcome: "δημοσίευση, προσωρινή απόκρυψη, αφαίρεση ή δικαίωμα απάντησης",
    escalation: "σε ασφάλεια για απειλές, απάτη ή επαναλαμβανόμενη κατάχρηση",
  },
  {
    title: "Απόρρητο ή ασφάλεια",
    owner: "Υπεύθυνος ασφάλειας/απορρήτου",
    sla: "Άμεση διαλογή και περιορισμός πριν από κανονική υποστήριξη.",
    evidence: "email, επηρεαζόμενη κράτηση/έγγραφο, περιγραφή, χρόνος που εντοπίστηκε",
    outcome: "περιορισμός πρόσβασης, επιβεβαιωμένη ενημέρωση και διορθωτικό βήμα",
    escalation: "δεν μένει στην ουρά υποστήριξης, πηγαίνει άμεσα σε ασφάλεια/απόρρητο",
  },
];

const areaBySupportType: Record<string, OperationalArea> = {
  booking: "bookingDisputes",
  payment: "payments",
  account: "support",
  documents: "privacyDocuments",
  complaint: "bookingDisputes",
  security: "security",
};

const priorityByUrgency: Record<string, OperationalCasePriority> = {
  urgent: "urgent",
  normal: "normal",
  privacy: "urgent",
};

const SupportCenter = () => {
  const [caseReference, setCaseReference] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: "booking",
    urgency: "normal",
    reference: "",
    email: "",
    message: "",
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");
    const area = areaBySupportType[form.type] || "support";
    const topicTitle = supportTopics.find((topic) => topic.type === form.type)?.title || "Υποστήριξη";
    try {
      const supportCase = await createOperationalCase({
        area,
        title: `${topicTitle} - αίτημα υποστήριξης`,
        summary: form.message,
        priority: priorityByUrgency[form.urgency] || "normal",
        requesterEmail: form.email,
        relatedReference: form.reference || undefined,
        evidence: [
          form.reference ? `Δόθηκε κωδικός: ${form.reference}` : "Δεν δόθηκε κωδικός κράτησης ή πληρωμής",
          `Προτεραιότητα: ${form.urgency}`,
        ],
      });

      setCaseReference(supportCase.referenceId);
      setForm((current) => ({ ...current, reference: "", message: "" }));
    } catch {
      setCaseReference("");
      setSubmitError("Η υποστήριξη είναι προσωρινά μη διαθέσιμη. Το αίτημα δεν αποθηκεύτηκε τοπικά.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
  <div className="min-h-screen bg-background">
    <SEO
      title="Κέντρο υποστήριξης | Dikigoros"
      description="Ανοίξτε υπόθεση υποστήριξης για κρατήσεις, πληρωμές, επιστροφές, πρόσβαση λογαριασμού, έγγραφα, απόρρητο, ασφάλεια ή παράπονα."
      path="/help"
    />
    <Navbar />
    <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Κέντρο υποστήριξης</p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl tracking-tight text-foreground">Βοήθεια για κρατήσεις, πληρωμές, λογαριασμούς, έγγραφα και παράπονα</h1>
      <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">
        Επείγοντα προβλήματα κράτησης και πληρωμής μπαίνουν πρώτα. Αιτήματα απορρήτου, εγγράφων και παραπόνων δρομολογούνται στη σωστή λειτουργική ομάδα.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {supportTopics.map(({ icon: Icon, title, text }) => (
          <section key={title} className="rounded-lg border border-border bg-card p-5">
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-lg font-bold text-foreground">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{text}</p>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-bold text-foreground">Πώς δρομολογείται ένα αίτημα</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {supportFlow.map((item) => (
            <article key={item.title} className="rounded-lg border border-border bg-secondary/40 p-4">
              <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-bold text-foreground">Εσωτερικοί κανόνες χειρισμού</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Κάθε κατηγορία έχει υπεύθυνο, χρόνο απόκρισης, στοιχεία που χρειάζονται, αποτέλεσμα για τον χρήστη και κανόνα κλιμάκωσης.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {supportWorkflows.map((rule) => (
            <article key={rule.id} className="rounded-lg border border-border bg-secondary/35 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h3 className="text-sm font-bold text-foreground">{rule.label}</h3>
                <span className="rounded-full bg-card px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{rule.owner}</span>
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-wider text-primary">{rule.sla}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{rule.userFacingResponse}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">Στοιχεία: {rule.requiredEvidence.join(", ")}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">Κλιμάκωση: {rule.escalationRule}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">Κλείνει όταν: {rule.closeCondition}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-8 rounded-lg border border-border bg-secondary/40 p-5">
        <h2 className="text-lg font-bold text-foreground">Διαδρομές επικοινωνίας</h2>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground md:grid-cols-3">
          <p><span className="font-bold text-foreground">Πελάτες:</span> support@dikigoros.gr</p>
          <p><span className="font-bold text-foreground">Συνεργάτες:</span> partners@dikigoros.gr</p>
          <p><span className="font-bold text-foreground">Απόρρητο:</span> privacy@dikigoros.gr</p>
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-bold text-foreground">Άνοιγμα υπόθεσης υποστήριξης</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Χρησιμοποιήστε τη φόρμα για αποτυχίες κράτησης, θέματα πληρωμής, πρόσβαση λογαριασμού, ορατότητα εγγράφων, αιτήματα απορρήτου ή παράπονα.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-foreground">Τύπος θέματος</span>
            <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground">
              <option value="booking">Κράτηση ή αλλαγή</option>
              <option value="payment">Πληρωμή ή επιστροφή</option>
              <option value="account">Πρόσβαση λογαριασμού</option>
              <option value="documents">Έγγραφα ή απόρρητο</option>
              <option value="complaint">Παράπονο ή διαφωνία</option>
              <option value="security">Θέμα ασφάλειας</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-foreground">Προτεραιότητα</span>
            <select value={form.urgency} onChange={(event) => setForm((current) => ({ ...current, urgency: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground">
              <option value="urgent">Επείγον θέμα κράτησης/πληρωμής</option>
              <option value="normal">Κανονική υποστήριξη</option>
              <option value="privacy">Έλεγχος απορρήτου/ασφάλειας</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-foreground">Κωδικός κράτησης ή πληρωμής</span>
            <input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} placeholder="BK-..., INV-..., προαιρετικό" className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground" />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-foreground">Ηλεκτρονικό ταχυδρομείο</span>
            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required placeholder="you@example.com" className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-bold text-foreground">Τι συνέβη;</span>
            <textarea value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} required rows={4} placeholder="Περιγράψτε το θέμα και το επόμενο βήμα που χρειάζεστε." className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-3 text-sm font-medium text-foreground" />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={isSubmitting} className="rounded-lg font-bold">
              {isSubmitting ? "Καταχώριση..." : "Δημιουργία υπόθεσης"}
            </Button>
            {caseReference ? (
              <p className="mt-3 rounded-lg border border-sage/20 bg-sage/10 px-3 py-2 text-sm font-bold text-sage-foreground">
                Η υπόθεση καταχωρίστηκε: {caseReference}
              </p>
            ) : null}
            {submitError ? (
              <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
                {submitError}
              </p>
            ) : null}
          </div>
        </form>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild className="rounded-lg font-bold">
          <Link to="/account">
            Άνοιγμα λογαριασμού
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-lg font-bold">
          <Link to="/trust/payments-refunds">Κανόνες πληρωμών και επιστροφών</Link>
        </Button>
      </div>
    </main>
    <Footer />
  </div>
);
};

export default SupportCenter;
