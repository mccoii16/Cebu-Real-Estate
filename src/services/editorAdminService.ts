import { sendPasswordResetEmail, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from '../types/property';
import { createAgentFirebaseAuthUser } from './agentAuthService';

export async function loadEditorsList(adminUser?: User | null): Promise<UserProfile[]> {
  const map = new Map<string, UserProfile>();

  try {
    const q = query(collection(db, 'users'), where('role', '==', 'editor'));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const data = d.data() as UserProfile;
      if (data.status !== 'deleted') {
        map.set(data.uid, data);
      }
    });
  } catch (fsErr) {
    console.warn('[EditorAdmin] Firestore editors read notice:', fsErr);
  }

  try {
    const token = await adminUser?.getIdToken();
    if (token) {
      const res = await fetch('/api/admin/editors', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.editors)) {
          data.editors.forEach((ed: UserProfile) => {
            if (ed.status !== 'deleted' && !map.has(ed.uid)) {
              map.set(ed.uid, ed);
            }
          });
        }
      }
    }
  } catch {
    // Ignore API fallback error
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function createEditorAccount(
  adminUser: User | null,
  params: { displayName: string; email: string; password?: string }
): Promise<{ profile: UserProfile; warning?: string }> {
  const cleanName = params.displayName.trim();
  const normalizedEmail = params.email.trim().toLowerCase();
  const defaultPass = `CebuEditor@${Math.floor(100000 + Math.random() * 900000)}`;
  const temporaryPassword = params.password?.trim() || defaultPass;
  const now = new Date().toISOString();

  let editorUid = `editor-${Date.now()}`;
  let warning: string | undefined;

  // 1. Provision real Firebase Auth credentials without signing out the Super Admin
  const authResult = await createAgentFirebaseAuthUser(
    normalizedEmail,
    temporaryPassword,
    cleanName
  );
  if (authResult.success && authResult.uid) {
    editorUid = authResult.uid;
  } else if (!authResult.success) {
    if (authResult.error === 'auth/operation-not-allowed') {
      warning =
        'Email/Password sign-in provider is disabled in Firebase project cebu-real-estate-84294. Enable Email/Password in Firebase Console (Authentication > Sign-in method), or use Sign in with Google.';
    } else {
      warning = `Firebase Auth notice: ${authResult.error}.`;
    }
  }

  // 2. Call Super Admin backend route to assign custom claim { role: 'editor' } and persist
  try {
    const token = await adminUser?.getIdToken();
    if (token) {
      const res = await fetch('/api/admin/editors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: editorUid,
          displayName: cleanName,
          email: normalizedEmail,
          password: temporaryPassword,
        }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data?.editor?.uid) {
          editorUid = data.editor.uid;
        }
      }
    }
  } catch {
    // Non-fatal in pure SPA mode
  }

  const profile: UserProfile = {
    uid: editorUid,
    email: normalizedEmail,
    displayName: cleanName,
    role: 'editor',
    status: 'active',
    temporaryPassword,
    createdAt: now,
    updatedAt: now,
    createdBy: adminUser?.uid,
    createdByEmail: adminUser?.email || undefined,
  };

  // 3. Persist Firestore authorization record directly (Super Admin permitted via firestore.rules)
  await setDoc(doc(db, 'users', editorUid), profile, { merge: true });

  return { profile, warning };
}

export async function assignStaffRole(
  adminUser: User | null,
  targetUser: UserProfile,
  newRole: 'editor' | 'agent'
): Promise<UserProfile> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'users', targetUser.uid), {
    role: newRole,
    updatedAt: now,
  });

  try {
    const token = await adminUser?.getIdToken();
    if (token) {
      await fetch(`/api/admin/editors/${targetUser.uid}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
    }
  } catch {}

  return {
    ...targetUser,
    role: newRole,
    updatedAt: now,
  };
}

export async function toggleEditorAccountStatus(
  adminUser: User | null,
  editor: UserProfile
): Promise<UserProfile> {
  const newStatus = editor.status === 'active' ? 'disabled' : 'active';
  const now = new Date().toISOString();

  await updateDoc(doc(db, 'users', editor.uid), {
    status: newStatus,
    updatedAt: now,
    ...(newStatus === 'disabled'
      ? { disabledAt: now, disabledBy: adminUser?.email || '' }
      : {}),
  });

  try {
    const token = await adminUser?.getIdToken();
    if (token) {
      await fetch(`/api/admin/editors/${editor.uid}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
    }
  } catch {}

  return {
    ...editor,
    status: newStatus,
    updatedAt: now,
  };
}

export async function resetEditorPassword(
  adminUser: User | null,
  editor: UserProfile
): Promise<{ resetEmailSent: boolean; resetLink?: string | null; note?: string }> {
  let resetEmailSent = false;
  let resetLink: string | null = null;
  let note: string | undefined;

  try {
    await sendPasswordResetEmail(auth, editor.email);
    resetEmailSent = true;
  } catch (authErr: any) {
    note = authErr?.message || 'Password reset email could not be sent via client SDK.';
  }

  try {
    const token = await adminUser?.getIdToken();
    if (token) {
      const res = await fetch(`/api/admin/editors/${editor.uid}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: editor.email }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        resetLink = data?.resetLink || null;
      }
    }
  } catch {}

  const now = new Date().toISOString();
  await updateDoc(doc(db, 'users', editor.uid), {
    passwordResetRequestedAt: now,
    passwordResetRequestedBy: adminUser?.email || 'superadmin',
    updatedAt: now,
  }).catch(() => {});

  return { resetEmailSent, resetLink, note };
}

export async function removeEditorAccountAccess(
  adminUser: User | null,
  editor: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  await updateDoc(doc(db, 'users', editor.uid), {
    role: 'user',
    status: 'deleted',
    deletedAt: now,
    deletedBy: adminUser?.email || 'superadmin',
    updatedAt: now,
  });

  try {
    const token = await adminUser?.getIdToken();
    if (token) {
      await fetch(`/api/admin/editors/${editor.uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {}
}
