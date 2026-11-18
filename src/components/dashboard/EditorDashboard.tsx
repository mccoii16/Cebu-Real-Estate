import React, { useEffect, useMemo, useState } from 'react';
import {
  FileEdit,
  Building,
  Layers,
  MapPin,
  Search,
  Plus,
  Edit,
  Eye,
  LogOut,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  EyeOff,
  Archive,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles,
  X,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  BuildingDoc,
  ContentPublishStatus,
  LocationHighlight,
  PropertyDoc,
} from '../../types/property';
import { useAuth } from '../../context/AuthContext';
import { AddPropertyModal } from './AddPropertyModal';
import { BuildingFormModal } from './BuildingFormModal';
import { NeighborhoodFormModal } from './NeighborhoodFormModal';
import { ContentPreviewModal } from './ContentPreviewModal';
import { saveLocation, INITIAL_LOCATIONS } from '../../services/locationService';
import { recordAuditLog } from '../../services/auditLogService';
import {
  collectAllReferencedImageUrls,
  getEffectivePublishStatus,
} from '../../utils/contentManagement';
import {
  computeEditorMetrics,
  inferAuditAction,
  validateEditorPropertyUpdate,
} from '../../utils/editorPermissions';
import { paginateItems } from '../../utils/filterProperties';
import { matchesNeighborhoodName } from '../../utils/slugs';

interface EditorDashboardProps {
  properties: PropertyDoc[];
  buildings: BuildingDoc[];
  locations?: LocationHighlight[];
  onPropertyUpdated: (property: PropertyDoc) => void;
  onBuildingAdded: (building: BuildingDoc) => void;
  onLocationsUpdated?: (locations: LocationHighlight[]) => void;
  onViewPublicSite: () => void;
  onSelectPropertyPreview: (property: PropertyDoc) => void;
  onOpenPublicPath?: (path: string) => void;
}

export type EditorSection = 'overview' | 'properties' | 'buildings' | 'locations';

