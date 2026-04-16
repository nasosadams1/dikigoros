import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileSearch,
  MessageSquareReply,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";

const roiPoints = [
  "Fewer irrelevant requests",
  "Better-qualified first consultations",
  "Availability and booking control",
  "Stronger public trust signals",
  "Review credibility tied to completed bookings",
];

const firmTools = [
  { icon: UsersRound, title: "Public profile", text: "Specialties, languages, prices, trust checks, and decision-ready consultation details." },
  { icon: CalendarClock, title: "Availability control", text: "Published booking windows, working days, buffers, and consultation modes." },
  { icon: FileSearch, title: "Booking management", text: "Confirmed consultations, client context, completion status, and payment visibility." },
  { icon: MessageSquareReply, title: "Review handling", text: "Moderated published reviews, reply handling, and proof tied to completed bookings." },
  { icon: ShieldCheck, title: "Request handling", text: "Readiness checks and controlled public status before marketplace visibility." },
  { icon: TrendingUp, title: "Partner dashboard", text: "A single workspace for profile, availability, bookings, documents, payments, and reviews." },
];

const plans = [
  {
    name: "Solo",
    commercial: "Per completed first consultation",
    bestFor: "Independent lawyers building predictable consultation flow.",
    includes: ["Public profile", "Availability manager", "Booking management", "Review system"],
  },
  {
    name: "Growth",
    commercial: "Lower platform fee with monthly minimum",
    bestFor: "High-intent practices that want more discovery and stronger trust proof.",
    includes: ["Everything in Solo", "Priority category review", "Profile optimization support", "Extra intake fields"],
  },
  {
    name: "Team",
    commercial: "Firm agreement",
    bestFor: "Small firms with multiple lawyers, seats, or managed intake needs.",
    includes: ["Everything in Growth", "Extra seats", "Team onboarding", "Commercial reporting"],
  },
];

const addOns = ["Premium placement", "Extra seat", "Branded intake/profile tools", "Payment tools", "Onboarding support"];

const onboardingSteps = [
  {
    title: "Application",
    text: "Expected time: 8-12 minutes. We ask for contact, practice, bar association, registration, specialties, and verification documents.",
  },
  {
    title: "Review checks",
    text: "Identity, license, professional details, bar association, and basic readiness are checked before public visibility.",
  },
  {
    title: "Profile readiness",
    text: "Your public profile needs clear specialties, consultation options, prices, availability, and preparation guidance.",
  },
  {
    title: "Controlled launch",
    text: "Approved partners can manage availability, receive bookings, handle reviews, and adjust public details from the dashboard.",
  },
];

const ForLawyersLanding = () => {
  return (
    <PartnerShell>
      <SEO
        title="For lawyers and firms | Dikigoros"
        description="Join a verified legal marketplace with qualified consultations, availability control, booking management, review credibility, and clear commercial plans."
        path="/for-lawyers"
      />
      <div className="space-y-5">
        <section className="partner-panel p-7 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="max-w-[780px]">
              <p className="partner-kicker">For lawyers and firms</p>
              <h1 className="mt-4 max-w-[780px] font-serif text-[2.8rem] leading-[1.02] tracking-[-0.035em] text-[hsl(var(--partner-ink))] sm:text-[3.2rem] lg:text-[3.5rem]">
                More qualified consultations. Less intake noise.
              </h1>
              <p className="mt-4 max-w-[64ch] text-[15px] leading-6 text-muted-foreground">
                Dikigoros is built around public trust, real availability, and booking-backed reviews so clients can compare confidently before they reserve a first consultation.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-[50px] rounded-[8px] bg-[hsl(var(--partner-navy))] px-5 text-sm font-semibold text-white hover:bg-[hsl(var(--partner-navy))]/94">
                  <Link to="/for-lawyers/apply">
                    Apply to join
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-[50px] rounded-[8px] border-[hsl(var(--partner-line))] bg-white px-5 text-sm font-semibold text-[hsl(var(--partner-ink))] hover:bg-white">
                  <Link to="/for-lawyers/login">Partner login</Link>
                </Button>
              </div>
            </div>

            <aside className="partner-soft-card-strong p-5">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--partner-navy-soft))]">What improves ROI</p>
              <div className="mt-4 space-y-3">
                {roiPoints.map((point) => (
                  <p key={point} className="flex items-start gap-3 text-sm font-semibold leading-6 text-[hsl(var(--partner-ink))]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--partner-navy))]" />
                    {point}
                  </p>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="partner-panel p-7 lg:p-8">
          <div className="max-w-[720px]">
            <p className="partner-kicker">What firms get</p>
            <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
              Marketplace tools that turn trust into bookings
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {firmTools.map(({ icon: Icon, title, text }) => (
              <div key={title} className="partner-soft-card p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[hsl(var(--partner-navy))] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="partner-dark-panel p-7">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/58">Commercial model</p>
            <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-white">
              Pay per completed first consultation, then add growth tools when needed.
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/70">
              The default model aligns platform revenue with delivered first consultations. Larger firms can move to a monthly minimum or firm agreement when volume and support needs justify it.
            </p>
            <div className="mt-5 rounded-[8px] border border-white/10 bg-white/8 p-4">
              <p className="text-sm font-semibold text-white">Future add-ons</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {addOns.map((item) => (
                  <span key={item} className="rounded-[8px] bg-white/10 px-3 py-1 text-xs font-semibold text-white/78">{item}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className="partner-panel p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[hsl(var(--partner-navy-soft))]">{plan.name}</p>
                <h3 className="mt-3 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{plan.commercial}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.bestFor}</p>
                <ul className="mt-4 space-y-2">
                  {plan.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                      <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-[hsl(var(--partner-navy))]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="partner-panel p-7 lg:p-8">
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="partner-kicker">Controlled onboarding</p>
              <h2 className="mt-3 font-sans text-[30px] font-semibold leading-tight tracking-[-0.02em] text-[hsl(var(--partner-ink))]">
                Clear checks, less mystery, faster readiness
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The review gate protects clients, partners, and the review system. It also keeps the public marketplace from becoming a generic directory.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {onboardingSteps.map((step, index) => (
                <div key={step.title} className="partner-soft-card p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-[hsl(var(--partner-navy))] text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-[hsl(var(--partner-ink))]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PartnerShell>
  );
};

export default ForLawyersLanding;
