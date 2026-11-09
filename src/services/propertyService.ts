import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { PropertyDoc, BuildingDoc, PropertyFilter } from '../types/property';
import { handleFirestoreError, OperationType } from './firestoreError';

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
    if (userRole === 'superadmin') {
      try {
        const snapshot = await getDocs(collection(db, PROPERTIES_PATH));
        const properties: PropertyDoc[] = [];
        snapshot.forEach((docSnap) => {
          properties.push(docSnap.data() as PropertyDoc);
        });
        return properties;
      } catch (err: any) {
        console.warn('Superadmin full list query restricted, loading approved listings:', err.message);
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

    const INITIAL_BUILDINGS: BuildingDoc[] = [
      {
        buildingId: 'bld-the-alcoves',
        buildingName: 'The Alcoves',
        location: 'Cebu Business Park',
        address: 'Luzon Avenue, Cebu Business Park, Cebu City, 6000',
        description:
          'A luxury 39-storey residential condominium directly integrated with Ayala Center Cebu, featuring upscale fitness centers, sky lounges, and lap pools.',
        buildingImages: ['/assets/extracted/the_alcoves.png', '/assets/extracted/photo_the_alcoves.png'],
        amenities: [
          'Direct Ayala Mall Access',
          'Lap Pool & Sun Deck',
          'Sky Lounge & Function Rooms',
          '24/7 Security & Concierge',
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        buildingId: 'bld-38-park-avenue',
        buildingName: '38 Park Avenue',
        location: 'Cebu IT Park',
        address: 'Salinas Drive, Cebu IT Park, Apas, Cebu City, 6000',
        description:
          'New York-inspired skyscraper living soaring 38 levels in the heart of Cebu IT Park, with multi-level sky gardens and promenade gardens.',
        buildingImages: ['/assets/extracted/park_avenue.png', '/assets/extracted/photo_park_avenue.png'],
        amenities: [
          'Grand Atrium Lobby',
          'Sky Gardens',
          'Swimming Pool & Sunken Deck',
          'Fitness Center',
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        buildingId: 'bld-mactan-newtown',
        buildingName: 'Mactan Newtown Residences',
        location: 'Mactan Newtown',
        address: 'Newtown Boulevard, Lapu-Lapu City, 6015',
        description:
          'Master-planned coastal resort township residences with panoramic views of Magellan Bay and private beach club privileges.',
        buildingImages: ['/assets/extracted/mactan_residences.png', '/assets/extracted/photo_mactan_residences.png'],
        amenities: [
          'Beach Club Access',
          'Horizon-edge Swimming Pool',
          'Retail Promenade',
          'Spa & Reflexology Path',
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        buildingId: 'bld-astra-centre',
        buildingName: 'Astra Centre',
        location: 'Cebu Business Park',
        address: 'A.S. Fortuna Street, Metro Cebu Corridor',
        description:
          'Mixed-use lifestyle destination integrating Astra Lifestyle Mall, Radisson RED Hotel, and One Astra Place residential condominium.',
        buildingImages: ['/assets/extracted/astra_centre.png', '/assets/extracted/photo_astra_centre.png'],
        amenities: [
          'Integrated Radisson RED Hotel & Mall',
          'Infinity Pool & Aqua Deck',
          'Sky Lounge & Co-Working Hub',
          'Smart Home Systems',
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const bld of INITIAL_BUILDINGS) {
      batch.set(doc(db, BUILDINGS_PATH, bld.buildingId), bld);
    }

    const INITIAL_PROPERTIES: PropertyDoc[] = [
      {
        propertyId: 'prop-alcoves-18b',
        buildingId: 'bld-the-alcoves',
        buildingName: 'The Alcoves',
        propertyTitle: 'The Alcoves',
        location: 'Cebu Business Park',
        address: 'Luzon Avenue, Cebu Business Park, Cebu City',
        propertyType: 'Condo',
        listingType: 'sale',
        price: 8500000,
        bedrooms: 1,
        bathrooms: 1,
        floorArea: 36,
        description:
          'The Alcoves is an elite residential condominium standing at 39 storeys, seamlessly integrated with Ayala Center Cebu. Designed with grand living in mind, it features high ceilings, floor-to-ceiling glass, and resort-level wellness amenities in the heart of Cebu’s premier financial hub.',
        amenities: [
          'Direct Ayala Center Cebu Access',
          'Lap Pool & Children’s Pool',
          'Sky Lounge with Panoramic Skyline Views',
          'Fully Equipped Fitness Center',
          '24/7 Concierge and Security',
        ],
        images: [
          '/assets/extracted/the_alcoves.png',
          '/assets/extracted/photo_the_alcoves.png',
          '/assets/extracted/hero_skyline_clean.png',
        ],
        featured: true,
        status: 'approved',
        agentId: 'agent-prime-01',
        agentName: 'Cebu Prime Advisory',
        rejectionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: 'admin-martiligando',
      },
      {
        propertyId: 'prop-38-park-24a',
        buildingId: 'bld-38-park-avenue',
        buildingName: '38 Park Avenue',
        propertyTitle: '38 Park Avenue',
        location: 'Cebu IT Park',
        address: 'Salinas Drive, Cebu IT Park, Apas, Cebu City',
        propertyType: 'Condo',
        listingType: 'sale',
        price: 11000000,
        bedrooms: 1,
        bathrooms: 1,
        floorArea: 45,
        description:
          'Inspired by New York urban architecture, 38 Park Avenue rises 38 stories high within the Cebu IT Park. Featuring the iconic sky gardens and the Green Promenade, it delivers master-planned living with contemporary sophistication.',
        amenities: [
          'High-ceiling Grand Atrium',
          'Sky Gardens on Multi-Levels',
          'Infinity Lap Pool & Sunken Deck',
          'Walking Distance to Tech Hubs & Cafes',
          'Multi-Level Basement Parking',
        ],
        images: [
          '/assets/extracted/park_avenue.png',
          '/assets/extracted/photo_park_avenue.png',
          '/assets/extracted/hero_skyline_clean.png',
        ],
        featured: true,
        status: 'approved',
        agentId: 'agent-prime-01',
        agentName: 'Cebu Prime Advisory',
        rejectionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: 'admin-martiligando',
      },
      {
        propertyId: 'prop-mactan-newtown-res',
        buildingId: 'bld-mactan-newtown',
        buildingName: 'Mactan Newtown Residences',
        propertyTitle: 'Mactan Newtown Residences',
        location: 'Mactan Newtown',
        address: 'Newtown Boulevard, Mactan Circumferential Rd, Lapu-Lapu City',
        propertyType: 'Condo',
        listingType: 'rent',
        price: 35000,
        bedrooms: 2,
        bathrooms: 2,
        floorArea: 78,
        description:
          'Enjoy coastal resort living coupled with township convenience. Mactan Newtown Residences offers pristine views of the Hilutungan Channel and Magellan Bay, with exclusive access to the Mactan Newtown Beach club.',
        amenities: [
          'Exclusive Mactan Beach Access',
          'Horizon-edge Swimming Pool',
          'Integrated Retail & Dining Boardwalk',
          'Close to Mactan-Cebu Int’l Airport (MCIA)',
          'Spa & Reflexology Path',
        ],
        images: [
          '/assets/extracted/mactan_residences.png',
          '/assets/extracted/photo_mactan_residences.png',
          '/assets/extracted/loc_mactan.png',
        ],
        featured: true,
        status: 'approved',
        agentId: 'agent-prime-02',
        agentName: 'Cebu Prime Coastal Team',
        rejectionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: 'admin-martiligando',
      },
      {
        propertyId: 'prop-astra-centre-902',
        buildingId: 'bld-astra-centre',
        buildingName: 'Astra Centre',
        propertyTitle: 'Astra Centre',
        location: 'Cebu Business Park',
        address: 'A.S. Fortuna Street, Banilad-Mandaue Corridor, Metro Cebu',
        propertyType: 'Condo',
        listingType: 'sale',
        price: 15000000,
        bedrooms: 2,
        bathrooms: 2,
        floorArea: 67,
        description:
          'A dynamic mixed-use lifestyle development featuring Astra Lifestyle Mall, Radisson RED Hotel, and One Astra Place residential condominium. Designed for discerning investors seeking high rental yields and cosmopolitan lifestyle.',
        amenities: [
          'Integrated Radisson RED Hotel & Mall',
          'Infinity Pool & Aqua Deck',
          'Rooftop Sky Lounge',
          'Function Rooms & Co-Working Hub',
          'Smart Home Ready Units',
        ],
        images: [
          '/assets/extracted/astra_centre.png',
          '/assets/extracted/photo_astra_centre.png',
          '/assets/extracted/loc_cebu_business_park.png',
        ],
        featured: true,
        status: 'approved',
        agentId: 'agent-prime-02',
        agentName: 'Cebu Prime Advisory',
        rejectionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: 'admin-martiligando',
      },
      {
        propertyId: 'prop-lucima-cbp-12',
        buildingId: 'bld-the-alcoves',
        buildingName: 'Lucima Luxury Tower',
        propertyTitle: 'Lucima Sustainable Residence',
        location: 'Cebu Business Park',
        address: 'Samar Loop, Cebu Business Park, Cebu City',
        propertyType: 'Penthouse',
        listingType: 'sale',
        price: 19500000,
        bedrooms: 3,
        bathrooms: 3,
        floorArea: 112,
        description:
          'The first quadruply-certified sustainable luxury residential tower in the Philippines. Exquisite Scandinavian-inspired architectural finishes with energy-efficient smart building tech.',
        amenities: [
          'LEED & WELL Certified Green Living',
          'Air Filtration & Energy Recovery Systems',
          'Private Terrace with Sky Garden',
          'Temperature Controlled Saltwater Pool',
        ],
        images: [
          '/assets/extracted/the_alcoves.png',
          '/assets/extracted/photo_the_alcoves.png',
        ],
        featured: false,
        status: 'approved',
        agentId: 'agent-prime-01',
        agentName: 'Cebu Prime Advisory',
        rejectionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: 'admin-martiligando',
      },
      {
        propertyId: 'prop-banilad-villa',
        buildingId: 'bld-the-alcoves',
        buildingName: 'Maria Luisa Enclave',
        propertyTitle: 'Banilad Estate Villa',
        location: 'Banilad',
        address: 'Maria Luisa Estate Park, Banilad, Cebu City',
        propertyType: 'House & Lot',
        listingType: 'sale',
        price: 42000000,
        bedrooms: 4,
        bathrooms: 4,
        floorArea: 380,
        description:
          'An architectural masterwork nestled within Cebu’s most prestigious gated enclave. Boasts panoramic mountain vistas, landscaped private courtyards, and bespoke Italian marble finishes.',
        amenities: [
          'Private Heated Infinity Pool',
          'Gated Subdivision with 24/7 Roving Guards',
          'Double-Height Living Spaces',
          'Wine Cellar & Home Theater',
        ],
        images: [
          '/assets/extracted/loc_banilad.png',
        ],
        featured: false,
        status: 'approved',
        agentId: 'agent-prime-01',
        agentName: 'Cebu Prime Advisory',
        rejectionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: 'admin-martiligando',
      },
    ];

    for (const prop of INITIAL_PROPERTIES) {
      batch.set(doc(db, PROPERTIES_PATH, prop.propertyId), prop);
    }

    await batch.commit();
    console.log('Successfully seeded initial Firestore data.');
  } catch (error) {
    console.error('Initial seeding error:', error);
  }
}
