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
} from 'lucide-react';
import { PropertyDoc } from '../types/property';
import { formatPHP } from '../utils/filterProperties';
import { uploadPropertyPhoto } from '../services/storageService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

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
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!property) return null;

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="property-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 my-6 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Media Banner with Multi-Image Gallery */}
        <div className="relative w-full h-72 sm:h-96 bg-slate-950 overflow-hidden group">
          <img
            src={currentImage}
            alt={property.propertyTitle}
            className="w-full h-full object-cover object-center transition-all duration-300"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors z-20 focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>

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

          {/* Firebase Storage Image Upload Feature */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#C6A878]" />
                  <span>Upload Property Photographs</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Directly upload high-resolution property photography to Firebase Storage.
                </p>
              </div>

              <div>
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
                      <span>Upload Photo</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {uploadError && (
              <p className="text-xs text-rose-500 mt-2 font-medium">{uploadError}</p>
            )}
          </div>

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
  );
};
