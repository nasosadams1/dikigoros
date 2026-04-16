import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CalendarDays, MapPin, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import { getLawyers } from "@/lib/lawyerRepository";
import { defaultLawyerSearchFilters, searchLawyers } from "@/lib/lawyerSearch";
import { cityDirectory, formatCurrency, getDiscoveryConfig, issueDirectory } from "@/lib/marketplace";
import { getDiscoverySeo } from "@/lib/seo";

const DiscoveryPage = () => {
  const { issueSlug, citySlug } = useParams();
  const config = getDiscoveryConfig(issueSlug, citySlug);
  const seo = getDiscoverySeo(issueSlug, citySlug);
  const { data: marketplaceLawyers = [] } = useQuery({ queryKey: ["lawyers"], queryFn: getLawyers });
  const lawyers = useMemo(
    () =>
      searchLawyers(marketplaceLawyers, {
        ...defaultLawyerSearchFilters,
        query: config.issue.query,
        city: config.city?.query || "",
      }).slice(0, 6),
    [config.city?.query, config.issue.query, marketplaceLawyers],
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO title={seo.title} description={seo.description} path={seo.path} />
      <Navbar />
      <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">{config.issue.specialtyHint}</p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight text-foreground">{config.title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">{config.description}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-lg font-bold">
                <Link to={config.searchPath}>
                  Compare lawyers
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-lg font-bold">
                <Link to="/trust/verification-standards">Read trust standards</Link>
              </Button>
            </div>
          </section>

          <aside className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-bold text-foreground">Discovery paths</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {issueDirectory.map((issue) => (
                <Link key={issue.slug} to={`/lawyers/${issue.slug}`} className="rounded-lg border border-border bg-background p-3 text-sm font-bold text-foreground transition hover:border-primary/25">
                  {issue.title}
                </Link>
              ))}
              {cityDirectory.slice(0, 2).map((city) => (
                <Link key={city.slug} to={`/lawyers/${config.issue.slug}/${city.slug}`} className="rounded-lg border border-border bg-background p-3 text-sm font-bold text-foreground transition hover:border-primary/25">
                  {config.issue.title} in {city.title}
                </Link>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-10">
          <h2 className="font-serif text-2xl tracking-tight text-foreground">Bookable lawyers for this journey</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lawyers.length > 0 ? lawyers.map((lawyer) => (
              <Link key={lawyer.id} to={`/lawyer/${lawyer.id}`} className="rounded-lg border border-border bg-card p-5 transition hover:border-primary/25 hover:shadow-xl hover:shadow-foreground/[0.05]">
                <div className="flex items-start gap-4">
                  <img src={lawyer.image} alt={lawyer.name} className="h-16 w-16 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">{lawyer.specialty}</p>
                    <h3 className="mt-1 truncate text-base font-bold text-foreground">{lawyer.name}</h3>
                    <p className="text-xs font-semibold text-muted-foreground">{lawyer.city}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-foreground">
                  <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-gold fill-gold" />{lawyer.rating} ({lawyer.reviews})</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{lawyer.city}</span>
                  <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{lawyer.available}</span>
                  <span>{formatCurrency(lawyer.price)}</span>
                </div>
              </Link>
            )) : (
              <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm leading-6 text-muted-foreground md:col-span-2 lg:col-span-3">
                No direct match yet. Open search to broaden issue or city filters.
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 rounded-lg border border-border bg-secondary/40 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <ShieldCheck className="h-5 w-5 text-sage" />
            National launch focus
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Country-wide production starts with density in Athens and Thessaloniki, then expands category and city coverage as verified supply becomes bookable.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default DiscoveryPage;
