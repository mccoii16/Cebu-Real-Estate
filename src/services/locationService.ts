import { collection, doc, getDocs, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { LocationHighlight } from '../types/property';

export const INITIAL_LOCATIONS: LocationHighlight[] = [
  {
    id: 'loc-cbp',
    name: 'Cebu Business Park',
    tagline: 'Premier Financial District',
    propertyCount: 24,
    image: '/assets/extracted/photo_the_alcoves.png',
    description: 'Cebu’s premier corporate and lifestyle hub hosting top residential condominiums and Ayala Center Cebu.',
  },
  {
    id: 'loc-it-park',
    name: 'Cebu IT Park',
    tagline: 'Tech & Lifestyle Metropolis',
    propertyCount: 18,
    image: '/assets/extracted/photo_park_avenue.png',
    description: 'The 24/7 vibrant tech district featuring 38 Park Avenue and high-energy dining corridors.',
  },
  {
    id: 'loc-mactan',
    name: 'Mactan Newtown',
    tagline: 'Coastal Township & Gateway',
    propertyCount: 15,
    image: '/assets/extracted/loc_mactan.png',
    description: 'Masterplanned township connecting international resort living with airport convenience.',
  },
  {
    id: 'loc-banilad',
    name: 'Banilad',
    tagline: 'Upscale Residential Corridor',
    propertyCount: 11,
    image: '/assets/extracted/loc_banilad.png',
    description: 'Exclusive leafy residential enclaves, private academies, and prestigious golf clubs.',
  },
  {
    id: 'loc-lahug',
    name: 'Lahug',
    tagline: 'Highland Panoramas & Marco Polo',
    propertyCount: 8,
    image: '/assets/extracted/hero_skyline_clean.png',
    description: 'Elevated scenic hillside developments enjoying mountain breezes and skyline panoramas.',
  },
  {
    id: 'loc-srp',
    name: 'SRP',
    tagline: 'South Road Properties Coastal',
    propertyCount: 7,
    image: '/assets/extracted/the_alcoves.png',
    description: 'Cebu’s newest waterfront reclamation city with world-class arenas and retail avenues.',
  },
  {
    id: 'loc-mandaue',
    name: 'Mandaue',
    tagline: 'Industrial & Urban Gateway',
    propertyCount: 6,
    image: '/assets/extracted/astra_centre.png',
    description: 'Strategic commercial junction connecting mainland Cebu with Mactan island bridges.',
  },
  {
    id: 'loc-lapu-lapu',
    name: 'Lapu-Lapu City',
    tagline: 'Island Resort & Waterfront',
    propertyCount: 9,
    image: '/assets/extracted/mactan_newtown.png',
    description: 'Sun-drenched beaches, 5-star seaside hotels, and serene island living.',
  },
];

const LOCATIONS_COLLECTION = 'locations';

export async function getAllLocations(): Promise<LocationHighlight[]> {
  try {
    const snap = await getDocs(collection(db, LOCATIONS_COLLECTION));
    if (!snap.empty) {
      const locs: LocationHighlight[] = [];
      snap.forEach((d) => locs.push(d.data() as LocationHighlight));
      return locs;
    }
  } catch (err) {
    console.warn('Could not read locations from Firestore, falling back to defaults:', err);
  }
  return INITIAL_LOCATIONS;
}

export async function saveLocation(loc: LocationHighlight): Promise<void> {
  const locRef = doc(db, LOCATIONS_COLLECTION, loc.id);
  await setDoc(locRef, loc, { merge: true });
}

export async function deleteLocation(id: string): Promise<void> {
  const locRef = doc(db, LOCATIONS_COLLECTION, id);
  await deleteDoc(locRef);
}
