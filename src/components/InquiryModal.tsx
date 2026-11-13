import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, CheckCircle2 } from 'lucide-react';
import { validateInquiryForm } from '../utils/filterProperties';
import { submitInquiry } from '../services/inquiryService';
import { PropertyDoc, WebsiteSettings } from '../types/property';

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProperty?: string;
  properties?: PropertyDoc[];
  siteSettings?: WebsiteSettings;
}

const FALLBACK_PROPERTY_OPTIONS = [
  'The Alcoves',
  '38 Park Avenue',
  'Mactan Newtown Residences',
  'Astra Centre',
  'Lucima Luxury Residences',
];

export const InquiryModal: React.FC<InquiryModalProps> = ({
  isOpen,
  onClose,
  defaultProperty = 'The Alcoves',
  properties = [],
  siteSettings,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [propertyInterest, setPropertyInterest] = useState(defaultProperty);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPropertyInterest(defaultProperty || 'General Luxury Advisory');
      setErrors({});
    }
  }, [defaultProperty, isOpen]);

  const propertyOptions = useMemo(() => {
    const titles = new Set<string>();
    properties
      .filter((p) => p.status === 'approved')
      .forEach((p) => {
        if (p.propertyTitle) titles.add(p.propertyTitle);
      });
    if (titles.size === 0) {
      FALLBACK_PROPERTY_OPTIONS.forEach((t) => titles.add(t));
    }
    if (defaultProperty && !titles.has(defaultProperty)) {
      titles.add(defaultProperty);
    }
    return Array.from(titles);
  }, [properties, defaultProperty]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateInquiryForm({ fullName, email, phone, message });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await submitInquiry({
        fullName,
        email,
        phone,
        propertyInterest,
        preferredContact: 'email',
        message,
      });
      setIsSubmitted(true);
    } catch (err) {
      console.error('Inquiry submission error:', err);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSubmitted(false);
    setFullName('');
    setEmail('');
    setPhone('');
    setMessage('');
    setErrors({});
    onClose();
  };

  const autoReplyNote =
    siteSettings?.inquiryAutoReplyMessage?.trim() ||
    'A dedicated Cebu Prime Properties specialist will review your request and follow up with you shortly.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inquiry-dialog-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-100 my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {isSubmitted ? (
          <div className="py-6 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#17243B] mb-2">Inquiry Received</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-sm mb-3 leading-relaxed">
              Thank you, <span className="font-semibold text-slate-900">{fullName}</span>. Your inquiry regarding{' '}
              <span className="font-semibold text-[#17243B]">{propertyInterest}</span> has been recorded.
            </p>
            <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3">
              {autoReplyNote}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto min-h-[44px] px-7 py-2.5 rounded-full bg-[#17243B] text-white text-xs sm:text-sm font-semibold hover:bg-[#253754] transition-colors whitespace-nowrap inline-flex items-center justify-center"
            >
              <span className="whitespace-nowrap">Close Window</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="pr-8">
              <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#C6A878] mb-1">
                Priority Client Concierge
              </div>
              <h2 id="inquiry-dialog-title" className="text-xl sm:text-2xl font-bold text-[#17243B]">
                Inquire About Cebu Properties
              </h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan dela Cruz"
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] ${
                  errors.fullName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                }`}
              />
              {errors.fullName && (
                <span className="text-[11px] text-rose-500 mt-1 block font-medium">
                  {errors.fullName}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@domain.com"
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] ${
                  errors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                }`}
              />
              {errors.email && (
                <span className="text-[11px] text-rose-500 mt-1 block font-medium">
                  {errors.email}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 917 123 4567"
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] ${
                  errors.phone ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                }`}
              />
              {errors.phone && (
                <span className="text-[11px] text-rose-500 mt-1 block font-medium">
                  {errors.phone}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Preferred Listing
              </label>
              <select
                value={propertyInterest}
                onChange={(e) => setPropertyInterest(e.target.value)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
              >
                {propertyOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                <option value="General Luxury Advisory">General Property Portfolio</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Notes / Special Requests
              </label>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Schedule a private weekend walkthrough..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] py-3 px-4 rounded-full bg-[#17243B] hover:bg-[#203150] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap flex-nowrap"
            >
              <Send className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
              <span className="whitespace-nowrap">
                {isSubmitting ? 'Sending Request...' : 'Send Inquiry'}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

