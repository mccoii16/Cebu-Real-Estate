import React from 'react';
import { motion } from 'motion/react';

export type NavTabId = 'home' | 'properties' | 'about' | 'locations' | 'contact';

interface NavItem {
  id: NavTabId;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'properties', label: 'Properties' },
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
      <div className="flex items-center gap-0.5 xl:gap-1 relative">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`relative px-2.5 xl:px-4 py-1.5 text-xs xl:text-sm font-medium transition-colors duration-200 z-10 flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878] rounded-full whitespace-nowrap flex-nowrap shrink-0 ${
                isActive
                  ? 'text-[#C6A878] font-semibold'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <span className="relative z-10 whitespace-nowrap tracking-wide">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

