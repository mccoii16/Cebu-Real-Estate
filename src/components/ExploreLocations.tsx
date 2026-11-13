import React from 'react';
import { ArrowRight } from 'lucide-react';
import { LOCATIONS_DATA } from '../data/locations';
import { LocationHighlight } from '../types/property';

interface ExploreLocationsProps {
  onSelectLocation: (location: string) => void;
  onBrowseAllLocations: () => void;
  locations?: LocationHighlight[];
}

export const ExploreLocations: React.FC<ExploreLocationsProps> = ({
  onSelectLocation,
  onBrowseAllLocations,
  locations,
}) => {
  const displayLocations = locations && locations.length > 0 ? locations.slice(0, 4) : LOCATIONS_DATA;

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
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#17243B] hover:text-[#C6A878] transition-colors group self-start whitespace-nowrap flex-nowrap shrink-0"
          >
            <span className="whitespace-nowrap">Browse All Locations</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform flex-shrink-0" />
          </button>
        </div>

        {/* Right 4 Location Cards */}
        <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {displayLocations.map((location) => (
            <div
              key={location.id}
              onClick={() => onSelectLocation(location.name)}
              className="group relative rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_28px_rgba(23,36,59,0.18)] hover:-translate-y-1 transition-all duration-300 cursor-pointer aspect-[16/10] sm:aspect-[270/145]"
            >
              <img
                src={location.image || '/assets/extracted/photo_the_alcoves.png'}
                alt={location.name}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/assets/extracted/photo_the_alcoves.png';
                }}
                className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              {/* Bottom gradient and title tag for clear readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent flex items-end p-3 pointer-events-none">
                <div className="w-full flex items-center justify-between text-white gap-2">
                  <div className="overflow-hidden min-w-0">
                    <span className="block text-xs font-bold leading-tight truncate drop-shadow-sm">{location.name}</span>
                    {location.tagline && (
                      <span className="block text-[10px] text-[#C6A878] font-medium truncate drop-shadow-sm">{location.tagline}</span>
                    )}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center flex-shrink-0 group-hover:bg-[#C6A878] group-hover:text-[#17243B] transition-colors">
                    <ArrowRight className="w-3.5 h-3.5 text-white group-hover:text-[#17243B]" />
                  </div>
                </div>
              </div>
              {/* Subtle hover gleam */}
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

