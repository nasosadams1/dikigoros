import { cityDirectory, getDiscoveryConfig, issueDirectory } from "@/lib/marketplace";

export const siteName = "Dikigoros";
export const defaultSeoDescription =
  "Compare verified lawyers in Greece, book a consultation, pay securely, and manage documents, receipts, reviews, and support.";

export interface SeoConfig {
  title: string;
  description: string;
  path: string;
}

export const withSiteName = (title: string) => `${title} | ${siteName}`;

export const staticSeoRoutes: SeoConfig[] = [
  {
    path: "/",
    title: withSiteName("Find and book a verified lawyer"),
    description: defaultSeoDescription,
  },
  {
    path: "/search",
    title: withSiteName("Compare lawyers"),
    description: "Compare lawyers by issue, city, response speed, availability, review proof, consultation mode, and starting price.",
  },
  {
    path: "/for-lawyers",
    title: withSiteName("For lawyers and firms"),
    description: "Get better-qualified consultations, availability control, booking management, verified reviews, and a public profile.",
  },
  {
    path: "/help",
    title: withSiteName("Support center"),
    description: "Support for bookings, payments, refunds, documents, privacy requests, account access, and complaints.",
  },
  {
    path: "/operations",
    title: withSiteName("Production operations"),
    description: "Operational readiness for payments, supply density, verification, reviews, disputes, support, privacy, and security.",
  },
  {
    path: "/trust/verification-standards",
    title: withSiteName("Verification standards"),
    description: "What verified lawyer profiles mean, what is checked, and what verification does not guarantee.",
  },
  {
    path: "/trust/reviews-policy",
    title: withSiteName("Review policy"),
    description: "Who can review, when reviews go live, moderation rules, dispute handling, and lawyer replies.",
  },
  {
    path: "/trust/payments-refunds",
    title: withSiteName("Payments and refunds"),
    description: "Payment timing, Stripe-backed checkout, receipts, cancellation rules, refund handling, and payment issue support.",
  },
  {
    path: "/trust/privacy-documents",
    title: withSiteName("Privacy and documents"),
    description: "Document visibility, access, retention, deletion requests, and secure client account handling.",
  },
  {
    path: "/trust/support-complaints",
    title: withSiteName("Support and complaints"),
    description: "Support response paths for booking failures, payment issues, privacy requests, review disputes, and complaints.",
  },
  {
    path: "/trust/security",
    title: withSiteName("Security handling"),
    description: "Security controls, sensitive data handling, incident response, and account protection standards.",
  },
];

export const getDiscoverySeo = (issueSlug?: string, citySlug?: string): SeoConfig => {
  const config = getDiscoveryConfig(issueSlug, citySlug);
  const path = config.city ? `/lawyers/${config.issue.slug}/${config.city.slug}` : `/lawyers/${config.issue.slug}`;
  const title = config.city
    ? `${config.issue.title} in ${config.city.title}`
    : config.issue.title;

  return {
    path,
    title: withSiteName(title),
    description: config.city
      ? `${config.issue.description} Compare verified lawyers serving ${config.city.title} with availability, reviews, and pricing.`
      : `${config.issue.description} Compare verified lawyers with availability, reviews, consultation modes, and pricing.`,
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

