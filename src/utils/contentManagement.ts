import {
  BuildingDoc,
  ContentPublishStatus,
  LocationHighlight,
  PropertyDoc,
  WebsiteSettings,
} from '../types/property';
import { matchesNeighborhoodName } from './slugs';

/**
 * Returns the effective publication state for Buildings and Neighborhoods.
 * Legacy records without an explicit status default to 'published'.
 */
export function getEffectivePublishStatus(
  record?: { status?: ContentPublishStatus } | null
): ContentPublishStatus {
  if (!record?.status) return 'published';
  if (
    record.status === 'published' ||
    record.status === 'unpublished' ||
    record.status === 'archived'
  ) {
    return record.status;
  }
  return 'published';
}

export function isBuildingPubliclyVisible(building?: Pick<BuildingDoc, 'status'> | null): boolean {
  if (!building) return false;
  return getEffectivePublishStatus(building) === 'published';
}

export function isNeighborhoodPubliclyVisible(
  neighborhood?: Pick<LocationHighlight, 'status'> | null
): boolean {
  if (!neighborhood) return false;
  return getEffectivePublishStatus(neighborhood) === 'published';
}

export interface DeleteSafetyResult {
  canDelete: boolean;
  blockingPropertyCount: number;
  blockingBuildingCount: number;
  reason?: string;
}

/**
 * Prevents permanent deletion of a Building if any Property (active, pending, draft, or archived) references it.
 */
export function checkBuildingDeleteSafety(
  building: Pick<BuildingDoc, 'buildingId' | 'buildingName'>,
  properties: PropertyDoc[]
): DeleteSafetyResult {
  const relatedProps = properties.filter((p) => p.buildingId === building.buildingId);
  if (relatedProps.length > 0) {
    return {
      canDelete: false,
      blockingPropertyCount: relatedProps.length,
      blockingBuildingCount: 0,
      reason: `Cannot permanently delete "${building.buildingName}" because ${relatedProps.length} property listing(s) still reference this building. Reassign or remove those properties first, or archive the building instead.`,
    };
  }
  return {
    canDelete: true,
    blockingPropertyCount: 0,
    blockingBuildingCount: 0,
  };
}

/**
 * Prevents permanent deletion of a Neighborhood & Area if any Building or Property references it.
 */
export function checkNeighborhoodDeleteSafety(
  neighborhood: Pick<LocationHighlight, 'id' | 'name'>,
  buildings: BuildingDoc[],
  properties: PropertyDoc[]
): DeleteSafetyResult {
  const relatedBuildings = buildings.filter((b) =>
    matchesNeighborhoodName(b.location, neighborhood.name)
  );
  const relatedProperties = properties.filter((p) =>
    matchesNeighborhoodName(p.location, neighborhood.name)
  );

  if (relatedBuildings.length > 0 || relatedProperties.length > 0) {
    const parts: string[] = [];
    if (relatedProperties.length > 0) {
      parts.push(`${relatedProperties.length} property listing(s)`);
    }
    if (relatedBuildings.length > 0) {
      parts.push(`${relatedBuildings.length} building(s)`);
    }
    return {
      canDelete: false,
      blockingPropertyCount: relatedProperties.length,
      blockingBuildingCount: relatedBuildings.length,
      reason: `Cannot permanently delete "${neighborhood.name}" because ${parts.join(' and ')} still reference this area. Reassign those records first, or archive the neighborhood instead.`,
    };
  }

  return {
    canDelete: true,
    blockingPropertyCount: 0,
    blockingBuildingCount: 0,
  };
}

/**
 * Collects every image URL referenced across Properties (live + pendingChanges),
 * Buildings, Neighborhoods, and WebsiteSettings so shared Storage files are never deleted accidentally.
 */
export function collectAllReferencedImageUrls(input: {
  properties?: PropertyDoc[];
  buildings?: BuildingDoc[];
  locations?: LocationHighlight[];
  siteSettings?: WebsiteSettings | null;
}): Set<string> {
  const refs = new Set<string>();
  const addUrl = (url?: string | null) => {
    if (typeof url === 'string' && url.trim()) {
      refs.add(url.trim());
    }
  };

  for (const prop of input.properties || []) {
    for (const img of prop.images || []) addUrl(img);
    for (const pendingImg of prop.pendingChanges?.images || []) addUrl(pendingImg);
  }

  for (const bld of input.buildings || []) {
    for (const img of bld.buildingImages || []) addUrl(img);
  }

  for (const loc of input.locations || []) {
    addUrl(loc.image);
    for (const img of loc.galleryImages || []) addUrl(img);
  }

  if (input.siteSettings) {
    addUrl(input.siteSettings.aboutImage);
    for (const img of input.siteSettings.heroImages || []) addUrl(img);
    for (const slide of input.siteSettings.heroSlides || []) addUrl(slide.image);
  }

  return refs;
}

