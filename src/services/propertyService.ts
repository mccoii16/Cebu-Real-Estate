import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { PropertyDoc, BuildingDoc, PropertyFilter } from '../types/property';
import { handleFirestoreError, OperationType } from './firestoreError';
import { INITIAL_BUILDINGS as SEED_BUILDINGS, INITIAL_PROPERTIES as SEED_PROPERTIES } from '../data/initialSeedData';
import { findApprovedPropertyBySlug, findBuildingBySlug } from '../utils/slugs';
import { isBuildingPubliclyVisible } from '../utils/contentManagement';

const PROPERTIES_PATH = 'properties';
const BUILDINGS_PATH = 'buildings';

/**
 * Fetch all public approved properties from Firestore.
 * Strictly queries `status == 'approved'` as required.
 */
export async function getApprovedProperties(
  filter?: Partial<PropertyFilter>
): Promise<PropertyDoc[]> {
  try {
    const q = query(
      collection(db, PROPERTIES_PATH),
      where('status', '==', 'approved')
    );
    const snapshot = await getDocs(q);
    const properties: PropertyDoc[] = [];

    snapshot.forEach((docSnap) => {
      properties.push(docSnap.data() as PropertyDoc);
    });

    // Apply client-side filters for criteria that may vary dynamically
    return applyPropertyFilters(properties, filter);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PROPERTIES_PATH);
  }
}

/**
 * Fetch all properties for authenticated staff based on role.
 * Super Admin sees all submissions across all states.
 * Agent sees public approved plus their own submissions.
 */
export async function getAllPropertiesForStaff(
  userRole?: string | null,
  userId?: string | null
): Promise<PropertyDoc[]> {
  try {
    if (userRole === 'superadmin' || userRole === 'editor') {
      try {
        const snapshot = await getDocs(collection(db, PROPERTIES_PATH));
        const properties: PropertyDoc[] = [];
        snapshot.forEach((docSnap) => {
          properties.push(docSnap.data() as PropertyDoc);
        });
        return properties;
      } catch (err: any) {
        console.warn(`${userRole} full list query restricted, loading approved listings:`, err.message);
        return await getApprovedProperties();
      }
    }

    if (userRole === 'agent' && userId) {
      try {
        const [approvedSnap, mySnap] = await Promise.all([
          getDocs(query(collection(db, PROPERTIES_PATH), where('status', '==', 'approved'))),
          getDocs(query(collection(db, PROPERTIES_PATH), where('agentId', '==', userId))),
        ]);
        const map = new Map<string, PropertyDoc>();
        approvedSnap.forEach((d) => map.set(d.id, d.data() as PropertyDoc));
        mySnap.forEach((d) => map.set(d.id, d.data() as PropertyDoc));
        return Array.from(map.values());
      } catch (err: any) {
        console.warn('Agent query restricted, loading approved listings:', err.message);
        return await getApprovedProperties();
      }
    }

    return getApprovedProperties();
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PROPERTIES_PATH);
  }
}

/**
 * Fetch featured properties for the homepage.
 */
export async function getFeaturedProperties(): Promise<PropertyDoc[]> {
  try {
    const q = query(
      collection(db, PROPERTIES_PATH),
      where('status', '==', 'approved')
    );
    const snapshot = await getDocs(q);
    const properties: PropertyDoc[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as PropertyDoc;
      if (data.featured) {
        properties.push(data);
      }
    });

    return properties;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PROPERTIES_PATH);
  }
}

/**
 * Fetch a single property by ID.
 */
