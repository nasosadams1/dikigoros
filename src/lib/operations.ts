import type { Lawyer } from "@/data/lawyers";
import type { FunnelEvent } from "@/lib/funnelAnalytics";
import { getLawyerMarketplaceSignals, includesMarketplaceText, isAvailableToday, isAvailableTomorrow } from "@/lib/marketplace";
import { allowedMarketplaceCities, legalPracticeAreas } from "@/lib/marketplaceTaxonomy";

export type OperationalArea =
  | "payments"
  | "supply"
  | "verification"
  | "reviews"
  | "bookingDisputes"
  | "support"
  | "privacyDocuments"
  | "security";

export interface OperatingRule {
  area: OperationalArea;
  title: string;
  owner: string;
  sla: string;
  trigger: string;
  evidenceNeeded: string[];
  actions: string[];
  userOutcome: string;
  escalation: string;
  closeCondition: string;
  clientCopy: string;
}

export interface SupportWorkflow {
  id: string;
  label: string;
  area: OperationalArea;
  owner: string;
  sla: string;
  requiredEvidence: string[];
  escalationRule: string;
  userFacingResponse: string;
  closeCondition: string;
}

export interface LaunchGate {
  label: string;
  owner: string;
  ready: boolean;
  evidence: string;
}

export interface LaunchEvidenceCase {
  area: OperationalArea;
  title: string;
  summary: string;
  status: string;
  evidence: string[];
}

export interface LaunchGateInputs {
  lawyers: Lawyer[];
  funnelEvents: FunnelEvent[];
  operationalCases: LaunchEvidenceCase[];
  operationalCasesSource: "backend" | "fallback" | "unavailable";
}

export interface PaymentReadinessCheck {
  label: string;
  ready: boolean;
  detail: string;
}

export const coreLaunchCities = allowedMarketplaceCities.map((city) => ({
  label: city.title,
  query: city.query,
  minimumVerified: city.minimumVerified,
}));

export const highIntentCategories = legalPracticeAreas.map((area) => ({
  label: area.label,
  queries: [area.query, area.label, area.shortLabel, ...area.keywords],
}));

export const discoveryDensityThresholds = {
  minimumVerifiedLawyers: 3,
  minimumWithPrice: 3,
  minimumAvailableSoon: 2,
  minimumReviewed: 2,
  minimumBookable: 3,
};

