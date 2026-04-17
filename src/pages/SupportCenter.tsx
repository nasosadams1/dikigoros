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
import type { OperationalArea } from "@/lib/operations";

const supportTopics = [
  { type: "booking", icon: CalendarX, title: "Αποτυχίες κράτησης", text: "Σύγκρουση ώρας, ακύρωση δικηγόρου, αλλαγή ραντεβού, μη εμφάνιση και επείγουσες αλλαγές συμβουλευτικής." },
  { type: "payment", icon: CreditCard, title: "Προβλήματα πληρωμής", text: "Διακοπή ροής πληρωμής, πιθανή διπλή χρέωση, επιλεξιμότητα επιστροφής, πρόσβαση απόδειξης και επιβεβαίωση πληρωμής." },
  { type: "account", icon: KeyRound, title: "Πρόσβαση λογαριασμού", text: "Σύνδεση, προφίλ, ιστορικό ραντεβού, αποθηκευμένοι δικηγόροι, λίστες σύγκρισης και μέθοδος πληρωμής." },
  { type: "documents", icon: FileText, title: "Έγγραφα", text: "Ορατότητα σε δικηγόρο κρατημένου ραντεβού, αιτήματα διαγραφής, λήψη εγγράφων και διαδρομή αιτήματος απορρήτου." },
  { type: "complaint", icon: MessageSquareWarning, title: "Παράπονα", text: "Διαφωνίες αξιολόγησης, θέματα συμπεριφοράς, ακρίβεια προφίλ, διαφωνία κράτησης και κλιμάκωση υποστήριξης." },
  { type: "security", icon: ShieldAlert, title: "Ασφάλεια ή απόρρητο", text: "Ανησυχία για ευαίσθητα νομικά δεδομένα, αναφορά περιστατικού, αίτημα δεδομένων, διαγραφή λογαριασμού και έλεγχος πρόσβασης." },
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
  const [form, setForm] = useState({
    type: "booking",
    urgency: "normal",
    reference: "",
    email: "",
    message: "",
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const area = areaBySupportType[form.type] || "support";
    const topicTitle = supportTopics.find((topic) => topic.type === form.type)?.title || "Υποστήριξη";
    const supportCase = createOperationalCase({
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
            <span className="text-sm font-bold text-foreground">Email</span>
            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required placeholder="you@example.com" className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-bold text-foreground">Τι συνέβη;</span>
            <textarea value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} required rows={4} placeholder="Περιγράψτε το θέμα και το επόμενο βήμα που χρειάζεστε." className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-3 text-sm font-medium text-foreground" />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" className="rounded-lg font-bold">Δημιουργία υπόθεσης</Button>
            {caseReference ? (
              <p className="mt-3 rounded-lg border border-sage/20 bg-sage/10 px-3 py-2 text-sm font-bold text-sage-foreground">
                Η υπόθεση καταχωρίστηκε: {caseReference}
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
