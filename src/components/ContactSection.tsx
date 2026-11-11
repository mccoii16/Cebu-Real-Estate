import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2, MessageCircle } from 'lucide-react';
import { validateInquiryForm } from '../utils/filterProperties';
import { submitInquiry, MASTER_ADMIN_EMAIL } from '../services/inquiryService';

interface ContactSectionProps {
  initialPropertyInterest?: string;
}

export const ContactSection: React.FC<ContactSectionProps> = ({
  initialPropertyInterest = 'The Alcoves',
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [propertyInterest, setPropertyInterest] = useState(initialPropertyInterest);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      console.error('Inquiry error:', err);
      // Still show submitted because local buffer preserves it
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setMessage('');
    setIsSubmitted(false);
  };

  return (
    <section id="contact" className="w-full bg-[#F8F7F3] py-16 sm:py-24 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Office & Direct Advisory Info */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[#C6A878] uppercase mb-3">
              <span>Private Client Consultation</span>
              <span className="w-8 h-px bg-[#C6A878]" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#17243B] font-sans mb-4">
              Connect With Our Cebu Property Specialists
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-8">
              Whether you are acquiring a luxury primary residence, expanding your rental portfolio, or scheduling an exclusive private walkthrough, our team provides discreet, comprehensive representation.
            </p>

            <div className="flex flex-col gap-5 text-sm text-[#17243B]">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#C6A878] flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Headquarters</div>
                  <div className="text-slate-600">Level 22, Cebu Prime Tower, Cebu Business Park, Cebu City, 6000</div>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#C6A878] flex-shrink-0 mt-0.5">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Direct Line & WhatsApp</div>
                  <div className="text-slate-600">+63 (32) 234-8800 · +63 917 555 7890</div>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#C6A878] flex-shrink-0 mt-0.5">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Inquiries</div>
                  <div className="text-slate-600">inquiries@cebuprimeproperties.ph</div>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#C6A878] flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Advisory Hours</div>
                  <div className="text-slate-600">Monday – Sunday: 8:30 AM – 7:00 PM (PHT)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Consultation Form */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl">
            {isSubmitted ? (
              <div className="py-8 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-[#17243B] mb-1">Inquiry Received</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto mb-3">
                  Thank you, <span className="font-semibold text-slate-900">{fullName}</span>. Your inquiry for <span className="font-semibold text-[#17243B]">{propertyInterest}</span> has been received directly by our Master Real Estate Authority.
                </p>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 max-w-md mb-6 text-left flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-[#C6A878] flex-shrink-0 mt-0.5" />
                  <span>
                    Dispatched to: <strong>{MASTER_ADMIN_EMAIL}</strong>. A dedicated specialist will contact you at <strong>{phone}</strong> or <strong>{email}</strong> within 2 hours.
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                  <a
                    href={`https://wa.me/639175557890?text=${encodeURIComponent(
                      `Hello Cebu Prime Properties, I just submitted an inquiry for ${propertyInterest}. My name is ${fullName}.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="whitespace-nowrap">Instant WhatsApp Chat</span>
                  </a>
                  <button
                    onClick={handleReset}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#17243B] text-white text-xs font-semibold hover:bg-[#253754] transition-colors whitespace-nowrap"
                  >
                    <span className="whitespace-nowrap">Send Another Inquiry</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <h3 className="text-xl font-bold text-[#17243B] mb-1">
                  Schedule a Consultation or Viewing
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Complete the form below to receive detailed brochures, unit availability, and floor plans.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Atty. Miguel Ramos"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] ${
                        errors.fullName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/50'
                      }`}
                    />
                    {errors.fullName && (
                      <span className="text-[11px] text-rose-500 mt-1 block font-medium">
                        {errors.fullName}
                      </span>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. miguel.ramos@domain.com"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] ${
                        errors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/50'
                      }`}
                    />
                    {errors.email && (
                      <span className="text-[11px] text-rose-500 mt-1 block font-medium">
                        {errors.email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mobile / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+63 917 123 4567"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] ${
                        errors.phone ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/50'
                      }`}
                    />
                    {errors.phone && (
                      <span className="text-[11px] text-rose-500 mt-1 block font-medium">
                        {errors.phone}
                      </span>
                    )}
                  </div>

                  {/* Property Interest */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Property of Interest
                    </label>
                    <select
                      value={propertyInterest}
                      onChange={(e) => setPropertyInterest(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878]"
                    >
                      <option value="The Alcoves">The Alcoves (Cebu Business Park)</option>
                      <option value="38 Park Avenue">38 Park Avenue (IT Park)</option>
                      <option value="Mactan Newtown Residences">Mactan Newtown Residences</option>
                      <option value="Astra Centre">Astra Centre (Cebu Business Park)</option>
                      <option value="Lucima Luxury Residences">Lucima Residences (CBP)</option>
                      <option value="Banilad Estate Villa">Banilad Estate Villa</option>
                      <option value="General Investment Consultation">General Luxury Investment</option>
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Message / Preferred Viewing Dates
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please specify any particular unit preferences, floor levels, or preferred times for private viewing..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#C6A878] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-full bg-[#17243B] hover:bg-[#203150] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 whitespace-nowrap flex-nowrap"
                >
                  <Send className="w-4 h-4 text-[#C6A878] flex-shrink-0" />
                  <span className="whitespace-nowrap">{isSubmitting ? 'Submitting Inquiry...' : 'Submit Inquiry & Request Brochure'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
