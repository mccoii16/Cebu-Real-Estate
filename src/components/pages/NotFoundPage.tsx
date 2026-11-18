import React, { useEffect } from 'react';
import { ArrowLeft, Building2, Compass, Home } from 'lucide-react';
import { applySeoMetadata } from '../../utils/seo';

interface NotFoundPageProps {
  missingPath?: string;
  onNavigateHome: () => void;
  onBrowseProperties: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  missingPath = '/404',
  onNavigateHome,
  onBrowseProperties,
}) => {
  useEffect(() => {
    applySeoMetadata({
      title: 'Page Not Found | Cebu Prime Properties',
      description:
        'The requested property, building, or neighborhood page could not be found or is no longer publicly available.',
      canonicalPath: missingPath,
      noIndex: true,
    });
  }, [missingPath]);

  return (
    <main className="flex-1 w-full bg-[#F8F7F3] py-16 sm:py-24 px-4 sm:px-8 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-3xl border border-slate-200 shadow-[0_12px_40px_rgba(23,36,59,0.08)] p-6 sm:p-10 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#17243B] text-[#C6A878] flex items-center justify-center shadow-md">
          <Compass className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#C6A878]">
            Error 404 • Listing Unavailable
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#17243B] font-serif">
            We Couldn&apos;t Find That Page
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            The property, building, or neighborhood record you requested may have been moved, taken off-market, or is awaiting publication approval.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onNavigateHome}
            className="w-full sm:w-auto px-5 min-h-[44px] rounded-full bg-[#17243B] hover:bg-[#203150] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Home className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
            <span className="whitespace-nowrap">Return Home</span>
          </button>

          <button
            type="button"
            onClick={onBrowseProperties}
            className="w-full sm:w-auto px-5 min-h-[44px] rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-[#17243B] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Building2 className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
            <span className="whitespace-nowrap">Browse All Properties</span>
          </button>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#17243B] transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </main>
  );
};
