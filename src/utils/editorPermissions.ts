import {
  AuditAction,
  BuildingDoc,
  LocationHighlight,
  PropertyDoc,
  PropertyStatus,
  UserRole,
} from '../types/property';
import { getEffectivePublishStatus } from './contentManagement';

export function canAccessAdminSettings(role?: UserRole | null): boolean {
  return role === 'superadmin';
}

export function canAccessInquiries(role?: UserRole | null): boolean {
  return role === 'superadmin';
}

export function canAccessPaymentSettings(role?: UserRole | null): boolean {
  return role === 'superadmin';
}

export function canManageUsers(role?: UserRole | null): boolean {
  return role === 'superadmin';
}

export function canApproveOrRejectProperty(role?: UserRole | null): boolean {
  return role === 'superadmin';
}

export function canChangePropertyOwnership(role?: UserRole | null): boolean {
  return role === 'superadmin';
}

export function canPermanentlyDeleteRecord(role?: UserRole | null): boolean {
  return role === 'superadmin';
}

export function canViewAuditLogs(role?: UserRole | null): boolean {
  return role === 'superadmin';
}

export function canManageEditorialContent(role?: UserRole | null): boolean {
  return role === 'superadmin' || role === 'editor';
}

export function canPublishBuildingOrNeighborhood(role?: UserRole | null): boolean {
  return role === 'superadmin' || role === 'editor';
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateEditorPropertyCreate(incoming: PropertyDoc): ValidationResult {
  if (incoming.status !== 'draft' && incoming.status !== 'pending') {
    return {
      valid: false,
      reason: 'Editors cannot bypass approval: new properties must be saved as draft or pending.',
    };
  }
  if (incoming.featured) {
    return {
      valid: false,
      reason: 'Editors cannot set featured homepage promotion flags.',
    };
  }
  if (incoming.approvedAt || incoming.approvedBy) {
    return {
      valid: false,
      reason: 'Editors cannot assign property approval metadata.',
    };
  }
  return { valid: true };
}

export function validateEditorPropertyUpdate(
  existing: PropertyDoc,
  incoming: PropertyDoc
): ValidationResult {
  if (incoming.propertyId !== existing.propertyId) {
    return { valid: false, reason: 'Property ID cannot be changed.' };
  }
  if (incoming.agentId !== existing.agentId || incoming.agentName !== existing.agentName) {
    return {
      valid: false,
      reason: 'Editors cannot reassign or modify property Agent ownership.',
    };
  }
  if (Boolean(incoming.featured) !== Boolean(existing.featured)) {
    return {
      valid: false,
      reason: 'Editors cannot modify homepage featured promotion status.',
    };
  }
  if (
    (incoming.approvedAt ?? null) !== (existing.approvedAt ?? null) ||
    (incoming.approvedBy ?? null) !== (existing.approvedBy ?? null) ||
    (incoming.rejectionReason ?? null) !== (existing.rejectionReason ?? null)
  ) {
    return {
      valid: false,
      reason: 'Editors cannot alter property approval or rejection metadata.',
    };
  }
  if (
    Boolean(incoming.hasPendingReview) !== Boolean(existing.hasPendingReview) ||
    JSON.stringify(incoming.pendingChanges ?? null) !== JSON.stringify(existing.pendingChanges ?? null)
  ) {
    return {
      valid: false,
      reason: 'Editors cannot overwrite pending revision review state.',
    };
  }

  // Status transition rules
  const isArchiving =
    existing.status !== 'archived' &&
    incoming.status === 'archived' &&
    (incoming.previousStatus ?? null) === existing.status;

  const expectedRestoreStatus: PropertyStatus = existing.previousStatus || 'draft';
  const isRestoring =
    existing.status === 'archived' &&
    incoming.status === expectedRestoreStatus &&
    (incoming.previousStatus ?? null) === null;

  const isDraftSubmission = existing.status === 'draft' && incoming.status === 'pending';

  const isSameStatus =
    incoming.status === existing.status &&
    (incoming.previousStatus ?? null) === (existing.previousStatus ?? null);

  if (!isArchiving && !isRestoring && !isDraftSubmission && !isSameStatus) {
    return {
      valid: false,
      reason: `Editors cannot transition property status from "${existing.status}" to "${incoming.status}". Super Admin approval is required.`,
    };
  }

  return { valid: true };
}

const PROPERTY_AUDIT_FIELDS: Array<keyof PropertyDoc> = [
  'propertyTitle',
  'slug',
  'buildingId',
  'buildingName',
  'location',
  'address',
  'propertyType',
  'listingType',
  'price',
  'bedrooms',
  'bathrooms',
  'floorArea',
  'lotArea',
  'parkingSpaces',
  'furnishingStatus',
  'floorLevel',
  'availabilityLabel',
  'latitude',
  'longitude',
  'mapUrl',
  'description',
  'features',
  'amenities',
  'images',
  'seoTitle',
  'seoDescription',
  'status',
];

const BUILDING_AUDIT_FIELDS: Array<keyof BuildingDoc> = [
  'buildingName',
  'slug',
  'location',
  'address',
  'description',
  'developer',
  'buildingType',
  'yearCompleted',
  'totalFloors',
  'buildingImages',
  'amenities',
  'facilities',
  'nearbyLandmarks',
  'latitude',
  'longitude',
  'mapUrl',
  'seoTitle',
  'seoDescription',
  'status',
];

const NEIGHBORHOOD_AUDIT_FIELDS: Array<keyof LocationHighlight> = [
  'name',
  'slug',
  'tagline',
  'cityOrMunicipality',
  'description',
  'image',
  'galleryImages',
  'highlights',
  'nearbyLandmarks',
  'lifestyleInfo',
  'transportationInfo',
  'latitude',
  'longitude',
  'mapUrl',
  'seoTitle',
  'seoDescription',
  'status',
];

function normalizeForDiff(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value.map(normalizeForDiff);
  return value;
}

export function computeChangedFields<T extends object>(
  before: T | null | undefined,
  after: T,
  candidateFields: Array<keyof T>
): string[] {
  if (!before) {
    return candidateFields
      .filter((key) => {
        const v = after[key];
        if (Array.isArray(v)) return v.length > 0;
        return v !== undefined && v !== null && v !== '';
      })
      .map((k) => String(k));
  }

  const changed: string[] = [];
  for (const field of candidateFields) {
    const prevVal = normalizeForDiff(before[field]);
    const nextVal = normalizeForDiff(after[field]);
    if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
      changed.push(String(field));
    }
  }
  return changed;
}

