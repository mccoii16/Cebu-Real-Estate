import React from 'react';
import { ShieldCheck, Award, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';

export const AboutSection: React.FC = () => {
  return (
    <section id="about" className="w-full bg-[#17243B] text-white py-16 sm:py-24 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#C6A878]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-900/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 relative z-10">
        {/* Header */}
        <div className="max-w-3xl mb-12 sm:mb-16">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[#C6A878] uppercase mb-3">
            <span>About Cebu Prime Properties</span>
            <span className="w-8 h-px bg-[#C6A878]" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6 font-sans">
            Setting the Benchmark for Luxury Real Estate in Central Visayas
          </h2>
          <p className="text-base sm:text-lg text-white/80 leading-relaxed">
            Cebu Prime Properties represents the finest residential towers, coastal estates, and commercial holdings across Cebu’s most coveted districts. We unite discerning buyers and investors with architectural excellence.
          </p>
        </div>

        {/* Quantified Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16 py-8 border-y border-white/10">
          <div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#C6A878] font-mono tabular-nums mb-1">
              ₱12B+
            </div>
            <div className="text-xs sm:text-sm text-white/70">
              Total Transaction Volume
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#C6A878] font-mono tabular-nums mb-1">
              15+
            </div>
            <div className="text-xs sm:text-sm text-white/70">
              Years in Prime Cebu Market
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#C6A878] font-mono tabular-nums mb-1">
              98.4%
            </div>
            <div className="text-xs sm:text-sm text-white/70">
              Client Satisfaction & Repeat Rate
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#C6A878] font-mono tabular-nums mb-1">
              450+
            </div>
            <div className="text-xs sm:text-sm text-white/70">
              High-Net-Worth Portfolios Advised
            </div>
          </div>
        </div>

        {/* Three Value Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-[#C6A878]/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-[#C6A878]/20 flex items-center justify-center text-[#C6A878] mb-5">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Curated Luxury Only</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Every property in our portfolio undergoes stringent title scrutiny, structural appraisal, and developer track-record validation before representation.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-[#C6A878]/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-[#C6A878]/20 flex items-center justify-center text-[#C6A878] mb-5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Private Client Discretion</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              We manage off-market sales, penthouse acquisitions, and corporate leases with uncompromising confidentiality and seamless legal handling.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-[#C6A878]/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-[#C6A878]/20 flex items-center justify-center text-[#C6A878] mb-5">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Yield & Capital Growth</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Deep regional analytics identifying upcoming infrastructure corridors, BPO expansion zones, and airport transit advantages to maximize your ROI.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