export const operatingRules: OperatingRule[] = [
  {
    area: "payments",
    title: "Αποτυχίες πληρωμής και κατάσταση Checkout",
    owner: "Υπεύθυνος πληρωμών",
    sla: "Ίδια εργάσιμη ημέρα για αποτυχίες πληρωμής, άμεσα για πιθανή διπλή χρέωση.",
    trigger: "Επιτυχία Checkout, ακύρωση, ασύγχρονη αποτυχία, αίτημα επιστροφής ή απόδειξη που λείπει.",
    evidenceNeeded: ["κωδικός κράτησης", "κωδικός πληρωμής ή συνεδρία ασφαλούς πληρωμής", "ηλεκτρονικό ταχυδρομείο πελάτη", "ορατή κατάσταση πληρωμής στον λογαριασμό"],
    actions: [
      "Επιβεβαίωση ότι υπάρχει εγγραφή πληρωμής για την κράτηση και ότι συμφωνεί με το ποσό.",
      "Έλεγχος συνεδρίας πληρωμής Stripe, εντολής πληρωμής, συμβάντος επιβεβαίωσης και συνδέσμου απόδειξης.",
      "Δρομολόγηση επιλέξιμης επιστροφής στην αρχική μέθοδο πληρωμής.",
      "Τα τεχνικά σφάλματα του παρόχου δεν εμφανίζονται αυτούσια στον πελάτη.",
      "Στην παραγωγή απαιτούνται κλειδιά παραγωγής Stripe και μυστικό συμβάντων παραγωγής πριν λειτουργήσει η ασφαλής πληρωμή.",
    ],
    userOutcome: "Ο χρήστης βλέπει πληρωμένη, αποτυχημένη, επιστραφείσα ή υπό έλεγχο πληρωμή με μία σαφή επόμενη ενέργεια.",
    escalation: "Άμεση κλιμάκωση για διπλή χρέωση, απόδειξη που λείπει μετά από επιτυχία ή ασυμφωνία συμβάντος πληρωμής.",
    closeCondition: "Συνεδρία Stripe, εγγραφή πληρωμής, κατάσταση κράτησης, μήνυμα χρήστη και απόδειξη/επιστροφή συμφωνούν.",
    clientCopy: "Η πληρωμή δεν ολοκληρώθηκε. Δεν έγινε χρέωση. Δοκιμάστε ξανά ή ανοίξτε υποστήριξη.",
  },
  {
    area: "payments",
    title: "Έλεγχος επιστροφής",
    owner: "Υπεύθυνος πληρωμών",
    sla: "Ίδια εργάσιμη ημέρα για ακύρωση δικηγόρου ή πιθανή διπλή χρέωση, έως 2 εργάσιμες για εκπρόθεσμο αίτημα.",
    trigger: "Ακύρωση πληρωμένης κράτησης, αίτημα επιστροφής, ακύρωση δικηγόρου, διαφωνία μη εμφάνισης ή αποτυχία επιστροφής στον πάροχο.",
    evidenceNeeded: ["κωδικός κράτησης", "κωδικός πληρωμής ή απόδειξης", "ώρα ακύρωσης", "λόγος ακύρωσης", "ιστορικό επικοινωνίας"],
    actions: [
      "Έλεγχος αν η κράτηση πληρώθηκε, ακυρώθηκε, ολοκληρώθηκε ή αμφισβητείται.",
      "Εφαρμογή του κανόνα 24 ωρών και της εξαίρεσης ακύρωσης δικηγόρου.",
      "Χρήση της αρχικής μεθόδου πληρωμής για επιλέξιμες επιστροφές.",
      "Άνοιγμα υπόθεσης όταν η πολιτική, ο χρόνος ή η κατάσταση παρόχου δεν είναι ξεκάθαρα.",
    ],
    userOutcome: "Ο χρήστης βλέπει αν η επιστροφή ξεκίνησε, εξετάζεται ή δεν προβλέπεται, με σαφή διαδρομή υποστήριξης.",
    escalation: "Κλιμάκωση στον υπεύθυνο υποστήριξης όταν τα γεγονότα συγκρούονται, ή σε ασφάλεια/απόρρητο για ύποπτη πληρωμή.",
    closeCondition: "Η επιστροφή πληρώθηκε, απορρίφθηκε με λόγο ή αναμένει πάροχο με ορατή ενημέρωση στον χρήστη.",
    clientCopy: "Η ακύρωση καταχωρίστηκε. Η υποστήριξη ελέγχει αν προβλέπεται επιστροφή.",
  },
  {
    area: "verification",
    title: "Επαλήθευση προφίλ συνεργάτη",
    owner: "Έλεγχος συνεργατών",
    sla: "2-3 εργάσιμες ημέρες μετά από πλήρη αίτηση.",
    trigger: "Νέα αίτηση δικηγόρου, αλλαγή προφίλ, ελλιπή στοιχεία ή σήμα αναστολής.",
    evidenceNeeded: ["στοιχεία ταυτότητας", "άδεια ή αριθμός μητρώου", "δικηγορικός σύλλογος", "στοιχεία πρακτικής", "πεδία ετοιμότητας προφίλ"],
    actions: [
      "Έλεγχος ταυτότητας, άδειας, συλλόγου, επαγγελματικών στοιχείων και ετοιμότητας προφίλ.",
      "Έγκριση μόνο όταν οι τρόποι συμβουλευτικής, τιμές, γλώσσες και διαθεσιμότητα είναι πραγματικά χρήσιμα για κράτηση.",
      "Απόρριψη ή επιστροφή για στοιχεία με συγκεκριμένο λόγο.",
      "Αναστολή ή αφαίρεση προφίλ όταν η επαλήθευση παλιώνει ή αμφισβητείται.",
    ],
    userOutcome: "Ο δικηγόρος βλέπει έγκριση, έλεγχο, ανάγκη αλλαγών ή απόρριψη με συγκεκριμένο λόγο.",
    escalation: "Κλιμάκωση κάθε παλιάς ή αμφισβητούμενης επαλήθευσης πριν μείνουν δημόσιες αλλαγές προφίλ.",
    closeCondition: "Το προφίλ εγκρίθηκε, απορρίφθηκε, ανεστάλη ή επέστρεψε με ακριβή ελλιπή στοιχεία.",
    clientCopy: "Το προφίλ εμφανίζεται δημόσια μόνο μετά από έλεγχο ταυτότητας, άδειας, επαγγελματικών στοιχείων και ετοιμότητας.",
  },
  {
    area: "reviews",
    title: "Έλεγχος δημοσίευσης κριτικής",
    owner: "Έλεγχος εμπιστοσύνης",
    sla: "Έως 48 ώρες για κανονικό έλεγχο, ίδια εργάσιμη ημέρα για απάτη ή κατάχρηση.",
    trigger: "Κριτική μετά από ολοκληρωμένη κράτηση, διαφωνία δικηγόρου, αναφορά κατάχρησης ή ένδειξη απάτης.",
    evidenceNeeded: ["κωδικός κράτησης", "κατάσταση ολοκλήρωσης", "κείμενο κριτικής", "βαθμολογίες", "λόγος διαφωνίας ή κατάχρησης όταν υπάρχει"],
    actions: [
      "Δημοσίευση μόνο κριτικών που συνδέονται με ολοκληρωμένη κράτηση.",
      "Αποστολή αιτήματος κριτικής μόνο αφού ολοκληρωθεί η κράτηση και η πληρωμή έχει τακτοποιηθεί ή επαληθευτεί.",
      "Μπλοκάρισμα ιδιωτικών λεπτομερειών υπόθεσης, κατάχρησης, σύγκρουσης συμφερόντων, spam ή άσχετου περιεχομένου.",
      "Δυνατότητα απάντησης δικηγόρου χωρίς αποκάλυψη εμπιστευτικών στοιχείων.",
      "Κράτημα διαφιλονικούμενων κριτικών μέχρι να ολοκληρωθεί ο έλεγχος.",
    ],
    userOutcome: "Ο πελάτης βλέπει αν η κριτική υποβλήθηκε, κρατήθηκε, δημοσιεύτηκε ή αφαιρέθηκε. Ο δικηγόρος βλέπει επιλογή απάντησης ή διαφωνίας.",
    escalation: "Άμεση κλιμάκωση στον έλεγχο εμπιστοσύνης για απάτη, κατάχρηση ή έκθεση εμπιστευτικών στοιχείων υπόθεσης.",
    closeCondition: "Η κριτική δημοσιεύτηκε, απορρίφθηκε ή κρατήθηκε με καταγεγραμμένο λόγο ελέγχου και σαφή διαδρομή απάντησης/διαφωνίας.",
    clientCopy: "Οι κριτικές δημοσιεύονται μόνο μετά από ολοκληρωμένες κρατήσεις και έλεγχο περιεχομένου.",
  },
  {
    area: "reviews",
    title: "Διαφωνίες για κριτικές",
    owner: "Έλεγχος εμπιστοσύνης",
    sla: "Έως 48 ώρες για κανονικές διαφωνίες, ίδια εργάσιμη ημέρα για κατάχρηση, απάτη ή ιδιωτικά στοιχεία.",
    trigger: "Ο δικηγόρος διαφωνεί με κριτική, ο πελάτης αναφέρει θέμα χειρισμού ή ο έλεγχος βρίσκει ιδιωτικά στοιχεία υπόθεσης.",
    evidenceNeeded: ["κωδικός κριτικής", "κωδικός κράτησης", "λόγος διαφωνίας", "σχετική δημόσια απάντηση", "τυχόν θέμα ιδιωτικών στοιχείων"],
    actions: [
      "Κράτημα ή προσωρινή απόκρυψη της κριτικής όσο ελέγχεται το διαφιλονικούμενο περιεχόμενο.",
      "Διαχωρισμός προσωπικής γνώμης από πραγματικούς ισχυρισμούς και εμπιστευτικές λεπτομέρειες υπόθεσης.",
      "Δυνατότητα δημόσιας απάντησης δικηγόρου όταν η κριτική παραμένει δημοσιευμένη.",
      "Καταγραφή λόγου αφαίρεσης όταν μια κριτική μπλοκάρεται ή αφαιρείται.",
    ],
    userOutcome: "Και οι δύο πλευρές βλέπουν αν η κριτική είναι δημόσια, σε έλεγχο, διορθώθηκε, αφαιρέθηκε ή είναι ανοιχτή για απάντηση.",
    escalation: "Κλιμάκωση επαναλαμβανόμενης κατάχρησης, ενδείξεων απάτης ή απειλών στον υπεύθυνο ασφάλειας/απορρήτου.",
    closeCondition: "Η διαφιλονικούμενη κριτική έχει τελική κατάσταση δημοσίευσης, λόγο αφαίρεσης ή επιτρεπόμενη δημόσια απάντηση.",
    clientCopy: "Η κριτική ελέγχεται πριν γίνει οποιαδήποτε δημόσια αλλαγή.",
  },
  {
    area: "bookingDisputes",
    title: "Διαφωνίες κράτησης",
    owner: "Υποστήριξη κρατήσεων",
    sla: "Ίδια εργάσιμη ημέρα για σύγκρουση ώρας και μη εμφάνιση, έως 2 εργάσιμες ημέρες για έλεγχο επιστροφής.",
    trigger: "Ακύρωση πελάτη, ακύρωση δικηγόρου, μη εμφάνιση, αίτημα αλλαγής ώρας ή σύγκρουση ώρας.",
    evidenceNeeded: ["κωδικός κράτησης", "επιλεγμένη ώρα", "κατάσταση κράτησης", "κατάσταση πληρωμής", "email αιτούντος"],
    actions: [
      "Επιβεβαίωση κατάστασης κράτησης, ώρας, πληρωμής και ιστορικού επικοινωνίας.",
      "Δωρεάν ακύρωση ή αλλαγή ώρας όταν το αίτημα είναι εκτός του παραθύρου 24 ωρών.",
      "Δρομολόγηση εκπρόθεσμων ακυρώσεων και μη εμφάνισης σε έλεγχο υποστήριξης.",
      "Τα μηνύματα μένουν ανθρώπινα και δεν εμφανίζουν εσωτερικούς κωδικούς κατάστασης.",
    ],
    userOutcome: "Ο χρήστης βλέπει αν πρέπει να επιλέξει άλλη ώρα, να δοκιμάσει ξανά πληρωμή, να παρακολουθήσει επιστροφή ή αν άνοιξε υπόθεση υποστήριξης.",
    escalation: "Κλιμάκωση πληρωμένων ακυρώσεων, ακύρωσης δικηγόρου και μη εμφάνισης στην υποστήριξη κρατήσεων, με ενημέρωση πληρωμών όταν κινήθηκαν χρήματα.",
    closeCondition: "Η κράτηση άλλαξε ώρα, ακυρώθηκε χωρίς χρέωση, μπήκε σε έλεγχο επιστροφής ή έκλεισε με γραπτή αιτιολογία.",
    clientCopy: "Ελέγχουμε τα στοιχεία της κράτησης και θα επιβεβαιώσουμε το επόμενο βήμα με email.",
  },
  {
    area: "bookingDisputes",
    title: "Ακύρωση από δικηγόρο",
    owner: "Υποστήριξη κρατήσεων",
    sla: "Ίδια εργάσιμη ημέρα, επείγον αν η συμβουλευτική είναι μέσα στις επόμενες 24 ώρες.",
    trigger: "Ο δικηγόρος ακυρώνει, ζητά αλλαγή ώρας ή δεν μπορεί να παρευρεθεί σε επιβεβαιωμένη συμβουλευτική.",
    evidenceNeeded: ["κωδικός κράτησης", "κωδικός δικηγόρου", "email πελάτη", "κατάσταση πληρωμής", "λόγος ακύρωσης"],
    actions: [
      "Προσφορά αλλαγής ώρας, συγκρίσιμης εναλλακτικής ή διαδρομής επιστροφής στον πελάτη.",
      "Η κατάσταση κράτησης δεν υπονοεί πληρωμένη ή πραγματοποιημένη συμβουλευτική όταν το ραντεβού δεν θα γίνει.",
      "Άνοιγμα ελέγχου επιστροφής όταν η κράτηση είχε πληρωθεί.",
      "Σήμανση επαναλαμβανόμενων ακυρώσεων δικηγόρου για έλεγχο συνεργάτη ή προφίλ.",
    ],
    userOutcome: "Ο πελάτης βλέπει αλλαγή ώρας, έλεγχο επιστροφής ή συνέχεια από υποστήριξη χωρίς να χρειάζεται να καταλάβει εσωτερικά τι συνέβη.",
    escalation: "Κλιμάκωση επαναλαμβανόμενων ή τελευταίας στιγμής ακυρώσεων στον έλεγχο συνεργατών και στον υπεύθυνο υποστήριξης.",
    closeCondition: "Ο πελάτης επέλεξε αλλαγή ώρας, συγκρίσιμη εναλλακτική, έλεγχο επιστροφής ή οριστικό κλείσιμο ακύρωσης.",
    clientCopy: "Ο δικηγόρος δεν μπορεί να παρευρεθεί σε αυτή την ώρα. Θα σας βοηθήσουμε να αλλάξετε ώρα ή να ελεγχθεί η επιστροφή.",
  },
  {
    area: "support",
    title: "Δρομολόγηση υποστήριξης",
    owner: "Υπεύθυνος υποστήριξης",
    sla: "Επείγον θέμα κράτησης/πληρωμής: ίδια εργάσιμη ημέρα. Γενικό θέμα λογαριασμού/απορρήτου: έως 2 εργάσιμες ημέρες.",
    trigger: "Επικοινωνία από κέντρο βοήθειας, αποτυχημένο Checkout, αποτυχία κράτησης, πρόβλημα πρόσβασης λογαριασμού ή παράπονο.",
    evidenceNeeded: ["email αιτούντος", "τύπος θέματος", "κωδικός αναφοράς όταν υπάρχει", "σύντομη περιγραφή", "προτεραιότητα"],
    actions: [
      "Σήμανση υπόθεσης ως κράτηση, πληρωμή, λογαριασμός, έγγραφο, παράπονο ή απόρρητο.",
      "Προτεραιότητα σε επείγουσες κρατήσεις και αποτυχίες πληρωμής.",
      "Άμεση κλιμάκωση θεμάτων απορρήτου/ασφάλειας.",
      "Κλείσιμο μόνο με εξήγηση προς τον χρήστη και καθαρό επόμενο βήμα.",
    ],
    userOutcome: "Ο αιτών λαμβάνει κωδικό υπόθεσης και σαφές επόμενο βήμα.",
    escalation: "Άμεση κλιμάκωση απορρήτου/ασφάλειας. Κλιμάκωση εμποδίων κράτησης/πληρωμής όταν κινδυνεύει συμβουλευτική ή χρέωση.",
    closeCondition: "Ο αιτών έχει λάβει αποτέλεσμα υπόθεσης, οι σημειώσεις υπεύθυνου έχουν καταγραφεί και δεν μένει ανοιχτό επείγον εμπόδιο.",
    clientCopy: "Η υποστήριξη έλαβε το αίτημά σας και το δρομολογεί στη σωστή ομάδα.",
  },
  {
    area: "support",
    title: "Πρόσβαση λογαριασμού",
    owner: "Υπεύθυνος υποστήριξης",
    sla: "Έως 2 εργάσιμες ημέρες, ίδια εργάσιμη ημέρα όταν η πρόσβαση μπλοκάρει επερχόμενη πληρωμένη συμβουλευτική.",
    trigger: "Αποτυχία σύνδεσης, αναντιστοιχία email, χαμένο ιστορικό λογαριασμού, πρόβλημα πρόσβασης απόδειξης ή θέμα workspace.",
    evidenceNeeded: ["email λογαριασμού", "κωδικός κράτησης/πληρωμής αν υπάρχει", "τι ακριβώς δεν ανοίγει", "συσκευή/browser όταν βοηθά"],
    actions: [
      "Επιβεβαίωση ότι ο αιτών ελέγχει το email πριν συζητηθούν στοιχεία λογαριασμού.",
      "Έλεγχος ορατότητας κρατήσεων, πληρωμών, εγγράφων και αποθηκευμένων δικηγόρων για τον λογαριασμό.",
      "Αποκατάσταση πρόσβασης ή εξήγηση για το ποιο στοιχείο λείπει.",
      "Κλιμάκωση ύποπτων μοτίβων πρόσβασης στην ασφάλεια.",
    ],
    userOutcome: "Ο χρήστης βλέπει πώς θα ανακτήσει πρόσβαση ή ποια ακριβώς εγγραφή ελέγχει η υποστήριξη.",
    escalation: "Άμεση κλιμάκωση για υποψία κατάληψης λογαριασμού ή έκθεσης ευαίσθητου εγγράφου.",
    closeCondition: "Η πρόσβαση αποκαταστάθηκε, η ταυτότητα επαληθεύτηκε με επόμενα βήματα ή η ασφάλεια έχει αναλάβει την υπόθεση.",
    clientCopy: "Ελέγχουμε την πρόσβαση στον λογαριασμό και θα μιλήσουμε για ιδιωτικά στοιχεία μόνο μετά την επαλήθευση email.",
  },
  {
    area: "privacyDocuments",
    title: "Πρόσβαση και διατήρηση εγγράφων",
    owner: "Υπεύθυνος απορρήτου",
    sla: "Έως 2 εργάσιμες ημέρες για πρόσβαση/διαγραφή, ίδια εργάσιμη ημέρα για πιθανή έκθεση εγγράφου.",
    trigger: "Ανέβασμα εγγράφου, αλλαγή ορατότητας, αίτημα διαγραφής, αίτημα πρόσβασης ή παράπονο απορρήτου.",
    evidenceNeeded: ["email λογαριασμού", "κωδικός ή όνομα εγγράφου", "σχετική κράτηση", "κατάσταση ορατότητας", "τύπος αιτήματος"],
    actions: [
      "Τα έγγραφα εμφανίζονται στον επιλεγμένο δικηγόρο μόνο όταν συνδέονται με κράτηση και ο χρήστης τα έχει κάνει ορατά.",
      "Καταγραφή αιτημάτων πρόσβασης και διαγραφής μαζί με το σχετικό πλαίσιο κράτησης/λογαριασμού.",
      "Διατήρηση μόνο όσων χρειάζονται για λογαριασμό, κράτηση, πληρωμή, υποστήριξη και νόμιμες υποχρεώσεις.",
      "Επιβεβαίωση διαγραφής ή λόγου διατήρησης σε απλή γλώσσα.",
    ],
    userOutcome: "Ο χρήστης βλέπει αν το έγγραφο είναι ιδιωτικό, ορατό στον δικηγόρο της κράτησης, διαγραμμένο ή διατηρείται για συγκεκριμένο λόγο.",
    escalation: "Κλιμάκωση τυχαίας έκθεσης, μη εξουσιοδοτημένης πρόσβασης ή νομικής σύγκρουσης διαγραφής στον υπεύθυνο απορρήτου/ασφάλειας.",
    closeCondition: "Η ορατότητα, το αίτημα διαγραφής, ο λόγος διατήρησης και το συμβάν ελέγχου έχουν καταγραφεί και εξηγηθεί στον χρήστη.",
    clientCopy: "Τα έγγραφά σας είναι ορατά στον δικηγόρο της κράτησης μόνο όταν επιτρέπετε την πρόσβαση.",
  },
  {
    area: "security",
    title: "Χειρισμός περιστατικού ευαίσθητων δεδομένων",
    owner: "Υπεύθυνος ασφάλειας/απορρήτου",
    sla: "Άμεση διαλογή, πρώτα περιορισμός του περιστατικού και μετά κανονικός χειρισμός υποστήριξης.",
    trigger: "Πιθανή μη εξουσιοδοτημένη πρόσβαση, ασυμφωνία πληρωμής/ασφάλειας, έκθεση δεδομένων ή ύποπτη δραστηριότητα λογαριασμού.",
    evidenceNeeded: ["email αναφέροντος", "επηρεαζόμενος λογαριασμός ή κωδικός", "περιγραφή περιστατικού", "χρόνος εντοπισμού", "πιθανά εκτεθειμένα δεδομένα"],
    actions: [
      "Περιορισμός πρόσβασης και διατήρηση σχετικού πλαισίου ελέγχου.",
      "Έλεγχος επηρεαζόμενων λογαριασμών, κρατήσεων, πληρωμών και εγγράφων.",
      "Ενημέρωση χρηστών ανάλογα με τη σοβαρότητα και τις νόμιμες υποχρεώσεις.",
      "Καταγραφή διορθωτικών μέτρων πριν κλείσει η υπόθεση.",
    ],
    userOutcome: "Οι επηρεαζόμενοι χρήστες λαμβάνουν επιβεβαιωμένη ενημέρωση, κατάσταση περιορισμού και επόμενα βήματα όταν εξακριβωθούν τα στοιχεία.",
    escalation: "Άμεση κλιμάκωση στον υπεύθυνο ασφάλειας/απορρήτου. Δεν μένει στην κανονική ουρά υποστήριξης.",
    closeCondition: "Το περιστατικό περιορίστηκε, το επηρεαζόμενο εύρος είναι γνωστό, αποφασίστηκε η ενημέρωση και καταγράφηκαν διορθωτικά μέτρα.",
    clientCopy: "Ελέγχουμε θέμα ασφάλειας και θα επικοινωνήσουμε με τους επηρεαζόμενους χρήστες με επιβεβαιωμένες πληροφορίες.",
  },
];

