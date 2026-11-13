import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Building2, MapPin, Tag, Search, ChevronDown, Check } from 'lucide-react';
import { PropertyType, PropertyFilter, LocationHighlight } from '../types/property';

const PROPERTY_TYPES: PropertyType[] = [
  'All Types',
  'Condo',
  'Penthouse',
  'House & Lot',
  'Commercial',
  'Townhouse',
];

export const INITIAL_LOCATIONS = [
  'All Areas',
  'Cebu Business Park',
  'Cebu IT Park',
  'Mactan Newtown',
  'Banilad',
  'Lahug',
  'SRP',
  'Mandaue',
  'Lapu-Lapu City',
];

interface PriceOption {
  label: string;
  min: number;
  max: number;
}

const PRICE_OPTIONS: PriceOption[] = [
  { label: 'Any Price', min: 0, max: 0 },
  { label: 'Under ₱5M', min: 0, max: 5_000_000 },
  { label: '₱5M - ₱10M', min: 5_000_000, max: 10_000_000 },
  { label: '₱10M - ₱15M', min: 10_000_000, max: 15_000_000 },
  { label: 'Above ₱15M', min: 15_000_000, max: 0 },
];

interface FloatingSearchBarProps {
  filter: PropertyFilter;
  onFilterChange: (newFilter: PropertyFilter) => void;
  onSearchExecute: () => void;
  locations?: LocationHighlight[];
}

