import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

const DATABASE_ID = 'ai-studio-cebuprimepropert-cc92c71f-1cf1-4346-af2d-433e14c61d77';
const SUPER_ADMIN_EMAIL = 'martiligando@gmail.com';
const db = getFirestore(DATABASE_ID);
const auth = getAuth();

async function assertSuperAdmin(uid?: string, email?: string, claimRole?: unknown): Promise<void> {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (email && email.toLowerCase() === SUPER_ADMIN_EMAIL) {
    return;
  }
  if (claimRole === 'superadmin') {
    return;
  }
  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists && userSnap.data()?.role === 'superadmin' && userSnap.data()?.status === 'active') {
    return;
  }
  throw new HttpsError('permission-denied', 'Super Admin authorization required.');
}

export const createEditorAccount = onCall(async (request) => {
  await assertSuperAdmin(request.auth?.uid, request.auth?.token?.email, request.auth?.token?.role);

  const { email, displayName, password } = (request.data || {}) as {
    email?: string;
    displayName?: string;
    password?: string;
  };
  if (!email || !displayName) {
    throw new HttpsError('invalid-argument', 'Email and displayName are required.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim();
  const initialPassword =
    password && password.length >= 6
      ? password
      : `CebuEditor@${Math.floor(100000 + Math.random() * 900000)}`;

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(normalizedEmail);
  } catch {
    userRecord = await auth.createUser({
      email: normalizedEmail,
      password: initialPassword,
      displayName: cleanName,
      emailVerified: true,
    });
  }

  await auth.setCustomUserClaims(userRecord.uid, { role: 'editor' });

  const now = new Date().toISOString();
  const profile = {
    uid: userRecord.uid,
    email: normalizedEmail,
    displayName: cleanName,
    role: 'editor',
    status: 'active',
    createdBy: request.auth!.uid,
    createdByEmail: request.auth!.token?.email || '',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('users').doc(userRecord.uid).set(profile, { merge: true });
  return { success: true, editor: profile };
});

export const assignUserRole = onCall(async (request) => {
  await assertSuperAdmin(request.auth?.uid, request.auth?.token?.email, request.auth?.token?.role);

  const { targetUid, role } = (request.data || {}) as { targetUid?: string; role?: string };
  if (!targetUid || !role || !['editor', 'agent', 'user'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Valid targetUid and role (editor, agent, user) required.');
  }

  await auth.setCustomUserClaims(targetUid, { role });
  await db.collection('users').doc(targetUid).set(
    {
      role,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return { success: true, uid: targetUid, role };
});

export const setEditorAccountStatus = onCall(async (request) => {
  await assertSuperAdmin(request.auth?.uid, request.auth?.token?.email, request.auth?.token?.role);

  const { targetUid, status } = (request.data || {}) as { targetUid?: string; status?: string };
  if (!targetUid || !status || !['active', 'disabled'].includes(status)) {
    throw new HttpsError('invalid-argument', 'Valid targetUid and status (active|disabled) required.');
  }

  const now = new Date().toISOString();
  await auth.updateUser(targetUid, { disabled: status === 'disabled' });
  await db.collection('users').doc(targetUid).set(
    {
      status,
      updatedAt: now,
      ...(status === 'disabled'
        ? { disabledAt: now, disabledBy: request.auth!.token?.email || '' }
        : { enabledAt: now, enabledBy: request.auth!.token?.email || '' }),
    },
    { merge: true }
  );

  return { success: true, uid: targetUid, status };
});

export const initiateEditorPasswordReset = onCall(async (request) => {
  await assertSuperAdmin(request.auth?.uid, request.auth?.token?.email, request.auth?.token?.role);

  const { targetUid, email } = (request.data || {}) as { targetUid?: string; email?: string };
  if (!targetUid || !email) {
    throw new HttpsError('invalid-argument', 'targetUid and email are required.');
  }

  const resetLink = await auth.generatePasswordResetLink(email.trim());
  const now = new Date().toISOString();
  await db.collection('users').doc(targetUid).set(
    {
      passwordResetRequestedAt: now,
      passwordResetRequestedBy: request.auth!.token?.email || '',
      updatedAt: now,
    },
    { merge: true }
  );

  return { success: true, resetLink };
});

export const removeEditorAccess = onCall(async (request) => {
  await assertSuperAdmin(request.auth?.uid, request.auth?.token?.email, request.auth?.token?.role);

  const { targetUid } = (request.data || {}) as { targetUid?: string };
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'targetUid is required.');
  }

  const now = new Date().toISOString();
  await auth.setCustomUserClaims(targetUid, { role: 'user' });
  await auth.updateUser(targetUid, { disabled: true });
  await db.collection('users').doc(targetUid).set(
    {
      role: 'user',
      status: 'deleted',
      deletedAt: now,
      deletedBy: request.auth!.token?.email || '',
      updatedAt: now,
    },
    { merge: true }
  );

  return { success: true, uid: targetUid };
});

// Server-side trigger: sync Firebase Auth custom claim whenever /users/{uid} role changes
export const syncRoleClaimOnUserWrite = onDocumentWritten(
  { document: 'users/{userId}', database: DATABASE_ID },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after || !after.role) return;
    const role = String(after.role);
    if (!['superadmin', 'editor', 'agent', 'user'].includes(role)) return;

    try {
      await auth.setCustomUserClaims(event.params.userId, { role });
    } catch {
      // Ignore synthetic/non-Auth UIDs
    }
  }
);