export const supportWorkflows: SupportWorkflow[] = [
  {
    id: "booking_failure",
    label: "Αποτυχία κράτησης",
    area: "bookingDisputes",
    owner: "Υποστήριξη κρατήσεων",
    sla: "Ίδια εργάσιμη ημέρα",
    requiredEvidence: ["κωδικός κράτησης", "επιλεγμένη ώρα", "email πελάτη", "μήνυμα που είδε ο χρήστης"],
    escalationRule: "Κλιμάκωση αν η ώρα είναι μέσα στις επόμενες 24 ώρες ή αν έχει κινηθεί πληρωμή.",
    userFacingResponse: "Ελέγχουμε την κράτηση και θα σας πούμε αν χρειάζεται νέα προσπάθεια, άλλη ώρα ή υπόθεση υποστήριξης.",
    closeCondition: "Ο χρήστης έχει επιβεβαιωμένη κράτηση, νέα διαθέσιμη ώρα ή γραπτή επιβεβαίωση ότι δεν έγινε χρέωση.",
  },
  {
    id: "lawyer_cancellation",
    label: "Ακύρωση από δικηγόρο",
    area: "bookingDisputes",
    owner: "Υποστήριξη κρατήσεων",
    sla: "Ίδια εργάσιμη ημέρα, επείγον αν το ραντεβού είναι εντός 24 ωρών",
    requiredEvidence: ["κωδικός κράτησης", "κωδικός δικηγόρου", "λόγος ακύρωσης", "κατάσταση πληρωμής"],
    escalationRule: "Κλιμάκωση στον έλεγχο συνεργατών αν οι ακυρώσεις επαναλαμβάνονται ή γίνονται την τελευταία στιγμή.",
    userFacingResponse: "Ο δικηγόρος δεν μπορεί να παρευρεθεί σε αυτή την ώρα. Θα σας βοηθήσουμε να αλλάξετε ώρα ή να ελεγχθεί η επιστροφή.",
    closeCondition: "Ο πελάτης επέλεξε αλλαγή ώρας, εναλλακτικό δικηγόρο, έλεγχο επιστροφής ή οριστικό κλείσιμο ακύρωσης.",
  },
  {
    id: "slot_conflict",
    label: "Σύγκρουση ώρας",
    area: "bookingDisputes",
    owner: "Υποστήριξη κρατήσεων",
    sla: "Ίδια εργάσιμη ημέρα",
    requiredEvidence: ["κωδικός δικηγόρου", "ημερομηνία", "ώρα", "προσπάθεια κράτησης"],
    escalationRule: "Κλιμάκωση σε έλεγχο διαθεσιμότητας αν εμφανίζονται επαναλαμβανόμενες συγκρούσεις στον ίδιο δικηγόρο.",
    userFacingResponse: "Η ώρα δεν είναι πλέον διαθέσιμη. Επιλέξτε άλλη ώρα.",
    closeCondition: "Η συγκρουόμενη ώρα αποδεσμεύτηκε ή μπλοκαρίστηκε και ο χρήστης έχει καθαρή επόμενη διαδρομή.",
  },
  {
    id: "payment_failure",
    label: "Αποτυχία πληρωμής",
    area: "payments",
    owner: "Υπεύθυνος πληρωμών",
    sla: "Ίδια εργάσιμη ημέρα, άμεσα για πιθανή διπλή χρέωση",
    requiredEvidence: ["κωδικός κράτησης", "συνεδρία πληρωμής Stripe", "εγγραφή πληρωμής", "ηλεκτρονικό ταχυδρομείο χρήστη"],
    escalationRule: "Άμεση κλιμάκωση για πιθανή διπλή χρέωση, ασυμφωνία συμβάντος πληρωμής ή απόδειξη που λείπει.",
    userFacingResponse: "Η πληρωμή δεν ολοκληρώθηκε. Δεν έγινε χρέωση.",
    closeCondition: "Η πληρωμή είναι πληρωμένη, απέτυχε με σαφή επιλογή επανάληψης ή κλιμακώθηκε με στοιχεία από τον πάροχο.",
  },
  {
    id: "refund_request",
    label: "Αίτημα επιστροφής",
    area: "payments",
    owner: "Υπεύθυνος πληρωμών",
    sla: "Ίδια εργάσιμη ημέρα για επιλέξιμη ακύρωση",
    requiredEvidence: ["κράτηση", "πληρωμή", "ώρα ακύρωσης", "λόγος ακύρωσης"],
    escalationRule: "Κλιμάκωση στον υπεύθυνο υποστήριξης όταν τα στοιχεία της πολιτικής δεν είναι ξεκάθαρα.",
    userFacingResponse: "Η ακύρωση καταχωρίστηκε. Ελέγχουμε αν προβλέπεται επιστροφή.",
    closeCondition: "Η επιστροφή εκτελέστηκε, απορρίφθηκε με αιτιολογία ή αναμένει επεξεργασία από τον πάροχο.",
  },
  {
    id: "refund_review",
    label: "Έλεγχος επιστροφής",
    area: "payments",
    owner: "Υπεύθυνος πληρωμών",
    sla: "Έως 2 εργάσιμες ημέρες",
    requiredEvidence: ["ιστορικό κράτησης", "κατάσταση πληρωμής", "μηνύματα", "λόγος ακύρωσης"],
    escalationRule: "Κλιμάκωση στον υπεύθυνο υποστήριξης για διαφωνίες ή επαναλαμβανόμενα θέματα συνεργάτη.",
    userFacingResponse: "Η επιστροφή εξετάζεται από την υποστήριξη.",
    closeCondition: "Η απόφαση ελέγχου και η εξήγηση προς τον χρήστη έχουν καταγραφεί.",
  },
  {
    id: "account_access",
    label: "Πρόβλημα πρόσβασης λογαριασμού",
    area: "support",
    owner: "Υπεύθυνος υποστήριξης",
    sla: "Έως 2 εργάσιμες ημέρες, ίδια ημέρα αν μπλοκάρει πληρωμένο ραντεβού",
    requiredEvidence: ["email λογαριασμού", "κωδικός κράτησης ή πληρωμής", "τι πρόβλημα πρόσβασης εμφανίζεται"],
    escalationRule: "Κλιμάκωση στον υπεύθυνο ασφάλειας/απορρήτου αν υπάρχει υποψία πρόσβασης τρίτου.",
    userFacingResponse: "Ελέγχουμε την πρόσβαση και θα μιλήσουμε για ιδιωτικά στοιχεία μόνο μετά την επαλήθευση email.",
    closeCondition: "Η πρόσβαση αποκαταστάθηκε, επαληθεύτηκε ή η ασφάλεια έχει αναλάβει την ανοιχτή υπόθεση.",
  },
  {
    id: "document_request",
    label: "Αίτημα ορατότητας ή διαγραφής εγγράφου",
    area: "privacyDocuments",
    owner: "Υπεύθυνος απορρήτου",
    sla: "Έως 2 εργάσιμες ημέρες, ίδια ημέρα για πιθανή έκθεση εγγράφου",
    requiredEvidence: ["κωδικός ή όνομα εγγράφου", "email λογαριασμού", "κωδικός κράτησης", "τύπος αιτήματος"],
    escalationRule: "Κλιμάκωση για μη εξουσιοδοτημένη πρόσβαση ή σύγκρουση με νόμιμη υποχρέωση διατήρησης.",
    userFacingResponse: "Ελέγχουμε ποιος μπορεί να δει το αρχείο και τι μπορεί να διαγραφεί.",
    closeCondition: "Η ορατότητα, το αίτημα διαγραφής, ο λόγος διατήρησης και το συμβάν ελέγχου έχουν καταγραφεί.",
  },
  {
    id: "privacy_request",
    label: "Αίτημα απορρήτου",
    area: "privacyDocuments",
    owner: "Υπεύθυνος απορρήτου",
    sla: "Έως 2 εργάσιμες ημέρες",
    requiredEvidence: ["email λογαριασμού", "πεδίο αιτήματος", "επηρεαζόμενη εγγραφή"],
    escalationRule: "Κλιμάκωση στον υπεύθυνο ασφάλειας/απορρήτου για νομική σύγκρουση ή πιθανή έκθεση δεδομένων.",
    userFacingResponse: "Το αίτημα απορρήτου δρομολογήθηκε για έλεγχο.",
    closeCondition: "Ο χρήστης έλαβε πρόσβαση, διαγραφή, λόγο διατήρησης ή ενημέρωση κλιμάκωσης.",
  },
  {
    id: "lawyer_complaint",
    label: "Παράπονο για δικηγόρο",
    area: "bookingDisputes",
    owner: "Υπεύθυνος υποστήριξης",
    sla: "Έως 2 εργάσιμες ημέρες, ίδια ημέρα για κατάχρηση ή θέμα ασφάλειας",
    requiredEvidence: ["κωδικός κράτησης ή προφίλ", "λόγος παραπόνου", "μηνύματα ή γεγονότα"],
    escalationRule: "Κλιμάκωση στον έλεγχο συνεργατών όταν υπάρχει επαναλαμβανόμενη συμπεριφορά.",
    userFacingResponse: "Το παράπονο καταχωρίστηκε και θα ελεγχθεί με βάση τα στοιχεία.",
    closeCondition: "Το παράπονο λύθηκε, καταγράφηκε ενέργεια προφίλ ή ο έλεγχος συνεργατών έχει αναλάβει τη συνέχεια.",
  },
  {
    id: "review_dispute",
    label: "Διαφωνία κριτικής",
    area: "reviews",
    owner: "Έλεγχος εμπιστοσύνης",
    sla: "Έως 48 ώρες, ίδια ημέρα για κατάχρηση ή ιδιωτικά στοιχεία",
    requiredEvidence: ["κωδικός κριτικής", "κωδικός κράτησης", "λόγος διαφωνίας"],
    escalationRule: "Κλιμάκωση για απειλές, απάτη ή έκθεση εμπιστευτικών στοιχείων.",
    userFacingResponse: "Η κριτική κρατήθηκε για έλεγχο πριν αλλάξει δημόσια.",
    closeCondition: "Η κριτική δημοσιεύτηκε, απορρίφθηκε, διορθώθηκε ή άνοιξε για απάντηση δικηγόρου.",
  },
  {
    id: "security_incident",
    label: "Περιστατικό ασφάλειας",
    area: "security",
    owner: "Υπεύθυνος ασφάλειας/απορρήτου",
    sla: "Άμεση διαλογή",
    requiredEvidence: ["email αναφέροντος", "επηρεαζόμενη εγγραφή", "χρόνος περιστατικού", "δεδομένα που μπορεί να εκτέθηκαν"],
    escalationRule: "Δεν μένει στην κανονική υποστήριξη. Πρώτα περιορίζεται το περιστατικό.",
    userFacingResponse: "Ελέγχουμε θέμα ασφάλειας και θα ενημερώσουμε με επιβεβαιωμένα στοιχεία.",
    closeCondition: "Έχουν καταγραφεί ο περιορισμός, το επηρεαζόμενο εύρος, η απόφαση ενημέρωσης και η διορθωτική ενέργεια.",
  },
];

