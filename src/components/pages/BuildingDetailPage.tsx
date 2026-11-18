import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bath,
  Bed,
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  MapPin,
  Maximize,
  Maximize2,
  ShieldCheck,
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
  getApprovedPropertiesForBuilding,
  matchesNeighborhoodName,
  resolveMapLocations,
} from '../../utils/slugs';
import { applySeoMetadata, getOrigin } from '../../utils/seo';
import {
  isBuildingPubliclyVisible,
  isNeighborhoodPubliclyVisible,
} from '../../utils/contentManagement';
import { Breadcrumbs, BreadcrumbItem } from './Breadcrumbs';
import { FullscreenLightbox } from './FullscreenLightbox';

interface BuildingDetailPageProps {
  building: BuildingDoc;
  allProperties: PropertyDoc[];
  allBuildings: BuildingDoc[];
  neighborhoods: LocationHighlight[];
  siteSettings?: WebsiteSettings;
  onNavigate: (path: string) => void;
  onOpenInquiryModal: (subject: string) => void;
}

export const BuildingDetailPage: React.FC<BuildingDetailPageProps> = ({
  building,
  allProperties,
  allBuildings,
  neighborhoods,
  siteSettings,
  onNavigate,
  onOpenInquiryModal,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsFullscreen(false);
  }, [building.buildingId]);

  const images = useMemo(
    () =>
      building.buildingImages && building.buildingImages.length > 0
        ? building.buildingImages
        : ['/assets/extracted/the_alcoves.png'],
    [building.buildingImages]
  );

  const currentImage = images[activeImageIndex] || images[0];

  const linkedNeighborhood = useMemo(
    () =>
      neighborhoods.find(
        (n) => isNeighborhoodPubliclyVisible(n) && matchesNeighborhoodName(n.name, building.location)
      ) || null,
    [neighborhoods, building.location]
  );

  // Strictly associate approved properties using building.buildingId
  const buildingProperties = useMemo(
    () => getApprovedPropertiesForBuilding(allProperties, building.buildingId),
    [allProperties, building.buildingId]
  );

  const relatedBuildings = useMemo(() => {
    const others = allBuildings.filter(
      (b) => b.buildingId !== building.buildingId && isBuildingPubliclyVisible(b)
    );
    const sameArea = others.filter((b) => matchesNeighborhoodName(b.location, building.location));
    const rest = others.filter((b) => !matchesNeighborhoodName(b.location, building.location));
    return [...sameArea, ...rest].slice(0, 3);
  }, [allBuildings, building.buildingId, building.location]);

  const mapLinks = useMemo(
    () =>
      resolveMapLocations({
        mapUrl: building.mapUrl,
        latitude: building.latitude,
        longitude: building.longitude,
        address: building.address,
        queryLabel: `${building.buildingName}, ${building.location}, Cebu`,
      }),
    [building]
  );

  // SEO & Schema.org ApartmentComplex / Residence JSON-LD
  useEffect(() => {
    const origin = getOrigin();
    const canonicalPath = buildBuildingPath(building);
    const breadcrumbList = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
      ...(linkedNeighborhood
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: linkedNeighborhood.name,
              item: `${origin}${buildNeighborhoodPath(linkedNeighborhood)}`,
            },
          ]
        : []),
      {
        '@type': 'ListItem',
        position: linkedNeighborhood ? 3 : 2,
        name: building.buildingName,
        item: `${origin}${canonicalPath}`,
      },
    ];

    applySeoMetadata({
      title:
        building.seoTitle?.trim() ||
        `${building.buildingName} | ${building.location} | Cebu Prime Properties`,
      description:
        building.seoDescription?.trim() ||
        `${building.buildingName} in ${building.location}. ${building.description}`,
      canonicalPath,
      ogType: 'website',
      ogImage: images[0],
      siteName: siteSettings?.siteName || 'Cebu Prime Properties',
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'ApartmentComplex',
            name: building.buildingName,
            description: building.description,
            url: `${origin}${canonicalPath}`,
            image: images,
            ...(building.totalFloors ? { numberOfFloors: building.totalFloors } : {}),
            address: {
              '@type': 'PostalAddress',
              streetAddress: building.address,
              addressLocality: building.location,
              addressRegion: 'Cebu',
              addressCountry: 'PH',
            },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbList,
          },
        ],
      },
    });
  }, [building, linkedNeighborhood, images, siteSettings?.siteName]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    ...(linkedNeighborhood
      ? [
          {
            label: linkedNeighborhood.name,
            href: buildNeighborhoodPath(linkedNeighborhood),
          },
        ]
      : [{ label: building.location }]),
    { label: building.buildingName },
  ];

  // Architectural specification ribbon (applicable fields + location + unit inventory count)
  const buildingSpecs = [
    {
      icon: MapPin,
      label: 'District',
      value: linkedNeighborhood?.name || building.location,
    },
    ...(building.developer?.trim()
      ? [{ icon: ShieldCheck, label: 'Developer', value: building.developer.trim() }]
      : []),
    ...(building.buildingType?.trim()
      ? [{ icon: Building2, label: 'Classification', value: building.buildingType.trim() }]
      : []),
    ...(typeof building.yearCompleted === 'number' && building.yearCompleted > 0
      ? [{ icon: Calendar, label: 'Completed', value: String(building.yearCompleted) }]
      : []),
    ...(typeof building.totalFloors === 'number' && building.totalFloors > 0
      ? [{ icon: Layers, label: 'Elevation', value: `${building.totalFloors} Floors` }]
      : []),
    {
      icon: Building2,
      label: 'Active Units',
      value: `${buildingProperties.length} ${buildingProperties.length === 1 ? 'Residence' : 'Residences'}`,
    },
  ];

  const hasAmenities = Boolean(building.amenities && building.amenities.length > 0);
  const hasFacilities = Boolean(building.facilities && building.facilities.length > 0);
  const hasLandmarks = Boolean(building.nearbyLandmarks && building.nearbyLandmarks.length > 0);

  const scrollToUnits = () => {
    const el = document.getElementById('available-units');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="flex-1 w-full bg-[#F8F7F3] pb-16 sm:pb-20">
      {/* Deep Navy Split Architectural Hero Dossier (Distinct from White Property Listing Header) */}
      <section className="w-full bg-[#17243B] text-white border-b border-[#C6A878]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-5 pb-8 sm:pt-7 sm:pb-12 space-y-6">
          <Breadcrumbs items={breadcrumbItems} onNavigate={onNavigate} lightText />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10 items-stretch">
            {/* Left Dossier Summary */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6 min-w-0">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-[#C6A878]">
                  <span className="whitespace-nowrap">Building Dossier</span>
                  {building.buildingType?.trim() && (
                    <span className="inline-flex items-center gap-2 text-white/85 whitespace-nowrap">
                      <span aria-hidden="true" className="text-white/35">
                        ·
                      </span>
                      <span>{building.buildingType.trim()}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span aria-hidden="true" className="text-white/35">
                      ·
                    </span>
                    {linkedNeighborhood ? (
                      <a
                        href={buildNeighborhoodPath(linkedNeighborhood)}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate(buildNeighborhoodPath(linkedNeighborhood));
                        }}
                        className="text-white/85 hover:text-[#C6A878] underline decoration-white/25 underline-offset-4 transition-colors"
                      >
                        {linkedNeighborhood.name}
                      </a>
                    ) : (
                      <span className="text-white/85">{building.location}</span>
                    )}
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12] font-bold text-white font-serif tracking-tight [text-wrap:balance]">
                  {building.buildingName}
                </h1>

                {building.address && (
                  <p className="text-xs sm:text-sm text-slate-300 flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#C6A878] flex-shrink-0 mt-0.5" />
                    <span>{building.address}</span>
                  </p>
                )}

                {building.description?.trim() && (
                  <p className="text-sm text-slate-300/90 leading-relaxed line-clamp-4 pt-1 max-w-xl">
                    {building.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenInquiryModal(building.buildingName)}
                  className="px-5 min-h-[44px] rounded-lg bg-[#C6A878] hover:bg-[#b59665] text-[#17243B] text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Inquire About Development</span>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={scrollToUnits}
                  className="px-4 min-h-[44px] rounded-lg border border-white/25 hover:border-[#C6A878] hover:text-[#C6A878] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Available Units ({buildingProperties.length})</span>
                </button>
              </div>
            </div>

            {/* Right Architectural Gallery Stage */}
            <div className="lg:col-span-7 flex flex-col gap-3 min-w-0">
              <div
                onClick={() => setIsFullscreen(true)}
                className="relative w-full h-64 sm:h-[360px] lg:h-full min-h-[280px] lg:min-h-[380px] rounded-2xl bg-[#0F172A] border border-white/15 overflow-hidden group cursor-pointer"
              >
                <img
                  key={currentImage}
                  src={currentImage}
                  alt={building.buildingName}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallback) {
                      target.dataset.fallback = 'true';
                      target.src = '/assets/extracted/the_alcoves.png';
                    }
                  }}
                  className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15 pointer-events-none" />

                <div className="absolute top-3.5 left-3.5 z-10 px-3 py-1 rounded-md bg-black/65 backdrop-blur-sm text-white text-xs font-mono tabular-nums inline-flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#C6A878]" />
                  <span>
                    {activeImageIndex + 1} / {images.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFullscreen(true);
                  }}
                  aria-label="Open building photo fullscreen"
                  className="absolute top-3.5 right-3.5 z-10 px-3.5 min-h-[40px] rounded-md bg-black/65 hover:bg-black/85 backdrop-blur-sm text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Maximize className="w-3.5 h-3.5 text-[#C6A878] flex-shrink-0" />
                  <span>Fullscreen</span>
                </button>

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex((p) => (p === 0 ? images.length - 1 : p - 1));
                      }}
                      aria-label="Previous building image"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/85 text-white flex items-center justify-center z-10 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex((p) => (p === images.length - 1 ? 0 : p + 1));
                      }}
                      aria-label="Next building image"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/85 text-white flex items-center justify-center z-10 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {images.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      aria-label={`Select building photo ${idx + 1}`}
                      className={`relative w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                        activeImageIndex === idx
                          ? 'border-[#C6A878] opacity-100'
                          : 'border-white/15 opacity-60 hover:opacity-100'
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
          </div>

          {/* Architectural Specification Strip */}
          {buildingSpecs.length > 0 && (
            <div className="pt-6 border-t border-white/10 grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-x-10 gap-y-4">
              {buildingSpecs.map((spec) => {
                const Icon = spec.icon;
                return (
                  <div key={spec.label} className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.15em] text-[#C6A878]/90 font-semibold">
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{spec.label}</span>
                    </div>
                    <div className="text-sm sm:text-base font-semibold text-white tabular-nums truncate">
                      {spec.value}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Architectural Dossier Monograph + District & Map Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-10 sm:pt-12 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left 7 Cols: Architectural Chapters (clean ruled editorial surface) */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 lg:p-10 space-y-8 min-w-0">
            {building.description?.trim() && (
              <section className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A7B48] block">
                  01. Architectural Overview
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif">
                  About {building.buildingName}
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-line max-w-prose">
                  {building.description}
                </p>
              </section>
            )}

            {(hasAmenities || hasFacilities) && (
              <section
                className={`space-y-6 ${
                  building.description?.trim() ? 'pt-7 border-t border-slate-200' : ''
                }`}
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A7B48] block">
                    02. Shared Infrastructure
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif mt-1">
                    Amenities &amp; Building Facilities
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {hasAmenities && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                        Residential Amenities
                      </h3>
                      <ul className="space-y-2.5">
                        {building.amenities!.map((amenity, idx) => (
                          <li
                            key={`${amenity}-${idx}`}
                            className="flex items-start gap-2.5 text-sm text-slate-700"
                          >
                            <Check className="w-4 h-4 text-[#C6A878] flex-shrink-0 mt-0.5" />
                            <span>{amenity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {hasFacilities && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                        Facilities &amp; Services
                      </h3>
                      <ul className="space-y-2.5">
                        {building.facilities!.map((facility, idx) => (
                          <li
                            key={`${facility}-${idx}`}
                            className="flex items-start gap-2.5 text-sm text-slate-700"
                          >
                            <Check className="w-4 h-4 text-[#17243B] flex-shrink-0 mt-0.5" />
                            <span>{facility}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {hasLandmarks && (
              <section className="pt-7 border-t border-slate-200 space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A7B48] block">
                    03. Proximity Directory
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif mt-1">
                    Nearby Landmarks &amp; Destinations
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                  {building.nearbyLandmarks!.map((lm, idx) => (
                    <div
                      key={`${lm}-${idx}`}
                      className="flex items-center gap-2.5 py-2 border-b border-slate-100 text-sm text-[#17243B]"
                    >
                      <Compass className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
                      <span>{lm}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right 5 Cols: Neighborhood Context + Architectural Map */}
          <aside className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-6 min-w-0">
            {linkedNeighborhood && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0">
                      <img
                        src={linkedNeighborhood.image || '/assets/extracted/photo_the_alcoves.png'}
                        alt={linkedNeighborhood.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9A7B48] block">
                        Neighborhood Context
                      </span>
                      <h3 className="text-lg font-bold text-[#17243B] font-serif truncate">
                        {linkedNeighborhood.name}
                      </h3>
                      {linkedNeighborhood.tagline && (
                        <p className="text-xs text-slate-500 truncate">{linkedNeighborhood.tagline}</p>
                      )}
                    </div>
                  </div>

                  {linkedNeighborhood.description && (
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                      {linkedNeighborhood.description}
                    </p>
                  )}

                  <a
                    href={buildNeighborhoodPath(linkedNeighborhood)}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(buildNeighborhoodPath(linkedNeighborhood));
                    }}
                    className="w-full min-h-[42px] px-4 rounded-lg bg-[#17243B] hover:bg-[#203150] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <span>Explore District Guide</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#C6A878]" />
                  </a>
                </div>
              </div>
            )}

            {(building.address || mapLinks.embedUrl) && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9A7B48] block">
                    Site Location
                  </span>
                  <h2 className="text-base font-bold text-[#17243B] font-serif mt-0.5">
                    Address &amp; Map Coordinates
                  </h2>
                  {building.address && (
                    <p className="text-xs text-slate-600 mt-1.5 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#C6A878] flex-shrink-0 mt-0.5" />
                      <span>{building.address}</span>
                    </p>
                  )}
                </div>

                {mapLinks.embedUrl && (
                  <div className="w-full h-56 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <iframe
                      title={`Map of ${building.buildingName}`}
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
                    <span>Open Location in Maps</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#C6A878]" />
                  </a>
                )}
              </div>
            )}
          </aside>
        </div>

        {/* Unit Availability Matrix (Horizontal Split Cards — Distinct from Property Directory Cards) */}
        <section id="available-units" className="space-y-5 scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A7B48]">
                Approved Building Inventory
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif mt-0.5">
                Available Units in {building.buildingName} ({buildingProperties.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenInquiryModal(`${building.buildingName} Unit Inquiry`)}
              className="px-4 min-h-[40px] rounded-lg border border-[#17243B] text-[#17243B] hover:bg-[#17243B] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              <span>Request Floor Plans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {buildingProperties.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 text-center space-y-3">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-[#17243B]">
                No Public Listings Currently Active in {building.buildingName}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Request off-market availability or upcoming resales inside {building.buildingName} directly from our private advisory team.
              </p>
              <button
                type="button"
                onClick={() => onOpenInquiryModal(building.buildingName)}
                className="px-5 min-h-[44px] rounded-lg bg-[#17243B] hover:bg-[#203150] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <span>Request Unit Availability</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C6A878]" />
              </button>
            </div>
          ) : (
            <div
              className={
                buildingProperties.length === 1
                  ? 'grid grid-cols-1 max-w-3xl gap-5'
                  : 'grid grid-cols-1 lg:grid-cols-2 gap-5'
              }
            >
              {buildingProperties.map((prop) => {
                const propPath = buildPropertyPath(prop);
                const img = prop.images?.[0] || '/assets/extracted/the_alcoves.png';
                return (
                  <a
                    key={prop.propertyId}
                    href={propPath}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(propPath);
                    }}
                    className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-[#C6A878] transition-colors flex flex-col sm:flex-row items-stretch"
                  >
                    <div className="relative w-full sm:w-48 md:w-56 aspect-[16/10] sm:aspect-auto bg-slate-900 overflow-hidden flex-shrink-0">
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
                    </div>

                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3 min-w-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#9A7B48]">
                          <span>{prop.listingType === 'sale' ? 'For Sale' : 'For Rent'}</span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-slate-500">{prop.propertyType}</span>
                        </div>
                        <h3 className="text-base font-bold text-[#17243B] group-hover:text-[#9A7B48] transition-colors truncate">
                          {prop.propertyTitle}
                        </h3>
                        <div className="text-lg font-bold text-[#17243B] font-mono tabular-nums">
                          {formatPHP(prop.price, prop.listingType === 'rent')}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 font-medium">
                        <div className="flex items-center gap-3 tabular-nums">
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
                        <span className="text-[#17243B] font-semibold inline-flex items-center gap-1 whitespace-nowrap group-hover:text-[#9A7B48]">
                          <span>View Unit</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* Other Developments */}
        {relatedBuildings.length > 0 && (
          <section className="space-y-5 pt-2">
            <div className="border-b border-slate-200 pb-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9A7B48]">
                Other Architectural Developments
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif mt-0.5">
                Explore Other Cebu Buildings
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {relatedBuildings.map((bld) => {
                const path = buildBuildingPath(bld);
                return (
                  <a
                    key={bld.buildingId}
                    href={path}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(path);
                    }}
                    className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-[#C6A878] transition-colors flex flex-col"
                  >
                    <div className="aspect-[16/10] bg-slate-900 relative overflow-hidden">
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
                    <div className="p-4 sm:p-5 space-y-1.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9A7B48] truncate">
                          {bld.location}
                          {bld.buildingType ? ` · ${bld.buildingType}` : ''}
                        </div>
                        <h3 className="text-base font-bold text-[#17243B] group-hover:text-[#9A7B48] transition-colors mt-0.5">
                          {bld.buildingName}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {bld.description}
                        </p>
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
        title={building.buildingName}
        onClose={() => setIsFullscreen(false)}
        onSelectIndex={setActiveImageIndex}
      />
    </main>
  );
};
