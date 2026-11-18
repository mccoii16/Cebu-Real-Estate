import React from 'react';
import { AlertTriangle, ShieldAlert, X, Archive } from 'lucide-react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  blockedReason?: string | null;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
  blockedReason = null,
  secondaryLabel,
  onSecondaryAction,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#17243B]/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                blockedReason
                  ? 'bg-amber-100 text-amber-700'
                  : isDestructive
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-[#17243B]/10 text-[#17243B]'
              }`}
            >
              {blockedReason ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <h3 id="confirm-modal-title" className="text-base font-bold font-serif text-[#17243B]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {blockedReason ? (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed">
            {blockedReason}
          </div>
        ) : (
          <p className="text-slate-600 leading-relaxed">{message}</p>
        )}

        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 min-h-[40px] rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 font-semibold whitespace-nowrap"
          >
            {blockedReason ? 'Close' : cancelLabel}
          </button>

          {blockedReason && secondaryLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl bg-[#17243B] hover:bg-[#253754] text-[#C6A878] font-bold whitespace-nowrap"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{secondaryLabel}</span>
            </button>
          )}

          {!blockedReason && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 min-h-[40px] rounded-xl font-bold whitespace-nowrap disabled:opacity-50 ${
                isDestructive
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-[#17243B] hover:bg-[#253754] text-[#C6A878]'
              }`}
            >
              {isLoading ? 'Processing...' : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
