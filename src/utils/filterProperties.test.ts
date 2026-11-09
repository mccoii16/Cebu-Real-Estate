import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPHP,
  filterProperties,
  validateInquiryForm,
  canAgentEditProperty,
  applyApprovalDecision,
  calculateAgentMetrics,
} from './filterProperties';
import { PropertyDoc } from '../types/property';

const sampleProperties: PropertyDoc[] = [
  {
    propertyId: 'prop-1',
    buildingId: 'bld-the-alcoves',
    buildingName: 'The Alcoves',
    propertyTitle: 'The Alcoves Unit 18B',
    location: 'Cebu Business Park',
    address: 'Ayala Center Cebu, Cebu City',
    price: 8500000,
    propertyType: 'Condo',
    listingType: 'sale',
    bedrooms: 1,
    bathrooms: 1,
    floorArea: 36,
    images: ['/assets/extracted/the_alcoves.png'],
    description: 'High-end residential tower directly connected to Ayala Center Cebu.',
    amenities: ['Direct Mall Access', 'Lap Pool', 'Fitness Gym'],
    featured: true,
    status: 'approved',
    agentId: 'agent-1',
    agentName: 'Maria Santos',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    propertyId: 'prop-2',
    buildingId: 'bld-38-park',
    buildingName: '38 Park Avenue',
    propertyTitle: '38 Park Avenue Suite 24A',
    location: 'Cebu IT Park',
    address: 'Cebu IT Park, Apas, Cebu City',
    price: 11000000,
    propertyType: 'Condo',
    listingType: 'sale',
    bedrooms: 1,
    bathrooms: 1,
    floorArea: 45,
    images: ['/assets/extracted/park_avenue.png'],
    description: 'New York-inspired skyscraper living.',
    amenities: ['Sky Gardens', 'Swimming Pool'],
    featured: true,
    status: 'approved',
    agentId: 'agent-1',
    agentName: 'Maria Santos',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    propertyId: 'prop-3',
    buildingId: 'bld-mactan-newtown',
    buildingName: 'Mactan Newtown Residences',
    propertyTitle: 'Mactan Newtown 2BR Suite',
    location: 'Mactan Newtown',
    address: 'Mactan Newtown Blvd, Lapu-Lapu City',
    price: 35000,
    propertyType: 'Condo',
    listingType: 'rent',
    bedrooms: 2,
    bathrooms: 2,
    floorArea: 78,
    images: ['/assets/extracted/mactan_residences.png'],
    description: 'Resort lifestyle condominium community.',
    amenities: ['Beach Access'],
    featured: true,
    status: 'approved',
    agentId: 'agent-2',
    agentName: 'Carlos Tan',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    propertyId: 'prop-4-draft',
    buildingId: 'bld-the-alcoves',
    buildingName: 'The Alcoves',
    propertyTitle: 'The Alcoves Unapproved Draft',
    location: 'Cebu Business Park',
    address: 'Ayala Center Cebu',
    price: 9000000,
    propertyType: 'Condo',
    listingType: 'sale',
    bedrooms: 1,
    bathrooms: 1,
    floorArea: 38,
    images: ['/assets/extracted/the_alcoves.png'],
    description: 'Draft unit that should not be visible publicly.',
    amenities: [],
    featured: false,
    status: 'draft',
    agentId: 'agent-1',
    agentName: 'Maria Santos',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

test('formatPHP formats amounts properly', () => {
  assert.equal(formatPHP(8500000), '₱8,500,000');
  assert.equal(formatPHP(35000, true), '₱35,000 /mo');
});

test('filterProperties strictly excludes non-approved properties', () => {
  const results = filterProperties(sampleProperties, {});
  assert.equal(results.length, 3);
  assert.ok(results.every((p) => p.status === 'approved'));
  assert.ok(!results.some((p) => p.propertyId === 'prop-4-draft'));
});

test('filterProperties filters by listing type and bedrooms', () => {
  const rentals = filterProperties(sampleProperties, { listingType: 'rent' });
  assert.equal(rentals.length, 1);
  assert.equal(rentals[0].propertyTitle, 'Mactan Newtown 2BR Suite');

  const twoBed = filterProperties(sampleProperties, { bedrooms: 2 });
  assert.equal(twoBed.length, 1);
  assert.equal(twoBed[0].bedrooms, 2);
});

test('filterProperties filters by price bounds', () => {
  const affordable = filterProperties(sampleProperties, { maxPrice: 100000 });
  assert.equal(affordable.length, 1);
  assert.equal(affordable[0].price, 35000);

  const luxury = filterProperties(sampleProperties, { minPrice: 10000000 });
  assert.equal(luxury.length, 1);
  assert.equal(luxury[0].propertyTitle, '38 Park Avenue Suite 24A');
});

test('validateInquiryForm validates user details', () => {
  const invalid = validateInquiryForm({ fullName: 'A', email: 'notanemail', phone: '12' });
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.fullName);
  assert.ok(invalid.errors.email);

  const valid = validateInquiryForm({
    fullName: 'Maria Santos',
    email: 'maria@example.com',
    phone: '+63 917 123 4567',
  });
  assert.equal(valid.isValid, true);
});

test('canAgentEditProperty validates agent ownership and editable states', () => {
  const myDraft = sampleProperties.find((p) => p.propertyId === 'prop-4-draft')!;
  assert.equal(canAgentEditProperty('agent-1', myDraft), true);
  assert.equal(canAgentEditProperty('agent-other', myDraft), false);
});

test('applyApprovalDecision sets approved or rejected with reasons and timestamps', () => {
  const pendingProp: PropertyDoc = {
    ...sampleProperties[0],
    status: 'pending',
  };

  const approved = applyApprovalDecision(pendingProp, 'admin-super', true);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.approvedBy, 'admin-super');
  assert.ok(approved.approvedAt);

  const rejected = applyApprovalDecision(pendingProp, 'admin-super', false, 'Need clearer photos');
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.rejectionReason, 'Need clearer photos');
});

test('calculateAgentMetrics computes accurate totals across statuses', () => {
  const metrics = calculateAgentMetrics(sampleProperties);
  assert.equal(metrics.total, 4);
  assert.equal(metrics.approvedCount, 3);
  assert.equal(metrics.draftCount, 1);
  assert.equal(metrics.pendingCount, 0);
  assert.equal(metrics.rejectedCount, 0);
});
