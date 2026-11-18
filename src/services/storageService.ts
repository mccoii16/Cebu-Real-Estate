import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export interface ImageUploadResult {
  url: string;
  filename: string;
  sizeBytes: number;
}

/**
 * Upload an image file to Firebase Storage under the designated property folder.
 * Returns the public persistent download URL.
 */
export async function uploadPropertyPhoto(
  file: File,
  propertyId: string
): Promise<ImageUploadResult> {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `properties/${propertyId}/${timestamp}_${sanitizedName}`;
  const storageRef = ref(storage, storagePath);

  // Upload metadata
  const metadata = {
    contentType: file.type || 'image/jpeg',
    customMetadata: {
      propertyId,
      uploadedAt: new Date().toISOString(),
    },
  };

  const snapshot = await uploadBytes(storageRef, file, metadata);
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return {
    url: downloadUrl,
    filename: file.name,
    sizeBytes: file.size,
  };
}

/**
 * Upload multiple images for a property.
 */
export async function uploadMultiplePropertyPhotos(
  files: File[],
  propertyId: string
): Promise<ImageUploadResult[]> {
  const uploadPromises = files.map((file) => uploadPropertyPhoto(file, propertyId));
  return Promise.all(uploadPromises);
}

/**
 * Upload a site or landing page asset to Firebase Storage.
 */
export async function uploadSiteAsset(
  file: File,
  folder: string = 'landing-page'
): Promise<ImageUploadResult> {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `site_assets/${folder}/${timestamp}_${sanitizedName}`;
  const storageRef = ref(storage, storagePath);

  const metadata = {
    contentType: file.type || 'image/jpeg',
    customMetadata: {
      folder,
      uploadedAt: new Date().toISOString(),
    },
  };

  const snapshot = await uploadBytes(storageRef, file, metadata);
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return {
    url: downloadUrl,
    filename: file.name,
    sizeBytes: file.size,
  };
}

export async function uploadBuildingPhoto(
  file: File,
  buildingId: string
): Promise<ImageUploadResult> {
  return uploadSiteAsset(file, `buildings-${buildingId}`);
}

export async function uploadNeighborhoodPhoto(
  file: File,
  neighborhoodId: string
): Promise<ImageUploadResult> {
  return uploadSiteAsset(file, `neighborhoods-${neighborhoodId}`);
}

/**
 * Extracts the Firebase Storage object path from a standard download URL or gs:// URI.
 * Returns null for local `/assets/...` or external non-Firebase URLs.
 */
export function parseFirebaseStoragePath(url: string): string | null {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith('gs://')) {
      const withoutScheme = trimmed.slice('gs://'.length);
      const firstSlash = withoutScheme.indexOf('/');
      if (firstSlash <= 0) return null;
      return decodeURIComponent(withoutScheme.slice(firstSlash + 1));
    }

    const parsed = new URL(trimmed);
    if (
      parsed.hostname !== 'firebasestorage.googleapis.com' &&
      !parsed.hostname.endsWith('.firebasestorage.app')
    ) {
      return null;
    }

    const marker = '/o/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;

    const encodedPath = parsed.pathname.slice(idx + marker.length);
    return encodedPath ? decodeURIComponent(encodedPath) : null;
  } catch {
    return null;
  }
}

/**
 * Safely deletes an image from Firebase Storage by its download URL.
 * Non-Firebase URLs or already-deleted files resolve silently without crashing saves.
 */
export async function deleteStorageImageByUrl(url: string): Promise<boolean> {
  const path = parseFirebaseStoragePath(url);
  if (!path) return false;
  try {
    await deleteObject(ref(storage, path));
    return true;
  } catch (err: any) {
    console.warn('Storage cleanup skipped for', path, err?.code || err?.message || err);
    return false;
  }
}

/**
 * Deletes candidate Storage URLs only if they are no longer referenced anywhere else.
 */
export async function deleteUnreferencedStorageImages(
  candidateUrls: string[],
  otherReferencedUrls: Set<string>
): Promise<void> {
  const unique = Array.from(new Set(candidateUrls.map((u) => (u || '').trim()).filter(Boolean)));
  await Promise.all(
    unique.map(async (url) => {
      if (!otherReferencedUrls.has(url)) {
        await deleteStorageImageByUrl(url);
      }
    })
  );
}

/**
 * Helper to generate a client-side preview URL for an image file before upload.
 */
export function createLocalImagePreview(file: File): string {
  return URL.createObjectURL(file);
}

