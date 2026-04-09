import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Star, Clock, ShieldCheck, SlidersHorizontal, Video, Phone, Users, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const allLawyers = [
  {
    id: "maria-papadopoulou",
    name: "Μαρία Παπαδοπούλου",
    specialty: "Οικογενειακό Δίκαιο",
    city: "Αθήνα",
    rating: 4.9,
    reviews: 127,
    experience: 14,
    price: 60,
    available: "Σήμερα, 14:00",
    response: "< 1 ώρα",
    types: ["Video", "Τηλέφωνο"],
    bio: "Εξειδίκευση σε διαζύγια, επιμέλεια τέκνων και οικογενειακές διαφορές.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face",
  },
  {
    id: "nikos-antoniou",
    name: "Νίκος Αντωνίου",
    specialty: "Εργατικό Δίκαιο",
    city: "Θεσσαλονίκη",
    rating: 4.8,
    reviews: 94,
    experience: 18,
    price: 50,
    available: "Αύριο, 10:00",
    response: "< 2 ώρες",
    types: ["Video", "Αυτοπρόσωπα"],
    bio: "Εξειδίκευση σε απολύσεις, αποζημιώσεις, συμβάσεις εργασίας.",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face",
  },
  {
    id: "eleni-karagianni",
    name: "Ελένη Καραγιάννη",
    specialty: "Ακίνητα & Μισθώσεις",
    city: "Αθήνα",
    rating: 4.9,
    reviews: 156,
    experience: 21,
    price: 70,
    available: "Σήμερα, 16:30",
    response: "< 30 λεπτά",
    types: ["Video", "Τηλέφωνο", "Αυτοπρόσωπα"],
    bio: "Εξειδίκευση σε αγοραπωλησίες ακινήτων, μισθώσεις και διαφορές.",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face",
  },
  {
    id: "konstantinos-panou",
    name: "Κωνσταντίνος Πάνου",
    specialty: "Ποινικό Δίκαιο",
    city: "Αθήνα",
    rating: 4.7,
    reviews: 83,
    experience: 22,
    price: 80,
    available: "Αύριο, 09:00",
    response: "< 3 ώρες",
    types: ["Τηλέφωνο", "Αυτοπρόσωπα"],
    bio: "Εξειδίκευση σε ποινική υπεράσπιση, παραστάσεις σε δικαστήρια.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
  },
  {
    id: "sofia-dimitriou",
    name: "Σοφία Δημητρίου",
    specialty: "Κληρονομικό Δίκαιο",
    city: "Πάτρα",
    rating: 4.9,
    reviews: 112,
    experience: 16,
    price: 55,
    available: "Σήμερα, 11:00",
    response: "< 1 ώρα",
    types: ["Video", "Τηλέφωνο"],
    bio: "Εξειδίκευση σε κληρονομικά, διαθήκες, αποδοχή κληρονομιάς.",
    image: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=400&h=400&fit=crop&crop=face",
  },
  {
    id: "andreas-georgiou",
    name: "Ανδρέας Γεωργίου",
    specialty: "Εμπορικό Δίκαιο",
    city: "Θεσσαλονίκη",
    rating: 4.6,
    reviews: 67,
    experience: 12,
    price: 65,
    available: "Αύριο, 13:00",
    response: "< 2 ώρες",
    types: ["Video", "Αυτοπρόσωπα"],
    bio: "Εξειδίκευση σε εμπορικές συμβάσεις, εταιρικό δίκαιο, διαφορές.",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
  },
];

