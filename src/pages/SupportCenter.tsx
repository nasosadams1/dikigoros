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
  { icon: CalendarX, title: "Booking failures", text: "Slot conflicts, lawyer cancellations, reschedules, no-shows, and urgent consultation changes." },
  { icon: CreditCard, title: "Payment failures", text: "Interrupted checkout, duplicate charge concern, refund eligibility, receipt access, and payment confirmation." },
  { icon: KeyRound, title: "Account access", text: "Sign-in, profile, consultation history, saved lawyers, comparison lists, and payment-method access." },
  { icon: FileText, title: "Documents", text: "Visibility to a booked lawyer, deletion requests, document download, and privacy request routing." },
  { icon: MessageSquareWarning, title: "Complaints", text: "Review disputes, conduct concerns, profile accuracy, booking disagreement, and support escalation." },
  { icon: ShieldAlert, title: "Security or privacy", text: "Sensitive legal data concern, incident report, data request, account deletion, and access review." },
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
    const supportCase = createOperationalCase({
      area,
      title: `${supportTopics.find((topic) => topic.title.toLowerCase().includes(form.type))?.title || "Support"} request`,
      summary: form.message,
      priority: priorityByUrgency[form.urgency] || "normal",
      requesterEmail: form.email,
      relatedReference: form.reference || undefined,
      evidence: [
        form.reference ? `Reference supplied: ${form.reference}` : "No booking or payment reference supplied",
        `Urgency: ${form.urgency}`,
      ],
    });

    setCaseReference(supportCase.referenceId);
    setForm((current) => ({ ...current, reference: "", message: "" }));
  };

  return (
  <div className="min-h-screen bg-background">
    <SEO
      title="Support center | Dikigoros"
      description="Open a support case for bookings, payments, refunds, account access, documents, privacy requests, security concerns, or complaints."
      path="/help"
    />
    <Navbar />
    <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Support center</p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl tracking-tight text-foreground">Help for bookings, payments, accounts, documents, and complaints</h1>
      <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">
        Urgent booking and payment problems are prioritized first. Privacy, document, and complaint requests are routed to the correct support path.
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
        <h2 className="text-lg font-bold text-foreground">Contact paths</h2>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground md:grid-cols-3">
          <p><span className="font-bold text-foreground">Clients:</span> support@dikigoros.gr</p>
          <p><span className="font-bold text-foreground">Partners:</span> partners@dikigoros.gr</p>
          <p><span className="font-bold text-foreground">Privacy:</span> privacy@dikigoros.gr</p>
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-bold text-foreground">Open a support case</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use this for booking failures, payment issues, account access, document visibility, privacy requests, or complaints.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-foreground">Issue type</span>
            <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground">
              <option value="booking">Booking or reschedule</option>
              <option value="payment">Payment or refund</option>
              <option value="account">Account access</option>
              <option value="documents">Documents or privacy</option>
              <option value="complaint">Complaint or dispute</option>
              <option value="security">Security concern</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-foreground">Urgency</span>
            <select value={form.urgency} onChange={(event) => setForm((current) => ({ ...current, urgency: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground">
              <option value="urgent">Urgent booking/payment issue</option>
              <option value="normal">Normal support</option>
              <option value="privacy">Privacy/security review</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-foreground">Booking or payment reference</span>
            <input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} placeholder="BK-..., INV-..., optional" className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground" />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-foreground">Email</span>
            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required placeholder="you@example.com" className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-bold text-foreground">What happened?</span>
            <textarea value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} required rows={4} placeholder="Describe the issue and the next step you need." className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-3 text-sm font-medium text-foreground" />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" className="rounded-lg font-bold">Create case</Button>
            {caseReference ? (
              <p className="mt-3 rounded-lg border border-sage/20 bg-sage/10 px-3 py-2 text-sm font-bold text-sage-foreground">
                Case received: {caseReference}
              </p>
            ) : null}
          </div>
        </form>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild className="rounded-lg font-bold">
          <Link to="/account">
            Open account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-lg font-bold">
          <Link to="/trust/payments-refunds">Payment and refund rules</Link>
        </Button>
      </div>
    </main>
    <Footer />
  </div>
);
};

export default SupportCenter;
