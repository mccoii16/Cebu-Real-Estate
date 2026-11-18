import { HeroSlideConfig, WebsiteSettings } from '../types/property';

export const DEFAULT_HERO_FALLBACK_IMAGE = '/assets/extracted/hero_skyline_clean.png';

/**
 * Parses saved property IDs from localStorage safely.
 * Always defaults to an empty array for first-time visitors (never pre-populates a property).
 */
export function parseSavedFavorites(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed && !seen.has(trimmed)) {
          seen.add(trimmed);
          result.push(trimmed);
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Resolves the active hero carousel slides from WebsiteSettings.
 * Preserves custom URLs (Firebase Storage, https://, data:, local paths) without
 * prematurely reverting to default assets.
 */
export function resolveHeroSlides(
  settings: Partial<WebsiteSettings> | null | undefined,
  defaultSlides: HeroSlideConfig[]
): HeroSlideConfig[] {
  const configuredSlides = Array.isArray(settings?.heroSlides) ? settings.heroSlides : [];
  const legacyImages = Array.isArray(settings?.heroImages) ? settings.heroImages : [];

  if (configuredSlides.length > 0) {
    return configuredSlides.map((slide, idx) => {
      const fallbackSlide = defaultSlides[idx] || defaultSlides[0];
      const slideImage = typeof slide?.image === 'string' ? slide.image.trim() : '';
      const legacyImage = typeof legacyImages[idx] === 'string' ? legacyImages[idx].trim() : '';
      const resolvedImage =
        slideImage || legacyImage || fallbackSlide?.image || DEFAULT_HERO_FALLBACK_IMAGE;

      return {
        id: typeof slide?.id === 'number' && Number.isFinite(slide.id) ? slide.id : idx + 1,
        label:
          typeof slide?.label === 'string' && slide.label.trim()
            ? slide.label.trim()
            : idx + 1 < 10
            ? `0${idx + 1}`
            : `${idx + 1}`,
        location:
          typeof slide?.location === 'string' && slide.location.trim()
            ? slide.location.trim()
            : fallbackSlide?.location || 'Cebu Prime District',
        image: resolvedImage,
        headlineLine1:
          typeof slide?.headlineLine1 === 'string' && slide.headlineLine1.trim()
            ? slide.headlineLine1
            : fallbackSlide?.headlineLine1 || 'Find Your Perfect',
        headlineLine2:
          typeof slide?.headlineLine2 === 'string' && slide.headlineLine2.trim()
            ? slide.headlineLine2
            : fallbackSlide?.headlineLine2 || 'Property in Cebu',
        subheading:
          typeof slide?.subheading === 'string' && slide.subheading.trim()
            ? slide.subheading
            : fallbackSlide?.subheading || 'Modern living. Prime locations. Endless possibilities.',
      };
    });
  }

  const cleanLegacyImages = legacyImages
    .map((url) => (typeof url === 'string' ? url.trim() : ''))
    .filter(Boolean);

  if (cleanLegacyImages.length > 0) {
    return defaultSlides.map((slide, idx) => ({
      ...slide,
      image: cleanLegacyImages[idx] || slide.image,
    }));
  }

  return defaultSlides;
}

/**
 * Recursively removes `undefined` object properties so Firestore `setDoc` never rejects payloads.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

/**
 * Keeps `heroImages` aligned with `heroSlides` and sanitizes undefined values before saving.
 */
export function syncWebsiteSettingsPayload(
  settings: WebsiteSettings,
  defaultSlides: HeroSlideConfig[]
): WebsiteSettings {
  const normalizedSlides = resolveHeroSlides(settings, defaultSlides);
  const syncedHeroImages = normalizedSlides
    .map((slide) => (slide.image || '').trim())
    .filter(Boolean);

  return stripUndefinedDeep({
    ...settings,
    heroSlides: normalizedSlides,
    heroImages: syncedHeroImages.length > 0 ? syncedHeroImages : settings.heroImages,
  });
}
