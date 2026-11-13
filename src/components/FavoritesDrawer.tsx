import React from 'react';
import { X, Trash2, ArrowRight, Heart } from 'lucide-react';
import { PropertyDoc } from '../types/property';
import { formatPHP } from '../utils/filterProperties';

interface FavoritesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: string[];
  properties: PropertyDoc[];
  onRemoveFavorite: (id: string) => void;
  onSelectProperty: (property: PropertyDoc) => void;
  onInquireNow: () => void;
}

export const FavoritesDrawer: React.FC<FavoritesDrawerProps> = ({
  isOpen,
  onClose,
  favorites,
  properties,
  onRemoveFavorite,
  onSelectProperty,
  onInquireNow,
}) => {
  if (!isOpen) return null;

  const favoriteProperties = properties.filter((p) => favorites.includes(p.propertyId));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Saved Properties"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-4 sm:p-6 animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <Heart className="w-5 h-5 text-[#C6A878] fill-[#C6A878] flex-shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-[#17243B] truncate">
              Saved Properties ({favoriteProperties.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close saved properties"
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 sm:space-y-4">
          {favoriteProperties.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Heart className="w-12 h-12 mx-auto text-slate-200 mb-3" />
              <p className="text-sm">You haven&apos;t saved any properties yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Click the heart icon on any listing to save it here.
              </p>
            </div>
          ) : (
            favoriteProperties.map((property) => (
              <div
                key={property.propertyId}
                className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 flex gap-3 group relative hover:border-[#C6A878]/50 transition-colors"
              >
                <img
                  src={property.images?.[0] || '/assets/extracted/the_alcoves.png'}
                  alt={property.propertyTitle}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallback) {
                      target.dataset.fallback = 'true';
                      target.src = '/assets/extracted/the_alcoves.png';
                    }
                  }}
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0 cursor-pointer"
                  onClick={() => {
                    onSelectProperty(property);
                    onClose();
                  }}
                  referrerPolicy="no-referrer"
                />

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h3
                      onClick={() => {
                        onSelectProperty(property);
                        onClose();
                      }}
                      className="text-sm font-bold text-slate-900 truncate cursor-pointer hover:text-[#C6A878] transition-colors"
                    >
                      {property.propertyTitle}
                    </h3>
                    <div className="text-xs text-slate-500 truncate">{property.location}</div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-bold text-[#17243B] font-mono tabular-nums whitespace-nowrap">
                      {formatPHP(property.price, property.listingType === 'rent')}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveFavorite(property.propertyId)}
                      aria-label={`Remove ${property.propertyTitle}`}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-2 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        {favoriteProperties.length > 0 && (
          <div className="pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                onInquireNow();
                onClose();
              }}
              className="w-full min-h-[44px] py-3 px-4 rounded-full bg-[#17243B] hover:bg-[#203150] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-md whitespace-nowrap"
            >
              <span>Inquire on All Saved Listings</span>
              <ArrowRight className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

