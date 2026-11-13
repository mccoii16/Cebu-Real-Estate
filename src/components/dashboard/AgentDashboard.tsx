import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit,
  Trash2,
  AlertCircle,
  Eye,
  LogOut,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { PropertyDoc, BuildingDoc, LocationHighlight } from '../../types/property';
import { useAuth } from '../../context/AuthContext';
import { AddPropertyModal } from './AddPropertyModal';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface AgentDashboardProps {
  properties: PropertyDoc[];
  buildings: BuildingDoc[];
  locations?: LocationHighlight[];
  onPropertyUpdated: (property: PropertyDoc) => void;
  onPropertyDeleted: (propertyId: string) => void;
  onViewPublicSite: () => void;
  onSelectPropertyPreview: (property: PropertyDoc) => void;
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({
  properties,
  buildings,
  locations,
  onPropertyUpdated,
  onPropertyDeleted,
  onViewPublicSite,
  onSelectPropertyPreview,
}) => {
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'properties' | 'profile'>('properties');
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending' | 'draft' | 'rejected'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyDoc | null>(null);

  // Filter properties belonging to this agent
  const myProperties = properties.filter(
    (p) => p.agentId === user?.uid || p.agentId === 'agent-01'
  );

  const approvedCount = myProperties.filter((p) => p.status === 'approved').length;
  const pendingCount = myProperties.filter((p) => p.status === 'pending').length;
  const draftCount = myProperties.filter((p) => p.status === 'draft').length;
  const rejectedCount = myProperties.filter((p) => p.status === 'rejected').length;

  const displayedProperties = myProperties.filter((p) => {
    if (filterStatus === 'all') return true;
    return p.status === filterStatus;
  });

  const handleDeleteDraft = async (propertyId: string) => {
    if (!window.confirm('Are you sure you want to delete this draft listing?')) return;
    try {
      await deleteDoc(doc(db, 'properties', propertyId));
      onPropertyDeleted(propertyId);
    } catch (err: any) {
      alert(`Could not delete draft: ${err.message}`);
    }
  };

  const getStatusBadge = (status: PropertyDoc['status'], hasPendingReview?: boolean) => {
    if (status === 'approved') {
      return (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Approved</span>
          </span>
          {hasPendingReview && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Pending Edit Review</span>
            </span>
          )}
        </div>
      );
    }
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>Pending Review</span>
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Rejected</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
        <FileEdit className="w-3.5 h-3.5 text-slate-500" />
        <span>Draft</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F7F3] flex flex-col selection:bg-[#C6A878]/30">
      {/* Top Navbar */}
      <header className="bg-[#17243B] text-white px-3 sm:px-8 py-3.5 flex items-center justify-between gap-2 border-b border-white/10 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#C6A878]/20 border border-[#C6A878]/40 flex items-center justify-center text-[#C6A878] flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold font-serif tracking-wide text-white truncate">
              Cebu Prime • Agent Workspace
            </h1>
            <p className="text-[11px] sm:text-xs text-[#C6A878] truncate">
              {profile?.displayName || user?.displayName || user?.email} (Contributor)
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

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-8 py-5 sm:py-8 flex-1 space-y-6 sm:space-y-8">
        {/* Metric Cards Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Submitted
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-[#17243B] font-serif">
                {myProperties.length}
              </span>
              <Building2 className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Live Approved
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-emerald-700 font-serif">
                {approvedCount}
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              Pending Review
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-amber-700 font-serif">
                {pendingCount}
              </span>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              Needs Correction
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-rose-700 font-serif">
                {rejectedCount}
              </span>
              <XCircle className="w-5 h-5 text-rose-500" />
            </div>
          </div>
        </div>

        {/* Action Header & Tabs */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-slate-200 shadow-sm space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#17243B]">
                My Property Portfolio
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Manage your draft listings, track Super Admin review progress, and submit new units.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingProperty(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-xl bg-[#17243B] hover:bg-[#203250] text-[#C6A878] font-bold text-xs sm:text-sm shadow-md transition-all self-stretch sm:self-auto justify-center whitespace-nowrap"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>Add Property</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {(
              [
                { id: 'all', label: `All Listings (${myProperties.length})` },
                { id: 'approved', label: `Approved (${approvedCount})` },
                { id: 'pending', label: `Pending Review (${pendingCount})` },
                { id: 'draft', label: `Drafts (${draftCount})` },
                { id: 'rejected', label: `Rejected (${rejectedCount})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id)}
                className={`px-3.5 py-1.5 rounded-full font-semibold transition-colors whitespace-nowrap ${
                  filterStatus === f.id
                    ? 'bg-[#17243B] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Properties Grid or Empty State */}
          {displayedProperties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedProperties.map((property) => (
                <div
                  key={property.propertyId}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  {/* Photo & Badge */}
                  <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
                    <img
                      src={property.images[0] || '/assets/extracted/photo_the_alcoves.png'}
                      alt={property.propertyTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      {getStatusBadge(property.status, property.hasPendingReview)}
                    </div>
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-[#17243B]/80 text-[#C6A878] text-[10px] font-bold uppercase backdrop-blur-sm">
                      {property.listingType === 'sale' ? 'For Sale' : 'For Rent'}
                    </div>
                  </div>

                  {/* Information & Rejection Notice */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-[11px] font-bold text-[#C6A878] uppercase tracking-wider">
                        {property.location}
                      </div>
                      <h3 className="text-base font-bold text-[#17243B] mt-0.5">
                        {property.propertyTitle}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        ₱{property.price.toLocaleString()} • {property.bedrooms} Bed • {property.floorArea} sqm
                      </p>
                    </div>

                    {/* Rejection Notice Banner */}
                    {property.status === 'rejected' && property.rejectionReason && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-rose-700">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Administrator Rejection Reason:</span>
                        </div>
                        <p className="text-slate-700 italic">
                          &quot;{property.rejectionReason}&quot;
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Please click &quot;Edit & Resubmit&quot; to make corrections.
                        </p>
                      </div>
                    )}

                    {/* Pending review notice on approved property */}
                    {property.status === 'approved' && property.hasPendingReview && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                        Pending revisions submitted to Super Admin. Live listing continues to display previous approved details until accepted.
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectPropertyPreview(property)}
                        className="inline-flex items-center gap-1 min-h-[40px] px-2 text-xs font-semibold text-slate-600 hover:text-[#17243B] whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Preview</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {/* Draft & Rejected Edit */}
                        {property.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProperty(property);
                              setIsAddModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-lg bg-slate-100 hover:bg-[#17243B] text-slate-700 hover:text-[#C6A878] text-xs font-bold transition-colors whitespace-nowrap"
                          >
                            <FileEdit className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{property.status === 'rejected' ? 'Edit & Resubmit' : 'Edit Draft'}</span>
                          </button>
                        )}

                        {/* Approved property revision */}
                        {property.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProperty(property);
                              setIsAddModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-lg bg-slate-100 hover:bg-[#17243B] text-slate-700 hover:text-[#C6A878] text-xs font-bold transition-colors whitespace-nowrap"
                          >
                            <FileEdit className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Edit Listing</span>
                          </button>
                        )}

                        {/* Delete draft only */}
                        {property.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(property.propertyId)}
                            title="Delete draft"
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 sm:p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-700">No properties in this view</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                You have not submitted any property listings matching this filter status yet.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingProperty(null);
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-5 min-h-[44px] rounded-xl bg-[#17243B] text-[#C6A878] font-bold text-xs whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Submit Your First Listing</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Property Modal */}
      <AddPropertyModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProperty(null);
        }}
        onSaved={onPropertyUpdated}
        editingProperty={editingProperty}
        buildings={buildings}
        locations={locations}
      />
    </div>
  );
};
