import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Check,
  AlertCircle,
  Building,
  DollarSign,
  Maximize2,
  Bed,
  Bath,
  FileText,
  Globe,
  MapPin,
  Eye,
  Archive,
  RotateCcw,
} from 'lucide-react';
import {
  PropertyDoc,
  BuildingDoc,
  PropertyType,
  PropertyLocation,
  LocationHighlight,
  PropertyStatus,
} from '../../types/property';
import {
  uploadPropertyPhoto,
  deleteUnreferencedStorageImages,
} from '../../services/storageService';
import { useAuth } from '../../context/AuthContext';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ensureUniqueSlug } from '../../utils/slugs';
import { MediaGalleryEditor } from './MediaGalleryEditor';
import {
  findOrphanedRemovedImages,
  validatePropertyForm,
} from '../../utils/contentManagement';
import {
  computePropertyChangedFields,
  inferAuditAction,
  validateEditorPropertyCreate,
  validateEditorPropertyUpdate,
} from '../../utils/editorPermissions';
import { recordAuditLog } from '../../services/auditLogService';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (property: PropertyDoc) => void;
  onPreview?: (property: PropertyDoc) => void;
  editingProperty?: PropertyDoc | null;
  existingProperties?: PropertyDoc[];
  buildings: BuildingDoc[];
  locations?: LocationHighlight[];
  otherReferencedImageUrls?: Set<string>;
  isSuperAdmin?: boolean;
  isEditor?: boolean;
}

const COMMON_FEATURES = [
  'Corner Unit',
  'Ocean & Mactan View',
  'City Skyline Panorama',
  'Floor-to-Ceiling Glass',
  'Private Balcony',
  'Walk-in Closet',
  'Maids Quarter',
  'Modular Kitchen',
  'En-Suite Master Bath',
  'Smart Door Lock',
];

const COMMON_AMENITIES = [
  'Swimming Pool',
  'Fitness Gym',
  '24/7 Security & Concierge',
  'Function Rooms',
  'Sky Lounge',
  'Direct Mall Access',
  'Basement Parking',
  'Kids Play Area',
  'Spa & Sauna',
  'Smart Home Automation',
  'Fiber High-Speed Internet',
  'Backup Generator Power',
];