export const FloatingSearchBar: React.FC<FloatingSearchBarProps> = ({
  filter,
  onFilterChange,
  onSearchExecute,
  locations,
}) => {
  const [openDropdown, setOpenDropdown] = useState<'type' | 'location' | 'price' | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const locationOptions = useMemo(() => {
    if (locations && locations.length > 0) {
      return ['All Areas', ...locations.map((l) => l.name)];
    }
    return INITIAL_LOCATIONS;
  }, [locations]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectType = (type: PropertyType) => {
    onFilterChange({ ...filter, type });
    setOpenDropdown(null);
  };

  const handleSelectLocation = (location: string) => {
    onFilterChange({ ...filter, location });
    setOpenDropdown(null);
  };

  const handleSelectPrice = (option: PriceOption) => {
    onFilterChange({
      ...filter,
      minPrice: option.min,
      maxPrice: option.max,
    });
    setOpenDropdown(null);
  };

  const getCurrentPriceLabel = () => {
    if (filter.minPrice === 0 && filter.maxPrice === 0) return 'Any Price';
    if (filter.minPrice === 0 && filter.maxPrice === 5_000_000) return 'Under ₱5M';
    if (filter.minPrice === 5_000_000 && filter.maxPrice === 10_000_000) return '₱5M - ₱10M';
    if (filter.minPrice === 10_000_000 && filter.maxPrice === 15_000_000) return '₱10M - ₱15M';
    if (filter.minPrice === 15_000_000 && filter.maxPrice === 0) return 'Above ₱15M';
    return `₱${(filter.minPrice / 1_000_000).toFixed(0)}M - ₱${(filter.maxPrice / 1_000_000).toFixed(0)}M`;
  };

  return (
    <div
      ref={containerRef}
      className="relative z-30 w-full max-w-5xl mx-auto px-3 sm:px-4 -mt-10 sm:-mt-12 mb-8"
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl md:rounded-full p-2.5 md:p-2 border border-black/5 shadow-[0_16px_40px_rgba(23,36,59,0.12)]">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-1">
          {/* 1. Property Type Selector */}
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
              className="w-full min-h-[44px] text-left px-3.5 sm:px-4 py-2 rounded-xl md:rounded-full hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878]"
              aria-haspopup="listbox"
              aria-expanded={openDropdown === 'type'}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#F8F7F3] flex items-center justify-center text-[#17243B] flex-shrink-0">
                  <Building2 className="w-4 h-4 text-[#17243B]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Property Type
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-[#17243B] whitespace-nowrap truncate">
                    {filter.type}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
                  openDropdown === 'type' ? 'rotate-180 text-[#C6A878]' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {openDropdown === 'type' && (
              <div className="absolute top-full left-0 mt-2 w-full sm:w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50">
                {PROPERTY_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSelectType(t)}
                    className="w-full min-h-[40px] text-left px-4 py-2 text-xs sm:text-sm hover:bg-[#F8F7F3] flex items-center justify-between text-[#17243B] transition-colors whitespace-nowrap"
                  >
                    <span className={filter.type === t ? 'font-bold text-[#17243B]' : 'font-normal'}>
                      {t}
                    </span>
                    {filter.type === t && <Check className="w-4 h-4 text-[#C6A878] flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-8 bg-slate-200 flex-shrink-0" />

          {/* 2. Location Selector */}
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'location' ? null : 'location')}
              className="w-full min-h-[44px] text-left px-3.5 sm:px-4 py-2 rounded-xl md:rounded-full hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878]"
              aria-haspopup="listbox"
              aria-expanded={openDropdown === 'location'}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#F8F7F3] flex items-center justify-center text-[#17243B] flex-shrink-0">
                  <MapPin className="w-4 h-4 text-[#17243B]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Location
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-[#17243B] whitespace-nowrap truncate">
                    {filter.location}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
                  openDropdown === 'location' ? 'rotate-180 text-[#C6A878]' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {openDropdown === 'location' && (
              <div className="absolute top-full left-0 mt-2 w-full sm:w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 max-h-72 overflow-y-auto">
                {locationOptions.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handleSelectLocation(loc)}
                    className="w-full min-h-[40px] text-left px-4 py-2 text-xs sm:text-sm hover:bg-[#F8F7F3] flex items-center justify-between text-[#17243B] transition-colors whitespace-nowrap"
                  >
                    <span className={`truncate ${filter.location === loc ? 'font-bold text-[#17243B]' : 'font-normal'}`}>
                      {loc}
                    </span>
                    {filter.location === loc && <Check className="w-4 h-4 text-[#C6A878] flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-8 bg-slate-200 flex-shrink-0" />

          {/* 3. Price Range Selector */}
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'price' ? null : 'price')}
              className="w-full min-h-[44px] text-left px-3.5 sm:px-4 py-2 rounded-xl md:rounded-full hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878]"
              aria-haspopup="listbox"
              aria-expanded={openDropdown === 'price'}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#F8F7F3] flex items-center justify-center text-[#17243B] flex-shrink-0">
                  <Tag className="w-4 h-4 text-[#17243B]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Price Range
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-[#17243B] whitespace-nowrap truncate">
                    {getCurrentPriceLabel()}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
                  openDropdown === 'price' ? 'rotate-180 text-[#C6A878]' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {openDropdown === 'price' && (
              <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 w-full sm:w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50">
                {PRICE_OPTIONS.map((opt) => {
                  const isSelected =
                    filter.minPrice === opt.min && filter.maxPrice === opt.max;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => handleSelectPrice(opt)}
                      className="w-full min-h-[40px] text-left px-4 py-2 text-xs sm:text-sm hover:bg-[#F8F7F3] flex items-center justify-between text-[#17243B] transition-colors whitespace-nowrap"
                    >
                      <span className={isSelected ? 'font-bold text-[#17243B]' : 'font-normal'}>
                        {opt.label}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-[#C6A878] flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search Button */}
          <div className="p-0.5 md:p-1 flex-shrink-0">
            <button
              type="button"
              onClick={onSearchExecute}
              className="w-full md:w-auto min-h-[44px] px-6 py-2.5 rounded-xl md:rounded-full bg-[#17243B] hover:bg-[#203150] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878] active:scale-[0.98] whitespace-nowrap"
            >
              <Search className="w-4 h-4 text-white flex-shrink-0" />
              <span className="whitespace-nowrap">Search</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

