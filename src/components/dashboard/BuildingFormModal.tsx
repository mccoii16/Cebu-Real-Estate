import React, { useEffect, useState } from 'react';
import {
  X,
  Building,
  AlertCircle,
  Check,
  Eye,
  Archive,
  RotateCcw,
  Globe,
  MapPin,
  FileText,
} from 'lucide-react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  BuildingDoc,
  ContentPublishStatus,
  LocationHighlight,
} from '../../types/property';
import { MediaGalleryEditor } from './MediaGalleryEditor';
import { uploadBuildingPhoto, deleteUnreferencedStorageImages } from '../../services/storageService';
import { ensureUniqueSlug } from '../../utils/slugs';
import { isDuplicateBuildingName } from '../../utils/filterProperties';
import {
  findOrphanedRemovedImages,
  getEffectivePublishStatus,
  parseCommaList,
  validateBuildingForm,
} from '../../utils/contentManagement';
import {
  computeBuildingChangedFields,
  inferAuditAction,
} from '../../utils/editorPermissions';
import { recordAuditLog } from '../../services/auditLogService';
import { useAuth } from '../../context/AuthContext';

interface BuildingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingBuilding: BuildingDoc | null;
  existingBuildings: BuildingDoc[];
  locations: LocationHighlight[];
  otherReferencedImageUrls: Set<string>;
  onSaved: (building: BuildingDoc) => void;
  onPreview?: (building: BuildingDoc) => void;
  isEditor?: boolean;
}