export const launchGates: LaunchGate[] = [
  {
    label: "Οι εξαιρέσεις κράτησης και πληρωμής έχουν ελεγχθεί από την αρχή μέχρι το τέλος",
    owner: "Υπεύθυνος πληρωμών",
    ready: false,
    evidence: "Σύγκρουση ώρας, αποτυχία, άνοιγμα, επιτυχία πληρωμής, ακύρωση, επιστροφή και απόδειξη έχουν κλεισμένα αποδεικτικά από την αρχή μέχρι το τέλος.",
  },
  {
    label: "Η επιβεβαίωση και η συμφωνία πληρωμών λειτουργούν",
    owner: "Υπεύθυνος πληρωμών",
    ready: true,
    evidence: "Το συμβάν Stripe γράφει πληρωμένη, αποτυχημένη ή επιστραφείσα κατάσταση, συμβάν παρόχου, απόδειξη και κατάσταση πληρωμής κράτησης.",
  },
  {
    label: "Οι καταστάσεις λογαριασμού συμφωνούν με το σύστημα",
    owner: "Υπεύθυνος υποστήριξης",
    ready: true,
    evidence: "Ο λογαριασμός διαβάζει τις κοινές καταστάσεις κράτησης/πληρωμής και δεν υπονοεί ότι κράτηση σημαίνει πληρωμή.",
  },
  {
    label: "Οι ροές υποστήριξης έχουν υπεύθυνο και χρόνο απόκρισης",
    owner: "Υπεύθυνος λειτουργίας",
    ready: true,
    evidence: "Κάθε κατηγορία υποστήριξης έχει υπεύθυνο, χρόνο απόκρισης, στοιχεία, κλιμάκωση, απάντηση και συνθήκη κλεισίματος.",
  },
  {
    label: "Η δημοσίευση κριτικών ακολουθεί υποχρεωτική ροή ελέγχου",
    owner: "Έλεγχος εμπιστοσύνης",
    ready: true,
    evidence: "Οι κριτικές ξεκινούν σε έλεγχο και απαιτούν επιβεβαιωμένη ολοκληρωμένη συμβουλευτική πριν δημοσιευτούν.",
  },
  {
    label: "Η επαλήθευση συνεργατών εφαρμόζεται πριν τη δημόσια παρουσία",
    owner: "Έλεγχος συνεργατών",
    ready: true,
    evidence: "Οι αιτήσεις μένουν σε έλεγχο μέχρι να περάσουν ταυτότητα, άδεια, δικηγορικός σύλλογος και ετοιμότητα προφίλ.",
  },
  {
    label: "Τα αναλυτικά στοιχεία διαδρομής γράφονται στο σύστημα",
    owner: "Λειτουργία ανάπτυξης",
    ready: true,
    evidence: "Τα συμβάντα διαδρομής γράφονται στο Supabase funnel_events με session, χρήστη, δικηγόρο, κράτηση, πόλη, κατηγορία και πηγή.",
  },
  {
    label: "Η βασική πυκνότητα πόλης/δικαίου έχει επιτευχθεί",
    owner: "Υπεύθυνος προσφοράς αγοράς",
    ready: false,
    evidence: "Οι 5 επιτρεπόμενες πόλεις και τα 5 επιτρεπόμενα δίκαια καλύπτουν τα όρια επαλήθευσης, τιμής, διαθεσιμότητας, κριτικών και κρατήσιμων προφίλ.",
  },
  {
    label: "Ο πίνακας δικηγόρου δείχνει καθαρά την απόδοση",
    owner: "Επιτυχία συνεργατών",
    ready: true,
    evidence: "Το portal συνεργάτη δείχνει εμφανίσεις/προβολές, εκκινήσεις κράτησης, πληρωμένες κρατήσεις, ολοκληρώσεις, κριτικές, διαθεσιμότητα και κενά απόδειξης προφίλ.",
  },
];

