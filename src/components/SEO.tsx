import { useEffect } from "react";
import { defaultSeoDescription, siteName } from "@/lib/seo";

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
}

const upsertMeta = (selector: string, attribute: "name" | "property", key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
};

const upsertCanonical = (href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
};

const SEO = ({
  title = siteName,
  description = defaultSeoDescription,
  path,
  image = "/og-image.svg",
}: SEOProps) => {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const canonicalUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${path || window.location.pathname}`
        : path || "/";

    document.title = title;
    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    upsertMeta('meta[property="og:site_name"]', "property", "og:site_name", siteName);
    upsertMeta('meta[property="og:image"]', "property", "og:image", image);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
    upsertCanonical(canonicalUrl);
  }, [description, image, path, title]);

  return null;
};

export default SEO;

