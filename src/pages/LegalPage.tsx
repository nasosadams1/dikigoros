import { Link, useLocation } from "react-router-dom";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";

const pages = {
  "/terms": {
    eyebrow: "Όροι χρήσης",
    title: "Καθαροί κανόνες για κρατήσεις και συνεργασία",
    intro:
      "Το Dikigoros βοηθά χρήστες να βρουν δικηγόρο, να κλείσουν ραντεβού και να οργανώσουν την υπόθεσή τους. Η τελική νομική συμβουλή παρέχεται από τον εκάστοτε δικηγόρο.",
    sections: [
      "Οι κρατήσεις επιβεβαιώνονται μόνο όταν δημιουργείται επαληθευμένη εγγραφή στην πλατφόρμα.",
      "Οι πληρωμές ολοκληρώνονται μέσω Stripe Checkout και δεν συλλέγουμε στοιχεία κάρτας στην εφαρμογή.",
      "Οι κριτικές δημοσιεύονται μόνο μετά από ολοκληρωμένο επαληθευμένο ραντεβού.",
    ],
  },
  "/privacy": {
    eyebrow: "Πολιτική απορρήτου",
    title: "Τα δεδομένα υπόθεσης μένουν ιδιωτικά",
    intro:
      "Συλλέγουμε τα ελάχιστα απαραίτητα στοιχεία για λογαριασμό, κρατήσεις, πληρωμές και ασφαλή διαμοιρασμό εγγράφων με δικηγόρους που έχετε επιλέξει.",
    sections: [
      "Τα έγγραφα είναι ορατά σε δικηγόρο μόνο όταν τα αφήνετε ορατά και συνδέονται με σχετική κράτηση.",
      "Τα στοιχεία πληρωμής συλλέγονται και προστατεύονται από φιλοξενούμενες ροές Stripe.",
      "Μπορείτε να αλλάξετε ειδοποιήσεις, προτιμήσεις και ορατότητα εγγράφων από τον λογαριασμό σας.",
    ],
  },
  "/contact": {
    eyebrow: "Επικοινωνία",
    title: "Μιλήστε με την ομάδα υποστήριξης",
    intro:
      "Για θέματα λογαριασμού, συνεργασίες δικηγόρων ή ερωτήσεις απορρήτου, επικοινωνήστε με την ομάδα Dikigoros.",
    sections: [
      "Υποστήριξη χρηστών: support@dikigoros.gr",
      "Συνεργασίες δικηγόρων: partners@dikigoros.gr",
      "Απόρρητο και ασφάλεια: privacy@dikigoros.gr",
    ],
  },
} as const;

const LegalPage = () => {
  const location = useLocation();
  const page = pages[location.pathname as keyof typeof pages] || pages["/terms"];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-5 py-14 lg:px-8 lg:py-20">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">{page.eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight text-foreground">{page.title}</h1>
        <p className="mt-4 text-base leading-8 text-muted-foreground">{page.intro}</p>
        <div className="mt-8 space-y-3">
          {page.sections.map((section) => (
            <div key={section} className="rounded-lg border border-border bg-card p-4 text-sm leading-6 text-foreground">
              {section}
            </div>
          ))}
        </div>
        <Button asChild className="mt-8 rounded-lg font-bold">
          <Link to="/account">Επιστροφή στο προφίλ</Link>
        </Button>
      </main>
      <Footer />
    </div>
  );
};

export default LegalPage;
