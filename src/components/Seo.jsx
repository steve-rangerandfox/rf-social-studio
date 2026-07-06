import { useEffect } from "react";

// Per-route SEO head manager for the public pages. The site is a SPA, so
// tags are set via the DOM: Googlebot renders JavaScript, so title /
// description / canonical / JSON-LD all count for ranking. (Social share
// scrapers read the server-sent index.html — sitewide OG lives there.)
const SITE = "https://www.rangerandfox-social.studio";
const DEFAULT_TITLE = "Relay — Calm operations for a sharper content system.";

export function Seo({ title, description, path, jsonLd }) {
  useEffect(() => {
    document.title = title;

    const ensure = (selector, create) => {
      let el = document.head.querySelector(selector);
      if (!el) { el = create(); document.head.appendChild(el); }
      return el;
    };
    const meta = ensure('meta[name="description"]', () => {
      const m = document.createElement("meta"); m.setAttribute("name", "description"); return m;
    });
    const prevDescription = meta.getAttribute("content");
    if (description) meta.setAttribute("content", description);

    const canonical = ensure('link[rel="canonical"]', () => {
      const l = document.createElement("link"); l.setAttribute("rel", "canonical"); return l;
    });
    canonical.setAttribute("href", SITE + (path || "/"));

    const ogTitle = document.head.querySelector('meta[property="og:title"]');
    const prevOg = ogTitle?.getAttribute("content");
    if (ogTitle) ogTitle.setAttribute("content", title);

    let ldScript = null;
    if (jsonLd) {
      ldScript = document.createElement("script");
      ldScript.type = "application/ld+json";
      ldScript.text = JSON.stringify(jsonLd);
      document.head.appendChild(ldScript);
    }

    return () => {
      document.title = DEFAULT_TITLE;
      if (prevDescription) meta.setAttribute("content", prevDescription);
      if (ogTitle && prevOg) ogTitle.setAttribute("content", prevOg);
      canonical.setAttribute("href", SITE + "/");
      if (ldScript) ldScript.remove();
    };
  }, [title, description, path, jsonLd]);

  return null;
}
