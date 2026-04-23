import { Link } from "react-router-dom";
import { homepageCopy } from "@/lib/homepageCopy";

const legalTopicLinks = [
  { label: homepageCopy.footer.columns.legalTopics.links[0], to: "/search" },
  { label: homepageCopy.footer.columns.legalTopics.links[1], to: "/lawyers/family-law" },
  { label: homepageCopy.footer.columns.legalTopics.links[2], to: "/lawyers/employment-law/athens" },
  { label: homepageCopy.footer.columns.legalTopics.links[3], to: "/lawyers/leases-rent-evictions/thessaloniki" },
];

const lawyerLinks = [
  { label: homepageCopy.footer.columns.forLawyers.links[0], to: "/for-lawyers/apply" },
  { label: homepageCopy.footer.columns.forLawyers.links[1], to: "/for-lawyers#workflow" },
  { label: homepageCopy.footer.columns.forLawyers.links[2], to: "/for-lawyers/apply" },
];

const trustLinks = [
  { label: homepageCopy.footer.columns.trust.links[0], to: "/trust/verification-standards" },
  { label: homepageCopy.footer.columns.trust.links[1], to: "/trust/reviews-policy" },
  { label: homepageCopy.footer.columns.trust.links[2], to: "/trust/payments-refunds" },
];

const supportLinks = [
  { label: homepageCopy.footer.columns.support.links[0], to: "/help" },
];

const Footer = () => {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground">
                <span className="font-serif text-lg text-primary">Δ</span>
              </div>
              <span className="font-serif text-xl tracking-tight">Dikigoros</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
              {homepageCopy.footer.brandDescription}
            </p>
          </div>

          <FooterColumn title={homepageCopy.footer.columns.legalTopics.title} links={legalTopicLinks} />
          <FooterColumn title={homepageCopy.footer.columns.forLawyers.title} links={lawyerLinks} />
          <FooterColumn title={homepageCopy.footer.columns.trust.title} links={trustLinks} />
          <FooterColumn title={homepageCopy.footer.columns.support.title} links={supportLinks} />
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/10 pt-8 md:flex-row">
          <p className="text-xs text-primary-foreground/50">{homepageCopy.footer.copyright}</p>
          <p className="text-xs text-primary-foreground/50">{homepageCopy.footer.madeIn}</p>
        </div>
      </div>
    </footer>
  );
};

const FooterColumn = ({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; to: string }>;
}) => (
  <div>
    <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary-foreground/50">{title}</h4>
    <ul className="space-y-3">
      {links.map((link) => (
        <li key={`${link.label}-${link.to}`}>
          <Link to={link.to} className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground">
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

export default Footer;
