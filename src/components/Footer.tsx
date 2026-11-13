import React, { useState } from 'react';
import { X, Shield } from 'lucide-react';
import { NavTabId } from './LiquidNotchNav';
import { LocationHighlight, WebsiteSettings } from '../types/property';

interface FooterProps {
  onNavClick: (tab: NavTabId) => void;
  onSelectLocation?: (locationName: string) => void;
  locations?: LocationHighlight[];
  siteSettings?: WebsiteSettings;
}

type LegalTopic = 'Privacy Policy' | 'Terms of Service' | 'Fair Housing Notice' | null;

const LEGAL_COPY: Record<Exclude<LegalTopic, null>, string> = {
  'Privacy Policy':
    'Cebu Prime Properties respects client confidentiality. Personal inquiry details (name, phone number, email address, and viewing preferences) are used exclusively by authorized licensed property specialists to coordinate private viewings and property advisory consultations.',
  'Terms of Service':
    'All property pricing, floor areas, availability, and specifications presented across Cebu Prime Properties are subject to final developer or owner confirmation without prior notice. Formal reservations and deeds of sale are governed by Philippine real estate regulations.',
  'Fair Housing Notice':
    'Cebu Prime Properties adheres strictly to equal housing opportunity standards in the Philippines, offering transparent real estate advisory services without discrimination.',
};

export const Footer: React.FC<FooterProps> = ({
  onNavClick,
  onSelectLocation,
  locations,
  siteSettings,
}) => {
  const [legalTopic, setLegalTopic] = useState<LegalTopic>(null);

  const brandWords = (siteSettings?.siteName || 'CEBU PRIME').trim();
  const subtitle = siteSettings?.logoSubtitle || 'PROPERTIES';
  const officeAddress = siteSettings?.officeAddress || 'Cebu Business Park, Cebu City, 6000 Philippines';

  const featuredAreas =
    locations && locations.length > 0
      ? locations.slice(0, 4).map((l) => l.name)
      : ['Cebu Business Park', 'Cebu IT Park', 'Mactan Newtown', 'Banilad'];

  const handleAreaClick = (areaName: string) => {
    if (onSelectLocation) {
      onSelectLocation(areaName);
    } else {
      onNavClick('locations');
    }
  };

  return (
    <>
      <footer className="w-full bg-[#17243B] text-white pt-14 sm:pt-16 pb-10 sm:pb-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-10 pb-10 sm:pb-12 border-b border-white/10">
            {/* Brand Info */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 text-[#C6A878] flex-shrink-0">
                  <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
                    <path d="M10 38V22L20 10V38" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 16L28 6V38" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M28 20L36 14V38" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="6" y1="38" x2="42" y2="38" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-serif tracking-[0.18em] text-base font-semibold uppercase">
                    {brandWords}
                  </span>
                  <span className="text-[#C6A878] tracking-[0.32em] text-[9px] font-medium uppercase mt-0.5">
                    {subtitle}
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-white/70 max-w-sm leading-relaxed mb-5">
                Premier real estate advisory showcasing high-yield residences, iconic condominiums, and trophy coastal estates across Metro Cebu.
              </p>

              <div className="text-[11px] text-white/55 space-y-1">
                <div>DHSUD Reg. No. CR-004819 | PRC License No. 0029418</div>
                <div>{officeAddress}</div>
              </div>

              {(siteSettings?.facebookUrl || siteSettings?.instagramUrl) && (
                <div className="flex items-center gap-3 mt-4 text-xs">
                  {siteSettings.facebookUrl && (
                    <a
                      href={siteSettings.facebookUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-full border border-white/15 text-white/80 hover:text-[#C6A878] hover:border-[#C6A878]/50 transition-colors whitespace-nowrap"
                    >
                      Facebook
                    </a>
                  )}
                  {siteSettings.instagramUrl && (
                    <a
                      href={siteSettings.instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-full border border-white/15 text-white/80 hover:text-[#C6A878] hover:border-[#C6A878]/50 transition-colors whitespace-nowrap"
                    >
                      Instagram
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-[#C6A878] mb-4">
                Navigation
              </h4>
              <ul className="space-y-2.5 text-xs sm:text-sm text-white/70">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavClick('home')}
                    className="hover:text-white transition-colors whitespace-nowrap"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavClick('properties')}
                    className="hover:text-white transition-colors whitespace-nowrap"
                  >
                    Properties
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavClick('about')}
                    className="hover:text-white transition-colors whitespace-nowrap"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavClick('locations')}
                    className="hover:text-white transition-colors whitespace-nowrap"
                  >
                    Top Locations
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavClick('contact')}
                    className="hover:text-white transition-colors whitespace-nowrap"
                  >
                    Contact &amp; Inquiries
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
                {featuredAreas.map((areaName) => (
                  <li key={areaName}>
                    <button
                      type="button"
                      onClick={() => handleAreaClick(areaName)}
                      className="hover:text-white transition-colors text-left"
                    >
                      {areaName}
                    </button>
                  </li>
                ))}
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
                <li>Property Staging &amp; Lease Management</li>
                <li>Title Verification &amp; Closing Support</li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/55">
            <div className="text-center sm:text-left">
              © {new Date().getFullYear()} {brandWords} {subtitle}. All rights reserved.
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
              {(['Privacy Policy', 'Terms of Service', 'Fair Housing Notice'] as const).map((topic, idx) => (
                <React.Fragment key={topic}>
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  <button
                    type="button"
                    onClick={() => setLegalTopic(topic)}
                    className="hover:text-[#C6A878] transition-colors whitespace-nowrap"
                  >
                    {topic}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Legal Notice Modal */}
      {legalTopic && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={legalTopic}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17243B]/80 backdrop-blur-sm"
          onClick={() => setLegalTopic(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#17243B] flex items-center gap-2 font-serif">
                <Shield className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
                <span>{legalTopic}</span>
              </h3>
              <button
                type="button"
                onClick={() => setLegalTopic(null)}
                aria-label="Close legal notice"
                className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {LEGAL_COPY[legalTopic]}
            </p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalTopic(null)}
                className="px-5 min-h-[44px] rounded-xl bg-[#17243B] text-[#C6A878] text-xs font-bold whitespace-nowrap"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

