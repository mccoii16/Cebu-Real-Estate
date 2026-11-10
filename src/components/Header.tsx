import React, { useState } from 'react';
import { Search, Heart, Menu, X, ArrowRight } from 'lucide-react';
import { LiquidNotchNav, NavTabId } from './LiquidNotchNav';

interface HeaderProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
  onOpenSearch: () => void;
  onOpenInquire: () => void;
  favoriteCount: number;
  onOpenFavorites: () => void;
  onOpenPortal: () => void;
  userRole?: 'superadmin' | 'agent' | null;
  userDisplayName?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenSearch,
  onOpenInquire,
  favoriteCount,
  onOpenFavorites,
  onOpenPortal,
  userRole,
  userDisplayName,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileNavClick = (tab: NavTabId) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="relative z-40 w-full px-4 sm:px-8 lg:px-12 py-5 flex items-center justify-between">
      {/* Brand Logo - Cebu Prime Properties */}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onTabChange('home');
        }}
        className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878] rounded-lg"
      >
        {/* Custom Architectural Towers SVG */}
        <div className="w-10 h-10 flex-shrink-0 relative flex items-center justify-center">
          <svg
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full text-[#C6A878] transition-transform duration-300 group-hover:scale-105"
          >
            {/* Elegant architectural lines */}
            <path
              d="M10 38V22L20 10V38"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 16L28 6V38"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M28 20L36 14V38"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="6"
              y1="38"
              x2="42"
              y2="38"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Modern vertical accent slashes */}
            <line x1="15" y1="26" x2="15" y2="34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="24" y1="18" x2="24" y2="34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="32" y1="24" x2="32" y2="34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        <div className="flex flex-col text-left">
          <span className="text-white font-serif tracking-[0.18em] text-sm sm:text-base font-semibold leading-tight group-hover:text-[#DFCDAA] transition-colors">
            CEBU PRIME
          </span>
          <span className="text-[#C6A878] tracking-[0.32em] text-[8px] sm:text-[9px] font-medium uppercase leading-none mt-0.5">
            PROPERTIES
          </span>
        </div>
      </a>

      {/* Floating Pill Center Navigation - Desktop */}
      <div className="hidden lg:flex items-center justify-center">
        <LiquidNotchNav activeTab={activeTab} onTabChange={onTabChange} />
      </div>

      {/* Right Action Cluster */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-nowrap flex-shrink-0">
        {/* Search Icon Button */}
        <button
          onClick={onOpenSearch}
          aria-label="Open search dialog"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878] flex-shrink-0"
        >
          <Search className="w-3.5 h-3.5 text-white/90" />
        </button>

        {/* Saved Favorites Trigger */}
        <button
          onClick={onOpenFavorites}
          aria-label={`View saved favorites (${favoriteCount})`}
          className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878] flex-shrink-0"
        >
          <Heart
            className={`w-3.5 h-3.5 ${favoriteCount > 0 ? 'fill-[#C6A878] text-[#C6A878]' : 'text-white/90'}`}
          />
          {favoriteCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#C6A878] text-[#17243B] text-[10px] font-bold flex items-center justify-center shadow-sm">
              {favoriteCount}
            </span>
          )}
        </button>

        {/* Staff / Agent / Super Admin Portal Button (Strictly 1 line, compact) */}
        <button
          onClick={onOpenPortal}
          title={userRole ? `${userDisplayName || 'User'} (${userRole})` : 'Staff & Agent Portal'}
          className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border text-[11px] sm:text-xs font-semibold tracking-wide whitespace-nowrap flex-shrink-0 leading-none transition-all duration-200 ${
            userRole === 'superadmin'
              ? 'bg-[#C6A878] text-[#17243B] border-[#C6A878] hover:bg-[#b89764] shadow-sm'
              : userRole === 'agent'
              ? 'bg-white/20 text-white border-white/30 hover:bg-white/30'
              : 'border-white/20 bg-white/10 text-white/90 hover:text-white hover:bg-white/20'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#17243B] flex-shrink-0" />
          <span className="whitespace-nowrap">
            {userRole === 'superadmin'
              ? 'Admin Dashboard'
              : userRole === 'agent'
              ? 'Agent Workspace'
              : 'Portal'}
          </span>
        </button>

        {/* Primary CTA: Inquire Now -> (Strictly 1 line, compact) */}
        <button
          onClick={onOpenInquire}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#F8F7F3] hover:bg-white text-[#17243B] text-[11px] sm:text-xs font-semibold tracking-wide whitespace-nowrap flex-shrink-0 leading-none transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.12)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878] active:scale-[0.98]"
        >
          <span className="whitespace-nowrap">Inquire Now</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#17243B] flex-shrink-0" />
        </button>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle mobile menu"
          className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 p-4 lg:hidden z-50">
          <div className="rounded-2xl bg-[#17243B]/95 backdrop-blur-2xl border border-white/15 p-5 shadow-2xl flex flex-col gap-3">
            {(
              [
                { id: 'home', label: 'Home' },
                { id: 'properties', label: 'Properties' },
                { id: 'about', label: 'About Us' },
                { id: 'locations', label: 'Top Locations' },
                { id: 'contact', label: 'Contact & Inquiries' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleMobileNavClick(tab.id)}
                className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                  activeTab === tab.id
                    ? 'text-[#C6A878] font-semibold bg-white/5'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{tab.label}</span>
                {activeTab === tab.id && <span className="w-1.5 h-1.5 rounded-full bg-[#C6A878]" />}
              </button>
            ))}

            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenPortal();
                }}
                className="w-full py-2.5 rounded-full border border-white/20 text-white hover:bg-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <span>
                  {userRole === 'superadmin'
                    ? 'Super Admin Dashboard'
                    : userRole === 'agent'
                    ? 'Agent Workspace'
                    : 'Staff & Agent Portal'}
                </span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenInquire();
                }}
                className="w-full py-3 rounded-full bg-[#C6A878] hover:bg-[#b59664] text-[#17243B] text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <span>Inquire Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
