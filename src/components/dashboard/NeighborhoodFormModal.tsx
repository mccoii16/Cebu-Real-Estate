import React, { useEffect, useState } from 'react';
import {
  X,
  Compass,
  AlertCircle,
  Check,
  Eye,
  Archive,
  RotateCcw,
  Globe,
  MapPin,
  FileText,
} from 'lucide-react';
import {
  ContentPublishStatus,
  LocationHighlight,
  PropertyDoc,
} from '../../types/property';
import { MediaGalleryEditor } from './MediaGalleryEditor';
import { saveLocation } from '../../services/locationService';
import {
  uploadNeighborhoodPhoto,
  deleteUnreferencedStorageImages,
} from '../../services/storageService';
import { ensureUniqueSlug, matchesNeighborhoodName } from '../../utils/slugs';
import {
  findOrphanedRemovedImages,
  getEffectivePublishStatus,
  parseCommaList,
  validateNeighborhoodForm,
} from '../../utils/contentManagement';
import {
  computeNeighborhoodChangedFields,
  inferAuditAction,
} from '../../utils/editorPermissions';
import { recordAuditLog } from '../../services/auditLogService';
import { useAuth } from '../../context/AuthContext';

interface NeighborhoodFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLocation: LocationHighlight | null;
  existingLocations: LocationHighlight[];
  properties: PropertyDoc[];
  otherReferencedImageUrls: Set<string>;
  onSaved: (location: LocationHighlight) => void;
  onPreview?: (location: LocationHighlight) => void;
  isEditor?: boolean;
}

