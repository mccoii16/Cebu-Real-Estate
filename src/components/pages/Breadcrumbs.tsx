import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
  lightText?: boolean;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  onNavigate,
  lightText = false,
}) => {
  return (
    <nav aria-label="Breadcrumb" className="w-full py-1">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 sm:gap-2 text-xs font-medium">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              {idx > 0 && (
                <ChevronRight
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    lightText ? 'text-white/40' : 'text-slate-400'
                  }`}
                />
              )}

              {isLast || (!item.href && !item.onClick) ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={`break-words sm:truncate sm:max-w-[320px] ${
                    isLast
                      ? lightText
                        ? 'text-[#C6A878] font-semibold'
                        : 'text-[#17243B] font-semibold'
                      : lightText
                      ? 'text-white/75'
                      : 'text-slate-500'
                  }`}
                >
                  {idx === 0 && !isLast ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Home className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </span>
                  ) : (
                    item.label
                  )}
                </span>
              ) : (
                <a
                  href={item.href || '/'}
                  onClick={(e) => {
                    e.preventDefault();
                    if (item.onClick) {
                      item.onClick();
                    } else if (item.href) {
                      onNavigate(item.href);
                    }
                  }}
                  className={`inline-flex items-center gap-1 transition-colors hover:underline ${
                    lightText
                      ? 'text-white/80 hover:text-[#C6A878]'
                      : 'text-slate-500 hover:text-[#17243B]'
                  }`}
                >
                  {idx === 0 && <Home className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span>{item.label}</span>
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
