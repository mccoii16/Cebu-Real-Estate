import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessAdminSettings,
  canAccessInquiries,
  canAccessPaymentSettings,
  canApproveOrRejectProperty,
  canChangePropertyOwnership,
  canManageEditorialContent,
  canManageUsers,
  canPermanentlyDeleteRecord,
  canPublishBuildingOrNeighborhood,
  canViewAuditLogs,
  computeBuildingChangedFields,
  computeEditorMetrics,
  computeNeighborhoodChangedFields,
  computePropertyChangedFields,
  inferAuditAction,
  validateEditorPropertyCreate,
  validateEditorPropertyUpdate,
} from './editorPermissions';
import { BuildingDoc, LocationHighlight, PropertyDoc } from '../types/property';

const BASE_PROPERTY: PropertyDoc = {
  propertyId: 'prop-1',
  slug: 'alcoves-suite-18b',
  buildingId: 'bld-1',
  buildingName: 'The Alcoves',
  propertyTitle: 'The Alcoves Suite 18B',
  location: 'Cebu Business Park',
  address: 'Luzon Ave, Cebu City',
  propertyType: 'Condo',
  listingType: 'sale',
  price: 12000000,
  bedrooms: 2,
  bathrooms: 2,
  floorArea: 85,
  description: 'Original description',
  features: ['Private Balcony'],
  amenities: ['Swimming Pool'],
  images: ['/assets/extracted/photo_the_alcoves.png'],
  featured: false,
  status: 'pending',
  previousStatus: null,
  archivedAt: null,
  agentId: 'agent-1',
  agentName: 'Maria Santos',
  rejectionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  submittedAt: '2026-01-02T00:00:00.000Z',
  approvedAt: null,
  approvedBy: null,
  hasPendingReview: false,
  pendingChanges: null,
};

test('Editor role RBAC capability matrix strictly separates Super Admin vs Editor vs Agent', () => {
  assert.equal(canManageEditorialContent('editor'), true);
  assert.equal(canPublishBuildingOrNeighborhood('editor'), true);

  assert.equal(canAccessAdminSettings('editor'), false);
  assert.equal(canAccessInquiries('editor'), false);
  assert.equal(canAccessPaymentSettings('editor'), false);
  assert.equal(canManageUsers('editor'), false);
  assert.equal(canApproveOrRejectProperty('editor'), false);
  assert.equal(canChangePropertyOwnership('editor'), false);
  assert.equal(canPermanentlyDeleteRecord('editor'), false);
  assert.equal(canViewAuditLogs('editor'), false);

  assert.equal(canManageUsers('superadmin'), true);
  assert.equal(canApproveOrRejectProperty('superadmin'), true);
  assert.equal(canPermanentlyDeleteRecord('superadmin'), true);
  assert.equal(canAccessPaymentSettings('superadmin'), true);
  assert.equal(canViewAuditLogs('superadmin'), true);

  assert.equal(canManageEditorialContent('agent'), false);
  assert.equal(canPublishBuildingOrNeighborhood('agent'), false);
});

test('validateEditorPropertyCreate forbids creating pre-approved or featured listings', () => {
  const validDraft = validateEditorPropertyCreate({
    ...BASE_PROPERTY,
    status: 'draft',
  });
  assert.equal(validDraft.valid, true);

  const validPending = validateEditorPropertyCreate({
    ...BASE_PROPERTY,
    status: 'pending',
  });
  assert.equal(validPending.valid, true);

  const illegalApproved = validateEditorPropertyCreate({
    ...BASE_PROPERTY,
    status: 'approved',
  });
  assert.equal(illegalApproved.valid, false);

  const illegalFeatured = validateEditorPropertyCreate({
    ...BASE_PROPERTY,
    status: 'draft',
    featured: true,
  });
  assert.equal(illegalFeatured.valid, false);
});

test('validateEditorPropertyUpdate allows content/SEO edits while blocking approval bypass and ownership changes', () => {
  // Editor edits Agent-submitted pending property content & SEO (preserves status='pending' and agentId)
  const validContentEdit = validateEditorPropertyUpdate(BASE_PROPERTY, {
    ...BASE_PROPERTY,
    description: 'Refined editorial copy',
    seoTitle: 'The Alcoves 2BR Luxury Suite | Cebu Business Park',
    amenities: ['Swimming Pool', 'Sky Lounge'],
  });
  assert.equal(validContentEdit.valid, true);

  // Blocked: Editor tries to approve Agent-submitted pending property
  const approveAttempt = validateEditorPropertyUpdate(BASE_PROPERTY, {
    ...BASE_PROPERTY,
    status: 'approved',
  });
  assert.equal(approveAttempt.valid, false);

  // Blocked: Editor tries to reject Agent-submitted pending property
  const rejectAttempt = validateEditorPropertyUpdate(BASE_PROPERTY, {
    ...BASE_PROPERTY,
    status: 'rejected',
  });
  assert.equal(rejectAttempt.valid, false);

  // Blocked: Editor tries to reassign property ownership
  const ownershipAttempt = validateEditorPropertyUpdate(BASE_PROPERTY, {
    ...BASE_PROPERTY,
    agentId: 'editor-uid',
    agentName: 'Editor Self',
  });
  assert.equal(ownershipAttempt.valid, false);

  // Blocked: Editor tries to toggle featured promotion
  const featuredAttempt = validateEditorPropertyUpdate(BASE_PROPERTY, {
    ...BASE_PROPERTY,
    featured: true,
  });
  assert.equal(featuredAttempt.valid, false);
});

