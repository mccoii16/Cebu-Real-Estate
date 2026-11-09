import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { UserProfile } from '../types/property';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isAgent: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const googleProvider = new GoogleAuthProvider();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchProfile = async (currentUser: User) => {
    try {
      const token = await currentUser.getIdToken(true);
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch user permissions profile');
      }

      const data = await res.json();

      if (data.status === 'disabled') {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        setAuthError('Your Agent account has been deactivated by the Super Administrator.');
        return;
      }

      setProfile(data);
    } catch (err: any) {
      console.error('[AuthContext] Error fetching profile:', err);
      // Fallback check if owner email
      const isOwner = currentUser.email?.toLowerCase() === 'martiligando@gmail.com';
      setProfile({
        uid: currentUser.uid,
        email: currentUser.email || '',
        displayName: currentUser.displayName || 'Super Admin',
        role: isOwner ? 'superadmin' : 'agent',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await fetchProfile(result.user);
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setAuthError(err.message || 'Failed to authenticate with Google');
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      if (result.user) {
        await fetchProfile(result.user);
      }
    } catch (err: any) {
      console.error('Email sign in error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setAuthError('Invalid email or password. Please verify your credentials.');
      } else {
        setAuthError(err.message || 'Authentication failed');
      }
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  const isSuperAdmin =
    profile?.role === 'superadmin' ||
    user?.email?.toLowerCase() === 'martiligando@gmail.com';

  const isAgent = profile?.role === 'agent';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isSuperAdmin,
        isAgent,
        signInWithGoogle,
        signInWithEmail,
        signOut,
        refreshProfile,
        authError,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
