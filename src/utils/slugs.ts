import { BuildingDoc, LocationHighlight, PropertyDoc } from '../types/property';

export type AppRoute =
  | { type: 'home' }
  | { type: 'property'; slug: string }
  | { type: 'building'; slug: string }
  | { type: 'neighborhood'; slug: string }
  | { type: 'not-found'; path: string };

/**
 * Converts any string into a clean, readable URL slug.
 */
export function slugify(input: string, fallback = 'listing'): string {
  const normalized = (input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || fallback;
}

/**
 * Generates a unique slug given existing records (excluding optional self ID).
 */
export function ensureUniqueSlug(
  baseName: string,
  existingRecords: Array<{ id: string; slug?: string; fallbackName?: string }>,
  selfId?: string,
  fallbackPrefix = 'item'
): string {
  const baseSlug = slugify(baseName, fallbackPrefix);
  const taken = new Set<string>();

  for (const item of existingRecords) {
    if (selfId && item.id === selfId) continue;
    if (item.slug && item.slug.trim()) {
      taken.add(item.slug.trim().toLowerCase());
    } else if (item.fallbackName) {
      taken.add(slugify(item.fallbackName, fallbackPrefix));
    }
  }

  if (!taken.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  while (taken.has(`${baseSlug}-${counter}`)) {
    counter += 1;
  }
  return `${baseSlug}-${counter}`;
}

export function getPropertySlug(property: Pick<PropertyDoc, 'propertyId' | 'slug' | 'propertyTitle'>): string {
  if (property.slug && property.slug.trim()) {
    return slugify(property.slug, property.propertyId);
  }
  return slugify(property.propertyTitle, property.propertyId);
}

export function getBuildingSlug(building: Pick<BuildingDoc, 'buildingId' | 'slug' | 'buildingName'>): string {
  if (building.slug && building.slug.trim()) {
    return slugify(building.slug, building.buildingId);
  }
  return slugify(building.buildingName, building.buildingId);
}

export function getNeighborhoodSlug(
  neighborhood: Pick<LocationHighlight, 'id' | 'slug' | 'name'>
): string {
  if (neighborhood.slug && neighborhood.slug.trim()) {
    return slugify(neighborhood.slug, neighborhood.id);
  }
  return slugify(neighborhood.name, neighborhood.id);
}

export function buildPropertyPath(property: Pick<PropertyDoc, 'propertyId' | 'slug' | 'propertyTitle'>): string {
  return `/properties/${encodeURIComponent(getPropertySlug(property))}`;
}

export function buildBuildingPath(building: Pick<BuildingDoc, 'buildingId' | 'slug' | 'buildingName'>): string {
  return `/buildings/${encodeURIComponent(getBuildingSlug(building))}`;
}

export function buildNeighborhoodPath(
  neighborhood: Pick<LocationHighlight, 'id' | 'slug' | 'name'>
): string {
  return `/neighborhoods/${encodeURIComponent(getNeighborhoodSlug(neighborhood))}`;
}

/**
 * Parses URL pathname into a strongly typed route.
 */
export function parseRoute(pathname: string): AppRoute {
  const clean = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (clean === '/') {
    return { type: 'home' };
  }

  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 2) {
    const section = parts[0].toLowerCase();
    let slug = '';
    try {
      slug = decodeURIComponent(parts[1]).trim();
    } catch {
      slug = parts[1].trim();
    }
    if (!slug) {
      return { type: 'not-found', path: clean };
    }
    if (section === 'properties') {
      return { type: 'property', slug };
    }
    if (section === 'buildings') {
      return { type: 'building', slug };
    }
    if (section === 'neighborhoods') {
      return { type: 'neighborhood', slug };
    }
  }

  return { type: 'not-found', path: clean };
}

/**
 * Finds an approved property matching a URL slug (or legacy propertyId).
 * Strictly excludes non-approved listings for public pages.
 */
export function findApprovedPropertyBySlug(
  properties: PropertyDoc[],
  slug: string
): PropertyDoc | null {
  const normalizedTarget = slugify(slug, '');
  if (!normalizedTarget && !slug) return null;

  const approved = properties.filter((p) => p.status === 'approved');

  // 1. Exact stored slug match
  const exactSlug = approved.find(
    (p) => p.slug && p.slug.trim().toLowerCase() === slug.trim().toLowerCase()
  );
  if (exactSlug) return exactSlug;

  // 2. Exact legacy propertyId match
  const exactId = approved.find((p) => p.propertyId === slug);
  if (exactId) return exactId;

  // 3. Computed slug from propertyTitle
  const byTitleSlug = approved.find(
    (p) => slugify(p.propertyTitle, '') === normalizedTarget
  );
  return byTitleSlug || null;
}

export function findBuildingBySlug(buildings: BuildingDoc[], slug: string): BuildingDoc | null {
  const normalizedTarget = slugify(slug, '');
  if (!normalizedTarget && !slug) return null;

  const exactSlug = buildings.find(
    (b) => b.slug && b.slug.trim().toLowerCase() === slug.trim().toLowerCase()
  );
  if (exactSlug) return exactSlug;

  const exactId = buildings.find((b) => b.buildingId === slug);
  if (exactId) return exactId;

  return buildings.find((b) => slugify(b.buildingName, '') === normalizedTarget) || null;
}

export function findNeighborhoodBySlug(
  neighborhoods: LocationHighlight[],
  slug: string
): LocationHighlight | null {
  const normalizedTarget = slugify(slug, '');
  if (!normalizedTarget && !slug) return null;

  const exactSlug = neighborhoods.find(
    (n) => n.slug && n.slug.trim().toLowerCase() === slug.trim().toLowerCase()
  );
  if (exactSlug) return exactSlug;

  const exactId = neighborhoods.find((n) => n.id === slug);
  if (exactId) return exactId;

  return neighborhoods.find((n) => slugify(n.name, '') === normalizedTarget) || null;
}

/**
 * Associates approved public properties with a building via its unique Firestore buildingId.
 */
export function getApprovedPropertiesForBuilding(
  properties: PropertyDoc[],
  buildingId: string
): PropertyDoc[] {
  if (!buildingId) return [];
  return properties.filter(
    (p) => p.status === 'approved' && p.buildingId === buildingId
  );
}

/**
 * Normalizes area names like "IT Park" and "Cebu IT Park" when matching records.
 */
export function matchesNeighborhoodName(a?: string, b?: string): boolean {
  const normA = (a || '').trim().toLowerCase();
  const normB = (b || '').trim().toLowerCase();
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (
    (normA === 'it park' || normA === 'cebu it park') &&
    (normB === 'it park' || normB === 'cebu it park')
  ) {
    return true;
  }
  return false;
}

export function getApprovedPropertiesForNeighborhood(
  properties: PropertyDoc[],
  neighborhoodName: string
): PropertyDoc[] {
  return properties.filter(
    (p) => p.status === 'approved' && matchesNeighborhoodName(p.location, neighborhoodName)
  );
}

export function getBuildingsForNeighborhood(
  buildings: BuildingDoc[],
  neighborhoodName: string
): BuildingDoc[] {
  return buildings.filter((b) => matchesNeighborhoodName(b.location, neighborhoodName));
}

/**
 * Builds a safe Google Maps external link or embed URL from saved address, coordinates, or explicit mapUrl.
 */
export function resolveMapLocations(input: {
  mapUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  queryLabel?: string;
}): { embedUrl: string | null; externalUrl: string | null } {
  const hasCoords =
    typeof input.latitude === 'number' &&
    !Number.isNaN(input.latitude) &&
    typeof input.longitude === 'number' &&
    !Number.isNaN(input.longitude);

  let safeExplicitUrl: string | null = null;
  if (input.mapUrl && input.mapUrl.trim()) {
    try {
      const parsed = new URL(input.mapUrl.trim());
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        safeExplicitUrl = parsed.toString();
      }
    } catch {
      // ignore invalid URL
    }
  }

  if (hasCoords) {
    const q = `${input.latitude},${input.longitude}`;
    return {
      embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`,
      externalUrl: safeExplicitUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
    };
  }

  if (safeExplicitUrl) {
    const isEmbed = safeExplicitUrl.includes('output=embed') || safeExplicitUrl.includes('/maps/embed');
    const queryTerm = (input.address || input.queryLabel || '').trim();
    return {
      embedUrl: isEmbed
        ? safeExplicitUrl
        : queryTerm
        ? `https://maps.google.com/maps?q=${encodeURIComponent(queryTerm)}&z=15&output=embed`
        : null,
      externalUrl: safeExplicitUrl,
    };
  }

  const fallbackQuery = (input.address || input.queryLabel || '').trim();
  if (fallbackQuery) {
    return {
      embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(fallbackQuery)}&z=15&output=embed`,
      externalUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery)}`,
    };
  }

  return { embedUrl: null, externalUrl: null };
}