const closedOperationalStatuses = new Set(["resolved", "rejected", "suspended"]);

export const bookingPaymentEvidenceScenarios = [
  {
    label: "επιτυχής κράτηση παραγωγής",
    terms: ["successful live booking", "payment succeeded", "receipt visible", "confirmed_paid", "επιτυχής live κράτηση", "επιτυχής κράτηση παραγωγής", "επιτυχής πληρωμή", "ορατή απόδειξη", "πληρωμένη κράτηση"],
  },
  {
    label: "αποτυχημένη πληρωμή",
    terms: ["failed payment", "checkout failed", "payment failed", "αποτυχημένη πληρωμή", "αποτυχία checkout", "η πληρωμή απέτυχε"],
  },
  {
    label: "ακύρωση με επιστροφή",
    terms: ["refunded cancellation", "refund approved", "refunded", "ακύρωση με επιστροφή", "εγκρίθηκε επιστροφή", "επιστραφείσα"],
  },
  {
    label: "ακύρωση από δικηγόρο",
    terms: ["lawyer cancelled", "lawyer cancellation", "reschedule", "ακύρωση από δικηγόρο", "αλλαγή ώρας", "νέα ώρα"],
  },
];

const allText = (operationalCase: LaunchEvidenceCase) =>
  [operationalCase.title, operationalCase.summary, ...operationalCase.evidence].join(" ").toLowerCase();

