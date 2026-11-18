import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bath,
  Bed,
  Building,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Heart,
  Image as ImageIcon,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Maximize,
  Maximize2,
  ParkingSquare,
  Phone,
  Send,
  Share2,
  Sofa,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  uploadPropertyPhoto,
  deleteUnreferencedStorageImages,
} from '../../services/storageService';
import { submitInquiry } from '../../services/inquiryService';
import { recordAuditLog } from '../../services/auditLogService';
import { useAuth } from '../../context/AuthContext';
import {
  BuildingDoc,
  LocationHighlight,
  PropertyDoc,
  WebsiteSettings,
} from '../../types/property';
import {
  canManagePropertyPhotos,
  formatPHP,
  validateInquiryForm,
} from '../../utils/filterProperties';
import {
  buildBuildingPath,
  buildNeighborhoodPath,
  buildPropertyPath,
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

interface PropertyDetailPageProps {
  property: PropertyDoc;
  allProperties: PropertyDoc[];
  buildings: BuildingDoc[];
  neighborhoods: LocationHighlight[];
  favorites: string[];
  siteSettings?: WebsiteSettings;
  otherReferencedImageUrls?: Set<string>;
  onToggleFavorite: (id: string, e?: React.MouseEvent) => void;
  onNavigate: (path: string) => void;
  onPropertyUpdated?: (updated: PropertyDoc) => void;
}

export const PropertyDetailPage: React.FC<PropertyDetailPageProps> = ({
  property,
  allProperties,
  buildings,
  neighborhoods,
  favorites,
  siteSettings,
  otherReferencedImageUrls,
  onToggleFavorite,
  onNavigate,
  onPropertyUpdated,
}) => {
  const { user, profile, isSuperAdmin, isEditor } = useAuth();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [confirmDeletePhotoIndex, setConfirmDeletePhotoIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline inquiry form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredContact, setPreferredContact] = useState<'email' | 'phone'>('email');
  const [message, setMessage] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [inquirySubmitError, setInquirySubmitError] = useState<string | null>(null);

  useEffect(() => {
    setActiveImageIndex(0);
    setIsFullscreen(false);
    setConfirmDeletePhotoIndex(null);
    setUploadError(null);
    setInquirySubmitted(false);
    setInquirySubmitError(null);
    setFormErrors({});
    setMessage(
      `I would like to request the floor plan, payment terms, and a private viewing schedule for ${property.propertyTitle}.`
    );
  }, [property.propertyId, property.propertyTitle]);

  const images = useMemo(
    () =>
      property.images && property.images.length > 0
        ? property.images
        : ['/assets/extracted/the_alcoves.png'],
    [property.images]
  );

  const currentImage = images[activeImageIndex] || images[0];
  const isFav = favorites.includes(property.propertyId);
  const canManagePhotos = canManagePropertyPhotos(user?.uid, isSuperAdmin, property, isEditor);

  const linkedBuilding = useMemo(
    () =>
      buildings.find(
        (b) =>
          isBuildingPubliclyVisible(b) &&
          ((property.buildingId && b.buildingId === property.buildingId) ||
            (property.buildingName &&
              b.buildingName.trim().toLowerCase() === property.buildingName.trim().toLowerCase()))
      ) || null,
    [buildings, property.buildingId, property.buildingName]
  );

  const linkedNeighborhood = useMemo(
    () =>
      neighborhoods.find(
        (n) => isNeighborhoodPubliclyVisible(n) && matchesNeighborhoodName(n.name, property.location)
      ) || null,
    [neighborhoods, property.location]
  );

  const mapLinks = useMemo(
    () =>
      resolveMapLocations({
        mapUrl: property.mapUrl || linkedBuilding?.mapUrl,
        latitude: property.latitude ?? linkedBuilding?.latitude,
        longitude: property.longitude ?? linkedBuilding?.longitude,
        address: property.address || linkedBuilding?.address,
        queryLabel: `${property.propertyTitle}, ${property.location}, Cebu`,
      }),
    [property, linkedBuilding]
  );

  const relatedProperties = useMemo(() => {
    const others = allProperties.filter(
      (p) => p.status === 'approved' && p.propertyId !== property.propertyId
    );
    const prioritized = [
      ...others.filter((p) => property.buildingId && p.buildingId === property.buildingId),
      ...others.filter(
        (p) =>
          p.buildingId !== property.buildingId &&
          matchesNeighborhoodName(p.location, property.location)
      ),
      ...others.filter(
        (p) =>
          p.buildingId !== property.buildingId &&
          !matchesNeighborhoodName(p.location, property.location) &&
          p.propertyType === property.propertyType
      ),
      ...others,
    ];
    const unique: PropertyDoc[] = [];
    const seen = new Set<string>();
    for (const item of prioritized) {
      if (!seen.has(item.propertyId)) {
        seen.add(item.propertyId);
        unique.push(item);
      }
      if (unique.length >= 3) break;
    }
    return unique;
  }, [allProperties, property]);

  // Apply dynamic SEO & Schema.org RealEstateListing metadata
  useEffect(() => {
    const origin = getOrigin();
    const canonicalPath = buildPropertyPath(property);
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
        name: property.propertyTitle,
        item: `${origin}${canonicalPath}`,
      },
    ];

    const defaultTitle = `${property.propertyTitle} | ${property.location} | Cebu Prime Properties`;
    const defaultDesc = `${
      property.listingType === 'sale' ? 'For Sale' : 'For Rent'
    } ${property.propertyType} in ${property.location} (${property.floorArea} sqm, ${
      property.bedrooms
    } Bed, ${property.bathrooms} Bath) — ${formatPHP(
      property.price,
      property.listingType === 'rent'
    )}. ${property.description}`;

    applySeoMetadata({
      title: property.seoTitle?.trim() || defaultTitle,
      description: property.seoDescription?.trim() || defaultDesc,
      canonicalPath,
      ogType: 'article',
      ogImage: images[0],
      siteName: siteSettings?.siteName || 'Cebu Prime Properties',
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'RealEstateListing',
            name: property.propertyTitle,
            description: property.description,
            url: `${origin}${canonicalPath}`,
            image: images,
            datePosted: property.approvedAt || property.createdAt,
            offers: {
              '@type': 'Offer',
              price: property.price,
              priceCurrency: 'PHP',
              availability: 'https://schema.org/InStock',
              businessFunction:
                property.listingType === 'rent'
                  ? 'https://purl.org/goodrelations/v1#LeaseOut'
                  : 'https://purl.org/goodrelations/v1#Sell',
            },
            floorSize: {
              '@type': 'QuantitativeValue',
              value: property.floorArea,
              unitCode: 'MTK',
            },
            numberOfRooms: property.bedrooms,
            numberOfBathroomsTotal: property.bathrooms,
            address: {
              '@type': 'PostalAddress',
              streetAddress: property.address,
              addressLocality: property.location,
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
  }, [property, linkedNeighborhood, images, siteSettings?.siteName]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    ...(linkedNeighborhood
      ? [
          {
            label: linkedNeighborhood.name,
            href: buildNeighborhoodPath(linkedNeighborhood),
          },
        ]
      : [{ label: property.location }]),
    ...(linkedBuilding
      ? [
          {
            label: linkedBuilding.buildingName,
            href: buildBuildingPath(linkedBuilding),
          },
        ]
      : []),
    { label: property.propertyTitle },
  ];

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: property.propertyTitle,
          text: `${property.propertyTitle} in ${property.location}`,
          url: shareUrl,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image size exceeds 10MB limit.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const result = await uploadPropertyPhoto(file, property.propertyId);
      const newImages = [...(property.images || []), result.url];
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'properties', property.propertyId), {
        images: newImages,
        updatedAt: now,
      });
      if (isEditor || isSuperAdmin) {
        await recordAuditLog({
          user,
          editorEmail: user?.email || undefined,
          editorName: profile?.displayName || undefined,
          editorRole: isSuperAdmin ? 'superadmin' : 'editor',
          contentType: 'property',
          contentId: property.propertyId,
          contentTitle: property.propertyTitle,
          action: 'upload_photo',
          changedFields: ['images'],
          summary: `Uploaded gallery photo to "${property.propertyTitle}"`,
        });
      }
      if (onPropertyUpdated) {
        onPropertyUpdated({ ...property, images: newImages, updatedAt: now });
      }
      setActiveImageIndex(newImages.length - 1);
    } catch {
      setUploadError('Failed to upload image to Firebase Storage. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (indexToDelete: number) => {
    if (!canManagePhotos) return;
    if (images.length <= 1) {
      setUploadError('A property must retain at least one photograph.');
      setConfirmDeletePhotoIndex(null);
      return;
    }

    const deletedUrl = images[indexToDelete];
    setIsDeletingPhoto(true);
    setUploadError(null);
    try {
      const newImages = images.filter((_, idx) => idx !== indexToDelete);
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'properties', property.propertyId), {
        images: newImages,
        updatedAt: now,
      });
      if (!isEditor && otherReferencedImageUrls && deletedUrl && !newImages.includes(deletedUrl)) {
        await deleteUnreferencedStorageImages([deletedUrl], otherReferencedImageUrls);
      }
      if (isEditor || isSuperAdmin) {
        await recordAuditLog({
          user,
          editorEmail: user?.email || undefined,
          editorName: profile?.displayName || undefined,
          editorRole: isSuperAdmin ? 'superadmin' : 'editor',
          contentType: 'property',
          contentId: property.propertyId,
          contentTitle: property.propertyTitle,
          action: 'upload_photo',
          changedFields: ['images'],
          summary: `Removed image ${indexToDelete + 1} from gallery of "${property.propertyTitle}"`,
        });
      }
      if (onPropertyUpdated) {
        onPropertyUpdated({ ...property, images: newImages, updatedAt: now });
      }
      setConfirmDeletePhotoIndex(null);
      setActiveImageIndex(Math.max(0, indexToDelete - 1));
    } catch (err: any) {
      setUploadError(err.message || 'Could not update photo.');
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateInquiryForm({ fullName, email, phone, message });
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setFormErrors({});
    setInquirySubmitError(null);
    setIsSubmittingInquiry(true);
    try {
      await submitInquiry({
        fullName,
        email,
        phone,
        propertyInterest: property.propertyTitle,
        preferredContact,
        message,
      });
      setInquirySubmitted(true);
    } catch {
      setInquirySubmitError('We encountered an issue sending your inquiry. Please try again.');
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  // Build applicable-only specification cards
  const specCards = [
    { icon: Bed, label: 'Bedrooms', value: `${property.bedrooms} Bed` },
    { icon: Bath, label: 'Bathrooms', value: `${property.bathrooms} Bath` },
    { icon: Maximize2, label: 'Floor Area', value: `${property.floorArea} sqm` },
    ...(typeof property.lotArea === 'number' && property.lotArea > 0
      ? [{ icon: Layers, label: 'Lot Area', value: `${property.lotArea} sqm` }]
      : []),
    ...(typeof property.parkingSpaces === 'number' && property.parkingSpaces > 0
      ? [
          {
            icon: ParkingSquare,
            label: 'Parking',
            value: `${property.parkingSpaces} Slot${property.parkingSpaces > 1 ? 's' : ''}`,
          },
        ]
      : []),
    ...(property.furnishingStatus?.trim()
      ? [{ icon: Sofa, label: 'Furnishing', value: property.furnishingStatus.trim() }]
      : []),
    ...(property.floorLevel?.trim()
      ? [{ icon: Compass, label: 'Floor Level', value: property.floorLevel.trim() }]
      : []),
  ];

  const availabilityText = property.availabilityLabel?.trim() || 'Available';

  return (
    <main className="flex-1 w-full bg-[#F8F7F3] pb-16 sm:pb-20">
      {/* Top Breadcrumb & Summary Header */}
      <section className="w-full bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-5 sm:py-7 space-y-4">
          <Breadcrumbs items={breadcrumbItems} onNavigate={onNavigate} />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#17243B] text-[#C6A878] text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                  {property.listingType === 'sale' ? 'For Sale' : 'For Rent'}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#F8F7F3] border border-slate-200 text-[#17243B] text-[11px] font-semibold whitespace-nowrap">
                  {property.propertyType}
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold whitespace-nowrap">
                  {availabilityText}
                </span>
                {property.featured && (
                  <span className="px-3 py-1 rounded-full bg-[#C6A878]/20 text-[#8F6F3C] text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                    Featured
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#17243B] font-serif tracking-tight leading-tight">
                {property.propertyTitle}
              </h1>

              {property.address && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
                  <span>{property.address}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap lg:flex-col lg:items-end justify-between gap-3 pt-2 lg:pt-0">
              <div className="lg:text-right">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                  {property.listingType === 'rent' ? 'Monthly Lease Rate' : 'Asking Price'}
                </span>
                <div className="text-2xl sm:text-3xl font-bold text-[#17243B] font-mono tabular-nums whitespace-nowrap">
                  {formatPHP(property.price, property.listingType === 'rent')}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => onToggleFavorite(property.propertyId, e)}
                  className={`px-4 min-h-[44px] rounded-full border text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
                    isFav
                      ? 'border-[#C6A878] bg-[#C6A878]/15 text-[#17243B]'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 flex-shrink-0 ${
                      isFav ? 'fill-[#C6A878] text-[#C6A878]' : ''
                    }`}
                  />
                  <span>{isFav ? 'Saved' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="px-4 min-h-[44px] rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
                  <span>{shareCopied ? 'Link Copied' : 'Share'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-6 sm:pt-8 space-y-8 sm:space-y-10">
        {/* Gallery Showcase Card */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div
            onClick={() => setIsFullscreen(true)}
            title="Click to view fullscreen"
            className="relative w-full h-64 sm:h-[440px] lg:h-[520px] bg-gradient-to-br from-[#17243B] via-[#1f3150] to-[#0f172a] overflow-hidden group cursor-pointer"
          >
            <img
              key={currentImage}
              src={currentImage}
              alt={`${property.propertyTitle} - image ${activeImageIndex + 1}`}
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

            {/* Image Counter */}
            <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-sm text-white text-xs font-mono font-medium inline-flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-[#C6A878]" />
              <span>
                {activeImageIndex + 1} / {images.length}
              </span>
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(true);
              }}
              aria-label="Open fullscreen gallery"
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
                    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                  }}
                  aria-label="Previous property photo"
                  className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/55 hover:bg-black/85 text-white flex items-center justify-center transition-colors z-10"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                  }}
                  aria-label="Next property photo"
                  className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/55 hover:bg-black/85 text-white flex items-center justify-center transition-colors z-10"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail Strip with Generous Padding */}
          {images.length > 1 && (
            <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center gap-3 overflow-x-auto">
              {images.map((imgUrl, idx) => (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={`Select photo ${idx + 1}`}
                  className={`relative w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 bg-slate-200 transition-all ${
                    activeImageIndex === idx
                      ? 'border-[#C6A878] ring-2 ring-[#C6A878]/30 shadow-sm opacity-100'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt=""
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.fallback) {
                        target.dataset.fallback = 'true';
                        target.src = '/assets/extracted/the_alcoves.png';
                      }
                    }}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Role-Gated Photo Management for Master Admin / Owning Agent */}
          {canManagePhotos && (
            <div className="px-4 sm:px-6 py-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#17243B] flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#C6A878] flex-shrink-0" />
                  <span>Manage Property Photographs</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isSuperAdmin
                    ? 'Master Authority access: add or remove photos on this listing.'
                    : isEditor
                    ? 'Editorial Staff access: upload new photos or remove them from the listing gallery.'
                    : 'Assigned Agent access: add or remove photos on your own listing.'}
                </p>
                {uploadError && (
                  <p className="text-xs text-rose-600 mt-1 font-medium">{uploadError}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {images.length > 1 && (
                  confirmDeletePhotoIndex === activeImageIndex ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isDeletingPhoto}
                        onClick={() => handleDeletePhoto(activeImageIndex)}
                        className="px-3.5 min-h-[40px] rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{isDeletingPhoto ? 'Updating...' : 'Confirm Remove'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingPhoto}
                        onClick={() => setConfirmDeletePhotoIndex(null)}
                        className="px-3 min-h-[40px] rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isDeletingPhoto}
                      onClick={() => setConfirmDeletePhotoIndex(activeImageIndex)}
                      className="px-4 min-h-[40px] rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{isEditor && !isSuperAdmin ? 'Remove Active Photo' : 'Delete Active Photo'}</span>
                    </button>
                  )
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 min-h-[40px] rounded-full border border-[#17243B] text-[#17243B] hover:bg-[#17243B] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Add Photo</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Two-Column Detail & Inquiry Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left 7/12: Specs, Description, Amenities, Building & Neighborhood, Map */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Key Specifications Grid (Only Applicable Fields) */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#C6A878] mb-4">
                Residence Specifications
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {specCards.map((spec) => {
                  const Icon = spec.icon;
                  return (
                    <div
                      key={spec.label}
                      className="p-3.5 rounded-2xl bg-[#F8F7F3] border border-slate-200/80 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#C6A878] flex-shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block">
                          {spec.label}
                        </span>
                        <span className="text-sm font-bold text-[#17243B] truncate block">
                          {spec.value}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            {property.description?.trim() && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm space-y-3">
                <h2 className="text-lg sm:text-xl font-bold text-[#17243B] font-serif">
                  Property Overview
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-line">
                  {property.description}
                </p>
              </div>
            )}

            {/* Features & Amenities */}
            {((property.features && property.features.length > 0) ||
              (property.amenities && property.amenities.length > 0)) && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm space-y-5">
                {property.features && property.features.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-[#17243B] font-serif">
                      Unit Features &amp; Highlights
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {property.features.map((feat, idx) => (
                        <div
                          key={`${feat}-${idx}`}
                          className="flex items-center gap-2.5 text-sm text-slate-700"
                        >
                          <div className="w-5 h-5 rounded-full bg-[#17243B]/10 flex items-center justify-center text-[#17243B] flex-shrink-0">
                            <Check className="w-3 h-3 text-[#17243B]" />
                          </div>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {property.amenities && property.amenities.length > 0 && (
                  <div
                    className={`space-y-3 ${
                      property.features && property.features.length > 0
                        ? 'pt-4 border-t border-slate-100'
                        : ''
                    }`}
                  >
                    <h2 className="text-lg sm:text-xl font-bold text-[#17243B] font-serif">
                      Building &amp; Residence Amenities
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {property.amenities.map((amenity, idx) => (
                        <div
                          key={`${amenity}-${idx}`}
                          className="flex items-center gap-2.5 text-sm text-slate-700"
                        >
                          <div className="w-5 h-5 rounded-full bg-[#C6A878]/20 flex items-center justify-center text-[#17243B] flex-shrink-0">
                            <Check className="w-3 h-3 text-[#C6A878]" />
                          </div>
                          <span>{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Building & Neighborhood Cross-Links */}
            {(linkedBuilding || linkedNeighborhood || property.buildingName || property.location) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Building Information Card */}
                {(linkedBuilding || property.buildingName) && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C6A878] flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5" />
                        <span>Building &amp; Development</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-[#17243B] font-serif">
                        {linkedBuilding?.buildingName || property.buildingName}
                      </h3>
                      {linkedBuilding?.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {linkedBuilding.description}
                        </p>
                      )}
                      {linkedBuilding?.developer && (
                        <p className="text-[11px] font-medium text-slate-500">
                          Developer: {linkedBuilding.developer}
                        </p>
                      )}
                    </div>

                    {linkedBuilding && (
                      <a
                        href={buildBuildingPath(linkedBuilding)}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate(buildBuildingPath(linkedBuilding));
                        }}
                        className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-full bg-[#17243B] hover:bg-[#203150] text-white text-xs font-semibold transition-colors whitespace-nowrap self-start"
                      >
                        <span>Explore Building</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#C6A878] flex-shrink-0" />
                      </a>
                    )}
                  </div>
                )}

                {/* Neighborhood & Area Card */}
                {(linkedNeighborhood || property.location) && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C6A878] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Neighborhood &amp; Area</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-[#17243B] font-serif">
                        {linkedNeighborhood?.name || property.location}
                      </h3>
                      {linkedNeighborhood?.tagline && (
                        <p className="text-xs font-semibold text-[#8F6F3C]">
                          {linkedNeighborhood.tagline}
                        </p>
                      )}
                      {linkedNeighborhood?.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {linkedNeighborhood.description}
                        </p>
                      )}
                    </div>

                    {linkedNeighborhood && (
                      <a
                        href={buildNeighborhoodPath(linkedNeighborhood)}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate(buildNeighborhoodPath(linkedNeighborhood));
                        }}
                        className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-full border border-[#17243B] text-[#17243B] hover:bg-[#17243B] hover:text-white text-xs font-semibold transition-colors whitespace-nowrap self-start"
                      >
                        <span>View Neighborhood Guide</span>
                        <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Address & Interactive Map */}
            {(property.address || mapLinks.embedUrl) && (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#17243B] font-serif">
                      Address &amp; Map Location
                    </h2>
                    {property.address && (
                      <p className="text-xs sm:text-sm text-slate-600 mt-1 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
                        <span>{property.address}</span>
                      </p>
                    )}
                  </div>

                  {mapLinks.externalUrl && (
                    <a
                      href={mapLinks.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-full border border-slate-300 hover:bg-slate-50 text-[#17243B] text-xs font-semibold transition-colors whitespace-nowrap self-start"
                    >
                      <span>Open in Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#C6A878] flex-shrink-0" />
                    </a>
                  )}
                </div>

                {mapLinks.embedUrl && (
                  <div className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                    <iframe
                      title={`Map of ${property.propertyTitle}`}
                      src={mapLinks.embedUrl}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="w-full h-full border-0"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right 5/12: Sticky Private Client Inquiry Form */}
          <aside className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8">
            <div className="bg-[#17243B] text-white rounded-3xl p-5 sm:p-7 shadow-[0_16px_44px_rgba(23,36,59,0.2)] border border-white/10 space-y-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C6A878] block mb-1">
                  Private Client Advisory
                </span>
                <h2 className="text-xl font-bold font-serif text-white">
                  Request Private Viewing &amp; Pricing
                </h2>
                <p className="text-xs text-white/70 mt-1">
                  Connect confidentially with our Cebu property specialists regarding{' '}
                  <strong className="text-[#DFCDAA]">{property.propertyTitle}</strong>.
                </p>
              </div>

              {inquirySubmitted ? (
                <div className="p-5 rounded-2xl bg-white/10 border border-[#C6A878]/40 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold font-serif text-white">
                    Inquiry Dispatched
                  </h3>
                  <p className="text-xs text-white/80 leading-relaxed">
                    {siteSettings?.inquiryAutoReplyMessage?.trim() ||
                      `Thank you, ${fullName}. A dedicated luxury property specialist will reach out to you shortly regarding ${property.propertyTitle}.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setInquirySubmitted(false)}
                    className="px-5 min-h-[40px] rounded-full bg-[#C6A878] hover:bg-[#b89764] text-[#17243B] text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    Send Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-3.5" noValidate>
                  {inquirySubmitError && (
                    <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs">
                      {inquirySubmitError}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="prop-inquiry-name"
                      className="block text-[11px] font-semibold text-white/80 mb-1"
                    >
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#C6A878] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="prop-inquiry-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Elena Villanueva"
                        className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                      />
                    </div>
                    {formErrors.fullName && (
                      <p className="text-[11px] text-rose-300 mt-1">{formErrors.fullName}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="prop-inquiry-email"
                      className="block text-[11px] font-semibold text-white/80 mb-1"
                    >
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#C6A878] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="prop-inquiry-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                      />
                    </div>
                    {formErrors.email && (
                      <p className="text-[11px] text-rose-300 mt-1">{formErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="prop-inquiry-phone"
                      className="block text-[11px] font-semibold text-white/80 mb-1"
                    >
                      Mobile Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#C6A878] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="prop-inquiry-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+63 917 555 0192"
                        className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                      />
                    </div>
                    {formErrors.phone && (
                      <p className="text-[11px] text-rose-300 mt-1">{formErrors.phone}</p>
                    )}
                  </div>

                  <div>
                    <span className="block text-[11px] font-semibold text-white/80 mb-1">
                      Preferred Contact Channel
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {(['email', 'phone'] as const).map((channel) => (
                        <button
                          key={channel}
                          type="button"
                          onClick={() => setPreferredContact(channel)}
                          className={`min-h-[40px] rounded-xl text-xs font-semibold capitalize border transition-colors whitespace-nowrap ${
                            preferredContact === channel
                              ? 'bg-[#C6A878] text-[#17243B] border-[#C6A878]'
                              : 'bg-white/5 text-white/80 border-white/15 hover:bg-white/10'
                          }`}
                        >
                          {channel === 'email' ? 'Email' : 'Phone Call'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="prop-inquiry-message"
                      className="block text-[11px] font-semibold text-white/80 mb-1"
                    >
                      Message &amp; Preferred Viewing Date
                    </label>
                    <textarea
                      id="prop-inquiry-message"
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingInquiry}
                    className="w-full min-h-[46px] px-5 rounded-full bg-[#C6A878] hover:bg-[#b89764] text-[#17243B] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-60 whitespace-nowrap"
                  >
                    {isSubmittingInquiry ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        <span>Dispatching Inquiry...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 flex-shrink-0" />
                        <span>Submit Property Inquiry</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>

        {/* Related Approved Properties */}
        {relatedProperties.length > 0 && (
          <section className="pt-4 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C6A878]">
                  Curated Portfolio
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#17243B] font-serif">
                  Related Cebu Residences
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {relatedProperties.map((rel) => {
                const relPath = buildPropertyPath(rel);
                const relImage = rel.images?.[0] || '/assets/extracted/the_alcoves.png';
                return (
                  <a
                    key={rel.propertyId}
                    href={relPath}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(relPath);
                    }}
                    className="group bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
                  >
                    <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                      <img
                        src={relImage}
                        alt={rel.propertyTitle}
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
                        {rel.listingType === 'sale' ? 'For Sale' : 'For Rent'}
                      </span>
                      <span className="absolute bottom-3 right-3 text-sm font-bold text-white font-mono tabular-nums whitespace-nowrap">
                        {formatPHP(rel.price, rel.listingType === 'rent')}
                      </span>
                    </div>

                    <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] font-semibold text-[#C6A878] flex items-center gap-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{rel.location}</span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-[#17243B] group-hover:text-[#C6A878] transition-colors line-clamp-1 mt-0.5">
                          {rel.propertyTitle}
                        </h3>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Bed className="w-3.5 h-3.5 text-slate-400" />
                          {rel.bedrooms} Bed
                        </span>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Bath className="w-3.5 h-3.5 text-slate-400" />
                          {rel.bathrooms} Bath
                        </span>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Maximize2 className="w-3 h-3 text-slate-400" />
                          {rel.floorArea} sqm
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Fullscreen Photo Lightbox */}
      <FullscreenLightbox
        isOpen={isFullscreen}
        images={images}
        activeIndex={activeImageIndex}
        title={property.propertyTitle}
        onClose={() => setIsFullscreen(false)}
        onSelectIndex={setActiveImageIndex}
      />
    </main>
  );
};
