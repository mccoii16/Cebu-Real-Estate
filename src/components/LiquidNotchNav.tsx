import React from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export type NavTabId = 'home' | 'properties' | 'about' | 'locations' | 'contact';

interface NavItem {
  id: NavTabId;
  label: string;
  hasDropdown?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'properties', label: 'Properties', hasDropdown: true },
  { id: 'about', label: 'About' },
  { id: 'locations', label: 'Locations' },
  { id: 'contact', label: 'Contact' },
];

interface LiquidNotchNavProps {
  activeTab: NavTabId;
  onTabChange: (id: NavTabId) => void;
  className?: string;
}

export const LiquidNotchNav: React.FC<LiquidNotchNavProps> = ({
  activeTab,
  onTabChange,
  className = '',
}) => {
  return (
    <nav
      aria-label="Main Navigation"
      className={`relative inline-flex items-center px-1.5 py-1.5 rounded-full bg-[#17243B]/60 backdrop-blur-xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.36)] ${className}`}
    >
      <div className="flex items-center gap-1 relative">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative px-4 sm:px-5 py-2 text-sm font-medium transition-colors duration-200 z-10 flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878] rounded-full ${
                isActive
                  ? 'text-[#17243B] font-semibold'
                  : 'text-white/85 hover:text-white'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="liquid-notch-indicator"
                  className="absolute inset-0 bg-gradient-to-b from-white via-[#FAF9F5] to-[#F4F1EA] rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.18)] -z-10"
                  transition={{
                    type: 'spring',
                    stiffness: 450,
                    damping: 35,
                    mass: 0.8,
                  }}
                >
                  {/* Top Champagne Illuminated Rim Glow */}
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-20 h-4 bg-[#C6A878] opacity-75 blur-[8px] pointer-events-none rounded-full" />
                  <div className="absolute top-0 inset-x-2 h-[2px] bg-gradient-to-r from-transparent via-[#C6A878] to-transparent" />

                  {/* Clean rounded pill with top champagne glow - corner triangles removed */}
                </motion.div>
              )}

              <span className="relative z-10 whitespace-nowrap tracking-wide">
                {item.label}
              </span>

              {item.hasDropdown && (
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 relative z-10 ${
                    isActive ? 'text-[#17243B] rotate-0' : 'text-white/70'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