const hasClosedCaseWithAnyTerm = (cases: LaunchEvidenceCase[], terms: string[]) =>
  cases.some((operationalCase) => {
    if (!closedOperationalStatuses.has(operationalCase.status)) return false;
    const haystack = allText(operationalCase);
    return terms.some((term) => haystack.includes(term.toLowerCase()));
  });

export const getBookingPaymentEvidenceChecks = (cases: LaunchEvidenceCase[]) =>
  bookingPaymentEvidenceScenarios.map((scenario) => ({
    ...scenario,
    ready: hasClosedCaseWithAnyTerm(cases, scenario.terms),
  }));

export const getSupportWorkflowEvidenceChecks = (cases: LaunchEvidenceCase[]) =>
  supportWorkflows.map((workflow) => ({
    id: workflow.id,
    label: workflow.label,
    ready: cases.some((operationalCase) => {
      if (operationalCase.area !== workflow.area || !closedOperationalStatuses.has(operationalCase.status)) return false;
      const haystack = allText(operationalCase);
      return haystack.includes(workflow.id.replace(/_/g, " ")) || haystack.includes(workflow.label.toLowerCase());
    }),
  }));

export const getFunnelEventCoverage = (funnelEvents: FunnelEvent[]) => {
  const counts = funnelEvents.reduce<Record<string, number>>((accumulator, event) => {
    accumulator[event.name] = (accumulator[event.name] || 0) + 1;
    return accumulator;
  }, {});
  const timestamps = funnelEvents
    .map((event) => new Date(event.occurredAt).getTime())
    .filter((timestamp) => Number.isFinite(timestamp));
  const oldest = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const newest = timestamps.length > 0 ? Math.max(...timestamps) : null;
  const observedDays = oldest && newest ? (newest - oldest) / (24 * 60 * 60 * 1000) : 0;

  return {
    observedDays,
    checks: [
      "homepage_search",
      "search_profile_opened",
      "profile_booking_start",
      "booking_created",
      "payment_opened",
      "payment_completed",
      "consultation_completed",
      "review_submitted",
      "lawyer_application_submitted",
      "lawyer_application_approved",
      "approved_lawyer_first_completed_consultation",
    ].map((eventName) => ({
      eventName,
      count: counts[eventName] || 0,
      ready: (counts[eventName] || 0) > 0,
    })),
  };
};

