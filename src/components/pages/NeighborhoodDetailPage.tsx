import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bath,
  Bed,
  Building2,
  Check,
  Compass,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  Maximize,
  Maximize2,
  Sparkles,
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

  const hasOptionalDetails =
    (neighborhood.highlights && neighborhood.highlights.length > 0) ||
    (neighborhood.nearbyLandmarks && neighborhood.nearbyLandmarks.length > 0) ||
    Boolean(neighborhood.lifestyleInfo?.trim()) ||
    Boolean(neighborhood.transportationInfo?.trim());

  return (
    <main className="flex-1 w-full bg-[#F8F7F3] pb-16 sm:pb-20">
      {/* Header Banner */}
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-5 sm:py-7 space-y-4">
          <Breadcrumbs items={breadcrumbItems} onNavigate={onNavigate} />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#17243B] text-[#C6A878] text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                  Neighborhood &amp; Area
                </span>
                {neighborhood.cityOrMunicipality?.trim() && (
                  <span className="px-3 py-1 rounded-full bg-[#F8F7F3] border border-slate-200 text-[#17243B] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                    <MapPin className="w-3 h-3 text-[#C6A878]" />
                    <span>{neighborhood.cityOrMunicipality.trim()}</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#17243B] font-serif tracking-tight">
                {neighborhood.name}
              </h1>

              {neighborhood.tagline?.trim() && (
                <p className="text-sm sm:text-base font-medium text-[#8F6F3C]">
                  {neighborhood.tagline}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onOpenInquiryModal(`${neighborhood.name} Real Estate`)}
              className="px-5 min-h-[44px] rounded-full bg-[#17243B] hover:bg-[#203150] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors shadow-md whitespace-nowrap self-start lg:self-auto"
            >
              <span>Inquire About {neighborhood.name}</span>
              <ArrowRight className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-6 sm:pt-8 space-y-8">
        {/* Cover Image & Optional Saved Gallery */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div
            onClick={() => setIsFullscreen(true)}
            className="relative w-full h-64 sm:h-[400px] lg:h-[460px] bg-gradient-to-br from-[#17243B] via-[#1f3150] to-[#0f172a] overflow-hidden group cursor-pointer"
          >
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
              className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none" />

            {images.length > 1 && (
              <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-sm text-white text-xs font-mono font-medium inline-flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#C6A878]" />
                <span>
                  {activeImageIndex + 1} / {images.length}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(true);
              }}
              aria-label="Open neighborhood photo fullscreen"
              className="absolute top-4 right-4 z-10 px-3.5 min-h-[40px] rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-sm text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Maximize className="w-3.5 h-3.5 text-[#C6A878] flex-shrink-0" />
              <span>Fullscreen</span>
            </button>
          </div>

          {images.length > 1 && (
            <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center gap-3 overflow-x-auto">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={`Select neighborhood photo ${idx + 1}`}
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

        {/* Overview & Strictly Firestore-Saved Neighborhood Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          <div
            className={
              hasSavedMapData ? 'lg:col-span-7 xl:col-span-8 space-y-6' : 'lg:col-span-12 space-y-6'
            }
          >
            {neighborhood.description?.trim() && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm space-y-3">
                <h2 className="text-lg sm:text-xl font-bold text-[#17243B] font-serif">
                  Area Overview
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-line">
                  {neighborhood.description}
                </p>
              </div>
            )}

            {hasOptionalDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {neighborhood.highlights && neighborhood.highlights.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-3">
                    <h3 className="text-base font-bold text-[#17243B] font-serif flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#C6A878]" />
                      <span>Key Highlights</span>
                    </h3>
                    <ul className="space-y-2">
                      {neighborhood.highlights.map((hl, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                          <Check className="w-4 h-4 text-[#C6A878] flex-shrink-0 mt-0.5" />
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {neighborhood.nearbyLandmarks && neighborhood.nearbyLandmarks.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-3">
                    <h3 className="text-base font-bold text-[#17243B] font-serif flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#C6A878]" />
                      <span>Nearby Landmarks</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {neighborhood.nearbyLandmarks.map((lm, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 rounded-full bg-[#F8F7F3] border border-slate-200 text-xs font-medium text-[#17243B]"
                        >
                          {lm}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {neighborhood.lifestyleInfo?.trim() && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-2.5">
                    <h3 className="text-base font-bold text-[#17243B] font-serif flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#C6A878]" />
                      <span>Lifestyle &amp; Community</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                      {neighborhood.lifestyleInfo}
                    </p>
                  </div>
                )}

                {neighborhood.transportationInfo?.trim() && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-2.5">
                    <h3 className="text-base font-bold text-[#17243B] font-serif flex items-center gap-2">
                      <TrainFront className="w-4 h-4 text-[#C6A878]" />
                      <span>Transportation &amp; Accessibility</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                      {neighborhood.transportationInfo}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {hasSavedMapData && (
            <aside className="lg:col-span-5 xl:col-span-4">
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h2 className="text-base font-bold text-[#17243B] font-serif">
                  Area Map Location
                </h2>
                {mapLinks.embedUrl && (
                  <div className="w-full h-60 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
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
                    className="w-full min-h-[40px] px-4 rounded-full border border-slate-300 hover:bg-slate-50 text-[#17243B] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <span>View in Google Maps</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#C6A878]" />
                  </a>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Buildings within the Neighborhood */}
        {areaBuildings.length > 0 && (
          <section className="space-y-5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C6A878]">
                Developments
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif">
                Buildings in {neighborhood.name} ({areaBuildings.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                      {bld.buildingType && (
                        <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-[#F8F7F3] text-[#17243B] text-[10px] font-bold uppercase whitespace-nowrap">
                          {bld.buildingType}
                        </span>
                      )}
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h3 className="text-base font-bold text-[#17243B] group-hover:text-[#C6A878] transition-colors">
                          {bld.buildingName}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{bld.description}</p>
                      </div>
                      {bld.address && (
                        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#C6A878] flex-shrink-0" />
                          <span className="truncate">{bld.address}</span>
                        </div>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Available Approved Properties within the Area */}
        <section className="space-y-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C6A878]">
              Approved Residences
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif">
              Available Properties in {neighborhood.name} ({areaProperties.length})
            </h2>
          </div>

          {areaProperties.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 text-center space-y-3">
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
                className="px-5 min-h-[44px] rounded-full bg-[#17243B] hover:bg-[#203150] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
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
                    className="group bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
                  >
                    <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                      <img
                        src={img}
                        alt={prop.propertyTitle}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-[#F8F7F3] text-[#17243B] text-[10px] font-bold uppercase whitespace-nowrap">
                        {prop.listingType === 'sale' ? 'For Sale' : 'For Rent'}
                      </span>
                      <span className="absolute bottom-3 right-3 text-sm font-bold text-white font-mono tabular-nums whitespace-nowrap">
                        {formatPHP(prop.price, prop.listingType === 'rent')}
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <span className="text-[11px] font-semibold text-[#C6A878] uppercase tracking-wider">
                          {prop.buildingName || prop.propertyType}
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

        {/* Related Neighborhoods */}
        {relatedNeighborhoods.length > 0 && (
          <section className="space-y-5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C6A878]">
                Explore More
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif">
                Related Neighborhood &amp; Areas
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
                    className="group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 aspect-[16/10]"
                  >
                    <img
                      src={rel.image || '/assets/extracted/photo_the_alcoves.png'}
                      alt={rel.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3.5">
                      <div className="w-full flex items-center justify-between gap-2 text-white">
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{rel.name}</div>
                          {rel.tagline && (
                            <div className="text-[10px] text-[#C6A878] truncate">{rel.tagline}</div>
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
