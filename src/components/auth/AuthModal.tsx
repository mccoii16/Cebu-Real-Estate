import React, { useState } from 'react';
import { X, Mail, Lock, Shield, ArrowRight, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { signInWithGoogle, signInWithEmail, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!email.trim() || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setLocalError(err.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setLocalError(null);
    clearAuthError();
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setLocalError(err.message || 'Google sign in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Staff and Agent Portal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#17243B]/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-[#17243B] text-white rounded-2xl sm:rounded-3xl shadow-2xl border border-white/15 overflow-hidden my-auto">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#C6A878]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="px-5 sm:px-8 pt-6 sm:pt-7 pb-4 flex items-start justify-between border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#C6A878]/20 border border-[#C6A878]/30 flex items-center justify-center text-[#C6A878] flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-serif font-bold text-white tracking-wide truncate">
                Staff &amp; Agent Portal
              </h2>
              <p className="text-xs text-white/60 truncate">Cebu Prime Properties Secure Gateway</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close portal modal"
            className="w-9 h-9 rounded-full border border-white/15 text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 sm:px-8 py-6 relative z-10">
          {(localError || authError) && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                <span className="font-semibold">{localError || authError}</span>
              </div>
              {(localError?.includes('unauthorized-domain') || authError?.includes('unauthorized-domain')) && (
                <div className="mt-1 p-2.5 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white/90 space-y-1.5">
                  <p className="font-bold text-[#C6A878]">Action Required in Firebase Console for Vercel/Custom Domain:</p>
                  <p>
                    Your current deployment domain (<strong>{typeof window !== 'undefined' ? window.location.hostname : 'your-app.vercel.app'}</strong>) needs to be added to Firebase Authorized Domains in project <strong>cebu-real-estate-84294</strong>:
                  </p>
                  <ol className="list-decimal pl-4 space-y-0.5 text-white/80">
                    <li>Open <a href="https://console.firebase.google.com/project/cebu-real-estate-84294/authentication/settings" target="_blank" rel="noreferrer" className="underline text-[#DFCDAA]">Firebase Authentication &gt; Settings &gt; Authorized domains</a>.</li>
                    <li>Click <strong>Add domain</strong> and enter: <code className="bg-white/20 px-1 rounded">{typeof window !== 'undefined' ? window.location.hostname : 'your-domain'}</code></li>
                    <li>Save, wait 10 seconds, and retry logging in.</li>
                  </ol>
                </div>
              )}

              {(localError?.includes('invalid-credential') || authError?.includes('invalid-credential') || localError?.includes('user-not-found') || authError?.includes('user-not-found')) && (
                <div className="mt-1 p-2.5 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white/90 space-y-1.5">
                  <p className="font-bold text-[#C6A878]">Troubleshooting (auth/invalid-credential) in project cebu-real-estate-84294:</p>
                  <ul className="list-disc pl-4 space-y-1 text-white/80">
                    <li>
                      <strong>Check Email/Password Provider:</strong> In Firebase Console, ensure <em>Email/Password</em> provider is enabled under <a href="https://console.firebase.google.com/project/cebu-real-estate-84294/authentication/providers" target="_blank" rel="noreferrer" className="underline text-[#DFCDAA]">Authentication &gt; Sign-in method</a>.
                    </li>
                    <li>
                      <strong>Agent Account Registration:</strong> Ensure the Super Admin has registered this agent in the Admin Dashboard.
                    </li>
                    <li>
                      <strong>Alternative:</strong> If you have a Google account associated with this email, you can sign in directly using <strong>Sign in with Google</strong> above.
                    </li>
                  </ul>
                </div>
              )}

              {(localError?.includes('operation-not-allowed') || authError?.includes('operation-not-allowed')) && (
                <div className="mt-1 p-2.5 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white/90 space-y-1.5">
                  <p className="font-bold text-[#C6A878]">Email/Password Provider Disabled in Firebase:</p>
                  <p>
                    Project <strong>cebu-real-estate-84294</strong> currently has Email/Password authentication turned off.
                  </p>
                  <p>
                    👉 <a href="https://console.firebase.google.com/project/cebu-real-estate-84294/authentication/providers" target="_blank" rel="noreferrer" className="underline text-[#DFCDAA] font-bold">Open Firebase Console &gt; Sign-in method &gt; Enable Email/Password</a>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Quick Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSubmit}
            disabled={isSubmitting}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-[#17243B] font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 mb-5 whitespace-nowrap"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          <div className="relative flex items-center justify-center mb-5">
            <div className="border-t border-white/15 w-full" />
            <span className="bg-[#17243B] px-3 text-[11px] uppercase tracking-wider text-white/50">
              Or Agent Email Login
            </span>
          </div>

          {/* Email / Password Form (for Super Admin & Agent Login) */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@cebuprimeproperties.ph"
                  required
                  className="w-full px-4 py-2.5 pl-10 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#C6A878] focus:ring-1 focus:ring-[#C6A878] transition-colors"
                />
                <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/80 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-4 py-2.5 pl-10 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#C6A878] focus:ring-1 focus:ring-[#C6A878] transition-colors"
                />
                <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 min-h-[44px] py-2.5 px-4 rounded-xl bg-[#C6A878] hover:bg-[#b89764] text-[#17243B] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 shadow-lg whitespace-nowrap"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
            </button>
          </form>

          {/* Discreet Super Admin notice */}
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/50">
              <Building2 className="w-3.5 h-3.5 text-[#C6A878]" />
              <span>Super Admin owner: Martiligando@gmail.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