export function computePropertyChangedFields(
  before: PropertyDoc | null | undefined,
  after: PropertyDoc
): string[] {
  return computeChangedFields(before, after, PROPERTY_AUDIT_FIELDS);
}

export function computeBuildingChangedFields(
  before: BuildingDoc | null | undefined,
  after: BuildingDoc
): string[] {
  return computeChangedFields(before, after, BUILDING_AUDIT_FIELDS);
}

export function computeNeighborhoodChangedFields(
  before: LocationHighlight | null | undefined,
  after: LocationHighlight
): string[] {
  return computeChangedFields(before, after, NEIGHBORHOOD_AUDIT_FIELDS);
}

export function inferAuditAction(
  isCreate: boolean,
  beforeStatus?: string | null,
  afterStatus?: string | null,
  defaultAction: AuditAction = 'update'
): AuditAction {
  if (isCreate) return 'create';
  if (beforeStatus !== 'archived' && afterStatus === 'archived') return 'archive';
  if (beforeStatus === 'archived' && afterStatus !== 'archived') return 'restore';
  if (beforeStatus !== 'published' && afterStatus === 'published') return 'publish';
  if (beforeStatus === 'published' && afterStatus === 'unpublished') return 'unpublish';
  return defaultAction;
}

export interface RecentContentItem {
  id: string;
  contentType: 'property' | 'building' | 'neighborhood';
  title: string;
  subtitle: string;
  status: string;
  updatedAt: string;
}

export interface EditorDashboardMetrics {
  totalProperties: number;
  totalBuildings: number;
  totalNeighborhoods: number;
  draftContentCount: number;
  pendingApprovalCount: number;
  publishedContentCount: number;
  archivedContentCount: number;
  recentlyUpdated: RecentContentItem[];
}

export function computeEditorMetrics(
  properties: PropertyDoc[],
  buildings: BuildingDoc[],
  locations: LocationHighlight[],
  recentLimit = 10
): EditorDashboardMetrics {
  let draftProperties = 0;
  let pendingProperties = 0;
  let approvedProperties = 0;
  let archivedProperties = 0;

  for (const p of properties) {
    if (p.status === 'draft') draftProperties++;
    else if (p.status === 'pending') pendingProperties++;
    else if (p.status === 'approved') approvedProperties++;
    else if (p.status === 'archived') archivedProperties++;
  }

  let unpublishedBuildings = 0;
  let publishedBuildings = 0;
  let archivedBuildings = 0;

  for (const b of buildings) {
    const st = getEffectivePublishStatus(b);
    if (st === 'published') publishedBuildings++;
    else if (st === 'unpublished') unpublishedBuildings++;
    else if (st === 'archived') archivedBuildings++;
  }

  let unpublishedNeighborhoods = 0;
  let publishedNeighborhoods = 0;
  let archivedNeighborhoods = 0;

  for (const l of locations) {
    const st = getEffectivePublishStatus(l);
    if (st === 'published') publishedNeighborhoods++;
    else if (st === 'unpublished') unpublishedNeighborhoods++;
    else if (st === 'archived') archivedNeighborhoods++;
  }

  const combined: RecentContentItem[] = [
    ...properties.map((p) => ({
      id: p.propertyId,
      contentType: 'property' as const,
      title: p.propertyTitle,
      subtitle: `${p.buildingName} • ${p.location}`,
      status: p.status,
      updatedAt: p.updatedAt || p.createdAt || '',
    })),
    ...buildings.map((b) => ({
      id: b.buildingId,
      contentType: 'building' as const,
      title: b.buildingName,
      subtitle: b.location,
      status: getEffectivePublishStatus(b),
      updatedAt: b.updatedAt || b.createdAt || '',
    })),
    ...locations.map((l) => ({
      id: l.id,
      contentType: 'neighborhood' as const,
      title: l.name,
      subtitle: l.cityOrMunicipality || l.tagline,
      status: getEffectivePublishStatus(l),
      updatedAt: l.updatedAt || l.createdAt || '',
    })),
  ].sort((a, b) => {
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });

  return {
    totalProperties: properties.length,
    totalBuildings: buildings.length,
    totalNeighborhoods: locations.length,
    draftContentCount: draftProperties + unpublishedBuildings + unpublishedNeighborhoods,
    pendingApprovalCount: pendingProperties,
    publishedContentCount: approvedProperties + publishedBuildings + publishedNeighborhoods,
    archivedContentCount: archivedProperties + archivedBuildings + archivedNeighborhoods,
    recentlyUpdated: combined.slice(0, Math.max(1, recentLimit)),
  };
}
