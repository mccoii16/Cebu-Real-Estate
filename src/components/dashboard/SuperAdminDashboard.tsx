import React, { useState, useEffect } from 'react';
import {
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Building,
  Users,
  Search,
  Plus,
  Trash2,
  Edit,
  Eye,
  LogOut,
  ExternalLink,
  Star,
  MessageSquare,
  AlertCircle,
  Check,
  X,
  UserCheck,
  UserX,
  Mail,
  Key,
  Calendar,
  DollarSign,
  MapPin,
  ChevronRight,
  SlidersHorizontal,
  Globe,
  TrendingUp,
  PieChart,
  Home,
  CheckCircle,
  FileText,
  Save,
  Phone,
  Layers,
  Upload,
  ArrowRight,
  ChevronLeft,
  Send,
  Archive,
  RotateCcw,
  EyeOff,
  UserCog,
  History,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  PropertyDoc,
  BuildingDoc,
  UserProfile,
  InquiryDoc,
  WebsiteSettings,
  LocationHighlight,
  HeroSlideConfig,
  ContentPublishStatus,
  AuditLogDoc,
} from '../../types/property';
import { useAuth } from '../../context/AuthContext';
import { AddPropertyModal } from './AddPropertyModal';
import { BuildingFormModal } from './BuildingFormModal';
import { NeighborhoodFormModal } from './NeighborhoodFormModal';
import { ContentPreviewModal } from './ContentPreviewModal';
import { ConfirmActionModal } from './ConfirmActionModal';
import { collection, doc, updateDoc, deleteDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { saveWebsiteSettings, DEFAULT_WEBSITE_SETTINGS, getWebsiteSettings } from '../../services/settingsService';
import { saveLocation, deleteLocation, INITIAL_LOCATIONS } from '../../services/locationService';
import { uploadSiteAsset, deleteUnreferencedStorageImages } from '../../services/storageService';
import { createAgentFirebaseAuthUser } from '../../services/agentAuthService';
import {
  loadEditorsList,
  createEditorAccount,
  assignStaffRole,
  toggleEditorAccountStatus,
  resetEditorPassword,
  removeEditorAccountAccess,
} from '../../services/editorAdminService';
import { getAuditLogs, recordAuditLog } from '../../services/auditLogService';
import {
  subscribeToInquiries,
  updateInquiryStatus as updateInquiryStatusService,
  deleteInquiry as deleteInquiryService,
} from '../../services/inquiryService';
import {
  DEFAULT_INQUIRY_EMAIL_SUBJECT,
  DEFAULT_INQUIRY_EMAIL_BODY,
  formatInquiryNotificationEmail,
  paginateItems,
} from '../../utils/filterProperties';
import { matchesNeighborhoodName } from '../../utils/slugs';
import {
  checkBuildingDeleteSafety,
  checkNeighborhoodDeleteSafety,
  collectAllReferencedImageUrls,
  getEffectivePublishStatus,
} from '../../utils/contentManagement';
import { inferAuditAction } from '../../utils/editorPermissions';
import { syncWebsiteSettingsPayload } from '../../utils/heroSettings';

interface SuperAdminDashboardProps {
  properties: PropertyDoc[];
  buildings: BuildingDoc[];
  locations?: LocationHighlight[];
  siteSettings?: WebsiteSettings;
  onPropertyUpdated: (property: PropertyDoc) => void;
  onPropertyDeleted: (propertyId: string) => void;
  onBuildingAdded: (building: BuildingDoc) => void;
  onBuildingDeleted: (buildingId: string) => void;
  onLocationsUpdated?: (locations: LocationHighlight[]) => void;
  onSettingsUpdated?: (settings: WebsiteSettings) => void;
  onViewPublicSite: () => void;
  onSelectPropertyPreview: (property: PropertyDoc) => void;
  onOpenPublicPath?: (path: string) => void;
}

export type AdminSection =
  | 'overview'
  | 'properties'
  | 'approvals'
  | 'buildings'
  | 'locations'
  | 'agents'
  | 'editors'
  | 'inquiries'
  | 'audit'
  | 'settings';

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  properties,
  buildings,
  locations,
  siteSettings: initialSettings,
  onPropertyUpdated,
  onPropertyDeleted,
  onBuildingAdded,
  onBuildingDeleted,
  onLocationsUpdated,
  onSettingsUpdated,
  onViewPublicSite,
  onSelectPropertyPreview,
  onOpenPublicPath,
}) => {
  const { user, profile, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');

  // Inline Banner & Shared Preview / Confirm Modals
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
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    blockedReason?: string | null;
    secondaryLabel?: string;
    onSecondaryAction?: () => void;
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);

  // Neighborhood & Areas Management State
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

  // Agent State
  const [agents, setAgents] = useState<UserProfile[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [createdAgentInfo, setCreatedAgentInfo] = useState<{
    email: string;
    pass: string;
    warning?: string;
  } | null>(null);

  // Editor Role Management State (Super Admin-only)
  const [editors, setEditors] = useState<UserProfile[]>([]);
  const [isLoadingEditors, setIsLoadingEditors] = useState(false);
  const [editorSearch, setEditorSearch] = useState('');
  const [isCreateEditorOpen, setIsCreateEditorOpen] = useState(false);
  const [newEditorName, setNewEditorName] = useState('');
  const [newEditorEmail, setNewEditorEmail] = useState('');
  const [newEditorPassword, setNewEditorPassword] = useState('');
  const [isCreatingEditor, setIsCreatingEditor] = useState(false);
  const [createdEditorInfo, setCreatedEditorInfo] = useState<{
    email: string;
    pass: string;
    warning?: string;
  } | null>(null);
  const [resetLinkModal, setResetLinkModal] = useState<{
    email: string;
    resetEmailSent: boolean;
    resetLink?: string | null;
    note?: string;
  } | null>(null);

  // Editorial Audit Logs State (Super Admin-only)
  const [auditLogs, setAuditLogs] = useState<AuditLogDoc[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<
    'all' | 'property' | 'building' | 'neighborhood'
  >('all');

  // Property Filters & Actions
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<
    'all' | 'approved' | 'pending' | 'rejected' | 'draft' | 'archived'
  >('all');
  const [adminPropsPage, setAdminPropsPage] = useState(1);
  const [editingProperty, setEditingProperty] = useState<PropertyDoc | null>(null);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);

  // Approval / Rejection Dialog
  const [reviewingProperty, setReviewingProperty] = useState<PropertyDoc | null>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Building State
  const [isAddBuildingOpen, setIsAddBuildingOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<BuildingDoc | null>(null);
  const [buildingStatusFilter, setBuildingStatusFilter] = useState<
    'all' | 'published' | 'unpublished' | 'archived'
  >('all');
  const [viewingBuildingProperties, setViewingBuildingProperties] = useState<BuildingDoc | null>(null);

  // Inquiries State
  const [inquiries, setInquiries] = useState<InquiryDoc[]>([]);
  const [inquiryStatusUpdating, setInquiryStatusUpdating] = useState<string | null>(null);
  const [viewingInquiryEmail, setViewingInquiryEmail] = useState<InquiryDoc | null>(null);

  // Settings State
  const [siteSettings, setSiteSettings] = useState<WebsiteSettings>(
    initialSettings || DEFAULT_WEBSITE_SETTINGS
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [uploadingSlideIdx, setUploadingSlideIdx] = useState<number | null>(null);
  const [slideFeedback, setSlideFeedback] = useState<
    Record<number, { type: 'success' | 'error'; text: string }>
  >({});
  const [brokenSlidePreviews, setBrokenSlidePreviews] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setAdminPropsPage(1);
  }, [propertySearch, propertyStatusFilter]);

  // Fetch agents list from Firestore and backend
  const loadAgents = async () => {
    setIsLoadingAgents(true);
    try {
      let loadedAgents: UserProfile[] = [];

      // 1. Direct Firestore read (primary source, works on all environments)
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'agent'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          loadedAgents = snap.docs.map((d) => d.data() as UserProfile);
        }
      } catch (firestoreErr) {
        console.warn('[Agents] Direct Firestore read notice:', firestoreErr);
      }

      // 2. Query backend API if available and merge
      try {
        const token = await user?.getIdToken();
        if (token) {
          const res = await fetch('/api/admin/agents', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            const data = await res.json();
            if (data.agents && Array.isArray(data.agents)) {
              const map = new Map<string, UserProfile>();
              data.agents.forEach((a: UserProfile) => map.set(a.uid, a));
              loadedAgents.forEach((a) => map.set(a.uid, a));
              loadedAgents = Array.from(map.values());
            }
          }
        }
      } catch (apiErr) {
        console.warn('[Agents] Backend fetch notice:', apiErr);
      }

      setAgents(loadedAgents);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  // Fetch editors list
  const loadEditors = async () => {
    setIsLoadingEditors(true);
    try {
      const list = await loadEditorsList(user);
      setEditors(list);
    } catch (err) {
      console.error('Error loading editors:', err);
    } finally {
      setIsLoadingEditors(false);
    }
  };

  // Fetch audit logs
  const loadAuditLogs = async () => {
    setIsLoadingAuditLogs(true);
    try {
      const logs = await getAuditLogs(user);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  // Real-time synchronization of customer inquiries (dispatched directly to Martiligando@gmail.com)
  useEffect(() => {
    loadAgents();
    loadEditors();
    loadAuditLogs();
    loadSettings();

    // Subscribe to live Firestore inquiries with automatic offline local buffer
    const unsubscribe = subscribeToInquiries(
      (liveInquiries) => {
        setInquiries(liveInquiries as InquiryDoc[]);
      },
      (err) => {
        console.warn('Real-time inquiries fallback:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Fetch website settings from Firestore
  const loadSettings = async () => {
    try {
      const s = await getWebsiteSettings();
      setSiteSettings(s);
      if (onSettingsUpdated) onSettingsUpdated(s);
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  // Update Inquiry Status (new -> contacted -> closed)
  const handleUpdateInquiryStatus = async (
    inquiryId: string,
    newStatus: 'new' | 'contacted' | 'closed'
  ) => {
    setInquiryStatusUpdating(inquiryId);
    setActionNotice(null);
    try {
      await updateInquiryStatusService(inquiryId, newStatus);
      setInquiries((prev) =>
        prev.map((inq) => (inq.inquiryId === inquiryId ? { ...inq, status: newStatus } : inq))
      );
    } catch (err: any) {
      setActionNotice({ type: 'error', text: `Error updating inquiry status: ${err.message}` });
    } finally {
      setInquiryStatusUpdating(null);
    }
  };

  // Delete Inquiry
  const handleDeleteInquiry = (inquiryId: string) => {
    setConfirmState({
      title: 'Delete Inquiry Record',
      message: 'Are you sure you want to permanently remove this client inquiry record?',
      confirmLabel: 'Delete Inquiry',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteInquiryService(inquiryId);
          setInquiries((prev) => prev.filter((inq) => inq.inquiryId !== inquiryId));
          setActionNotice({ type: 'success', text: 'Client inquiry record removed.' });
        } catch (err: any) {
          setActionNotice({ type: 'error', text: `Could not delete inquiry: ${err.message}` });
        }
      },
    });
  };

  const getOtherReferencedUrls = (exclude?: {
    propertyId?: string;
    buildingId?: string;
    locationId?: string;
  }) =>
    collectAllReferencedImageUrls({
      properties: properties.filter((p) => p.propertyId !== exclude?.propertyId),
      buildings: buildings.filter((b) => b.buildingId !== exclude?.buildingId),
      locations: locationsList.filter((l) => l.id !== exclude?.locationId),
      siteSettings,
    });

  // Neighborhood & Area Handlers
  const openAddLocationModal = () => {
    setEditingLocation(null);
    setIsLocationModalOpen(true);
  };

  const openEditLocationModal = (loc: LocationHighlight) => {
    setEditingLocation(loc);
    setIsLocationModalOpen(true);
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
      };
      await saveLocation(updatedLoc);
      await recordAuditLog({
        user,
        editorEmail: user?.email || undefined,
        editorName: profile?.displayName || undefined,
        editorRole: 'superadmin',
        contentType: 'neighborhood',
        contentId: loc.id,
        contentTitle: loc.name,
        action: inferAuditAction(false, prior, targetStatus),
        changedFields: ['status'],
      });
      loadAuditLogs();
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
      setActionNotice({ type: 'error', text: `Failed to update neighborhood: ${err.message}` });
    }
  };

  const requestDeleteLocation = (loc: LocationHighlight) => {
    const safety = checkNeighborhoodDeleteSafety(loc, buildings, properties);
    if (!safety.canDelete) {
      setConfirmState({
        title: `Cannot Delete "${loc.name}"`,
        message: '',
        blockedReason: safety.reason,
        secondaryLabel: 'Archive Instead',
        onSecondaryAction: () => {
          setConfirmState(null);
          handleChangeLocationStatus(loc, 'archived');
        },
        onConfirm: () => {},
      });
      return;
    }

    setConfirmState({
      title: 'Permanently Delete Neighborhood',
      message: `No properties or buildings currently reference "${loc.name}". Permanently delete this neighborhood and any unshared Storage photos?`,
      confirmLabel: 'Delete Permanently',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteLocation(loc.id);
          const otherRefs = getOtherReferencedUrls({ locationId: loc.id });
          const removedImgs = [loc.image, ...(loc.galleryImages || [])].filter(Boolean);
          await deleteUnreferencedStorageImages(removedImgs, otherRefs);
          const updated = locationsList.filter((l) => l.id !== loc.id);
          setLocationsList(updated);
          if (onLocationsUpdated) onLocationsUpdated(updated);
          setActionNotice({ type: 'success', text: `Deleted neighborhood "${loc.name}".` });
        } catch (err: any) {
          setActionNotice({ type: 'error', text: `Failed to delete neighborhood: ${err.message}` });
        }
      },
    });
  };

  // Building Quick Status & Safe Delete Handlers
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
      };
      await updateDoc(doc(db, 'buildings', bld.buildingId), updatedDoc as any);
      await recordAuditLog({
        user,
        editorEmail: user?.email || undefined,
        editorName: profile?.displayName || undefined,
        editorRole: 'superadmin',
        contentType: 'building',
        contentId: bld.buildingId,
        contentTitle: bld.buildingName,
        action: inferAuditAction(false, prior, targetStatus),
        changedFields: ['status'],
      });
      loadAuditLogs();
      onBuildingAdded(updatedDoc);
      setActionNotice({
        type: 'success',
        text: `Building "${bld.buildingName}" updated to ${targetStatus}.`,
      });
    } catch (err: any) {
      setActionNotice({ type: 'error', text: `Could not update building: ${err.message}` });
    }
  };

  const requestDeleteBuilding = (bld: BuildingDoc) => {
    const safety = checkBuildingDeleteSafety(bld, properties);
    if (!safety.canDelete) {
      setConfirmState({
        title: `Cannot Delete "${bld.buildingName}"`,
        message: '',
        blockedReason: safety.reason,
        secondaryLabel: 'Archive Building Instead',
        onSecondaryAction: () => {
          setConfirmState(null);
          handleChangeBuildingStatus(bld, 'archived');
        },
        onConfirm: () => {},
      });
      return;
    }

    setConfirmState({
      title: 'Permanently Delete Building',
      message: `No property listings reference "${bld.buildingName}". Permanently delete this building record and any unshared Storage photos?`,
      confirmLabel: 'Delete Permanently',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'buildings', bld.buildingId));
          const otherRefs = getOtherReferencedUrls({ buildingId: bld.buildingId });
          await deleteUnreferencedStorageImages(bld.buildingImages || [], otherRefs);
          onBuildingDeleted(bld.buildingId);
          setActionNotice({ type: 'success', text: `Deleted building "${bld.buildingName}".` });
        } catch (err: any) {
          setActionNotice({ type: 'error', text: `Could not delete building: ${err.message}` });
        }
      },
    });
  };

  // Save Website Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSaveSuccess(false);
    setSettingsSaveError(null);
    setActionNotice(null);
    try {
      const adminEmail = user?.email || 'Martiligando@gmail.com';
      const synced = syncWebsiteSettingsPayload(
        siteSettings,
        DEFAULT_WEBSITE_SETTINGS.heroSlides || []
      );
      const updated = await saveWebsiteSettings(synced, adminEmail);
      setSiteSettings(updated);
      if (onSettingsUpdated) onSettingsUpdated(updated);
      setSettingsSaveSuccess(true);
      setTimeout(() => setSettingsSaveSuccess(false), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Could not write website settings to Firestore.';
      setSettingsSaveError(`Failed to save settings: ${msg}`);
      setActionNotice({ type: 'error', text: `Failed to save settings: ${msg}` });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Pending Approvals count (pending status OR approved with pending changes)
  const pendingApprovals = properties.filter(
    (p) => p.status === 'pending' || (p.status === 'approved' && p.hasPendingReview)
  );

  // Approve action
  const handleApprove = async (property: PropertyDoc) => {
    setActionError(null);
    setActionNotice(null);
    try {
      const now = new Date().toISOString();
      const approverId = user?.email || 'admin-super';

      let updatePayload: any = {
        status: 'approved',
        approvedAt: now,
        approvedBy: approverId,
        rejectionReason: null,
        updatedAt: now,
        hasPendingReview: false,
      };

      // If approving pending revision edits
      if (property.hasPendingReview && property.pendingChanges) {
        updatePayload = {
          ...updatePayload,
          ...property.pendingChanges,
          hasPendingReview: false,
          pendingChanges: null,
        };
      }

      await updateDoc(doc(db, 'properties', property.propertyId), updatePayload);

      const updatedProp: PropertyDoc = {
        ...property,
        ...updatePayload,
      };

      onPropertyUpdated(updatedProp);
      setReviewingProperty(null);
    } catch (err: any) {
      console.error('Approval failed:', err);
      setActionNotice({ type: 'error', text: `Approval failed: ${err.message}` });
    }
  };

  // Open Rejection Dialog
  const openRejectDialog = (property: PropertyDoc) => {
    setReviewingProperty(property);
    setRejectionReason('');
    setActionError(null);
    setRejectionModalOpen(true);
  };

  // Submit Rejection
  const handleConfirmReject = async () => {
    if (!reviewingProperty) return;
    if (!rejectionReason.trim()) {
      setActionError('Please enter a constructive rejection reason for the Agent.');
      return;
    }

    try {
      const now = new Date().toISOString();
      const approverId = user?.email || 'admin-super';

      let updatePayload: any;

      if (reviewingProperty.status === 'approved' && reviewingProperty.hasPendingReview) {
        updatePayload = {
          hasPendingReview: false,
          rejectionReason: `Revision rejected: ${rejectionReason.trim()}`,
          updatedAt: now,
        };
      } else {
        updatePayload = {
          status: 'rejected',
          rejectionReason: rejectionReason.trim(),
          updatedAt: now,
          approvedBy: approverId,
        };
      }

      await updateDoc(doc(db, 'properties', reviewingProperty.propertyId), updatePayload);

      const updatedProp: PropertyDoc = {
        ...reviewingProperty,
        ...updatePayload,
      };

      onPropertyUpdated(updatedProp);
      setRejectionModalOpen(false);
      setReviewingProperty(null);
    } catch (err: any) {
      console.error('Rejection failed:', err);
      setActionError(`Rejection failed: ${err.message}`);
    }
  };

  // Toggle Featured Status
  const handleToggleFeatured = async (property: PropertyDoc, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionNotice(null);
    try {
      const newFeatured = !property.featured;
      await updateDoc(doc(db, 'properties', property.propertyId), {
        featured: newFeatured,
        updatedAt: new Date().toISOString(),
      });
      onPropertyUpdated({ ...property, featured: newFeatured });
    } catch (err: any) {
      setActionNotice({ type: 'error', text: `Could not toggle featured: ${err.message}` });
    }
  };

  // Inline Status Change (Super Admin)
  const handleChangePropertyStatus = async (
    property: PropertyDoc,
    newStatus: PropertyDoc['status']
  ) => {
    setActionNotice(null);
    try {
      const now = new Date().toISOString();
      const payload: Partial<PropertyDoc> = {
        status: newStatus,
        updatedAt: now,
        previousStatus:
          newStatus === 'archived'
            ? property.status !== 'archived'
              ? property.status
              : property.previousStatus || 'draft'
            : null,
        archivedAt: newStatus === 'archived' ? property.archivedAt || now : null,
        ...(newStatus === 'approved'
          ? {
              approvedAt: property.approvedAt || now,
              approvedBy: user?.email || 'admin-super',
              rejectionReason: null,
              hasPendingReview: false,
            }
          : {}),
      };
      await updateDoc(doc(db, 'properties', property.propertyId), payload as any);
      await recordAuditLog({
        user,
        editorEmail: user?.email || undefined,
        editorName: profile?.displayName || undefined,
        editorRole: 'superadmin',
        contentType: 'property',
        contentId: property.propertyId,
        contentTitle: property.propertyTitle,
        action: inferAuditAction(false, property.status, newStatus),
        changedFields: ['status'],
      });
      loadAuditLogs();
      onPropertyUpdated({ ...property, ...payload });
    } catch (err: any) {
      setActionNotice({ type: 'error', text: `Could not update property status: ${err.message}` });
    }
  };

  // Archive / Delete Property
  const handleDeleteProperty = (property: PropertyDoc, e: React.MouseEvent) => {
    e.stopPropagation();
    const isAlreadyArchived = property.status === 'archived';
    setConfirmState({
      title: isAlreadyArchived ? 'Permanently Delete Property' : 'Delete or Archive Property',
      message: isAlreadyArchived
        ? `Permanently delete archived property "${property.propertyTitle}"? Any unshared photos will also be removed from Storage.`
        : `Permanently deleting "${property.propertyTitle}" cannot be undone. You can also archive it to preserve history safely.`,
      confirmLabel: 'Delete Permanently',
      isDestructive: true,
      ...(!isAlreadyArchived
        ? {
            secondaryLabel: 'Archive Instead',
            onSecondaryAction: () => {
              setConfirmState(null);
              handleChangePropertyStatus(property, 'archived');
            },
          }
        : {}),
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'properties', property.propertyId));
          const otherRefs = getOtherReferencedUrls({ propertyId: property.propertyId });
          await deleteUnreferencedStorageImages(property.images || [], otherRefs);
          onPropertyDeleted(property.propertyId);
          setActionNotice({
            type: 'success',
            text: `Deleted property "${property.propertyTitle}".`,
          });
        } catch (err: any) {
          setActionNotice({ type: 'error', text: `Could not delete property: ${err.message}` });
        }
      },
    });
  };

  // Create Agent Account
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const email = newAgentEmail.trim();
    const displayName = newAgentName.trim();
    if (!email || !displayName) {
      setActionError('Display name and email are required.');
      return;
    }

    const defaultPass = `CebuAgent@${Math.floor(100000 + Math.random() * 900000)}`;
    const temporaryPass = newAgentPassword.trim() || defaultPass;
    const now = new Date().toISOString();

    try {
      let agentUid = `agent-${Date.now()}`;
      let warningNotice: string | undefined;

      const authResult = await createAgentFirebaseAuthUser(email, temporaryPass, displayName);
      if (authResult.success && authResult.uid) {
        agentUid = authResult.uid;
      } else if (!authResult.success) {
        if (authResult.error === 'auth/operation-not-allowed') {
          warningNotice =
            'Email/Password sign-in provider is disabled in Firebase project cebu-real-estate-84294. Please enable Email/Password in Firebase Console (Authentication > Sign-in method) so this agent can log in with their password.';
        } else {
          warningNotice = `Firebase Auth notice: ${authResult.error}. Note that the agent can also sign in with Google using this email address.`;
        }
      }

      const agentProfile: UserProfile = {
        uid: agentUid,
        email,
        displayName,
        role: 'agent',
        status: 'active',
        temporaryPassword: temporaryPass,
        createdAt: now,
        updatedAt: now,
        createdBy: user?.uid,
        createdByEmail: user?.email || undefined,
      };

      try {
        await setDoc(doc(db, 'users', agentUid), agentProfile);
      } catch (dbErr: any) {
        console.warn('[CreateAgent] Firestore setDoc note:', dbErr.message);
      }

      try {
        const token = await user?.getIdToken();
        if (token) {
          fetch('/api/admin/agents', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              displayName,
              email,
              password: temporaryPass,
            }),
          }).catch(() => {});
        }
      } catch {}

      setCreatedAgentInfo({
        email: agentProfile.email,
        pass: temporaryPass,
        warning: warningNotice,
      });

      setNewAgentName('');
      setNewAgentEmail('');
      setNewAgentPassword('');
      setAgents((prev) => [agentProfile, ...prev.filter((a) => a.uid !== agentUid)]);
      loadAgents();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create agent account');
    }
  };

  // Provision / Setup Auth Password for existing Agent
  const handleProvisionAgentAuth = async (agent: UserProfile) => {
    setActionNotice(null);
    const defaultPass = `CebuAgent@${Math.floor(100000 + Math.random() * 900000)}`;
    const pass = agent.temporaryPassword || defaultPass;
    const res = await createAgentFirebaseAuthUser(agent.email, pass, agent.displayName);
    if (res.success) {
      await updateDoc(doc(db, 'users', agent.uid), {
        temporaryPassword: pass,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
      setCreatedAgentInfo({
        email: agent.email,
        pass,
      });
      setIsCreateAgentOpen(true);
    } else if (res.error === 'auth/operation-not-allowed') {
      setActionNotice({
        type: 'error',
        text: 'Email/Password sign-in provider is disabled in Firebase Console for project cebu-real-estate-84294.',
      });
    } else {
      setActionNotice({
        type: 'error',
        text: `Could not register in Firebase Auth: ${res.error}`,
      });
    }
  };

  // Disable / Enable Agent
  const handleToggleAgentStatus = async (agent: UserProfile) => {
    const newStatus = agent.status === 'active' ? 'disabled' : 'active';
    setActionNotice(null);
    try {
      try {
        await updateDoc(doc(db, 'users', agent.uid), {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('Firestore status update note:', dbErr);
      }

      try {
        const token = await user?.getIdToken();
        if (token) {
          await fetch(`/api/admin/agents/${agent.uid}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status: newStatus }),
          });
        }
      } catch {}

      setAgents((prev) =>
        prev.map((a) => (a.uid === agent.uid ? { ...a, status: newStatus } : a))
      );
    } catch (err: any) {
      setActionNotice({ type: 'error', text: `Failed to update agent status: ${err.message}` });
    }
  };

  // Delete Agent
  const handleDeleteAgent = (agent: UserProfile) => {
    setConfirmState({
      title: `Remove Agent "${agent.displayName}"`,
      message:
        'Their account access will be removed, while all existing property listings they submitted will remain safely preserved in Firestore.',
      confirmLabel: 'Delete Agent',
      isDestructive: true,
      onConfirm: async () => {
        try {
          try {
            await deleteDoc(doc(db, 'users', agent.uid));
          } catch (dbErr) {
            console.warn('Firestore delete note:', dbErr);
          }

          try {
            const token = await user?.getIdToken();
            if (token) {
              await fetch(`/api/admin/agents/${agent.uid}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
            }
          } catch {}

          setAgents((prev) => prev.filter((a) => a.uid !== agent.uid));
          setActionNotice({ type: 'success', text: `Removed agent "${agent.displayName}".` });
        } catch (err: any) {
          setActionNotice({ type: 'error', text: `Failed to delete agent: ${err.message}` });
        }
      },
    });
  };

  // Super Admin: Create Editor Account
  const handleCreateEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const email = newEditorEmail.trim().toLowerCase();
    const displayName = newEditorName.trim();
    if (!email || !displayName) {
      setActionError('Full name and work email are required.');
      return;
    }

    setIsCreatingEditor(true);
    try {
      const { profile: editorProfile, warning } = await createEditorAccount(user, {
        displayName,
        email,
        password: newEditorPassword.trim() || undefined,
      });

      setCreatedEditorInfo({
        email: editorProfile.email,
        pass: editorProfile.temporaryPassword || newEditorPassword.trim() || '(Google Sign-In)',
        warning,
      });
      setNewEditorName('');
      setNewEditorEmail('');
      setNewEditorPassword('');
      setEditors((prev) => [editorProfile, ...prev.filter((ed) => ed.uid !== editorProfile.uid)]);
      loadEditors();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create editor account.');
    } finally {
      setIsCreatingEditor(false);
    }
  };

  // Super Admin: Assign Role between Editor and Agent
  const handleAssignRole = async (targetUser: UserProfile, targetRole: 'editor' | 'agent') => {
    setActionNotice(null);
    try {
      const updated = await assignStaffRole(user, targetUser, targetRole);
      if (targetRole === 'editor') {
        setAgents((prev) => prev.filter((a) => a.uid !== targetUser.uid));
        setEditors((prev) => [updated, ...prev.filter((ed) => ed.uid !== targetUser.uid)]);
      } else {
        setEditors((prev) => prev.filter((ed) => ed.uid !== targetUser.uid));
        setAgents((prev) => [updated, ...prev.filter((a) => a.uid !== targetUser.uid)]);
      }
      setActionNotice({
        type: 'success',
        text: `Updated ${targetUser.displayName}'s role to ${targetRole.toUpperCase()}.`,
      });
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: `Could not update role: ${err?.message || 'Permission denied'}`,
      });
    }
  };

  // Super Admin: Disable / Enable Editor
  const handleToggleEditorStatus = async (editor: UserProfile) => {
    setActionNotice(null);
    try {
      const updated = await toggleEditorAccountStatus(user, editor);
      setEditors((prev) => prev.map((ed) => (ed.uid === editor.uid ? updated : ed)));
      setActionNotice({
        type: 'success',
        text: `Editor "${editor.displayName}" is now ${updated.status}.`,
      });
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: `Failed to update editor status: ${err?.message || 'Permission denied'}`,
      });
    }
  };

  // Super Admin: Initiate Editor Password Reset
  const handleResetEditorPassword = async (editor: UserProfile) => {
    setActionNotice(null);
    try {
      const res = await resetEditorPassword(user, editor);
      setResetLinkModal({
        email: editor.email,
        resetEmailSent: res.resetEmailSent,
        resetLink: res.resetLink,
        note: res.note,
      });
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: `Password reset failed: ${err?.message || 'Error'}`,
      });
    }
  };

  // Super Admin: Remove Editor Access (preserves all content)
  const handleRemoveEditorAccess = (editor: UserProfile) => {
    setConfirmState({
      title: `Remove Editor Access for "${editor.displayName}"`,
      message:
        'This revokes their Editor login and access immediately. All Properties, Buildings, and Neighborhood guides they created or edited remain safely intact.',
      confirmLabel: 'Remove Editor Access',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await removeEditorAccountAccess(user, editor);
          setEditors((prev) => prev.filter((ed) => ed.uid !== editor.uid));
          setActionNotice({
            type: 'success',
            text: `Removed Editor access for "${editor.displayName}".`,
          });
        } catch (err: any) {
          setActionNotice({
            type: 'error',
            text: `Could not remove editor access: ${err?.message || 'Permission denied'}`,
          });
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F7F3] flex flex-col selection:bg-[#C6A878]/30">
      {/* Top Navbar */}
      <header className="bg-[#17243B] text-white px-3 sm:px-8 py-3.5 flex items-center justify-between gap-2 border-b border-white/10 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#C6A878]/20 border border-[#C6A878]/40 flex items-center justify-center text-[#C6A878] flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold font-serif tracking-wide text-white truncate">
              Cebu Prime • Super Admin
            </h1>
            <p className="text-[11px] sm:text-xs text-[#C6A878] truncate">
              {profile?.displayName || 'Martiligando@gmail.com'} (Master Authority)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onViewPublicSite}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 min-h-[40px] rounded-lg border border-white/20 text-white/80 hover:text-white hover:bg-white/10 text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap"
          >
            <span className="hidden xs:inline sm:inline">Public Website</span>
            <span className="xs:hidden sm:hidden">Site</span>
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

      {/* Main Layout: Navy Sidebar + Ivory Main Content */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navy Sidebar */}
        <aside className="w-full md:w-64 bg-[#17243B] text-white flex-shrink-0 p-3 sm:p-4 border-b md:border-b-0 md:border-r border-white/10 flex flex-row md:flex-col gap-2 overflow-x-auto">
          <div className="hidden md:block px-3 py-2 text-[10px] uppercase font-bold text-white/50 tracking-wider">
            Management Modules
          </div>

          {/* 1. Overview */}
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
              <TrendingUp className="w-4 h-4 flex-shrink-0" />
              <span>Overview</span>
            </div>
            <span className="hidden md:inline text-[10px] opacity-75">KPIs</span>
          </button>

          {/* 2. Properties */}
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

          {/* 3. Pending Approvals */}
          <button
            type="button"
            onClick={() => setActiveSection('approvals')}
            className={`w-auto md:w-full flex-shrink-0 text-left px-3.5 min-h-[40px] py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
              activeSection === 'approvals'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>Pending Approvals</span>
            </div>
            {pendingApprovals.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#17243B] text-[#C6A878]">
                {pendingApprovals.length}
              </span>
            )}
          </button>

          {/* 4. Buildings */}
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

          {/* 5. Neighborhood & Areas */}
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

          {/* 6. Agents */}
          <button
            type="button"
            onClick={() => setActiveSection('agents')}
            className={`w-auto md:w-full flex-shrink-0 text-left px-3.5 min-h-[40px] py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
              activeSection === 'agents'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>Agents</span>
            </div>
            <span className="text-[10px] opacity-75">{agents.length}</span>
          </button>

          {/* 7. Editors (Super Admin User Role Management) */}
          <button
            type="button"
            onClick={() => setActiveSection('editors')}
            className={`w-auto md:w-full flex-shrink-0 text-left px-3.5 min-h-[40px] py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
              activeSection === 'editors'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <UserCog className="w-4 h-4 flex-shrink-0" />
              <span>Editors</span>
            </div>
            <span className="text-[10px] opacity-75">{editors.length}</span>
          </button>

          {/* 8. Customer Inquiries */}
          <button
            type="button"
            onClick={() => setActiveSection('inquiries')}
            className={`w-auto md:w-full flex-shrink-0 text-left px-3.5 min-h-[40px] py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
              activeSection === 'inquiries'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <span>Inquiries</span>
            </div>
            <span className="text-[10px] opacity-75">{inquiries.length}</span>
          </button>

          {/* 9. Audit Logs */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('audit');
              loadAuditLogs();
            }}
            className={`w-auto md:w-full flex-shrink-0 text-left px-3.5 min-h-[40px] py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
              activeSection === 'audit'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 flex-shrink-0" />
              <span>Audit Logs</span>
            </div>
            <span className="text-[10px] opacity-75">{auditLogs.length}</span>
          </button>

          {/* 10. Website Settings */}
          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className={`w-auto md:w-full flex-shrink-0 text-left px-3.5 min-h-[40px] py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
              activeSection === 'settings'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 flex-shrink-0" />
              <span>Settings</span>
            </div>
            <span className="hidden md:inline text-[10px] opacity-75">Brand</span>
          </button>
        </aside>

        {/* Ivory Main Content Area */}
        <main className="flex-1 p-3 sm:p-8 max-w-7xl w-full mx-auto space-y-5 sm:space-y-6 min-w-0">
          {/* Action Feedback Banner */}
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

          {/* New Inquiries Quick Notice Banner */}
          {inquiries.filter((i) => i.status === 'new').length > 0 && activeSection !== 'inquiries' && (
            <div className="bg-gradient-to-r from-amber-500/10 via-[#C6A878]/15 to-amber-500/10 border border-[#C6A878]/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C6A878] text-[#17243B] flex items-center justify-center font-bold flex-shrink-0 animate-pulse">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#17243B]">
                    {inquiries.filter((i) => i.status === 'new').length} New Client Inquiry Received!
                  </h4>
                  <p className="text-xs text-slate-600">
                    Client consultation & property viewing requests are awaiting your review and response.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveSection('inquiries')}
                className="px-4 py-1.5 rounded-full bg-[#17243B] hover:bg-[#203150] text-[#C6A878] text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>View Inquiries ({inquiries.filter((i) => i.status === 'new').length} New)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* SECTION 1: PENDING APPROVALS */}
          {activeSection === 'approvals' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                    Pending Property Approvals
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Review submissions from contributing agents. Approving a listing immediately publishes it to the public website.
                  </p>
                </div>
                <div className="px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>{pendingApprovals.length} Awaiting Decision</span>
                </div>
              </div>

              {pendingApprovals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pendingApprovals.map((property) => (
                    <div
                      key={property.propertyId}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between"
                    >
                      <div className="relative aspect-[16/10] bg-slate-100">
                        <img
                          src={property.images[0] || '/assets/extracted/photo_the_alcoves.png'}
                          alt={property.propertyTitle}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center gap-1 shadow-md">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {property.hasPendingReview ? 'Revision Review' : 'Pending Submission'}
                          </span>
                        </div>
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-[#17243B]/80 text-[#C6A878] text-[10px] font-bold uppercase backdrop-blur-sm">
                          {property.listingType === 'sale' ? 'For Sale' : 'For Rent'}
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span className="font-bold text-[#C6A878] uppercase">{property.location}</span>
                            <span>Agent: {property.agentName}</span>
                          </div>
                          <h3 className="text-lg font-bold text-[#17243B]">
                            {property.propertyTitle}
                          </h3>
                          <p className="text-sm font-bold text-slate-800 mt-1">
                            ₱{property.price.toLocaleString()} • {property.bedrooms} Bed • {property.bathrooms} Bath • {property.floorArea} sqm
                          </p>
                          <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                            {property.description}
                          </p>
                        </div>

                        {/* Revision notice */}
                        {property.hasPendingReview && property.pendingChanges && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                            <span className="font-bold">Agent Revision:</span> New price or description requested. Current live listing remains approved.
                          </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                          <button
                            onClick={() => onSelectPropertyPreview(property)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#17243B]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview Full Listing</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openRejectDialog(property)}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>

                            <button
                              onClick={() => handleApprove(property)}
                              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <h3 className="text-base font-bold text-slate-700">All caught up!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    There are no pending property listings or revisions awaiting review.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: ALL PROPERTIES */}
          {activeSection === 'properties' && (() => {
            const filteredAdminProperties = properties.filter((p) => {
              if (propertyStatusFilter !== 'all' && p.status !== propertyStatusFilter) return false;
              if (propertySearch) {
                const q = propertySearch.toLowerCase();
                return (
                  p.propertyTitle.toLowerCase().includes(q) ||
                  p.location.toLowerCase().includes(q) ||
                  p.buildingName.toLowerCase().includes(q)
                );
              }
              return true;
            });
            const pagedAdminProps = paginateItems(filteredAdminProperties, adminPropsPage, 10);

            return (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                      Portfolio Properties Directory
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Complete oversight of all Cebu properties, across all agents and publication states.
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
                    <span>Add Property as Admin</span>
                  </button>
                </div>

                {/* Filters Bar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <input
                      type="text"
                      value={propertySearch}
                      onChange={(e) => setPropertySearch(e.target.value)}
                      placeholder="Search properties, towers, locations..."
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

                {/* Properties Table */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-[#17243B] text-white uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-5 py-3.5">Property</th>
                          <th className="px-4 py-3.5">Location</th>
                          <th className="px-4 py-3.5">Price (PHP)</th>
                          <th className="px-4 py-3.5">Agent</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-center">Featured</th>
                          <th className="px-5 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pagedAdminProps.items.map((prop) => (
                          <tr key={prop.propertyId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-semibold text-slate-900">
                              <div className="flex items-center gap-3">
                                <img
                                  src={prop.images[0] || '/assets/extracted/photo_the_alcoves.png'}
                                  alt=""
                                  className="w-10 h-8 rounded-lg object-cover flex-shrink-0"
                                />
                                <div className="min-w-0">
                                  <span className="font-bold block truncate max-w-[200px]">
                                    {prop.propertyTitle}
                                  </span>
                                  <span className="block text-[10px] text-slate-400 truncate max-w-[200px]">
                                    {prop.buildingName}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">{prop.location}</td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">
                              ₱{prop.price.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{prop.agentName}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <select
                                aria-label={`Status for ${prop.propertyTitle}`}
                                value={prop.status}
                                onChange={(e) =>
                                  handleChangePropertyStatus(
                                    prop,
                                    e.target.value as PropertyDoc['status']
                                  )
                                }
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border focus:outline-none cursor-pointer ${
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
                                <option value="approved">approved</option>
                                <option value="pending">pending</option>
                                <option value="rejected">rejected</option>
                                <option value="draft">draft</option>
                                <option value="archived">archived</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => handleToggleFeatured(prop, e)}
                                title={prop.featured ? 'Remove featured' : 'Make featured'}
                                className="p-1.5 hover:scale-110 transition-transform"
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    prop.featured
                                      ? 'fill-[#C6A878] text-[#C6A878]'
                                      : 'text-slate-300'
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
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
                                  title="Edit Listing"
                                  aria-label={`Edit ${prop.propertyTitle}`}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#17243B] hover:bg-slate-100"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                {prop.status === 'archived' ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleChangePropertyStatus(prop, prop.previousStatus || 'draft')
                                    }
                                    title="Restore Archived Property"
                                    aria-label={`Restore ${prop.propertyTitle}`}
                                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleChangePropertyStatus(prop, 'archived')}
                                    title="Archive Property"
                                    aria-label={`Archive ${prop.propertyTitle}`}
                                    className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteProperty(prop, e)}
                                  title="Delete Property"
                                  aria-label={`Delete ${prop.propertyTitle}`}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {pagedAdminProps.items.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              No properties match your active search or status filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {pagedAdminProps.totalPages > 1 && (
                    <div className="px-5 py-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
                      <span className="text-xs text-slate-500">
                        Page {pagedAdminProps.currentPage} of {pagedAdminProps.totalPages} ({pagedAdminProps.totalItems} listings)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={pagedAdminProps.currentPage <= 1}
                          onClick={() => setAdminPropsPage((p) => Math.max(1, p - 1))}
                          className="inline-flex items-center gap-1 px-3 min-h-[36px] rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 text-xs font-semibold whitespace-nowrap"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev</span>
                        </button>
                        <button
                          type="button"
                          disabled={pagedAdminProps.currentPage >= pagedAdminProps.totalPages}
                          onClick={() =>
                            setAdminPropsPage((p) => Math.min(pagedAdminProps.totalPages, p + 1))
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

          {/* SECTION 3: AGENT MANAGEMENT */}
          {activeSection === 'agents' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                    Agent Contributor Management
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Create, search, disable, or delete Agent accounts. Agents can submit listings but cannot directly publish without your approval.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setCreatedAgentInfo(null);
                    setIsCreateAgentOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#17243B] text-[#C6A878] font-bold text-xs shadow-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Agent Account</span>
                </button>
              </div>

              {/* Agent Search */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    placeholder="Search agents by name or email..."
                    className="w-full px-3.5 py-2 pl-9 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Agent Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-[#17243B] text-white uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5">Agent Name</th>
                        <th className="px-4 py-3.5">Work Email</th>
                        <th className="px-4 py-3.5">Account Status</th>
                        <th className="px-4 py-3.5">Created Date</th>
                        <th className="px-4 py-3.5">Submitted Listings</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {agents
                        .filter(
                          (a) =>
                            a.displayName.toLowerCase().includes(agentSearch.toLowerCase()) ||
                            a.email.toLowerCase().includes(agentSearch.toLowerCase())
                        )
                        .map((agent) => (
                          <tr key={agent.uid} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-slate-900">
                              {agent.displayName}
                            </td>
                            <td className="px-4 py-3.5 text-slate-600">{agent.email}</td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                  agent.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {agent.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500">
                              {new Date(agent.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-semibold text-slate-900">
                                {agent.totalProperties || 0} listings
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                ({agent.approvedCount || 0} approved, {agent.pendingCount || 0} pending)
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAssignRole(agent, 'editor')}
                                  title="Assign Editor role to this staff member"
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 transition-colors whitespace-nowrap"
                                >
                                  <UserCog className="w-3.5 h-3.5" />
                                  <span>Make Editor</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleProvisionAgentAuth(agent)}
                                  title="Provision / View Firebase Auth Login"
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-[#C6A878] hover:text-[#17243B] flex items-center gap-1 transition-colors whitespace-nowrap"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                  <span>Sync Auth</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleAgentStatus(agent)}
                                  title={agent.status === 'active' ? 'Disable Agent' : 'Enable Agent'}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap ${
                                    agent.status === 'active'
                                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                >
                                  {agent.status === 'active' ? (
                                    <>
                                      <UserX className="w-3.5 h-3.5" />
                                      <span>Disable</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-3.5 h-3.5" />
                                      <span>Enable</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteAgent(agent)}
                                  title="Delete Agent"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3B: EDITOR ACCOUNT & ROLE MANAGEMENT (SUPER ADMIN ONLY) */}
          {activeSection === 'editors' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                    Editorial Staff &amp; Role Management
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Create Editor accounts, assign Editor roles, initiate password resets, disable logins, or revoke Editor access. Editors maintain content across Properties, Buildings, and Neighborhoods without Super Admin access.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCreatedEditorInfo(null);
                    setActionError(null);
                    setIsCreateEditorOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#17243B] hover:bg-[#253754] text-[#C6A878] font-bold text-xs shadow-md transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Editor Account</span>
                </button>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    value={editorSearch}
                    onChange={(e) => setEditorSearch(e.target.value)}
                    placeholder="Search editors by name or email..."
                    className="w-full px-3.5 py-2 pl-9 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
                <span className="text-xs text-slate-500">
                  {editors.filter((ed) => ed.status === 'active').length} active of {editors.length} editors
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-[#17243B] text-white uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5">Editor Name</th>
                        <th className="px-4 py-3.5">Work Email</th>
                        <th className="px-4 py-3.5">Role</th>
                        <th className="px-4 py-3.5">Account Status</th>
                        <th className="px-4 py-3.5">Created Date</th>
                        <th className="px-5 py-3.5 text-right">Super Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editors
                        .filter(
                          (ed) =>
                            ed.displayName.toLowerCase().includes(editorSearch.toLowerCase()) ||
                            ed.email.toLowerCase().includes(editorSearch.toLowerCase())
                        )
                        .map((ed) => (
                          <tr key={ed.uid} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                              {ed.displayName}
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                              {ed.email}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800">
                                {ed.role}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                  ed.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {ed.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                              {ed.createdAt ? new Date(ed.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleResetEditorPassword(ed)}
                                  title="Send / generate password reset"
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-[#C6A878] hover:text-[#17243B] flex items-center gap-1 transition-colors whitespace-nowrap"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                  <span>Reset Password</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleEditorStatus(ed)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap ${
                                    ed.status === 'active'
                                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                >
                                  {ed.status === 'active' ? (
                                    <>
                                      <UserX className="w-3.5 h-3.5" />
                                      <span>Disable</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-3.5 h-3.5" />
                                      <span>Enable</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleAssignRole(ed, 'agent')}
                                  title="Reassign role to Agent"
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap"
                                >
                                  Make Agent
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditorAccess(ed)}
                                  title="Remove Editor access"
                                  aria-label={`Remove Editor access for ${ed.displayName}`}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center gap-1 transition-colors whitespace-nowrap"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Remove Access</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      {editors.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            {isLoadingEditors
                              ? 'Loading Editor accounts...'
                              : 'No Editor accounts configured yet. Click "Create Editor Account" above to onboard editorial staff.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: OVERVIEW / KPIS */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Top Banner */}
              <div className="bg-gradient-to-r from-[#17243B] to-[#253754] text-white p-6 sm:p-8 rounded-2xl shadow-sm border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C6A878] mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span>Real Estate Performance Pulse</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold font-serif text-white">
                    Super Admin Operations Hub
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 max-w-xl">
                    Live system metrics across inventory, agent submissions, pending approvals, client inquiries, and verified building developments in Cebu.
                  </p>
                </div>
                <button
                  onClick={() => setActiveSection('approvals')}
                  className="px-4 py-2.5 rounded-xl bg-[#C6A878] text-[#17243B] font-bold text-xs hover:bg-[#b89764] transition-colors shadow-sm whitespace-nowrap flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>Review Approvals ({pendingApprovals.length})</span>
                </button>
              </div>

              {/* 6 Key Stat KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5 sm:gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Properties</span>
                    <Building className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-[#17243B] font-sans">
                      {properties.length}
                    </div>
                    <span className="text-[10px] text-slate-500">Across {locationsList.length} districts</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-emerald-600 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Approved Live</span>
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-sans">
                      {properties.filter((p) => p.status === 'approved').length}
                    </div>
                    <span className="text-[10px] text-emerald-700">Publicly visible</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-amber-600 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Pending Review</span>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 font-sans">
                      {pendingApprovals.length}
                    </div>
                    <span className="text-[10px] text-amber-700">Action required</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-rose-600 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Rejected</span>
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 font-sans">
                      {properties.filter((p) => p.status === 'rejected').length}
                    </div>
                    <span className="text-[10px] text-rose-700">With feedback</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-indigo-600 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Agents</span>
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700 font-sans">
                      {agents.length}
                    </div>
                    <span className="text-[10px] text-indigo-600">Authorized staff</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-teal-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-teal-600 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Inquiries</span>
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-teal-700 font-sans">
                      {inquiries.length}
                    </div>
                    <span className="text-[10px] text-teal-600">Client leads</span>
                  </div>
                </div>
              </div>

              {/* Distribution & Breakdown Summary Visuals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Location Distribution Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-sm text-[#17243B] flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#C6A878]" />
                      <span>Properties by Cebu District</span>
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">{locationsList.length} Areas</span>
                  </div>

                  <div className="space-y-3">
                    {locationsList.map((locObj) => {
                      const loc = locObj.name;
                      const count = properties.filter(
                        (p) => p.location.toLowerCase() === loc.toLowerCase()
                      ).length;
                      const percentage = properties.length > 0 ? (count / properties.length) * 100 : 0;
                      return (
                        <div key={locObj.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-700">{loc}</span>
                            <span className="text-slate-500 font-mono">{count} ({percentage.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#17243B] rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Listing Type & Status Breakdown */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-sm text-[#17243B] flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-[#C6A878]" />
                      <span>Listing Type & Inquiry Pipeline</span>
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">Live Status</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">For Sale</span>
                      <div className="text-xl font-extrabold text-[#17243B] mt-1">
                        {properties.filter((p) => p.listingType === 'sale').length}
                      </div>
                      <span className="text-[10px] text-slate-400">Ownership properties</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">For Rent / Lease</span>
                      <div className="text-xl font-extrabold text-[#17243B] mt-1">
                        {properties.filter((p) => p.listingType === 'rent').length}
                      </div>
                      <span className="text-[10px] text-slate-400">Rental listings</span>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                      <span className="text-[11px] font-bold text-amber-700 uppercase">Featured Properties</span>
                      <div className="text-xl font-extrabold text-amber-800 mt-1">
                        {properties.filter((p) => p.featured).length}
                      </div>
                      <span className="text-[10px] text-amber-600">Hero & homepage showcased</span>
                    </div>

                    <div className="p-4 rounded-xl bg-teal-50 border border-teal-100">
                      <span className="text-[11px] font-bold text-teal-700 uppercase">New Inquiries</span>
                      <div className="text-xl font-extrabold text-teal-800 mt-1">
                        {inquiries.filter((i) => i.status === 'new').length}
                      </div>
                      <span className="text-[10px] text-teal-600">Awaiting contact</span>
                    </div>
                  </div>

                  {/* Quick Action Shortcuts */}
                  <div className="pt-2 flex flex-wrap gap-2 text-xs">
                    <button
                      onClick={() => setActiveSection('properties')}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                    >
                      Manage Properties →
                    </button>
                    <button
                      onClick={() => setActiveSection('agents')}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                    >
                      Manage Agents →
                    </button>
                    <button
                      onClick={() => setActiveSection('settings')}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                    >
                      Website Settings →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: BUILDINGS & DEVELOPMENTS */}
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
                      Manage building architecture, cover &amp; gallery images, coordinates, SEO, and publication state.
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

                {/* Filter Tabs */}
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
                                <button
                                  type="button"
                                  onClick={() => requestDeleteBuilding(bld)}
                                  title="Delete Building"
                                  aria-label={`Delete ${bld.buildingName}`}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

          {/* SECTION 5: NEIGHBORHOOD & AREAS MANAGEMENT */}
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
                      Cebu Prime Neighborhood &amp; Areas
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Manage neighborhood guides, highlights, transit, cover &amp; gallery images, SEO, and publication state.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3.5 py-1.5 rounded-full bg-slate-100 text-[#17243B] text-xs font-bold whitespace-nowrap">
                      {locationsList.length} Areas
                    </span>
                    <button
                      type="button"
                      onClick={openAddLocationModal}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17243B] hover:bg-[#253754] text-[#C6A878] font-bold text-xs shadow-md transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 flex-shrink-0" />
                      <span>Add Neighborhood</span>
                    </button>
                  </div>
                </div>

                {/* Filter Tabs */}
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
                                  onClick={() => openEditLocationModal(loc)}
                                  title="Edit Neighborhood"
                                  aria-label={`Edit ${loc.name}`}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#17243B] hover:bg-slate-100 transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestDeleteLocation(loc)}
                                  title="Delete Neighborhood"
                                  aria-label={`Delete ${loc.name}`}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

          {/* SECTION 7: CUSTOMER INQUIRIES */}
          {activeSection === 'inquiries' && (
            <div className="space-y-6">
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                    Client Consultation &amp; Viewing Inquiries
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Confidential leads routed to{' '}
                    <strong className="text-[#17243B]">
                      {siteSettings.inquiryNotificationEmail || 'Martiligando@gmail.com'}
                    </strong>
                    . Track status from New to Contacted and Closed, or inspect generated email notifications.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-bold whitespace-nowrap">
                    {inquiries.filter((i) => i.status === 'new').length} New
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold whitespace-nowrap">
                    {inquiries.length} Total
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-[#17243B] text-white uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5">Client Name</th>
                        <th className="px-4 py-3.5">Contact Details</th>
                        <th className="px-4 py-3.5">Property of Interest</th>
                        <th className="px-4 py-3.5">Routed Email</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5 text-center">Quick Reply &amp; Notification</th>
                        <th className="px-5 py-3.5 text-right">Update Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inquiries.length > 0 ? (
                        inquiries.map((inq) => {
                          const isUpdating = inquiryStatusUpdating === inq.inquiryId;
                          const assignedRecipient =
                            inq.recipientEmail ||
                            siteSettings.inquiryNotificationEmail ||
                            'Martiligando@gmail.com';
                          const mailSubject = encodeURIComponent(
                            `Cebu Prime Properties: Regarding your inquiry on ${inq.propertyInterest}`
                          );
                          const mailBody = encodeURIComponent(
                            `Hello ${inq.fullName},\n\nThank you for reaching out to Cebu Prime Properties regarding ${inq.propertyInterest}.\n\n`
                          );

                          return (
                            <tr key={inq.inquiryId} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                                {inq.fullName}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="font-semibold text-slate-800">{inq.email}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {inq.phone} • {inq.preferredContact || 'phone'}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 font-semibold text-[#C6A878]">
                                <div className="max-w-[180px] truncate" title={inq.propertyInterest}>
                                  {inq.propertyInterest}
                                </div>
                                <div className="text-[11px] text-slate-500 font-normal line-clamp-1" title={inq.message}>
                                  {inq.message || 'Standard brochure & private viewing request.'}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-mono">
                                  <Mail className="w-3 h-3 text-[#C6A878]" />
                                  <span>{assignedRecipient}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-slate-400 whitespace-nowrap">
                                {new Date(inq.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                    inq.status === 'new'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : inq.status === 'contacted'
                                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  }`}
                                >
                                  {inq.status || 'new'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setViewingInquiryEmail(inq)}
                                    title="View formatted notification email message"
                                    className="px-2.5 py-1.5 rounded-lg bg-[#17243B] hover:bg-[#253754] text-[#C6A878] text-[10px] font-bold transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                                  >
                                    <FileText className="w-3 h-3 flex-shrink-0" />
                                    <span>View Email</span>
                                  </button>
                                  <a
                                    href={`mailto:${inq.email}?subject=${mailSubject}&body=${mailBody}`}
                                    title={`Email ${inq.email}`}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#C6A878] hover:text-[#17243B] text-slate-700 transition-colors inline-flex items-center justify-center"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                  </a>
                                  <a
                                    href={`tel:${inq.phone}`}
                                    title={`Call ${inq.phone}`}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 transition-colors inline-flex items-center justify-center"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isUpdating || inq.status === 'new'}
                                    onClick={() => handleUpdateInquiryStatus(inq.inquiryId, 'new')}
                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-colors whitespace-nowrap ${
                                      inq.status === 'new'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    New
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUpdating || inq.status === 'contacted'}
                                    onClick={() => handleUpdateInquiryStatus(inq.inquiryId, 'contacted')}
                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-colors whitespace-nowrap ${
                                      inq.status === 'contacted'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    Contacted
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUpdating || inq.status === 'closed'}
                                    onClick={() => handleUpdateInquiryStatus(inq.inquiryId, 'closed')}
                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-colors whitespace-nowrap ${
                                      inq.status === 'closed'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    Closed
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteInquiry(inq.inquiryId)}
                                    title="Delete inquiry"
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            No inquiries recorded yet. Inquiries submitted on the website appear here automatically in real time.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7B: CONTENT AUDIT LOGS (SUPER ADMIN ONLY) */}
          {activeSection === 'audit' && (() => {
            const filteredLogs = auditLogs.filter((log) => {
              if (auditTypeFilter !== 'all' && log.contentType !== auditTypeFilter) return false;
              if (auditSearch.trim()) {
                const q = auditSearch.toLowerCase();
                return (
                  (log.contentTitle || '').toLowerCase().includes(q) ||
                  (log.editorName || '').toLowerCase().includes(q) ||
                  (log.editorEmail || '').toLowerCase().includes(q) ||
                  (log.summary || '').toLowerCase().includes(q)
                );
              }
              return true;
            });

            return (
              <div className="space-y-6">
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                      Editorial Content Audit Trail
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Immutable record of all Editor and Admin content edits across Properties, Buildings, and Neighborhood guides.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={loadAuditLogs}
                    disabled={isLoadingAuditLogs}
                    className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#17243B] text-xs font-semibold whitespace-nowrap disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAuditLogs ? 'animate-spin' : ''}`} />
                    <span>Refresh Logs</span>
                  </button>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <input
                      type="text"
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      placeholder="Filter by editor, email, or record title..."
                      className="w-full h-10 px-3.5 pl-9 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs pb-1 sm:pb-0">
                    {(['all', 'property', 'building', 'neighborhood'] as const).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setAuditTypeFilter(t)}
                        className={`px-3.5 min-h-[36px] rounded-full font-semibold capitalize transition-colors whitespace-nowrap ${
                          auditTypeFilter === t
                            ? 'bg-[#17243B] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-[#17243B] text-white uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-5 py-3.5">Timestamp</th>
                          <th className="px-4 py-3.5">Staff Member</th>
                          <th className="px-4 py-3.5">Action</th>
                          <th className="px-4 py-3.5">Content Record</th>
                          <th className="px-4 py-3.5">Changed Fields</th>
                          <th className="px-5 py-3.5">Summary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredLogs.map((log) => (
                          <tr key={log.logId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{log.editorName || 'Staff'}</div>
                              <div className="text-[10px] text-slate-500">
                                {log.editorEmail} • <span className="uppercase font-semibold">{log.editorRole}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-[#17243B] border border-slate-200">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] uppercase font-bold text-[#C6A878] block">
                                {log.contentType}
                              </span>
                              <span className="font-semibold text-slate-800">{log.contentTitle}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {(log.changedFields || []).map((field) => (
                                  <span
                                    key={field}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]"
                                  >
                                    {field}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-5 py-3 text-slate-600 max-w-[260px]">
                              {log.summary}
                            </td>
                          </tr>
                        ))}
                        {filteredLogs.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              {isLoadingAuditLogs
                                ? 'Loading editorial audit logs...'
                                : 'No editorial content changes recorded yet.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* SECTION 8: WEBSITE SETTINGS */}
          {activeSection === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                    Website Brand &amp; Showcase Settings
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Update website branding, hero background slides, contact information, and social links in real time without code deployment.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {settingsSaveSuccess && (
                    <div className="px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Settings Saved to Firestore!</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSaveSettings()}
                    disabled={isSavingSettings || uploadingSlideIdx !== null}
                    className="inline-flex items-center gap-2 px-4 min-h-[40px] rounded-xl bg-[#17243B] hover:bg-[#253754] text-[#C6A878] font-bold text-xs shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{isSavingSettings ? 'Saving...' : 'Save Settings'}</span>
                  </button>
                </div>
              </div>

              {settingsSaveError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="font-medium">{settingsSaveError}</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* Branding & Hero Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-[#17243B] flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Globe className="w-4 h-4 text-[#C6A878]" />
                    <span>Brand Identity &amp; Hero Showcase</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Brand Name</label>
                      <input
                        type="text"
                        value={siteSettings.siteName}
                        onChange={(e) => setSiteSettings({ ...siteSettings, siteName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-serif"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Subtitle / Descriptor</label>
                      <input
                        type="text"
                        value={siteSettings.logoSubtitle}
                        onChange={(e) => setSiteSettings({ ...siteSettings, logoSubtitle: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs uppercase tracking-wider"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Hero Kicker / Badge</label>
                      <input
                        type="text"
                        value={siteSettings.heroBadge}
                        onChange={(e) => setSiteSettings({ ...siteSettings, heroBadge: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Hero Headline</label>
                      <input
                        type="text"
                        value={siteSettings.heroHeadline}
                        onChange={(e) => setSiteSettings({ ...siteSettings, heroHeadline: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Hero Subheading</label>
                      <textarea
                        value={siteSettings.heroSubheading}
                        onChange={(e) => setSiteSettings({ ...siteSettings, heroSubheading: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Landing Page Photographs & Hero Showcase Carousel */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold text-sm text-[#17243B] flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#C6A878]" />
                        <span>Landing Page Media &amp; Hero Showcase Slides</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Master Authority controls for homepage carousel slides. Uploading a new photo automatically publishes it to the homepage hero; click Save Settings after editing text or pasted URLs.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const newSlide: HeroSlideConfig = {
                          id: Date.now(),
                          label: `0${(siteSettings.heroSlides?.length || 0) + 1}`,
                          location: 'Cebu Business Park',
                          image: '/assets/extracted/hero_skyline_clean.png',
                          headlineLine1: 'Luxury Redefined',
                          headlineLine2: 'In Cebu Metro',
                          subheading: 'Premium residences in premier locations.',
                        };
                        setSiteSettings({
                          ...siteSettings,
                          heroSlides: [...(siteSettings.heroSlides || []), newSlide],
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#17243B] hover:text-[#C6A878] text-slate-700 font-semibold text-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Carousel Slide</span>
                    </button>
                  </div>

                  {/* Slides List */}
                  <div className="space-y-4">
                    {(siteSettings.heroSlides || []).map((slide, sIdx) => (
                      <div
                        key={slide.id || sIdx}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                          <span className="font-bold text-xs text-[#17243B] flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#17243B] text-white text-[10px] flex items-center justify-center font-mono">
                              {sIdx + 1}
                            </span>
                            Slide #{sIdx + 1}: {slide.location || 'Highlight'}
                          </span>

                          {(siteSettings.heroSlides?.length || 0) > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const filtered = (siteSettings.heroSlides || []).filter((_, i) => i !== sIdx);
                                setSiteSettings({ ...siteSettings, heroSlides: filtered });
                              }}
                              className="text-slate-400 hover:text-rose-600 text-xs flex items-center gap-1 font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove Slide</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Image preview & URL */}
                          <div className="md:col-span-5 space-y-2">
                            <div className="aspect-[16/9] rounded-lg overflow-hidden border border-slate-300 bg-slate-200 relative">
                              <img
                                src={slide.image}
                                alt={`Slide ${sIdx + 1} Preview`}
                                onLoad={() => {
                                  if (brokenSlidePreviews[sIdx]) {
                                    setBrokenSlidePreviews((prev) => ({ ...prev, [sIdx]: false }));
                                  }
                                }}
                                onError={() => {
                                  setBrokenSlidePreviews((prev) => ({ ...prev, [sIdx]: true }));
                                }}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              {uploadingSlideIdx === sIdx && (
                                <div className="absolute inset-0 bg-[#17243B]/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white text-xs font-semibold">
                                  <Loader2 className="w-5 h-5 animate-spin text-[#C6A878]" />
                                  <span>Uploading &amp; publishing photo...</span>
                                </div>
                              )}
                              {brokenSlidePreviews[sIdx] && uploadingSlideIdx !== sIdx && (
                                <div className="absolute inset-x-2 bottom-2 px-2.5 py-1.5 rounded-lg bg-amber-950/90 text-amber-100 text-[10px] font-medium flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                  <span>Preview failed to load. Upload a new image or replace this URL.</span>
                                </div>
                              )}
                            </div>

                            {slideFeedback[sIdx] && (
                              <div
                                className={`p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                                  slideFeedback[sIdx].type === 'error'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {slideFeedback[sIdx].type === 'error' ? (
                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                                )}
                                <span>{slideFeedback[sIdx].text}</span>
                              </div>
                            )}

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[11px] font-semibold text-slate-700">
                                  Photo Image URL or Upload
                                </label>
                                <label className="cursor-pointer text-[10px] text-[#C6A878] hover:text-[#17243B] font-semibold flex items-center gap-1">
                                  <Upload className="w-3 h-3" />
                                  <span>{uploadingSlideIdx === sIdx ? 'Uploading...' : 'Upload New Photo'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={uploadingSlideIdx !== null}
                                    className="hidden"
                                    onChange={async (e) => {
                                      const inputEl = e.currentTarget;
                                      const file = inputEl.files?.[0];
                                      if (!file) return;
                                      if (!file.type.startsWith('image/')) {
                                        setSlideFeedback((prev) => ({
                                          ...prev,
                                          [sIdx]: {
                                            type: 'error',
                                            text: 'Please choose a valid image file (PNG, JPG, WEBP).',
                                          },
                                        }));
                                        inputEl.value = '';
                                        return;
                                      }
                                      if (file.size > 10 * 1024 * 1024) {
                                        setSlideFeedback((prev) => ({
                                          ...prev,
                                          [sIdx]: {
                                            type: 'error',
                                            text: 'Image exceeds the 10 MB Storage limit.',
                                          },
                                        }));
                                        inputEl.value = '';
                                        return;
                                      }

                                      setUploadingSlideIdx(sIdx);
                                      setSlideFeedback((prev) => {
                                        const next = { ...prev };
                                        delete next[sIdx];
                                        return next;
                                      });
                                      setBrokenSlidePreviews((prev) => ({ ...prev, [sIdx]: false }));

                                      try {
                                        const res = await uploadSiteAsset(file, 'hero-slides');
                                        const updatedSlides = [...(siteSettings.heroSlides || [])];
                                        updatedSlides[sIdx] = { ...slide, image: res.url };
                                        const nextSettings = syncWebsiteSettingsPayload(
                                          { ...siteSettings, heroSlides: updatedSlides },
                                          DEFAULT_WEBSITE_SETTINGS.heroSlides || []
                                        );
                                        setSiteSettings(nextSettings);

                                        const adminEmail = user?.email || 'Martiligando@gmail.com';
                                        const saved = await saveWebsiteSettings(nextSettings, adminEmail);
                                        setSiteSettings(saved);
                                        if (onSettingsUpdated) onSettingsUpdated(saved);

                                        setSlideFeedback((prev) => ({
                                          ...prev,
                                          [sIdx]: {
                                            type: 'success',
                                            text: 'Uploaded & published to homepage hero.',
                                          },
                                        }));
                                      } catch (err: any) {
                                        const msg =
                                          err?.code === 'storage/unauthorized'
                                            ? 'Firebase Storage blocked the upload. Deploy storage.rules or paste an HTTPS image URL below and click Save Settings.'
                                            : err?.message || 'Could not upload and save hero image.';
                                        setSlideFeedback((prev) => ({
                                          ...prev,
                                          [sIdx]: { type: 'error', text: msg },
                                        }));
                                        setActionNotice({ type: 'error', text: `Slide #${sIdx + 1} upload failed: ${msg}` });
                                      } finally {
                                        setUploadingSlideIdx(null);
                                        inputEl.value = '';
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                              <input
                                type="text"
                                value={slide.image}
                                onChange={(e) => {
                                  const updatedSlides = [...(siteSettings.heroSlides || [])];
                                  updatedSlides[sIdx] = { ...slide, image: e.target.value };
                                  setBrokenSlidePreviews((prev) => ({ ...prev, [sIdx]: false }));
                                  setSiteSettings({ ...siteSettings, heroSlides: updatedSlides });
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                                required
                              />
                            </div>

                            {/* Quick Select Buttons */}
                            <div className="pt-1">
                              <span className="text-[10px] text-slate-500 block mb-1 font-medium">Quick Pick Preset Assets:</span>
                              <div className="flex flex-wrap gap-1 text-[10px]">
                                {[
                                  { label: 'Skyline Clean', url: '/assets/extracted/hero_skyline_clean.png' },
                                  { label: 'Park Avenue', url: '/assets/extracted/photo_park_avenue.png' },
                                  { label: 'Mactan Township', url: '/assets/extracted/loc_mactan.png' },
                                  { label: 'The Alcoves', url: '/assets/extracted/photo_the_alcoves.png' },
                                  { label: 'Astra Centre', url: '/assets/extracted/astra_centre.png' },
                                ].map((preset) => (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => {
                                      const updatedSlides = [...(siteSettings.heroSlides || [])];
                                      updatedSlides[sIdx] = { ...slide, image: preset.url };
                                      setBrokenSlidePreviews((prev) => ({ ...prev, [sIdx]: false }));
                                      setSiteSettings({ ...siteSettings, heroSlides: updatedSlides });
                                    }}
                                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:border-[#C6A878] hover:text-[#17243B] transition-colors"
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Slide Copy */}
                          <div className="md:col-span-7 space-y-2 text-xs">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">District / Location Tag</label>
                              <input
                                type="text"
                                value={slide.location}
                                onChange={(e) => {
                                  const updatedSlides = [...(siteSettings.heroSlides || [])];
                                  updatedSlides[sIdx] = { ...slide, location: e.target.value };
                                  setSiteSettings({ ...siteSettings, heroSlides: updatedSlides });
                                }}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Headline Line 1</label>
                                <input
                                  type="text"
                                  value={slide.headlineLine1}
                                  onChange={(e) => {
                                    const updatedSlides = [...(siteSettings.heroSlides || [])];
                                    updatedSlides[sIdx] = { ...slide, headlineLine1: e.target.value };
                                    setSiteSettings({ ...siteSettings, heroSlides: updatedSlides });
                                  }}
                                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block font-semibold text-slate-700 mb-1">Headline Line 2</label>
                                <input
                                  type="text"
                                  value={slide.headlineLine2}
                                  onChange={(e) => {
                                    const updatedSlides = [...(siteSettings.heroSlides || [])];
                                    updatedSlides[sIdx] = { ...slide, headlineLine2: e.target.value };
                                    setSiteSettings({ ...siteSettings, heroSlides: updatedSlides });
                                  }}
                                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Subheading / Description</label>
                              <textarea
                                rows={2}
                                value={slide.subheading}
                                onChange={(e) => {
                                  const updatedSlides = [...(siteSettings.heroSlides || [])];
                                  updatedSlides[sIdx] = { ...slide, subheading: e.target.value };
                                  setSiteSettings({ ...siteSettings, heroSlides: updatedSlides });
                                }}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inquiry Notification & Email Routing (Master Authority Private Configuration) */}
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="pb-2 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-[#17243B] flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
                        <span>Inquiry Notification &amp; Email Routing</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Assign the private recipient email for all incoming inquiry notifications and customize the email template. This email is kept strictly confidential from public visitors.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Assigned Notification Recipient Email *
                      </label>
                      <input
                        type="email"
                        value={siteSettings.inquiryNotificationEmail || ''}
                        onChange={(e) =>
                          setSiteSettings({
                            ...siteSettings,
                            inquiryNotificationEmail: e.target.value,
                          })
                        }
                        placeholder="advisor@cebuprimeproperties.ph"
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Notification Email Subject Template
                      </label>
                      <input
                        type="text"
                        value={
                          siteSettings.inquiryNotificationSubject ??
                          DEFAULT_INQUIRY_EMAIL_SUBJECT
                        }
                        onChange={(e) =>
                          setSiteSettings({
                            ...siteSettings,
                            inquiryNotificationSubject: e.target.value,
                          })
                        }
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <label className="font-semibold text-slate-700">
                          Notification Email Message Body Template
                        </label>
                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          {[
                            '{{clientName}}',
                            '{{clientEmail}}',
                            '{{clientPhone}}',
                            '{{property}}',
                            '{{message}}',
                            '{{date}}',
                          ].map((token) => (
                            <button
                              key={token}
                              type="button"
                              onClick={() =>
                                setSiteSettings({
                                  ...siteSettings,
                                  inquiryEmailTemplate: `${
                                    siteSettings.inquiryEmailTemplate ??
                                    DEFAULT_INQUIRY_EMAIL_BODY
                                  } ${token}`,
                                })
                              }
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-[#17243B] hover:text-[#C6A878] text-slate-700 font-mono transition-colors whitespace-nowrap"
                            >
                              +{token}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        rows={5}
                        value={
                          siteSettings.inquiryEmailTemplate ??
                          DEFAULT_INQUIRY_EMAIL_BODY
                        }
                        onChange={(e) =>
                          setSiteSettings({
                            ...siteSettings,
                            inquiryEmailTemplate: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Public Confirmation Auto-Reply Message (Shown to Visitors After Submitting)
                      </label>
                      <textarea
                        rows={2}
                        value={siteSettings.inquiryAutoReplyMessage || ''}
                        onChange={(e) =>
                          setSiteSettings({
                            ...siteSettings,
                            inquiryAutoReplyMessage: e.target.value,
                          })
                        }
                        placeholder="A dedicated luxury property specialist will reach out to you shortly..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    {/* Live Email Preview Box */}
                    <div className="sm:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span>Live Notification Email Preview</span>
                        <span className="font-mono text-[#17243B]">
                          To: {siteSettings.inquiryNotificationEmail || 'Martiligando@gmail.com'}
                        </span>
                      </div>
                      {(() => {
                        const preview = formatInquiryNotificationEmail(
                          {
                            subject: siteSettings.inquiryNotificationSubject,
                            body: siteSettings.inquiryEmailTemplate,
                          },
                          {
                            fullName: 'Elena Villanueva',
                            email: 'elena.v@example.com',
                            phone: '+63 917 555 0192',
                            propertyInterest: 'The Alcoves - 18th Floor Residence',
                            message: 'Requesting floor plan and private viewing this Friday.',
                            createdAt: new Date().toISOString(),
                          }
                        );
                        return (
                          <div className="space-y-1.5 text-xs">
                            <div className="font-bold text-[#17243B]">
                              Subject: {preview.subject}
                            </div>
                            <pre className="whitespace-pre-wrap font-sans text-[11px] text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                              {preview.body}
                            </pre>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Contact Information & Channels */}
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-[#17243B] flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Phone className="w-4 h-4 text-[#C6A878]" />
                    <span>Public Corporate Contact Channels</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Public Display Email</label>
                      <input
                        type="email"
                        value={siteSettings.contactEmail}
                        onChange={(e) => setSiteSettings({ ...siteSettings, contactEmail: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Hotline / Contact Number</label>
                      <input
                        type="text"
                        value={siteSettings.contactPhone}
                        onChange={(e) => setSiteSettings({ ...siteSettings, contactPhone: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Physical Office Address</label>
                      <input
                        type="text"
                        value={siteSettings.officeAddress}
                        onChange={(e) => setSiteSettings({ ...siteSettings, officeAddress: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Facebook URL</label>
                      <input
                        type="url"
                        value={siteSettings.facebookUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, facebookUrl: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Instagram URL</label>
                      <input
                        type="url"
                        value={siteSettings.instagramUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, instagramUrl: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="inline-flex items-center gap-2 px-6 min-h-[44px] rounded-xl bg-[#17243B] hover:bg-[#253754] text-[#C6A878] font-bold text-xs shadow-md transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    <Save className="w-4 h-4 flex-shrink-0" />
                    <span>{isSavingSettings ? 'Saving Settings...' : 'Save Website Settings'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: CREATE AGENT ACCOUNT */}
      {isCreateAgentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17243B]/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#17243B] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#C6A878]" />
                <span>Create New Agent Account</span>
              </h3>
              <button
                onClick={() => setIsCreateAgentOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdAgentInfo ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2 text-xs">
                <div className="font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Agent Account Registered!</span>
                </div>
                <p>Provide these login credentials to the Agent:</p>
                <div className="bg-white p-3 rounded-lg border border-emerald-200 font-mono text-[11px] text-slate-800 space-y-1">
                  <div><strong>Email:</strong> {createdAgentInfo.email}</div>
                  <div><strong>Temporary Password:</strong> {createdAgentInfo.pass}</div>
                  <div className="text-[10px] text-slate-500 font-sans mt-1">
                    Connected Firebase Project: <strong>cebu-real-estate-84294</strong>
                  </div>
                </div>

                {createdAgentInfo.warning && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1.5">
                    <p className="font-bold text-amber-800">⚠️ Setup Action Required in Firebase Console:</p>
                    <p>{createdAgentInfo.warning}</p>
                    <div className="pt-1">
                      <a
                        href="https://console.firebase.google.com/project/cebu-real-estate-84294/authentication/providers"
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-bold text-amber-900 hover:text-black inline-flex items-center gap-1"
                      >
                        <span>👉 Click here to enable Email/Password in Firebase Console</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-lg border border-emerald-100">
                  💡 <strong>Google Sign-In:</strong> If preferred, the agent can also simply click <strong>Sign in with Google</strong> on the login portal using their work Google email address ({createdAgentInfo.email}).
                </div>

                <button
                  onClick={() => {
                    setCreatedAgentInfo(null);
                    setIsCreateAgentOpen(false);
                  }}
                  className="w-full mt-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateAgent} className="space-y-3.5 text-xs">
                {actionError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                    {actionError}
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Agent Full Name *
                  </label>
                  <input
                    type="text"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#C6A878]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Work Email Address *
                  </label>
                  <input
                    type="email"
                    value={newAgentEmail}
                    onChange={(e) => setNewAgentEmail(e.target.value)}
                    placeholder="maria.santos@cebuprimeproperties.ph"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#C6A878]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Temporary Password (Optional - leave blank to auto-generate)
                  </label>
                  <input
                    type="text"
                    value={newAgentPassword}
                    onChange={(e) => setNewAgentPassword(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#C6A878]"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateAgentOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#17243B] text-[#C6A878] font-bold"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE EDITOR ACCOUNT (SUPER ADMIN ONLY) */}
      {isCreateEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17243B]/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#17243B] flex items-center gap-2">
                <UserCog className="w-5 h-5 text-[#C6A878]" />
                <span>Create Editorial Staff Account</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateEditorOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdEditorInfo ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2 text-xs">
                <div className="font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Editor Account Created!</span>
                </div>
                <p>Share these login credentials with the Editor:</p>
                <div className="bg-white p-3 rounded-lg border border-emerald-200 font-mono text-[11px] text-slate-800 space-y-1">
                  <div><strong>Email:</strong> {createdEditorInfo.email}</div>
                  <div><strong>Temporary Password:</strong> {createdEditorInfo.pass}</div>
                  <div><strong>Assigned Role:</strong> EDITOR</div>
                </div>
                {createdEditorInfo.warning && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                    {createdEditorInfo.warning}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCreatedEditorInfo(null);
                    setIsCreateEditorOpen(false);
                  }}
                  className="w-full mt-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateEditor} className="space-y-3.5 text-xs">
                {actionError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                    {actionError}
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Editor Full Name *
                  </label>
                  <input
                    type="text"
                    value={newEditorName}
                    onChange={(e) => setNewEditorName(e.target.value)}
                    placeholder="e.g. Camille Reyes"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#C6A878]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Work Email Address *
                  </label>
                  <input
                    type="email"
                    value={newEditorEmail}
                    onChange={(e) => setNewEditorEmail(e.target.value)}
                    placeholder="editor@cebuprimeproperties.ph"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#C6A878]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Temporary Password (Optional)
                  </label>
                  <input
                    type="text"
                    value={newEditorPassword}
                    onChange={(e) => setNewEditorPassword(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#C6A878]"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateEditorOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingEditor}
                    className="px-4 py-2 rounded-xl bg-[#17243B] text-[#C6A878] font-bold disabled:opacity-50"
                  >
                    {isCreatingEditor ? 'Provisioning...' : 'Create Editor Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: PASSWORD RESET STATUS */}
      {resetLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17243B]/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#17243B] flex items-center gap-2">
                <Key className="w-5 h-5 text-[#C6A878]" />
                <span>Editor Password Reset Initiated</span>
              </h3>
              <button
                type="button"
                onClick={() => setResetLinkModal(null)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600">
              Target Account: <strong className="text-[#17243B]">{resetLinkModal.email}</strong>
            </p>
            {resetLinkModal.resetEmailSent && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                Firebase Authentication password reset email dispatched to {resetLinkModal.email}.
              </div>
            )}
            {resetLinkModal.resetLink && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-700 block">Direct Password Reset Link:</span>
                <input
                  type="text"
                  readOnly
                  value={resetLinkModal.resetLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] bg-white"
                />
              </div>
            )}
            {resetLinkModal.note && !resetLinkModal.resetEmailSent && !resetLinkModal.resetLink && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                {resetLinkModal.note}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setResetLinkModal(null)}
                className="px-4 py-2 rounded-xl bg-[#17243B] text-white font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REJECTION REASON */}
      {rejectionModalOpen && reviewingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17243B]/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-rose-700 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span>Reject Property Listing</span>
              </h3>
              <button
                onClick={() => setRejectionModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600">
              Rejecting &quot;<strong>{reviewingProperty.propertyTitle}</strong>&quot; submitted by Agent <strong>{reviewingProperty.agentName}</strong>.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reason for Rejection (Required) *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="e.g. Please upload higher-resolution interior photos and verify the exact floor area square meters..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500"
                required
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                This explanation will be displayed directly on the Agent&apos;s workspace so they can make corrections.
              </span>
            </div>

            {actionError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setRejectionModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

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
      />

      {/* MODAL: VIEW BUILDING PROPERTIES */}
      {viewingBuildingProperties && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17243B]/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="font-bold text-base text-[#17243B] flex items-center gap-2">
                  <Building className="w-5 h-5 text-[#C6A878]" />
                  <span>{viewingBuildingProperties.buildingName} • Units & Residences</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewingBuildingProperties.location} • {viewingBuildingProperties.address}
                </p>
              </div>
              <button
                onClick={() => setViewingBuildingProperties(null)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {properties.filter((p) => p.buildingId === viewingBuildingProperties.buildingId).length > 0 ? (
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
                            ₱{prop.price.toLocaleString()} • {prop.bedrooms} Bed • {prop.floorArea} sqm • Agent: {prop.agentName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            prop.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : prop.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {prop.status}
                        </span>

                        <button
                          onClick={() => {
                            setViewingBuildingProperties(null);
                            onSelectPropertyPreview(prop);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px]"
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
                onClick={() => setViewingBuildingProperties(null)}
                className="px-4 py-2 rounded-xl bg-[#17243B] text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
      />

      {/* MODAL: VIEW INQUIRY NOTIFICATION EMAIL */}
      {viewingInquiryEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17243B]/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => setViewingInquiryEmail(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 text-xs my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const recipient =
                viewingInquiryEmail.recipientEmail ||
                siteSettings.inquiryNotificationEmail ||
                'Martiligando@gmail.com';
              const fallback = formatInquiryNotificationEmail(
                {
                  subject: siteSettings.inquiryNotificationSubject,
                  body: siteSettings.inquiryEmailTemplate,
                },
                {
                  fullName: viewingInquiryEmail.fullName,
                  email: viewingInquiryEmail.email,
                  phone: viewingInquiryEmail.phone,
                  propertyInterest: viewingInquiryEmail.propertyInterest,
                  message: viewingInquiryEmail.message,
                  createdAt: viewingInquiryEmail.createdAt,
                }
              );
              const subject = viewingInquiryEmail.notificationSubject || fallback.subject;
              const body = viewingInquiryEmail.notificationMessage || fallback.body;

              return (
                <>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-base text-[#17243B] flex items-center gap-2">
                      <Mail className="w-5 h-5 text-[#C6A878]" />
                      <span>Inquiry Notification Email</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setViewingInquiryEmail(null)}
                      className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 font-semibold">Assigned Recipient:</span>
                      <span className="font-mono font-bold text-[#17243B]">{recipient}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block mb-0.5">Subject:</span>
                      <div className="font-bold text-[#17243B]">{subject}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">Email Message:</span>
                      <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 bg-white p-3.5 rounded-lg border border-slate-200 leading-relaxed max-h-64 overflow-y-auto">
                        {body}
                      </pre>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                    <a
                      href={`mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                      className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#17243B] font-semibold whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5 text-[#C6A878]" />
                      <span>Forward to Recipient</span>
                    </a>
                    <a
                      href={`mailto:${viewingInquiryEmail.email}?subject=${encodeURIComponent(
                        `Re: Your Cebu Prime Properties Inquiry (${viewingInquiryEmail.propertyInterest})`
                      )}`}
                      className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl bg-[#17243B] hover:bg-[#253754] text-[#C6A878] font-bold whitespace-nowrap"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Reply to Client</span>
                    </a>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Add / Edit Property Modal */}
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
            text: `Property "${savedProp.propertyTitle}" saved (${savedProp.status}).`,
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
        isSuperAdmin={true}
      />

      <ContentPreviewModal
        preview={contentPreview}
        onClose={() => setContentPreview(null)}
        onOpenLivePage={onOpenPublicPath}
      />

      <ConfirmActionModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        isDestructive={confirmState?.isDestructive}
        blockedReason={confirmState?.blockedReason}
        secondaryLabel={confirmState?.secondaryLabel}
        onSecondaryAction={confirmState?.onSecondaryAction}
        isLoading={isConfirmBusy}
        onConfirm={async () => {
          if (!confirmState) return;
          setIsConfirmBusy(true);
          try {
            await confirmState.onConfirm();
          } finally {
            setIsConfirmBusy(false);
            setConfirmState(null);
          }
        }}
        onCancel={() => {
          if (!isConfirmBusy) setConfirmState(null);
        }}
      />
    </div>
  );
};
