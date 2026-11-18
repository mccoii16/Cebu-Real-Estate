import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bath,
  Bed,
  Building2,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  Maximize,
  Maximize2,
  TrainFront,
  Users,
} from 'lucide-react';
import {
  BuildingDoc,
  LocationHighlight,
  PropertyDoc,
  WebsiteSettings,
} from '../../types/property';
import { formatPHP } from '../../utils/filterProperties';
import {
  buildBuildingPath,
  buildNeighborhoodPath,
  buildPropertyPath,
  getApprovedPropertiesForNeighborhood,
  getBuildingsForNeighborhood,
  resolveMapLocations,
} from '../../utils/slugs';
import { applySeoMetadata, getOrigin } from '../../utils/seo';
import {
  isBuildingPubliclyVisible,
  isNeighborhoodPubliclyVisible,
} from '../../utils/contentManagement';
import { Breadcrumbs, BreadcrumbItem } from './Breadcrumbs';
import { FullscreenLightbox } from './FullscreenLightbox';

interface NeighborhoodDetailPageProps {
  neighborhood: LocationHighlight;
  allProperties: PropertyDoc[];
  allBuildings: BuildingDoc[];
  allNeighborhoods: LocationHighlight[];
  siteSettings?: WebsiteSettings;
  onNavigate: (path: string) => void;
  onOpenInquiryModal: (subject: string) => void;
}

