import { Phone, Users, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  phone: "Τηλεφωνικό",
  inPerson: "Αυτοπρόσωπο",
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
    specialty: "Οικογενειακό Δίκαιο",
    specialtyShort: "Οικογενειακό",
    specialties: ["Διαζύγιο", "Επιμέλεια τέκνων", "Διατροφή", "Περιουσιακές διαφορές", "Ενδοοικογενειακή βία"],
    specialtyKeywords: ["οικογενειακό", "διαζύγιο", "επιμέλεια", "διατροφή", "παιδιά", "γονική μέριμνα"],
    bestFor: "Ιδανική για διαζύγια, επιμέλεια τέκνων και οικογενειακές περιουσιακές διαφορές.",
    city: "Αθήνα",
    rating: 4.9,
    reviews: 127,
    experience: 14,
    price: 60,
    available: "Σήμερα, 14:00",
    response: "< 1 ώρα",
    responseMinutes: 55,
    consultationModes: ["video", "phone"],
    bio: "Εξειδίκευση σε διαζύγια, επιμέλεια τέκνων, διατροφή και οικογενειακές διαφορές. Έχει χειριστεί πάνω από 500 υποθέσεις οικογενειακού δικαίου.",
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
      { mode: "video", type: "Βιντεοκλήση", price: 60, duration: "30 λεπτά", desc: "Ασφαλής βιντεοκλήση μέσω της πλατφόρμας" },
      { mode: "phone", type: "Τηλεφωνική κλήση", price: 50, duration: "30 λεπτά", desc: "Τηλεφωνική συνεδρία με τη δικηγόρο" },
      { mode: "inPerson", type: "Αυτοπρόσωπα", price: 80, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο, Αθήνα" },
    ],
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "nikos-antoniou",
    name: "Νίκος Αντωνίου",
    specialty: "Εργατικό Δίκαιο",
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
      { mode: "inPerson", type: "Αυτοπρόσωπα", price: 70, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο, Θεσσαλονίκη" },
    ],
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "eleni-karagianni",
    name: "Ελένη Καραγιάννη",
    specialty: "Ακίνητα & Μισθώσεις",
    specialtyShort: "Ακίνητα",
    specialties: ["Αγοραπωλησίες", "Μισθώσεις", "Έλεγχος τίτλων", "Κτηματολόγιο", "Διαφορές ακινήτων"],
    specialtyKeywords: ["ακίνητα", "μίσθωση", "ενοίκιο", "κτηματολόγιο", "αγορά", "πώληση", "τίτλοι"],
    bestFor: "Ιδανική για αγοραπωλησίες, μισθώσεις, έλεγχο τίτλων και κτηματολογικά θέματα.",
    city: "Αθήνα",
    rating: 4.9,
    reviews: 156,
    experience: 21,
    price: 70,
    available: "Σήμερα, 16:30",
    response: "< 30 λεπτά",
    responseMinutes: 30,
    consultationModes: ["video", "phone", "inPerson"],
    bio: "Εξειδίκευση σε αγοραπωλησίες ακινήτων, μισθώσεις, έλεγχο τίτλων και διαφορές που σχετίζονται με ακίνητη περιουσία.",
    education: "Νομική Σχολή Αθηνών · Εξειδίκευση στο δίκαιο ακινήτων",
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
      { mode: "inPerson", type: "Αυτοπρόσωπα", price: 90, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο, Αθήνα" },
    ],
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "konstantinos-panou",
    name: "Κωνσταντίνος Πάνου",
    specialty: "Ποινικό Δίκαιο",
    specialtyShort: "Ποινικό",
    specialties: ["Ποινική υπεράσπιση", "Αυτόφωρο", "Μηνύσεις", "Δικαστική παράσταση"],
    specialtyKeywords: ["ποινικό", "μήνυση", "αυτόφωρο", "υπεράσπιση", "δικαστήριο", "κατηγορία"],
    bestFor: "Ιδανικός για ποινική υπεράσπιση, αυτόφωρη διαδικασία και παραστάσεις σε δικαστήρια.",
    city: "Αθήνα",
    rating: 4.7,
    reviews: 83,
    experience: 22,
    price: 80,
    available: "Αύριο, 09:00",
    response: "< 3 ώρες",
    responseMinutes: 180,
    consultationModes: ["phone", "inPerson"],
    bio: "Εξειδίκευση σε ποινική υπεράσπιση, αυτόφωρη διαδικασία, μηνύσεις και παραστάσεις ενώπιον ποινικών δικαστηρίων.",
    education: "Νομική Σχολή Θράκης · Ποινικό Δίκαιο και Ποινική Δικονομία",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Αθηνών", "22 χρόνια εμπειρίας", "Ποινική υπεράσπιση"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Αθηνών",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "8 Απριλίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία"],
    },
    consultations: [
      { mode: "phone", type: "Τηλεφωνική κλήση", price: 80, duration: "30 λεπτά", desc: "Τηλεφωνική συνεδρία με τον δικηγόρο" },
      { mode: "inPerson", type: "Αυτοπρόσωπα", price: 120, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο, Αθήνα" },
    ],
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop&crop=face",
  },
  {
    id: "sofia-dimitriou",
    name: "Σοφία Δημητρίου",
    specialty: "Κληρονομικό Δίκαιο",
    specialtyShort: "Κληρονομικό",
    specialties: ["Διαθήκες", "Αποδοχή κληρονομιάς", "Αποποίηση", "Κληρονομικές διαφορές"],
    specialtyKeywords: ["κληρονομικό", "διαθήκη", "κληρονομιά", "αποδοχή", "αποποίηση", "περιουσία"],
    bestFor: "Ιδανική για διαθήκες, αποδοχή ή αποποίηση κληρονομιάς και κληρονομικές διαφορές.",
    city: "Πάτρα",
    rating: 4.9,
    reviews: 112,
    experience: 16,
    price: 55,
    available: "Σήμερα, 11:00",
    response: "< 1 ώρα",
    responseMinutes: 60,
    consultationModes: ["video", "phone"],
    bio: "Εξειδίκευση σε κληρονομικά θέματα, διαθήκες, αποδοχή και αποποίηση κληρονομιάς, καθώς και κληρονομικές διαφορές.",
    education: "Νομική Σχολή Αθηνών · Ιδιωτικό και Κληρονομικό Δίκαιο",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Πατρών", "16 χρόνια εμπειρίας", "Κληρονομικές υποθέσεις"],
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
    specialty: "Εμπορικό Δίκαιο",
    specialtyShort: "Εμπορικό",
    specialties: ["Εταιρείες", "Συμβάσεις", "Εμπορικές διαφορές", "Οφειλές", "Συναλλαγές"],
    specialtyKeywords: ["εμπορικό", "εταιρεία", "σύμβαση", "οφειλή", "επιχείρηση", "συναλλαγή"],
    bestFor: "Ιδανικός για εταιρικά θέματα, εμπορικές συμβάσεις και διαφορές μεταξύ επιχειρήσεων.",
    city: "Θεσσαλονίκη",
    rating: 4.6,
    reviews: 67,
    experience: 12,
    price: 65,
    available: "Αύριο, 13:00",
    response: "< 2 ώρες",
    responseMinutes: 120,
    consultationModes: ["video", "inPerson"],
    bio: "Εξειδίκευση σε εμπορικές συμβάσεις, εταιρικά ζητήματα, οφειλές, συναλλαγές και εμπορικές διαφορές.",
    education: "Νομική Σχολή ΑΠΘ · Εμπορικό και Εταιρικό Δίκαιο",
    languages: ["Ελληνικά", "Αγγλικά"],
    credentials: ["Μέλος Δ.Σ. Θεσσαλονίκης", "12 χρόνια εμπειρίας", "Εταιρικές συμβάσεις"],
    verification: {
      barAssociation: "Δικηγορικός Σύλλογος Θεσσαλονίκης",
      registryLabel: "Μητρώο επιβεβαιωμένο",
      checkedAt: "8 Απριλίου 2026",
      evidence: ["Ταυτοποίηση", "Άδεια άσκησης", "Επαγγελματικά στοιχεία"],
    },
    consultations: [
      { mode: "video", type: "Βιντεοκλήση", price: 65, duration: "30 λεπτά", desc: "Ασφαλής βιντεοκλήση μέσω της πλατφόρμας" },
      { mode: "inPerson", type: "Αυτοπρόσωπα", price: 85, duration: "45 λεπτά", desc: "Συνάντηση στο γραφείο, Θεσσαλονίκη" },
    ],
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&h=600&fit=crop&crop=face",
  },
];

export const findLawyerById = (id?: string) => lawyers.find((lawyer) => lawyer.id === id);

export const specialtyOptions = Array.from(new Set(lawyers.map((lawyer) => lawyer.specialty)));

export const cityOptions = Array.from(new Set(lawyers.map((lawyer) => lawyer.city)));
