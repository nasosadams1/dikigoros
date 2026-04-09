import { useState } from "react";
import { Link } from "react-router-dom";
import { Video, Phone, Users, ChevronLeft, ChevronRight, Check, ShieldCheck, Clock, Star, CalendarDays, Mail, MessageSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

const steps = ["Τύπος", "Ημερομηνία", "Στοιχεία", "Επιβεβαίωση"];

const consultationTypes = [
  { type: "Βιντεοκλήση", icon: Video, price: 60, duration: "30 λεπτά", desc: "Ασφαλής βιντεοκλήση μέσω της πλατφόρμας" },
  { type: "Τηλεφωνική Κλήση", icon: Phone, price: 50, duration: "30 λεπτά", desc: "Τηλεφωνική συνεδρία με τη δικηγόρο" },
  { type: "Αυτοπρόσωπα", icon: Users, price: 80, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο, Αθήνα" },
];

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

const dates = [
  { day: "Σήμ", date: "15", month: "Ιαν", full: "Τετάρτη, 15 Ιανουαρίου 2025" },
  { day: "Αύρ", date: "16", month: "Ιαν", full: "Πέμπτη, 16 Ιανουαρίου 2025" },
  { day: "Παρ", date: "17", month: "Ιαν", full: "Παρασκευή, 17 Ιανουαρίου 2025" },
  { day: "Σάβ", date: "18", month: "Ιαν", full: "Σάββατο, 18 Ιανουαρίου 2025" },
  { day: "Δευ", date: "20", month: "Ιαν", full: "Δευτέρα, 20 Ιανουαρίου 2025" },
  { day: "Τρί", date: "21", month: "Ιαν", full: "Τρίτη, 21 Ιανουαρίου 2025" },
  { day: "Τετ", date: "22", month: "Ιαν", full: "Τετάρτη, 22 Ιανουαρίου 2025" },
];

const Booking = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const canNext = () => {
    if (currentStep === 0) return selectedType !== null;
    if (currentStep === 1) return selectedDate !== null && selectedTime !== null;
    if (currentStep === 2) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="mx-auto max-w-2xl px-5 py-6 lg:py-10">
        {/* Back link */}
        <Link to="/lawyer/maria-papadopoulou" className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Πίσω στο προφίλ
        </Link>

        {/* Lawyer mini card */}
        <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face"
              alt="Μαρία Παπαδοπούλου"
              className="h-14 w-14 rounded-xl object-cover ring-2 ring-background shadow-md"
            />
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sage ring-2 ring-card">
              <CheckCircle2 className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <p className="font-sans text-[15px] font-bold text-foreground">Μαρία Παπαδοπούλου</p>
            <p className="text-xs font-medium text-muted-foreground">Οικογενειακό Δίκαιο · Αθήνα</p>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-gold text-gold" />
            <span className="font-bold text-foreground">4.9</span>
            <span className="hidden text-xs text-muted-foreground md:inline">(127)</span>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center">
            {steps.map((step, i) => (
              <div key={step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      i < currentStep
                        ? "bg-sage text-white shadow-md shadow-sage/30"
                        : i === currentStep
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`mt-2 text-xs font-semibold ${i === currentStep ? "text-foreground" : "text-muted-foreground"} hidden md:block`}>{step}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`mx-2 h-0.5 flex-1 rounded-full transition-colors ${i < currentStep ? "bg-sage" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[380px]">
          {/* Step 1: Consultation Type */}
          {currentStep === 0 && (
            <div>
              <h2 className="font-serif text-2xl tracking-tight text-foreground">Επιλέξτε τύπο ραντεβού</h2>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">Πώς θα θέλατε να μιλήσετε με τη δικηγόρο;</p>
              <div className="mt-5 space-y-3">
                {consultationTypes.map((c, i) => (
                  <button
                    key={c.type}
                    onClick={() => setSelectedType(i)}
                    className={`flex w-full items-center gap-4 rounded-xl border-2 p-5 text-left transition-all ${
                      selectedType === i
                        ? "border-primary bg-primary/[0.04] shadow-md shadow-primary/10"
                        : "border-border bg-card hover:border-foreground/20 hover:shadow-sm"
                    }`}
                  >
                    <div className={`flex h-13 w-13 items-center justify-center rounded-xl transition-all ${
                      selectedType === i ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-secondary text-foreground"
                    }`}>
                      <c.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[15px] font-bold text-foreground">{c.type}</p>
                      <p className="mt-0.5 text-xs font-medium text-muted-foreground">{c.desc}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-foreground">€{c.price}</p>
                      <p className="text-xs font-medium text-muted-foreground">{c.duration}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Date & Time */}
          {currentStep === 1 && (
            <div>
              <h2 className="font-serif text-2xl tracking-tight text-foreground">Επιλέξτε ημερομηνία & ώρα</h2>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                {selectedType !== null && <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 mr-2 text-xs font-bold text-foreground">{consultationTypes[selectedType].type} · €{consultationTypes[selectedType].price}</span>}
                Διαθέσιμες ημερομηνίες και ώρες
              </p>

              {/* Date picker */}
              <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
                {dates.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedDate(i); setSelectedTime(null); }}
                    className={`flex shrink-0 flex-col items-center rounded-xl border-2 px-4 py-3 transition-all ${
                      selectedDate === i
                        ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "border-border bg-card text-foreground hover:border-foreground/20"
                    }`}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wide opacity-70">{d.day}</span>
                    <span className="mt-0.5 text-xl font-bold">{d.date}</span>
                    <span className="text-[11px] font-medium opacity-70">{d.month}</span>
                  </button>
                ))}
              </div>

              {/* Time slots */}
              {selectedDate !== null ? (
                <div className="mt-5">
                  <p className="text-sm font-bold text-foreground">{dates[selectedDate].full}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-4">
                    {timeSlots.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`rounded-xl border-2 px-3 py-3 text-sm font-bold transition-all ${
                          selectedTime === time
                            ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                            : "border-border bg-card text-foreground hover:border-foreground/20"
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-8 rounded-xl border border-dashed border-border bg-secondary/40 p-8 text-center">
                  <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium text-muted-foreground">Επιλέξτε μία ημερομηνία για να δείτε τις διαθέσιμες ώρες</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Details */}
          {currentStep === 2 && (
            <div>
              <h2 className="font-serif text-2xl tracking-tight text-foreground">Πείτε μας λίγα λόγια</h2>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">Αυτά θα βοηθήσουν τη δικηγόρο να προετοιμαστεί</p>

              {/* Booking summary */}
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-secondary/60 px-4 py-3 text-xs font-semibold text-foreground">
                {selectedType !== null && (() => { const Icon = consultationTypes[selectedType].icon; return <span className="flex items-center gap-1"><Icon className="h-3.5 w-3.5" />{consultationTypes[selectedType].type}</span>; })()}
                <span className="h-3 w-px bg-border" />
                {selectedDate !== null && <span>{dates[selectedDate].full}</span>}
                <span className="h-3 w-px bg-border" />
                <span>{selectedTime}</span>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-sm font-bold text-foreground">Ονοματεπώνυμο</label>
                  <input
                    placeholder="π.χ. Γιώργος Νικολάου"
                    className="mt-1.5 h-12 w-full rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground">Email</label>
                  <input
                    type="email"
                    placeholder="π.χ. giorgos@email.com"
                    className="mt-1.5 h-12 w-full rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground">Τηλέφωνο</label>
                  <input
                    type="tel"
                    placeholder="π.χ. 6912345678"
                    className="mt-1.5 h-12 w-full rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground">Σύντομη περιγραφή θέματος <span className="font-medium text-muted-foreground">(προαιρετικό)</span></label>
                  <textarea
                    placeholder="Περιγράψτε σε λίγα λόγια το θέμα σας…"
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {currentStep === 3 && (
            <div className="text-center py-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sage/20 shadow-lg shadow-sage/10">
                <Check className="h-9 w-9 text-sage-foreground" />
              </div>
              <h2 className="mt-6 font-serif text-2xl tracking-tight text-foreground">Το ραντεβού σας κλείστηκε!</h2>
              <p className="mt-2 text-sm font-medium text-muted-foreground">Θα λάβετε email & SMS επιβεβαίωσης με όλες τις λεπτομέρειες</p>

              <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-border bg-card p-5 text-left shadow-md shadow-foreground/[0.03]">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-muted-foreground">Δικηγόρος</span>
                    <span className="font-bold text-foreground">Μαρία Παπαδοπούλου</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-muted-foreground">Τύπος</span>
                    <span className="font-bold text-foreground">{selectedType !== null ? consultationTypes[selectedType].type : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-muted-foreground">Ημερομηνία</span>
                    <span className="font-bold text-foreground">{selectedDate !== null ? dates[selectedDate].full : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-muted-foreground">Ώρα</span>
                    <span className="font-bold text-foreground">{selectedTime || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-muted-foreground">Διάρκεια</span>
                    <span className="font-bold text-foreground">{selectedType !== null ? consultationTypes[selectedType].duration : "—"}</span>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Κόστος</span>
                      <span className="text-xl font-bold text-foreground">€{selectedType !== null ? consultationTypes[selectedType].price : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* What happens next */}
              <div className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Τι ακολουθεί</p>
                <div className="flex items-start gap-2.5 text-sm">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                  <span className="text-muted-foreground">Θα λάβετε <span className="font-semibold text-foreground">email επιβεβαίωσης</span> με link για τη συνεδρία</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                  <span className="text-muted-foreground">Θα λάβετε <span className="font-semibold text-foreground">SMS υπενθύμιση</span> 1 ώρα πριν</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                  <span className="text-muted-foreground"><span className="font-semibold text-foreground">Δωρεάν ακύρωση</span> μέχρι 24 ώρες πριν</span>
                </div>
              </div>

              <div className="mt-8">
                <Link to="/">
                  <Button className="w-full max-w-sm rounded-xl font-bold">Επιστροφή στην Αρχική</Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        {currentStep < 3 && (
          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="text-sm font-bold"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Πίσω
            </Button>
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canNext()}
              className="rounded-xl px-8 text-sm font-bold shadow-lg shadow-primary/20 disabled:shadow-none"
            >
              {currentStep === 2 ? "Ολοκλήρωση Κράτησης" : "Συνέχεια"} <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Reassurance */}
        {currentStep < 3 && (
          <div className="mt-5 flex items-center justify-center gap-5 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-sage" /> Ασφαλής κράτηση</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-sage" /> Δωρεάν ακύρωση 24ω</span>
            <span className="hidden items-center gap-1.5 md:flex"><Mail className="h-3.5 w-3.5 text-sage" /> Επιβεβαίωση email & SMS</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Booking;