/**
 * Computes candidate URLs that were removed from an edited entity and are no longer
 * referenced by the updated entity or any other saved entity.
 */
export function findOrphanedRemovedImages(
  previousUrls: string[],
  nextUrls: string[],
  otherReferencedUrls: Set<string>
): string[] {
  const nextSet = new Set(nextUrls.map((u) => u.trim()).filter(Boolean));
  const candidates = new Set<string>();

  for (const raw of previousUrls) {
    const clean = (raw || '').trim();
    if (!clean) continue;
    if (!nextSet.has(clean) && !otherReferencedUrls.has(clean)) {
      candidates.add(clean);
    }
  }

  return Array.from(candidates);
}

export function reorderGalleryImages(
  images: string[],
  fromIndex: number,
  toIndex: number
): string[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= images.length ||
    toIndex >= images.length ||
    fromIndex === toIndex
  ) {
    return [...images];
  }
  const copy = [...images];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

export function setGalleryCoverImage(images: string[], coverIndex: number): string[] {
  if (coverIndex <= 0 || coverIndex >= images.length) {
    return [...images];
  }
  return reorderGalleryImages(images, coverIndex, 0);
}

export function removeGalleryImage(images: string[], indexToRemove: number): string[] {
  return images.filter((_, idx) => idx !== indexToRemove);
}

export function parseCommaList(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of (input || '').split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

export function mergeUniqueItems(existing: string[], additions: string[]): string[] {
  const seen = new Set(existing.map((i) => i.trim().toLowerCase()).filter(Boolean));
  const merged = [...existing];
  for (const item of additions) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(trimmed);
    }
  }
  return merged;
}

export interface CoordinateValidationResult {
  isValid: boolean;
  latitude: number | null;
  longitude: number | null;
  error?: string;
}

export function validateOptionalCoordinates(
  latStr: string,
  lngStr: string
): CoordinateValidationResult {
  const trimmedLat = (latStr || '').trim();
  const trimmedLng = (lngStr || '').trim();

  if (!trimmedLat && !trimmedLng) {
    return { isValid: true, latitude: null, longitude: null };
  }

  if ((trimmedLat && !trimmedLng) || (!trimmedLat && trimmedLng)) {
    return {
      isValid: false,
      latitude: null,
      longitude: null,
      error: 'Please enter both latitude and longitude, or leave both blank.',
    };
  }

  const lat = Number(trimmedLat);
  const lng = Number(trimmedLng);

  if (Number.isNaN(lat) || lat < -90 || lat > 90) {
    return {
      isValid: false,
      latitude: null,
      longitude: null,
      error: 'Latitude must be a valid number between -90 and 90.',
    };
  }

  if (Number.isNaN(lng) || lng < -180 || lng > 180) {
    return {
      isValid: false,
      latitude: null,
      longitude: null,
      error: 'Longitude must be a valid number between -180 and 180.',
    };
  }

  return { isValid: true, latitude: lat, longitude: lng };
}

