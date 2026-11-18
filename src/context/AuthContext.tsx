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
  isEditor: boolean;
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
    let tokenClaimRole: string | undefined;
    try {
      const idTokenResult = await currentUser.getIdTokenResult(true);
      if (typeof idTokenResult?.claims?.role === 'string') {
        tokenClaimRole = idTokenResult.claims.role;
      }
    } catch {
      // Ignore token claim lookup errors
    }

    // 1. Direct Firestore lookup by UID & Email (authoritative status/role)
    try {
      const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../services/firebase');

      const userDocRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const uData = userSnap.data() as UserProfile;
        if (uData.status === 'disabled' || uData.status === 'deleted') {
          await firebaseSignOut(auth);
          setUser(null);
          setProfile(null);
          setAuthError('Your account access has been deactivated or removed by the Super Administrator.');
          return;
        }
        setProfile(uData);
        return;
      }

      if (currentUser.email) {
        const q = query(collection(db, 'users'), where('email', '==', currentUser.email.toLowerCase()));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const uData = qSnap.docs[0].data() as UserProfile;
          if (uData.status === 'disabled' || uData.status === 'deleted') {
            await firebaseSignOut(auth);
            setUser(null);
            setProfile(null);
            setAuthError('Your account access has been deactivated or removed by the Super Administrator.');
            return;
          }
          setProfile({ ...uData, uid: currentUser.uid });
          return;
        }
      }
    } catch (fsErr) {
      console.warn('[AuthContext] Firestore direct profile read notice:', fsErr);
    }

    // 2. Backend /api/auth/me check
    try {
      let data: any = null;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 403) {
          await firebaseSignOut(auth);
          setUser(null);
          setProfile(null);
          setAuthError('Your account access has been deactivated or removed by the Super Administrator.');
          return;
        }

        if (res.ok) {
          data = await res.json();
        }
      } catch (fetchErr: any) {
        console.warn('[AuthContext] Local or static deployment - bypassing backend API:', fetchErr.message);
      }

      if (data && (data.status === 'disabled' || data.status === 'deleted')) {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        setAuthError('Your account access has been deactivated or removed by the Super Administrator.');
        return;
      }

      if (data && data.role) {
        setProfile(data);
        return;
      }
    } catch (err: any) {
      console.warn('[AuthContext] Profile fetch warning:', err.message);
    }

    // 3. Verified claim / Master Owner fallback (never self-promotes to editor or superadmin)
    const isOwner = currentUser.email?.toLowerCase() === 'martiligando@gmail.com';
    const resolvedRole = isOwner
      ? 'superadmin'
      : tokenClaimRole === 'editor'
      ? 'editor'
      : tokenClaimRole === 'agent'
      ? 'agent'
      : 'agent';

    setProfile({
      uid: currentUser.uid,
      email: currentUser.email || '',
      displayName:
        currentUser.displayName ||
        (resolvedRole === 'superadmin'
          ? 'Super Admin'
          : resolvedRole === 'editor'
          ? 'Editorial Staff'
          : 'Agent'),
      role: resolvedRole,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
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
      console.warn('Google Sign-In notice:', err);
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('auth/unauthorized-domain')) {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
        setAuthError(
          `Firebase: Error (auth/unauthorized-domain). The domain "${currentDomain}" needs to be added in Firebase Console > Authentication > Settings > Authorized domains.`
        );
      } else if (err.code === 'auth/popup-closed-by-user') {
        setAuthError(null);
      } else {
        setAuthError(err.message || 'Failed to authenticate with Google');
      }
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
      console.warn('Email sign in notice:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setAuthError('Invalid email or password. Please verify your credentials.');
      } else if (err.code === 'auth/user-disabled') {
        setAuthError('Your account has been disabled by the Super Administrator.');
      } else if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
        setAuthError(`Firebase: Error (auth/unauthorized-domain). The domain "${currentDomain}" needs to be authorized in Firebase Console.`);
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

  const isEditor =
    !isSuperAdmin &&
    profile?.role === 'editor' &&
    profile?.status !== 'disabled' &&
    profile?.status !== 'deleted';

  const isAgent =
    !isSuperAdmin &&
    !isEditor &&
    profile?.role === 'agent' &&
    profile?.status !== 'disabled' &&
    profile?.status !== 'deleted';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isSuperAdmin,
        isEditor,
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