const FALLBACK_LOCATIONS: PropertyLocation[] = [
  'Cebu Business Park',
  'Cebu IT Park',
  'Mactan Newtown',
  'Banilad',
  'Lahug',
  'SRP',
  'Mandaue',
  'Lapu-Lapu City',
];

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  onPreview,
  editingProperty,
  existingProperties = [],
  buildings,
  locations,
  otherReferencedImageUrls = new Set<string>(),
  isSuperAdmin = false,
  isEditor = false,
}) => {
  const { user, profile, isEditor: ctxIsEditor } = useAuth();
  const actingAsEditor = Boolean((isEditor || ctxIsEditor) && !isSuperAdmin);

  const locationOptions = useMemo(() => {
    const dynamic = locations && locations.length > 0 ? locations.map((l) => l.name) : [];
    const base = [...dynamic, ...FALLBACK_LOCATIONS];
    if (editingProperty?.location) {
      base.push(editingProperty.location);
    }
    return Array.from(new Set(base));
  }, [locations, editingProperty?.location]);

  // Basic Information
  const [propertyTitle, setPropertyTitle] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('Condo');
  const [listingType, setListingType] = useState<'sale' | 'rent'>('sale');
  const [price, setPrice] = useState<number>(8500000);
  const [availabilityLabel, setAvailabilityLabel] = useState<string>('Available');

  // Details
  const [bedrooms, setBedrooms] = useState<number>(1);
  const [bathrooms, setBathrooms] = useState<number>(1);
  const [floorArea, setFloorArea] = useState<number>(45);
  const [lotArea, setLotArea] = useState<string>('');
  const [parkingSpaces, setParkingSpaces] = useState<string>('');
  const [furnishingStatus, setFurnishingStatus] = useState<string>('');
  const [floorLevel, setFloorLevel] = useState<string>('');
  const [description, setDescription] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [customFeature, setCustomFeature] = useState('');
  const [amenities, setAmenities] = useState<string[]>([
    'Swimming Pool',
    'Fitness Gym',
    '24/7 Security & Concierge',
  ]);
  const [customAmenity, setCustomAmenity] = useState('');

  // Media
  const [images, setImages] = useState<string[]>([]);
  const [removedUrls, setRemovedUrls] = useState<string[]>([]);

  // Relationships & Location
  const [buildingId, setBuildingId] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [location, setLocation] = useState<PropertyLocation>('Cebu Business Park');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [mapUrl, setMapUrl] = useState<string>('');

  // SEO
  const [customSlug, setCustomSlug] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  // Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setRemovedUrls([]);

    if (editingProperty) {
      setPropertyTitle(editingProperty.propertyTitle);
      setCustomSlug(editingProperty.slug || '');
      setBuildingId(editingProperty.buildingId || '');
      setBuildingName(editingProperty.buildingName || '');
      setLocation((editingProperty.location as PropertyLocation) || 'Cebu Business Park');
      setAddress(editingProperty.address || '');
      setPropertyType((editingProperty.propertyType as PropertyType) || 'Condo');
      setListingType(editingProperty.listingType);
      setPrice(editingProperty.price);
      setBedrooms(editingProperty.bedrooms);
      setBathrooms(editingProperty.bathrooms);
      setFloorArea(editingProperty.floorArea);
      setLotArea(editingProperty.lotArea ? String(editingProperty.lotArea) : '');
      setParkingSpaces(editingProperty.parkingSpaces ? String(editingProperty.parkingSpaces) : '');
      setFurnishingStatus(editingProperty.furnishingStatus || '');
      setFloorLevel(editingProperty.floorLevel || '');
      setAvailabilityLabel(editingProperty.availabilityLabel || 'Available');
      setLatitude(
        editingProperty.latitude !== null && editingProperty.latitude !== undefined
          ? String(editingProperty.latitude)
          : ''
      );
      setLongitude(
        editingProperty.longitude !== null && editingProperty.longitude !== undefined
          ? String(editingProperty.longitude)
          : ''
      );
      setMapUrl(editingProperty.mapUrl || '');
      setDescription(editingProperty.description || '');
      setFeatures(editingProperty.features || []);
      setAmenities(editingProperty.amenities || []);
      setImages(editingProperty.images || []);
      setSeoTitle(editingProperty.seoTitle || '');
      setSeoDescription(editingProperty.seoDescription || '');
    } else {
      setPropertyTitle('');
      setCustomSlug('');
      setBuildingId(buildings[0]?.buildingId || '');
      setBuildingName(buildings[0]?.buildingName || '');
      setLocation((buildings[0]?.location as PropertyLocation) || 'Cebu Business Park');
      setAddress(buildings[0]?.address || '');
      setPropertyType('Condo');
      setListingType('sale');
      setPrice(8500000);
      setBedrooms(1);
      setBathrooms(1);
      setFloorArea(45);
      setLotArea('');
      setParkingSpaces('');
      setFurnishingStatus('');
      setFloorLevel('');
      setAvailabilityLabel('Available');
      setLatitude('');
      setLongitude('');
      setMapUrl('');
      setDescription('');
      setFeatures([]);
      setAmenities(['Swimming Pool', 'Fitness Gym', '24/7 Security & Concierge']);
      setImages(['/assets/extracted/photo_the_alcoves.png']);
      setSeoTitle('');
      setSeoDescription('');
    }
  }, [editingProperty, buildings, isOpen]);

  if (!isOpen) return null;

  const handleBuildingSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bId = e.target.value;
    setBuildingId(bId);
    const found = buildings.find((b) => b.buildingId === bId);
    if (found) {
      setBuildingName(found.buildingName);
      if (found.address) setAddress(found.address);
      if (found.location) setLocation(found.location as PropertyLocation);
      if (!latitude && found.latitude !== null && found.latitude !== undefined) {
        setLatitude(String(found.latitude));
      }
      if (!longitude && found.longitude !== null && found.longitude !== undefined) {
        setLongitude(String(found.longitude));
      }
    }
  };

  const toggleFeature = (item: string) => {
    setFeatures((prev) =>
      prev.includes(item) ? prev.filter((f) => f !== item) : [...prev, item]
    );
  };

  const addCustomFeature = () => {
    const clean = customFeature.trim();
    if (clean && !features.includes(clean)) {
      setFeatures((prev) => [...prev, clean]);
      setCustomFeature('');
    }
  };

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const addCustomAmenity = () => {
    const clean = customAmenity.trim();
    if (clean && !amenities.includes(clean)) {
      setAmenities((prev) => [...prev, clean]);
      setCustomAmenity('');
    }
  };

  const buildPropertyPayload = (
    targetStatus: PropertyStatus
  ): PropertyDoc | null => {
    const validation = validatePropertyForm({
      propertyTitle,
      address,
      price: Number(price),
      floorArea: Number(floorArea),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      images,
      latitudeStr: latitude,
      longitudeStr: longitude,
      mapUrl,
    });

    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Please review property fields.');
      return null;
    }

    const propId = editingProperty?.propertyId || `prop-${Date.now()}`;
    const now = new Date().toISOString();
    const computedSlug = ensureUniqueSlug(
      customSlug.trim() || propertyTitle.trim(),
      existingProperties.map((p) => ({
        id: p.propertyId,
        slug: p.slug,
        fallbackName: p.propertyTitle,
      })),
      editingProperty?.propertyId,
      'property'
    );

    const previousNonArchive: Exclude<PropertyStatus, 'archived'> | null =
      targetStatus === 'archived'
        ? editingProperty && editingProperty.status !== 'archived'
          ? editingProperty.status
          : editingProperty?.previousStatus || 'draft'
        : null;

    return {
      propertyId: propId,
      slug: computedSlug,
      buildingId: buildingId || `bld-${Date.now()}`,
      buildingName: buildingName || propertyTitle.trim(),
      propertyTitle: propertyTitle.trim(),
      location,
      address: address.trim(),
      propertyType,
      listingType,
      price: Number(price),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      floorArea: Number(floorArea),
      lotArea: lotArea.trim() && Number(lotArea) > 0 ? Number(lotArea) : null,
      parkingSpaces:
        parkingSpaces.trim() && Number(parkingSpaces) > 0 ? Number(parkingSpaces) : null,
      furnishingStatus: furnishingStatus.trim(),
      floorLevel: floorLevel.trim(),
      availabilityLabel: availabilityLabel.trim(),
      latitude: validation.latitude,
      longitude: validation.longitude,
      mapUrl: mapUrl.trim(),
      description:
        description.trim() || 'A luxury residence represented by Cebu Prime Properties.',
      features,
      amenities,
      images,
      seoTitle: seoTitle.trim(),
      seoDescription: seoDescription.trim(),
      featured: editingProperty?.featured ?? false,
      status: targetStatus,
      previousStatus: previousNonArchive,
      archivedAt: targetStatus === 'archived' ? editingProperty?.archivedAt || now : null,
      agentId: editingProperty?.agentId || user?.uid || 'agent-01',
      agentName:
        editingProperty?.agentName ||
        profile?.displayName ||
        user?.email?.split('@')[0] ||
        'Prime Agent',
      rejectionReason:
        isSuperAdmin && targetStatus === 'approved'
          ? null
          : editingProperty?.rejectionReason ?? null,
      createdAt: editingProperty?.createdAt || now,
      updatedAt: now,
      submittedAt:
        targetStatus === 'pending' || targetStatus === 'approved'
          ? editingProperty?.submittedAt || now
          : editingProperty?.submittedAt || null,
      approvedAt:
        isSuperAdmin && targetStatus === 'approved'
          ? editingProperty?.approvedAt || now
          : editingProperty?.approvedAt ?? null,
      approvedBy:
        isSuperAdmin && targetStatus === 'approved'
          ? editingProperty?.approvedBy || user?.email || 'admin-super'
          : editingProperty?.approvedBy ?? null,
      hasPendingReview: isSuperAdmin ? false : editingProperty?.hasPendingReview ?? false,
      pendingChanges: isSuperAdmin ? null : editingProperty?.pendingChanges ?? null,
      ...(actingAsEditor || isSuperAdmin
        ? {
            lastModifiedByUid: user?.uid,
            lastModifiedByEmail: user?.email || '',
          }
        : {}),
    };
  };

  const handleSave = async (submitStatus: PropertyStatus) => {
    setErrorMessage(null);

    let resolvedStatus: PropertyStatus = submitStatus;
    if (!isSuperAdmin) {
      if (actingAsEditor) {
        if (!editingProperty) {
          resolvedStatus = submitStatus === 'pending' ? 'pending' : 'draft';
        } else if (submitStatus === 'archived') {
          resolvedStatus = 'archived';
        } else if (editingProperty.status === 'archived') {
          resolvedStatus = editingProperty.previousStatus || 'draft';
        } else if (editingProperty.status === 'draft') {
          resolvedStatus = submitStatus === 'pending' ? 'pending' : 'draft';
        } else {
          resolvedStatus = editingProperty.status;
        }
      } else {
        resolvedStatus = submitStatus === 'approved' ? 'pending' : submitStatus;
      }
    }

    const propertyData = buildPropertyPayload(resolvedStatus);
    if (!propertyData) return;

    if (actingAsEditor) {
      const guard = editingProperty
        ? validateEditorPropertyUpdate(editingProperty, propertyData)
        : validateEditorPropertyCreate(propertyData);
      if (!guard.valid) {
        setErrorMessage(guard.reason || 'Permission denied for this property status transition.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();

      // Agent revising an already-approved listing keeps the live page untouched via pendingChanges
      if (
        !isSuperAdmin &&
        !actingAsEditor &&
        editingProperty &&
        editingProperty.status === 'approved' &&
        resolvedStatus === 'pending'
      ) {
        const pendingChanges: Partial<PropertyDoc> = {
          slug: propertyData.slug,
          propertyTitle: propertyData.propertyTitle,
          buildingId: propertyData.buildingId,
          buildingName: propertyData.buildingName,
          location: propertyData.location,
          address: propertyData.address,
          propertyType: propertyData.propertyType,
          listingType: propertyData.listingType,
          price: propertyData.price,
          bedrooms: propertyData.bedrooms,
          bathrooms: propertyData.bathrooms,
          floorArea: propertyData.floorArea,
          lotArea: propertyData.lotArea,
          parkingSpaces: propertyData.parkingSpaces,
          furnishingStatus: propertyData.furnishingStatus,
          floorLevel: propertyData.floorLevel,
          availabilityLabel: propertyData.availabilityLabel,
          latitude: propertyData.latitude,
          longitude: propertyData.longitude,
          mapUrl: propertyData.mapUrl,
          description: propertyData.description,
          features: propertyData.features,
          amenities: propertyData.amenities,
          images: propertyData.images,
          seoTitle: propertyData.seoTitle,
          seoDescription: propertyData.seoDescription,
          updatedAt: now,
          submittedAt: now,
        };

        const updatedDoc: PropertyDoc = {
          ...editingProperty,
          hasPendingReview: true,
          pendingChanges,
          updatedAt: now,
        };

        await updateDoc(doc(db, 'properties', editingProperty.propertyId), {
          hasPendingReview: true,
          pendingChanges,
          updatedAt: now,
        });

        onSaved(updatedDoc);
        onClose();
        return;
      }

      await setDoc(doc(db, 'properties', propertyData.propertyId), propertyData);

      // Clean up orphaned Storage files only for Super Admin or non-Editor owners (Editors never delete Storage records)
      if (!actingAsEditor) {
        const previousImages = [...(editingProperty?.images || []), ...removedUrls];
        const orphaned = findOrphanedRemovedImages(
          previousImages,
          propertyData.images,
          otherReferencedImageUrls
        );
        if (orphaned.length > 0) {
          await deleteUnreferencedStorageImages(orphaned, otherReferencedImageUrls);
        }
      }

      if (actingAsEditor || isSuperAdmin) {
        const changedFields = computePropertyChangedFields(editingProperty, propertyData);
        const action = inferAuditAction(
          !editingProperty,
          editingProperty?.status || null,
          propertyData.status
        );
        await recordAuditLog({
          user,
          editorEmail: user?.email || undefined,
          editorName: profile?.displayName || undefined,
          editorRole: isSuperAdmin ? 'superadmin' : 'editor',
          contentType: 'property',
          contentId: propertyData.propertyId,
          contentTitle: propertyData.propertyTitle,
          action,
          changedFields,
        });
      }

      onSaved(propertyData);
      onClose();
    } catch (err: any) {
      console.error('Error saving property:', err);
      setErrorMessage(err.message || 'Failed to save property listing.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#17243B]/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-800">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 bg-[#17243B] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C6A878]/20 border border-[#C6A878]/30 flex items-center justify-center text-[#C6A878]">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-serif tracking-wide text-white">
                {editingProperty ? 'Edit Property Listing' : 'Create New Property Listing'}
              </h2>
              <p className="text-xs text-white/70">
                {actingAsEditor
                  ? 'Editorial mode: update descriptions, specs, photos, amenities, and SEO. Listing approval status remains controlled by Super Admin.'
                  : !isSuperAdmin && editingProperty && editingProperty.status === 'approved'
                  ? 'Editing this approved listing will submit changes for Super Admin review without disrupting the live page.'
                  : 'Complete property details, photography gallery, location links, SEO tags, and publishing controls.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full border border-white/20 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-[#F8F7F3] text-xs">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#C6A878]" />
              <span>1. Basic Information &amp; Pricing</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Property Title *</label>
                <input
                  type="text"
                  value={propertyTitle}
                  onChange={(e) => setPropertyTitle(e.target.value)}
                  placeholder="e.g. The Alcoves - High Floor Skyline Suite"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Availability Status</label>
                <input
                  type="text"
                  value={availabilityLabel}
                  onChange={(e) => setAvailabilityLabel(e.target.value)}
                  placeholder="e.g. Available Now, Pre-Selling, Ready for Occupancy"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Property Type</label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                >
                  <option value="Condo">Condo</option>
                  <option value="Penthouse">Penthouse</option>
                  <option value="House & Lot">House & Lot</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Townhouse">Townhouse</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setListingType('sale')}
                    className={`h-10 px-3 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                      listingType === 'sale'
                        ? 'bg-[#17243B] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    For Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingType('rent')}
                    className={`h-10 px-3 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                      listingType === 'rent'
                        ? 'bg-[#17243B] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    For Rent
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {listingType === 'sale' ? 'Sale Price (PHP) *' : 'Monthly Rent (PHP/mo) *'}
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  min={0}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Details, Features & Amenities */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C6A878]" />
              <span>2. Specifications, Features &amp; Amenities</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Bed className="w-3.5 h-3.5 text-slate-400" />
                  <span>Bedrooms</span>
                </label>
                <input
                  type="number"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                  min={0}
                  max={20}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Bath className="w-3.5 h-3.5 text-slate-400" />
                  <span>Bathrooms</span>
                </label>
                <input
                  type="number"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Number(e.target.value))}
                  min={0}
                  max={20}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Floor Area (sqm) *</span>
                </label>
                <input
                  type="number"
                  value={floorArea}
                  onChange={(e) => setFloorArea(Number(e.target.value))}
                  min={1}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lot Area (sqm)</label>
                <input
                  type="number"
                  min={0}
                  value={lotArea}
                  onChange={(e) => setLotArea(e.target.value)}
                  placeholder="Optional"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Parking Slots</label>
                <input
                  type="number"
                  min={0}
                  value={parkingSpaces}
                  onChange={(e) => setParkingSpaces(e.target.value)}
                  placeholder="Optional"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Furnishing</label>
                <select
                  value={furnishingStatus}
                  onChange={(e) => setFurnishingStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="">Not Specified</option>
                  <option value="Unfurnished">Unfurnished</option>
                  <option value="Semi-Furnished">Semi-Furnished</option>
                  <option value="Fully Furnished">Fully Furnished</option>
                  <option value="Interior Designed">Interior Designed</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Floor Level</label>
                <input
                  type="text"
                  value={floorLevel}
                  onChange={(e) => setFloorLevel(e.target.value)}
                  placeholder="e.g. 18th Floor, Bi-Level Penthouse"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Property Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Highlight architectural finishes, orientation, views, and residence upgrades..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            {/* Features */}
            <div>
              <label className="block font-semibold text-slate-700 mb-2">
                Residence Features
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {COMMON_FEATURES.map((item) => {
                  const selected = features.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleFeature(item)}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                        selected
                          ? 'bg-[#17243B] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 text-[#C6A878]" />}
                      <span>{item}</span>
                    </button>
                  );
                })}
                {features
                  .filter((f) => !COMMON_FEATURES.includes(f))
                  .map((custom) => (
                    <button
                      key={custom}
                      type="button"
                      onClick={() => toggleFeature(custom)}
                      className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#17243B] text-white flex items-center gap-1 whitespace-nowrap"
                    >
                      <Check className="w-3 h-3 text-[#C6A878]" />
                      <span>{custom}</span>
                    </button>
                  ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customFeature}
                  onChange={(e) => setCustomFeature(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomFeature();
                    }
                  }}
                  placeholder="Add custom residence feature (e.g. Wrap-Around Terrace)"
                  className="flex-1 h-9 px-3 rounded-xl border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  onClick={addCustomFeature}
                  className="px-3.5 h-9 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Feature</span>
                </button>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <label className="block font-semibold text-slate-700 mb-2">
                Building &amp; Property Amenities
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {COMMON_AMENITIES.map((item) => {
                  const selected = amenities.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleAmenity(item)}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                        selected
                          ? 'bg-[#17243B] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 text-[#C6A878]" />}
                      <span>{item}</span>
                    </button>
                  );
                })}
                {amenities
                  .filter((a) => !COMMON_AMENITIES.includes(a))
                  .map((custom) => (
                    <button
                      key={custom}
                      type="button"
                      onClick={() => toggleAmenity(custom)}
                      className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#17243B] text-white flex items-center gap-1 whitespace-nowrap"
                    >
                      <Check className="w-3 h-3 text-[#C6A878]" />
                      <span>{custom}</span>
                    </button>
                  ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customAmenity}
                  onChange={(e) => setCustomAmenity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomAmenity();
                    }
                  }}
                  placeholder="Add custom amenity (e.g. Wine Cellar, Private Elevator)"
                  className="flex-1 h-9 px-3 rounded-xl border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  onClick={addCustomAmenity}
                  className="px-3.5 h-9 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Amenity</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Media Gallery */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
            <MediaGalleryEditor
              title="3. Main Image & Additional Gallery Images"
              coverBadgeLabel="Main Image"
              images={images}
              onChange={setImages}
              onRemoveUrl={(url) => setRemovedUrls((prev) => [...prev, url])}
              onUploadFiles={async (files) => {
                const targetId = editingProperty?.propertyId || `prop-temp-${Date.now()}`;
                const results = await Promise.all(
                  files.map((file) => uploadPropertyPhoto(file, targetId))
                );
                return results.map((r) => r.url);
              }}
            />
          </div>

          {/* Section 4: Relationships & Location */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#C6A878]" />
              <span>4. Relationships, Address &amp; Map Coordinates</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Building Selection
                </label>
                <select
                  value={buildingId}
                  onChange={handleBuildingSelect}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="">-- Choose Existing Building or Standalone --</option>
                  {buildings.map((b) => (
                    <option key={b.buildingId} value={b.buildingId}>
                      {b.buildingName} ({b.location})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Neighborhood &amp; Area *
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value as PropertyLocation)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Complete Street Address *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Luzon Ave, Cebu Business Park, Cebu City"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Latitude (Optional)
                  </label>
                  <input
                    type="text"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 10.3173"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Longitude (Optional)
                  </label>
                  <input
                    type="text"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 123.9054"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Google Maps Link (Optional)
                </label>
                <input
                  type="url"
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 5: SEO */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#C6A878]" />
              <span>5. Search Engine Optimization (SEO)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  URL Slug (Auto-generated if blank)
                </label>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  placeholder="e.g. the-alcoves-skyline-suite-18b"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  SEO Title Override
                </label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Optional custom meta title"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  SEO Meta Description
                </label>
                <input
                  type="text"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Optional concise search description for social & search snippets"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 6: Publishing Footer */}
        <div className="px-4 sm:px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 flex-shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 min-h-[42px] rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 font-semibold whitespace-nowrap"
            >
              Cancel
            </button>
            {onPreview && (
              <button
                type="button"
                onClick={() => {
                  const previewDoc = buildPropertyPayload(
                    editingProperty?.status || (isSuperAdmin ? 'approved' : 'draft')
                  );
                  if (previewDoc) onPreview(previewDoc);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl border border-slate-300 text-[#17243B] hover:bg-slate-50 font-semibold whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(isSuperAdmin || actingAsEditor) && editingProperty && editingProperty.status !== 'archived' && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSave('archived')}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold whitespace-nowrap disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive</span>
              </button>
            )}

            {(isSuperAdmin || actingAsEditor) && editingProperty && editingProperty.status === 'archived' && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  handleSave(editingProperty.previousStatus || 'draft')
                }
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold whitespace-nowrap disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            )}

            {(isSuperAdmin ||
              (actingAsEditor && (!editingProperty || editingProperty.status === 'draft')) ||
              (!actingAsEditor && (!editingProperty || editingProperty.status !== 'approved'))) && (
              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={isSaving}
                className="px-4 min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isSuperAdmin && editingProperty?.status === 'approved'
                  ? 'Unpublish (Draft)'
                  : 'Save as Draft'}
              </button>
            )}

            {isSuperAdmin ? (
              <button
                type="button"
                onClick={() => handleSave('approved')}
                disabled={isSaving}
                className="px-5 min-h-[42px] rounded-xl bg-[#17243B] hover:bg-[#203250] text-[#C6A878] font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{isSaving ? 'Publishing...' : 'Publish Live (Approved)'}</span>
              </button>
            ) : actingAsEditor && editingProperty && editingProperty.status !== 'draft' ? (
              editingProperty.status !== 'archived' && (
                <button
                  type="button"
                  onClick={() => handleSave(editingProperty.status)}
                  disabled={isSaving}
                  className="px-5 min-h-[42px] rounded-xl bg-[#17243B] hover:bg-[#203250] text-[#C6A878] font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{isSaving ? 'Saving...' : 'Save Content Updates'}</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => handleSave('pending')}
                disabled={isSaving}
                className="px-5 min-h-[42px] rounded-xl bg-[#17243B] hover:bg-[#203250] text-[#C6A878] font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>
                  {isSaving
                    ? 'Saving...'
                    : !actingAsEditor && editingProperty && editingProperty.status === 'approved'
                    ? 'Submit Changes for Review'
                    : 'Submit for Approval'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