export const NeighborhoodDetailPage: React.FC<NeighborhoodDetailPageProps> = ({
  neighborhood,
  allProperties,
  allBuildings,
  allNeighborhoods,
  siteSettings,
  onNavigate,
  onOpenInquiryModal,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsFullscreen(false);
  }, [neighborhood.id]);

  // Combine cover image and any saved galleryImages (deduped)
  const images = useMemo(() => {
    const cover = neighborhood.image || '/assets/extracted/hero_skyline_clean.png';
    const extra = (neighborhood.galleryImages || []).filter((url) => url && url.trim());
    return Array.from(new Set([cover, ...extra]));
  }, [neighborhood.image, neighborhood.galleryImages]);

  const currentImage = images[activeImageIndex] || images[0];

  const areaBuildings = useMemo(
    () =>
      getBuildingsForNeighborhood(
        allBuildings.filter(isBuildingPubliclyVisible),
        neighborhood.name
      ),
    [allBuildings, neighborhood.name]
  );

  const areaProperties = useMemo(
    () => getApprovedPropertiesForNeighborhood(allProperties, neighborhood.name),
    [allProperties, neighborhood.name]
  );

  const relatedNeighborhoods = useMemo(
    () =>
      allNeighborhoods
        .filter((n) => n.id !== neighborhood.id && isNeighborhoodPubliclyVisible(n))
        .slice(0, 4),
    [allNeighborhoods, neighborhood.id]
  );

  // Strictly only show map when explicit saved mapUrl or coordinates exist in Firestore
  const hasSavedMapData = Boolean(
    neighborhood.mapUrl?.trim() ||
      (typeof neighborhood.latitude === 'number' &&
        !Number.isNaN(neighborhood.latitude) &&
        typeof neighborhood.longitude === 'number' &&
        !Number.isNaN(neighborhood.longitude))
  );

  const mapLinks = useMemo(() => {
    if (!hasSavedMapData) return { embedUrl: null, externalUrl: null };
    return resolveMapLocations({
      mapUrl: neighborhood.mapUrl,
      latitude: neighborhood.latitude,
      longitude: neighborhood.longitude,
      queryLabel: neighborhood.cityOrMunicipality
        ? `${neighborhood.name}, ${neighborhood.cityOrMunicipality}`
        : `${neighborhood.name}, Cebu`,
    });
  }, [hasSavedMapData, neighborhood]);

  // Dynamic SEO & Schema.org Place JSON-LD
  useEffect(() => {
    const origin = getOrigin();
    const canonicalPath = buildNeighborhoodPath(neighborhood);
    applySeoMetadata({
      title:
        neighborhood.seoTitle?.trim() ||
        `${neighborhood.name} | Neighborhood & Areas | Cebu Prime Properties`,
      description:
        neighborhood.seoDescription?.trim() ||
        neighborhood.description ||
        `${neighborhood.name} — ${neighborhood.tagline}`,
      canonicalPath,
      ogType: 'website',
      ogImage: images[0],
      siteName: siteSettings?.siteName || 'Cebu Prime Properties',
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Place',
            name: neighborhood.name,
            description: neighborhood.description,
            url: `${origin}${canonicalPath}`,
            image: images,
            ...(neighborhood.cityOrMunicipality
              ? {
                  address: {
                    '@type': 'PostalAddress',
                    addressLocality: neighborhood.cityOrMunicipality,
                    addressRegion: 'Cebu',
                    addressCountry: 'PH',
                  },
                }
              : {}),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
              {
                '@type': 'ListItem',
                position: 2,
                name: neighborhood.name,
                item: `${origin}${canonicalPath}`,
              },
            ],
          },
        ],
      },
    });
  }, [neighborhood, images, siteSettings?.siteName]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Neighborhood & Areas' },
    { label: neighborhood.name },
  ];

  const hasHighlights = Boolean(neighborhood.highlights && neighborhood.highlights.length > 0);
  const hasLandmarks = Boolean(
    neighborhood.nearbyLandmarks && neighborhood.nearbyLandmarks.length > 0
  );
  const hasLifestyle = Boolean(neighborhood.lifestyleInfo?.trim());
  const hasTransport = Boolean(neighborhood.transportationInfo?.trim());
  const hasDistrictGuideDetails = hasLifestyle || hasTransport || hasLandmarks || hasSavedMapData;

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="flex-1 w-full bg-[#F8F7F3] pb-16 sm:pb-20">
      {/* Full-Bleed District Panorama Hero (Distinct from Property Boxed Gallery & Building Split Hero) */}
      <section className="relative w-full min-h-[420px] sm:min-h-[480px] lg:min-h-[540px] bg-[#17243B] overflow-hidden flex flex-col justify-between">
        <img
          key={currentImage}
          src={currentImage}
          alt={neighborhood.name}
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.dataset.fallback) {
              target.dataset.fallback = 'true';
              target.src = '/assets/extracted/hero_skyline_clean.png';
            }
          }}
          className="absolute inset-0 w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
        />

        {/* Measured multi-stop scrim for crisp WCAG AA legibility across all photo luminances */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#17243B] via-[#17243B]/60 to-[#17243B]/55 pointer-events-none" />

        {/* Top Bar inside Panorama: Breadcrumbs + Gallery Controls */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-5 sm:pt-7 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Breadcrumbs items={breadcrumbItems} onNavigate={onNavigate} lightText />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {images.length > 1 && (
              <div className="inline-flex items-center gap-1 bg-black/55 backdrop-blur-sm border border-white/15 rounded-lg p-1 text-white">
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((p) => (p === 0 ? images.length - 1 : p - 1))}
                  aria-label="Previous neighborhood photo"
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/15 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs font-mono tabular-nums inline-flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-[#C6A878]" />
                  {activeImageIndex + 1} / {images.length}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((p) => (p === images.length - 1 ? 0 : p + 1))}
                  aria-label="Next neighborhood photo"
                  className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/15 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              aria-label="Open neighborhood photo fullscreen"
              className="px-3.5 min-h-[38px] rounded-lg bg-black/55 hover:bg-black/80 backdrop-blur-sm border border-white/15 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Maximize className="w-3.5 h-3.5 text-[#C6A878] flex-shrink-0" />
              <span>Fullscreen</span>
            </button>
          </div>
        </div>

        {/* Bottom Editorial District Masthead */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pb-8 sm:pb-12 pt-14 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-[#C6A878]">
              <span className="whitespace-nowrap">District Guide</span>
              <span className="inline-flex items-center gap-1.5 text-white/90 whitespace-nowrap">
                <span aria-hidden="true" className="text-white/35">
                  ·
                </span>
                <MapPin className="w-3 h-3 text-[#C6A878] flex-shrink-0" />
                <span>{neighborhood.cityOrMunicipality?.trim() || 'Metro Cebu'}</span>
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white font-serif tracking-tight [text-wrap:balance]">
              {neighborhood.name}
            </h1>

            {neighborhood.tagline?.trim() && (
              <p className="text-base sm:text-xl text-[#DFCDAA] font-light leading-snug">
                {neighborhood.tagline}
              </p>
            )}

            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  areaProperties.length > 0
                    ? scrollToSection('district-residences')
                    : onOpenInquiryModal(`${neighborhood.name} Real Estate`)
                }
                className="px-5 min-h-[44px] rounded-lg bg-[#C6A878] hover:bg-[#b59665] text-[#17243B] text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <span>
                  {areaProperties.length > 0
                    ? `Browse Residences (${areaProperties.length})`
                    : 'Request District Options'}
                </span>
                <ArrowRight className="w-4 h-4 flex-shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => onOpenInquiryModal(`${neighborhood.name} Real Estate`)}
                className="px-4 min-h-[44px] rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/25 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <span>District Consultation</span>
              </button>
            </div>
          </div>

          {/* Compact Panorama Gallery Thumbnail Strip */}
          {images.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 flex-shrink-0">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={`Select district photo ${idx + 1}`}
                  className={`relative w-16 h-11 sm:w-20 sm:h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                    activeImageIndex === idx
                      ? 'border-[#C6A878] opacity-100'
                      : 'border-white/25 opacity-65 hover:opacity-100'
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* District Vital Ribbon */}
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 py-4 sm:py-5 lg:py-0 lg:gap-0 lg:divide-x lg:divide-slate-200">
          <div className="lg:py-5 lg:pr-6 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 block whitespace-nowrap truncate">
              City / Area
            </span>
            <span className="text-sm sm:text-base font-bold text-[#17243B] mt-0.5 block truncate">
              {neighborhood.cityOrMunicipality?.trim() || 'Metro Cebu'}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              areaBuildings.length > 0
                ? scrollToSection('district-buildings')
                : scrollToSection('district-residences')
            }
            className="lg:py-5 lg:px-6 text-left hover:bg-[#F8F7F3] transition-colors min-w-0 rounded-lg lg:rounded-none"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 block whitespace-nowrap truncate">
              Developments
            </span>
            <span className="text-sm sm:text-base font-bold text-[#17243B] tabular-nums mt-0.5 block truncate">
              {areaBuildings.length} {areaBuildings.length === 1 ? 'Building' : 'Buildings'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('district-residences')}
            className="lg:py-5 lg:px-6 text-left hover:bg-[#F8F7F3] transition-colors min-w-0 rounded-lg lg:rounded-none"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 block whitespace-nowrap truncate">
              Active Listings
            </span>
            <span className="text-sm sm:text-base font-bold text-[#17243B] tabular-nums mt-0.5 block truncate">
              {areaProperties.length} {areaProperties.length === 1 ? 'Property' : 'Properties'}
            </span>
          </button>

          <div className="lg:py-5 lg:pl-6 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 block whitespace-nowrap truncate">
              District Focus
            </span>
            <span className="text-sm sm:text-base font-bold text-[#9A7B48] mt-0.5 block truncate">
              {neighborhood.tagline?.trim() || 'Prime Cebu District'}
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-10 sm:pt-12 space-y-14">
        {/* Editorial District Essay + Numbered Highlights Index */}
        {(neighborhood.description?.trim() || hasHighlights) && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div
              className={`${
                hasHighlights ? 'lg:col-span-7' : 'lg:col-span-12'
              } space-y-4 min-w-0`}
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A7B48]">
                Editorial Introduction
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#17243B] font-serif [text-wrap:balance]">
                Living &amp; Investing in {neighborhood.name}
              </h2>
              {neighborhood.description?.trim() && (
                <p className="text-base sm:text-lg text-slate-700 leading-relaxed whitespace-pre-line max-w-prose">
                  {neighborhood.description}
                </p>
              )}
            </div>

            {hasHighlights && (
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-4 min-w-0">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9A7B48] block">
                    District Advantages
                  </span>
                  <h3 className="text-lg font-bold text-[#17243B] font-serif mt-0.5">
                    Why {neighborhood.name}
                  </h3>
                </div>
                <ol className="divide-y divide-slate-100">
                  {neighborhood.highlights!.map((hl, idx) => (
                    <li key={idx} className="py-3 first:pt-1 last:pb-0 flex items-baseline gap-3.5">
                      <span className="text-xs font-mono font-bold text-[#C6A878] tabular-nums flex-shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm text-slate-700 leading-relaxed">{hl}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}

        {/* Lifestyle, Connectivity, Landmarks & District Map */}
        {hasDistrictGuideDetails && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 lg:p-10 space-y-8">
            <div className="border-b border-slate-200 pb-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A7B48] block">
                Urban Profile
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif mt-0.5">
                Lifestyle, Connectivity &amp; Landmarks
              </h2>
            </div>

            <div
              className={`grid grid-cols-1 ${
                hasSavedMapData ? 'lg:grid-cols-12' : 'lg:grid-cols-1'
              } gap-8 items-start`}
            >
              <div
                className={`${
                  hasSavedMapData ? 'lg:col-span-7' : ''
                } grid grid-cols-1 md:grid-cols-2 gap-8 min-w-0`}
              >
                {hasLifestyle && (
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#17243B] flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#C6A878]" />
                      <span>Lifestyle &amp; Community</span>
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                      {neighborhood.lifestyleInfo}
                    </p>
                  </div>
                )}

                {hasTransport && (
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#17243B] flex items-center gap-2">
                      <TrainFront className="w-4 h-4 text-[#C6A878]" />
                      <span>Transportation &amp; Access</span>
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                      {neighborhood.transportationInfo}
                    </p>
                  </div>
                )}

                {hasLandmarks && (
                  <div className="md:col-span-2 space-y-3 pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#17243B] flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#C6A878]" />
                      <span>Key District Landmarks</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                      {neighborhood.nearbyLandmarks!.map((lm, idx) => (
                        <div
                          key={idx}
                          className="py-1.5 border-b border-slate-100 text-sm text-slate-700 flex items-center gap-2"
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#C6A878] flex-shrink-0" />
                          <span>{lm}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {hasSavedMapData && (
                <div className="lg:col-span-5 space-y-3 min-w-0">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#17243B]">
                    District Map Location
                  </h3>
                  {mapLinks.embedUrl && (
                    <div className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                      <iframe
                        title={`Map of ${neighborhood.name}`}
                        src={mapLinks.embedUrl}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="w-full h-full border-0"
                      />
                    </div>
                  )}
                  {mapLinks.externalUrl && (
                    <a
                      href={mapLinks.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full min-h-[42px] px-4 rounded-lg border border-slate-300 hover:bg-slate-50 text-[#17243B] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <span>View in Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#C6A878]" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Featured Buildings & Towers in this Neighborhood (Horizontal Architectural Split Cards) */}
        {areaBuildings.length > 0 && (
          <section id="district-buildings" className="space-y-6 scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A7B48]">
                  Architectural Directory
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif mt-0.5">
                  Notable Buildings in {neighborhood.name} ({areaBuildings.length})
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {areaBuildings.map((bld) => {
                const path = buildBuildingPath(bld);
                return (
                  <a
                    key={bld.buildingId}
                    href={path}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(path);
                    }}
                    className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-[#C6A878] transition-colors flex flex-col sm:flex-row items-stretch"
                  >
                    <div className="w-full sm:w-52 md:w-56 aspect-[16/10] sm:aspect-auto bg-slate-900 overflow-hidden flex-shrink-0">
                      <img
                        src={bld.buildingImages?.[0] || '/assets/extracted/the_alcoves.png'}
                        alt={bld.buildingName}
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.fallback) {
                            target.dataset.fallback = 'true';
                            target.src = '/assets/extracted/the_alcoves.png';
                          }
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between gap-3 min-w-0">
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9A7B48] truncate">
                          {bld.buildingType || 'Residential Development'}
                          {bld.totalFloors ? ` · ${bld.totalFloors} Floors` : ''}
                        </div>
                        <h3 className="text-lg font-bold text-[#17243B] group-hover:text-[#9A7B48] transition-colors font-serif">
                          {bld.buildingName}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                          {bld.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500 truncate inline-flex items-center gap-1 min-w-0">
                          {bld.address && (
                            <>
                              <MapPin className="w-3 h-3 text-[#C6A878] flex-shrink-0" />
                              <span className="truncate">{bld.address}</span>
                            </>
                          )}
                        </span>
                        <span className="text-[#17243B] font-semibold inline-flex items-center gap-1 whitespace-nowrap flex-shrink-0 group-hover:text-[#9A7B48]">
                          <span>View Building</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Approved Properties in this District */}
        <section id="district-residences" className="space-y-6 scroll-mt-24">
          <div className="border-b border-slate-200 pb-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A7B48]">
              Available Residences
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif mt-0.5">
              Properties for Sale &amp; Lease in {neighborhood.name} ({areaProperties.length})
            </h2>
          </div>

          {areaProperties.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 text-center space-y-3">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-[#17243B]">
                No Public Listings Currently Active in {neighborhood.name}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Contact our advisory team for private, off-market residences in {neighborhood.name}.
              </p>
              <button
                type="button"
                onClick={() => onOpenInquiryModal(`${neighborhood.name} Residences`)}
                className="px-5 min-h-[44px] rounded-lg bg-[#17243B] hover:bg-[#203150] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <span>Inquire for Off-Market Options</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C6A878]" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {areaProperties.map((prop) => {
                const path = buildPropertyPath(prop);
                const img = prop.images?.[0] || '/assets/extracted/the_alcoves.png';
                return (
                  <a
                    key={prop.propertyId}
                    href={path}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(path);
                    }}
                    className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-[#C6A878] transition-colors flex flex-col"
                  >
                    <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                      <img
                        src={img}
                        alt={prop.propertyTitle}
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.fallback) {
                            target.dataset.fallback = 'true';
                            target.src = '/assets/extracted/the_alcoves.png';
                          }
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <span className="absolute bottom-3 right-3 text-sm font-bold text-white font-mono tabular-nums whitespace-nowrap">
                        {formatPHP(prop.price, prop.listingType === 'rent')}
                      </span>
                    </div>

                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-2.5">
                      <div>
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#9A7B48]">
                          <span>{prop.listingType === 'sale' ? 'For Sale' : 'For Rent'}</span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="truncate text-slate-500">
                            {prop.buildingName || prop.propertyType}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-[#17243B] group-hover:text-[#9A7B48] transition-colors line-clamp-1 mt-1">
                          {prop.propertyTitle}
                        </h3>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium tabular-nums">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Bed className="w-3.5 h-3.5 text-slate-400" />
                          {prop.bedrooms} Bed
                        </span>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Bath className="w-3.5 h-3.5 text-slate-400" />
                          {prop.bathrooms} Bath
                        </span>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Maximize2 className="w-3 h-3 text-slate-400" />
                          {prop.floorArea} sqm
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* Explore Other Cebu Districts */}
        {relatedNeighborhoods.length > 0 && (
          <section className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A7B48]">
                Continue Exploring Cebu
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif mt-0.5">
                Other Neighborhood &amp; Areas
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedNeighborhoods.map((rel) => {
                const path = buildNeighborhoodPath(rel);
                return (
                  <a
                    key={rel.id}
                    href={path}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(path);
                    }}
                    className="group relative rounded-2xl overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-900"
                  >
                    <img
                      src={rel.image || '/assets/extracted/photo_the_alcoves.png'}
                      alt={rel.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#17243B]/90 via-[#17243B]/25 to-transparent flex items-end p-4">
                      <div className="w-full flex items-center justify-between gap-2 text-white">
                        <div className="min-w-0">
                          <div className="text-sm font-bold font-serif truncate">{rel.name}</div>
                          {rel.tagline && (
                            <div className="text-[11px] text-[#DFCDAA] truncate">{rel.tagline}</div>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#C6A878] flex-shrink-0 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <FullscreenLightbox
        isOpen={isFullscreen}
        images={images}
        activeIndex={activeImageIndex}
        title={neighborhood.name}
        onClose={() => setIsFullscreen(false)}
        onSelectIndex={setActiveImageIndex}
      />
    </main>
  );
};
