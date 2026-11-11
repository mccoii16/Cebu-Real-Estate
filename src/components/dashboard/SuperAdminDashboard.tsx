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
  MessageCircle,
  ArrowRight,
} from 'lucide-react';
import {
  PropertyDoc,
  BuildingDoc,
  UserProfile,
  InquiryDoc,
  WebsiteSettings,
  LocationHighlight,
  HeroSlideConfig,
} from '../../types/property';
import { useAuth } from '../../context/AuthContext';
import { AddPropertyModal } from './AddPropertyModal';
import { doc, updateDoc, deleteDoc, addDoc, collection, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getWebsiteSettings, saveWebsiteSettings, DEFAULT_WEBSITE_SETTINGS } from '../../services/settingsService';
import { getAllLocations, saveLocation, deleteLocation, INITIAL_LOCATIONS } from '../../services/locationService';
import { uploadSiteAsset } from '../../services/storageService';
import { createAgentFirebaseAuthUser } from '../../services/agentAuthService';
import {
  subscribeToInquiries,
  updateInquiryStatus as updateInquiryStatusService,
  deleteInquiry as deleteInquiryService,
} from '../../services/inquiryService';

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
}

export type AdminSection =
  | 'overview'
  | 'properties'
  | 'approvals'
  | 'buildings'
  | 'locations'
  | 'agents'
  | 'inquiries'
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
}) => {
  const { user, profile, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');

  // Locations Management State
  const [locationsList, setLocationsList] = useState<LocationHighlight[]>(
    locations && locations.length > 0 ? locations : INITIAL_LOCATIONS
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationHighlight | null>(null);
  const [locName, setLocName] = useState('');
  const [locTagline, setLocTagline] = useState('');
  const [locDescription, setLocDescription] = useState('');
  const [locImage, setLocImage] = useState('');
  const [isSavingLoc, setIsSavingLoc] = useState(false);

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
  const [createdAgentInfo, setCreatedAgentInfo] = useState<{ email: string; pass: string; warning?: string } | null>(null);

  // Property Filters & Actions
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected' | 'draft'>('all');
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
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newBuildingLocation, setNewBuildingLocation] = useState('Cebu Business Park');
  const [newBuildingAddress, setNewBuildingAddress] = useState('');
  const [newBuildingDescription, setNewBuildingDescription] = useState('');
  const [viewingBuildingProperties, setViewingBuildingProperties] = useState<BuildingDoc | null>(null);

  // Inquiries State
  const [inquiries, setInquiries] = useState<InquiryDoc[]>([]);
  const [inquiryStatusUpdating, setInquiryStatusUpdating] = useState<string | null>(null);

  // Settings State
  const [siteSettings, setSiteSettings] = useState<WebsiteSettings>(DEFAULT_WEBSITE_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);

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

  // Real-time synchronization of customer inquiries (dispatched directly to Martiligando@gmail.com)
  useEffect(() => {
    loadAgents();
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
    try {
      await updateInquiryStatusService(inquiryId, newStatus);
      setInquiries((prev) =>
        prev.map((inq) => (inq.inquiryId === inquiryId ? { ...inq, status: newStatus } : inq))
      );
    } catch (err: any) {
      alert(`Error updating inquiry status: ${err.message}`);
    } finally {
      setInquiryStatusUpdating(null);
    }
  };

  // Delete Inquiry
  const handleDeleteInquiry = async (inquiryId: string) => {
    if (!window.confirm('Are you sure you want to remove this client inquiry record?')) return;
    try {
      await deleteInquiryService(inquiryId);
      setInquiries((prev) => prev.filter((inq) => inq.inquiryId !== inquiryId));
    } catch (err: any) {
      alert(`Could not delete inquiry: ${err.message}`);
    }
  };

  // Location Handlers
  const openAddLocationModal = () => {
    setEditingLocation(null);
    setLocName('');
    setLocTagline('');
    setLocDescription('');
    setLocImage('/assets/extracted/photo_the_alcoves.png');
    setIsLocationModalOpen(true);
  };

  const openEditLocationModal = (loc: LocationHighlight) => {
    setEditingLocation(loc);
    setLocName(loc.name);
    setLocTagline(loc.tagline);
    setLocDescription(loc.description);
    setLocImage(loc.image);
    setIsLocationModalOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName.trim()) {
      alert('District name is required');
      return;
    }
    setIsSavingLoc(true);
    try {
      const id = editingLocation ? editingLocation.id : `loc-${Date.now()}`;
      const locData: LocationHighlight = {
        id,
        name: locName.trim(),
        tagline: locTagline.trim() || 'Premier Real Estate Zone',
        description: locDescription.trim() || 'Desirable neighborhood with top residential developments.',
        image: locImage.trim() || '/assets/extracted/photo_the_alcoves.png',
        propertyCount: properties.filter((p) => p.location.toLowerCase() === locName.trim().toLowerCase()).length,
      };

      await saveLocation(locData);
      const updatedList = editingLocation
        ? locationsList.map((item) => (item.id === id ? locData : item))
        : [...locationsList, locData];

      setLocationsList(updatedList);
      if (onLocationsUpdated) onLocationsUpdated(updatedList);
      setIsLocationModalOpen(false);
    } catch (err: any) {
      alert(`Failed to save location: ${err.message}`);
    } finally {
      setIsSavingLoc(false);
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete district "${name}"?`)) return;
    try {
      await deleteLocation(id);
      const updated = locationsList.filter((l) => l.id !== id);
      setLocationsList(updated);
      if (onLocationsUpdated) onLocationsUpdated(updated);
    } catch (err: any) {
      alert(`Failed to delete location: ${err.message}`);
    }
  };

  // Save Website Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSaveSuccess(false);
    try {
      const adminEmail = user?.email || 'Martiligando@gmail.com';
      const updated = await saveWebsiteSettings(siteSettings, adminEmail);
      setSiteSettings(updated);
      if (onSettingsUpdated) onSettingsUpdated(updated);
      setSettingsSaveSuccess(true);
      setTimeout(() => setSettingsSaveSuccess(false), 4000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
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
      setActionError(`Approval failed: ${err.message}`);
    }
  };

  // Open Rejection Dialog
  const openRejectDialog = (property: PropertyDoc) => {
    setReviewingProperty(property);
    setRejectionReason('');
    setRejectionModalOpen(true);
  };

  // Submit Rejection
  const handleConfirmReject = async () => {
    if (!reviewingProperty) return;
    if (!rejectionReason.trim()) {
      alert('Please enter a constructive rejection reason for the Agent.');
      return;
    }

    try {
      const now = new Date().toISOString();
      const approverId = user?.email || 'admin-super';

      let updatePayload: any;

      if (reviewingProperty.status === 'approved' && reviewingProperty.hasPendingReview) {
        // Revision was rejected: keep live listing approved, record rejection on revision
        updatePayload = {
          hasPendingReview: false,
          rejectionReason: `Revision rejected: ${rejectionReason.trim()}`,
          updatedAt: now,
        };
      } else {
        // Initial submission rejected
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
      alert(`Rejection failed: ${err.message}`);
    }
  };

  // Toggle Featured Status
  const handleToggleFeatured = async (property: PropertyDoc, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newFeatured = !property.featured;
      await updateDoc(doc(db, 'properties', property.propertyId), {
        featured: newFeatured,
        updatedAt: new Date().toISOString(),
      });
      onPropertyUpdated({ ...property, featured: newFeatured });
    } catch (err: any) {
      alert(`Could not toggle featured: ${err.message}`);
    }
  };

  // Delete Property
  const handleDeleteProperty = async (propertyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this property?')) return;
    try {
      await deleteDoc(doc(db, 'properties', propertyId));
      onPropertyDeleted(propertyId);
    } catch (err: any) {
      alert(`Could not delete property: ${err.message}`);
    }
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

      // 1. Register the user in Firebase Authentication using secondary app
      const authResult = await createAgentFirebaseAuthUser(email, temporaryPass, displayName);
      if (authResult.success && authResult.uid) {
        agentUid = authResult.uid;
      } else if (!authResult.success) {
        if (authResult.error === 'auth/operation-not-allowed') {
          warningNotice = 'Email/Password sign-in provider is disabled in Firebase project cebu-real-estate-84294. Please enable Email/Password in Firebase Console (Authentication > Sign-in method) so this agent can log in with their password.';
        } else {
          warningNotice = `Firebase Auth notice: ${authResult.error}. Note that the agent can also sign in with Google using this email address.`;
        }
      }

      // 2. Direct Firestore profile persistence
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

      // 3. Optional backend synchronization
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
      alert(
        'Email/Password sign-in provider is disabled in Firebase project cebu-real-estate-84294. Please enable Email/Password in Firebase Console: https://console.firebase.google.com/project/cebu-real-estate-84294/authentication/providers'
      );
    } else {
      alert(`Could not register in Firebase Auth: ${res.error}`);
    }
  };

  // Disable / Enable Agent
  const handleToggleAgentStatus = async (agent: UserProfile) => {
    const newStatus = agent.status === 'active' ? 'disabled' : 'active';
    try {
      // Direct Firestore update
      try {
        await updateDoc(doc(db, 'users', agent.uid), {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('Firestore status update note:', dbErr);
      }

      // Backend call if available
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
      alert(`Failed to update agent status: ${err.message}`);
    }
  };

  // Delete Agent
  const handleDeleteAgent = async (agent: UserProfile) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${agent.displayName}? Their authentication account will be removed, but all property listings will be preserved safely in the database.`
      )
    )
      return;

    try {
      // Direct Firestore delete
      try {
        await deleteDoc(doc(db, 'users', agent.uid));
      } catch (dbErr) {
        console.warn('Firestore delete note:', dbErr);
      }

      // Backend call if available
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
    } catch (err: any) {
      alert(`Failed to delete agent: ${err.message}`);
    }
  };

  // Add or Edit Building
  const handleAddBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuildingName.trim()) return;

    try {
      if (editingBuilding) {
        // Edit existing building
        const updatedDoc: BuildingDoc = {
          ...editingBuilding,
          buildingName: newBuildingName.trim(),
          location: newBuildingLocation,
          address: newBuildingAddress.trim(),
          description: newBuildingDescription.trim() || 'A premier development in Cebu.',
          updatedAt: new Date().toISOString(),
        };

        await updateDoc(doc(db, 'buildings', editingBuilding.buildingId), updatedDoc as any);
        onBuildingAdded(updatedDoc);
      } else {
        // Add new building
        const bldId = `bld-${Date.now()}`;
        const buildingDoc: BuildingDoc = {
          buildingId: bldId,
          buildingName: newBuildingName.trim(),
          location: newBuildingLocation,
          address: newBuildingAddress.trim(),
          description: newBuildingDescription.trim() || 'A premier development in Cebu.',
          buildingImages: ['/assets/extracted/the_alcoves.png'],
          amenities: ['24/7 Concierge', 'Elevators', 'Swimming Pool', 'Security'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await setDoc(doc(db, 'buildings', bldId), buildingDoc);
        onBuildingAdded(buildingDoc);
      }

      setIsAddBuildingOpen(false);
      setEditingBuilding(null);
      setNewBuildingName('');
      setNewBuildingAddress('');
      setNewBuildingDescription('');
    } catch (err: any) {
      alert(`Could not save building: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F3] flex flex-col selection:bg-[#C6A878]/30">
      {/* Top Navbar */}
      <header className="bg-[#17243B] text-white px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-white/10 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C6A878]/20 border border-[#C6A878]/40 flex items-center justify-center text-[#C6A878]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold font-serif tracking-wide text-white">
              Cebu Prime • Super Admin Control Center
            </h1>
            <p className="text-xs text-[#C6A878]">
              {profile?.displayName || 'Martiligando@gmail.com'} (Master Authority)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={onViewPublicSite}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-white/80 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors"
          >
            <span>Public Website</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Layout: Navy Sidebar + Ivory Main Content */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navy Sidebar */}
        <aside className="w-full md:w-64 bg-[#17243B] text-white flex-shrink-0 p-4 border-r border-white/10 flex flex-row md:flex-col gap-2 overflow-x-auto">
          <div className="hidden md:block px-3 py-2 text-[10px] uppercase font-bold text-white/50 tracking-wider">
            Management Modules
          </div>

          {/* 1. Overview */}
          <button
            onClick={() => setActiveSection('overview')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap ${
              activeSection === 'overview'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4" />
              <span>Overview</span>
            </div>
            <span className="text-[10px] opacity-75">KPIs</span>
          </button>

          {/* 2. Properties */}
          <button
            onClick={() => setActiveSection('properties')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap ${
              activeSection === 'properties'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building className="w-4 h-4" />
              <span>Properties</span>
            </div>
            <span className="text-[10px] opacity-75">{properties.length}</span>
          </button>

          {/* 3. Pending Approvals */}
          <button
            onClick={() => setActiveSection('approvals')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap ${
              activeSection === 'approvals'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4" />
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
            onClick={() => setActiveSection('buildings')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap ${
              activeSection === 'buildings'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4" />
              <span>Buildings</span>
            </div>
            <span className="text-[10px] opacity-75">{buildings.length}</span>
          </button>

          {/* 5. Locations */}
          <button
            onClick={() => setActiveSection('locations')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap ${
              activeSection === 'locations'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4" />
              <span>Locations</span>
            </div>
            <span className="text-[10px] opacity-75">8 Districts</span>
          </button>

          {/* 6. Agents */}
          <button
            onClick={() => setActiveSection('agents')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap ${
              activeSection === 'agents'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4" />
              <span>Agents</span>
            </div>
            <span className="text-[10px] opacity-75">{agents.length}</span>
          </button>

          {/* 7. Customer Inquiries */}
          <button
            onClick={() => setActiveSection('inquiries')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap ${
              activeSection === 'inquiries'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4" />
              <span>Customer Inquiries</span>
            </div>
            <span className="text-[10px] opacity-75">{inquiries.length}</span>
          </button>

          {/* 8. Website Settings */}
          <button
            onClick={() => setActiveSection('settings')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors whitespace-nowrap ${
              activeSection === 'settings'
                ? 'bg-[#C6A878] text-[#17243B] font-bold shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="w-4 h-4" />
              <span>Website Settings</span>
            </div>
            <span className="text-[10px] opacity-75">Brand</span>
          </button>
        </aside>

        {/* Ivory Main Content Area */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
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
          {activeSection === 'properties' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                    Portfolio Properties Directory
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Complete oversight of all Cebu properties, across all agents and publication states.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingProperty(null);
                    setIsAddPropertyOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17243B] text-[#C6A878] font-bold text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
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
                    className="w-full px-3.5 py-2 pl-9 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
                  {(
                    ['all', 'approved', 'pending', 'rejected', 'draft'] as const
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => setPropertyStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-full font-semibold capitalize transition-colors ${
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

              {/* Minimalist Properties Table */}
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
                      {properties
                        .filter((p) => {
                          if (propertyStatusFilter !== 'all' && p.status !== propertyStatusFilter)
                            return false;
                          if (propertySearch) {
                            const q = propertySearch.toLowerCase();
                            return (
                              p.propertyTitle.toLowerCase().includes(q) ||
                              p.location.toLowerCase().includes(q) ||
                              p.buildingName.toLowerCase().includes(q)
                            );
                          }
                          return true;
                        })
                        .map((prop) => (
                          <tr key={prop.propertyId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-semibold text-slate-900 flex items-center gap-3">
                              <img
                                src={prop.images[0] || '/assets/extracted/photo_the_alcoves.png'}
                                alt=""
                                className="w-10 h-8 rounded-lg object-cover"
                              />
                              <div>
                                <span className="font-bold">{prop.propertyTitle}</span>
                                <span className="block text-[10px] text-slate-400">
                                  {prop.buildingName}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">{prop.location}</td>
                            <td className="px-4 py-3 font-medium">₱{prop.price.toLocaleString()}</td>
                            <td className="px-4 py-3 text-slate-500">{prop.agentName}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                  prop.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : prop.status === 'pending'
                                    ? 'bg-amber-100 text-amber-800'
                                    : prop.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {prop.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={(e) => handleToggleFeatured(prop, e)}
                                title={prop.featured ? 'Remove featured' : 'Make featured'}
                                className="p-1 hover:scale-110 transition-transform"
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
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => onSelectPropertyPreview(prop)}
                                  title="Preview"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#17243B] hover:bg-slate-100"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingProperty(prop);
                                    setIsAddPropertyOpen(true);
                                  }}
                                  title="Edit"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#17243B] hover:bg-slate-100"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteProperty(prop.propertyId, e)}
                                  title="Delete"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
                                  onClick={() => handleProvisionAgentAuth(agent)}
                                  title="Provision / View Firebase Auth Login"
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-[#C6A878] hover:text-[#17243B] flex items-center gap-1 transition-colors"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                  <span>Sync Auth</span>
                                </button>

                                <button
                                  onClick={() => handleToggleAgentStatus(agent)}
                                  title={agent.status === 'active' ? 'Disable Agent' : 'Enable Agent'}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
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
                    <span className="text-[10px] text-slate-500">Across 8 districts</span>
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
                    <span className="text-xs text-slate-400 font-medium">8 Locations</span>
                  </div>

                  <div className="space-y-3">
                    {[
                      'Cebu Business Park',
                      'Cebu IT Park',
                      'Mactan Newtown',
                      'Banilad',
                      'Lahug',
                      'SRP',
                      'Mandaue',
                      'Lapu-Lapu City',
                    ].map((loc) => {
                      const count = properties.filter((p) => p.location === loc).length;
                      const percentage = properties.length > 0 ? (count / properties.length) * 100 : 0;
                      return (
                        <div key={loc} className="space-y-1">
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
          {activeSection === 'buildings' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                    Buildings & Development Complexes
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage real estate developments in Cebu. Units and residences are associated with these master complexes.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingBuilding(null);
                    setNewBuildingName('');
                    setNewBuildingLocation('Cebu Business Park');
                    setNewBuildingAddress('');
                    setNewBuildingDescription('');
                    setIsAddBuildingOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17243B] text-[#C6A878] font-bold text-xs hover:bg-[#253754] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Building</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {buildings.map((bld) => {
                  const associatedProps = properties.filter((p) => p.buildingId === bld.buildingId);
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
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#17243B]/80 text-[#C6A878] text-[10px] font-bold">
                          {bld.location}
                        </span>
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-white/90 text-[#17243B] text-[10px] font-bold shadow-sm">
                          {associatedProps.length} Units
                        </span>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-sm text-[#17243B]">{bld.buildingName}</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">{bld.address}</p>
                          <p className="text-xs text-slate-600 mt-2 line-clamp-2">{bld.description}</p>
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <button
                            onClick={() => setViewingBuildingProperties(bld)}
                            className="font-semibold text-[#17243B] hover:text-[#C6A878] text-[11px] flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Units ({associatedProps.length})</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingBuilding(bld);
                                setNewBuildingName(bld.buildingName);
                                setNewBuildingLocation(bld.location);
                                setNewBuildingAddress(bld.address);
                                setNewBuildingDescription(bld.description);
                                setIsAddBuildingOpen(true);
                              }}
                              title="Edit Building"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#17243B] hover:bg-slate-100"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={async () => {
                                if (associatedProps.length > 0) {
                                  alert(
                                    `Cannot delete "${bld.buildingName}" because it has ${associatedProps.length} property listing(s) associated with it. Please reassign or delete those properties first.`
                                  );
                                  return;
                                }
                                if (window.confirm(`Delete building ${bld.buildingName}?`)) {
                                  await deleteDoc(doc(db, 'buildings', bld.buildingId));
                                  onBuildingDeleted(bld.buildingId);
                                }
                              }}
                              title="Delete Building"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION: LOCATIONS MANAGEMENT */}
          {activeSection === 'locations' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                    Cebu Prime Districts & Locations
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Add, edit, or delete designated real estate zones. Changes reflect across search filters and the public showcase.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-1.5 rounded-full bg-slate-100 text-[#17243B] text-xs font-bold">
                    {locationsList.length} Active Districts
                  </span>
                  <button
                    onClick={openAddLocationModal}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17243B] hover:bg-[#253754] text-[#C6A878] font-bold text-xs shadow-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New District</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {locationsList.map((loc) => {
                  const locProps = properties.filter((p) => p.location.toLowerCase() === loc.name.toLowerCase());
                  const locBuildings = buildings.filter((b) => b.location.toLowerCase() === loc.name.toLowerCase());
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
                        <div className="absolute bottom-2.5 left-3 right-3 text-white">
                          <h4 className="font-bold text-sm leading-tight">{loc.name}</h4>
                          <span className="text-[10px] text-[#C6A878] font-medium">{loc.tagline}</span>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <p className="text-xs text-slate-600 line-clamp-2 mb-3">{loc.description}</p>
                        
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex flex-col text-[11px]">
                            <span className="font-bold text-[#17243B]">{locProps.length} Properties</span>
                            <span className="text-slate-400">{locBuildings.length} Developments</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditLocationModal(loc)}
                              title="Edit District"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#17243B] hover:bg-slate-100 transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(loc.id, loc.name)}
                              title="Delete District"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 7: CUSTOMER INQUIRIES */}
          {activeSection === 'inquiries' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                    Client Consultation & Viewing Inquiries
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage confidential client inquiries submitted through the public website. Track status from New to Contacted and Closed.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-bold">
                    {inquiries.filter((i) => i.status === 'new').length} New
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
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
                        <th className="px-4 py-3.5">Message / Request</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5 text-center">Quick Reply</th>
                        <th className="px-5 py-3.5 text-right">Update Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inquiries.length > 0 ? (
                        inquiries.map((inq) => {
                          const isUpdating = inquiryStatusUpdating === inq.inquiryId;
                          const cleanPhone = (inq.phone || '').replace(/[^0-9]/g, '');
                          const mailSubject = encodeURIComponent(`Cebu Prime Properties: Regarding your inquiry on ${inq.propertyInterest}`);
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
                              <td className="px-4 py-3.5 font-semibold text-[#C6A878] whitespace-nowrap">
                                {inq.propertyInterest}
                              </td>
                              <td className="px-4 py-3.5 text-slate-600 max-w-xs text-xs">
                                <div className="line-clamp-2" title={inq.message}>
                                  {inq.message || 'Standard brochure & private viewing request.'}
                                </div>
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
                                  <a
                                    href={`mailto:${inq.email}?subject=${mailSubject}&body=${mailBody}`}
                                    title={`Email ${inq.email}`}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#C6A878] hover:text-[#17243B] text-slate-700 transition-colors inline-flex items-center justify-center"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                  </a>
                                  {cleanPhone && (
                                    <a
                                      href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                                        `Hello ${inq.fullName}, this is Cebu Prime Properties following up on your inquiry for ${inq.propertyInterest}.`
                                      )}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={`WhatsApp ${inq.phone}`}
                                      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 transition-colors inline-flex items-center justify-center"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                    </a>
                                  )}
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

          {/* SECTION 8: WEBSITE SETTINGS */}
          {activeSection === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                    Website Brand & Showcase Settings
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Update website branding, hero titles, contact information, and social links in real time without code deployment.
                  </p>
                </div>
                {settingsSaveSuccess && (
                  <div className="px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Settings Saved to Firestore!</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* Branding & Hero Section */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-[#17243B] flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Globe className="w-4 h-4 text-[#C6A878]" />
                    <span>Brand Identity & Hero Showcase</span>
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
                        <span>Landing Page Media & Hero Showcase Slides</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Master Authority controls for homepage carousel slides, high-resolution imagery, and architectural highlights.
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
                                alt="Slide Preview"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[11px] font-semibold text-slate-700">
                                  Photo Image URL or Upload
                                </label>
                                <label className="cursor-pointer text-[10px] text-[#C6A878] hover:text-[#17243B] font-semibold flex items-center gap-1">
                                  <Upload className="w-3 h-3" />
                                  <span>Upload New Photo</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      try {
                                        const res = await uploadSiteAsset(file, 'hero-slides');
                                        const updatedSlides = [...(siteSettings.heroSlides || [])];
                                        updatedSlides[sIdx] = { ...slide, image: res.url };
                                        setSiteSettings({ ...siteSettings, heroSlides: updatedSlides });
                                      } catch (err: any) {
                                        alert('Upload failed: ' + (err.message || 'Please check Storage rules'));
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

                {/* Contact Information & Channels */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-[#17243B] flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Phone className="w-4 h-4 text-[#C6A878]" />
                    <span>Contact Information & Corporate Channels</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Inquiry Email</label>
                      <input
                        type="email"
                        value={siteSettings.contactEmail}
                        onChange={(e) => setSiteSettings({ ...siteSettings, contactEmail: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Hotline / Contact Number</label>
                      <input
                        type="text"
                        value={siteSettings.contactPhone}
                        onChange={(e) => setSiteSettings({ ...siteSettings, contactPhone: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Physical Office Address</label>
                      <input
                        type="text"
                        value={siteSettings.officeAddress}
                        onChange={(e) => setSiteSettings({ ...siteSettings, officeAddress: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Facebook URL</label>
                      <input
                        type="url"
                        value={siteSettings.facebookUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, facebookUrl: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Instagram URL</label>
                      <input
                        type="url"
                        value={siteSettings.instagramUrl || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, instagramUrl: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#17243B] hover:bg-[#253754] text-[#C6A878] font-bold text-xs shadow-md transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
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

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectionModalOpen(false)}
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

      {/* MODAL: ADD BUILDING */}
      {isAddBuildingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17243B]/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#17243B] flex items-center gap-2">
                <Building className="w-5 h-5 text-[#C6A878]" />
                <span>Add Building Development</span>
              </h3>
              <button
                onClick={() => setIsAddBuildingOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBuilding} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Building Name *</label>
                <input
                  type="text"
                  value={newBuildingName}
                  onChange={(e) => setNewBuildingName(e.target.value)}
                  placeholder="e.g. Horizons 101"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Location District *</label>
                <select
                  value={newBuildingLocation}
                  onChange={(e) => setNewBuildingLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="Cebu Business Park">Cebu Business Park</option>
                  <option value="Cebu IT Park">Cebu IT Park</option>
                  <option value="Mactan Newtown">Mactan Newtown</option>
                  <option value="Banilad">Banilad</option>
                  <option value="Lahug">Lahug</option>
                  <option value="SRP">SRP</option>
                  <option value="Mandaue">Mandaue</option>
                  <option value="Lapu-Lapu City">Lapu-Lapu City</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={newBuildingAddress}
                  onChange={(e) => setNewBuildingAddress(e.target.value)}
                  placeholder="e.g. General Maxilom Ave, Cebu City"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Summary</label>
                <textarea
                  value={newBuildingDescription}
                  onChange={(e) => setNewBuildingDescription(e.target.value)}
                  rows={2}
                  placeholder="Developer details and masterplan overview..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddBuildingOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#17243B] text-[#C6A878] font-bold"
                >
                  {editingBuilding ? 'Update Building' : 'Save Building'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* MODAL: ADD / EDIT DISTRICT & LOCATION */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17243B]/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#17243B] flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#C6A878]" />
                <span>{editingLocation ? 'Edit Cebu Prime District' : 'Add New Prime District'}</span>
              </h3>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  District / City Zone Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cebu Business Park, Talamban, Cordova..."
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tagline / High-Level Identifier
                </label>
                <input
                  type="text"
                  placeholder="e.g. Premier Financial District, Island Waterfront..."
                  value={locTagline}
                  onChange={(e) => setLocTagline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  District Narrative & Highlights
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe location appeal, nearby road networks, lifestyle amenities, and investment potential..."
                  value={locDescription}
                  onChange={(e) => setLocDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Photograph Image URL
                </label>
                <input
                  type="text"
                  value={locImage}
                  onChange={(e) => setLocImage(e.target.value)}
                  placeholder="Enter image URL or select from presets below"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                />

                {/* Preset Image Options */}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-500 block mb-1">Quick Select Available Cebu Assets:</span>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {[
                      { name: 'Alcoves Pool', url: '/assets/extracted/photo_the_alcoves.png' },
                      { name: 'Park Avenue Tower', url: '/assets/extracted/photo_park_avenue.png' },
                      { name: 'Mactan Coastal', url: '/assets/extracted/loc_mactan.png' },
                      { name: 'Banilad Enclave', url: '/assets/extracted/loc_banilad.png' },
                      { name: 'Skyline Panorama', url: '/assets/extracted/hero_skyline_clean.png' },
                      { name: 'Astra Commercial', url: '/assets/extracted/astra_centre.png' },
                    ].map((asset) => (
                      <button
                        key={asset.name}
                        type="button"
                        onClick={() => setLocImage(asset.url)}
                        className={`px-2 py-1 rounded-lg border text-[10px] transition-colors ${
                          locImage === asset.url
                            ? 'bg-[#17243B] text-[#C6A878] border-[#17243B] font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {asset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {locImage && (
                  <div className="aspect-[16/9] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative mt-2">
                    <img
                      src={locImage}
                      alt="District Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLoc}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#17243B] hover:bg-[#253754] text-[#C6A878] font-bold text-xs shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingLoc ? 'Saving District...' : 'Save District'}</span>
                </button>
              </div>
            </form>
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
        onSaved={onPropertyUpdated}
        editingProperty={editingProperty}
        buildings={buildings}
      />
    </div>
  );
};
