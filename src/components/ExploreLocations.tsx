import React from 'react';
import { ArrowRight } from 'lucide-react';
import { LOCATIONS_DATA } from '../data/locations';
import { PropertyLocation } from '../types/property';

interface ExploreLocationsProps {
  onSelectLocation: (location: string) => void;
  onBrowseAllLocations: () => void;
}

export const ExploreLocations: React.FC<ExploreLocationsProps> = ({
  onSelectLocation,
  onBrowseAllLocations,
}) => {
  return (
    <section id="locations" className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-10 sm:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Title & Narrative */}
        <div className="lg:col-span-3 flex flex-col justify-center pr-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17243B] font-sans leading-tight mb-3">
            Explore
            <br />
            Top Locations
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
            Discover the best places to live and invest in Cebu’s most sought-after areas.
          </p>
          <button
            onClick={onBrowseAllLocations}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#17243B] hover:text-[#C6A878] transition-colors group self-start"
          >
            <span>Browse All Locations</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Right 4 Location Cards */}
        <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LOCATIONS_DATA.map((location) => (
            <div
              key={location.id}
              onClick={() => onSelectLocation(location.name)}
              className="group relative rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_28px_rgba(23,36,59,0.18)] hover:-translate-y-1 transition-all duration-300 cursor-pointer aspect-[270/145]"
            >
              <img
                src={location.image}
                alt={location.name}
                className="w-full h-full object-cover rounded-2xl"
                referrerPolicy="no-referrer"
              />
              {/* Subtle hover gleam */}
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
