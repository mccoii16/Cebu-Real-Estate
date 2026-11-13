import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroSlide {
  id: number;
  label: string;
  location: string;
  image: string;
  headlineLine1: string;
  headlineLine2: string;
  subheading: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 1,
    label: '01',
    location: 'Cebu City & Coastal Skyline',
    image: '/assets/extracted/hero_skyline_clean.png',
    headlineLine1: 'Find Your Perfect',
    headlineLine2: 'Property in Cebu',
    subheading: 'Modern living. Prime locations. Endless possibilities.',
  },
  {
    id: 2,
    label: '02',
    location: 'Cebu Business Park & IT Park',
    image: '/assets/extracted/photo_park_avenue.png',
    headlineLine1: 'Elevated High-Rise',
    headlineLine2: 'Living in the Metro',
    subheading: 'World-class amenities connected to Cebu’s top business centers.',
  },
  {
    id: 3,
    label: '03',
    location: 'Mactan Coastal Township',
    image: '/assets/extracted/loc_mactan.png',
    headlineLine1: 'Resort Living by',
    headlineLine2: 'The Turquoise Coast',
    subheading: 'Island tranquility just moments from the international gateway.',
  },
];

import { WebsiteSettings } from '../types/property';

interface HeroProps {
  onExploreClick: () => void;
  settings?: WebsiteSettings;
}

