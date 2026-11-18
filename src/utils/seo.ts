export interface SeoMetaConfig {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  siteName?: string;
  noIndex?: boolean;
  structuredData?: Record<string, any> | null;
}

const JSON_LD_SCRIPT_ID = 'cpp-structured-data';

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string): void {
  if (typeof document === 'undefined') return;
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function removeMetaTag(attrName: 'name' | 'property', attrValue: string): void {
  if (typeof document === 'undefined') return;
  const tag = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (tag) tag.remove();
}

function upsertCanonicalLink(url: string): void {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

function toAbsoluteUrl(urlOrPath?: string): string {
  if (typeof window === 'undefined') return urlOrPath || '';
  const origin = window.location.origin;
  if (!urlOrPath) return `${origin}/assets/extracted/hero_skyline_clean.png`;
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return urlOrPath;
  }
  const normalized = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  return `${origin}${normalized}`;
}

/**
 * Applies dynamic page title, meta description, OpenGraph, Twitter, canonical link,
 * and Schema.org JSON-LD structured data for the current route.
 */
export function applySeoMetadata(config: SeoMetaConfig): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const siteTitle = config.siteName?.trim() || 'Cebu Prime Properties';
  const cleanDescription = (config.description || '').replace(/\s+/g, ' ').trim().slice(0, 165);
  const canonicalUrl = `${window.location.origin}${
    config.canonicalPath.startsWith('/') ? config.canonicalPath : `/${config.canonicalPath}`
  }`;
  const absoluteImage = toAbsoluteUrl(config.ogImage);

  document.title = config.title;

  upsertMetaTag('name', 'description', cleanDescription);
  upsertCanonicalLink(canonicalUrl);

  if (config.noIndex) {
    upsertMetaTag('name', 'robots', 'noindex, nofollow');
  } else {
    removeMetaTag('name', 'robots');
  }

  // OpenGraph
  upsertMetaTag('property', 'og:site_name', siteTitle);
  upsertMetaTag('property', 'og:title', config.title);
  upsertMetaTag('property', 'og:description', cleanDescription);
  upsertMetaTag('property', 'og:type', config.ogType || 'website');
  upsertMetaTag('property', 'og:url', canonicalUrl);
  upsertMetaTag('property', 'og:image', absoluteImage);

  // Twitter
  upsertMetaTag('name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('name', 'twitter:title', config.title);
  upsertMetaTag('name', 'twitter:description', cleanDescription);
  upsertMetaTag('name', 'twitter:image', absoluteImage);

  // JSON-LD Structured Data
  let script = document.head.querySelector<HTMLScriptElement>(`script#${JSON_LD_SCRIPT_ID}`);
  if (config.structuredData) {
    if (!script) {
      script = document.createElement('script');
      script.id = JSON_LD_SCRIPT_ID;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(config.structuredData);
  } else if (script) {
    script.remove();
  }
}

export function getOrigin(): string {
  if (typeof window === 'undefined') return 'https://cebuprimeproperties.ph';
  return window.location.origin;
}
