import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Check,
  AlertCircle,
  Building,
  DollarSign,
  Maximize2,
  Bed,
  Bath,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { PropertyDoc, BuildingDoc, PropertyType, ListingType, PropertyLocation } from '../../types/property';
import { uploadPropertyPhoto } from '../../services/storageService';
import { useAuth } from '../../context/AuthContext';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (property: PropertyDoc) => void;
  editingProperty?: PropertyDoc | null;
  buildings: BuildingDoc[];
}

const COMMON_AMENITIES = [
  'Swimming Pool',
  'Fitness Gym',
  '24/7 Security & Concierge',
  'Function Rooms',
  'Sky Lounge',
  'Balcony with City Views',
  'Direct Mall Access',
  'Basement Parking',
  'Kids Play Area',
  'Spa & Sauna',
  'Smart Home Automation',
  'Fiber High-Speed Internet',
  'Backup Generator Power',
];

const LOCATIONS_LIST: PropertyLocation[] = [
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
  editingProperty,
  buildings,
}) => {
  const { user, profile } = useAuth();

  const [propertyTitle, setPropertyTitle] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [location, setLocation] = useState<PropertyLocation>('Cebu Business Park');
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('Condo');
  const [listingType, setListingType] = useState<'sale' | 'rent'>('sale');
  const [price, setPrice] = useState<number>(10000000);
  const [bedrooms, setBedrooms] = useState<number>(1);
  const [bathrooms, setBathrooms] = useState<number>(1);
  const [floorArea, setFloorArea] = useState<number>(45);
  const [description, setDescription] = useState('');
  const [amenities, setAmenities] = useState<string[]>([
    'Swimming Pool',
    'Fitness Gym',
    '24/7 Security & Concierge',
  ]);
  const [customAmenity, setCustomAmenity] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset form
  useEffect(() => {
    if (editingProperty) {
      setPropertyTitle(editingProperty.propertyTitle);
      setBuildingId(editingProperty.buildingId || '');
      setBuildingName(editingProperty.buildingName || '');
      setLocation((editingProperty.location as PropertyLocation) || 'Cebu Business Park');
      setAddress(editingProperty.address);
      setPropertyType((editingProperty.propertyType as PropertyType) || 'Condo');
      setListingType(editingProperty.listingType);
      setPrice(editingProperty.price);
      setBedrooms(editingProperty.bedrooms);
      setBathrooms(editingProperty.bathrooms);
      setFloorArea(editingProperty.floorArea);
      setDescription(editingProperty.description);
      setAmenities(editingProperty.amenities || []);
      setImages(editingProperty.images || []);
    } else {
      setPropertyTitle('');
      setBuildingId(buildings[0]?.buildingId || '');
      setBuildingName(buildings[0]?.buildingName || '');
      setLocation('Cebu Business Park');
      setAddress('');
      setPropertyType('Condo');
      setListingType('sale');
      setPrice(8500000);
      setBedrooms(1);
      setBathrooms(1);
      setFloorArea(36);
      setDescription('');
      setAmenities(['Swimming Pool', 'Fitness Gym', '24/7 Security & Concierge']);
      setImages(['/assets/extracted/photo_the_alcoves.png']);
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
    }
  };

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const addCustomAmenity = () => {
    if (customAmenity.trim() && !amenities.includes(customAmenity.trim())) {
      setAmenities((prev) => [...prev, customAmenity.trim()]);
      setCustomAmenity('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    setErrorMessage(null);

    const tempPropertyId = editingProperty?.propertyId || `prop-temp-${Date.now()}`;
    const files = Array.from(e.target.files);

    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const uploadResult = await uploadPropertyPhoto(file, tempPropertyId);
        newUrls.push(uploadResult.url);
      }
      setImages((prev) => [...prev, ...newUrls]);
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      setErrorMessage('Failed to upload one or more photographs to Firebase Storage.');
    } finally {
      setIsUploading(false);
    }
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= images.length) return;
    const reordered = [...images];
    const temp = reordered[index];
    reordered[index] = reordered[newIdx];
    reordered[newIdx] = temp;
    setImages(reordered);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (submitStatus: 'draft' | 'pending') => {
    setErrorMessage(null);

    if (!propertyTitle.trim()) {
      setErrorMessage('Please provide a property title.');
      return;
    }
    if (!address.trim()) {
      setErrorMessage('Please provide the physical street address.');
      return;
    }
    if (images.length === 0) {
      setErrorMessage('Please add at least one photograph of the property.');
      return;
    }

    setIsSaving(true);
    try {
      const propId = editingProperty?.propertyId || `prop-${Date.now()}`;
      const now = new Date().toISOString();

      // Check if editing an approved property
      if (editingProperty && editingProperty.status === 'approved' && submitStatus === 'pending') {
        // Special case: Preserve live approved listing and submit revisions for Super Admin review
        const pendingChanges: Partial<PropertyDoc> = {
          propertyTitle,
          buildingId,
          buildingName,
          location,
          address,
          propertyType,
          listingType,
          price,
          bedrooms,
          bathrooms,
          floorArea,
          description,
          amenities,
          images,
          updatedAt: now,
          submittedAt: now,
        };

        const updatedDoc: PropertyDoc = {
          ...editingProperty,
          hasPendingReview: true,
          pendingChanges,
          updatedAt: now,
        };

        await updateDoc(doc(db, 'properties', propId), {
          hasPendingReview: true,
          pendingChanges,
          updatedAt: now,
        });

        onSaved(updatedDoc);
        onClose();
        return;
      }

      // Normal creation or editing draft / rejected
      const propertyData: PropertyDoc = {
        propertyId: propId,
        buildingId: buildingId || `bld-${Date.now()}`,
        buildingName: buildingName || propertyTitle,
        propertyTitle,
        location,
        address,
        propertyType,
        listingType,
        price: Number(price),
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        floorArea: Number(floorArea),
        description: description.trim() || 'A luxury residence represented by Cebu Prime Properties.',
        amenities,
        images,
        featured: editingProperty?.featured ?? false,
        status: submitStatus,
        agentId: editingProperty?.agentId || user?.uid || 'agent-01',
        agentName: editingProperty?.agentName || profile?.displayName || user?.email?.split('@')[0] || 'Prime Agent',
        rejectionReason: null,
        createdAt: editingProperty?.createdAt || now,
        updatedAt: now,
        submittedAt: submitStatus === 'pending' ? now : editingProperty?.submittedAt || null,
        approvedAt: editingProperty?.approvedAt || null,
        approvedBy: editingProperty?.approvedBy || null,
        hasPendingReview: false,
      };

      await setDoc(doc(db, 'properties', propId), propertyData);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#17243B]/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-800">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-[#17243B] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C6A878]/20 border border-[#C6A878]/30 flex items-center justify-center text-[#C6A878]">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-serif tracking-wide text-white">
                {editingProperty ? 'Edit Property Listing' : 'Submit New Property'}
              </h2>
              <p className="text-xs text-white/70">
                {editingProperty && editingProperty.status === 'approved'
                  ? 'Editing this approved listing will submit changes for Super Admin review without disrupting the live page.'
                  : 'Structured submission for Cebu Prime Properties portfolio.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full border border-white/20 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-[#F8F7F3]">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Basic Identifiers */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-[#C6A878]" />
              <span>Listing Identity & Location</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Property Title *
                </label>
                <input
                  type="text"
                  value={propertyTitle}
                  onChange={(e) => setPropertyTitle(e.target.value)}
                  placeholder="e.g. The Alcoves - High Floor Skyline Suite"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Associate Building / Development
                </label>
                <select
                  value={buildingId}
                  onChange={handleBuildingSelect}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                >
                  <option value="">-- Choose Existing Building or Custom --</option>
                  {buildings.map((b) => (
                    <option key={b.buildingId} value={b.buildingId}>
                      {b.buildingName} ({b.location})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cebu Location District *
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value as PropertyLocation)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                >
                  {LOCATIONS_LIST.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Complete Street Address *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Luzon Ave, Cebu Business Park, Cebu City"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Specs & Pricing */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#C6A878]" />
              <span>Type, Pricing & Specifications</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Property Type
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                >
                  <option value="Condo">Condo</option>
                  <option value="Penthouse">Penthouse</option>
                  <option value="House & Lot">House & Lot</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Townhouse">Townhouse</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Listing Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setListingType('sale')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
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
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {listingType === 'sale' ? 'Sale Price (PHP) *' : 'Monthly Rent (PHP/mo) *'}
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  min={0}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Bed className="w-3.5 h-3.5 text-slate-400" />
                  <span>Bedrooms</span>
                </label>
                <input
                  type="number"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                  min={0}
                  max={20}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Bath className="w-3.5 h-3.5 text-slate-400" />
                  <span>Bathrooms</span>
                </label>
                <input
                  type="number"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Number(e.target.value))}
                  min={0}
                  max={20}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Floor Area (sqm)</span>
                </label>
                <input
                  type="number"
                  value={floorArea}
                  onChange={(e) => setFloorArea(Number(e.target.value))}
                  min={10}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Description & Amenities */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C6A878]" />
              <span>Architectural Prose & Amenities</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Property Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Highlight the architectural highlights, panoramic views, interior finishes, and lifestyle advantages..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Included Amenities (Click to toggle)
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {COMMON_AMENITIES.map((item) => {
                  const selected = amenities.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleAmenity(item)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
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
              </div>

              {/* Add custom amenity */}
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
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                />
                <button
                  type="button"
                  onClick={addCustomAmenity}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Property Photographs (Firebase Storage Upload & Reordering) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#17243B] uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#C6A878]" />
                <span>Property Photographs ({images.length})</span>
              </h3>

              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C6A878] hover:bg-[#b89764] text-[#17243B] text-xs font-semibold transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploading ? 'Uploading to Storage...' : 'Upload Photos'}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>

            {/* Photo Previews with Reorder & Remove Controls */}
            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-100"
                  >
                    <img
                      src={imgUrl}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Primary Badge for index 0 */}
                    {idx === 0 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#17243B]/80 text-[#C6A878] text-[10px] font-bold backdrop-blur-sm">
                        Primary Cover
                      </span>
                    )}

                    {/* Hover Overlay Controls */}
                    <div className="absolute inset-0 bg-[#17243B]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => moveImage(idx, 'up')}
                          title="Move earlier"
                          className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white text-white hover:text-[#17243B] flex items-center justify-center transition-colors"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {idx < images.length - 1 && (
                        <button
                          type="button"
                          onClick={() => moveImage(idx, 'down')}
                          title="Move later"
                          className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white text-white hover:text-[#17243B] flex items-center justify-center transition-colors"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        title="Remove photo"
                        className="w-7 h-7 rounded-lg bg-rose-500/80 hover:bg-rose-600 text-white flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-500">
                <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs">No photographs added yet. Click &quot;Upload Photos&quot; above.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>

          <div className="w-full sm:w-auto flex items-center gap-3">
            {/* Save as Draft (Only allowed if not already approved) */}
            {(!editingProperty || editingProperty.status !== 'approved') && (
              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={isSaving || isUploading}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
            )}

            {/* Submit for Approval */}
            <button
              type="button"
              onClick={() => handleSave('pending')}
              disabled={isSaving || isUploading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#17243B] hover:bg-[#203250] text-[#C6A878] text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'Saving...'
                  : editingProperty && editingProperty.status === 'approved'
                  ? 'Submit Changes for Review'
                  : 'Submit for Approval'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
