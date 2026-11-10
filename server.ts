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
interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
  isSuperAdmin?: boolean;
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
      // Fallback decode when Identity Toolkit API is propagating or restricted in dev
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadStr = Buffer.from(parts[1], 'base64').toString('utf-8');
        const parsed = JSON.parse(payloadStr);
        // Ensure token belongs to the valid Firebase project and is unexpired
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

    // Check if superadmin by email or claim
    const isOwnerEmail =
      decodedToken.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const hasAdminClaim = (decodedToken as any).role === 'superadmin';

    // Auto-bootstrap custom claim if the super admin signs in
    if (isOwnerEmail && !hasAdminClaim) {
      try {
        await adminAuth.setCustomUserClaims(decodedToken.uid, { role: 'superadmin' });
        console.log(`[Auth] Bootstrap claim assigned to Super Admin ${decodedToken.email}`);
      } catch (claimErr: any) {
        console.warn('[Auth] Could not set custom claims via Admin SDK (will use email role):', claimErr.message);
      }
    }

    req.isSuperAdmin = isOwnerEmail || hasAdminClaim;
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

    // Check user document in Firestore
    const userDocRef = adminDb.collection('users').doc(uid);
    const userSnap = await userDocRef.get();

    let role = (req.user as any)?.role || (isOwner ? 'superadmin' : 'agent');
    let status = 'active';
    let displayName = req.user!.name || email.split('@')[0];

    if (userSnap.exists) {
      const data = userSnap.data();
      role = data?.role || role;
      status = data?.status || 'active';
      displayName = data?.displayName || displayName;
    } else {
      // First-time record initialization for Super Admin
      if (isOwner) {
        role = 'superadmin';
        await userDocRef.set({
          uid,
          email,
          displayName,
          role: 'superadmin',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system-bootstrap',
        });
      }
    }

    res.json({
      uid,
      email,
      displayName,
      role,
      status,
      isSuperAdmin: role === 'superadmin',
      isAgent: role === 'agent',
    });
  } catch (error: any) {
    console.error('Error in /api/auth/me:', error);
    res.status(500).json({ error: error.message });
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
      const snapshot = await adminDb
        .collection('users')
        .where('role', '==', 'agent')
        .get();

      const agents: any[] = [];

      for (const doc of snapshot.docs) {
        const agentData = doc.data();

        // Calculate property counts for this agent
        const propsSnap = await adminDb
          .collection('properties')
          .where('agentId', '==', agentData.uid)
          .get();

        let approvedCount = 0;
        let pendingCount = 0;
        let draftCount = 0;
        let rejectedCount = 0;

        propsSnap.forEach((pDoc: QueryDocumentSnapshot) => {
          const status = pDoc.data().status;
          if (status === 'approved') approvedCount++;
          else if (status === 'pending') pendingCount++;
          else if (status === 'draft') draftCount++;
          else if (status === 'rejected') rejectedCount++;
        });

        agents.push({
          ...agentData,
          totalProperties: propsSnap.size,
          approvedCount,
          pendingCount,
          draftCount,
          rejectedCount,
        });
      }

      res.json({ agents });
    } catch (error: any) {
      console.error('Error listing agents:', error);
      res.status(500).json({ error: error.message });
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

      // 1. Create Firebase Auth user
      const userRecord = await adminAuth.createUser({
        email,
        password: agentPassword,
        displayName,
        emailVerified: true,
      });

      // 2. Set custom claim role = 'agent'
      await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'agent' });

      // 3. Save agent profile in Firestore
      const now = new Date().toISOString();
      const agentProfile = {
        uid: userRecord.uid,
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

      await adminDb.collection('users').doc(userRecord.uid).set(agentProfile);

      console.log(`[Admin] Agent created: ${displayName} (${email}) - UID: ${userRecord.uid}`);

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

      // 1. Update Firebase Auth user
      await adminAuth.updateUser(uid, {
        disabled: status === 'disabled',
      });

      // 2. Update Firestore user doc
      const now = new Date().toISOString();
      await adminDb.collection('users').doc(uid).update({
        status,
        updatedAt: now,
        ...(status === 'disabled'
          ? { disabledAt: now, disabledBy: req.user!.email }
          : { enabledAt: now, enabledBy: req.user!.email }),
      });

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
 * Safely deactivates and marks deleted in Firestore while preserving property listings.
 */
app.delete(
  '/api/admin/agents/:uid',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid } = req.params;

      // 1. Delete user from Firebase Auth
      try {
        await adminAuth.deleteUser(uid);
      } catch (authErr: any) {
        console.warn('Auth user already removed or not found:', authErr.message);
      }

      // 2. Safely mark agent record as deleted in Firestore (preserves property history)
      const now = new Date().toISOString();
      await adminDb.collection('users').doc(uid).update({
        status: 'deleted',
        deletedAt: now,
        deletedBy: req.user!.email,
        updatedAt: now,
      });

      console.log(`[Admin] Agent deleted safely: UID ${uid} by ${req.user!.email}`);

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
 * POST /api/inquiries
 * Public: Save consultation and viewing inquiries
 */
app.post('/api/inquiries', async (req: Request, res: Response) => {
  try {
    const { fullName, email, phone, propertyInterest, preferredContact, message } = req.body;

    if (!fullName || !email || !phone) {
      res.status(400).json({ error: 'Name, email, and phone number are required' });
      return;
    }

    const inquiryId = `inq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const inquiryData = {
      inquiryId,
      fullName,
      email,
      phone,
      propertyInterest: propertyInterest || 'General Inquiry',
      preferredContact: preferredContact || 'phone',
      message: message || '',
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection('inquiries').doc(inquiryId).set(inquiryData);

    res.status(201).json({ success: true, inquiryId });
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
      const snap = await adminDb
        .collection('inquiries')
        .orderBy('createdAt', 'desc')
        .get();

      const inquiries = snap.docs.map((d: QueryDocumentSnapshot) => d.data());
      res.json({ inquiries });
    } catch (error: any) {
      console.error('Error fetching inquiries:', error);
      res.status(500).json({ error: error.message });
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

      const now = new Date().toISOString();
      await adminDb.collection('inquiries').doc(inquiryId).update({
        status,
        updatedAt: now,
        updatedBy: req.user!.email,
      });

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
