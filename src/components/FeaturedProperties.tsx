import React from 'react';
import { Heart, MapPin, Bed, Bath, Maximize2, ArrowRight } from 'lucide-react';
import { PropertyDoc } from '../types/property';
import { formatPHP } from '../utils/filterProperties';

interface FeaturedPropertiesProps {
  properties: PropertyDoc[];
  favorites: string[];
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSelectProperty: (property: PropertyDoc) => void;
  onViewAllClick: () => void;
  isLoading?: boolean;
}

export const FeaturedProperties: React.FC<FeaturedPropertiesProps> = ({
  properties,
  favorites,
  onToggleFavorite,
  onSelectProperty,
  onViewAllClick,
  isLoading = false,
}) => {
  return (
    <section id="properties" className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-10 sm:py-16">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[#C6A878] uppercase mb-2">
            <span>Featured Listings</span>
            <span className="w-8 h-px bg-[#C6A878]" />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#17243B] font-sans">
            Premium Properties in Cebu’s Best Locations
          </h2>
        </div>

        <button
          onClick={onViewAllClick}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#17243B] hover:text-[#C6A878] transition-colors group self-start sm:self-auto py-1"
        >
          <span>View All Properties ({properties.length})</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="rounded-2xl overflow-hidden bg-slate-200 animate-pulse aspect-[344/242]"
            />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <p className="text-base text-slate-500 mb-4">
            No approved properties found matching your filter criteria.
          </p>
          <button
            onClick={onViewAllClick}
            className="px-6 py-2.5 rounded-full bg-[#17243B] text-white text-xs font-semibold hover:bg-[#253754] transition-colors"
          >
            Clear Filters & View All
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {properties.map((property) => {
            const isFav = favorites.includes(property.propertyId);
            const primaryImage =
              property.images && property.images.length > 0
                ? property.images[0]
                : '/assets/extracted/the_alcoves.png';

            return (
              <div
                key={property.propertyId}
                onClick={() => onSelectProperty(property)}
                className="group relative rounded-2xl overflow-hidden bg-slate-900 shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_32px_rgba(23,36,59,0.2)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col aspect-[344/242]"
              >
                {/* Background Property Image */}
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={primaryImage}
                    alt={property.propertyTitle}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#17243B] via-[#17243B]/65 to-transparent" />
                </div>

                {/* Top Badge & Favorite Heart */}
                <div className="relative z-10 p-3.5 flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-[#F8F7F3] text-[#17243B] text-[11px] font-semibold tracking-wide shadow-sm">
                    {property.listingType === 'sale' ? 'For Sale' : 'For Rent'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => onToggleFavorite(property.propertyId, e)}
                    aria-label={isFav ? `Remove ${property.propertyTitle} from favorites` : `Save ${property.propertyTitle} to favorites`}
                    className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-md hover:bg-black/50 text-white flex items-center justify-center transition-all duration-200 active:scale-90"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        isFav ? 'fill-[#C6A878] text-[#C6A878]' : 'text-white'
                      }`}
                    />
                  </button>
                </div>

                {/* Bottom Property Information */}
                <div className="relative z-10 mt-auto p-4 flex flex-col justify-end">
                  <div className="flex items-end justify-between gap-2 mb-1">
                    <h3 className="text-base font-bold text-white tracking-tight line-clamp-1 group-hover:text-[#DFCDAA] transition-colors">
                      {property.propertyTitle}
                    </h3>
                    <span className="text-sm font-bold text-white whitespace-nowrap tabular-nums">
                      {formatPHP(property.price, property.listingType === 'rent')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-white/80 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-[#C6A878] flex-shrink-0" />
                    <span className="truncate">{property.location}</span>
                  </div>

                  <div className="w-full h-px bg-white/20 mb-2" />

                  <div className="flex items-center gap-4 text-xs font-medium text-white/90">
                    <div className="flex items-center gap-1.5">
                      <Bed className="w-3.5 h-3.5 text-white/70" />
                      <span className="tabular-nums">{property.bedrooms}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Bath className="w-3.5 h-3.5 text-white/70" />
                      <span className="tabular-nums">{property.bathrooms}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Maximize2 className="w-3 h-3 text-white/70" />
                      <span className="tabular-nums">{property.floorArea} sqm</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
