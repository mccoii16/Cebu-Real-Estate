import test from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify,
  ensureUniqueSlug,
  parseRoute,
  buildPropertyPath,
  buildBuildingPath,
  buildNeighborhoodPath,
  findApprovedPropertyBySlug,
  findBuildingBySlug,
  findNeighborhoodBySlug,
  getApprovedPropertiesForBuilding,
  getApprovedPropertiesForNeighborhood,
  getBuildingsForNeighborhood,
  resolveMapLocations,
} from './slugs';
import { BuildingDoc, LocationHighlight, PropertyDoc } from '../types/property';

const mockBuildings: BuildingDoc[] = [
  {
    buildingId: 'bld-the-alcoves',
    slug: 'the-alcoves',
    buildingName: 'The Alcoves',
    location: 'Cebu Business Park',
    address: 'Luzon Avenue, Cebu Business Park, Cebu City',
    description: 'Luxury integrated tower.',
    buildingImages: ['/assets/extracted/the_alcoves.png'],
    amenities: ['Lap Pool'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    buildingId: 'bld-38-park',
    buildingName: '38 Park Avenue',
    location: 'Cebu IT Park',
    address: 'Salinas Drive, Cebu IT Park',
    description: 'Urban high-rise.',
    buildingImages: ['/assets/extracted/park_avenue.png'],
    amenities: ['Sky Gardens'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockProperties: PropertyDoc[] = [
  {
    propertyId: 'prop-1',
    slug: 'the-alcoves-18b',
    buildingId: 'bld-the-alcoves',
    buildingName: 'The Alcoves',
    propertyTitle: 'The Alcoves 18B',
    location: 'Cebu Business Park',
    address: 'Luzon Ave, Cebu City',
    propertyType: 'Condo',
    listingType: 'sale',
    price: 8500000,
    bedrooms: 1,
    bathrooms: 1,
    floorArea: 36,
    description: 'Approved condo.',
    amenities: ['Pool'],
    images: ['/assets/extracted/the_alcoves.png'],
    featured: true,
    status: 'approved',
    agentId: 'agent-1',
    agentName: 'Agent One',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    propertyId: 'prop-2-pending',
    slug: 'the-alcoves-penthouse-pending',
    buildingId: 'bld-the-alcoves',
    buildingName: 'The Alcoves',
    propertyTitle: 'The Alcoves Penthouse Pending',
    location: 'Cebu Business Park',
    address: 'Luzon Ave, Cebu City',
    propertyType: 'Penthouse',
    listingType: 'sale',
    price: 35000000,
    bedrooms: 3,
    bathrooms: 3,
    floorArea: 140,
    description: 'Pending penthouse should never appear publicly.',
    amenities: ['Pool'],
    images: ['/assets/extracted/the_alcoves.png'],
    featured: false,
    status: 'pending',
    agentId: 'agent-1',
    agentName: 'Agent One',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    propertyId: 'prop-3-legacy',
    buildingId: 'bld-38-park',
    buildingName: '38 Park Avenue',
    propertyTitle: '38 Park Avenue Corner Suite',
    location: 'Cebu IT Park',
    address: 'Salinas Drive, Cebu IT Park',
    propertyType: 'Condo',
    listingType: 'rent',
    price: 45000,
    bedrooms: 1,
    bathrooms: 1,
    floorArea: 45,
    description: 'Legacy listing without stored slug field.',
    amenities: ['Gym'],
    images: ['/assets/extracted/park_avenue.png'],
    featured: false,
    status: 'approved',
    agentId: 'agent-2',
    agentName: 'Agent Two',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockNeighborhoods: LocationHighlight[] = [
  {
    id: 'loc-cbp',
    slug: 'cebu-business-park',
    name: 'Cebu Business Park',
    tagline: 'Premier Financial District',
    propertyCount: 2,
    image: '/assets/extracted/loc_cebu_business_park.png',
    description: 'Financial hub of Cebu.',
  },
  {
    id: 'loc-it-park',
    name: 'IT Park',
    tagline: '24/7 Tech Hub',
    propertyCount: 1,
    image: '/assets/extracted/loc_it_park.png',
    description: 'Tech district.',
  },
];

test('slugify normalizes titles and strips punctuation cleanly', () => {
  assert.equal(slugify('The Alcoves — High Floor 18B!'), 'the-alcoves-high-floor-18b');
  assert.equal(slugify('Mactan-Cebu Coastal & Resort'), 'mactan-cebu-coastal-resort');
  assert.equal(slugify('   ', 'fallback-id'), 'fallback-id');
});

test('ensureUniqueSlug deduplicates collisions while preserving own record slug', () => {
  const existing = [
    { id: '1', slug: 'the-alcoves' },
    { id: '2', slug: 'the-alcoves-2' },
    { id: '3', fallbackName: '38 Park Avenue' },
  ];

  assert.equal(ensureUniqueSlug('The Alcoves', existing), 'the-alcoves-3');
  assert.equal(ensureUniqueSlug('The Alcoves', existing, '1'), 'the-alcoves');
  assert.equal(ensureUniqueSlug('38 Park Avenue', existing), '38-park-avenue-2');
  assert.equal(ensureUniqueSlug('Brand New Tower', existing), 'brand-new-tower');
});

test('parseRoute resolves home, property, building, neighborhood, and 404 routes', () => {
  assert.deepEqual(parseRoute('/'), { type: 'home' });
  assert.deepEqual(parseRoute('/properties/the-alcoves-18b/'), {
    type: 'property',
    slug: 'the-alcoves-18b',
  });
  assert.deepEqual(parseRoute('/buildings/38-park-avenue?ref=card'), {
    type: 'building',
    slug: '38-park-avenue',
  });
  assert.deepEqual(parseRoute('/neighborhoods/cebu-business-park'), {
    type: 'neighborhood',
    slug: 'cebu-business-park',
  });
  assert.deepEqual(parseRoute('/unknown/nested/route'), {
    type: 'not-found',
    path: '/unknown/nested/route',
  });
  assert.deepEqual(parseRoute('/locations/cebu-business-park'), {
    type: 'not-found',
    path: '/locations/cebu-business-park',
  });
});

test('build paths produce readable routes', () => {
  assert.equal(buildPropertyPath(mockProperties[0]), '/properties/the-alcoves-18b');
  assert.equal(buildPropertyPath(mockProperties[2]), '/properties/38-park-avenue-corner-suite');
  assert.equal(buildBuildingPath(mockBuildings[1]), '/buildings/38-park-avenue');
  assert.equal(buildNeighborhoodPath(mockNeighborhoods[0]), '/neighborhoods/cebu-business-park');
});

test('findApprovedPropertyBySlug finds approved by slug/title/id and blocks unapproved listings', () => {
  assert.equal(findApprovedPropertyBySlug(mockProperties, 'the-alcoves-18b')?.propertyId, 'prop-1');
  assert.equal(
    findApprovedPropertyBySlug(mockProperties, '38-park-avenue-corner-suite')?.propertyId,
    'prop-3-legacy'
  );
  assert.equal(findApprovedPropertyBySlug(mockProperties, 'prop-1')?.propertyId, 'prop-1');
  // Unapproved pending property MUST NOT resolve publicly
  assert.equal(findApprovedPropertyBySlug(mockProperties, 'the-alcoves-penthouse-pending'), null);
  assert.equal(findApprovedPropertyBySlug(mockProperties, 'missing-slug'), null);
});

test('getApprovedPropertiesForBuilding strictly associates via buildingId and approved status', () => {
  const alcovesUnits = getApprovedPropertiesForBuilding(mockProperties, 'bld-the-alcoves');
  assert.equal(alcovesUnits.length, 1);
  assert.equal(alcovesUnits[0].propertyId, 'prop-1');
  assert.equal(getApprovedPropertiesForBuilding(mockProperties, 'unknown-id').length, 0);
});

test('findBuildingBySlug and findNeighborhoodBySlug resolve stored and fallback slugs', () => {
  assert.equal(findBuildingBySlug(mockBuildings, 'the-alcoves')?.buildingId, 'bld-the-alcoves');
  assert.equal(findBuildingBySlug(mockBuildings, '38-park-avenue')?.buildingId, 'bld-38-park');
  assert.equal(findBuildingBySlug(mockBuildings, 'nope'), null);

  assert.equal(findNeighborhoodBySlug(mockNeighborhoods, 'cebu-business-park')?.id, 'loc-cbp');
  assert.equal(findNeighborhoodBySlug(mockNeighborhoods, 'it-park')?.id, 'loc-it-park');
  assert.equal(findNeighborhoodBySlug(mockNeighborhoods, 'nowhere'), null);
});

test('neighborhood matchers normalize Cebu IT Park vs IT Park and filter approved only', () => {
  const itParkProps = getApprovedPropertiesForNeighborhood(mockProperties, 'IT Park');
  assert.equal(itParkProps.length, 1);
  assert.equal(itParkProps[0].propertyId, 'prop-3-legacy');

  const cbpProps = getApprovedPropertiesForNeighborhood(mockProperties, 'Cebu Business Park');
  assert.equal(cbpProps.length, 1); // excludes prop-2-pending

  const itBuildings = getBuildingsForNeighborhood(mockBuildings, 'IT Park');
  assert.equal(itBuildings.length, 1);
  assert.equal(itBuildings[0].buildingId, 'bld-38-park');
});

test('resolveMapLocations handles coordinates, safe URLs, and rejects unsafe schemes', () => {
  const withCoords = resolveMapLocations({ latitude: 10.3181, longitude: 123.9056 });
  assert.ok(withCoords.embedUrl?.includes('10.3181'));
  assert.ok(withCoords.externalUrl?.includes('10.3181'));

  const unsafe = resolveMapLocations({ mapUrl: 'javascript:alert(1)' });
  assert.equal(unsafe.embedUrl, null);
  assert.equal(unsafe.externalUrl, null);

  const byAddress = resolveMapLocations({ address: 'Luzon Ave, Cebu City' });
  assert.ok(byAddress.embedUrl?.includes('output=embed'));
  assert.ok(byAddress.externalUrl?.startsWith('https://www.google.com/maps/'));
});