export const NeighborhoodFormModal: React.FC<NeighborhoodFormModalProps> = ({
  isOpen,
  onClose,
  editingLocation,
  existingLocations,
  properties,
  otherReferencedImageUrls,
  onSaved,
  onPreview,
  isEditor = false,
}) => {
  const { user, profile, isSuperAdmin, isEditor: ctxIsEditor } = useAuth();
  const actingAsEditor = Boolean((isEditor || ctxIsEditor) && !isSuperAdmin);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [cityOrMunicipality, setCityOrMunicipality] = useState('Cebu City');
  const [description, setDescription] = useState('');
  const [highlightsText, setHighlightsText] = useState('');
  const [landmarksText, setLandmarksText] = useState('');
  const [lifestyleInfo, setLifestyleInfo] = useState('');
  const [transportationInfo, setTransportationInfo] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [status, setStatus] = useState<ContentPublishStatus>('published');
  const [images, setImages] = useState<string[]>(['/assets/extracted/loc_cebu_business_park.png']);
  const [removedUrls, setRemovedUrls] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setRemovedUrls([]);

    if (editingLocation) {
      setName(editingLocation.name || '');
      setTagline(editingLocation.tagline || '');
      setCityOrMunicipality(editingLocation.cityOrMunicipality || '');
      setDescription(editingLocation.description || '');
      setHighlightsText((editingLocation.highlights || []).join(', '));
      setLandmarksText((editingLocation.nearbyLandmarks || []).join(', '));
      setLifestyleInfo(editingLocation.lifestyleInfo || '');
      setTransportationInfo(editingLocation.transportationInfo || '');
      setLatitude(
        editingLocation.latitude !== null && editingLocation.latitude !== undefined
          ? String(editingLocation.latitude)
          : ''
      );
      setLongitude(
        editingLocation.longitude !== null && editingLocation.longitude !== undefined
          ? String(editingLocation.longitude)
          : ''
      );
      setMapUrl(editingLocation.mapUrl || '');
      setSlug(editingLocation.slug || '');
      setSeoTitle(editingLocation.seoTitle || '');
      setSeoDescription(editingLocation.seoDescription || '');
      setStatus(getEffectivePublishStatus(editingLocation));
      const combined = [
        editingLocation.image,
        ...(editingLocation.galleryImages || []),
      ].filter(Boolean);
      setImages(combined.length > 0 ? combined : ['/assets/extracted/loc_cebu_business_park.png']);
    } else {
      setName('');
      setTagline('');
      setCityOrMunicipality('Cebu City');
      setDescription('');
      setHighlightsText('');
      setLandmarksText('');
      setLifestyleInfo('');
      setTransportationInfo('');
      setLatitude('');
      setLongitude('');
      setMapUrl('');
      setSlug('');
      setSeoTitle('');
      setSeoDescription('');
      setStatus('published');
      setImages(['/assets/extracted/loc_cebu_business_park.png']);
    }
  }, [isOpen, editingLocation]);

  if (!isOpen) return null;

  const buildPayload = (targetStatus: ContentPublishStatus): LocationHighlight | null => {
    const duplicate = existingLocations.find(
      (loc) =>
        loc.id !== editingLocation?.id &&
        loc.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) {
      setErrorMessage(`A neighborhood named "${name.trim()}" already exists.`);
      return null;
    }

    const validation = validateNeighborhoodForm({
      name,
      images,
      latitudeStr: latitude,
      longitudeStr: longitude,
      mapUrl,
    });
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Please review neighborhood fields.');
      return null;
    }

    const locId = editingLocation?.id || `loc-${Date.now()}`;
    const now = new Date().toISOString();
    const computedSlug = ensureUniqueSlug(
      slug.trim() || name.trim(),
      existingLocations.map((l) => ({
        id: l.id,
        slug: l.slug,
        fallbackName: l.name,
      })),
      editingLocation?.id,
      'neighborhood'
    );

    const priorStatus = editingLocation ? getEffectivePublishStatus(editingLocation) : null;
    const previousNonArchive: 'published' | 'unpublished' | null =
      targetStatus === 'archived'
        ? priorStatus && priorStatus !== 'archived'
          ? priorStatus
          : editingLocation?.previousStatus || 'unpublished'
        : null;

    const matchingCount = properties.filter(
      (p) => p.status === 'approved' && matchesNeighborhoodName(p.location, name.trim())
    ).length;

    return {
      id: locId,
      slug: computedSlug,
      name: name.trim(),
      tagline: tagline.trim() || 'Premier Real Estate District',
      propertyCount: matchingCount || editingLocation?.propertyCount || 0,
      image: images[0],
      galleryImages: images.slice(1),
      description:
        description.trim() || 'Desirable neighborhood with premier residential developments.',
      cityOrMunicipality: cityOrMunicipality.trim(),
      highlights: parseCommaList(highlightsText),
      nearbyLandmarks: parseCommaList(landmarksText),
      lifestyleInfo: lifestyleInfo.trim(),
      transportationInfo: transportationInfo.trim(),
      latitude: validation.latitude,
      longitude: validation.longitude,
      mapUrl: mapUrl.trim(),
      seoTitle: seoTitle.trim(),
      seoDescription: seoDescription.trim(),
      status: targetStatus,
      previousStatus: previousNonArchive,
      archivedAt: targetStatus === 'archived' ? editingLocation?.archivedAt || now : null,
      createdAt: editingLocation?.createdAt || now,
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
      await saveLocation(payload);

      if (!actingAsEditor) {
        const previousImages = [
          ...(editingLocation ? [editingLocation.image, ...(editingLocation.galleryImages || [])] : []),
          ...removedUrls,
        ].filter(Boolean);
        const nextImages = [payload.image, ...(payload.galleryImages || [])].filter(Boolean);
        const orphaned = findOrphanedRemovedImages(
          previousImages,
          nextImages,
          otherReferencedImageUrls
        );
        if (orphaned.length > 0) {
          await deleteUnreferencedStorageImages(orphaned, otherReferencedImageUrls);
        }
      }

      if (actingAsEditor || isSuperAdmin) {
        const changedFields = computeNeighborhoodChangedFields(editingLocation, payload);
        const beforeStatus = editingLocation ? getEffectivePublishStatus(editingLocation) : null;
        await recordAuditLog({
          user,
          editorEmail: user?.email || undefined,
          editorName: profile?.displayName || undefined,
          editorRole: isSuperAdmin ? 'superadmin' : 'editor',
          contentType: 'neighborhood',
          contentId: payload.id,
          contentTitle: payload.name,
          action: inferAuditAction(!editingLocation, beforeStatus, payload.status),
          changedFields,
        });
      }

      onSaved(payload);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save neighborhood.');
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
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-serif text-white">
                {editingLocation ? 'Edit Neighborhood & Area' : 'Add Neighborhood & Area'}
              </h2>
              <p className="text-xs text-white/70">
                Manage area guide details, cover &amp; gallery images, lifestyle, transit, SEO, and publication state.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close neighborhood modal"
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
              <Compass className="w-4 h-4 text-[#C6A878]" />
              <span>Basic Information</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Area Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cebu Business Park"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Overview Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Premier Financial District"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">City or Municipality</label>
                <input
                  type="text"
                  value={cityOrMunicipality}
                  onChange={(e) => setCityOrMunicipality(e.target.value)}
                  placeholder="e.g. Cebu City"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 2. Details */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3.5">
            <h3 className="text-xs font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C6A878]" />
              <span>Editorial Guide, Highlights &amp; Lifestyle</span>
            </h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Detailed Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Comprehensive overview of the neighborhood character and investment appeal..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Key Highlights (comma-separated)
                </label>
                <input
                  type="text"
                  value={highlightsText}
                  onChange={(e) => setHighlightsText(e.target.value)}
                  placeholder="Walkable parks, Luxury retail, Corporate hubs"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nearby Landmarks (comma-separated)
                </label>
                <input
                  type="text"
                  value={landmarksText}
                  onChange={(e) => setLandmarksText(e.target.value)}
                  placeholder="Ayala Center Cebu, Chong Hua Hospital"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lifestyle &amp; Community Information
                </label>
                <textarea
                  rows={2}
                  value={lifestyleInfo}
                  onChange={(e) => setLifestyleInfo(e.target.value)}
                  placeholder="Fine dining, green promenades, vibrant executive community..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Transportation Information
                </label>
                <textarea
                  rows={2}
                  value={transportationInfo}
                  onChange={(e) => setTransportationInfo(e.target.value)}
                  placeholder="25 mins to MCIA Airport, dedicated P2P routes, main arterial roads..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Media */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200">
            <MediaGalleryEditor
              title="Cover & Gallery Images"
              coverBadgeLabel="Cover Image"
              images={images}
              onChange={setImages}
              onRemoveUrl={(url) => setRemovedUrls((prev) => [...prev, url])}
              onUploadFiles={async (files) => {
                const targetId = editingLocation?.id || `draft-${Date.now()}`;
                const results = await Promise.all(
                  files.map((file) => uploadNeighborhoodPhoto(file, targetId))
                );
                return results.map((r) => r.url);
              }}
            />
          </div>

          {/* 4. Map Coordinates */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3.5">
            <h3 className="text-xs font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#C6A878]" />
              <span>Map Coordinates</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Latitude (Optional)</label>
                <input
                  type="text"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="e.g. 10.3173"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Longitude (Optional)</label>
                <input
                  type="text"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g. 123.9054"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono"
                />
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
                  placeholder="e.g. cebu-business-park"
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

        {/* Footer */}
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
            {editingLocation && status !== 'archived' && (
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
            {editingLocation && status === 'archived' && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handlePersist(editingLocation.previousStatus || 'unpublished')}
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
