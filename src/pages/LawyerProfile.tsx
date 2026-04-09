import { Link } from "react-router-dom";
import { Star, Clock, ShieldCheck, MapPin, Briefcase, Video, Phone, Users, CheckCircle2, ArrowRight, Award, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const lawyer = {
  name: "Μαρία Παπαδοπούλου",
  specialty: "Οικογενειακό Δίκαιο",
  bestFor: "Ιδανική για διαζύγια, επιμέλεια τέκνων και οικογενειακές περιουσιακές διαφορές.",
  city: "Αθήνα",
  rating: 4.9,
  reviews: 127,
  experience: 14,
  response: "< 1 ώρα",
  available: "Σήμερα, 14:00",
  image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=600&fit=crop&crop=face",
  bio: "Η Μαρία Παπαδοπούλου είναι δικηγόρος με 14 χρόνια εμπειρίας στο οικογενειακό δίκαιο. Εξειδικεύεται σε υποθέσεις διαζυγίου, επιμέλειας τέκνων, διατροφής, και οικογενειακών διαφορών. Έχει χειριστεί πάνω από 500 υποθέσεις με επιτυχία.",
  education: "Νομική Σχολή Αθηνών · Μεταπτυχιακό Οικογενειακού Δικαίου, Πανεπιστήμιο Αθηνών",
  languages: ["Ελληνικά", "Αγγλικά", "Γαλλικά"],
  specialties: ["Διαζύγιο", "Επιμέλεια Τέκνων", "Διατροφή", "Περιουσιακές Διαφορές", "Ενδοοικογενειακή Βία"],
  credentials: ["Μέλος Δ.Σ. Αθηνών", "500+ υποθέσεις", "Πιστοποιημένη Διαμεσολαβήτρια"],
  consultations: [
    { type: "Βιντεοκλήση", icon: Video, price: 60, duration: "30 λεπτά" },
    { type: "Τηλεφωνική Κλήση", icon: Phone, price: 50, duration: "30 λεπτά" },
    { type: "Αυτοπρόσωπα", icon: Users, price: 80, duration: "45 λεπτά" },
  ],
};

const reviews = [
  { name: "Αλεξάνδρα Μ.", rating: 5, date: "Νοέμβριος 2024", text: "Εξαιρετική δικηγόρος. Με καθοδήγησε σε κάθε βήμα του διαζυγίου μου. Πολύ επαγγελματική και ανθρώπινη.", type: "Βιντεοκλήση" },
  { name: "Δημήτρης Π.", rating: 5, date: "Οκτώβριος 2024", text: "Πολύ γρήγορη απάντηση, ξεκάθαρες εξηγήσεις. Ένιωσα σιγουριά από την πρώτη στιγμή.", type: "Τηλεφωνική" },
  { name: "Ιωάννα Κ.", rating: 4, date: "Σεπτέμβριος 2024", text: "Βοηθήθηκα πολύ με το θέμα επιμέλειας. Ευχαριστώ πολύ για τη βοήθεια.", type: "Αυτοπρόσωπα" },
];

const LawyerProfile = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8 lg:py-8">
        <div className="lg:flex lg:gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Profile Hero */}
            <div className="rounded-2xl border border-border bg-card p-6 md:p-7">
              <div className="flex flex-col gap-5 md:flex-row md:items-start">
                <div className="relative">
                  <img
                    src={lawyer.image}
                    alt={lawyer.name}
                    className="h-32 w-32 rounded-2xl object-cover ring-2 ring-background shadow-xl md:h-36 md:w-36"
                  />
                  <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-sage ring-3 ring-card">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2.5">
                    <h1 className="font-serif text-2xl tracking-tight text-foreground md:text-[1.75rem]">{lawyer.name}</h1>
                  </div>
                  <p className="mt-1 text-[15px] font-bold text-primary/80">{lawyer.specialty}</p>
                  
                  {/* Best-for positioning line */}
                  <p className="mt-2 text-[13px] font-semibold text-foreground/60 leading-relaxed">
                    {lawyer.bestFor}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] font-semibold text-foreground/60">
                    <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{lawyer.city}</span>
                    <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" />{lawyer.experience} χρόνια</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />Απάντηση {lawyer.response}</span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Star className="h-5 w-5 fill-gold text-gold" />
                    <span className="text-xl font-bold text-foreground">{lawyer.rating}</span>
                    <span className="text-sm font-semibold text-foreground/50">({lawyer.reviews} αξιολογήσεις)</span>
                  </div>

                  {/* Credentials strip */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lawyer.credentials.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 rounded-lg bg-primary/[0.06] px-2.5 py-1 text-[11px] font-bold text-primary">
                        <Award className="h-3 w-3" />{c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="mt-5 text-[14px] leading-relaxed text-foreground/60 border-t border-border pt-5">{lawyer.bio}</p>
            </div>

            {/* Specialties */}
            <div className="mt-7">
              <h2 className="font-serif text-xl tracking-tight text-foreground">Εξειδίκευση</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {lawyer.specialties.map((s) => (
                  <span key={s} className="rounded-lg border border-border bg-secondary px-3.5 py-1.5 text-[13px] font-bold text-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Consultation Types */}
            <div className="mt-8">
              <h2 className="font-serif text-xl tracking-tight text-foreground">Τύποι Ραντεβού & Τιμές</h2>
              <div className="mt-3 space-y-2.5">
                {lawyer.consultations.map((c) => (
                  <div key={c.type} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md hover:shadow-foreground/[0.03]">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                        <c.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[15px] font-bold text-foreground">{c.type}</p>
                        <p className="text-xs font-semibold text-foreground/50">Διάρκεια: {c.duration}</p>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-foreground">€{c.price}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Education & Languages */}
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div>
                <h2 className="font-serif text-xl tracking-tight text-foreground">Σπουδές</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-foreground/55">{lawyer.education}</p>
              </div>
              <div>
                <h2 className="font-serif text-xl tracking-tight text-foreground">Γλώσσες</h2>
                <div className="mt-2 flex gap-2">
                  {lawyer.languages.map((l) => (
                    <span key={l} className="rounded-lg bg-secondary px-3 py-1.5 text-[13px] font-bold text-foreground">{l}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Reviews */}
            <div className="mt-8">
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-xl tracking-tight text-foreground">Αξιολογήσεις</h2>
                <div className="flex items-center gap-1.5 text-sm">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                  <span className="font-bold text-foreground">{lawyer.rating}</span>
                  <span className="text-foreground/50 font-semibold">· {lawyer.reviews} αξιολογήσεις</span>
                </div>
              </div>
              <div className="mt-3 space-y-2.5">
                {reviews.map((r, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-serif text-sm font-bold">
                          {r.name[0]}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-foreground">{r.name}</p>
                          <p className="text-[11px] font-semibold text-foreground/40">{r.type} · {r.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: r.rating }).map((_, j) => (
                          <Star key={j} className="h-3.5 w-3.5 fill-gold text-gold" />
                        ))}
                      </div>
                    </div>
                    <p className="mt-3 text-[14px] leading-relaxed text-foreground/70">{r.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ */}
            <div className="mt-8">
              <h2 className="font-serif text-xl tracking-tight text-foreground">Συχνές Ερωτήσεις</h2>
              <Accordion type="single" collapsible className="mt-3 space-y-2">
                {[
                  { q: "Πώς γίνεται η βιντεοκλήση;", a: "Μετά την κράτηση, θα λάβετε ένα ασφαλές link για βιντεοκλήση στο email σας. Δεν χρειάζεται εγκατάσταση εφαρμογής." },
                  { q: "Μπορώ να ακυρώσω το ραντεβού;", a: "Ναι, μπορείτε να ακυρώσετε δωρεάν μέχρι 24 ώρες πριν το ραντεβού." },
                  { q: "Τι πρέπει να ετοιμάσω;", a: "Ετοιμάστε μια σύντομη περιγραφή του θέματός σας και τυχόν σχετικά έγγραφα. Η δικηγόρος θα σας καθοδηγήσει." },
                ].map((faq, i) => (
                  <AccordionItem key={i} value={`pfaq-${i}`} className="rounded-xl border border-border bg-card px-5">
                    <AccordionTrigger className="py-4 text-left font-sans text-[15px] font-bold text-foreground hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-[13px] leading-relaxed text-foreground/55">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>

          {/* Sticky Booking Card */}
          <aside className="mt-6 shrink-0 lg:sticky lg:top-24 lg:mt-0 lg:w-80 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xl shadow-foreground/[0.06]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">Κλείστε Ραντεβού</p>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-[1.75rem] font-bold text-foreground">από €{lawyer.consultations[1].price}</span>
                <span className="text-[13px] font-semibold text-foreground/40">/ συνεδρία</span>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-sage" />
                  Πιστοποιημένη δικηγόρος
                </div>
                <div className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground">
                  <Clock className="h-4 w-4 text-sage" />
                  Απάντηση {lawyer.response}
                </div>
                <div className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                  {lawyer.rating} ({lawyer.reviews} αξιολογήσεις)
                </div>
                <div className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-sage" />
                  Δωρεάν ακύρωση 24ω πριν
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-sage/10 p-3">
                <p className="text-[11px] font-bold text-sage-foreground">Επόμενη διαθεσιμότητα</p>
                <p className="mt-0.5 text-[15px] font-bold text-foreground">{lawyer.available}</p>
              </div>

              <Link to="/booking/maria-papadopoulou">
                <Button className="mt-4 h-12 w-full rounded-xl text-[15px] font-bold">
                  Κλείσε Ραντεβού
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <div className="mt-3 flex flex-col items-center gap-1 text-[11px] text-foreground/40 font-semibold">
                <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Ασφαλής κράτηση</span>
                <span>Επιβεβαίωση μέσω email & SMS</span>
              </div>
            </div>

            {/* Mobile Sticky CTA */}
            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card px-4 py-3 shadow-2xl shadow-foreground/10 lg:hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-foreground">από €{lawyer.consultations[1].price}</p>
                  <p className="text-[11px] font-semibold text-foreground/50">ανά συνεδρία</p>
                </div>
                <Link to="/booking/maria-papadopoulou">
                  <Button className="rounded-xl px-6 font-bold">
                    Κλείσε Ραντεβού
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="pb-20 lg:pb-0">
        <Footer />
      </div>
    </div>
  );
};

export default LawyerProfile;
