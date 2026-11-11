import React, { useState } from 'react';
import { X, Send, CheckCircle2, MessageCircle, Mail } from 'lucide-react';
import { validateInquiryForm } from '../utils/filterProperties';
import { submitInquiry, MASTER_ADMIN_EMAIL } from '../services/inquiryService';

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProperty?: string;
}

export const InquiryModal: React.FC<InquiryModalProps> = ({
  isOpen,
  onClose,
  defaultProperty = 'The Alcoves',
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [propertyInterest, setPropertyInterest] = useState(defaultProperty);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        preferredContact: 'phone',
        message,
      });
      setIsSubmitted(true);
    } catch (err) {
      console.error('Inquiry submission error:', err);
      // Still show confirmed because local buffer preserves it
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSubmitted(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inquiry-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {isSubmitted ? (
          <div className="py-6 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#17243B] mb-1">Inquiry Received</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-sm mb-3">
              Thank you, <span className="font-semibold text-slate-900">{fullName}</span>. Your inquiry for <span className="font-semibold text-[#17243B]">{propertyInterest}</span> has been dispatched directly to our Master Real Estate Authority.
            </p>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 max-w-sm mb-5 text-left flex items-start gap-2">
              <Mail className="w-3.5 h-3.5 text-[#C6A878] flex-shrink-0 mt-0.5" />
              <span>
                Dispatched to: <strong>{MASTER_ADMIN_EMAIL}</strong>. A dedicated specialist will contact you at <strong>{phone}</strong> or <strong>{email}</strong> within 2 hours.
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full justify-center">
              <a
                href={`https://wa.me/639175557890?text=${encodeURIComponent(
                  `Hello Cebu Prime Properties, I just submitted an inquiry for ${propertyInterest}. My name is ${fullName}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shadow-sm"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">Instant WhatsApp Chat</span>
              </a>
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#17243B] text-white text-xs font-semibold hover:bg-[#253754] transition-colors whitespace-nowrap"
              >
                <span className="whitespace-nowrap">Close Window</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
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
                className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] ${
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
                className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] ${
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
                Phone / WhatsApp *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 917 123 4567"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] ${
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
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
              >
                <option value="The Alcoves">The Alcoves (Cebu Business Park)</option>
                <option value="38 Park Avenue">38 Park Avenue (IT Park)</option>
                <option value="Mactan Newtown Residences">Mactan Newtown Residences</option>
                <option value="Astra Centre">Astra Centre (Cebu Business Park)</option>
                <option value="Lucima Luxury Residences">Lucima Residences</option>
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
                className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-full bg-[#17243B] hover:bg-[#203150] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap flex-nowrap"
            >
              <Send className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
              <span className="whitespace-nowrap">{isSubmitting ? 'Sending Request...' : 'Send Inquiry'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
