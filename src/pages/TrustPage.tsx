import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CheckCircle2, CreditCard, FileText, LockKeyhole, MessageSquareWarning, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";

const trustPages = {
  "/trust/verification-standards": {
    icon: ShieldCheck,
    eyebrow: "Verification standards",
    title: "What verified means",
    intro: "Verified means the public profile passed partner checks before marketplace visibility. It does not guarantee a legal outcome.",
    sections: [
      ["What we check", "Identity, license, professional details, bar association, practice information, consultation setup, and public profile readiness."],
      ["What it does not mean", "It is not a guarantee of case result, legal strategy, or client-lawyer fit. Clients still compare experience, price, availability, and reviews."],
      ["Operations", "Applications can be approved, rejected, retried with missing evidence, suspended, or removed when readiness or conduct rules are not met."],
    ],
  },
  "/trust/reviews-policy": {
    icon: Star,
    eyebrow: "Review policy",
    title: "Who can review and when reviews go live",
    intro: "Reviews are connected to completed bookings so public proof follows actual consultations.",
    sections: [
      ["Who can review", "Clients with completed bookings can submit ratings for overall experience, clarity, and responsiveness, plus a written review."],
      ["Moderation rules", "Reviews can be blocked for abuse, private case details, conflicts of interest, fraud signals, or content unrelated to the consultation."],
      ["Disputes and replies", "Lawyers can reply publicly and raise disputes. The platform can hold, hide, or remove reviews after moderation."],
    ],
  },
  "/trust/payments-refunds": {
    icon: CreditCard,
    eyebrow: "Payments and refunds",
    title: "Payment timing, cancellations, refunds",
    intro: "Booking commitment is tied to a Stripe-backed payment step before the consultation is treated as paid.",
    sections: [
      ["Payment timing", "The first consultation is paid during checkout. Card data is handled by Stripe-hosted payment flow."],
      ["Cancellation rules", "Clients can cancel or reschedule free up to 24 hours before the slot. Late cancellation, lawyer cancellation, no-show, and slot-conflict cases go to support review."],
      ["Refund handling", "Eligible refunds are routed through the original payment method. Failed or interrupted payments show a human-readable support path."],
    ],
  },
  "/trust/privacy-documents": {
    icon: FileText,
    eyebrow: "Privacy and documents",
    title: "Document visibility and deletion basics",
    intro: "Legal documents should be shared only when needed for a booked consultation or support request.",
    sections: [
      ["Visibility", "Uploaded documents are visible to the selected lawyer only when the client marks them visible for a related booking."],
      ["Retention and deletion", "Clients can request deletion or access workflows. Retention depends on account, booking, payment, support, and legal obligations."],
      ["Privacy requests", "Account data, document access, and deletion requests route through privacy support for review and confirmation."],
    ],
  },
  "/trust/support-complaints": {
    icon: MessageSquareWarning,
    eyebrow: "Support and complaints",
    title: "Booking, payment, and conduct support",
    intro: "Support paths cover urgent booking issues, payment failures, account access, complaints, and moderation questions.",
    sections: [
      ["Response standards", "Urgent booking or payment failures are prioritized. General account and policy questions are routed by issue type."],
      ["Complaint paths", "Clients and lawyers can raise complaints about booking disputes, review moderation, profile accuracy, payment handling, or document access."],
      ["Resolution rules", "Support may request evidence, freeze disputed publication, coordinate reschedule/refund handling, or escalate privacy/security issues."],
    ],
  },
  "/trust/security": {
    icon: LockKeyhole,
    eyebrow: "Secure client handling",
    title: "Sensitive legal data controls",
    intro: "Security controls focus on payment consistency, privacy handling, incident response, and restricted access to sensitive legal/customer data.",
    sections: [
      ["Payment consistency", "Payment claims must match the Stripe-backed checkout flow and account payment records."],
      ["Access controls", "Client documents and booking records should be visible only to the user, the selected lawyer, and authorized support workflows."],
      ["Incident handling", "Security or privacy incidents require triage, containment, user communication, and operational review."],
    ],
  },
} as const;

const TrustPage = () => {
  const location = useLocation();
  const page = trustPages[location.pathname as keyof typeof trustPages] || trustPages["/trust/verification-standards"];
  const Icon = page.icon;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${page.eyebrow} | Dikigoros`}
        description={page.intro}
        path={location.pathname}
      />
      <Navbar />
      <main className="mx-auto max-w-5xl px-5 py-12 lg:px-8 lg:py-16">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
          <Icon className="h-4 w-4" />
          {page.eyebrow}
        </p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl tracking-tight text-foreground">{page.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{page.intro}</p>

        <div className="mt-8 grid gap-4">
          {page.sections.map(([title, text]) => (
            <section key={title} className="rounded-lg border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <CheckCircle2 className="h-5 w-5 text-sage" />
                {title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{text}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="rounded-lg font-bold">
            <Link to="/search">
              Find a lawyer
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg font-bold">
            <Link to="/help">Open support center</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TrustPage;
