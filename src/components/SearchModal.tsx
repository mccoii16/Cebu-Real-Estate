import React, { useState } from 'react';
import { X, Search, MapPin, ArrowRight } from 'lucide-react';
import { PropertyDoc } from '../types/property';
import { formatPHP } from '../utils/filterProperties';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: PropertyDoc[];
  onSelectProperty: (property: PropertyDoc) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  properties,
  onSelectProperty,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filtered = properties.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      p.propertyTitle.toLowerCase().includes(q) ||
      p.buildingName.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q)
    );
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search Properties"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <Search className="w-5 h-5 text-[#C6A878] flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by building, location, or area (e.g. Alcoves, IT Park)..."
            className="w-full text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-4 divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No matching approved properties found for "{query}".
            </div>
          ) : (
            filtered.map((property) => (
              <div
                key={property.propertyId}
                onClick={() => {
                  onSelectProperty(property);
                  onClose();
                }}
                className="py-3 px-3 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={property.images?.[0] || '/assets/extracted/the_alcoves.png'}
                    alt={property.propertyTitle}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#C6A878] transition-colors">
                      {property.propertyTitle}
                    </h4>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="w-3 h-3 text-[#C6A878]" />
                      <span>{property.location}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-[#17243B] font-mono tabular-nums">
                    {formatPHP(property.price, property.listingType === 'rent')}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
