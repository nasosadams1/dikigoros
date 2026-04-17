import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CheckCircle2, CreditCard, FileText, LockKeyhole, MessageSquareWarning, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";

const trustPages = {
  "/trust/verification-standards": {
    icon: ShieldCheck,
    eyebrow: "Πρότυπα επαλήθευσης",
    title: "Τι σημαίνει επαληθευμένο προφίλ",
    intro: "Επαληθευμένο σημαίνει ότι ο φάκελος συνεργάτη πέρασε έλεγχο πριν εμφανιστεί δημόσια στην αγορά. Δεν είναι εγγύηση αποτελέσματος υπόθεσης.",
    sections: [
      ["Τι ελέγχουμε", "Ταυτότητα, άδεια άσκησης, δικηγορικό σύλλογο, βασικά επαγγελματικά στοιχεία, στοιχεία πρακτικής, τρόπους συμβουλευτικής, τιμές και ετοιμότητα δημόσιου προφίλ."],
      ["Τι δεν σημαίνει", "Δεν εγγυάται αποτέλεσμα υπόθεσης, στρατηγική ή τελική καταλληλότητα. Ο πελάτης συγκρίνει ακόμη εμπειρία, τιμή, διαθεσιμότητα και αξιολογήσεις."],
      ["Τι γίνεται επιχειρησιακά", "Αιτήσεις εγκρίνονται, απορρίπτονται, επιστρέφουν για στοιχεία, παγώνουν ή αφαιρούνται όταν δεν τηρούνται οι κανόνες ετοιμότητας ή συμπεριφοράς."],
    ],
  },
  "/trust/reviews-policy": {
    icon: Star,
    eyebrow: "Πολιτική αξιολογήσεων",
    title: "Ποιος αξιολογεί και πότε δημοσιεύεται η κριτική",
    intro: "Οι αξιολογήσεις συνδέονται με ολοκληρωμένες κρατήσεις ώστε η δημόσια απόδειξη να ακολουθεί πραγματική συμβουλευτική.",
    sections: [
      ["Ποιος μπορεί να αξιολογήσει", "Πελάτες με ολοκληρωμένο και επαληθευμένο ραντεβού μπορούν να βαθμολογήσουν συνολική εμπειρία, σαφήνεια και ανταπόκριση, και να γράψουν κριτική."],
      ["Κανόνες ελέγχου", "Κριτικές μπλοκάρονται ή κρατούνται όταν περιέχουν καταχρηστικό περιεχόμενο, ιδιωτικά στοιχεία υπόθεσης, σύγκρουση συμφερόντων, ένδειξη απάτης ή άσχετο περιεχόμενο."],
      ["Ενστάσεις και απαντήσεις", "Ο δικηγόρος μπορεί να απαντήσει δημόσια ή να ζητήσει έλεγχο. Η πλατφόρμα μπορεί να κρατήσει, κρύψει ή αφαιρέσει κριτική μετά από έλεγχο περιεχομένου."],
    ],
  },
  "/trust/payments-refunds": {
    icon: CreditCard,
    eyebrow: "Πληρωμές και επιστροφές",
    title: "Πότε πληρώνετε, πότε ακυρώνετε, πότε επιστρέφονται χρήματα",
    intro: "Η εμπορική δέσμευση της κράτησης συνδέεται με ασφαλή ροή Stripe πριν το ραντεβού θεωρηθεί πληρωμένο.",
    sections: [
      ["Χρόνος πληρωμής", "Η πρώτη συμβουλευτική πληρώνεται σε ασφαλή ροή Stripe. Τα στοιχεία κάρτας χειρίζονται από φιλοξενούμενη ροή Stripe και δεν πληκτρολογούνται μέσα στην εφαρμογή."],
      ["Κανόνες ακύρωσης", "Ο πελάτης μπορεί να ακυρώσει ή να αλλάξει δωρεάν έως 24 ώρες πριν. Εκπρόθεσμη ακύρωση, ακύρωση δικηγόρου, μη εμφάνιση ή σύγκρουση ώρας περνά σε έλεγχο υποστήριξης."],
      ["Εκτέλεση επιστροφής", "Επιλέξιμες επιστροφές στέλνονται στην αρχική μέθοδο πληρωμής. Αποτυχημένη ή διακοπείσα πληρωμή εμφανίζει καθαρή διαδρομή υποστήριξης και δεν αφήνει τεχνικό αδιέξοδο."],
    ],
  },
  "/trust/privacy-documents": {
    icon: FileText,
    eyebrow: "Απόρρητο και έγγραφα",
    title: "Ορατότητα εγγράφων και αιτήματα διαγραφής",
    intro: "Τα νομικά έγγραφα κοινοποιούνται μόνο όταν χρειάζονται για κράτηση ή αίτημα υποστήριξης.",
    sections: [
      ["Ορατότητα", "Τα ανεβασμένα έγγραφα είναι ορατά στον επιλεγμένο δικηγόρο μόνο όταν ο πελάτης τα αφήσει ορατά για συνδεδεμένο ραντεβού."],
      ["Διατήρηση και διαγραφή", "Ο πελάτης μπορεί να ζητήσει πρόσβαση ή διαγραφή. Η διατήρηση εξαρτάται από λογαριασμό, κράτηση, πληρωμή, υποστήριξη και νόμιμες υποχρεώσεις."],
      ["Αιτήματα απορρήτου", "Αιτήματα για δεδομένα λογαριασμού, πρόσβαση εγγράφων ή διαγραφή δρομολογούνται σε υποστήριξη απορρήτου για έλεγχο και επιβεβαίωση."],
    ],
  },
  "/trust/support-complaints": {
    icon: MessageSquareWarning,
    eyebrow: "Υποστήριξη και παράπονα",
    title: "Υποστήριξη για κρατήσεις, πληρωμές και συμπεριφορά",
    intro: "Οι διαδρομές υποστήριξης καλύπτουν επείγοντα προβλήματα κράτησης, αποτυχίες πληρωμής, πρόσβαση λογαριασμού, παράπονα και ερωτήσεις ελέγχου περιεχομένου.",
    sections: [
      ["Προτεραιότητες απάντησης", "Επείγουσα αποτυχία κράτησης ή πληρωμής μπαίνει πρώτη. Γενικές ερωτήσεις λογαριασμού και πολιτικής δρομολογούνται ανά τύπο θέματος."],
      ["Διαδρομές παραπόνων", "Πελάτες και δικηγόροι μπορούν να ανοίξουν παράπονο για διαφωνία κράτησης, έλεγχο αξιολόγησης, ακρίβεια προφίλ, χειρισμό πληρωμής ή πρόσβαση εγγράφων."],
      ["Κανόνες επίλυσης", "Η υποστήριξη μπορεί να ζητήσει στοιχεία, να παγώσει επίμαχη δημοσίευση, να συντονίσει αλλαγή/επιστροφή ή να κλιμακώσει θέμα απορρήτου και ασφάλειας."],
    ],
  },
  "/trust/security": {
    icon: LockKeyhole,
    eyebrow: "Ασφαλής χειρισμός πελάτη",
    title: "Έλεγχοι για ευαίσθητα νομικά δεδομένα",
    intro: "Οι έλεγχοι ασφάλειας εστιάζουν σε συνέπεια πληρωμών, χειρισμό απορρήτου, απόκριση περιστατικών και περιορισμένη πρόσβαση σε ευαίσθητα δεδομένα.",
    sections: [
      ["Συνέπεια πληρωμών", "Κάθε ισχυρισμός πληρωμής πρέπει να συμφωνεί με την ασφαλή ροή Stripe και τις εγγραφές πληρωμών του λογαριασμού."],
      ["Έλεγχοι πρόσβασης", "Έγγραφα πελάτη και εγγραφές κρατήσεων πρέπει να είναι ορατά μόνο στον χρήστη, στον επιλεγμένο δικηγόρο και σε εξουσιοδοτημένες ροές υποστήριξης."],
      ["Χειρισμός περιστατικών", "Περιστατικά ασφάλειας ή απορρήτου απαιτούν triage, περιορισμό, ενημέρωση χρήστη όπου χρειάζεται και επιχειρησιακό έλεγχο."],
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

        <section className="mt-8 rounded-lg border border-border bg-secondary/40 p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <MessageSquareWarning className="h-5 w-5 text-primary" />
            Πώς εφαρμόζεται στην πράξη
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <OperationalRule title="Πότε ανοίγει υπόθεση" text="Όταν υπάρχει πρόβλημα κράτησης, πληρωμής, απορρήτου, κριτικής, συμπεριφοράς ή ακρίβειας προφίλ." />
            <OperationalRule title="Τι ζητά η υποστήριξη" text="Κωδικό κράτησης ή πληρωμής, email λογαριασμού, σύντομη περιγραφή και στοιχεία που βοηθούν τον έλεγχο." />
            <OperationalRule title="Ποιο είναι το αποτέλεσμα" text="Αλλαγή ώρας, επιστροφή, απόκρυψη κριτικής, διόρθωση προφίλ, πάγωμα δημοσίευσης ή κλιμάκωση απορρήτου/ασφάλειας." />
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="rounded-lg font-bold">
            <Link to="/search">
              Βρείτε δικηγόρο
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg font-bold">
            <Link to="/help">Άνοιγμα υποστήριξης</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const OperationalRule = ({ title, text }: { title: string; text: string }) => (
  <article className="rounded-lg border border-border bg-card p-4">
    <h3 className="text-sm font-bold text-foreground">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
  </article>
);

export default TrustPage;
