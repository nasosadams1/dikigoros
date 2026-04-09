import { Link } from "react-router-dom";
import { Search, MapPin, Star, Clock, ShieldCheck, ChevronRight, CheckCircle2, Quote, Users, Heart, Home, Scale, FileText, Briefcase, TrendingUp, Video, Phone, ArrowRight, Award, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const categories = [
  { name: "Οικογενειακό Δίκαιο", desc: "Διαζύγια, επιμέλεια, διατροφή", icon: Heart },
  { name: "Εργατικό Δίκαιο", desc: "Απολύσεις, αποζημιώσεις, συμβάσεις", icon: Briefcase },
  { name: "Ακίνητα & Μισθώσεις", desc: "Αγοραπωλησίες, ενοικιάσεις, διαφορές", icon: Home },
  { name: "Ποινικό Δίκαιο", desc: "Υπεράσπιση, παραστάσεις, προσφυγές", icon: Scale },
  { name: "Κληρονομικό Δίκαιο", desc: "Διαθήκες, αποδοχή, αποποίηση", icon: FileText },
  { name: "Εμπορικό Δίκαιο", desc: "Εταιρείες, συμβάσεις, διαφορές", icon: TrendingUp },
];

const featuredLawyers = [
  {
    name: "Μαρία Παπαδοπούλου",
    specialty: "Οικογενειακό Δίκαιο",
    bestFor: "Διαζύγια & επιμέλεια τέκνων",
    city: "Αθήνα",
    rating: 4.9,
    reviews: 127,
    experience: 14,
    price: 60,
    available: "Σήμερα",
    response: "< 1 ώρα",
    types: ["Video", "Τηλέφωνο"],
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face",
  },
  {
    name: "Νίκος Αντωνίου",
    specialty: "Εργατικό Δίκαιο",
    bestFor: "Απολύσεις & εργατικές διαφορές",
    city: "Θεσσαλονίκη",
    rating: 4.8,
    reviews: 94,
    experience: 18,
    price: 50,
    available: "Αύριο",
    response: "< 2 ώρες",
    types: ["Video", "Αυτοπρόσωπα"],
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face",
  },
  {
    name: "Ελένη Καραγιάννη",
    specialty: "Ακίνητα & Μισθώσεις",
    bestFor: "Αγοραπωλησίες & μισθωτικές διαφορές",
    city: "Αθήνα",
    rating: 4.9,
    reviews: 156,
    experience: 21,
    price: 70,
    available: "Σήμερα",
    response: "< 30 λεπτά",
    types: ["Video", "Τηλέφωνο", "Αυτοπρόσωπα"],
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face",
  },
];

const testimonials = [
  {
    text: "Βρήκα δικηγόρο για το διαζύγιό μου σε λιγότερο από μία ώρα. Η διαδικασία ήταν απίστευτα απλή και η δικηγόρος εξαιρετική.",
    name: "Κατερίνα Μ.",
    location: "Αθήνα",
    rating: 5,
    issue: "Οικογενειακό Δίκαιο",
  },
  {
    text: "Μετά από χρόνια αβεβαιότητας με τον εργοδότη μου, βρήκα επιτέλους κάποιον που με βοήθησε. Η κράτηση έγινε μέσα σε 2 λεπτά.",
    name: "Γιώργος Δ.",
    location: "Θεσσαλονίκη",
    rating: 5,
    issue: "Εργατικό Δίκαιο",
  },
  {
    text: "Χρειαζόμουν βοήθεια με κληρονομικό θέμα. Η πλατφόρμα μου επέτρεψε να συγκρίνω δικηγόρους και να διαλέξω τον καλύτερο.",
    name: "Δημήτρης Κ.",
    location: "Πάτρα",
    rating: 5,
    issue: "Κληρονομικό Δίκαιο",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/60 to-background" />
        <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-10 lg:px-8 lg:pb-14 lg:pt-12">
          <div className="lg:flex lg:items-center lg:gap-12">
            {/* Left: Copy + Search */}
            <div className="flex-1 lg:max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold text-foreground shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-sage" />
                Πιστοποιημένο δίκτυο 500+ δικηγόρων σε όλη την Ελλάδα
              </div>
              <h1 className="mt-5 font-serif text-[2.75rem] leading-[1.08] tracking-tight text-foreground md:text-[3.5rem] lg:text-[3.75rem]">
                Βρες τον σωστό{" "}
                <br className="hidden md:block" />
                δικηγόρο.{" "}
                <span className="text-muted-foreground">Κλείσε{" "}
                <br className="hidden lg:block" />
                ραντεβού σήμερα.</span>
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-foreground/70 md:text-base">
                Σύγκρινε πιστοποιημένους δικηγόρους ανά ειδικότητα, αξιολογήσεις, διαθεσιμότητα και τιμή. Κλείσε βιντεοκλήση, τηλεφωνικό ή αυτοπρόσωπο ραντεβού σε λιγότερο από 2 λεπτά.
              </p>

              {/* Search Card */}
              <div className="mt-7 lg:mt-8">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-xl shadow-foreground/[0.06] md:p-5">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Αναζήτηση Δικηγόρου</p>
                  <div className="grid gap-2.5 md:grid-cols-3 md:gap-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                      <input
                        placeholder="Νομικό θέμα (π.χ. διαζύγιο)"
                        className="h-[52px] w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                      />
                    </div>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                      <input
                        placeholder="Πόλη (π.χ. Αθήνα)"
                        className="h-[52px] w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                      />
                    </div>
                    <Link to="/search">
                      <Button className="h-[52px] w-full rounded-xl text-[15px] font-bold tracking-wide">
                        Αναζήτηση
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Trust indicators */}
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 md:gap-x-8">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-sage" />
                  Πιστοποιημένοι
                </span>
                <span className="hidden h-4 w-px bg-border md:block" />
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                  <Star className="h-4 w-4 fill-gold text-gold" />
                  4.8+ αξιολόγηση
                </span>
                <span className="hidden h-4 w-px bg-border md:block" />
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                  <Clock className="h-4 w-4 text-sage" />
                  Ραντεβού εντός 24ω
                </span>
              </div>
            </div>

            {/* Right: Featured Lawyer Preview — hero signature element */}
            <div className="hidden lg:block lg:w-[340px] xl:w-[380px]">
              <div className="relative">
                {/* Main featured card */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-foreground/[0.08]">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={featuredLawyers[0].image}
                      alt={featuredLawyers[0].name}
                      className="h-16 w-16 rounded-2xl object-cover ring-2 ring-background shadow-md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-foreground">{featuredLawyers[0].name}</p>
                      <p className="text-xs font-medium text-muted-foreground">{featuredLawyers[0].specialty} · {featuredLawyers[0].city}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                        <span className="text-xs font-bold text-foreground">{featuredLawyers[0].rating}</span>
                        <span className="text-[11px] text-muted-foreground">({featuredLawyers[0].reviews})</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-sage/10 px-3.5 py-2.5">
                    <div>
                      <p className="text-[11px] font-bold text-sage-foreground">Διαθέσιμη σήμερα</p>
                      <p className="text-sm font-bold text-foreground">14:00, 15:30, 17:00</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-sage animate-pulse" />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-foreground">από €{featuredLawyers[0].price}</span>
                    <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Κλείσε Ραντεβού</span>
                  </div>
                </div>

                {/* Micro social proof cluster */}
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg shadow-foreground/[0.04]">
                  <div className="flex -space-x-2">
                    {featuredLawyers.map((l, i) => (
                      <img key={i} src={l.image} alt="" className="h-8 w-8 rounded-full border-2 border-card object-cover" />
                    ))}
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-foreground">127 ραντεβού αυτή την εβδομάδα</p>
                    <p className="text-[11px] text-muted-foreground">στην Αθήνα & Θεσσαλονίκη</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="bg-primary">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-5 py-5 text-center md:grid-cols-4 lg:px-8">
          {[
            { value: "500+", label: "Πιστοποιημένοι Δικηγόροι" },
            { value: "15.000+", label: "Ολοκληρωμένα Ραντεβού" },
            { value: "4.8/5", label: "Μέση Αξιολόγηση" },
            { value: "45+", label: "Πόλεις στην Ελλάδα" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-serif text-2xl text-primary-foreground md:text-3xl">{stat.value}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Lawyers */}
      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-sage">Κορυφαίοι Επαγγελματίες</p>
            <h2 className="mt-1.5 font-serif text-[1.75rem] tracking-tight text-foreground md:text-[2.25rem]">Κορυφαίοι Δικηγόροι</h2>
            <p className="mt-1 text-sm text-foreground/60">Υψηλά αξιολογημένοι από πραγματικούς πελάτες</p>
          </div>
          <Link to="/search" className="hidden items-center gap-1.5 text-sm font-bold text-foreground hover:text-primary md:flex">
            Δες Όλους <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featuredLawyers.map((lawyer) => (
            <Link
              key={lawyer.name}
              to="/lawyer/maria-papadopoulou"
              className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-xl hover:shadow-foreground/[0.07] hover:border-primary/15"
            >
              {/* Top section */}
              <div className="p-5 pb-3">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <img
                      src={lawyer.image}
                      alt={lawyer.name}
                      className="h-[72px] w-[72px] rounded-2xl object-cover ring-2 ring-background shadow-lg"
                    />
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sage ring-2 ring-card">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="truncate font-sans text-[15px] font-bold text-foreground">{lawyer.name}</h3>
                    <p className="mt-0.5 text-[13px] font-semibold text-primary/80">{lawyer.specialty}</p>
                    <p className="mt-0.5 text-xs text-foreground/50">{lawyer.city} · {lawyer.experience} χρόνια εμπειρίας</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-gold text-gold" />
                      <span className="text-sm font-bold text-foreground">{lawyer.rating}</span>
                      <span className="text-xs text-foreground/50">({lawyer.reviews} αξιολογήσεις)</span>
                    </div>
                  </div>
                </div>
                {/* Best-for line */}
                <p className="mt-3 text-xs font-semibold text-foreground/60">
                  <span className="text-sage">Ιδανική για:</span> {lawyer.bestFor}
                </p>
              </div>

              {/* Meta bar */}
              <div className="mx-5 flex items-center gap-3 border-t border-border pt-3 pb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/60">
                  <Clock className="h-3.5 w-3.5" />
                  {lawyer.response}
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex gap-1.5">
                  {lawyer.types.map((t) => (
                    <span key={t} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-bold text-foreground/60">{t}</span>
                  ))}
                </div>
              </div>

              {/* Bottom section */}
              <div className="flex items-center justify-between bg-secondary/60 px-5 py-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Από</span>
                  <span className="ml-1.5 text-lg font-bold text-foreground">€{lawyer.price}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-sage/15 px-3 py-1 text-xs font-bold text-sage-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-sage animate-pulse" />
                  Διαθέσιμος: {lawyer.available}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center md:hidden">
          <Link to="/search">
            <Button variant="outline" className="rounded-xl font-bold">Δες Όλους τους Δικηγόρους</Button>
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-sage">Τομείς Δικαίου</p>
            <h2 className="mt-1.5 font-serif text-[1.75rem] tracking-tight text-foreground md:text-[2.25rem]">Δημοφιλείς Κατηγορίες</h2>
          </div>
          <div className="mx-auto grid max-w-4xl gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                to="/search"
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-lg hover:shadow-foreground/[0.05] hover:border-primary/20"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <cat.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-sans text-[14px] font-bold text-foreground group-hover:text-primary transition-colors">{cat.name}</h3>
                  <p className="mt-0.5 text-xs text-foreground/50">{cat.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-foreground/25 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-sage">Απλή Διαδικασία</p>
          <h2 className="mt-1.5 font-serif text-[1.75rem] tracking-tight text-foreground md:text-[2.25rem]">Πώς Λειτουργεί</h2>
        </div>
        <div className="mx-auto grid max-w-4xl gap-0 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Περιγράψτε το θέμα σας",
              desc: "Αναζητήστε ανά κατηγορία δικαίου, τοποθεσία και τύπο ραντεβού.",
            },
            {
              step: "02",
              title: "Επιλέξτε δικηγόρο",
              desc: "Δείτε προφίλ, αξιολογήσεις, εμπειρία, τιμές και διαθεσιμότητα.",
            },
            {
              step: "03",
              title: "Κλείστε ραντεβού",
              desc: "Video, τηλεφωνικό ή αυτοπρόσωπο ραντεβού σε λιγότερο από 2 λεπτά.",
            },
          ].map((item, idx) => (
            <div key={item.step} className="relative text-center px-6 py-6">
              {idx < 2 && <div className="absolute right-0 top-1/2 hidden h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-border to-transparent md:block" style={{ left: '50%', width: '100%' }} />}
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
                <span className="font-serif text-lg text-primary-foreground">{item.step}</span>
              </div>
              <h3 className="mt-4 font-sans text-[15px] font-bold text-foreground">{item.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/55">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials — redesigned for premium feel */}
      <section className="border-y border-border bg-primary">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary-foreground/40">Αληθινές Ιστορίες</p>
            <h2 className="mt-1.5 font-serif text-[1.75rem] tracking-tight text-primary-foreground md:text-[2.25rem]">Τι Λένε οι Πελάτες</h2>
          </div>
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="relative rounded-2xl bg-primary-foreground/[0.08] border border-primary-foreground/[0.08] p-6 backdrop-blur-sm">
                <Quote className="h-8 w-8 text-gold/60 mb-3" />
                <p className="text-[15px] leading-relaxed text-primary-foreground font-medium">{t.text}</p>
                <div className="mt-5 flex items-center gap-3 border-t border-primary-foreground/10 pt-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-primary-foreground font-serif text-sm font-bold">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary-foreground">{t.name}</p>
                    <p className="text-[11px] font-semibold text-primary-foreground/50">{t.location} · {t.issue}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-0.5">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-gold text-gold" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-14">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-sage">Γιατί Εμάς</p>
          <h2 className="mt-1.5 font-serif text-[1.75rem] tracking-tight text-foreground md:text-[2.25rem]">Γιατί το Dikigoros</h2>
        </div>
        <div className="mx-auto grid max-w-4xl gap-3 md:grid-cols-2">
          {[
            { icon: ShieldCheck, title: "Πιστοποιημένο Δίκτυο", desc: "Κάθε δικηγόρος ελέγχεται, επαληθεύεται και αξιολογείται πριν ενταχθεί στην πλατφόρμα." },
            { icon: Star, title: "Πραγματικές Αξιολογήσεις", desc: "Όλες οι αξιολογήσεις προέρχονται από πραγματικά ραντεβού. Καμία ψεύτικη κριτική." },
            { icon: Zap, title: "Γρήγορη Απάντηση", desc: "Οι δικηγόροι μας απαντούν εντός ωρών, όχι ημερών. Πολλοί διαθέσιμοι αυθημερόν." },
            { icon: Users, title: "Εύκολη Σύγκριση", desc: "Συγκρίνετε ειδικότητα, εμπειρία, τιμές, αξιολογήσεις και διαθεσιμότητα σε μία οθόνη." },
          ].map((item) => (
            <div key={item.title} className="flex gap-4 rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md hover:shadow-foreground/[0.04]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-sans text-[15px] font-bold text-foreground">{item.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground/55">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-3xl px-5 py-12 lg:px-8 lg:py-14">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-sage">Βοήθεια</p>
            <h2 className="mt-1.5 font-serif text-[1.75rem] tracking-tight text-foreground md:text-[2.25rem]">Συχνές Ερωτήσεις</h2>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {[
              { q: "Πώς επιλέγονται οι δικηγόροι στην πλατφόρμα;", a: "Κάθε δικηγόρος περνάει από αυστηρή διαδικασία πιστοποίησης. Ελέγχουμε άδεια ασκήσεως, εμπειρία, αξιολογήσεις και επαγγελματικό ιστορικό πριν εγκρίνουμε κάποιον στο δίκτυό μας." },
              { q: "Πόσο κοστίζει μια συμβουλή;", a: "Οι τιμές ξεκινούν από €30 και ορίζονται από κάθε δικηγόρο ξεχωριστά. Μπορείτε να δείτε τις ακριβείς τιμές στο προφίλ κάθε δικηγόρου πριν κλείσετε ραντεβού." },
              { q: "Μπορώ να κάνω video ραντεβού;", a: "Ναι. Προσφέρουμε τρεις τύπους ραντεβού: βιντεοκλήση, τηλεφωνική κλήση και αυτοπρόσωπη συνάντηση. Μπορείτε να φιλτράρετε τους δικηγόρους ανά διαθέσιμο τύπο ραντεβού." },
              { q: "Τι γίνεται αν δεν μείνω ικανοποιημένος;", a: "Η ικανοποίησή σας είναι η προτεραιότητά μας. Αν αντιμετωπίσετε οποιοδήποτε πρόβλημα, η ομάδα υποστήριξης είναι διαθέσιμη να σας βοηθήσει." },
              { q: "Πώς κλείνω ραντεβού;", a: "Βρείτε τον δικηγόρο που σας ταιριάζει, επιλέξτε τύπο ραντεβού, ημερομηνία και ώρα, και ολοκληρώστε την κράτηση σε λιγότερο από 2 λεπτά." },
            ].map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="rounded-xl border border-border bg-card px-5">
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
      </section>

      {/* CTA Banner */}
      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="rounded-2xl bg-primary px-8 py-10 text-center lg:px-16 lg:py-12">
          <h2 className="font-serif text-[1.75rem] tracking-tight text-primary-foreground md:text-[2.25rem]">
            Βρες τον δικηγόρο που χρειάζεσαι
          </h2>
          <p className="mx-auto mt-2.5 max-w-lg text-[15px] text-primary-foreground/60">
            Σύγκρινε πιστοποιημένους δικηγόρους και κλείσε ραντεβού σε λιγότερο από 2 λεπτά.
          </p>
          <Link to="/search">
            <Button size="lg" variant="secondary" className="mt-6 rounded-xl px-8 font-bold">
              Ξεκίνα Αναζήτηση
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