export async function getPropertyById(propertyId: string): Promise<PropertyDoc | null> {
  const docPath = `${PROPERTIES_PATH}/${propertyId}`;
  try {
    const docSnap = await getDoc(doc(db, PROPERTIES_PATH, propertyId));
    if (!docSnap.exists()) return null;
    const data = docSnap.data() as PropertyDoc;
    if (data.status !== 'approved') {
      return null; // Public website only displays approved properties
    }
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

/**
 * Fetch a single approved property by URL slug (with safe fallback for un-indexed or legacy records).
 */
export async function getPropertyBySlug(slug: string): Promise<PropertyDoc | null> {
  try {
    try {
      const q = query(
        collection(db, PROPERTIES_PATH),
        where('status', '==', 'approved'),
        where('slug', '==', slug)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as PropertyDoc;
      }
    } catch {
      // Composite index may not be provisioned yet; fallback to approved query match
    }

    const approved = await getApprovedProperties();
    return findApprovedPropertyBySlug(approved, slug);
  } catch {
    return null;
  }
}

/**
 * Fetch all buildings from Firestore.
 */
export async function getAllBuildings(): Promise<BuildingDoc[]> {
  try {
    const snapshot = await getDocs(collection(db, BUILDINGS_PATH));
    const buildings: BuildingDoc[] = [];
    snapshot.forEach((docSnap) => {
      buildings.push(docSnap.data() as BuildingDoc);
    });
    return buildings;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, BUILDINGS_PATH);
  }
}

/**
 * Fetch a single building by URL slug (respects published visibility for public routes).
 */
export async function getBuildingBySlug(
  slug: string,
  options?: { includeUnpublished?: boolean }
): Promise<BuildingDoc | null> {
  const includeUnpublished = Boolean(options?.includeUnpublished);
  try {
    try {
      const q = query(collection(db, BUILDINGS_PATH), where('slug', '==', slug));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const matched = snap.docs[0].data() as BuildingDoc;
        if (!includeUnpublished && !isBuildingPubliclyVisible(matched)) {
          return null;
        }
        return matched;
      }
    } catch {
      // Fall back to full buildings scan if single-field index unavailable
    }

    const allBuildings = await getAllBuildings();
    const candidates = includeUnpublished
      ? allBuildings
      : allBuildings.filter(isBuildingPubliclyVisible);
    return findBuildingBySlug(candidates, slug);
  } catch {
    return null;
  }
}

/**
 * Apply filtering logic in memory (location, building, type, price, bedrooms, search).
 */
export function applyPropertyFilters(
  properties: PropertyDoc[],
  filter?: Partial<PropertyFilter>
): PropertyDoc[] {
  if (!filter) return properties;

  return properties.filter((property) => {
    // Only approved properties can ever pass
    if (property.status !== 'approved') return false;

    // Featured only
    if (filter.featuredOnly && !property.featured) return false;

    // Location filter
    if (filter.location && filter.location !== 'All Areas') {
      if (property.location !== filter.location) return false;
    }

    // Building filter
    if (filter.buildingId && filter.buildingId !== 'all') {
      if (property.buildingId !== filter.buildingId) return false;
    }

    // Property Type filter
    if (filter.type && filter.type !== 'All Types') {
      if (property.propertyType !== filter.type) return false;
    }

    // Listing Type (sale / rent)
    if (filter.listingType && filter.listingType !== 'all') {
      if (property.listingType !== filter.listingType) return false;
    }

    // Min price
    if (typeof filter.minPrice === 'number' && filter.minPrice > 0) {
      if (property.price < filter.minPrice) return false;
    }

    // Max price
    if (typeof filter.maxPrice === 'number' && filter.maxPrice > 0) {
      if (property.price > filter.maxPrice) return false;
    }

    // Bedrooms
    if (filter.bedrooms && filter.bedrooms !== 'all') {
      if (filter.bedrooms >= 4) {
        if (property.bedrooms < 4) return false;
      } else {
        if (property.bedrooms !== filter.bedrooms) return false;
      }
    }

    // Search query
    if (filter.searchQuery && filter.searchQuery.trim().length > 0) {
      const q = filter.searchQuery.toLowerCase().trim();
      const inTitle = property.propertyTitle.toLowerCase().includes(q);
      const inBuilding = property.buildingName.toLowerCase().includes(q);
      const inLocation = property.location.toLowerCase().includes(q);
      const inDesc = property.description.toLowerCase().includes(q);
      if (!inTitle && !inBuilding && !inLocation && !inDesc) return false;
    }

    return true;
  });
}

/**
 * Seed initial Firestore records for buildings and approved properties if empty.
 */
export async function seedInitialFirestoreData(): Promise<void> {
  try {
    const q = query(collection(db, PROPERTIES_PATH), where('status', '==', 'approved'));
    const existingProperties = await getDocs(q);
    if (!existingProperties.empty) {
      // Database already seeded
      return;
    }

    console.log('Seeding initial Firestore properties and buildings...');
    const batch = writeBatch(db);

    for (const bld of SEED_BUILDINGS) {
      batch.set(doc(db, BUILDINGS_PATH, bld.buildingId), bld);
    }

    for (const prop of SEED_PROPERTIES) {
      batch.set(doc(db, PROPERTIES_PATH, prop.propertyId), prop);
    }

    await batch.commit();
    console.log('Successfully seeded initial Firestore data.');
  } catch (error) {
    console.error('Initial seeding error:', error);
  }
}