export const getDynamicLaunchGates = ({
  lawyers,
  funnelEvents,
  operationalCases,
  operationalCasesSource,
}: LaunchGateInputs): LaunchGate[] => {
  const paymentChecks = getPaymentReadinessChecks();
  const paymentEvidenceChecks = getBookingPaymentEvidenceChecks(operationalCases);
  const supportEvidenceChecks = getSupportWorkflowEvidenceChecks(operationalCases);
  const funnelCoverage = getFunnelEventCoverage(funnelEvents);
  const supplyReadiness = getSupplyReadiness(lawyers);
  const coreDensityReady = supplyReadiness.every((city) => city.ready && city.categories.every((category) => category.ready));

  return [
    {
      label: "Οι εξαιρέσεις κράτησης και πληρωμής έχουν ελεγχθεί από την αρχή μέχρι το τέλος",
      owner: "Υπεύθυνος πληρωμών",
      ready: paymentChecks.every((check) => check.ready) && paymentEvidenceChecks.every((check) => check.ready),
      evidence: `${paymentEvidenceChecks.filter((check) => check.ready).length}/${paymentEvidenceChecks.length} σενάρια πληρωμής έχουν κλείσει με στοιχεία παραγωγής ή δοκιμής.`,
    },
    {
      label: "Η επιβεβαίωση και η συμφωνία πληρωμών λειτουργούν",
      owner: "Υπεύθυνος πληρωμών",
      ready: paymentChecks.every((check) => check.ready) && hasClosedCaseWithAnyTerm(operationalCases, ["webhook", "payment reconciliation", "receipt visible", "συμφωνία πληρωμών", "ορατή απόδειξη"]),
      evidence: "Απαιτεί λειτουργία παραγωγής Stripe και κλειστή υπόθεση που αποδεικνύει συμφωνία συμβάντων για πληρωμή, αποτυχία, επιστροφή και ορατή απόδειξη.",
    },
    {
      label: "Οι καταστάσεις λογαριασμού συμφωνούν με το σύστημα",
      owner: "Υπεύθυνος υποστήριξης",
      ready: operationalCasesSource === "backend" && hasClosedCaseWithAnyTerm(operationalCases, ["account statuses", "backend truth", "confirmed_paid", "refund_requested", "καταστάσεις λογαριασμού", "αλήθεια backend"]),
      evidence: "Απαιτεί πηγή λειτουργίας από το σύστημα και κλειστή υπόθεση που αποδεικνύει ότι οι καταστάσεις λογαριασμού συμφωνούν με το σύστημα.",
    },
    {
      label: "Οι ροές υποστήριξης έχουν υπεύθυνο και χρόνο απόκρισης",
      owner: "Υπεύθυνος λειτουργίας",
      ready: supportWorkflows.every((workflow) => workflow.owner && workflow.sla && workflow.requiredEvidence.length > 0) && supportEvidenceChecks.every((check) => check.ready),
      evidence: `${supportEvidenceChecks.filter((check) => check.ready).length}/${supportEvidenceChecks.length} ροές υποστήριξης έχουν κλειστή δοκιμαστική απόδειξη ή απόδειξη παραγωγής.`,
    },
    {
      label: "Η δημοσίευση κριτικών ακολουθεί υποχρεωτική ροή ελέγχου",
      owner: "Έλεγχος εμπιστοσύνης",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["review publication", "completed confirmed consultation", "under_moderation", "δημοσίευση κριτικής", "επιβεβαιωμένη ολοκληρωμένη συμβουλευτική", "υπό έλεγχο"]),
      evidence: "Απαιτεί κλειστή απόδειξη ελέγχου ότι οι κριτικές δημοσιεύονται μόνο μετά από επιβεβαιωμένη ολοκλήρωση.",
    },
    {
      label: "Η επαλήθευση συνεργατών εφαρμόζεται πριν τη δημόσια παρουσία",
      owner: "Έλεγχος συνεργατών",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["partner verification", "application review", "approved partner", "επαλήθευση συνεργάτη", "έλεγχος αίτησης", "εγκεκριμένος συνεργάτης"]),
      evidence: "Απαιτεί κλειστή απόδειξη ότι ταυτότητα, άδεια και δικηγορικός σύλλογος ελέγχονται πριν την έγκριση.",
    },
    {
      label: "Τα αναλυτικά στοιχεία διαδρομής γράφονται στο σύστημα",
      owner: "Λειτουργία ανάπτυξης",
      ready: funnelCoverage.checks.every((check) => check.ready) && funnelCoverage.observedDays >= 7,
      evidence: `${funnelCoverage.checks.filter((check) => check.ready).length}/${funnelCoverage.checks.length} απαιτούμενα συμβάντα καταγράφηκαν σε παράθυρο ${funnelCoverage.observedDays.toFixed(1)} ημερών.`,
    },
    {
      label: "Η βασική πυκνότητα πόλης/δικαίου έχει επιτευχθεί",
      owner: "Υπεύθυνος προσφοράς αγοράς",
      ready: coreDensityReady,
      evidence: "Οι 5 επιτρεπόμενες πόλεις πρέπει να καλύπτουν τα όρια επαληθευμένων προφίλ και κάθε επιτρεπόμενο δίκαιο να έχει αρκετή κρατήσιμη προσφορά.",
    },
    {
      label: "Ο πίνακας δικηγόρου δείχνει καθαρά την απόδοση",
      owner: "Επιτυχία συνεργατών",
      ready: hasClosedCaseWithAnyTerm(operationalCases, ["lawyer dashboard", "roi", "completed consultations", "paid bookings", "dashboard δικηγόρου", "απόδοση", "ολοκληρωμένες συμβουλευτικές", "πληρωμένες κρατήσεις"]),
      evidence: "Απαιτεί κλειστή υπόθεση απόδειξης απόδοσης συνεργάτη, βασισμένη σε πραγματικό πίνακα με δεδομένα παραγωγής.",
    },
    {
      label: "Οι λειτουργίες δίνουν προτεραιότητα στο σύστημα",
      owner: "Υπεύθυνος λειτουργίας",
      ready: operationalCasesSource === "backend",
      evidence: operationalCasesSource === "backend" ? "Οι υποθέσεις και οι μετρήσεις λειτουργίας διαβάζονται από Supabase." : "Οι υποθέσεις λειτουργίας είναι προσωρινά μη διαθέσιμες και δεν χρησιμοποιείται τοπική αλήθεια παραγωγής.",
    },
  ];
};