const SearchResults = () => {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Sticky Search */}
      <div className="sticky top-16 z-40 border-b border-border bg-card/95 backdrop-blur-md lg:top-[72px]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3.5 lg:px-8">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              defaultValue="Οικογενειακό Δίκαιο"
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
            />
          </div>
          <div className="relative hidden md:block md:w-48">
            <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              defaultValue="Αθήνα"
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
            />
          </div>
          <Button className="h-11 rounded-xl px-6 text-sm font-bold">Αναζήτηση</Button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground md:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8 lg:py-8">
        <div className="lg:flex lg:gap-8">
          {/* Filters Sidebar */}
          <aside className={`${showFilters ? "block" : "hidden"} mb-6 shrink-0 lg:block lg:w-60`}>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-sm font-bold text-foreground">Φίλτρα</h3>
                <button className="text-xs font-medium text-primary hover:underline">Καθαρισμός</button>
              </div>

              <div className="mt-5 space-y-5">
                {[
                  { label: "Ειδικότητα", options: ["Οικογενειακό", "Εργατικό", "Ακίνητα", "Ποινικό", "Κληρονομικό", "Εμπορικό"] },
                  { label: "Τύπος Ραντεβού", options: ["Video", "Τηλέφωνο", "Αυτοπρόσωπα"] },
                  { label: "Πόλη", options: ["Αθήνα", "Θεσσαλονίκη", "Πάτρα", "Ηράκλειο"] },
                ].map((filter) => (
                  <div key={filter.label}>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{filter.label}</label>
                    <div className="mt-2.5 space-y-2">
                      {filter.options.map((opt) => (
                        <label key={opt} className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
                          <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Τιμή</label>
                  <div className="mt-2.5 space-y-2">
                    {["€30 – €50", "€50 – €80", "€80 – €120", "€120+"].map((p) => (
                      <label key={p} className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
                        <input type="radio" name="price" className="h-4 w-4 border-border accent-primary" />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1">
            {/* Sort & Count */}
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{allLawyers.length}</span> δικηγόροι βρέθηκαν
              </p>
              <select className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option>Προτεινόμενοι</option>
                <option>Υψηλότερη Αξιολόγηση</option>
                <option>Χαμηλότερη Τιμή</option>
                <option>Περισσότερη Εμπειρία</option>
                <option>Ταχύτερη Απάντηση</option>
              </select>
            </div>

            {/* Lawyer Cards */}
            <div className="space-y-4">
              {allLawyers.map((lawyer) => (
                <div
                  key={lawyer.id}
                  className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-xl hover:shadow-foreground/[0.06] hover:border-border/80"
                >
                  <div className="p-5 md:p-6">
                    <div className="flex flex-col gap-5 md:flex-row md:items-start">
                      {/* Portrait */}
                      <div className="relative shrink-0">
                        <img
                          src={lawyer.image}
                          alt={lawyer.name}
                          className="h-24 w-24 rounded-2xl object-cover ring-2 ring-background shadow-lg md:h-28 md:w-28"
                        />
                        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sage ring-2 ring-card">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-sans text-lg font-bold text-foreground">{lawyer.name}</h3>
                            <p className="mt-0.5 text-sm font-semibold text-primary/80">{lawyer.specialty}</p>
                            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{lawyer.city} · {lawyer.experience} χρόνια εμπειρίας</p>
                          </div>
                          <div className="hidden text-right md:block">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Από</p>
                            <p className="text-2xl font-bold text-foreground">€{lawyer.price}</p>
                            <p className="text-xs text-muted-foreground">ανά συνεδρία</p>
                          </div>
                        </div>

                        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{lawyer.bio}</p>

                        {/* Key signals row */}
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                            <Star className="h-4 w-4 fill-gold text-gold" />
                            {lawyer.rating}
                            <span className="font-normal text-muted-foreground text-xs">({lawyer.reviews})</span>
                          </span>
                          <span className="h-3.5 w-px bg-border" />
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            Απάντηση {lawyer.response}
                          </span>
                          <span className="h-3.5 w-px bg-border" />
                          <div className="flex gap-1.5">
                            {lawyer.types.map((t) => (
                              <span key={t} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground/70">{t}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom bar */}
                  <div className="flex items-center justify-between border-t border-border bg-secondary/40 px-5 py-3.5 md:px-6">
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold text-foreground md:hidden">€{lawyer.price}</p>
                      <div className="flex items-center gap-1.5 rounded-full bg-sage/15 px-3 py-1 text-xs font-semibold text-sage-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-sage animate-pulse" />
                        Επόμενο: {lawyer.available}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Link to={`/lawyer/${lawyer.id}`}>
                        <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold h-9 px-4">
                          Προφίλ
                        </Button>
                      </Link>
                      <Link to={`/booking/${lawyer.id}`}>
                        <Button size="sm" className="rounded-xl text-xs font-bold h-9 px-5">
                          Κλείσε Ραντεβού
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default SearchResults;
