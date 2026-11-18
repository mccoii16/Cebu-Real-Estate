import React, { useEffect } from 'react';
import { X, Minimize, ChevronLeft, ChevronRight } from 'lucide-react';

interface FullscreenLightboxProps {
  isOpen: boolean;
  images: string[];
  activeIndex: number;
  title: string;
  fallbackImage?: string;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
}

export const FullscreenLightbox: React.FC<FullscreenLightboxProps> = ({
  isOpen,
  images,
  activeIndex,
  title,
  fallbackImage = '/assets/extracted/the_alcoves.png',
  onClose,
  onSelectIndex,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        onSelectIndex(activeIndex === images.length - 1 ? 0 : activeIndex + 1);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        onSelectIndex(activeIndex === 0 ? images.length - 1 : activeIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, images.length, onClose, onSelectIndex]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[activeIndex] || images[0] || fallbackImage;

  const prevImage = () => {
    onSelectIndex(activeIndex === 0 ? images.length - 1 : activeIndex - 1);
  };

  const nextImage = () => {
    onSelectIndex(activeIndex === images.length - 1 ? 0 : activeIndex + 1);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} fullscreen gallery`}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Controls */}
      <div className="w-full max-w-6xl flex items-center justify-between text-white z-20 px-1 sm:px-4 py-2 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-bold text-sm sm:text-base text-white font-serif truncate">
            {title}
          </span>
          <span className="text-xs text-white/70 font-mono whitespace-nowrap flex-shrink-0">
            ({activeIndex + 1} of {images.length})
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Exit fullscreen"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <Minimize className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close fullscreen gallery"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center High-Res Image Display */}
      <div
        className="relative flex-1 w-full max-w-6xl flex items-center justify-center overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={currentImage}
          alt={`${title} - photo ${activeIndex + 1}`}
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.dataset.fallback) {
              target.dataset.fallback = 'true';
              target.src = fallbackImage;
            }
          }}
          className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
          referrerPolicy="no-referrer"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              aria-label="Previous photo"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all z-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878]"
            >
              <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              aria-label="Next photo"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all z-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A878]"
            >
              <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          </>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {images.length > 1 && (
        <div
          className="flex items-center gap-3 overflow-x-auto max-w-4xl py-3 px-4 sm:px-5 mt-3 bg-black/55 rounded-2xl backdrop-blur-sm z-20 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelectIndex(i)}
              aria-label={`View photo ${i + 1}`}
              className={`relative w-16 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                activeIndex === i
                  ? 'border-[#C6A878] ring-2 ring-[#C6A878]/30 opacity-100'
                  : 'border-transparent opacity-55 hover:opacity-100'
              }`}
            >
              <img
                src={img}
                alt=""
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.fallback) {
                    target.dataset.fallback = 'true';
                    target.src = fallbackImage;
                  }
                }}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
