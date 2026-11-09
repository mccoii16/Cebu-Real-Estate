import React from 'react';
import { NavTabId } from './LiquidNotchNav';

interface FooterProps {
  onNavClick: (tab: NavTabId) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavClick }) => {
  return (
    <footer className="w-full bg-[#17243B] text-white pt-16 pb-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10">
          {/* Brand Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 text-[#C6A878]">
                <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
                  <path d="M10 38V22L20 10V38" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M20 16L28 6V38" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M28 20L36 14V38" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="6" y1="38" x2="42" y2="38" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-serif tracking-[0.18em] text-base font-semibold">
                  CEBU PRIME
                </span>
                <span className="text-[#C6A878] tracking-[0.32em] text-[9px] font-medium uppercase mt-0.5">
                  PROPERTIES
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-white/70 max-w-sm leading-relaxed mb-6">
              Premier real estate advisory showcasing high-yield residences, iconic condominiums, and trophy coastal estates across Metro Cebu.
            </p>

            <div className="text-[11px] text-white/50 space-y-1">
              <div>DHSUD Reg. No. CR-004819 | PRC License No. 0029418</div>
              <div>Cebu Business Park, Cebu City, 6000 Philippines</div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-[#C6A878] mb-4">
              Navigation
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-white/70">
              <li>
                <button
                  onClick={() => onNavClick('home')}
                  className="hover:text-white transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('properties')}
                  className="hover:text-white transition-colors"
                >
                  Properties
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('about')}
                  className="hover:text-white transition-colors"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('locations')}
                  className="hover:text-white transition-colors"
                >
                  Top Locations
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('contact')}
                  className="hover:text-white transition-colors"
                >
                  Contact & Inquiries
                </button>
              </li>
            </ul>
          </div>

          {/* Locations */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-[#C6A878] mb-4">
              Featured Areas
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-white/70">
              <li>
                <button
                  onClick={() => onNavClick('locations')}
                  className="hover:text-white transition-colors"
                >
                  Cebu Business Park
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('locations')}
                  className="hover:text-white transition-colors"
                >
                  Cebu IT Park
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('locations')}
                  className="hover:text-white transition-colors"
                >
                  Mactan Newtown
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavClick('locations')}
                  className="hover:text-white transition-colors"
                >
                  Banilad Enclaves
                </button>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-[#C6A878] mb-4">
              Client Advisory
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-white/70">
              <li>Private Penthouse Acquisitions</li>
              <li>Foreign Investor Consultation</li>
              <li>Property Staging & Lease Management</li>
              <li>Title Verification & Closing Support</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50">
          <div>
            © {new Date().getFullYear()} Cebu Prime Properties. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span>Privacy Policy</span>
            <span>·</span>
            <span>Terms of Service</span>
            <span>·</span>
            <span>Fair Housing Notice</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
