export interface LegalPracticeArea {
  slug: string;
  label: string;
  shortLabel: string;
  query: string;
  journeyTitle: string;
  discoveryTitle: string;
  description: string;
  keywords: string[];
}

export interface MarketplaceCity {
  slug: string;
  title: string;
  inTitle: string;
  query: string;
  minimumVerified: number;
  aliases: string[];
}

export const legalPracticeAreas: LegalPracticeArea[] = [
  {
    slug: "civil-debts-contracts",
    label: "Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής",
    shortLabel: "Ενοχικό / οφειλές",
    query: "οφειλές συμβάσεις διαταγές πληρωμής",
    journeyTitle: "Οφειλές, συμβάσεις ή διαταγή πληρωμής",
    discoveryTitle: "Δικηγόροι για οφειλές, συμβάσεις και διαταγές πληρωμής",
    description:
      "Συγκρίνετε δικηγόρους για οφειλές, συμβάσεις, απαιτήσεις, εξώδικα και διαταγές πληρωμής.",
    keywords: [
      "ενοχικό",
      "ενοχικο",
      "οφειλές",
      "οφειλες",
      "χρέη",
      "χρεη",
      "σύμβαση",
      "συμβαση",
      "συμβάσεις",
      "συμβασεις",
      "διαταγή πληρωμής",
      "διαταγη πληρωμης",
      "απαιτήσεις",
      "απαιτησεις",
      "εξώδικο",
      "εξωδικο",
      "εμπορικό",
      "εμπορικο",
      "εταιρεία",
      "εταιρεια",
      "κληρονομικό",
      "κληρονομικο",
    ],
  },
  {
    slug: "family-law",
    label: "Οικογενειακό δίκαιο",
    shortLabel: "Οικογενειακό",
    query: "οικογενειακό διαζύγιο επιμέλεια διατροφή",
    journeyTitle: "Οικογενειακό δίκαιο",
    discoveryTitle: "Δικηγόροι οικογενειακού δικαίου",
    description:
      "Βρείτε δικηγόρους για διαζύγιο, επιμέλεια, διατροφή, γονική μέριμνα και οικογενειακές διαφορές.",
    keywords: [
      "οικογενειακό",
      "οικογενειακο",
      "διαζύγιο",
      "διαζυγιο",
      "επιμέλεια",
      "επιμελεια",
      "διατροφή",
      "διατροφη",
      "γονική",
      "γονικη",
      "family",
      "divorce",
      "custody",
    ],
  },
  {
    slug: "traffic-compensation-cars",
    label: "Τροχαία / αποζημιώσεις / αυτοκίνητα",
    shortLabel: "Τροχαία / αποζημιώσεις",
    query: "τροχαίο αποζημίωση αυτοκίνητο",
    journeyTitle: "Τροχαία και αποζημιώσεις",
    discoveryTitle: "Δικηγόροι για τροχαία και αποζημιώσεις",
    description:
      "Βρείτε δικηγόρους για τροχαία ατυχήματα, ασφαλιστικές απαιτήσεις, αποζημιώσεις και υποθέσεις αυτοκινήτου.",
    keywords: [
      "τροχαία",
      "τροχαια",
      "τροχαίο",
      "τροχαιο",
      "ατύχημα",
      "ατυχημα",
      "αποζημίωση",
      "αποζημιωση",
      "αποζημιώσεις",
      "αποζημιωσεις",
      "αυτοκίνητο",
      "αυτοκινητο",
      "αυτοκίνητα",
      "αυτοκινητα",
      "ασφάλεια",
      "ασφαλεια",
      "traffic",
      "car",
      "compensation",
    ],
  },
  {
    slug: "employment-law",
    label: "Εργατικό δίκαιο",
    shortLabel: "Εργατικό",
    query: "εργατικό απόλυση μισθοί σύμβαση εργασίας",
    journeyTitle: "Εργατικό δίκαιο",
    discoveryTitle: "Δικηγόροι εργατικού δικαίου",
    description:
      "Συγκρίνετε δικηγόρους για απόλυση, οφειλόμενους μισθούς, συμβάσεις εργασίας και εργασιακές αξιώσεις.",
    keywords: [
      "εργατικό",
      "εργατικο",
      "εργασία",
      "εργασια",
      "απόλυση",
      "απολυση",
      "μισθός",
      "μισθος",
      "μισθοί",
      "μισθοι",
      "σύμβαση εργασίας",
      "συμβαση εργασιας",
      "employment",
      "dismissal",
    ],
  },
  {
    slug: "leases-rent-evictions",
    label: "Μισθώσεις / ενοίκια / αποδόσεις μισθίου",
    shortLabel: "Μισθώσεις",
    query: "μισθώσεις ενοίκια απόδοση μισθίου",
    journeyTitle: "Μισθώσεις και ενοίκια",
    discoveryTitle: "Δικηγόροι για μισθώσεις, ενοίκια και αποδόσεις μισθίου",
    description:
      "Βρείτε δικηγόρους για μισθώσεις, ενοίκια, αποδόσεις μισθίου, εξώσεις και διαφορές ιδιοκτήτη-μισθωτή.",
    keywords: [
      "μίσθωση",
      "μισθωση",
      "μισθώσεις",
      "μισθωσεις",
      "ενοίκιο",
      "ενοικιο",
      "ενοίκια",
      "ενοικια",
      "απόδοση μισθίου",
      "αποδοση μισθιου",
      "μισθίου",
      "μισθιου",
      "έξωση",
      "εξωση",
      "ακίνητα",
      "ακινητα",
      "κτηματολόγιο",
      "κτηματολογιο",
      "lease",
      "rent",
      "eviction",
    ],
  },
];