test('validateEditorPropertyUpdate supports Archive and Restore without bypassing approval state', () => {
  // Archive a pending property -> stores previousStatus='pending'
  const archived: PropertyDoc = {
    ...BASE_PROPERTY,
    status: 'archived',
    previousStatus: 'pending',
    archivedAt: '2026-01-03T00:00:00.000Z',
  };
  assert.equal(validateEditorPropertyUpdate(BASE_PROPERTY, archived).valid, true);

  // Restore archived property -> must return to previousStatus='pending', NOT 'approved'
  const validRestore: PropertyDoc = {
    ...archived,
    status: 'pending',
    previousStatus: null,
    archivedAt: null,
  };
  assert.equal(validateEditorPropertyUpdate(archived, validRestore).valid, true);

  const bypassRestore: PropertyDoc = {
    ...archived,
    status: 'approved',
    previousStatus: null,
  };
  assert.equal(validateEditorPropertyUpdate(archived, bypassRestore).valid, false);
});

test('Audit diff helpers accurately identify changed fields and actions', () => {
  const propChanges = computePropertyChangedFields(BASE_PROPERTY, {
    ...BASE_PROPERTY,
    description: 'Updated description',
    seoTitle: 'SEO Title',
    images: [...BASE_PROPERTY.images, '/assets/extracted/photo_park_avenue.png'],
  });
  assert.deepEqual(propChanges, ['description', 'images', 'seoTitle']);

  const bld1: BuildingDoc = {
    buildingId: 'bld-1',
    buildingName: 'The Alcoves',
    location: 'Cebu Business Park',
    address: 'Luzon Ave',
    description: 'Desc',
    buildingImages: ['/a.png'],
    amenities: ['Pool'],
    status: 'unpublished',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const bld2: BuildingDoc = {
    ...bld1,
    status: 'published',
    developer: 'Ayala Land Premier',
  };
  assert.deepEqual(computeBuildingChangedFields(bld1, bld2), ['developer', 'status']);
  assert.equal(inferAuditAction(false, 'unpublished', 'published'), 'publish');
  assert.equal(inferAuditAction(false, 'published', 'unpublished'), 'unpublish');
  assert.equal(inferAuditAction(false, 'published', 'archived'), 'archive');
  assert.equal(inferAuditAction(false, 'archived', 'unpublished'), 'restore');
  assert.equal(inferAuditAction(true, null, 'draft'), 'create');

  const loc1: LocationHighlight = {
    id: 'loc-1',
    name: 'Cebu Business Park',
    tagline: 'Financial Core',
    propertyCount: 5,
    image: '/loc.png',
    description: 'Core CBD',
    status: 'published',
  };
  const loc2: LocationHighlight = {
    ...loc1,
    transportationInfo: '25 mins to airport',
  };
  assert.deepEqual(computeNeighborhoodChangedFields(loc1, loc2), ['transportationInfo']);
});

test('computeEditorMetrics aggregates properties, buildings, neighborhoods and recent updates', () => {
  const properties: PropertyDoc[] = [
    { ...BASE_PROPERTY, propertyId: 'p1', status: 'draft', updatedAt: '2026-01-05T00:00:00.000Z' },
    { ...BASE_PROPERTY, propertyId: 'p2', status: 'approved', updatedAt: '2026-01-08T00:00:00.000Z' },
    { ...BASE_PROPERTY, propertyId: 'p3', status: 'archived', updatedAt: '2026-01-02T00:00:00.000Z' },
  ];
  const buildings: BuildingDoc[] = [
    {
      buildingId: 'b1',
      buildingName: 'Bldg 1',
      location: 'Cebu Business Park',
      address: 'Addr',
      description: 'D',
      buildingImages: ['/a.png'],
      amenities: [],
      status: 'published',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-09T00:00:00.000Z',
    },
    {
      buildingId: 'b2',
      buildingName: 'Bldg 2',
      location: 'IT Park',
      address: 'Addr',
      description: 'D',
      buildingImages: ['/b.png'],
      amenities: [],
      status: 'unpublished',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    },
  ];
  const locations: LocationHighlight[] = [
    {
      id: 'l1',
      name: 'CBP',
      tagline: 'Hub',
      propertyCount: 2,
      image: '/l.png',
      description: 'D',
      status: 'archived',
      updatedAt: '2026-01-07T00:00:00.000Z',
    },
  ];

  const metrics = computeEditorMetrics(properties, buildings, locations, 3);
  assert.equal(metrics.totalProperties, 3);
  assert.equal(metrics.totalBuildings, 2);
  assert.equal(metrics.totalNeighborhoods, 1);
  assert.equal(metrics.draftContentCount, 2); // 1 draft prop + 1 unpublished bldg
  assert.equal(metrics.publishedContentCount, 2); // 1 approved prop + 1 published bldg
  assert.equal(metrics.archivedContentCount, 2); // 1 archived prop + 1 archived loc
  assert.equal(metrics.recentlyUpdated.length, 3);
  assert.equal(metrics.recentlyUpdated[0].id, 'b1');
});