export const EditorDashboard: React.FC<EditorDashboardProps> = ({
  properties,
  buildings,
  locations,
  onPropertyUpdated,
  onBuildingAdded,
  onLocationsUpdated,
  onViewPublicSite,
  onSelectPropertyPreview,
  onOpenPublicPath,
}) => {
  const { user, profile, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<EditorSection>('overview');

  const [actionNotice, setActionNotice] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  const [contentPreview, setContentPreview] = useState<
    | { type: 'property'; item: PropertyDoc }
    | { type: 'building'; item: BuildingDoc }
    | { type: 'neighborhood'; item: LocationHighlight }
    | null
  >(null);

  // Properties state
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<
    'all' | 'approved' | 'pending' | 'rejected' | 'draft' | 'archived'
  >('all');
  const [editorPropsPage, setEditorPropsPage] = useState(1);
  const [editingProperty, setEditingProperty] = useState<PropertyDoc | null>(null);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);

  // Buildings state
  const [isAddBuildingOpen, setIsAddBuildingOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<BuildingDoc | null>(null);
  const [buildingStatusFilter, setBuildingStatusFilter] = useState<
    'all' | 'published' | 'unpublished' | 'archived'
  >('all');
  const [viewingBuildingProperties, setViewingBuildingProperties] =
    useState<BuildingDoc | null>(null);

  // Neighborhood & Areas state
  const [locationsList, setLocationsList] = useState<LocationHighlight[]>(
    locations && locations.length > 0 ? locations : INITIAL_LOCATIONS
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationHighlight | null>(null);
  const [locationStatusFilter, setLocationStatusFilter] = useState<
    'all' | 'published' | 'unpublished' | 'archived'
  >('all');

  useEffect(() => {
    if (locations && locations.length > 0) {
      setLocationsList(locations);
    }
  }, [locations]);

  useEffect(() => {
    setEditorPropsPage(1);
  }, [propertySearch, propertyStatusFilter]);

  const metrics = useMemo(
    () => computeEditorMetrics(properties, buildings, locationsList, 10),
    [properties, buildings, locationsList]
  );

  const getOtherReferencedUrls = (exclude?: {
    propertyId?: string;
    buildingId?: string;
    locationId?: string;
  }) =>
    collectAllReferencedImageUrls({
      properties: properties.filter((p) => p.propertyId !== exclude?.propertyId),
      buildings: buildings.filter((b) => b.buildingId !== exclude?.buildingId),
      locations: locationsList.filter((l) => l.id !== exclude?.locationId),
    });

  // Editor-only Property Archive / Restore (never approve/reject/delete)
  const handleArchiveOrRestoreProperty = async (
    property: PropertyDoc,
    targetMode: 'archive' | 'restore'
  ) => {
    setActionNotice(null);
    const now = new Date().toISOString();
    const targetStatus =
      targetMode === 'archive' ? 'archived' : property.previousStatus || 'draft';

    const nextDoc: PropertyDoc = {
      ...property,
      status: targetStatus,
      previousStatus: targetMode === 'archive' ? property.status === 'archived' ? property.previousStatus || 'draft' : property.status : null,
      archivedAt: targetMode === 'archive' ? property.archivedAt || now : null,
      updatedAt: now,
      lastModifiedByUid: user?.uid,
      lastModifiedByEmail: user?.email || '',
    };

    const validation = validateEditorPropertyUpdate(property, nextDoc);
    if (!validation.valid) {
      setActionNotice({
        type: 'error',
        text: validation.reason || 'This status transition is not permitted for Editors.',
      });
      return;
    }

    try {
      await updateDoc(doc(db, 'properties', property.propertyId), {
        status: nextDoc.status,
        previousStatus: nextDoc.previousStatus,
        archivedAt: nextDoc.archivedAt,
        updatedAt: now,
        lastModifiedByUid: user?.uid,
        lastModifiedByEmail: user?.email || '',
      });

      await recordAuditLog({
        user,
        editorEmail: user?.email || undefined,
        editorName: profile?.displayName || undefined,
        editorRole: 'editor',
        contentType: 'property',
        contentId: property.propertyId,
        contentTitle: property.propertyTitle,
        action: targetMode === 'archive' ? 'archive' : 'restore',
        changedFields: ['status'],
      });

      onPropertyUpdated(nextDoc);
      setActionNotice({
        type: 'success',
        text:
          targetMode === 'archive'
            ? `Property "${property.propertyTitle}" moved to Archive.`
            : `Property "${property.propertyTitle}" restored to ${targetStatus}.`,
      });
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: `Failed to update property: ${err?.message || 'Permission denied'}`,
      });
    }
  };

  // Building Publish / Unpublish / Archive / Restore (no deletion)
  const handleChangeBuildingStatus = async (
    bld: BuildingDoc,
    targetStatus: ContentPublishStatus
  ) => {
    setActionNotice(null);
    try {
      const now = new Date().toISOString();
      const prior = getEffectivePublishStatus(bld);
      const updatedDoc: BuildingDoc = {
        ...bld,
        status: targetStatus,
        previousStatus:
          targetStatus === 'archived'
            ? prior !== 'archived'
              ? prior
              : bld.previousStatus || 'unpublished'
            : null,
        archivedAt: targetStatus === 'archived' ? bld.archivedAt || now : null,
        updatedAt: now,
        lastModifiedByUid: user?.uid,
        lastModifiedByEmail: user?.email || '',
      };

      await updateDoc(doc(db, 'buildings', bld.buildingId), updatedDoc as any);

      await recordAuditLog({
        user,
        editorEmail: user?.email || undefined,
        editorName: profile?.displayName || undefined,
        editorRole: 'editor',
        contentType: 'building',
        contentId: bld.buildingId,
        contentTitle: bld.buildingName,
        action: inferAuditAction(false, prior, targetStatus),
        changedFields: ['status'],
      });

      onBuildingAdded(updatedDoc);
      setActionNotice({
        type: 'success',
        text: `Building "${bld.buildingName}" updated to ${targetStatus}.`,
      });
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: `Could not update building: ${err?.message || 'Permission denied'}`,
      });
    }
  };

  // Neighborhood Publish / Unpublish / Archive / Restore (no deletion)
  const handleChangeLocationStatus = async (
    loc: LocationHighlight,
    targetStatus: ContentPublishStatus
  ) => {
    setActionNotice(null);
    try {
      const now = new Date().toISOString();
      const prior = getEffectivePublishStatus(loc);
      const updatedLoc: LocationHighlight = {
        ...loc,
        status: targetStatus,
        previousStatus:
          targetStatus === 'archived'
            ? prior !== 'archived'
              ? prior
              : loc.previousStatus || 'unpublished'
            : null,
        archivedAt: targetStatus === 'archived' ? loc.archivedAt || now : null,
        updatedAt: now,
        lastModifiedByUid: user?.uid,
        lastModifiedByEmail: user?.email || '',
      };

      await saveLocation(updatedLoc);

      await recordAuditLog({
        user,
        editorEmail: user?.email || undefined,
        editorName: profile?.displayName || undefined,
        editorRole: 'editor',
        contentType: 'neighborhood',
        contentId: loc.id,
        contentTitle: loc.name,
        action: inferAuditAction(false, prior, targetStatus),
        changedFields: ['status'],
      });

      const updatedList = locationsList.map((item) =>
        item.id === loc.id ? updatedLoc : item
      );
      setLocationsList(updatedList);
      if (onLocationsUpdated) onLocationsUpdated(updatedList);
      setActionNotice({
        type: 'success',
        text: `Neighborhood "${loc.name}" marked as ${targetStatus}.`,
      });
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: `Could not update neighborhood: ${err?.message || 'Permission denied'}`,
      });
    }
  };

  const handleSavedLocation = (savedLoc: LocationHighlight) => {
    const exists = locationsList.some((l) => l.id === savedLoc.id);
    const updatedList = exists
      ? locationsList.map((item) => (item.id === savedLoc.id ? savedLoc : item))
      : [...locationsList, savedLoc];
    setLocationsList(updatedList);
    if (onLocationsUpdated) onLocationsUpdated(updatedList);
    setActionNotice({
      type: 'success',
      text: `Neighborhood "${savedLoc.name}" saved (${getEffectivePublishStatus(savedLoc)}).`,
    });
  };

  const handleOpenRecentItem = (item: {
    id: string;
    contentType: 'property' | 'building' | 'neighborhood';
  }) => {
    if (item.contentType === 'property') {
      const prop = properties.find((p) => p.propertyId === item.id);
      if (prop) {
        setEditingProperty(prop);
        setIsAddPropertyOpen(true);
      }
    } else if (item.contentType === 'building') {
      const bld = buildings.find((b) => b.buildingId === item.id);
      if (bld) {
        setEditingBuilding(bld);
        setIsAddBuildingOpen(true);
      }
    } else {
      const loc = locationsList.find((l) => l.id === item.id);
      if (loc) {
        setEditingLocation(loc);
        setIsLocationModalOpen(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F3] flex flex-col selection:bg-[#C6A878]/30">
      {/* Top Navbar */}
      <header className="bg-[#17243B] text-white px-3 sm:px-8 py-3.5 flex items-center justify-between gap-2 border-b border-white/10 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#C6A878]/20 border border-[#C6A878]/40 flex items-center justify-center text-[#C6A878] flex-shrink-0">
            <FileEdit className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold font-serif tracking-wide text-white truncate">
              Cebu Prime • Editor Workspace
            </h1>
            <p className="text-[11px] sm:text-xs text-[#C6A878] truncate">
              {profile?.displayName || user?.email || 'Editorial Staff'} (Content Editor)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onViewPublicSite}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 min-h-[40px] rounded-lg border border-white/20 text-white/80 hover:text-white hover:bg-white/10 text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap"
          >
            <span>Public Website</span>
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
          </button>

          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 min-h-[40px] rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Layout: Editor Sidebar (Strictly Content Sections) + Ivory Content Area */}
      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="w-full md:w-64 bg-[#17243B] text-white flex-shrink-0 p-3 sm:p-4 border-b md:border-b-0 md:border-r border-white/10 flex flex-row md:flex-col gap-2 overflow-x-auto">
          <div className="hidden md:block px-3 py-2 text-[10px] uppercase font-bold text-white/50 tracking-wider">
            Editorial Content Modules
          </div>

          <button
            type="button"
            onClick={() => setActiveSection('overview')}
            className={`w-auto md:w-full flex-shrink-0 text-left px-3.5 min-h-[40px] py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
              activeSection === 'overview'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span>Overview</span>
            </div>
            <span className="hidden md:inline text-[10px] opacity-75">Pulse</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('properties')}
            className={`w-auto md:w-full flex-shrink-0 text-left px-3.5 min-h-[40px] py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
              activeSection === 'properties'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 flex-shrink-0" />
              <span>Properties</span>
            </div>
            <span className="text-[10px] opacity-75">{properties.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('buildings')}
            className={`w-auto md:w-full flex-shrink-0 text-left px-3.5 min-h-[40px] py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
              activeSection === 'buildings'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span>Buildings</span>
            </div>
            <span className="text-[10px] opacity-75">{buildings.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('locations')}
            className={`w-auto md:w-full flex-shrink-0 text-left px-3.5 min-h-[40px] py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
              activeSection === 'locations'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>Neighborhood &amp; Areas</span>
            </div>
            <span className="text-[10px] opacity-75">{locationsList.length}</span>
          </button>

          <div className="hidden md:block mt-auto p-3.5 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-white/70 space-y-1.5">
            <div className="font-bold text-[#C6A878] uppercase tracking-wider text-[10px]">
              Editorial Scope
            </div>
            <p className="leading-relaxed">
              Manage property copy, images, SEO, buildings, and neighborhood guides. All edits are audit logged. Property approvals &amp; user administration remain Super Admin controlled.
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-8 max-w-7xl w-full mx-auto space-y-5 sm:space-y-6 min-w-0">
          {actionNotice && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                actionNotice.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {actionNotice.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                )}
                <span className="font-medium">{actionNotice.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionNotice(null)}
                className="text-xs font-bold opacity-70 hover:opacity-100 whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* SECTION 1: EDITORIAL OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-[#17243B] to-[#253754] text-white p-6 sm:p-8 rounded-2xl shadow-sm border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C6A878] mb-1">
                    <FileText className="w-4 h-4" />
                    <span>Content Maintenance Console</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold font-serif text-white">
                    Editorial Operations Overview
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl">
                    Maintain accuracy across Cebu Prime Properties listings, residential developments, and district guides.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProperty(null);
                      setIsAddPropertyOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl bg-[#C6A878] text-[#17243B] font-bold text-xs hover:bg-[#b89764] transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Property</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBuilding(null);
                      setIsAddBuildingOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl bg-white/10 text-white border border-white/20 font-semibold text-xs hover:bg-white/20 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Building</span>
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Properties</span>
                    <Building className="w-4 h-4 text-[#C6A878]" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-[#17243B]">
                      {metrics.totalProperties}
                    </div>
                    <span className="text-[10px] text-slate-500">All statuses</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Buildings</span>
                    <Layers className="w-4 h-4 text-[#C6A878]" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-[#17243B]">
                      {metrics.totalBuildings}
                    </div>
                    <span className="text-[10px] text-slate-500">Developments</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Neighborhoods</span>
                    <MapPin className="w-4 h-4 text-[#C6A878]" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-[#17243B]">
                      {metrics.totalNeighborhoods}
                    </div>
                    <span className="text-[10px] text-slate-500">Area guides</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-emerald-600 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Published</span>
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                      {metrics.publishedContentCount}
                    </div>
                    <span className="text-[10px] text-emerald-600">Live records</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Drafts</span>
                    <FileEdit className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-slate-700">
                      {metrics.draftContentCount}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      +{metrics.pendingApprovalCount} awaiting approval
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-amber-600 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Archived</span>
                    <Archive className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-amber-700">
                      {metrics.archivedContentCount}
                    </div>
                    <span className="text-[10px] text-amber-600">Safely preserved</span>
                  </div>
                </div>
              </div>

              {/* Recently Updated Content */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-[#17243B] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#C6A878]" />
                      <span>Recently Updated Content</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Latest editorial changes across listings, buildings, and neighborhood guides.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {metrics.recentlyUpdated.map((item) => (
                    <div
                      key={`${item.contentType}-${item.id}`}
                      className="px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${
                            item.contentType === 'property'
                              ? 'bg-[#17243B] text-[#C6A878]'
                              : item.contentType === 'building'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {item.contentType}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-[#17243B] truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase whitespace-nowrap">
                          {item.status}
                        </span>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {item.updatedAt
                            ? new Date(item.updatedAt).toLocaleDateString()
                            : 'N/A'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenRecentItem(item)}
                          className="inline-flex items-center gap-1 px-3 min-h-[34px] rounded-lg border border-slate-300 bg-white hover:bg-[#17243B] hover:text-[#C6A878] text-[#17243B] text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {metrics.recentlyUpdated.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No content records loaded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: PROPERTIES DIRECTORY (EDITOR PERMISSIONS: NO APPROVE/REJECT/FEATURE/DELETE) */}
          {activeSection === 'properties' && (() => {
            const filteredProps = properties.filter((p) => {
              if (propertyStatusFilter !== 'all' && p.status !== propertyStatusFilter) return false;
              if (propertySearch) {
                const q = propertySearch.toLowerCase();
                return (
                  p.propertyTitle.toLowerCase().includes(q) ||
                  p.location.toLowerCase().includes(q) ||
                  p.buildingName.toLowerCase().includes(q) ||
                  (p.agentName || '').toLowerCase().includes(q)
                );
              }
              return true;
            });
            const pagedProps = paginateItems(filteredProps, editorPropsPage, 10);

            return (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                      Properties Editorial Directory
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Review and refine property copy, photography, amenities, and SEO across all listings. Publishing approval stays exclusively with Super Admin.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingProperty(null);
                      setIsAddPropertyOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 min-h-[42px] rounded-xl bg-[#17243B] text-[#C6A878] font-bold text-xs whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Create Draft Property</span>
                  </button>
                </div>

                {/* Filters Bar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <input
                      type="text"
                      value={propertySearch}
                      onChange={(e) => setPropertySearch(e.target.value)}
                      placeholder="Search properties, buildings, agents..."
                      className="w-full h-10 px-3.5 pl-9 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs pb-1 sm:pb-0">
                    {(['all', 'approved', 'pending', 'rejected', 'draft', 'archived'] as const).map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setPropertyStatusFilter(s)}
                        className={`px-3.5 min-h-[36px] rounded-full font-semibold capitalize transition-colors whitespace-nowrap flex-shrink-0 ${
                          propertyStatusFilter === s
                            ? 'bg-[#17243B] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-[#17243B] text-white uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-5 py-3.5">Property</th>
                          <th className="px-4 py-3.5">District</th>
                          <th className="px-4 py-3.5">Price (PHP)</th>
                          <th className="px-4 py-3.5">Listing Owner</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-5 py-3.5 text-right">Editorial Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pagedProps.items.map((prop) => (
                          <tr key={prop.propertyId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-semibold text-slate-900">
                              <div className="flex items-center gap-3">
                                <img
                                  src={prop.images[0] || '/assets/extracted/photo_the_alcoves.png'}
                                  alt=""
                                  className="w-10 h-8 rounded-lg object-cover flex-shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="font-bold block truncate max-w-[210px]">
                                    {prop.propertyTitle}
                                  </span>
                                  <span className="block text-[10px] text-slate-400 truncate max-w-[210px]">
                                    {prop.buildingName}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">{prop.location}</td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">
                              ₱{prop.price.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              {prop.agentName}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                  prop.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : prop.status === 'pending'
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : prop.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                                    : prop.status === 'archived'
                                    ? 'bg-slate-200 text-slate-600 border-slate-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {prop.status}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setContentPreview({ type: 'property', item: prop })}
                                  title="Preview Listing"
                                  aria-label={`Preview ${prop.propertyTitle}`}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#17243B] hover:bg-slate-100"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProperty(prop);
                                    setIsAddPropertyOpen(true);
                                  }}
                                  title="Edit Content & Details"
                                  aria-label={`Edit ${prop.propertyTitle}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#17243B] hover:text-[#C6A878] text-slate-700 text-[11px] font-semibold transition-colors whitespace-nowrap"
                                >
                                  <Edit className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                {prop.status === 'archived' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleArchiveOrRestoreProperty(prop, 'restore')}
                                    title="Restore Property"
                                    aria-label={`Restore ${prop.propertyTitle}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold whitespace-nowrap"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Restore</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleArchiveOrRestoreProperty(prop, 'archive')}
                                    title="Archive Property"
                                    aria-label={`Archive ${prop.propertyTitle}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-semibold whitespace-nowrap"
                                  >
                                    <Archive className="w-3 h-3" />
                                    <span>Archive</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {pagedProps.items.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              No properties match your active search or status filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {pagedProps.totalPages > 1 && (
                    <div className="px-5 py-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
                      <span className="text-xs text-slate-500">
                        Page {pagedProps.currentPage} of {pagedProps.totalPages} ({pagedProps.totalItems} listings)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={pagedProps.currentPage <= 1}
                          onClick={() => setEditorPropsPage((p) => Math.max(1, p - 1))}
                          className="inline-flex items-center gap-1 px-3 min-h-[36px] rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 text-xs font-semibold whitespace-nowrap"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev</span>
                        </button>
                        <button
                          type="button"
                          disabled={pagedProps.currentPage >= pagedProps.totalPages}
                          onClick={() =>
                            setEditorPropsPage((p) => Math.min(pagedProps.totalPages, p + 1))
                          }
                          className="inline-flex items-center gap-1 px-3 min-h-[36px] rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 text-xs font-semibold whitespace-nowrap"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* SECTION 3: BUILDINGS (NO DELETE) */}
          {activeSection === 'buildings' && (() => {
            const filteredBuildings = buildings.filter((b) => {
              if (buildingStatusFilter === 'all') return true;
              return getEffectivePublishStatus(b) === buildingStatusFilter;
            });

            return (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                      Buildings &amp; Development Complexes
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Create, update, publish, unpublish, or archive building profiles and architectural details.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingBuilding(null);
                      setIsAddBuildingOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 min-h-[40px] rounded-xl bg-[#17243B] text-[#C6A878] font-bold text-xs hover:bg-[#253754] transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Add Building</span>
                  </button>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center gap-2 overflow-x-auto text-xs">
                  {(['all', 'published', 'unpublished', 'archived'] as const).map((tab) => (
                    <button
                      type="button"
                      key={tab}
                      onClick={() => setBuildingStatusFilter(tab)}
                      className={`px-3.5 min-h-[36px] rounded-full font-semibold capitalize transition-colors whitespace-nowrap ${
                        buildingStatusFilter === tab
                          ? 'bg-[#17243B] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab} (
                      {tab === 'all'
                        ? buildings.length
                        : buildings.filter((b) => getEffectivePublishStatus(b) === tab).length}
                      )
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredBuildings.map((bld) => {
                    const associatedProps = properties.filter((p) => p.buildingId === bld.buildingId);
                    const bldStatus = getEffectivePublishStatus(bld);
                    return (
                      <div
                        key={bld.buildingId}
                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between"
                      >
                        <div className="aspect-[16/10] bg-slate-100 relative">
                          <img
                            src={bld.buildingImages[0] || '/assets/extracted/the_alcoves.png'}
                            alt={bld.buildingName}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#17243B]/85 text-[#C6A878] text-[10px] font-bold">
                            {bld.location}
                          </span>
                          <span
                            className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shadow-sm ${
                              bldStatus === 'published'
                                ? 'bg-emerald-600 text-white'
                                : bldStatus === 'unpublished'
                                ? 'bg-slate-700 text-white'
                                : 'bg-amber-600 text-white'
                            }`}
                          >
                            {bldStatus}
                          </span>
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <h3 className="font-bold text-sm text-[#17243B]">{bld.buildingName}</h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">{bld.address}</p>
                            <p className="text-xs text-slate-600 mt-2 line-clamp-2">{bld.description}</p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setViewingBuildingProperties(bld)}
                                className="font-semibold text-[#17243B] hover:text-[#C6A878] text-[11px] flex items-center gap-1 whitespace-nowrap"
                              >
                                <Building className="w-3 h-3 flex-shrink-0" />
                                <span>{associatedProps.length} Units</span>
                              </button>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setContentPreview({ type: 'building', item: bld })}
                                  title="Preview Building"
                                  aria-label={`Preview ${bld.buildingName}`}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#17243B] hover:bg-slate-100"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBuilding(bld);
                                    setIsAddBuildingOpen(true);
                                  }}
                                  title="Edit Building"
                                  aria-label={`Edit ${bld.buildingName}`}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#17243B] hover:bg-slate-100"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {bldStatus !== 'archived' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleChangeBuildingStatus(
                                      bld,
                                      bldStatus === 'published' ? 'unpublished' : 'published'
                                    )
                                  }
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-[#17243B] hover:text-[#C6A878] text-slate-700 text-[11px] font-semibold transition-colors whitespace-nowrap"
                                >
                                  {bldStatus === 'published' ? (
                                    <>
                                      <EyeOff className="w-3 h-3" />
                                      <span>Unpublish</span>
                                    </>
                                  ) : (
                                    <>
                                      <Globe className="w-3 h-3" />
                                      <span>Publish</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {bldStatus === 'archived' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleChangeBuildingStatus(
                                      bld,
                                      bld.previousStatus || 'unpublished'
                                    )
                                  }
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold transition-colors whitespace-nowrap"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Restore</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleChangeBuildingStatus(bld, 'archived')}
                                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-semibold transition-colors whitespace-nowrap"
                                >
                                  <Archive className="w-3 h-3" />
                                  <span>Archive</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredBuildings.length === 0 && (
                    <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                      No buildings match the selected publication filter.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* SECTION 4: NEIGHBORHOOD & AREAS (NO DELETE) */}
          {activeSection === 'locations' && (() => {
            const filteredLocations = locationsList.filter((l) => {
              if (locationStatusFilter === 'all') return true;
              return getEffectivePublishStatus(l) === locationStatusFilter;
            });

            return (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                      Neighborhood &amp; Areas Guides
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Create, edit, publish, unpublish, or archive neighborhood guides, lifestyle highlights, and SEO tags.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLocation(null);
                      setIsLocationModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17243B] hover:bg-[#253754] text-[#C6A878] font-bold text-xs shadow-md transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span>Add Neighborhood</span>
                  </button>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center gap-2 overflow-x-auto text-xs">
                  {(['all', 'published', 'unpublished', 'archived'] as const).map((tab) => (
                    <button
                      type="button"
                      key={tab}
                      onClick={() => setLocationStatusFilter(tab)}
                      className={`px-3.5 min-h-[36px] rounded-full font-semibold capitalize transition-colors whitespace-nowrap ${
                        locationStatusFilter === tab
                          ? 'bg-[#17243B] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab} (
                      {tab === 'all'
                        ? locationsList.length
                        : locationsList.filter((l) => getEffectivePublishStatus(l) === tab).length}
                      )
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredLocations.map((loc) => {
                    const locProps = properties.filter((p) =>
                      matchesNeighborhoodName(p.location, loc.name)
                    );
                    const locBuildings = buildings.filter((b) =>
                      matchesNeighborhoodName(b.location, loc.name)
                    );
                    const locStatus = getEffectivePublishStatus(loc);
                    return (
                      <div
                        key={loc.id}
                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-[16/10] bg-slate-100 relative">
                          <img
                            src={loc.image || '/assets/extracted/photo_the_alcoves.png'}
                            alt={loc.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#17243B]/85 via-black/20 to-transparent" />
                          <span
                            className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shadow-sm ${
                              locStatus === 'published'
                                ? 'bg-emerald-600 text-white'
                                : locStatus === 'unpublished'
                                ? 'bg-slate-700 text-white'
                                : 'bg-amber-600 text-white'
                            }`}
                          >
                            {locStatus}
                          </span>
                          <div className="absolute bottom-2.5 left-3 right-3 text-white">
                            <h4 className="font-bold text-sm leading-tight">{loc.name}</h4>
                            <span className="text-[10px] text-[#C6A878] font-medium">{loc.tagline}</span>
                          </div>
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <p className="text-xs text-slate-600 line-clamp-2">{loc.description}</p>

                          <div className="pt-3 border-t border-slate-100 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col text-[11px]">
                                <span className="font-bold text-[#17243B]">{locProps.length} Properties</span>
                                <span className="text-slate-400">{locBuildings.length} Developments</span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setContentPreview({ type: 'neighborhood', item: loc })}
                                  title="Preview Neighborhood"
                                  aria-label={`Preview ${loc.name}`}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#17243B] hover:bg-slate-100 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingLocation(loc);
                                    setIsLocationModalOpen(true);
                                  }}
                                  title="Edit Neighborhood"
                                  aria-label={`Edit ${loc.name}`}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#17243B] hover:bg-slate-100 transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px]">
                              {locStatus !== 'archived' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleChangeLocationStatus(
                                      loc,
                                      locStatus === 'published' ? 'unpublished' : 'published'
                                    )
                                  }
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-[#17243B] hover:text-[#C6A878] text-slate-700 font-semibold transition-colors whitespace-nowrap"
                                >
                                  {locStatus === 'published' ? (
                                    <>
                                      <EyeOff className="w-3 h-3" />
                                      <span>Unpublish</span>
                                    </>
                                  ) : (
                                    <>
                                      <Globe className="w-3 h-3" />
                                      <span>Publish</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {locStatus === 'archived' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleChangeLocationStatus(
                                      loc,
                                      loc.previousStatus || 'unpublished'
                                    )
                                  }
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold transition-colors whitespace-nowrap"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Restore</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleChangeLocationStatus(loc, 'archived')}
                                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold transition-colors whitespace-nowrap"
                                >
                                  <Archive className="w-3 h-3" />
                                  <span>Archive</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredLocations.length === 0 && (
                    <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                      No neighborhoods match the selected publication filter.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </main>
      </div>

      {/* Building Units Modal */}
      {viewingBuildingProperties && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17243B]/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="font-bold text-base text-[#17243B] flex items-center gap-2">
                  <Building className="w-5 h-5 text-[#C6A878]" />
                  <span>{viewingBuildingProperties.buildingName} • Units &amp; Residences</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewingBuildingProperties.location} • {viewingBuildingProperties.address}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingBuildingProperties(null)}
                aria-label="Close units modal"
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {properties.filter((p) => p.buildingId === viewingBuildingProperties.buildingId)
                .length > 0 ? (
                properties
                  .filter((p) => p.buildingId === viewingBuildingProperties.buildingId)
                  .map((prop) => (
                    <div
                      key={prop.propertyId}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={prop.images[0] || '/assets/extracted/the_alcoves.png'}
                          alt=""
                          className="w-12 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                        <div>
                          <h4 className="font-bold text-slate-900">{prop.propertyTitle}</h4>
                          <span className="text-[11px] text-slate-500 block">
                            ₱{prop.price.toLocaleString()} • {prop.bedrooms} Bed • {prop.floorArea} sqm • Owner: {prop.agentName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                          {prop.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setViewingBuildingProperties(null);
                            onSelectPropertyPreview(prop);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] whitespace-nowrap"
                        >
                          Preview
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No properties currently linked to this building.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setViewingBuildingProperties(null)}
                className="px-4 py-2 rounded-xl bg-[#17243B] text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Create / Edit Modal (Editor RBAC active) */}
      <AddPropertyModal
        isOpen={isAddPropertyOpen}
        onClose={() => {
          setIsAddPropertyOpen(false);
          setEditingProperty(null);
        }}
        onSaved={(savedProp) => {
          onPropertyUpdated(savedProp);
          setActionNotice({
            type: 'success',
            text: `Property "${savedProp.propertyTitle}" updated cleanly (${savedProp.status}).`,
          });
        }}
        onPreview={(prop) => setContentPreview({ type: 'property', item: prop })}
        editingProperty={editingProperty}
        existingProperties={properties}
        buildings={buildings}
        locations={locationsList}
        otherReferencedImageUrls={getOtherReferencedUrls({
          propertyId: editingProperty?.propertyId,
        })}
        isSuperAdmin={false}
        isEditor={true}
      />

      {/* Building Create / Edit Modal (Editor RBAC active) */}
      <BuildingFormModal
        isOpen={isAddBuildingOpen}
        onClose={() => {
          setIsAddBuildingOpen(false);
          setEditingBuilding(null);
        }}
        editingBuilding={editingBuilding}
        existingBuildings={buildings}
        locations={locationsList}
        otherReferencedImageUrls={getOtherReferencedUrls({
          buildingId: editingBuilding?.buildingId,
        })}
        onSaved={(savedBld) => {
          onBuildingAdded(savedBld);
          setActionNotice({
            type: 'success',
            text: `Building "${savedBld.buildingName}" saved cleanly.`,
          });
        }}
        onPreview={(bld) => setContentPreview({ type: 'building', item: bld })}
        isEditor={true}
      />

      {/* Neighborhood Create / Edit Modal (Editor RBAC active) */}
      <NeighborhoodFormModal
        isOpen={isLocationModalOpen}
        onClose={() => {
          setIsLocationModalOpen(false);
          setEditingLocation(null);
        }}
        editingLocation={editingLocation}
        existingLocations={locationsList}
        properties={properties}
        otherReferencedImageUrls={getOtherReferencedUrls({
          locationId: editingLocation?.id,
        })}
        onSaved={handleSavedLocation}
        onPreview={(loc) => setContentPreview({ type: 'neighborhood', item: loc })}
        isEditor={true}
      />

      <ContentPreviewModal
        preview={contentPreview}
        onClose={() => setContentPreview(null)}
        onOpenLivePage={onOpenPublicPath}
      />
    </div>
  );
};
