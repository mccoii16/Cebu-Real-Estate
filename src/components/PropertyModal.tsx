import React, { useState, useRef } from 'react';
import {
  X,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Building,
  Check,
  Heart,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Upload,
  Loader2,
  Image as ImageIcon,
  Maximize,
  Minimize,
  Trash2,
} from 'lucide-react';
import { PropertyDoc } from '../types/property';
import { formatPHP } from '../utils/filterProperties';
import { uploadPropertyPhoto } from '../services/storageService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { canManagePropertyPhotos } from '../utils/filterProperties';

interface PropertyModalProps {
  property: PropertyDoc | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onInquireAboutProperty: (title: string) => void;
  onPropertyUpdated?: (updated: PropertyDoc) => void;
}

export const PropertyModal: React.FC<PropertyModalProps> = ({
  property,
  onClose,
  isFavorite,
  onToggleFavorite,
  onInquireAboutProperty,
  onPropertyUpdated,
}) => {
  const { user, isSuperAdmin } = useAuth();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!property) return null;

  // Role Gate: strictly master authority (isSuperAdmin) or the agent who created this listing
  const canManagePhotos = canManagePropertyPhotos(user?.uid, isSuperAdmin, property);


  const images = property.images && property.images.length > 0
    ? property.images
    : ['/assets/extracted/the_alcoves.png'];

  const currentImage = images[activeImageIndex] || images[0];

  const nextImage = () => {
    setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleDeletePhoto = async (indexToDelete: number) => {
    if (!canManagePhotos) return;
    if (images.length <= 1) {
      alert('A property must have at least one photograph.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this photo from the property gallery?')) return;

    setIsDeletingPhoto(true);
    try {
      const newImages = images.filter((_, idx) => idx !== indexToDelete);
      const propertyRef = doc(db, 'properties', property.propertyId);
      await updateDoc(propertyRef, {
        images: newImages,
        updatedAt: new Date().toISOString(),
      });

      const updatedProperty: PropertyDoc = {
        ...property,
        images: newImages,
        updatedAt: new Date().toISOString(),
      };

      if (onPropertyUpdated) {
        onPropertyUpdated(updatedProperty);
      }
      setActiveImageIndex(Math.max(0, indexToDelete - 1));
    } catch (err: any) {
      console.error('Error deleting photo:', err);
      alert('Failed to delete photo: ' + (err.message || 'Permission denied'));
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image file
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

      // Update Firestore document with new image URL
      const propertyRef = doc(db, 'properties', property.propertyId);
      await updateDoc(propertyRef, {
        images: newImages,
        updatedAt: new Date().toISOString(),
      });

      const updatedProperty: PropertyDoc = {
        ...property,
        images: newImages,
        updatedAt: new Date().toISOString(),
      };

      if (onPropertyUpdated) {
        onPropertyUpdated(updatedProperty);
      }
      setActiveImageIndex(newImages.length - 1);
    } catch (err) {
      console.error('Storage upload error:', err);
      setUploadError('Failed to upload image to Firebase Storage. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/80 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 my-auto sm:my-10 max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Media Banner with Multi-Image Gallery */}
          <div className="relative w-full h-72 sm:h-96 bg-slate-950 overflow-hidden group flex-shrink-0">
            <img
              src={currentImage}
              alt={property.propertyTitle}
              className="w-full h-full object-cover object-center transition-all duration-300"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

            {/* Top Right Action Cluster: Fullscreen & Close */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                title="View Fullscreen"
                aria-label="View photo fullscreen"
                className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors focus:outline-none"
              >
                <Maximize className="w-4 h-4" />
              </button>

              <button
                onClick={onClose}
                aria-label="Close modal"
                className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

          {/* Gallery Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center transition-colors z-20 focus:outline-none"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextImage}
                aria-label="Next image"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center transition-colors z-20 focus:outline-none"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Gallery Image Counter Badge */}
              <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-mono font-medium flex items-center gap-1.5 backdrop-blur-sm">
                <ImageIcon className="w-3.5 h-3.5 text-[#C6A878]" />
                <span>
                  {activeImageIndex + 1} / {images.length}
                </span>
              </div>
            </>
          )}

          {/* Bottom Title & Price inside image banner */}
          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-4 z-10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-[#C6A878] text-[#17243B] text-[10px] font-bold uppercase tracking-wider">
                  {property.listingType === 'sale' ? 'For Sale' : 'For Rent'}
                </span>
                <span className="text-white/80 text-xs font-medium">
                  {property.propertyType}
                </span>
                {property.featured && (
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[9px] font-semibold uppercase tracking-wider">
                    Featured
                  </span>
                )}
              </div>
              <h2
                id="property-modal-title"
                className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight"
              >
                {property.propertyTitle}
              </h2>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-white/90 mt-1">
                <MapPin className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
                <span>{property.address}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-white/70 block uppercase tracking-wider">
                Price
              </span>
              <span className="text-xl sm:text-2xl font-bold text-[#C6A878] font-mono tabular-nums whitespace-nowrap">
                {formatPHP(property.price, property.listingType === 'rent')}
              </span>
            </div>
          </div>
        </div>

        {/* Gallery Thumbnails Strip */}
        {images.length > 1 && (
          <div className="px-6 py-2.5 bg-slate-100 flex items-center gap-2 overflow-x-auto border-b border-slate-200">
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImageIndex(idx)}
                className={`relative w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                  activeImageIndex === idx ? 'border-[#C6A878] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={imgUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </button>
            ))}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[55vh]">
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 px-5 rounded-2xl bg-[#F8F7F3] border border-slate-200">
            <div className="flex items-center gap-2.5">
              <Bed className="w-4 h-4 text-[#C6A878]" />
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Bedrooms</span>
                <span className="text-sm font-bold text-slate-900">{property.bedrooms} Bed</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Bath className="w-4 h-4 text-[#C6A878]" />
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Bathrooms</span>
                <span className="text-sm font-bold text-slate-900">{property.bathrooms} Bath</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Maximize2 className="w-4 h-4 text-[#C6A878]" />
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Floor Area</span>
                <span className="text-sm font-bold text-slate-900">{property.floorArea} sqm</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Building className="w-4 h-4 text-[#C6A878]" />
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Building</span>
                <span className="text-sm font-bold text-slate-900 truncate block max-w-[120px]">
                  {property.buildingName}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2">
              Property Overview
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {property.description}
            </p>
          </div>

          {/* Amenities & Highlights */}
          {property.amenities && property.amenities.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3">
                Key Amenities & Highlights
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {property.amenities.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs sm:text-sm text-slate-700">
                    <div className="w-4 h-4 rounded-full bg-[#C6A878]/20 flex items-center justify-center text-[#C6A878] flex-shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Firebase Storage Image Upload & Management (Restricted to Master Authority or Listing Agent) */}
          {canManagePhotos ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#C6A878]" />
                    <span>Manage Property Photographs</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isSuperAdmin
                      ? 'Master Authority: You have full access to add and delete photos on this property.'
                      : 'Listing Agent: You can add and manage photos for your assigned listing.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {images.length > 1 && (
                    <button
                      type="button"
                      disabled={isDeletingPhoto}
                      onClick={() => handleDeletePhoto(activeImageIndex)}
                      className="px-3.5 py-2 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      title="Delete currently displayed photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeletingPhoto ? 'Deleting...' : 'Delete Active Photo'}</span>
                    </button>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                    id={`upload-photo-${property.propertyId}`}
                  />
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-full border border-[#17243B] text-[#17243B] hover:bg-[#17243B] hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading to Storage...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Add Photo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {uploadError && (
                <p className="text-xs text-rose-500 mt-2 font-medium">{uploadError}</p>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>
                Photo management for this listing is restricted to {property.agentName || 'the assigned listing agent'} and the Master Administrator.
              </span>
            </div>
          )}

          {/* Actions Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={() => onToggleFavorite(property.propertyId)}
              className={`w-full sm:w-auto px-5 py-3 rounded-full border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                isFavorite
                  ? 'border-[#C6A878] bg-[#C6A878]/10 text-[#C6A878]'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#C6A878]' : ''}`} />
              <span>{isFavorite ? 'Saved to Favorites' : 'Save to Favorites'}</span>
            </button>

            <button
              onClick={() => {
                onInquireAboutProperty(property.propertyTitle);
                onClose();
              }}
              className="w-full sm:w-auto px-7 py-3 rounded-full bg-[#17243B] hover:bg-[#203150] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
            >
              <span>Inquire About This Property</span>
              <ArrowRight className="w-4 h-4 text-[#C6A878]" />
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* FULLSCREEN LIGHTBOX VIEWER */}
    {isFullscreen && (
      <div
        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
        onClick={() => setIsFullscreen(false)}
      >
        {/* Top Controls */}
        <div className="w-full flex items-center justify-between text-white z-20 px-2 sm:px-6 py-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm sm:text-base text-white font-serif">{property.propertyTitle}</span>
            <span className="text-xs text-white/60 font-mono">
              ({activeImageIndex + 1} of {images.length})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(false);
              }}
              aria-label="Exit fullscreen"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Minimize className="w-5 h-5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(false);
              }}
              aria-label="Close"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Main High-Res Image Display with Left/Right Arrows */}
        <div
          className="relative flex-1 w-full max-w-6xl flex items-center justify-center overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={currentImage}
            alt={property.propertyTitle}
            className="max-h-[82vh] max-w-full object-contain rounded-2xl shadow-2xl transition-transform duration-300"
            referrerPolicy="no-referrer"
          />

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all z-20 focus:outline-none"
              >
                <ChevronLeft className="w-7 h-7" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all z-20 focus:outline-none"
              >
                <ChevronRight className="w-7 h-7" />
              </button>
            </>
          )}
        </div>

        {/* Bottom Fullscreen Thumbnails Strip */}
        {images.length > 1 && (
          <div
            className="flex items-center gap-2 overflow-x-auto max-w-4xl py-2 px-4 bg-black/40 rounded-2xl backdrop-blur-sm z-20"
            onClick={(e) => e.stopPropagation()}
          >
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImageIndex(i)}
                className={`relative w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                  activeImageIndex === i ? 'border-[#C6A878] scale-105' : 'border-transparent opacity-50 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        )}
      </div>
    )}
  </>
);
};