const categoryText = (lawyer: Lawyer) =>
  [lawyer.specialty, lawyer.specialtyShort, lawyer.bestFor, lawyer.bio, ...lawyer.specialties, ...lawyer.specialtyKeywords].join(" ");

export const getDiscoveryDensityState = (lawyers: Lawyer[]) => {
  const withSignals = lawyers.map((lawyer) => ({
    lawyer,
    signals: getLawyerMarketplaceSignals(lawyer),
  }));
  const verified = withSignals.filter(({ signals }) => signals.verified).length;
  const withPrice = withSignals.filter(({ signals }) => signals.priceFrom > 0).length;
  const availableSoon = withSignals.filter(({ lawyer }) => isAvailableToday(lawyer) || isAvailableTomorrow(lawyer)).length;
  const reviewed = withSignals.filter(({ signals }) => signals.reviewed).length;
  const bookable = withSignals.filter(({ signals }) => signals.bookable).length;

  const checks = [
    { label: "επαληθευμένοι δικηγόροι", count: verified, minimum: discoveryDensityThresholds.minimumVerifiedLawyers },
    { label: "εμφανείς τιμές", count: withPrice, minimum: discoveryDensityThresholds.minimumWithPrice },
    { label: "κοντινή διαθεσιμότητα", count: availableSoon, minimum: discoveryDensityThresholds.minimumAvailableSoon },
    { label: "κριτικές", count: reviewed, minimum: discoveryDensityThresholds.minimumReviewed },
    { label: "κρατήσιμα προφίλ", count: bookable, minimum: discoveryDensityThresholds.minimumBookable },
  ];

  return {
    verified,
    withPrice,
    availableSoon,
    reviewed,
    bookable,
    ready: checks.every((check) => check.count >= check.minimum),
    checks,
  };
};

export const getSupplyReadiness = (lawyers: Lawyer[]) =>
  coreLaunchCities.map((city) => {
    const cityLawyers = lawyers.filter((lawyer) => includesMarketplaceText(lawyer.city, city.query));
    const categories = highIntentCategories.map((category) => {
      const count = cityLawyers.filter((lawyer) =>
        category.queries.some((query) => includesMarketplaceText(categoryText(lawyer), query)),
      ).length;
      return {
        ...category,
        count,
        ready: count >= 2,
      };
    });

    return {
      ...city,
      count: cityLawyers.length,
      ready: cityLawyers.length >= city.minimumVerified,
      categories,
    };
  });

export const getOperationalRulesByArea = (area: OperationalArea) =>
  operatingRules.filter((rule) => rule.area === area);

export const getPaymentReadinessChecks = (): PaymentReadinessCheck[] => {
  const hasSupabaseUrl = Boolean((import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim());
  const hasSupabaseAnonKey = Boolean((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim());
  const localBookingFallback = import.meta.env.VITE_ENABLE_LOCAL_BOOKING_FALLBACK === "true";
  const requireLivePayments = import.meta.env.VITE_REQUIRE_LIVE_PAYMENTS === "true";

  return [
    {
      label: "Το Supabase project είναι ρυθμισμένο",
      ready: hasSupabaseUrl && hasSupabaseAnonKey,
      detail: "Απαιτείται για επαληθευμένες κρατήσεις, εγγραφές πληρωμών, αποδείξεις λογαριασμού και επιβεβαίωση πληρωμών.",
    },
    {
      label: "Τοπική εφεδρική κράτηση απενεργοποιημένη για λανσάρισμα",
      ready: !localBookingFallback,
      detail: "Το λανσάρισμα δεν πρέπει να δέχεται πληρωμένες κρατήσεις που υπάρχουν μόνο στην αποθήκευση του φυλλομετρητή.",
    },
    {
      label: "Απαίτηση πληρωμών παραγωγής",
      ready: requireLivePayments,
      detail: "Ορίστε VITE_REQUIRE_LIVE_PAYMENTS=true στην εφαρμογή και REQUIRE_LIVE_STRIPE=true στις συναρτήσεις πληρωμών.",
    },
    {
      label: "Μοντέλο Stripe Checkout",
      ready: true,
      detail: "Η πληρωμή κράτησης χρησιμοποιεί φιλοξενούμενες συνεδρίες πληρωμής Stripe, με στοιχεία κράτησης στη συνεδρία πληρωμής και στην εντολή πληρωμής.",
    },
    {
      label: "Διαδρομή επιβεβαίωσης πληρωμών",
      ready: true,
      detail: "Το συμβάν Stripe ενημερώνει πληρωμένη, αποτυχημένη και επιστραφείσα κατάσταση και κρατά το πλαίσιο συμβάντος παρόχου.",
    },
  ];
};
