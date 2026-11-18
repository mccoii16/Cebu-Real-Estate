import React from 'react';
import {
  X,
  ExternalLink,
  MapPin,
  Building,
  Compass,
  Globe,
  Check,
  Bed,
  Bath,
  Maximize2,
} from 'lucide-react';
import { BuildingDoc, LocationHighlight, PropertyDoc } from '../../types/property';
import {
  buildBuildingPath,
  buildNeighborhoodPath,
  buildPropertyPath,
  ensureUniqueSlug,
} from '../../utils/slugs';
import {
  isBuildingPubliclyVisible,
  isNeighborhoodPubliclyVisible,
} from '../../utils/contentManagement';
import { formatPHP } from '../../utils/filterProperties';

type PreviewPayload =
  | { type: 'property'; item: PropertyDoc }
  | { type: 'building'; item: BuildingDoc }
  | { type: 'neighborhood'; item: LocationHighlight };

interface ContentPreviewModalProps {
  preview: PreviewPayload | null;
  onClose: () => void;
  onOpenLivePage?: (path: string) => void;
}

export const ContentPreviewModal: React.FC<ContentPreviewModalProps> = ({
  preview,
  onClose,
  onOpenLivePage,
}) => {
  if (!preview) return null;

  let title = '';
  let subtitle = '';
  let statusBadge = '';
  let isLive = false;
  let canonicalPath = '';
  let seoTitle = '';
  let seoDescription = '';
  let images: string[] = [];
  let description = '';
  let tags: { label: string; items: string[] }[] = [];
  let specs: { label: string; value: string }[] = [];
  let extraSections: { label: string; body: string }[] = [];

  if (preview.type === 'property') {
    const p = preview.item;
    title = p.propertyTitle;
    subtitle = `${p.buildingName ? `${p.buildingName} • ` : ''}${p.location}`;
    statusBadge = p.status;
    isLive = p.status === 'approved';
    const slug = ensureUniqueSlug(p.slug || p.propertyTitle, [], p.propertyId, 'property');
    canonicalPath = buildPropertyPath({ ...p, slug });
    seoTitle = p.seoTitle?.trim() || `${p.propertyTitle} | Cebu Prime Properties`;
    seoDescription =
      p.seoDescription?.trim() ||
      `${p.propertyType} ${p.listingType === 'rent' ? 'for rent' : 'for sale'} in ${p.location}, Cebu (${p.floorArea} sqm).`;
    images = p.images || [];
    description = p.description;
    specs = [
      {
        label: p.listingType === 'rent' ? 'Monthly Rate' : 'Offering Price',
        value: formatPHP(p.price, p.listingType === 'rent'),
      },
      { label: 'Property Type', value: p.propertyType },
      { label: 'Bedrooms / Baths', value: `${p.bedrooms} BR / ${p.bathrooms} BA` },
      { label: 'Floor Area', value: `${p.floorArea} sqm` },
      ...(p.lotArea ? [{ label: 'Lot Area', value: `${p.lotArea} sqm` }] : []),
      ...(p.parkingSpaces ? [{ label: 'Parking', value: `${p.parkingSpaces} Slot(s)` }] : []),
      ...(p.furnishingStatus ? [{ label: 'Furnishing', value: p.furnishingStatus }] : []),
      ...(p.floorLevel ? [{ label: 'Floor Level', value: p.floorLevel }] : []),
      ...(p.availabilityLabel ? [{ label: 'Availability', value: p.availabilityLabel }] : []),
    ];
    if (p.features && p.features.length > 0) {
      tags.push({ label: 'Unit Features', items: p.features });
    }
    if (p.amenities && p.amenities.length > 0) {
      tags.push({ label: 'Amenities', items: p.amenities });
    }
  } else if (preview.type === 'building') {
    const b = preview.item;
    title = b.buildingName;
    subtitle = `${b.location}${b.address ? ` • ${b.address}` : ''}`;
    statusBadge = b.status || 'published';
    isLive = isBuildingPubliclyVisible(b);
    const slug = ensureUniqueSlug(b.slug || b.buildingName, [], b.buildingId, 'building');
    canonicalPath = buildBuildingPath({ ...b, slug });
    seoTitle = b.seoTitle?.trim() || `${b.buildingName} in ${b.location} | Cebu Prime Properties`;
    seoDescription = b.seoDescription?.trim() || b.description;
    images = b.buildingImages || [];
    description = b.description;
    specs = [
      ...(b.developer ? [{ label: 'Developer', value: b.developer }] : []),
      ...(b.buildingType ? [{ label: 'Building Type', value: b.buildingType }] : []),
      ...(b.yearCompleted ? [{ label: 'Year Completed', value: String(b.yearCompleted) }] : []),
      ...(b.totalFloors ? [{ label: 'Number of Floors', value: `${b.totalFloors} Floors` }] : []),
    ];
    if (b.amenities?.length) tags.push({ label: 'Amenities', items: b.amenities });
    if (b.facilities?.length) tags.push({ label: 'Facilities', items: b.facilities });
    if (b.nearbyLandmarks?.length) tags.push({ label: 'Nearby Landmarks', items: b.nearbyLandmarks });
  } else {
    const n = preview.item;
    title = n.name;
    subtitle = `${n.tagline}${n.cityOrMunicipality ? ` • ${n.cityOrMunicipality}` : ''}`;
    statusBadge = n.status || 'published';
    isLive = isNeighborhoodPubliclyVisible(n);
    const slug = ensureUniqueSlug(n.slug || n.name, [], n.id, 'neighborhood');
    canonicalPath = buildNeighborhoodPath({ ...n, slug });
    seoTitle = n.seoTitle?.trim() || `${n.name} Real Estate & Area Guide | Cebu Prime Properties`;
    seoDescription = n.seoDescription?.trim() || n.description;
    images = [n.image, ...(n.galleryImages || [])].filter(Boolean);
    description = n.description;
    if (n.highlights?.length) tags.push({ label: 'Area Highlights', items: n.highlights });
    if (n.nearbyLandmarks?.length) tags.push({ label: 'Nearby Landmarks', items: n.nearbyLandmarks });
    if (n.lifestyleInfo) extraSections.push({ label: 'Lifestyle & Community', body: n.lifestyleInfo });
    if (n.transportationInfo) {
      extraSections.push({ label: 'Transportation & Connectivity', body: n.transportationInfo });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[65] flex items-center justify-center p-3 sm:p-6 bg-[#17243B]/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 sm:px-6 py-4 bg-[#17243B] text-white flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#C6A878]">
              {preview.type === 'property' ? (
                <Building className="w-3.5 h-3.5" />
              ) : preview.type === 'building' ? (
                <Building className="w-3.5 h-3.5" />
              ) : (
                <Compass className="w-3.5 h-3.5" />
              )}
              <span>{preview.type} Content Preview</span>
              <span className="px-2 py-0.5 rounded-full bg-white/15 text-white text-[10px]">
                {statusBadge}
              </span>
            </div>
            <h3 className="text-lg font-bold font-serif truncate mt-0.5">{title}</h3>
            <p className="text-xs text-white/75 truncate">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="w-8 h-8 rounded-full border border-white/20 text-white/75 hover:text-white hover:bg-white/10 flex items-center justify-center flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 bg-[#F8F7F3] flex-1 text-xs">
          {/* Gallery */}
          {images.length > 0 && (
            <div className="space-y-2.5">
              <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-slate-200 bg-slate-200">
                <img
                  src={images[0]}
                  alt={title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {images.slice(1).map((img, i) => (
                    <div
                      key={`${img}-${i}`}
                      className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                    >
                      <img
                        src={img}
                        alt={`Gallery ${i + 2}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Specs */}
          {specs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {specs.map((s) => (
                <div
                  key={s.label}
                  className="bg-white p-3 rounded-xl border border-slate-200"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    {s.label === 'Bedrooms / Baths' && <Bed className="w-3 h-3" />}
                    {s.label === 'Floor Area' && <Maximize2 className="w-3 h-3" />}
                    {s.label}
                  </div>
                  <div className="font-bold text-[#17243B] mt-0.5 text-xs sm:text-sm">
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Editorial Overview
            </div>
            <p className="text-slate-700 leading-relaxed whitespace-pre-line">{description}</p>
          </div>

          {extraSections.map((sec) => (
            <div key={sec.label} className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {sec.label}
              </div>
              <p className="text-slate-700 leading-relaxed whitespace-pre-line">{sec.body}</p>
            </div>
          ))}

          {/* Tags */}
          {tags.map((group) => (
            <div key={group.label} className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {group.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#17243B]/5 text-[#17243B] font-medium text-[11px]"
                  >
                    <Check className="w-3 h-3 text-[#C6A878]" />
                    <span>{item}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}

          {/* SEO Search Preview */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#C6A878]" />
              <span>Search &amp; Social Metadata Preview</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[11px] text-emerald-700 font-mono truncate">
                https://cebuprimeproperties.ph{canonicalPath}
              </div>
              <div className="text-sm font-bold text-[#1a0dab] truncate">{seoTitle}</div>
              <p className="text-xs text-slate-600 line-clamp-2">{seoDescription}</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#C6A878]" />
            <span>
              {isLive
                ? `Publicly accessible at ${canonicalPath}`
                : 'Currently hidden from public visitors until published.'}
            </span>
          </span>

          <div className="flex items-center gap-2">
            {isLive && onOpenLivePage && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLivePage(canonicalPath);
                }}
                className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl border border-[#17243B] text-[#17243B] hover:bg-[#17243B] hover:text-white font-semibold transition-colors whitespace-nowrap"
              >
                <span>Open Public Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 min-h-[40px] rounded-xl bg-[#17243B] text-[#C6A878] font-bold whitespace-nowrap"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