export const BuildingFormModal: React.FC<BuildingFormModalProps> = ({
  isOpen,
  onClose,
  editingBuilding,
  existingBuildings,
  locations,
  otherReferencedImageUrls,
  onSaved,
  onPreview,
  isEditor = false,
}) => {
  const { user, profile, isSuperAdmin, isEditor: ctxIsEditor } = useAuth();
  const actingAsEditor = Boolean((isEditor || ctxIsEditor) && !isSuperAdmin);
  const [buildingName, setBuildingName] = useState('');
  const [developer, setDeveloper] = useState('');
  const [buildingType, setBuildingType] = useState('Residential Condominium');
  const [yearCompleted, setYearCompleted] = useState('');
  const [totalFloors, setTotalFloors] = useState('');
  const [description, setDescription] = useState('');
  const [amenitiesText, setAmenitiesText] = useState('');
  const [facilitiesText, setFacilitiesText] = useState('');
  const [landmarksText, setLandmarksText] = useState('');
  const [location, setLocation] = useState('Cebu Business Park');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [status, setStatus] = useState<ContentPublishStatus>('published');
  const [images, setImages] = useState<string[]>(['/assets/extracted/the_alcoves.png']);
  const [removedUrls, setRemovedUrls] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setRemovedUrls([]);
    if (editingBuilding) {
      setBuildingName(editingBuilding.buildingName || '');
      setDeveloper(editingBuilding.developer || '');
      setBuildingType(editingBuilding.buildingType || 'Residential Condominium');
      setYearCompleted(
        editingBuilding.yearCompleted ? String(editingBuilding.yearCompleted) : ''
      );
      setTotalFloors(editingBuilding.totalFloors ? String(editingBuilding.totalFloors) : '');
      setDescription(editingBuilding.description || '');
      setAmenitiesText((editingBuilding.amenities || []).join(', '));
      setFacilitiesText((editingBuilding.facilities || []).join(', '));
      setLandmarksText((editingBuilding.nearbyLandmarks || []).join(', '));
      setLocation(editingBuilding.location || locations[0]?.name || 'Cebu Business Park');
      setAddress(editingBuilding.address || '');
      setLatitude(
        editingBuilding.latitude !== null && editingBuilding.latitude !== undefined
          ? String(editingBuilding.latitude)
          : ''
      );
      setLongitude(
        editingBuilding.longitude !== null && editingBuilding.longitude !== undefined
          ? String(editingBuilding.longitude)
          : ''
      );
      setMapUrl(editingBuilding.mapUrl || '');
      setSlug(editingBuilding.slug || '');
      setSeoTitle(editingBuilding.seoTitle || '');
      setSeoDescription(editingBuilding.seoDescription || '');
      setStatus(getEffectivePublishStatus(editingBuilding));
      setImages(
        editingBuilding.buildingImages && editingBuilding.buildingImages.length > 0
          ? editingBuilding.buildingImages
          : ['/assets/extracted/the_alcoves.png']
      );
    } else {
      setBuildingName('');
      setDeveloper('');
      setBuildingType('Residential Condominium');
      setYearCompleted('');
      setTotalFloors('');
      setDescription('');
      setAmenitiesText('24/7 Concierge, Swimming Pool, Fitness Gym, Sky Lounge');
      setFacilitiesText('High-Speed Elevators, Basement Parking, Backup Power');
      setLandmarksText('');
      setLocation(locations[0]?.name || 'Cebu Business Park');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setMapUrl('');
      setSlug('');
      setSeoTitle('');
      setSeoDescription('');
      setStatus('published');
      setImages(['/assets/extracted/the_alcoves.png']);
    }
  }, [isOpen, editingBuilding, locations]);

  if (!isOpen) return null;

  const locationOptions = Array.from(
    new Set([
      ...locations.map((l) => l.name),
      'Cebu Business Park',
      'Cebu IT Park',
      'Mactan Newtown',
      'Banilad',
      'Lahug',
      'SRP',
      'Mandaue',
      'Lapu-Lapu City',
      ...(location ? [location] : []),
    ])
  );

  const buildPayload = (targetStatus: ContentPublishStatus): BuildingDoc | null => {
    if (isDuplicateBuildingName(existingBuildings, buildingName, editingBuilding?.buildingId)) {
      setErrorMessage(`A building named "${buildingName.trim()}" already exists.`);
      return null;
    }

    const validation = validateBuildingForm({
      buildingName,
      location,
      images,
      yearCompletedStr: yearCompleted,
      totalFloorsStr: totalFloors,
      latitudeStr: latitude,
      longitudeStr: longitude,
      mapUrl,
    });
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Please review the building fields.');
      return null;
    }

    const bldId = editingBuilding?.buildingId || `bld-${Date.now()}`;
    const now = new Date().toISOString();
    const computedSlug = ensureUniqueSlug(
      slug.trim() || buildingName.trim(),
      existingBuildings.map((b) => ({
        id: b.buildingId,
        slug: b.slug,
        fallbackName: b.buildingName,
      })),
      editingBuilding?.buildingId,
      'building'
    );

    const priorStatus = editingBuilding ? getEffectivePublishStatus(editingBuilding) : null;
    const previousNonArchive: 'published' | 'unpublished' | null =
      targetStatus === 'archived'
        ? priorStatus && priorStatus !== 'archived'
          ? priorStatus
          : editingBuilding?.previousStatus || 'unpublished'
        : null;

    return {
      buildingId: bldId,
      slug: computedSlug,
      buildingName: buildingName.trim(),
      location: location.trim(),
      address: address.trim(),
      description: description.trim() || 'A premier residential development in Cebu.',
      developer: developer.trim(),
      buildingType: buildingType.trim(),
      yearCompleted: validation.yearCompleted,
      totalFloors: validation.totalFloors,
      buildingImages: images,
      amenities: parseCommaList(amenitiesText),
      facilities: parseCommaList(facilitiesText),
      nearbyLandmarks: parseCommaList(landmarksText),
      latitude: validation.latitude,
      longitude: validation.longitude,
      mapUrl: mapUrl.trim(),
      seoTitle: seoTitle.trim(),
      seoDescription: seoDescription.trim(),
      status: targetStatus,
      previousStatus: previousNonArchive,
      archivedAt: targetStatus === 'archived' ? editingBuilding?.archivedAt || now : null,
      createdAt: editingBuilding?.createdAt || now,
      updatedAt: now,
      ...(user ? { lastModifiedByUid: user.uid, lastModifiedByEmail: user.email || '' } : {}),
    };
  };

  const handlePersist = async (targetStatus: ContentPublishStatus) => {
    setErrorMessage(null);
    const payload = buildPayload(targetStatus);
    if (!payload) return;

    setIsSaving(true);
    try {
      if (editingBuilding) {
        await updateDoc(doc(db, 'buildings', payload.buildingId), payload as any);
      } else {
        await setDoc(doc(db, 'buildings', payload.buildingId), payload);
      }

      if (!actingAsEditor) {
        const previousImages = [...(editingBuilding?.buildingImages || []), ...removedUrls];
        const orphaned = findOrphanedRemovedImages(
          previousImages,
          payload.buildingImages,
          otherReferencedImageUrls
        );
        if (orphaned.length > 0) {
          await deleteUnreferencedStorageImages(orphaned, otherReferencedImageUrls);
        }
      }

      if (actingAsEditor || isSuperAdmin) {
        const changedFields = computeBuildingChangedFields(editingBuilding, payload);
        const beforeStatus = editingBuilding ? getEffectivePublishStatus(editingBuilding) : null;
        await recordAuditLog({
          user,
          editorEmail: user?.email || undefined,
          editorName: profile?.displayName || undefined,
          editorRole: isSuperAdmin ? 'superadmin' : 'editor',
          contentType: 'building',
          contentId: payload.buildingId,
          contentTitle: payload.buildingName,
          action: inferAuditAction(!editingBuilding, beforeStatus, payload.status),
          changedFields,
        });
      }

      onSaved(payload);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save building.');
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
        <div className="px-5 sm:px-6 py-4 bg-[#17243B] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C6A878]/20 border border-[#C6A878]/30 flex items-center justify-center text-[#C6A878]">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-serif text-white">
                {editingBuilding ? 'Edit Building Development' : 'Create Building Development'}
              </h2>
              <p className="text-xs text-white/70">
                Manage full architecture specs, gallery, coordinates, SEO metadata, and publishing status.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close building modal"
            className="w-8 h-8 rounded-full border border-white/20 text-white/75 hover:text-white hover:bg-white/10 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-[#F8F7F3] text-xs">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Basic Information */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3.5">
            <h3 className="text-xs font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-[#C6A878]" />
              <span>Basic Information</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Building Name *</label>
                <input
                  type="text"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  placeholder="e.g. 38 Park Avenue"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Developer</label>
                <input
                  type="text"
                  value={developer}
                  onChange={(e) => setDeveloper(e.target.value)}
                  placeholder="e.g. Cebu Landmasters"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Building Type</label>
                <input
                  type="text"
                  value={buildingType}
                  onChange={(e) => setBuildingType(e.target.value)}
                  placeholder="e.g. Residential Condominium"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Year Completed</label>
                  <input
                    type="number"
                    value={yearCompleted}
                    onChange={(e) => setYearCompleted(e.target.value)}
                    placeholder="e.g. 2024"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Number of Floors</label>
                  <input
                    type="number"
                    value={totalFloors}
                    onChange={(e) => setTotalFloors(e.target.value)}
                    placeholder="e.g. 38"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Details */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3.5">
            <h3 className="text-xs font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C6A878]" />
              <span>Details, Amenities &amp; Landmarks</span>
            </h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Building Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Architectural vision, signature offerings, and lifestyle details..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amenities (comma-separated)</label>
                <textarea
                  rows={2}
                  value={amenitiesText}
                  onChange={(e) => setAmenitiesText(e.target.value)}
                  placeholder="Infinity Pool, Sky Lounge, Fitness Gym"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Facilities (comma-separated)</label>
                <textarea
                  rows={2}
                  value={facilitiesText}
                  onChange={(e) => setFacilitiesText(e.target.value)}
                  placeholder="24/7 Security, Fiber Ready, Backup Power"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nearby Landmarks (comma-separated)</label>
                <textarea
                  rows={2}
                  value={landmarksText}
                  onChange={(e) => setLandmarksText(e.target.value)}
                  placeholder="Ayala Malls Central Bloc, Sugbo Mercado"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Media */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200">
            <MediaGalleryEditor
              title="Building Cover & Gallery Images"
              coverBadgeLabel="Cover Image"
              images={images}
              onChange={setImages}
              onRemoveUrl={(url) => setRemovedUrls((prev) => [...prev, url])}
              onUploadFiles={async (files) => {
                const targetId = editingBuilding?.buildingId || `draft-${Date.now()}`;
                const results = await Promise.all(
                  files.map((file) => uploadBuildingPhoto(file, targetId))
                );
                return results.map((r) => r.url);
              }}
            />
          </div>

          {/* 4. Location & Map */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3.5">
            <h3 className="text-xs font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#C6A878]" />
              <span>Location &amp; Coordinates</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Neighborhood &amp; Area *</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Complete Street Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Jose Maria del Mar St, Cebu IT Park"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Latitude (Optional)</label>
                  <input
                    type="text"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 10.3304"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Longitude (Optional)</label>
                  <input
                    type="text"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 123.9056"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Google Maps URL (Optional)</label>
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

          {/* 5. SEO & Publishing */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3.5">
            <h3 className="text-xs font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#C6A878]" />
              <span>SEO &amp; Visibility Status</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">URL Slug (Auto-generated if blank)</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. 38-park-avenue"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Publication Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ContentPublishStatus)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
                >
                  <option value="published">Published (Live on Website)</option>
                  <option value="unpublished">Unpublished (Hidden Draft)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SEO Meta Title</label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Optional custom search title"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SEO Meta Description</label>
                <input
                  type="text"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Optional concise search description"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
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
                  const payload = buildPayload(status);
                  if (payload) onPreview(payload);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl border border-slate-300 text-[#17243B] hover:bg-slate-50 font-semibold whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editingBuilding && status !== 'archived' && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handlePersist('archived')}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold whitespace-nowrap disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive</span>
              </button>
            )}
            {editingBuilding && status === 'archived' && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handlePersist(editingBuilding.previousStatus || 'unpublished')}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold whitespace-nowrap disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            )}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handlePersist(status)}
              className="inline-flex items-center gap-1.5 px-4 min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold whitespace-nowrap disabled:opacity-50"
            >
              <span>Save Changes</span>
            </button>
            {status !== 'published' && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handlePersist('published')}
                className="inline-flex items-center gap-1.5 px-5 min-h-[42px] rounded-xl bg-[#17243B] hover:bg-[#253754] text-[#C6A878] font-bold shadow-sm whitespace-nowrap disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Publishing...' : 'Publish Live'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