export const legalPracticeAreaLabels = legalPracticeAreas.map((area) => area.label);

export const allowedMarketplaceCities: MarketplaceCity[] = [
  { slug: "athens", title: "Αθήνα", inTitle: "στην Αθήνα", query: "Αθήνα", minimumVerified: 8, aliases: ["athens", "athina", "αθηνα"] },
  {
    slug: "thessaloniki",
    title: "Θεσσαλονίκη",
    inTitle: "στη Θεσσαλονίκη",
    query: "Θεσσαλονίκη",
    minimumVerified: 5,
    aliases: ["thessaloniki", "θεσσαλονικη"],
  },
  { slug: "piraeus", title: "Πειραιάς", inTitle: "στον Πειραιά", query: "Πειραιάς", minimumVerified: 3, aliases: ["piraeus", "pireas", "πειραιας"] },
  { slug: "heraklion", title: "Ηράκλειο", inTitle: "στο Ηράκλειο", query: "Ηράκλειο", minimumVerified: 3, aliases: ["heraklion", "iraklio", "ηρακλειο"] },
  { slug: "patra", title: "Πάτρα", inTitle: "στην Πάτρα", query: "Πάτρα", minimumVerified: 3, aliases: ["patra", "patras", "πατρα"] },
];

export const allowedMarketplaceCityNames = allowedMarketplaceCities.map((city) => city.title);

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("el-GR")
    .trim();

export const getPracticeAreaBySlug = (slug?: string) =>
  legalPracticeAreas.find((area) => area.slug === slug);

export const getCityBySlug = (slug?: string) =>
  allowedMarketplaceCities.find((city) => city.slug === slug);

export const normalizeLegalPracticeArea = (value?: string | null) => {
  const normalized = normalize(value || "");
  if (!normalized) return "";

  const direct = legalPracticeAreas.find(
    (area) =>
      normalize(area.label) === normalized ||
      normalize(area.shortLabel) === normalized ||
      normalize(area.discoveryTitle) === normalized,
  );
  if (direct) return direct.label;

  const employment = legalPracticeAreas.find((area) => area.slug === "employment-law")!;
  if (employment.keywords.some((keyword) => normalized.includes(normalize(keyword)))) return employment.label;

  const family = legalPracticeAreas.find((area) => area.slug === "family-law")!;
  if (family.keywords.some((keyword) => normalized.includes(normalize(keyword)))) return family.label;

  const leases = legalPracticeAreas.find((area) => area.slug === "leases-rent-evictions")!;
  if (leases.keywords.some((keyword) => normalized.includes(normalize(keyword)))) return leases.label;

  const traffic = legalPracticeAreas.find((area) => area.slug === "traffic-compensation-cars")!;
  if (traffic.keywords.some((keyword) => normalized.includes(normalize(keyword)))) return traffic.label;

  const civil = legalPracticeAreas.find((area) => area.slug === "civil-debts-contracts")!;
  if (civil.keywords.some((keyword) => normalized.includes(normalize(keyword)))) return civil.label;

  return "";
};

export const normalizeLegalPracticeAreas = (values: string[]) => {
  const normalized = values.map(normalizeLegalPracticeArea).filter(Boolean);
  return Array.from(new Set(normalized));
};

export const normalizeAllowedMarketplaceCity = (value?: string | null) => {
  const normalized = normalize(value || "");
  if (!normalized) return "";

  const direct = allowedMarketplaceCities.find(
    (city) =>
      normalize(city.title) === normalized ||
      normalize(city.query) === normalized ||
      city.aliases.some((alias) => normalize(alias) === normalized),
  );

  return direct?.title || "";
};