export function isValidOptionalHttpUrl(value: string): boolean {
  const trimmed = (value || '').trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validatePropertyForm(input: {
  propertyTitle: string;
  address: string;
  price: number;
  floorArea: number;
  bedrooms: number;
  bathrooms: number;
  images: string[];
  latitudeStr?: string;
  longitudeStr?: string;
  mapUrl?: string;
}): { isValid: boolean; error?: string; latitude: number | null; longitude: number | null } {
  if (!input.propertyTitle.trim()) {
    return { isValid: false, error: 'Please provide a property title.', latitude: null, longitude: null };
  }
  if (!input.address.trim()) {
    return {
      isValid: false,
      error: 'Please provide the physical street address.',
      latitude: null,
      longitude: null,
    };
  }
  if (Number.isNaN(input.price) || input.price < 0) {
    return {
      isValid: false,
      error: 'Price must be zero or a positive amount.',
      latitude: null,
      longitude: null,
    };
  }
  if (Number.isNaN(input.floorArea) || input.floorArea <= 0) {
    return {
      isValid: false,
      error: 'Floor area must be greater than 0 sqm.',
      latitude: null,
      longitude: null,
    };
  }
  if (Number.isNaN(input.bedrooms) || input.bedrooms < 0 || Number.isNaN(input.bathrooms) || input.bathrooms < 0) {
    return {
      isValid: false,
      error: 'Bedrooms and bathrooms cannot be negative.',
      latitude: null,
      longitude: null,
    };
  }
  if (!input.images || input.images.length === 0) {
    return {
      isValid: false,
      error: 'Please add at least one photograph of the property.',
      latitude: null,
      longitude: null,
    };
  }
  const coords = validateOptionalCoordinates(input.latitudeStr || '', input.longitudeStr || '');
  if (!coords.isValid) {
    return { isValid: false, error: coords.error, latitude: null, longitude: null };
  }
  if (!isValidOptionalHttpUrl(input.mapUrl || '')) {
    return {
      isValid: false,
      error: 'Google Maps link must be a valid http:// or https:// URL.',
      latitude: null,
      longitude: null,
    };
  }

  return { isValid: true, latitude: coords.latitude, longitude: coords.longitude };
}

export function validateBuildingForm(input: {
  buildingName: string;
  location: string;
  images: string[];
  yearCompletedStr?: string;
  totalFloorsStr?: string;
  latitudeStr?: string;
  longitudeStr?: string;
  mapUrl?: string;
}): {
  isValid: boolean;
  error?: string;
  yearCompleted: number | null;
  totalFloors: number | null;
  latitude: number | null;
  longitude: number | null;
} {
  if (!input.buildingName.trim()) {
    return {
      isValid: false,
      error: 'Building name is required.',
      yearCompleted: null,
      totalFloors: null,
      latitude: null,
      longitude: null,
    };
  }
  if (!input.location.trim()) {
    return {
      isValid: false,
      error: 'Please assign the building to a Neighborhood & Area.',
      yearCompleted: null,
      totalFloors: null,
      latitude: null,
      longitude: null,
    };
  }
  if (!input.images || input.images.length === 0) {
    return {
      isValid: false,
      error: 'Please include at least one cover photograph for the building.',
      yearCompleted: null,
      totalFloors: null,
      latitude: null,
      longitude: null,
    };
  }

  let yearCompleted: number | null = null;
  if ((input.yearCompletedStr || '').trim()) {
    const parsedYear = Number(input.yearCompletedStr);
    if (Number.isNaN(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
      return {
        isValid: false,
        error: 'Year completed must be between 1900 and 2100.',
        yearCompleted: null,
        totalFloors: null,
        latitude: null,
        longitude: null,
      };
    }
    yearCompleted = parsedYear;
  }

  let totalFloors: number | null = null;
  if ((input.totalFloorsStr || '').trim()) {
    const parsedFloors = Number(input.totalFloorsStr);
    if (Number.isNaN(parsedFloors) || parsedFloors < 1 || parsedFloors > 200) {
      return {
        isValid: false,
        error: 'Number of floors must be between 1 and 200.',
        yearCompleted: null,
        totalFloors: null,
        latitude: null,
        longitude: null,
      };
    }
    totalFloors = parsedFloors;
  }

  const coords = validateOptionalCoordinates(input.latitudeStr || '', input.longitudeStr || '');
  if (!coords.isValid) {
    return {
      isValid: false,
      error: coords.error,
      yearCompleted: null,
      totalFloors: null,
      latitude: null,
      longitude: null,
    };
  }

  if (!isValidOptionalHttpUrl(input.mapUrl || '')) {
    return {
      isValid: false,
      error: 'Google Maps URL must be a valid http:// or https:// URL.',
      yearCompleted: null,
      totalFloors: null,
      latitude: null,
      longitude: null,
    };
  }

  return {
    isValid: true,
    yearCompleted,
    totalFloors,
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

export function validateNeighborhoodForm(input: {
  name: string;
  images: string[];
  latitudeStr?: string;
  longitudeStr?: string;
  mapUrl?: string;
}): { isValid: boolean; error?: string; latitude: number | null; longitude: number | null } {
  if (!input.name.trim()) {
    return {
      isValid: false,
      error: 'Neighborhood & Area name is required.',
      latitude: null,
      longitude: null,
    };
  }
  if (!input.images || input.images.length === 0) {
    return {
      isValid: false,
      error: 'Please include at least one cover photograph.',
      latitude: null,
      longitude: null,
    };
  }

  const coords = validateOptionalCoordinates(input.latitudeStr || '', input.longitudeStr || '');
  if (!coords.isValid) {
    return {
      isValid: false,
      error: coords.error,
      latitude: null,
      longitude: null,
    };
  }

  if (!isValidOptionalHttpUrl(input.mapUrl || '')) {
    return {
      isValid: false,
      error: 'Google Maps URL must be a valid http:// or https:// URL.',
      latitude: null,
      longitude: null,
    };
  }

  return {
    isValid: true,
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}