export const Hero: React.FC<HeroProps> = ({ onExploreClick, settings }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const activeSlides: HeroSlide[] =
    settings?.heroSlides && settings.heroSlides.length > 0
      ? settings.heroSlides.map((s, idx) => ({
          id: s.id || idx + 1,
          label: s.label || `0${idx + 1}`,
          location: s.location || 'Cebu Prime District',
          image: s.image,
          headlineLine1: s.headlineLine1 || 'Find Your Perfect',
          headlineLine2: s.headlineLine2 || 'Property in Cebu',
          subheading: s.subheading || 'Modern living. Prime locations. Endless possibilities.',
        }))
      : HERO_SLIDES;

  const prevSlide = () => {
    setCurrentSlideIndex((prev) => (prev === 0 ? activeSlides.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentSlideIndex((prev) => (prev === activeSlides.length - 1 ? 0 : prev + 1));
  };

  // Subtle auto-advance every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev === activeSlides.length - 1 ? 0 : prev + 1));
    }, 8000);
    return () => clearInterval(timer);
  }, [activeSlides.length]);

  const currentSlide = activeSlides[currentSlideIndex] || activeSlides[0];
  const fallbackSlideImage = HERO_SLIDES[currentSlideIndex]?.image || '/assets/extracted/hero_skyline_clean.png';
  const resolvedSlideImage =
    failedSrc && failedSrc === currentSlide.image ? fallbackSlideImage : currentSlide.image;
  const badgeText = settings?.heroBadge?.trim() || 'LIVE • INVEST • THRIVE';

  // Recover if an external custom slide URL hangs/fails to load without flashing default upfront
  useEffect(() => {
    const imgSrc = currentSlide.image;
    if (!imgSrc || !imgSrc.startsWith('http')) return;
    let active = true;
    const timeoutId = setTimeout(() => {
      if (active) {
        const imgEl = document.querySelector<HTMLImageElement>('img[data-hero-slide="true"]');
        if (imgEl && (!imgEl.complete || imgEl.naturalWidth === 0)) {
          setFailedSrc(imgSrc);
        }
      }
    }, 4500);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [currentSlide.image]);

  return (
    <section className="relative w-full bg-[#17243B] min-h-[540px] sm:min-h-[580px] lg:min-h-[640px] pt-2 sm:pt-4 pb-24 sm:pb-32 overflow-hidden flex flex-col justify-between">
      {/* Dynamic Background Image & Subtle Vignette */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Deep architectural backdrop glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#17243B] via-[#17243B]/85 to-transparent z-10 w-full lg:w-2/3" />
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#17243B] to-transparent z-10" />

        {/* Right-aligned Architectural Skyline Photo */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={resolvedSlideImage || currentSlide.id}
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-0 bottom-0 w-full lg:w-3/5 h-full"
          >
            <img
              data-hero-slide="true"
              src={resolvedSlideImage}
              alt="Cebu Prime Skyline"
              loading="eager"
              decoding="async"
              onError={() => {
                setFailedSrc(currentSlide.image);
              }}
              className="w-full h-full object-cover object-center lg:object-right filter brightness-[0.92] contrast-[1.05]"
              referrerPolicy="no-referrer"
            />
            {/* Soft left gradient fade over image */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#17243B] via-transparent to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17243B] via-transparent to-transparent opacity-80" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Hero Content Grid */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-6 sm:pt-14 pb-6 sm:pb-8">
        <div className="max-w-2xl">
          {/* Tagline / Kicker */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-wrap items-center gap-2 text-[11px] sm:text-sm tracking-[0.22em] sm:tracking-[0.25em] text-[#C6A878] uppercase font-semibold mb-3 sm:mb-4"
          >
            <span>{badgeText}</span>
          </motion.div>

          {/* Primary Headline */}
          <motion.h1
            key={`headline-${currentSlide.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08] mb-4 sm:mb-5 font-sans"
            style={{ textWrap: 'balance' }}
          >
            {currentSlide.headlineLine1}
            <br />
            <span className="text-white/95">{currentSlide.headlineLine2}</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            key={`subheading-${currentSlide.id}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-sm sm:text-lg text-white/80 font-normal leading-relaxed mb-7 sm:mb-8 max-w-xl"
          >
            {currentSlide.subheading}
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-4"
          >
            <button
              type="button"
              onClick={onExploreClick}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 sm:px-7 py-2.5 sm:py-3.5 rounded-full border border-white/25 bg-[#17243B]/60 hover:bg-[#17243B] text-white font-medium text-xs sm:text-sm tracking-wide transition-all duration-200 shadow-lg hover:border-[#C6A878] group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878] whitespace-nowrap flex-nowrap shrink-0"
            >
              <span className="whitespace-nowrap">Explore Listings</span>
              <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </button>
          </motion.div>
        </div>
      </div>

      {/* Bottom Carousel Navigation Controls */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 flex items-center justify-between mt-auto pt-4 sm:pt-6">
        <div className="flex items-center gap-3 sm:gap-4 text-white/80 text-xs sm:text-sm font-medium">
          {/* Slide Indicator: 01 ———— 03 */}
          <span className="font-mono tabular-nums text-white">{currentSlide.label}</span>

          {/* Animated Progress Bar */}
          <div className="relative w-14 sm:w-20 h-[2px] bg-white/20 rounded-full overflow-hidden">
            <motion.div
              key={currentSlideIndex}
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 8, ease: 'linear' }}
              className="h-full bg-[#C6A878]"
            />
          </div>

          <span className="font-mono tabular-nums text-white/50">
            {activeSlides.length < 10 ? `0${activeSlides.length}` : activeSlides.length}
          </span>

          {/* Circular Previous / Next Arrows */}
          <div className="flex items-center gap-2 ml-1 sm:ml-2">
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous slide"
              className="w-8 h-8 rounded-full border border-white/25 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next slide"
              className="w-8 h-8 rounded-full border border-white/25 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Organic Bottom Wave Shape Transition into Ivory Section */}
      <div className="absolute -bottom-1 inset-x-0 w-full overflow-hidden pointer-events-none z-10 leading-none">
        <svg
          viewBox="0 0 1440 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-12 sm:h-16 lg:h-20 text-[#F8F7F3] fill-current"
          preserveAspectRatio="none"
        >
          <path d="M0,0 C320,70 540,80 720,80 C960,80 1200,30 1440,50 L1440,80 L0,80 Z" />
        </svg>
      </div>
    </section>
  );
};

