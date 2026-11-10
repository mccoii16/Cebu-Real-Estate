import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

/**
 * Helper to generate a client-side preview URL for an image file before upload.
 */
export function createLocalImagePreview(file: File): string {
  return URL.createObjectURL(file);
}
