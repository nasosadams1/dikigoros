import { cityDirectory, getDiscoveryConfig, issueDirectory } from "@/lib/marketplace";

export const siteName = "Dikigoros";
export const defaultSeoDescription =
  "Συγκρίνετε ελεγμένα προφίλ δικηγόρων στην Ελλάδα, κλείστε συμβουλευτική με ασφαλή πληρωμή και διαχειριστείτε έγγραφα, αποδείξεις, αξιολογήσεις και υποστήριξη.";

export interface SeoConfig {
  title: string;
  description: string;
  path: string;
}

export const withSiteName = (title: string) => `${title} | ${siteName}`;

export const staticSeoRoutes: SeoConfig[] = [
  {
    path: "/",
    title: withSiteName("Βρείτε και κλείστε ραντεβού με δικηγόρο"),
    description: defaultSeoDescription,
  },
  {
    path: "/search",
    title: withSiteName("Βρες δικηγόρο"),
    description: "Αναζητήστε δικηγόρους ανά θέμα, πόλη, ταχύτητα απάντησης, διαθεσιμότητα, αξιολογήσεις, τρόπο ραντεβού και τιμή.",
  },
  {
    path: "/intake",
    title: withSiteName("Guided legal intake"),
    description: "Share city, legal category, urgency, budget, consultation mode, and a short issue summary so the marketplace can route you to ranked verified lawyers.",
  },
  {
    path: "/for-lawyers",
    title: withSiteName("Για δικηγόρους και γραφεία"),
    description: "Πιο κατάλληλες συμβουλευτικές, έλεγχος διαθεσιμότητας, διαχείριση κρατήσεων, επαληθευμένες αξιολογήσεις και δημόσιο προφίλ.",
  },
  {
    path: "/for-lawyers/plans",
    title: withSiteName("Partner plans for lawyers"),
    description: "Basic, Pro, and Premium plans for verified lawyers with labeled visibility, analytics, CRM pipeline tooling, follow-up tasks, and Stripe subscription checkout.",
  },
  {
    path: "/help",
    title: withSiteName("Κέντρο υποστήριξης"),
    description: "Υποστήριξη για κρατήσεις, πληρωμές, επιστροφές, έγγραφα, αιτήματα απορρήτου, πρόσβαση λογαριασμού και παράπονα.",
  },
  {
    path: "/operations",
    title: withSiteName("Λειτουργίες παραγωγής"),
    description: "Επιχειρησιακή ετοιμότητα για πληρωμές, πυκνότητα προσφοράς, επαλήθευση, αξιολογήσεις, διαφωνίες, υποστήριξη, απόρρητο και ασφάλεια.",
  },
  {
    path: "/trust/verification-standards",
    title: withSiteName("Πρότυπα επαλήθευσης"),
    description: "Τι σημαίνει επαληθευμένο προφίλ δικηγόρου, τι ελέγχεται και τι δεν εγγυάται η επαλήθευση.",
  },
  {
    path: "/trust/reviews-policy",
    title: withSiteName("Πολιτική αξιολογήσεων"),
    description: "Ποιος μπορεί να αξιολογήσει, πότε δημοσιεύονται οι κριτικές, έλεγχος δημοσίευσης, διαφωνίες και απαντήσεις δικηγόρων.",
  },
  {
    path: "/trust/payments-refunds",
    title: withSiteName("Πληρωμές και επιστροφές"),
    description: "Χρόνος πληρωμής, Stripe Checkout, αποδείξεις, κανόνες ακύρωσης, επιστροφές και υποστήριξη πληρωμών.",
  },
  {
    path: "/trust/privacy-documents",
    title: withSiteName("Απόρρητο και έγγραφα"),
    description: "Ορατότητα εγγράφων, πρόσβαση, διατήρηση, αιτήματα διαγραφής και ασφαλής χειρισμός λογαριασμού πελάτη.",
  },
  {
    path: "/trust/support-complaints",
    title: withSiteName("Υποστήριξη και παράπονα"),
    description: "Διαδρομές υποστήριξης για αποτυχίες κράτησης, πληρωμές, απόρρητο, διαφωνίες αξιολογήσεων και παράπονα.",
  },
  {
    path: "/trust/security",
    title: withSiteName("Χειρισμός ασφάλειας"),
    description: "Έλεγχοι ασφάλειας, χειρισμός ευαίσθητων δεδομένων, απόκριση περιστατικών και πρότυπα προστασίας λογαριασμού.",
  },
];

export const getDiscoverySeo = (issueSlug?: string, citySlug?: string): SeoConfig => {
  const config = getDiscoveryConfig(issueSlug, citySlug);
  const path = config.city ? `/lawyers/${config.issue.slug}/${config.city.slug}` : `/lawyers/${config.issue.slug}`;
  const title = config.city
    ? `${config.issue.title} ${config.city.inTitle}`
    : config.issue.title;

  return {
    path,
    title: withSiteName(title),
    description: config.city
      ? `${config.issue.description} Συγκρίνετε ελεγμένα προφίλ που εξυπηρετούν ${config.city.title} με διαθεσιμότητα, αξιολογήσεις και τιμές.`
      : `${config.issue.description} Συγκρίνετε ελεγμένα προφίλ με διαθεσιμότητα, αξιολογήσεις, τρόπους συμβουλευτικής και τιμές.`,
  };
};

export const getAllDiscoverySeoRoutes = () => [
  ...issueDirectory.map((issue) => getDiscoverySeo(issue.slug)),
  ...issueDirectory.flatMap((issue) =>
    cityDirectory.map((city) => getDiscoverySeo(issue.slug, city.slug)),
  ),
];

export const getSitemapEntries = (origin = "https://dikigoros.gr") =>
  [...staticSeoRoutes, ...getAllDiscoverySeoRoutes()].map((route) => ({
    ...route,
    loc: `${origin.replace(/\/+$/, "")}${route.path}`,
  }));
