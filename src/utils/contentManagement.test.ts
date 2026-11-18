import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BuildingDoc,
  LocationHighlight,
  PropertyDoc,
  WebsiteSettings,
} from '../types/property';
import {
  checkBuildingDeleteSafety,
  checkNeighborhoodDeleteSafety,
  collectAllReferencedImageUrls,
  findOrphanedRemovedImages,
  getEffectivePublishStatus,
  isBuildingPubliclyVisible,
  isNeighborhoodPubliclyVisible,
  parseCommaList,
  removeGalleryImage,
  reorderGalleryImages,
  setGalleryCoverImage,
  validateBuildingForm,
  validateNeighborhoodForm,
  validatePropertyForm,
} from './contentManagement';

function makeProperty(overrides: Partial<PropertyDoc> = {}): PropertyDoc {
  return {
    propertyId: 'prop-1',
    buildingId: 'bld-1',
    buildingName: 'The Alcoves',
    propertyTitle: 'Skyline Residence 18B',
    location: 'Cebu Business Park',
    address: 'Luzon Ave, Cebu Business Park',
    propertyType: 'Condo',
    listingType: 'sale',
    price: 15000000,
    bedrooms: 2,
    bathrooms: 2,
    floorArea: 95,
    description: 'Luxury sky residence.',
    amenities: ['Pool'],
    images: ['https://storage.example/a.jpg', 'https://storage.example/b.jpg'],
    featured: true,
    status: 'approved',
    agentId: 'agent-1',
    agentName: 'Agent One',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBuilding(overrides: Partial<BuildingDoc> = {}): BuildingDoc {
  return {
    buildingId: 'bld-1',
    buildingName: 'The Alcoves',
    location: 'Cebu Business Park',
    address: 'Luzon Ave, Cebu Business Park',
    description: 'Premier Ayala Land tower.',
    buildingImages: ['https://storage.example/bld-cover.jpg'],
    amenities: ['Pool'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeNeighborhood(overrides: Partial<LocationHighlight> = {}): LocationHighlight {
  return {
    id: 'loc-cbp',
    name: 'Cebu Business Park',
    tagline: 'Financial Core',
    propertyCount: 5,
    image: 'https://storage.example/cbp.jpg',
    description: 'Masterplanned business district.',
    ...overrides,
  };
}

test('getEffectivePublishStatus treats legacy undefined status as published and honors explicit states', () => {
  assert.equal(getEffectivePublishStatus(makeBuilding()), 'published');
  assert.equal(isBuildingPubliclyVisible(makeBuilding()), true);
  assert.equal(isBuildingPubliclyVisible(makeBuilding({ status: 'unpublished' })), false);
  assert.equal(isBuildingPubliclyVisible(makeBuilding({ status: 'archived' })), false);

  assert.equal(isNeighborhoodPubliclyVisible(makeNeighborhood()), true);
  assert.equal(isNeighborhoodPubliclyVisible(makeNeighborhood({ status: 'unpublished' })), false);
  assert.equal(isNeighborhoodPubliclyVisible(makeNeighborhood({ status: 'archived' })), false);
});

test('checkBuildingDeleteSafety prevents deletion when any property references the building', () => {
  const bld = makeBuilding();
  const unsafe = checkBuildingDeleteSafety(bld, [makeProperty({ status: 'archived' })]);
  assert.equal(unsafe.canDelete, false);
  assert.equal(unsafe.blockingPropertyCount, 1);

  const safe = checkBuildingDeleteSafety(bld, [makeProperty({ buildingId: 'bld-other' })]);
  assert.equal(safe.canDelete, true);
  assert.equal(safe.blockingPropertyCount, 0);
});

test('checkNeighborhoodDeleteSafety prevents deletion when buildings or properties match area name', () => {
  const loc = makeNeighborhood({ id: 'loc-it', name: 'Cebu IT Park' });
  const blockedByProp = checkNeighborhoodDeleteSafety(
    loc,
    [],
    [makeProperty({ location: 'IT Park' })]
  );
  assert.equal(blockedByProp.canDelete, false);
  assert.equal(blockedByProp.blockingPropertyCount, 1);

  const blockedByBuilding = checkNeighborhoodDeleteSafety(
    loc,
    [makeBuilding({ location: 'Cebu IT Park' })],
    []
  );
  assert.equal(blockedByBuilding.canDelete, false);
  assert.equal(blockedByBuilding.blockingBuildingCount, 1);

  const safe = checkNeighborhoodDeleteSafety(
    loc,
    [makeBuilding({ location: 'Mactan Newtown' })],
    [makeProperty({ location: 'Banilad' })]
  );
  assert.equal(safe.canDelete, true);
});

test('collectAllReferencedImageUrls & findOrphanedRemovedImages protect shared images across all entities', () => {
  const sharedUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/shared.jpg?alt=media';
  const removedUniqueUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/old.jpg?alt=media';
  const pendingUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/pending.jpg?alt=media';

  const refs = collectAllReferencedImageUrls({
    properties: [
      makeProperty({
        propertyId: 'prop-2',
        images: [sharedUrl],
        pendingChanges: { images: [pendingUrl] },
      }),
    ],
    buildings: [makeBuilding({ buildingImages: ['https://storage.example/b1.jpg'] })],
    locations: [makeNeighborhood({ galleryImages: ['https://storage.example/g1.jpg'] })],
    siteSettings: {
      aboutImage: 'https://storage.example/about.jpg',
      heroSlides: [{ id: 1, label: '01', location: 'Cebu', image: 'https://storage.example/hero.jpg', headlineLine1: 'A', headlineLine2: 'B', subheading: 'C' }],
    } as WebsiteSettings,
  });

  assert.equal(refs.has(sharedUrl), true);
  assert.equal(refs.has(pendingUrl), true);
  assert.equal(refs.has('https://storage.example/hero.jpg'), true);

  const orphans = findOrphanedRemovedImages(
    [sharedUrl, removedUniqueUrl, pendingUrl],
    ['https://storage.example/kept.jpg'],
    refs
  );

  assert.deepEqual(orphans, [removedUniqueUrl]);
});

test('gallery manipulation helpers reorder, promote cover, and remove cleanly', () => {
  const start = ['img-1', 'img-2', 'img-3'];
  assert.deepEqual(reorderGalleryImages(start, 0, 2), ['img-2', 'img-3', 'img-1']);
  assert.deepEqual(setGalleryCoverImage(start, 2), ['img-3', 'img-1', 'img-2']);
  assert.deepEqual(removeGalleryImage(start, 1), ['img-1', 'img-3']);
  assert.deepEqual(parseCommaList('Pool, Gym, pool , Rooftop Deck'), [
    'Pool',
    'Gym',
    'Rooftop Deck',
  ]);
});

test('form validators check coordinates, URLs, and numeric bounds', () => {
  const validProp = validatePropertyForm({
    propertyTitle: 'Corner Penthouse',
    address: 'Cebu Business Park',
    price: 25000000,
    floorArea: 140,
    bedrooms: 3,
    bathrooms: 3,
    images: ['/assets/extracted/the_alcoves.png'],
    latitudeStr: '10.3173',
    longitudeStr: '123.9056',
    mapUrl: 'https://maps.google.com/?q=10.3173,123.9056',
  });
  assert.equal(validProp.isValid, true);
  assert.equal(validProp.latitude, 10.3173);

  const invalidCoords = validateBuildingForm({
    buildingName: 'Test Tower',
    location: 'Cebu Business Park',
    images: ['/assets/extracted/the_alcoves.png'],
    latitudeStr: '95',
    longitudeStr: '123.9',
  });
  assert.equal(invalidCoords.isValid, false);

  const invalidUrl = validateNeighborhoodForm({
    name: 'Mactan Newtown',
    images: ['/assets/extracted/loc_mactan.png'],
    mapUrl: 'javascript:alert(1)',
  });
  assert.equal(invalidUrl.isValid, false);
});
