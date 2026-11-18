import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HERO_FALLBACK_IMAGE,
  parseSavedFavorites,
  resolveHeroSlides,
  stripUndefinedDeep,
  syncWebsiteSettingsPayload,
} from './heroSettings';
import { HeroSlideConfig, WebsiteSettings } from '../types/property';

const SAMPLE_DEFAULTS: HeroSlideConfig[] = [
  {
    id: 1,
    label: '01',
    location: 'Cebu City',
    image: '/assets/extracted/hero_skyline_clean.png',
    headlineLine1: 'Find Your Perfect',
    headlineLine2: 'Property in Cebu',
    subheading: 'Modern living.',
  },
  {
    id: 2,
    label: '02',
    location: 'Cebu IT Park',
    image: '/assets/extracted/photo_park_avenue.png',
    headlineLine1: 'Elevated',
    headlineLine2: 'Living',
    subheading: 'Prime towers.',
  },
];

test('parseSavedFavorites returns empty array for first-time visitors and invalid inputs', () => {
  assert.deepEqual(parseSavedFavorites(null), []);
  assert.deepEqual(parseSavedFavorites(undefined), []);
  assert.deepEqual(parseSavedFavorites(''), []);
  assert.deepEqual(parseSavedFavorites('not-json'), []);
  assert.deepEqual(parseSavedFavorites('{"a":1}'), []);
  assert.deepEqual(parseSavedFavorites('["prop-1", "", 123, "prop-1", " prop-2 "]'), [
    'prop-1',
    'prop-2',
  ]);
});

test('resolveHeroSlides honors custom updated heroSlides image URLs over defaults', () => {
  const customUrl = 'https://firebasestorage.googleapis.com/v0/b/cebu/o/site_assets%2Fhero.jpg?alt=media';
  const slides = resolveHeroSlides(
    {
      heroSlides: [
        {
          id: 1,
          label: '01',
          location: 'Cebu Skyline',
          image: `  ${customUrl}  `,
          headlineLine1: 'Custom Title',
          headlineLine2: 'Line 2',
          subheading: 'Custom subtitle',
        },
      ],
      heroImages: ['/assets/extracted/hero_skyline_clean.png'],
    },
    SAMPLE_DEFAULTS
  );

  assert.equal(slides.length, 1);
  assert.equal(slides[0].image, customUrl);
  assert.equal(slides[0].headlineLine1, 'Custom Title');
});

test('resolveHeroSlides falls back to heroImages or default only when slide image is blank', () => {
  const slides = resolveHeroSlides(
    {
      heroSlides: [
        {
          id: 1,
          label: '01',
          location: 'Cebu',
          image: '   ',
          headlineLine1: 'H1',
          headlineLine2: 'H2',
          subheading: 'Sub',
        },
      ],
      heroImages: ['https://example.com/legacy-hero.jpg'],
    },
    SAMPLE_DEFAULTS
  );
  assert.equal(slides[0].image, 'https://example.com/legacy-hero.jpg');

  const fallbackSlides = resolveHeroSlides(
    {
      heroSlides: [
        {
          id: 1,
          label: '01',
          location: 'Cebu',
          image: '',
          headlineLine1: 'H1',
          headlineLine2: 'H2',
          subheading: 'Sub',
        },
      ],
    },
    SAMPLE_DEFAULTS
  );
  assert.equal(fallbackSlides[0].image, DEFAULT_HERO_FALLBACK_IMAGE);
});

test('syncWebsiteSettingsPayload aligns heroImages with heroSlides and removes undefined fields', () => {
  const baseSettings: WebsiteSettings = {
    siteName: 'CEBU PRIME',
    logoSubtitle: 'PROPERTIES',
    heroHeadline: 'Headline',
    heroSubheading: 'Sub',
    heroBadge: 'BADGE',
    contactEmail: 'a@b.com',
    contactPhone: '123',
    officeAddress: 'Cebu',
    linkedinUrl: undefined,
    heroImages: ['/assets/extracted/hero_skyline_clean.png'],
    heroSlides: [
      {
        id: 1,
        label: '01',
        location: 'Cebu',
        image: 'https://cdn.example.com/new-hero-1.webp',
        headlineLine1: 'New Hero',
        headlineLine2: 'Slide',
        subheading: 'Updated copy',
      },
      {
        id: 2,
        label: '02',
        location: 'Mactan',
        image: 'https://cdn.example.com/new-hero-2.webp',
        headlineLine1: 'Coastal',
        headlineLine2: 'Living',
        subheading: 'Updated slide 2',
      },
    ],
  };

  const synced = syncWebsiteSettingsPayload(baseSettings, SAMPLE_DEFAULTS);
  assert.equal('linkedinUrl' in synced, false);
  assert.deepEqual(synced.heroImages, [
    'https://cdn.example.com/new-hero-1.webp',
    'https://cdn.example.com/new-hero-2.webp',
  ]);
  assert.deepEqual(stripUndefinedDeep({ a: 1, b: undefined, nested: { c: undefined, d: null } }), {
    a: 1,
    nested: { d: null },
  });
});
