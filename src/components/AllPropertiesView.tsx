import React from 'react';
import { X, Search, RotateCcw, Building2, MapPin, Tag, Bed, Bath, Maximize2, Heart, ArrowRight } from 'lucide-react';
import { PropertyDoc, BuildingDoc, PropertyFilter, PropertyType, ListingType } from '../types/property';
import { INITIAL_LOCATIONS } from './FloatingSearchBar';
import { formatPHP } from '../utils/filterProperties';

interface AllPropertiesViewProps {
  isOpen: boolean;
  onClose: () => void;
  properties: PropertyDoc[];
  buildings: BuildingDoc[];
  filter: PropertyFilter;
  onFilterChange: (newFilter: PropertyFilter) => void;
  onResetFilter: () => void;
  favorites: string[];
  onToggleFavorite: (id: string, e?: React.MouseEvent) => void;
  onSelectProperty: (property: PropertyDoc) => void;
}

export const AllPropertiesView: React.FC<AllPropertiesViewProps> = ({
  isOpen,
  onClose,
  properties,
  buildings,
  filter,
  onFilterChange,
  onResetFilter,
  favorites,
  onToggleFavorite,
  onSelectProperty,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="All Property Listings"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md overflow-hidden"
    >
      <div className="relative w-full max-w-7xl bg-[#F8F7F3] rounded-3xl shadow-2xl flex flex-col h-[92vh] border border-slate-200 overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-[#17243B] text-white flex items-center justify-between border-b border-white/10 flex-shrink-0">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#C6A878]">
              Cebu Prime Database
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-sans">
              All Approved Property Listings ({properties.length})
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onResetFilter}
              className="px-3.5 py-1.5 rounded-full border border-white/20 hover:bg-white/10 text-xs font-semibold text-white/90 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#C6A878]" />
              <span className="hidden sm:inline">Reset Filters</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Close properties view"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="col-span-2 sm:col-span-1 lg:col-span-2 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Search Keyword
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filter.searchQuery || ''}
                  onChange={(e) => onFilterChange({ ...filter, searchQuery: e.target.value })}
                  placeholder="Tower name, address, specs..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#C6A878]"
                />
              </div>
            </div>

            {/* Location Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Location
              </label>
              <select
                value={filter.location}
                onChange={(e) => onFilterChange({ ...filter, location: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#C6A878]"
              >
                {INITIAL_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Building Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Building
              </label>
              <select
                value={filter.buildingId}
                onChange={(e) => onFilterChange({ ...filter, buildingId: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#C6A878]"
              >
                <option value="all">All Buildings</option>
                {buildings.map((b) => (
                  <option key={b.buildingId} value={b.buildingId}>
                    {b.buildingName}
                  </option>
                ))}
              </select>
            </div>

            {/* Listing Type (Sale / Rent) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Category
              </label>
              <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                {(['all', 'sale', 'rent'] as ListingType[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onFilterChange({ ...filter, listingType: cat })}
                    className={`flex-1 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                      filter.listingType === cat
                        ? 'bg-[#17243B] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Bedrooms */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Bedrooms
              </label>
              <select
                value={filter.bedrooms}
                onChange={(e) =>
                  onFilterChange({
                    ...filter,
                    bedrooms: e.target.value === 'all' ? 'all' : Number(e.target.value),
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#C6A878]"
              >
                <option value="all">Any Bed</option>
                <option value="1">1 Bedroom</option>
                <option value="2">2 Bedrooms</option>
                <option value="3">3 Bedrooms</option>
                <option value="4">4+ Bedrooms</option>
              </select>
            </div>
          </div>
        </div>

        {/* Listings Grid Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {properties.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <Building2 className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-[#17243B] mb-1">No Approved Listings Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                No properties match your active filter combinations. Try resetting filters or choosing All Areas.
              </p>
              <button
                onClick={onResetFilter}
                className="px-5 py-2 rounded-full bg-[#17243B] text-white text-xs font-semibold hover:bg-[#203150] transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                    className="group relative rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-slate-200 flex flex-col"
                  >
                    {/* Property Image with Badge and Fav */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900">
                      <img
                        src={primaryImage}
                        alt={property.propertyTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      {/* Status / Category Badge */}
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F8F7F3] text-[#17243B] text-[10px] font-bold uppercase tracking-wider shadow-sm">
                          {property.listingType === 'sale' ? 'For Sale' : 'For Rent'}
                        </span>
                        {property.featured && (
                          <span className="px-2 py-0.5 rounded-full bg-[#C6A878] text-[#17243B] text-[9px] font-bold uppercase tracking-wider">
                            Featured
                          </span>
                        )}
                      </div>

                      {/* Favorite Button */}
                      <button
                        type="button"
                        onClick={(e) => onToggleFavorite(property.propertyId, e)}
                        aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
                        className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors z-10 ${
                          isFav
                            ? 'bg-[#17243B] text-[#C6A878]'
                            : 'bg-black/30 hover:bg-black/60 text-white'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-[#C6A878]' : ''}`} />
                      </button>

                      {/* Price in image overlay */}
                      <div className="absolute bottom-2.5 right-3 text-right">
                        <span className="text-sm font-bold text-white font-mono tabular-nums drop-shadow-sm">
                          {formatPHP(property.price, property.listingType === 'rent')}
                        </span>
                      </div>
                    </div>

                    {/* Card Information */}
                    <div className="p-4 flex flex-col flex-1 justify-between">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] text-[#C6A878] font-semibold mb-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{property.location}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[#17243B] line-clamp-1 group-hover:text-[#C6A878] transition-colors mb-1">
                          {property.propertyTitle}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                          {property.description}
                        </p>
                      </div>

                      {/* Specs Row */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700 font-medium">
                        <div className="flex items-center gap-1">
                          <Bed className="w-3.5 h-3.5 text-slate-400" />
                          <span>{property.bedrooms} Bed</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Bath className="w-3.5 h-3.5 text-slate-400" />
                          <span>{property.bathrooms} Bath</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Maximize2 className="w-3 h-3 text-slate-400" />
                          <span>{property.floorArea} sqm</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
