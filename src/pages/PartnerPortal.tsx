import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MessageSquareQuote,
  Settings2,
  ShieldCheck,
  Star,
  UserRoundCog,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import PartnerShell from "@/components/partner/PartnerShell";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Ραντεβού", icon: CalendarDays, active: true },
  { label: "Διαθεσιμότητα", icon: Clock3, active: false },
  { label: "Προφίλ", icon: UserRoundCog, active: false },
  { label: "Κριτικές", icon: MessageSquareQuote, active: false },
  { label: "Ρυθμίσεις", icon: Settings2, active: false },
];

const appointments = [
  { client: "Μαρία Παπαδοπούλου", topic: "Συμβουλευτική οικογενειακού δικαίου", time: "Σήμερα | 14:00", type: "Βίντεο" },
  { client: "Δημήτρης Κ.", topic: "Έλεγχος κληρονομικής υπόθεσης", time: "Σήμερα | 17:30", type: "Τηλέφωνο" },
  { client: "Ιωάννα Σ.", topic: "Στρατηγική για διαφορά μίσθωσης", time: "Αύριο | 11:00", type: "Δια ζώσης" },
];

const availability = [
  { day: "Δευ", status: "09:00 - 17:00", tone: "Ανοιχτό" },
  { day: "Τρι", status: "10:00 - 18:00", tone: "Ανοιχτό" },
  { day: "Τετ", status: "Δικαστήριο - περιορισμένο", tone: "Περιορισμένο" },
  { day: "Πεμ", status: "09:30 - 16:30", tone: "Ανοιχτό" },
];

const PartnerPortal = () => {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email || "partner@lawfirm.gr";

  return (
    <PartnerShell>
      <section className="grid gap-6 xl:grid-cols-[0.28fr_0.72fr]">
        <aside className="partner-dark-panel p-6 sm:p-7">
          <div className="partner-dark-card-featured p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--partner-gold))]">Κατάσταση Χώρου</p>
            <h1 className="mt-4 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ivory))]">Το portal είναι έτοιμο</h1>
            <p className="mt-3 text-sm leading-7 text-white/72">Ο επιβεβαιωμένος χώρος εργασίας σας είναι έτοιμος.</p>
          </div>

          <nav className="mt-6 space-y-2">
            {navItems.map(({ label, icon: Icon, active }) => (
              <button
                key={label}
                type="button"
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  active ? "bg-white/12 text-white" : "text-white/68 hover:bg-white/6 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-[hsl(var(--partner-gold))]" : "text-white/55"}`} />
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-6 grid gap-3">
            <div className="partner-dark-card p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--partner-gold))]" />
                <div>
                  <p className="text-sm font-semibold text-white">Η ασφαλής πρόσβαση επιβεβαιώθηκε</p>
                  <p className="mt-1 text-sm leading-6 text-white/68">{email}</p>
                </div>
              </div>
            </div>
            <div className="partner-dark-card p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Λειτουργία συνεργάτη</p>
              <p className="mt-3 text-sm font-semibold text-white">Ραντεβού, διαθεσιμότητα, προφίλ</p>
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="partner-panel overflow-hidden p-7 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="partner-kicker">Πίνακας Συνεργάτη</p>
                <h2 className="mt-4 font-serif text-[2.6rem] leading-[1.02] tracking-[-0.03em] text-[hsl(var(--partner-ink))]">
                  Ένας ήρεμος επαγγελματικός χώρος για ραντεβού, διαθεσιμότητα και φήμη.
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">Ξεκινήστε από τα σημερινά ραντεβού και τις διαθέσιμες ώρες σας.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[340px]">
                <div className="partner-soft-card-strong p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Επόμενο ραντεβού</p>
                  <p className="mt-3 text-lg font-semibold text-[hsl(var(--partner-ink))]">14:00</p>
                  <p className="mt-1 text-sm text-muted-foreground">Βιντεοκλήση οικογενειακού δικαίου</p>
                </div>
                <div className="partner-soft-card p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Κατάσταση προφίλ</p>
                  <p className="mt-3 text-lg font-semibold text-[hsl(var(--partner-ink))]">94%</p>
                  <p className="mt-1 text-sm text-muted-foreground">Ισχυρή ετοιμότητα προφίλ.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="partner-panel p-7 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="partner-kicker">Ραντεβού</p>
                  <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Σήμερα και μετά</h3>
                </div>
                <Button variant="outline" className="rounded-xl border-[hsl(var(--partner-line))] bg-white/70 text-[hsl(var(--partner-ink))] hover:bg-white">
                  Προβολή ημερολογίου
                </Button>
              </div>

              <div className="mt-6 space-y-4">
                {appointments.map((appointment) => (
                  <div key={`${appointment.client}-${appointment.time}`} className="rounded-[1.4rem] border border-[hsl(var(--partner-line))] bg-white/65 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-[hsl(var(--partner-ink))]">{appointment.client}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{appointment.topic}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-semibold text-[hsl(var(--partner-navy-soft))]">{appointment.time}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{appointment.type}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="partner-panel p-7">
                <p className="partner-kicker">Διαθεσιμότητα</p>
                <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--partner-ink))]">Διαθέσιμες ώρες</h3>
                <div className="mt-6 space-y-3">
                  {availability.map((slot) => (
                    <div key={slot.day} className="flex items-center justify-between rounded-2xl border border-[hsl(var(--partner-line))] bg-white/65 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">{slot.day}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{slot.status}</p>
                      </div>
                      <span className={`partner-chip ${slot.tone === "Ανοιχτό" ? "partner-chip-active" : ""}`}>{slot.tone}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="partner-panel p-7">
                <p className="partner-kicker">Κριτικές & Ρυθμίσεις</p>
                <div className="mt-5 grid gap-4">
                  <div className="partner-soft-card p-4">
                    <div className="flex items-center gap-3">
                      <Star className="h-5 w-5 text-[hsl(var(--gold))]" />
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Βαθμολογία πελατών</p>
                        <p className="mt-1 text-sm text-muted-foreground">Μέσος όρος 4.9.</p>
                      </div>
                    </div>
                  </div>
                  <div className="partner-soft-card p-4">
                    <div className="flex items-center gap-3">
                      <BellRing className="h-5 w-5 text-[hsl(var(--partner-navy-soft))]" />
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Ειδοποιήσεις</p>
                        <p className="mt-1 text-sm text-muted-foreground">Ενεργές για κρατήσεις και μηνύματα.</p>
                      </div>
                    </div>
                  </div>
                  <div className="partner-soft-card-strong p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-[hsl(var(--sage))]" />
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--partner-ink))]">Ποιότητα προφίλ</p>
                        <p className="mt-1 text-sm text-muted-foreground">Επαληθευμένο και πλήρες.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </PartnerShell>
  );
};

export default PartnerPortal;
