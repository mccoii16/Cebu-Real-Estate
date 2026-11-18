import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import {
  AuditAction,
  AuditContentType,
  AuditLogDoc,
} from '../types/property';

const AUDIT_LOGS_COLLECTION = 'audit_logs';

export function generateAuditLogId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `log_${Date.now()}_${rand}`;
}

export interface RecordAuditParams {
  user?: User | null;
  editorEmail?: string;
  editorName?: string;
  editorRole: 'editor' | 'superadmin';
  contentType: AuditContentType;
  contentId: string;
  contentTitle: string;
  action: AuditAction;
  changedFields: string[];
  summary?: string;
}

export async function recordAuditLog(params: RecordAuditParams): Promise<AuditLogDoc> {
  const logId = generateAuditLogId();
  const timestamp = new Date().toISOString();
  const editorId = params.user?.uid || 'staff-unknown';
  const editorEmail = params.editorEmail || params.user?.email || '';
  const editorName =
    params.editorName ||
    params.user?.displayName ||
    editorEmail.split('@')[0] ||
    (params.editorRole === 'superadmin' ? 'Super Admin' : 'Editor');

  const changedFields = Array.from(new Set(params.changedFields.filter(Boolean)));
  const summary =
    params.summary ||
    `${params.action.toUpperCase()} ${params.contentType} "${params.contentTitle}"${
      changedFields.length > 0 ? ` (${changedFields.join(', ')})` : ''
    }`;

  const entry: AuditLogDoc = {
    logId,
    editorId,
    editorEmail,
    editorName,
    editorRole: params.editorRole,
    contentType: params.contentType,
    contentId: params.contentId,
    contentTitle: params.contentTitle,
    action: params.action,
    changedFields,
    summary,
    timestamp,
  };

  try {
    await setDoc(doc(db, AUDIT_LOGS_COLLECTION, logId), entry);
  } catch (fsErr) {
    console.warn('[AuditLog] Direct Firestore write notice:', fsErr);
  }

  try {
    const token = await params.user?.getIdToken();
    if (token) {
      await fetch('/api/editor/audit-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(entry),
      });
    }
  } catch {
    // Non-fatal in pure SPA mode
  }

  return entry;
}

export async function getAuditLogs(adminUser?: User | null): Promise<AuditLogDoc[]> {
  const map = new Map<string, AuditLogDoc>();

  try {
    const q = query(
      collection(db, AUDIT_LOGS_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(200)
    );
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const data = docSnap.data() as AuditLogDoc;
      map.set(data.logId || docSnap.id, data);
    });
  } catch (fsErr) {
    console.warn('[AuditLog] Firestore read notice:', fsErr);
  }

  try {
    const token = await adminUser?.getIdToken();
    if (token) {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          data.logs.forEach((log: AuditLogDoc) => {
            if (log.logId && !map.has(log.logId)) {
              map.set(log.logId, log);
            }
          });
        }
      }
    }
  } catch {
    // Ignore API fallback error
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
