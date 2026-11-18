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

  // Applicable-only building metadata cards
  const buildingFacts = [
    ...(building.developer?.trim()
      ? [{ icon: ShieldCheck, label: 'Developer', value: building.developer.trim() }]
      : []),
    ...(building.buildingType?.trim()
      ? [{ icon: Building2, label: 'Building Type', value: building.buildingType.trim() }]
      : []),
    ...(typeof building.yearCompleted === 'number' && building.yearCompleted > 0
      ? [{ icon: Calendar, label: 'Year Completed', value: String(building.yearCompleted) }]
      : []),
    ...(typeof building.totalFloors === 'number' && building.totalFloors > 0
      ? [{ icon: Layers, label: 'Number of Floors', value: `${building.totalFloors} Floors` }]
      : []),
  ];

  return (
    <main className="flex-1 w-full bg-[#F8F7F3] pb-16 sm:pb-20">
      {/* Header Banner */}
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-5 sm:py-7 space-y-4">
          <Breadcrumbs items={breadcrumbItems} onNavigate={onNavigate} />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {building.buildingType?.trim() && (
                  <span className="px-3 py-1 rounded-full bg-[#17243B] text-[#C6A878] text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                    {building.buildingType.trim()}
                  </span>
                )}
                {linkedNeighborhood ? (
                  <a
                    href={buildNeighborhoodPath(linkedNeighborhood)}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(buildNeighborhoodPath(linkedNeighborhood));
                    }}
                    className="px-3 py-1 rounded-full bg-[#F8F7F3] border border-slate-200 hover:border-[#C6A878] text-[#17243B] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                  >
                    <MapPin className="w-3 h-3 text-[#C6A878]" />
                    <span>{linkedNeighborhood.name}</span>
                  </a>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-[#F8F7F3] border border-slate-200 text-[#17243B] text-[11px] font-semibold whitespace-nowrap">
                    {building.location}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#17243B] font-serif tracking-tight">
                {building.buildingName}
              </h1>

              {building.address && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
                  <span>{building.address}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => onOpenInquiryModal(building.buildingName)}
                className="px-5 min-h-[44px] rounded-full bg-[#17243B] hover:bg-[#203150] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors shadow-md whitespace-nowrap"
              >
                <span>Inquire About {building.buildingName}</span>
                <ArrowRight className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-6 sm:pt-8 space-y-8">
        {/* Cover Image & Multi-Image Gallery */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div
            onClick={() => setIsFullscreen(true)}
            className="relative w-full h-64 sm:h-[420px] lg:h-[480px] bg-gradient-to-br from-[#17243B] via-[#1f3150] to-[#0f172a] overflow-hidden group cursor-pointer"
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none" />

            <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-sm text-white text-xs font-mono font-medium inline-flex items-center gap-1.5">
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
              className="absolute top-4 right-4 z-10 px-3.5 min-h-[40px] rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-sm text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
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
                  className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/85 text-white flex items-center justify-center z-10"
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
                  className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/85 text-white flex items-center justify-center z-10"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center gap-3 overflow-x-auto">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={`Select building photo ${idx + 1}`}
                  className={`relative w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                    activeImageIndex === idx
                      ? 'border-[#C6A878] ring-2 ring-[#C6A878]/30 opacity-100'
                      : 'border-transparent opacity-65 hover:opacity-100'
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
        </section>

        {/* Building Overview + Facts + Amenities */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {buildingFacts.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#C6A878] mb-4">
                  Development Profile
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                  {buildingFacts.map((fact) => {
                    const Icon = fact.icon;
                    return (
                      <div
                        key={fact.label}
                        className="p-3.5 rounded-2xl bg-[#F8F7F3] border border-slate-200/80 flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#C6A878] flex-shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block">
                            {fact.label}
                          </span>
                          <span className="text-sm font-bold text-[#17243B] block truncate">
                            {fact.value}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {building.description?.trim() && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm space-y-3">
                <h2 className="text-lg sm:text-xl font-bold text-[#17243B] font-serif">
                  About {building.buildingName}
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-line">
                  {building.description}
                </p>
              </div>
            )}

            {/* Amenities & Facilities */}
            {((building.amenities && building.amenities.length > 0) ||
              (building.facilities && building.facilities.length > 0)) && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm space-y-6">
                {building.amenities && building.amenities.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-[#17243B] font-serif">
                      Building Amenities
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {building.amenities.map((amenity, idx) => (
                        <div
                          key={`${amenity}-${idx}`}
                          className="flex items-center gap-2.5 text-sm text-slate-700"
                        >
                          <div className="w-5 h-5 rounded-full bg-[#C6A878]/20 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-[#C6A878]" />
                          </div>
                          <span>{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {building.facilities && building.facilities.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <h3 className="text-base sm:text-lg font-bold text-[#17243B] font-serif">
                      Facilities &amp; Services
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {building.facilities.map((facility, idx) => (
                        <div
                          key={`${facility}-${idx}`}
                          className="flex items-center gap-2.5 text-sm text-slate-700"
                        >
                          <div className="w-5 h-5 rounded-full bg-[#17243B]/10 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-[#17243B]" />
                          </div>
                          <span>{facility}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Nearby Landmarks (Only if saved) */}
            {building.nearbyLandmarks && building.nearbyLandmarks.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm space-y-3">
                <h2 className="text-lg sm:text-xl font-bold text-[#17243B] font-serif flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#C6A878]" />
                  <span>Nearby Landmarks</span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {building.nearbyLandmarks.map((lm, idx) => (
                    <span
                      key={`${lm}-${idx}`}
                      className="px-3.5 py-1.5 rounded-full bg-[#F8F7F3] border border-slate-200 text-xs font-medium text-[#17243B]"
                    >
                      {lm}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Neighborhood Card + Map */}
          <aside className="lg:col-span-5 xl:col-span-4 space-y-6">
            {linkedNeighborhood && (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="aspect-[16/9] bg-slate-900 relative overflow-hidden">
                  <img
                    src={linkedNeighborhood.image || '/assets/extracted/photo_the_alcoves.png'}
                    alt={linkedNeighborhood.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#17243B]/85 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C6A878] block">
                      Neighborhood &amp; Area
                    </span>
                    <h3 className="text-lg font-bold font-serif">{linkedNeighborhood.name}</h3>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {linkedNeighborhood.description}
                  </p>
                  <a
                    href={buildNeighborhoodPath(linkedNeighborhood)}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(buildNeighborhoodPath(linkedNeighborhood));
                    }}
                    className="w-full min-h-[44px] px-4 rounded-full bg-[#17243B] hover:bg-[#203150] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <span>Explore {linkedNeighborhood.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#C6A878]" />
                  </a>
                </div>
              </div>
            )}

            {(building.address || mapLinks.embedUrl) && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[#17243B] font-serif">
                    Map &amp; Address
                  </h2>
                  {building.address && (
                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#C6A878] flex-shrink-0" />
                      <span>{building.address}</span>
                    </p>
                  )}
                </div>

                {mapLinks.embedUrl && (
                  <div className="w-full h-56 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
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
                    className="w-full min-h-[40px] px-4 rounded-full border border-slate-300 hover:bg-slate-50 text-[#17243B] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <span>Open Location in Maps</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#C6A878]" />
                  </a>
                )}
              </div>
            )}
          </aside>
        </div>

        {/* Available Approved Properties inside this Building */}
        <section className="space-y-5 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C6A878]">
                Approved Inventory
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif">
                Available Residences in {building.buildingName} ({buildingProperties.length})
              </h2>
            </div>
          </div>

          {buildingProperties.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 text-center space-y-3">
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
                className="px-5 min-h-[44px] rounded-full bg-[#17243B] hover:bg-[#203150] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <span>Request Unit Availability</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C6A878]" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                    className="group bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
                  >
                    <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                      <img
                        src={img}
                        alt={prop.propertyTitle}
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            '/assets/extracted/the_alcoves.png';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-[#F8F7F3] text-[#17243B] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                        {prop.listingType === 'sale' ? 'For Sale' : 'For Rent'}
                      </span>
                      <span className="absolute bottom-3 right-3 text-sm font-bold text-white font-mono tabular-nums whitespace-nowrap">
                        {formatPHP(prop.price, prop.listingType === 'rent')}
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <span className="text-[11px] font-semibold text-[#C6A878] uppercase tracking-wider">
                          {prop.propertyType}
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-[#17243B] group-hover:text-[#C6A878] transition-colors line-clamp-1 mt-0.5">
                          {prop.propertyTitle}
                        </h3>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
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

        {/* Related Buildings */}
        {relatedBuildings.length > 0 && (
          <section className="space-y-5 pt-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C6A878]">
                More Developments
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif">
                Related Cebu Buildings
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
                    className="group bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
                  >
                    <div className="aspect-[16/10] bg-slate-900 relative overflow-hidden">
                      <img
                        src={bld.buildingImages?.[0] || '/assets/extracted/the_alcoves.png'}
                        alt={bld.buildingName}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <span className="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[#C6A878] text-[10px] font-bold uppercase">
                        {bld.location}
                      </span>
                    </div>
                    <div className="p-4 space-y-1">
                      <h3 className="text-base font-bold text-[#17243B] group-hover:text-[#C6A878] transition-colors">
                        {bld.buildingName}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2">{bld.description}</p>
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
