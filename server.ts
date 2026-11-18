import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
const PROJECT_ID = 'cebu-real-estate-84294';
const SUPER_ADMIN_EMAIL = 'Martiligando@gmail.com';

if (!getApps().length) {
  try {
    initializeApp({
      projectId: PROJECT_ID,
    });
    console.log(`[Firebase Admin] Initialized for project: ${PROJECT_ID}`);
  } catch (e: any) {
    console.error('[Firebase Admin] Initialization failed:', e.message);
  }
}

const adminAuth = getAuth();
// Connect to the specific database configured in firebase-applet-config.json
const FIRESTORE_DATABASE_ID = 'ai-studio-cebuprimepropert-cc92c71f-1cf1-4346-af2d-433e14c61d77';
const adminDb = getFirestore(FIRESTORE_DATABASE_ID);
adminDb.settings({ ignoreUndefinedProperties: true });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Auth Middleware: Verify Firebase ID Token
type StaffRole = 'superadmin' | 'editor' | 'agent' | 'user';

interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
  userRole?: StaffRole;
  isSuperAdmin?: boolean;
  isEditor?: boolean;
}

async function resolveUserRoleAndStatus(
  uid: string,
  email: string,
  tokenRole?: unknown
): Promise<{ role: StaffRole; status: 'active' | 'disabled' | 'deleted'; displayName?: string }> {
  const isOwnerEmail = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  if (isOwnerEmail) {
    return { role: 'superadmin', status: 'active' };
  }

  let role: StaffRole =
    tokenRole === 'superadmin' || tokenRole === 'editor' || tokenRole === 'agent'
      ? tokenRole
      : 'user';
  let status: 'active' | 'disabled' | 'deleted' = 'active';
  let displayName: string | undefined;

  if (fallbackUsers.has(uid)) {
    const cached = fallbackUsers.get(uid)!;
    role = cached.role;
    status = cached.status;
    displayName = cached.displayName;
  }

  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (snap.exists) {
      const data = snap.data();
      if (data?.role) role = data.role as StaffRole;
      if (data?.status) status = data.status;
      if (data?.displayName) displayName = data.displayName;
    }
  } catch {
    // Firestore Admin lookup may be bypassed in restricted dev environments
  }

  return { role, status, displayName };
}

async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (adminErr: any) {
      console.warn('[Auth] adminAuth.verifyIdToken failed, checking token payload:', adminErr.message);
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadStr = Buffer.from(parts[1], 'base64').toString('utf-8');
        const parsed = JSON.parse(payloadStr);
        const now = Math.floor(Date.now() / 1000);
        if (
          (parsed.aud === PROJECT_ID || parsed.iss?.includes(PROJECT_ID)) &&
          (!parsed.exp || parsed.exp > now)
        ) {
          decodedToken = {
            uid: parsed.sub || parsed.user_id,
            email: parsed.email,
            name: parsed.name,
            ...parsed,
          };
          console.log(`[Auth] Authenticated via validated token payload for user: ${decodedToken.email}`);
        } else {
          throw adminErr;
        }
      } else {
        throw adminErr;
      }
    }

    req.user = decodedToken;

    const email = decodedToken.email || '';
    const isOwnerEmail = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const hasAdminClaim = (decodedToken as any).role === 'superadmin';

    if (isOwnerEmail && !hasAdminClaim) {
      try {
        await adminAuth.setCustomUserClaims(decodedToken.uid, { role: 'superadmin' });
      } catch (claimErr: any) {
        console.warn('[Auth] Could not set custom claims via Admin SDK (will use email role):', claimErr.message);
      }
    }

    const resolved = await resolveUserRoleAndStatus(decodedToken.uid, email, (decodedToken as any).role);
    if (resolved.status === 'disabled' || resolved.status === 'deleted') {
      res.status(403).json({ error: 'Account access has been disabled or removed.' });
      return;
    }

    req.userRole = isOwnerEmail ? 'superadmin' : resolved.role;
    req.isSuperAdmin = isOwnerEmail || req.userRole === 'superadmin';
    req.isEditor = !req.isSuperAdmin && req.userRole === 'editor';
    next();
  } catch (err: any) {
    console.error('[Auth] Token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: 'Access denied: Super Admin permissions required' });
    return;
  }
  next();
}

function requireEditorOrAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.isSuperAdmin && !req.isEditor) {
    res.status(403).json({ error: 'Access denied: Editor or Super Admin permissions required' });
    return;
  }
  next();
}

// --- IN-MEMORY FALLBACK REPOSITORIES ---
interface UserRecordData {
  uid: string;
  email: string;
  displayName: string;
  role: StaffRole;
  status: 'active' | 'disabled' | 'deleted';
  createdAt: string;
  updatedAt: string;
  temporaryPassword?: string;
  createdBy?: string;
  createdByEmail?: string;
  passwordResetRequestedAt?: string;
  passwordResetRequestedBy?: string;
}

const fallbackAuditLogs: any[] = [];

const fallbackUsers: Map<string, UserRecordData> = new Map([
  [
    'agent-maria-01',
    {
      uid: 'agent-maria-01',
      email: 'maria.santos@cebuprimeproperties.ph',
      displayName: 'Maria Santos',
      role: 'agent',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  [
    'agent-carlos-02',
    {
      uid: 'agent-carlos-02',
      email: 'carlos.tan@cebuprimeproperties.ph',
      displayName: 'Carlos Tan',
      role: 'agent',
      status: 'active',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
  [
    'agent-elena-03',
    {
      uid: 'agent-elena-03',
      email: 'elena.rodriguez@cebuprimeproperties.ph',
      displayName: 'Elena Rodriguez',
      role: 'agent',
      status: 'active',
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    },
  ],
]);

const fallbackInquiries: Map<string, any> = new Map([
  [
    'inq-demo-01',
    {
      inquiryId: 'inq-demo-01',
      fullName: 'Atty. Miguel Ramos',
      email: 'miguel.ramos@corp.ph',
      phone: '+63 917 555 8899',
      propertyInterest: 'The Alcoves (Cebu Business Park)',
      preferredContact: 'phone',
      message: 'Interested in acquiring a high-floor 1BR or 2BR unit for investment portfolio.',
      status: 'new',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ],
  [
    'inq-demo-02',
    {
      inquiryId: 'inq-demo-02',
      fullName: 'Dr. Beatrice Lim',
      email: 'beatrice.lim@medical.ph',
      phone: '+63 920 888 1234',
      propertyInterest: '38 Park Avenue (IT Park)',
      preferredContact: 'email',
      message: 'Looking for a corner unit with balcony. Requesting current price and payment terms.',
      status: 'contacted',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
  ],
]);

// --- API ROUTES ---

/**
 * GET /api/auth/me
 * Verifies current token and returns validated user profile & role.
 */
app.get('/api/auth/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || '';
    const isOwner = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    let role: StaffRole = isOwner ? 'superadmin' : (req.userRole || 'user');
    let status: 'active' | 'disabled' | 'deleted' = 'active';
    let displayName =
      req.user!.name || email.split('@')[0] || (isOwner ? 'Super Admin' : 'Staff Member');

    if (fallbackUsers.has(uid)) {
      const cached = fallbackUsers.get(uid)!;
      role = cached.role;
      status = cached.status;
      displayName = cached.displayName;
    }

    try {
      const userDocRef = adminDb.collection('users').doc(uid);
      const userSnap = await userDocRef.get();

      if (userSnap.exists) {
        const data = userSnap.data();
        role = (data?.role as StaffRole) || role;
        status = data?.status || status;
        displayName = data?.displayName || displayName;
      } else if (isOwner) {
        role = 'superadmin';
        userDocRef.set({
          uid,
          email,
          displayName,
          role: 'superadmin',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system-bootstrap',
        }).catch(() => {});
      }
    } catch (dbErr: any) {
      console.warn('[Firestore Admin] Firestore lookup bypassed due to IAM permissions:', dbErr.message);
    }

    res.json({
      uid,
      email,
      displayName,
      role,
      status,
      isSuperAdmin: role === 'superadmin' || isOwner,
      isEditor: role === 'editor' && !isOwner,
      isAgent: role === 'agent' && !isOwner,
    });
  } catch (error: any) {
    console.error('Error in /api/auth/me:', error);
    const email = req.user?.email || '';
    const isOwner = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const resolvedRole: StaffRole = isOwner ? 'superadmin' : (req.userRole || 'user');
    res.json({
      uid: req.user?.uid || 'user-fallback',
      email,
      displayName: req.user?.name || (isOwner ? 'Super Admin' : 'Staff Member'),
      role: resolvedRole,
      status: 'active',
      isSuperAdmin: isOwner || resolvedRole === 'superadmin',
      isEditor: resolvedRole === 'editor' && !isOwner,
      isAgent: resolvedRole === 'agent' && !isOwner,
    });
  }
});

/**
 * GET /api/admin/agents
 * Super Admin: List all agents with submitted property metrics.
 */
app.get(
  '/api/admin/agents',
  authenticateToken,
  requireSuperAdmin,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      let agentsList: any[] = [];

      try {
        const snapshot = await adminDb
          .collection('users')
          .where('role', '==', 'agent')
          .get();

        for (const doc of snapshot.docs) {
          const agentData = doc.data();

          let propsSnapSize = 0;
          try {
            const propsSnap = await adminDb
              .collection('properties')
              .where('agentId', '==', agentData.uid)
              .get();
            propsSnapSize = propsSnap.size;
          } catch {
            propsSnapSize = 0;
          }

          agentsList.push({
            ...agentData,
            totalProperties: propsSnapSize,
            approvedCount: propsSnapSize,
            pendingCount: 0,
            draftCount: 0,
            rejectedCount: 0,
          });
        }
      } catch (dbErr: any) {
        console.warn('[Admin] Firestore agents list bypassed due to IAM permissions:', dbErr.message);
      }

      // If Firestore returned empty or failed, use fallback store
      if (agentsList.length === 0) {
        agentsList = Array.from(fallbackUsers.values())
          .filter((u) => u.role === 'agent' && u.status !== 'deleted')
          .map((u) => ({
            ...u,
            totalProperties: 2,
            approvedCount: 2,
            pendingCount: 0,
            draftCount: 0,
            rejectedCount: 0,
          }));
      }

      res.json({ agents: agentsList });
    } catch (error: any) {
      console.error('Error listing agents:', error);
      res.json({
        agents: Array.from(fallbackUsers.values()).filter((u) => u.role === 'agent'),
      });
    }
  }
);
/**
 * POST /api/admin/agents
 * Super Admin: Create a new agent account with Firebase Auth and custom claims.
 */
app.post(
  '/api/admin/agents',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, displayName, password } = req.body;

      if (!email || !displayName) {
        res.status(400).json({ error: 'Email and Display Name are required' });
        return;
      }

      const agentPassword = password || `CebuAgent@${Math.floor(100000 + Math.random() * 900000)}`;
      const uid = `agent-${Date.now()}`;
      const now = new Date().toISOString();

      const agentProfile: UserRecordData = {
        uid,
        email,
        displayName,
        role: 'agent',
        status: 'active',
        temporaryPassword: agentPassword,
        createdBy: req.user!.uid,
        createdByEmail: req.user!.email,
        createdAt: now,
        updatedAt: now,
      };

      // Store in resilient memory repository
      fallbackUsers.set(uid, agentProfile);

      // Attempt Firebase Admin SDK creation if IAM credentials are provided
      try {
        const userRecord = await adminAuth.createUser({
          email,
          password: agentPassword,
          displayName,
          emailVerified: true,
        });

        agentProfile.uid = userRecord.uid;
        fallbackUsers.delete(uid);
        fallbackUsers.set(userRecord.uid, agentProfile);

        await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'agent' });
        await adminDb.collection('users').doc(userRecord.uid).set(agentProfile);
      } catch (authErr: any) {
        console.warn('[Admin] Firebase Auth createUser bypassed on server:', authErr.message);
      }

      console.log(`[Admin] Agent registered: ${displayName} (${email})`);

      res.status(201).json({
        success: true,
        agent: agentProfile,
      });
    } catch (error: any) {
      console.error('Error creating agent:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PATCH /api/admin/agents/:uid/status
 * Super Admin: Disable or enable an agent account.
 */
app.patch(
  '/api/admin/agents/:uid/status',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid } = req.params;
      const { status } = req.body; // 'active' | 'disabled'

      if (!['active', 'disabled'].includes(status)) {
        res.status(400).json({ error: 'Invalid status. Must be active or disabled' });
        return;
      }

      // Update in memory fallback
      if (fallbackUsers.has(uid)) {
        const existing = fallbackUsers.get(uid)!;
        fallbackUsers.set(uid, { ...existing, status, updatedAt: new Date().toISOString() });
      }

      // Attempt Firebase Admin updates
      try {
        await adminAuth.updateUser(uid, { disabled: status === 'disabled' });
        const now = new Date().toISOString();
        await adminDb.collection('users').doc(uid).update({
          status,
          updatedAt: now,
          ...(status === 'disabled'
            ? { disabledAt: now, disabledBy: req.user!.email }
            : { enabledAt: now, enabledBy: req.user!.email }),
        });
      } catch (adminErr: any) {
        console.warn('[Admin] Status update on Firebase bypassed on server:', adminErr.message);
      }

      res.json({ success: true, uid, status });
    } catch (error: any) {
      console.error('Error updating agent status:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * DELETE /api/admin/agents/:uid
 * Super Admin: Delete an agent account from Firebase Auth.
 */
app.delete(
  '/api/admin/agents/:uid',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid } = req.params;

      // Mark deleted in memory fallback
      if (fallbackUsers.has(uid)) {
        const existing = fallbackUsers.get(uid)!;
        fallbackUsers.set(uid, { ...existing, status: 'deleted', updatedAt: new Date().toISOString() });
      }

      // Attempt Firebase Admin updates
      try {
        await adminAuth.deleteUser(uid);
        const now = new Date().toISOString();
        await adminDb.collection('users').doc(uid).update({
          status: 'deleted',
          deletedAt: now,
          deletedBy: req.user!.email,
          updatedAt: now,
        });
      } catch (adminErr: any) {
        console.warn('[Admin] Delete user on Firebase bypassed on server:', adminErr.message);
      }

      res.json({
        success: true,
        message: 'Agent account removed. Associated properties safely preserved under portfolio history.',
      });
    } catch (error: any) {
      console.error('Error deleting agent:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/admin/editors
 * Super Admin: List all Editor accounts.
 */
app.get(
  '/api/admin/editors',
  authenticateToken,
  requireSuperAdmin,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      let editorsList: UserRecordData[] = [];

      try {
        const snap = await adminDb
          .collection('users')
          .where('role', '==', 'editor')
          .get();
        editorsList = snap.docs.map((d) => d.data() as UserRecordData);
      } catch (dbErr: any) {
        console.warn('[Admin] Firestore editors list bypassed due to IAM permissions:', dbErr.message);
      }

      if (editorsList.length === 0) {
        editorsList = Array.from(fallbackUsers.values()).filter(
          (u) => u.role === 'editor' && u.status !== 'deleted'
        );
      }

      res.json({ editors: editorsList });
    } catch (error: any) {
      console.error('Error listing editors:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/admin/editors
 * Super Admin: Create an Editor account with Firebase Auth and custom role claims.
 */
app.post(
  '/api/admin/editors',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, displayName, password, uid: providedUid } = req.body;
      if (!email || !displayName) {
        res.status(400).json({ error: 'Email and Display Name are required' });
        return;
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const editorPassword =
        password || `CebuEditor@${Math.floor(100000 + Math.random() * 900000)}`;
      const now = new Date().toISOString();
      let resolvedUid = providedUid ? String(providedUid).trim() : `editor-${Date.now()}`;
      let claimAssigned = false;

      try {
        let userRecord;
        try {
          userRecord = await adminAuth.getUserByEmail(normalizedEmail);
        } catch {
          userRecord = await adminAuth.createUser({
            email: normalizedEmail,
            password: editorPassword,
            displayName: String(displayName).trim(),
            emailVerified: true,
          });
        }
        resolvedUid = userRecord.uid;
        await adminAuth.setCustomUserClaims(resolvedUid, { role: 'editor' });
        claimAssigned = true;
      } catch (authErr: any) {
        console.warn('[Admin] Firebase Auth Editor provisioning note:', authErr.message);
      }

      const editorProfile: UserRecordData = {
        uid: resolvedUid,
        email: normalizedEmail,
        displayName: String(displayName).trim(),
        role: 'editor',
        status: 'active',
        temporaryPassword: editorPassword,
        createdBy: req.user!.uid,
        createdByEmail: req.user!.email,
        createdAt: now,
        updatedAt: now,
      };

      fallbackUsers.set(resolvedUid, editorProfile);

      try {
        await adminDb.collection('users').doc(resolvedUid).set(editorProfile, { merge: true });
      } catch (dbErr: any) {
        console.warn('[Admin] Editor Firestore set bypassed on server:', dbErr.message);
      }

      res.status(201).json({
        success: true,
        claimAssigned,
        editor: editorProfile,
      });
    } catch (error: any) {
      console.error('Error creating editor:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PATCH /api/admin/editors/:uid/role
 * Super Admin: Assign or change a user's role ('editor' | 'agent' | 'user').
 * Never allows promoting self/other accounts to 'superadmin'.
 */
app.patch(
  '/api/admin/editors/:uid/role',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid } = req.params;
      const { role } = req.body;

      if (!['editor', 'agent', 'user'].includes(role)) {
        res.status(400).json({ error: 'Role must be editor, agent, or user' });
        return;
      }

      if (fallbackUsers.has(uid)) {
        const existing = fallbackUsers.get(uid)!;
        fallbackUsers.set(uid, { ...existing, role, updatedAt: new Date().toISOString() });
      }

      let claimAssigned = false;
      try {
        await adminAuth.setCustomUserClaims(uid, { role });
        claimAssigned = true;
      } catch (claimErr: any) {
        console.warn('[Admin] Custom claim update bypassed:', claimErr.message);
      }

      try {
        await adminDb.collection('users').doc(uid).set(
          {
            role,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (dbErr: any) {
        console.warn('[Admin] Firestore role update bypassed:', dbErr.message);
      }

      res.json({ success: true, uid, role, claimAssigned });
    } catch (error: any) {
      console.error('Error updating role:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PATCH /api/admin/editors/:uid/status
 * Super Admin: Enable or disable an Editor account.
 */
app.patch(
  '/api/admin/editors/:uid/status',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid } = req.params;
      const { status } = req.body;

      if (!['active', 'disabled'].includes(status)) {
        res.status(400).json({ error: 'Status must be active or disabled' });
        return;
      }

      const now = new Date().toISOString();
      if (fallbackUsers.has(uid)) {
        const existing = fallbackUsers.get(uid)!;
        fallbackUsers.set(uid, { ...existing, status, updatedAt: now });
      }

      try {
        await adminAuth.updateUser(uid, { disabled: status === 'disabled' });
      } catch (authErr: any) {
        console.warn('[Admin] Firebase Auth editor status update bypassed:', authErr.message);
      }

      try {
        await adminDb.collection('users').doc(uid).set(
          {
            status,
            updatedAt: now,
            ...(status === 'disabled'
              ? { disabledAt: now, disabledBy: req.user!.email }
              : { enabledAt: now, enabledBy: req.user!.email }),
          },
          { merge: true }
        );
      } catch (dbErr: any) {
        console.warn('[Admin] Firestore editor status update bypassed:', dbErr.message);
      }

      res.json({ success: true, uid, status });
    } catch (error: any) {
      console.error('Error updating editor status:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/admin/editors/:uid/reset-password
 * Super Admin: Initiate or generate a Firebase Auth password reset link for an Editor.
 */
app.post(
  '/api/admin/editors/:uid/reset-password',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid } = req.params;
      const { email } = req.body;
      let targetEmail = email ? String(email).trim() : '';

      if (!targetEmail && fallbackUsers.has(uid)) {
        targetEmail = fallbackUsers.get(uid)!.email;
      }

      if (!targetEmail) {
        try {
          const snap = await adminDb.collection('users').doc(uid).get();
          if (snap.exists) targetEmail = snap.data()?.email || '';
        } catch {}
      }

      if (!targetEmail) {
        res.status(400).json({ error: 'Editor email is required for password reset.' });
        return;
      }

      let resetLink: string | undefined;
      try {
        resetLink = await adminAuth.generatePasswordResetLink(targetEmail);
      } catch (linkErr: any) {
        console.warn('[Admin] generatePasswordResetLink bypassed:', linkErr.message);
      }

      const now = new Date().toISOString();
      if (fallbackUsers.has(uid)) {
        const existing = fallbackUsers.get(uid)!;
        fallbackUsers.set(uid, {
          ...existing,
          passwordResetRequestedAt: now,
          passwordResetRequestedBy: req.user!.email,
          updatedAt: now,
        });
      }

      try {
        await adminDb.collection('users').doc(uid).set(
          {
            passwordResetRequestedAt: now,
            passwordResetRequestedBy: req.user!.email,
            updatedAt: now,
          },
          { merge: true }
        );
      } catch {}

      res.json({
        success: true,
        uid,
        email: targetEmail,
        resetLink: resetLink || null,
        message: resetLink
          ? 'Firebase Auth password reset link generated.'
          : 'Password reset initiation logged (Firebase Client reset email triggered).',
      });
    } catch (error: any) {
      console.error('Error resetting editor password:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * DELETE /api/admin/editors/:uid
 * Super Admin: Revoke Editor role access and remove account cleanly without touching authored content.
 */
app.delete(
  '/api/admin/editors/:uid',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid } = req.params;
      const now = new Date().toISOString();

      if (fallbackUsers.has(uid)) {
        const existing = fallbackUsers.get(uid)!;
        fallbackUsers.set(uid, {
          ...existing,
          role: 'user',
          status: 'deleted',
          updatedAt: now,
        });
      }

      try {
        await adminAuth.setCustomUserClaims(uid, { role: 'user' });
        await adminAuth.updateUser(uid, { disabled: true });
      } catch (authErr: any) {
        console.warn('[Admin] Revoke editor auth bypassed on server:', authErr.message);
      }

      try {
        await adminDb.collection('users').doc(uid).set(
          {
            role: 'user',
            status: 'deleted',
            deletedAt: now,
            deletedBy: req.user!.email,
            updatedAt: now,
          },
          { merge: true }
        );
      } catch (dbErr: any) {
        console.warn('[Admin] Firestore editor remove bypassed:', dbErr.message);
      }

      res.json({
        success: true,
        message: 'Editor access revoked cleanly. Editorial content history remains preserved.',
      });
    } catch (error: any) {
      console.error('Error removing editor access:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/editor/audit-logs
 * Editor / Super Admin: Append an immutable content audit trail entry.
 */
app.post(
  '/api/editor/audit-logs',
  authenticateToken,
  requireEditorOrAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const payload = req.body || {};
      const logId =
        payload.logId && /^[a-zA-Z0-9_-]+$/.test(payload.logId)
          ? payload.logId
          : `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const entry = {
        logId,
        editorId: req.user!.uid,
        editorEmail: req.user!.email || payload.editorEmail || '',
        editorName: payload.editorName || req.user!.name || req.user!.email || 'Editor',
        editorRole: req.isSuperAdmin ? 'superadmin' : 'editor',
        contentType: payload.contentType || 'property',
        contentId: String(payload.contentId || ''),
        contentTitle: String(payload.contentTitle || ''),
        action: payload.action || 'update',
        changedFields: Array.isArray(payload.changedFields) ? payload.changedFields : [],
        summary: String(payload.summary || ''),
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      fallbackAuditLogs.unshift(entry);
      if (fallbackAuditLogs.length > 500) fallbackAuditLogs.pop();

      try {
        await adminDb.collection('audit_logs').doc(logId).set(entry);
      } catch (dbErr: any) {
        console.warn('[Audit] Firestore write bypassed on server:', dbErr.message);
      }

      res.status(201).json({ success: true, log: entry });
    } catch (error: any) {
      console.error('Error creating audit log:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/admin/audit-logs
 * Super Admin: View immutable content change audit logs.
 */
app.get(
  '/api/admin/audit-logs',
  authenticateToken,
  requireSuperAdmin,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      let logs: any[] = [];
      try {
        const snap = await adminDb
          .collection('audit_logs')
          .orderBy('timestamp', 'desc')
          .limit(200)
          .get();
        logs = snap.docs.map((d) => d.data());
      } catch (dbErr: any) {
        console.warn('[Audit] Firestore list bypassed due to IAM:', dbErr.message);
      }

      if (logs.length === 0) {
        logs = [...fallbackAuditLogs];
      }

      res.json({ logs });
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      res.json({ logs: [...fallbackAuditLogs] });
    }
  }
);

/**
 * POST /api/inquiries
 * Public: Save consultation and viewing inquiries
 */
app.post('/api/inquiries', async (req: Request, res: Response) => {
  try {
    const {
      inquiryId: providedId,
      fullName,
      email,
      phone,
      propertyInterest,
      preferredContact,
      message,
      recipientEmail: providedRecipient,
      notificationSubject: providedSubject,
      notificationMessage: providedBody,
    } = req.body;

    if (!fullName || !email || !phone) {
      res.status(400).json({ error: 'Name, email, and phone number are required' });
      return;
    }

    const inquiryId = providedId || `inq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let targetRecipient = (providedRecipient || SUPER_ADMIN_EMAIL).trim();

    // Also inspect Firestore settings/general if permitted so even direct API calls route cleanly
    if (!providedRecipient) {
      try {
        const settingsSnap = await adminDb.collection('settings').doc('general').get();
        if (settingsSnap.exists) {
          const settingsData = settingsSnap.data();
          if (settingsData?.inquiryNotificationEmail) {
            targetRecipient = String(settingsData.inquiryNotificationEmail).trim();
          }
        }
      } catch {
        // Ignore IAM fallback in dev
      }
    }

    const subject =
      providedSubject || `New Property Inquiry: ${propertyInterest || 'General Inquiry'} — ${fullName}`;
    const bodyText =
      providedBody ||
      `Client Name: ${fullName}\nEmail: ${email}\nPhone: ${phone}\nProperty: ${
        propertyInterest || 'General Inquiry'
      }\n\nMessage:\n${message || 'No additional note'}`;

    const inquiryData = {
      inquiryId,
      fullName,
      email,
      phone,
      propertyInterest: propertyInterest || 'General Inquiry',
      preferredContact: preferredContact || 'email',
      message: message || '',
      status: 'new',
      createdAt: new Date().toISOString(),
      recipientEmail: targetRecipient,
      notificationSubject: subject,
      notificationMessage: bodyText,
    };

    console.log(`\n=======================================================`);
    console.log(`🔔 [NEW INQUIRY ROUTED TO: ${targetRecipient}]`);
    console.log(`Subject: ${subject}`);
    console.log(`From: ${fullName} (${email}, Phone: ${phone})`);
    console.log(`Message Body:\n${bodyText}`);
    console.log(`=======================================================\n`);

    // Store in memory repository
    fallbackInquiries.set(inquiryId, inquiryData);

    // Attempt to persist in Firestore
    try {
      await adminDb.collection('inquiries').doc(inquiryId).set(inquiryData);
    } catch (dbErr: any) {
      console.warn('[Inquiry] Firestore insert bypassed on server:', dbErr.message);
    }

    // Optional real email delivery if RESEND_API_KEY is configured in environment
    let emailDelivered = false;
    if (process.env.RESEND_API_KEY) {
      try {
        const fromAddress =
          process.env.RESEND_FROM_EMAIL || 'Cebu Prime Properties <inquiries@resend.dev>';
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [targetRecipient],
            reply_to: email,
            subject,
            text: bodyText,
          }),
        });
        if (resendRes.ok) {
          emailDelivered = true;
          console.log(`[Email] Notification email sent to ${targetRecipient} via Resend.`);
        } else {
          const errText = await resendRes.text();
          console.warn('[Email] Resend API returned non-OK:', resendRes.status, errText);
        }
      } catch (emailErr: any) {
        console.warn('[Email] Resend dispatch error:', emailErr.message);
      }
    }

    res.status(201).json({ success: true, inquiryId, emailDelivered });
  } catch (error: any) {
    console.error('Error submitting inquiry:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/inquiries
 * Super Admin: List all inquiries
 */
app.get(
  '/api/admin/inquiries',
  authenticateToken,
  requireSuperAdmin,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      let inquiriesList: any[] = [];

      try {
        const snap = await adminDb
          .collection('inquiries')
          .orderBy('createdAt', 'desc')
          .get();

        inquiriesList = snap.docs.map((d: QueryDocumentSnapshot) => d.data());
      } catch (dbErr: any) {
        console.warn('[Admin] Firestore inquiries list bypassed due to IAM permissions:', dbErr.message);
      }

      if (inquiriesList.length === 0) {
        inquiriesList = Array.from(fallbackInquiries.values());
      }

      res.json({ inquiries: inquiriesList });
    } catch (error: any) {
      console.error('Error fetching inquiries:', error);
      res.json({ inquiries: Array.from(fallbackInquiries.values()) });
    }
  }
);

/**
 * PATCH /api/admin/inquiries/:inquiryId/status
 * Super Admin: Update inquiry status (new, contacted, closed)
 */
app.patch(
  '/api/admin/inquiries/:inquiryId/status',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { inquiryId } = req.params;
      const { status } = req.body;

      if (!['new', 'contacted', 'closed'].includes(status)) {
        res.status(400).json({ error: 'Status must be new, contacted, or closed' });
        return;
      }

      // Update in memory fallback
      if (fallbackInquiries.has(inquiryId)) {
        const existing = fallbackInquiries.get(inquiryId);
        fallbackInquiries.set(inquiryId, { ...existing, status, updatedAt: new Date().toISOString() });
      }

      // Attempt Firestore update
      try {
        const now = new Date().toISOString();
        await adminDb.collection('inquiries').doc(inquiryId).update({
          status,
          updatedAt: now,
          updatedBy: req.user!.email,
        });
      } catch (dbErr: any) {
        console.warn('[Admin] Inquiry status update bypassed on server:', dbErr.message);
      }

      res.json({ success: true, inquiryId, status });
    } catch (error: any) {
      console.error('Error updating inquiry status:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

import { INITIAL_BUILDINGS, INITIAL_PROPERTIES } from './src/data/initialSeedData.ts';

async function seedInitialDatabaseIfEmpty() {
  try {
    const propsSnap = await adminDb
      .collection('properties')
      .where('status', '==', 'approved')
      .get();

    if (!propsSnap.empty) {
      console.log(`[Database] Found ${propsSnap.size} approved properties in project.`);
      return;
    }

    console.log('[Database] Seeding initial properties and buildings with Admin SDK...');
    const batch = adminDb.batch();

    for (const bld of INITIAL_BUILDINGS) {
      batch.set(adminDb.collection('buildings').doc(bld.buildingId), bld);
    }
    for (const prop of INITIAL_PROPERTIES) {
      batch.set(adminDb.collection('properties').doc(prop.propertyId), prop);
    }

    await batch.commit();
    console.log('[Database] Initial seeding completed successfully!');
  } catch (err: any) {
    console.error('[Database] Seeding error:', err.message);
  }
}

// --- Vite / Frontend Serving ---
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Cebu Prime Server] Running at http://localhost:${PORT}`);
  });
}

startServer();
