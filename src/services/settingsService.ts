import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { WebsiteSettings } from '../types/property';

export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  siteName: 'CEBU PRIME',
  logoSubtitle: 'PROPERTIES',
  heroHeadline: 'Find Your Perfect Property in Cebu.',
  heroSubheading: 'Modern living. Prime locations. Endless possibilities.',
  heroBadge: 'LIVE • INVEST • THRIVE',
  contactEmail: 'inquiries@cebuprimeproperties.ph',
  contactPhone: '+63 (32) 412 8888',
  officeAddress: 'Cebu Business Park, Archbishop Reyes Ave, Cebu City 6000',
  facebookUrl: 'https://facebook.com',
  instagramUrl: 'https://instagram.com',
  linkedinUrl: 'https://linkedin.com',
  heroImages: ['/assets/extracted/hero_skyline.png'],
};

const SETTINGS_DOC_REF = doc(db, 'settings', 'general');

export async function getWebsiteSettings(): Promise<WebsiteSettings> {
  try {
    const snap = await getDoc(SETTINGS_DOC_REF);
    if (snap.exists()) {
      return { ...DEFAULT_WEBSITE_SETTINGS, ...(snap.data() as Partial<WebsiteSettings>) };
    }
  } catch (err) {
    console.warn('Could not read settings from Firestore, using defaults:', err);
  }
  return DEFAULT_WEBSITE_SETTINGS;
}

export async function saveWebsiteSettings(
  settings: Partial<WebsiteSettings>,
  updatedBy: string
): Promise<WebsiteSettings> {
  const merged: WebsiteSettings = {
    ...DEFAULT_WEBSITE_SETTINGS,
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await setDoc(SETTINGS_DOC_REF, merged, { merge: true });
  return merged;
}
