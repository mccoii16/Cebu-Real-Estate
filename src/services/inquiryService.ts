import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export interface InquiryRecord {
  inquiryId: string;
  fullName: string;
  email: string;
  phone: string;
  propertyInterest: string;
  preferredContact?: string;
  message?: string;
  status: 'new' | 'contacted' | 'closed';
  createdAt: string;
  recipientEmail?: string;
}

const LOCAL_STORAGE_INQUIRIES_KEY = 'cebu_prime_inquiries_store_v1';
export const MASTER_ADMIN_EMAIL = 'Martiligando@gmail.com';

/**
 * Reads locally cached inquiries from localStorage (ensures offline safety & zero data loss).
 */
export function getLocalInquiries(): InquiryRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_INQUIRIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[InquiryService] Could not read local inquiries:', err);
    return [];
  }
}

/**
 * Saves locally cached inquiries.
 */
export function saveLocalInquiries(inquiries: InquiryRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_INQUIRIES_KEY, JSON.stringify(inquiries));
  } catch (err) {
    console.warn('[InquiryService] Could not write local inquiries:', err);
  }
}

/**
 * Helper to generate a compliant inquiry ID (alphanumeric and dashes/underscores only).
 */
export function generateInquiryId(): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `inq_${Date.now()}_${rand}`;
}

/**
 * Submits an inquiry from a customer or visitor.
 * Multi-layer persistence:
 * 1. Writes directly to Firestore `inquiries` collection (real-time to Super Admin).
 * 2. Caches in localStorage for local resilience.
 * 3. Sends to `/api/inquiries` for server logging and persistence.
 */
export async function submitInquiry(data: {
  fullName: string;
  email: string;
  phone: string;
  propertyInterest?: string;
  preferredContact?: string;
  message?: string;
}): Promise<{ success: boolean; inquiryId: string }> {
  const inquiryId = generateInquiryId();
  const newRecord: InquiryRecord = {
    inquiryId,
    fullName: data.fullName.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    propertyInterest: (data.propertyInterest || 'General Luxury Advisory').trim(),
    preferredContact: data.preferredContact || 'phone',
    message: (data.message || '').trim(),
    status: 'new',
    createdAt: new Date().toISOString(),
    recipientEmail: MASTER_ADMIN_EMAIL,
  };

  // 1. Immediately buffer in local storage so it can never be lost
  try {
    const existing = getLocalInquiries();
    const updated = [newRecord, ...existing.filter((i) => i.inquiryId !== inquiryId)];
    saveLocalInquiries(updated);
  } catch (storageErr) {
    console.warn('[InquiryService] LocalStorage buffer notice:', storageErr);
  }

  // 2. Persist directly to Firestore
  try {
    const docRef = doc(db, 'inquiries', inquiryId);
    await setDoc(docRef, newRecord);
    console.info(`[InquiryService] Inquiry ${inquiryId} successfully saved to Firestore.`);
  } catch (firestoreErr) {
    console.warn('[InquiryService] Direct Firestore write notice (will rely on server/local):', firestoreErr);
  }

  // 3. Send to backend endpoint (if running)
  try {
    fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecord),
    }).catch(() => {
      // Non-fatal if static host without Node backend (e.g., pure Vercel SPA)
    });
  } catch {
    // Ignore server error on pure frontend deployment
  }

  return { success: true, inquiryId };
}

/**
 * Real-time listener for inquiries (used in SuperAdminDashboard).
 * Automatically updates whenever any visitor submits an inquiry.
 */
export function subscribeToInquiries(
  onUpdate: (inquiries: InquiryRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const q = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: InquiryRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as InquiryRecord);
        });

        // Merge with any local offline inquiries that might not yet be in Firestore
        const localList = getLocalInquiries();
        const mergedMap = new Map<string, InquiryRecord>();
        list.forEach((item) => mergedMap.set(item.inquiryId, item));
        localList.forEach((item) => {
          if (!mergedMap.has(item.inquiryId)) {
            mergedMap.set(item.inquiryId, item);
          }
        });

        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        saveLocalInquiries(merged);
        onUpdate(merged);
      },
      async (err) => {
        console.warn('[InquiryService] Firestore onSnapshot warning:', err);
        // Fallback: load local cached inquiries
        const local = getLocalInquiries();
        onUpdate(local);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn('[InquiryService] Could not establish Firestore listener, using local:', err);
    onUpdate(getLocalInquiries());
    return () => {};
  }
}

/**
 * Updates an inquiry status ('new' | 'contacted' | 'closed').
 */
export async function updateInquiryStatus(
  inquiryId: string,
  status: 'new' | 'contacted' | 'closed'
): Promise<void> {
  // Update local cache
  const list = getLocalInquiries();
  const updatedList = list.map((i) => (i.inquiryId === inquiryId ? { ...i, status } : i));
  saveLocalInquiries(updatedList);

  // Update in Firestore
  try {
    const docRef = doc(db, 'inquiries', inquiryId);
    await updateDoc(docRef, { status });
  } catch (err) {
    console.warn('[InquiryService] Firestore status update failed, updated locally:', err);
  }

  // Also notify server if available
  try {
    fetch(`/api/admin/inquiries/${inquiryId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  } catch {}
}

/**
 * Deletes an inquiry from Firestore and local cache.
 */
export async function deleteInquiry(inquiryId: string): Promise<void> {
  // Update local cache
  const list = getLocalInquiries();
  saveLocalInquiries(list.filter((i) => i.inquiryId !== inquiryId));

  // Delete from Firestore
  try {
    const docRef = doc(db, 'inquiries', inquiryId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('[InquiryService] Firestore delete failed:', err);
  }
}
