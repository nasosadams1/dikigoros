import { Phone, Users, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { allowedMarketplaceCityNames, legalPracticeAreaLabels } from "@/lib/marketplaceTaxonomy";

export type ConsultationMode = "video" | "phone" | "inPerson";

export interface ConsultationOption {
  mode: ConsultationMode;
  type: string;
  price: number;
  duration: string;
  desc: string;
}

export interface Lawyer {
  id: string;
  name: string;
  specialty: string;
  specialtyShort: string;
  specialties: string[];
  specialtyKeywords: string[];
  bestFor: string;
  city: string;
  rating: number;
  reviews: number;
  experience: number;
  price: number;
  available: string;
  response: string;
  responseMinutes: number;
  consultationModes: ConsultationMode[];
  bio: string;
  education: string;
  languages: string[];
  credentials: string[];
  verification: {
    barAssociation: string;
    registryLabel: string;
    checkedAt: string;
    evidence: string[];
  };
  consultations: ConsultationOption[];
  image: string;
}

export const consultationModeLabels: Record<ConsultationMode, string> = {
  video: "Βιντεοκλήση",
  phone: "Τηλέφωνο",
  inPerson: "Στο γραφείο",
};

export const consultationModeIcons: Record<ConsultationMode, LucideIcon> = {
  video: Video,
  phone: Phone,
  inPerson: Users,
};

export const lawyers: Lawyer[] = [
  {
    id: "maria-papadopoulou",
    name: "Μαρία Παπαδοπούλου",
    specialty: "Οικογενειακό δίκαιο",
    specialtyShort: "Οικογενειακό",
    specialties: ["Διαζύγιο", "Επιμέλεια τέκνων", "Διατροφή", "Περιουσιακές διαφορές", "Ενδοοικογενειακή βία"],
    specialtyKeywords: ["οικογενειακό", "διαζύγιο", "επιμέλεια", "διατροφή", "παιδιά", "γονική μέριμνα"],
    bestFor: "Για διαζύγια, επιμέλεια τέκνων, διατροφή και οικογενειακές περιουσιακές διαφορές με καθαρό πλάνο πρώτων ενεργειών.",
    city: "Αθήνα",
    rating: 4.9,
    reviews: 127,
    experience: 14,
    price: 60,
    available: "Σήμερα, 14:00",
    response: "< 1 ώρα",
    responseMinutes: 55,
    consultationModes: ["video", "phone", "inPerson"],
    bio: "Χειρίζεται υποθέσεις διαζυγίου, επιμέλειας τέκνων, διατροφής και οικογενειακών περιουσιακών διαφορών. Στην πρώτη συμβουλευτική αποσαφηνίζει τα διαθέσιμα έγγραφα, τους άμεσους κινδύνους και τα επόμενα βήματα πριν από οποιαδήποτε δικαστική ή εξωδικαστική ενέργεια. Έχει χειριστεί πάνω από 500 υποθέσεις οικογενειακού δικαίου.",
    education: "Νομική Σχολή Αθηνών · Μεταπτυχιακό Οικογενειακού Δικαίου, Πανεπιστήμιο Αθηνών",
    languages: ["Ελληνικά", "Αγγλικά", "Γαλλικά"],
    credentials: ["Μέλος Δ.Σ. Αθηνών", "500+ υποθέσεις", "Πιστοποιημένη διαμεσολαβήτρια"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Αθηνών",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "10 Απριλίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία"],
    },
    consultations: [
      { mode: "video", type: "Βιντεοκλήση", price: 60, duration: "30 λεπτά", desc: "Αρχική αξιολόγηση υπόθεσης, έλεγχος άμεσων βημάτων και λίστα εγγράφων μέσα από ασφαλή βιντεοκλήση." },
      { mode: "phone", type: "Τηλεφωνική κλήση", price: 50, duration: "30 λεπτά", desc: "Γρήγορη καθοδήγηση για επείγοντα οικογενειακά ζητήματα και προετοιμασία επόμενης ενέργειας." },
      { mode: "inPerson", type: "Στο γραφείο", price: 80, duration: "45 λεπτά", desc: "Αναλυτική εξέταση φακέλου στο γραφείο στην Αθήνα, με οργάνωση εγγράφων και χρονοδιάγραμμα." },
    ],
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "nikos-antoniou",
    name: "Νίκος Αντωνίου",
    specialty: "Εργατικό δίκαιο",
    specialtyShort: "Εργατικό",
    specialties: ["Απολύσεις", "Αποζημιώσεις", "Συμβάσεις εργασίας", "Εργοδοτικές διαφορές"],
    specialtyKeywords: ["εργατικό", "απόλυση", "αποζημίωση", "εργασία", "σύμβαση", "μισθός"],
    bestFor: "Ιδανικός για απολύσεις, εργασιακές αξιώσεις και συμβάσεις απασχόλησης.",
    city: "Θεσσαλονίκη",
    rating: 4.8,
    reviews: 94,
    experience: 18,
    price: 50,
    available: "Αύριο, 10:00",
    response: "< 2 ώρες",
    responseMinutes: 110,
    consultationModes: ["video", "inPerson"],
    bio: "Εξειδίκευση σε απολύσεις, αποζημιώσεις, συμβάσεις εργασίας και εργατικές διαφορές για εργαζόμενους και επιχειρήσεις.",
    education: "Νομική Σχολή ΑΠΘ · Μεταπτυχιακό Εργατικού Δικαίου",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Θεσσαλονίκης", "18 χρόνια εμπειρίας", "Εξειδίκευση σε εργατικές αξιώσεις"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Θεσσαλονίκης",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "9 Απριλίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία"],
    },
    consultations: [
      { mode: "video", type: "Βιντεοκλήση", price: 50, duration: "30 λεπτά", desc: "Ασφαλής βιντεοκλήση μέσω της πλατφόρμας" },
      { mode: "inPerson", type: "Στο γραφείο", price: 70, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο, Θεσσαλονίκη" },
    ],
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "eleni-karagianni",
    name: "Ελένη Καραγιάννη",
    specialty: "Μισθώσεις / ενοίκια / αποδόσεις μισθίου",
    specialtyShort: "Μισθώσεις",
    specialties: ["Μισθώσεις", "Ενοίκια", "Αποδόσεις μισθίου", "Έξωση", "Διαφορές ιδιοκτήτη-μισθωτή"],
    specialtyKeywords: ["μίσθωση", "ενοίκιο", "απόδοση μισθίου", "έξωση", "ιδιοκτήτης", "μισθωτής"],
    bestFor: "Ιδανική για μισθώσεις, ενοίκια, αποδόσεις μισθίου και διαφορές ιδιοκτήτη-μισθωτή.",
    city: "Αθήνα",
    rating: 4.9,
    reviews: 156,
    experience: 21,
    price: 70,
    available: "Σήμερα, 16:30",
    response: "< 30 λεπτά",
    responseMinutes: 30,
    consultationModes: ["video", "phone", "inPerson"],
    bio: "Εξειδίκευση σε μισθώσεις, ενοίκια, αποδόσεις μισθίου, έξωση και διαφορές ιδιοκτήτη-μισθωτή.",
    education: "Νομική Σχολή Αθηνών · Εξειδίκευση στις μισθώσεις",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Αθηνών", "21 χρόνια εμπειρίας", "Έλεγχος τίτλων και συμβάσεων"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Αθηνών",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "10 Απριλίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία"],
    },
    consultations: [
      { mode: "video", type: "Βιντεοκλήση", price: 70, duration: "30 λεπτά", desc: "Ασφαλής βιντεοκλήση μέσω της πλατφόρμας" },
      { mode: "phone", type: "Τηλεφωνική κλήση", price: 60, duration: "30 λεπτά", desc: "Τηλεφωνική συνεδρία με τη δικηγόρο" },
      { mode: "inPerson", type: "Στο γραφείο", price: 90, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο, Αθήνα" },
    ],
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "konstantinos-panou",
    name: "Κωνσταντίνος Πάνου",
    specialty: "Τροχαία / αποζημιώσεις / αυτοκίνητα",
    specialtyShort: "Τροχαία / αποζημιώσεις",
    specialties: ["Τροχαία ατυχήματα", "Αποζημιώσεις", "Ασφαλιστικές απαιτήσεις", "Υλικές ζημιές", "Σωματικές βλάβες"],
    specialtyKeywords: ["τροχαίο", "ατύχημα", "αποζημίωση", "αυτοκίνητο", "ασφάλεια", "σωματική βλάβη"],
    bestFor: "Ιδανικός για τροχαία ατυχήματα, αποζημιώσεις, ασφαλιστικές απαιτήσεις και υποθέσεις αυτοκινήτου.",
    city: "Πειραιάς",
    rating: 4.7,
    reviews: 83,
    experience: 22,
    price: 80,
    available: "Αύριο, 09:00",
    response: "< 3 ώρες",
    responseMinutes: 180,
    consultationModes: ["phone", "inPerson"],
    bio: "Εξειδίκευση σε τροχαία ατυχήματα, ασφαλιστικές απαιτήσεις, αποζημιώσεις και διεκδικήσεις μετά από ζημιά ή τραυματισμό.",
    education: "Νομική Σχολή Θράκης · Αστική ευθύνη και αποζημιώσεις",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Πειραιά", "22 χρόνια εμπειρίας", "Τροχαία και αποζημιώσεις"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Πειραιά",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "8 Απριλίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία"],
    },
    consultations: [
      { mode: "phone", type: "Τηλεφωνική κλήση", price: 80, duration: "30 λεπτά", desc: "Τηλεφωνική συνεδρία με τον δικηγόρο" },
      { mode: "inPerson", type: "Στο γραφείο", price: 120, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο, Πειραιάς" },
    ],
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "sofia-dimitriou",
    name: "Σοφία Δημητρίου",
    specialty: "Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής",
    specialtyShort: "Ενοχικό / οφειλές",
    specialties: ["Οφειλές", "Συμβάσεις", "Διαταγές πληρωμής", "Εξώδικα", "Απαιτήσεις"],
    specialtyKeywords: ["οφειλή", "σύμβαση", "διαταγή πληρωμής", "εξώδικο", "απαίτηση", "χρέος"],
    bestFor: "Ιδανική για οφειλές, συμβάσεις, απαιτήσεις και διαταγές πληρωμής.",
    city: "Πάτρα",
    rating: 4.9,
    reviews: 112,
    experience: 16,
    price: 55,
    available: "Σήμερα, 11:00",
    response: "< 1 ώρα",
    responseMinutes: 60,
    consultationModes: ["video", "phone"],
    bio: "Εξειδίκευση σε οφειλές, συμβάσεις, απαιτήσεις, εξώδικα και διαταγές πληρωμής με καθαρή αξιολόγηση επόμενων βημάτων.",
    education: "Νομική Σχολή Αθηνών · Ιδιωτικό και Ενοχικό Δίκαιο",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Πατρών", "16 χρόνια εμπειρίας", "Οφειλές και συμβάσεις"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Πατρών",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "9 Απριλίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία"],
    },
    consultations: [
      { mode: "video", type: "Βιντεοκλήση", price: 55, duration: "30 λεπτά", desc: "Ασφαλής βιντεοκλήση μέσω της πλατφόρμας" },
      { mode: "phone", type: "Τηλεφωνική κλήση", price: 45, duration: "30 λεπτά", desc: "Τηλεφωνική συνεδρία με τη δικηγόρο" },
    ],
    image: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "andreas-georgiou",
    name: "Ανδρέας Γεωργίου",
    specialty: "Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής",
    specialtyShort: "Ενοχικό / οφειλές",
    specialties: ["Συμβάσεις", "Οφειλές", "Εμπορικές απαιτήσεις", "Διαταγές πληρωμής", "Συναλλαγές"],
    specialtyKeywords: ["σύμβαση", "οφειλή", "διαταγή πληρωμής", "εμπορική απαίτηση", "επιχείρηση", "συναλλαγή"],
    bestFor: "Ιδανικός για συμβάσεις, οφειλές, εμπορικές απαιτήσεις και διαταγές πληρωμής.",
    city: "Ηράκλειο",
    rating: 4.6,
    reviews: 67,
    experience: 12,
    price: 65,
    available: "Αύριο, 13:00",
    response: "< 2 ώρες",
    responseMinutes: 120,
    consultationModes: ["video", "inPerson"],
    bio: "Εξειδίκευση σε συμβάσεις, οφειλές, διαταγές πληρωμής, συναλλαγές και εμπορικές απαιτήσεις.",
    education: "Νομική Σχολή ΑΠΘ · Ενοχικό και Εμπορικό Δίκαιο",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Ηρακλείου", "12 χρόνια εμπειρίας", "Συμβάσεις και οφειλές"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Ηρακλείου",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "8 Απριλίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία"],
    },
    consultations: [
      { mode: "video", type: "Βιντεοκλήση", price: 65, duration: "30 λεπτά", desc: "Ασφαλής βιντεοκλήση μέσω της πλατφόρμας" },
      { mode: "inPerson", type: "Στο γραφείο", price: 85, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο, Ηράκλειο" },
    ],
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "alexandra-marinou",
    name: "Αλεξάνδρα Μαρίνου",
    specialty: "Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής",
    specialtyShort: "Ενοχικό / οφειλές",
    specialties: ["Συμβάσεις", "Οφειλές", "Διαταγές πληρωμής", "Εξώδικα", "Εμπορικές απαιτήσεις"],
    specialtyKeywords: ["σύμβαση", "οφειλή", "διαταγή πληρωμής", "εξώδικο", "απαίτηση", "εταιρεία", "τιμολόγιο"],
    bestFor: "Ιδανική για οφειλές, συμβάσεις, ανεξόφλητα τιμολόγια, εξώδικη όχληση και διαταγές πληρωμής με καθαρό πλάνο ενεργειών.",
    city: "Αθήνα",
    rating: 4.9,
    reviews: 48,
    experience: 13,
    price: 45,
    available: "Σήμερα, 17:00",
    response: "< 45 λεπτά",
    responseMinutes: 45,
    consultationModes: ["video", "phone", "inPerson"],
    bio: "Η Αλεξάνδρα Μαρίνου χειρίζεται υποθέσεις ενοχικού και εμπορικού δικαίου για ιδιώτες και μικρές επιχειρήσεις. Στην πρώτη συμβουλευτική χαρτογραφεί τη σύμβαση, τα διαθέσιμα αποδεικτικά, το πιθανό κόστος και τα επόμενα βήματα πριν από εξώδικο, διαταγή πληρωμής ή διαπραγμάτευση.",
    education: "Νομική Σχολή Αθηνών · Μεταπτυχιακό Εμπορικού Δικαίου, Πανεπιστήμιο Πειραιώς",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Αθηνών", "13 χρόνια εμπειρίας", "Συμβάσεις και εμπορικές απαιτήσεις"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Αθηνών",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "12 Ιουνίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία", "Στοιχεία γραφείου"],
    },
    consultations: [
      { mode: "video", type: "Βιντεοκλήση", price: 45, duration: "30 λεπτά", desc: "Έλεγχος σύμβασης, οφειλής ή εξώδικης ενέργειας με λίστα άμεσων βημάτων." },
      { mode: "phone", type: "Τηλεφωνική κλήση", price: 40, duration: "30 λεπτά", desc: "Γρήγορη καθοδήγηση για οφειλές, τιμολόγια και αρχική στρατηγική είσπραξης." },
      { mode: "inPerson", type: "Στο γραφείο", price: 70, duration: "45 λεπτά", desc: "Αναλυτική εξέταση εγγράφων στο γραφείο στην Αθήνα και προτεινόμενο χρονοδιάγραμμα." },
    ],
    image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "petros-lamprou",
    name: "Πέτρος Λάμπρου",
    specialty: "Εργατικό δίκαιο",
    specialtyShort: "Εργατικό",
    specialties: ["Απολύσεις", "Αποζημιώσεις", "Συμβάσεις εργασίας", "Οφειλόμενοι μισθοί", "Εργοδοτικές διαφορές"],
    specialtyKeywords: ["εργατικό", "απόλυση", "αποζημίωση", "μισθός", "σύμβαση εργασίας", "υπερωρίες", "εργοδότης"],
    bestFor: "Κατάλληλος για απολύσεις, οφειλόμενους μισθούς, υπερωρίες, συμβάσεις εργασίας και διαπραγμάτευση αποζημίωσης.",
    city: "Θεσσαλονίκη",
    rating: 4.8,
    reviews: 63,
    experience: 11,
    price: 35,
    available: "Σήμερα, 18:30",
    response: "< 1 ώρα",
    responseMinutes: 50,
    consultationModes: ["video", "phone", "inPerson"],
    bio: "Ο Πέτρος Λάμπρου συμβουλεύει εργαζόμενους και μικρές επιχειρήσεις σε εργατικές διαφορές, απολύσεις, συμβάσεις, μισθολογικές αξιώσεις και πρακτικά ζητήματα καταγγελίας σύμβασης. Δίνει έμφαση σε ξεκάθαρη εκτίμηση εγγράφων, προθεσμιών και επιλογών επίλυσης.",
    education: "Νομική Σχολή ΑΠΘ · Μεταπτυχιακό Εργατικού Δικαίου",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Θεσσαλονίκης", "11 χρόνια εμπειρίας", "Εργατικές αξιώσεις και συμβάσεις"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Θεσσαλονίκης",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "13 Ιουνίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία"],
    },
    consultations: [
      { mode: "video", type: "Βιντεοκλήση", price: 35, duration: "30 λεπτά", desc: "Αρχική αξιολόγηση απόλυσης, μισθών ή σύμβασης με πρακτικό πλάνο ενεργειών." },
      { mode: "phone", type: "Τηλεφωνική κλήση", price: 30, duration: "30 λεπτά", desc: "Σύντομη τηλεφωνική καθοδήγηση για επείγον εργατικό ζήτημα." },
      { mode: "inPerson", type: "Στο γραφείο", price: 60, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο στη Θεσσαλονίκη με έλεγχο εγγράφων και προθεσμιών." },
    ],
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "ioanna-vasileiou",
    name: "Ιωάννα Βασιλείου",
    specialty: "Οικογενειακό δίκαιο",
    specialtyShort: "Οικογενειακό",
    specialties: ["Διαζύγιο", "Επιμέλεια τέκνων", "Διατροφή", "Γονική μέριμνα", "Συναινετικό διαζύγιο"],
    specialtyKeywords: ["οικογενειακό", "διαζύγιο", "επιμέλεια", "διατροφή", "γονική μέριμνα", "συναινετικό"],
    bestFor: "Ιδανική για συναινετικό ή αντιδικία διαζύγιο, επιμέλεια, διατροφή και γονική μέριμνα με ήρεμη, οργανωμένη προσέγγιση.",
    city: "Πάτρα",
    rating: 4.9,
    reviews: 72,
    experience: 15,
    price: 50,
    available: "Αύριο, 09:30",
    response: "< 2 ώρες",
    responseMinutes: 95,
    consultationModes: ["video", "phone", "inPerson"],
    bio: "Η Ιωάννα Βασιλείου χειρίζεται οικογενειακές υποθέσεις με έμφαση στην προστασία παιδιών, τη ρεαλιστική αποτύπωση επιλογών και την προετοιμασία εγγράφων πριν από διαπραγμάτευση ή δικαστική ενέργεια. Η πρώτη συμβουλευτική εστιάζει σε προτεραιότητες, κινδύνους και χρονοδιάγραμμα.",
    education: "Νομική Σχολή Θράκης · Εξειδίκευση στο Οικογενειακό Δίκαιο",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Πατρών", "15 χρόνια εμπειρίας", "Οικογενειακές διαφορές και διαμεσολάβηση"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Πατρών",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "13 Ιουνίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία", "Στοιχεία γραφείου"],
    },
    consultations: [
      { mode: "video", type: "Βιντεοκλήση", price: 50, duration: "30 λεπτά", desc: "Πρώτη αξιολόγηση οικογενειακής υπόθεσης, επιλογές επίλυσης και λίστα εγγράφων." },
      { mode: "phone", type: "Τηλεφωνική κλήση", price: 45, duration: "30 λεπτά", desc: "Γρήγορη καθοδήγηση για διαζύγιο, επιμέλεια ή διατροφή." },
      { mode: "inPerson", type: "Στο γραφείο", price: 75, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο στην Πάτρα με αναλυτική εξέταση φακέλου." },
    ],
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "dimitris-stavrou",
    name: "Δημήτρης Σταύρου",
    specialty: "Μισθώσεις / ενοίκια / αποδόσεις μισθίου",
    specialtyShort: "Μισθώσεις",
    specialties: ["Μισθώσεις", "Ενοίκια", "Αποδόσεις μισθίου", "Έξωση", "Διαφορές ιδιοκτήτη-μισθωτή"],
    specialtyKeywords: ["μίσθωση", "ενοίκιο", "απόδοση μισθίου", "έξωση", "ιδιοκτήτης", "μισθωτής", "ακίνητο"],
    bestFor: "Κατάλληλος για μισθώσεις, οφειλόμενα ενοίκια, απόδοση μισθίου, εξώσεις και διαφορές ιδιοκτήτη-μισθωτή.",
    city: "Ηράκλειο",
    rating: 4.7,
    reviews: 39,
    experience: 10,
    price: 40,
    available: "Σήμερα, 12:30",
    response: "< 90 λεπτά",
    responseMinutes: 90,
    consultationModes: ["video", "phone", "inPerson"],
    bio: "Ο Δημήτρης Σταύρου υποστηρίζει ιδιοκτήτες και μισθωτές σε ζητήματα κατοικιών και επαγγελματικών μισθώσεων. Ελέγχει μισθωτήρια, αποδείξεις, εξώδικα και προθεσμίες ώστε η επόμενη ενέργεια να είναι τεκμηριωμένη και αναλογική.",
    education: "Νομική Σχολή Αθηνών · Αστικό Δίκαιο και Μισθώσεις",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Ηρακλείου", "10 χρόνια εμπειρίας", "Μισθώσεις και ακίνητα"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Ηρακλείου",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "14 Ιουνίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία"],
    },
    consultations: [
      { mode: "video", type: "Βιντεοκλήση", price: 40, duration: "30 λεπτά", desc: "Έλεγχος μισθωτηρίου, οφειλών ή απόδοσης μισθίου με προτεινόμενη επόμενη ενέργεια." },
      { mode: "phone", type: "Τηλεφωνική κλήση", price: 35, duration: "30 λεπτά", desc: "Σύντομη τηλεφωνική καθοδήγηση για ενοίκια, εξώδικο ή προθεσμίες." },
      { mode: "inPerson", type: "Στο γραφείο", price: 65, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο στο Ηράκλειο με έλεγχο εγγράφων." },
    ],
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=600&fit=crop&crop=face",
  },
];

export const findLawyerById = (id?: string) => lawyers.find((lawyer) => lawyer.id === id);

export const specialtyOptions = [...legalPracticeAreaLabels];

export const cityOptions = [...allowedMarketplaceCityNames];
