import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  type Unsubscribe 
} from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { resolveCanonicalUserIdentity, formatFormalName } from './userIdentityResolver';

export type ActivityActionType =
  | 'profile_update'
  | 'id_modification'
  | 'status_change'
  | 'role_change'
  | 'user_deleted'
  | 'user_dropped'
  | 'user_created'
  | 'account_merged';

export interface FieldChange {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ActivityLogEntry {
  id: string;
  actionType: ActivityActionType;
  actionTitle: string;
  timestamp: string;
  createdAtMillis: number;
  editor: {
    uid: string;
    name: string;
    email: string;
    role: string;
  };
  targetUser: {
    uid: string;
    name: string;
    email: string;
    idNumber: string;
    role: string;
  };
  changes: FieldChange[];
  details?: string;
}

const LOCAL_STORAGE_KEY = 'src_audit_activity_logs_cache';

function getLocalCache(): ActivityLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveToLocalCache(entry: ActivityLogEntry) {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalCache();
    // Filter duplicates
    const filtered = current.filter(item => item.id !== entry.id);
    const updated = [entry, ...filtered].slice(0, 200);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save activity log to local cache', e);
  }
}

/**
 * Compares old user data and updated user data to identify distinct field changes.
 */
export function calculateProfileDiffs(
  oldUser: any,
  newUser: any
): FieldChange[] {
  const diffs: FieldChange[] = [];

  const oldCanon = resolveCanonicalUserIdentity(oldUser);
  const newCanon = resolveCanonicalUserIdentity(newUser);

  // 1. ID Number
  const oldId = String(oldCanon.idNumber || oldUser?.seqId || oldUser?.seq_id || oldUser?.id_number || '').trim();
  const newId = String(newCanon.idNumber || newUser?.seqId || newUser?.seq_id || newUser?.id_number || '').trim();
  if (oldId !== newId && (oldId || newId)) {
    diffs.push({
      field: 'idNumber',
      label: 'ID Number',
      oldValue: oldId || '—',
      newValue: newId || '—',
    });
  }

  // 2. First Name
  const oldFirst = String(oldCanon.firstName || oldUser?.first_name || oldUser?.firstName || '').trim();
  const newFirst = String(newCanon.firstName || newUser?.first_name || newUser?.firstName || '').trim();
  if (oldFirst.toUpperCase() !== newFirst.toUpperCase() && (oldFirst || newFirst)) {
    diffs.push({
      field: 'firstName',
      label: 'First Name',
      oldValue: oldFirst || '—',
      newValue: newFirst || '—',
    });
  }

  // 3. Middle Name
  const oldMiddle = String(oldCanon.middleName || oldUser?.middle_name || oldUser?.middleName || '').trim();
  const newMiddle = String(newCanon.middleName || newUser?.middle_name || newUser?.middleName || '').trim();
  if (oldMiddle.toUpperCase() !== newMiddle.toUpperCase() && (oldMiddle || newMiddle)) {
    diffs.push({
      field: 'middleName',
      label: 'Middle Name',
      oldValue: oldMiddle || '—',
      newValue: newMiddle || '—',
    });
  }

  // 4. Last Name
  const oldLast = String(oldCanon.lastName || oldUser?.last_name || oldUser?.lastName || '').trim();
  const newLast = String(newCanon.lastName || newUser?.last_name || newUser?.lastName || '').trim();
  if (oldLast.toUpperCase() !== newLast.toUpperCase() && (oldLast || newLast)) {
    diffs.push({
      field: 'lastName',
      label: 'Last Name',
      oldValue: oldLast || '—',
      newValue: newLast || '—',
    });
  }

  // 5. Email
  const oldEmail = String(oldCanon.email || oldUser?.email || '').trim().toLowerCase();
  const newEmail = String(newCanon.email || newUser?.email || '').trim().toLowerCase();
  if (oldEmail !== newEmail && (oldEmail || newEmail)) {
    diffs.push({
      field: 'email',
      label: 'Email Address',
      oldValue: oldEmail || '—',
      newValue: newEmail || '—',
    });
  }

  // 6. Role
  const oldRole = String(oldCanon.role || oldUser?.role || oldUser?.userRole || 'Reviewee').trim();
  const newRole = String(newCanon.role || newUser?.role || newUser?.userRole || 'Reviewee').trim();
  if (oldRole.toLowerCase() !== newRole.toLowerCase() && (oldRole || newRole)) {
    diffs.push({
      field: 'role',
      label: 'System Role',
      oldValue: oldRole,
      newValue: newRole,
    });
  }

  // 7. Status
  const oldStatus = String(oldUser?.accountStatus || oldUser?.status || 'active').trim();
  const newStatus = String(newUser?.accountStatus || newUser?.status || 'active').trim();
  if (oldStatus.toLowerCase() !== newStatus.toLowerCase() && (oldStatus || newStatus)) {
    diffs.push({
      field: 'accountStatus',
      label: 'Account Status',
      oldValue: oldStatus,
      newValue: newStatus,
    });
  }

  // 8. School
  const oldSchool = String(oldCanon.school || oldUser?.school_name || oldUser?.school || '').trim();
  const newSchool = String(newCanon.school || newUser?.school_name || newUser?.school || '').trim();
  if (oldSchool.toUpperCase() !== newSchool.toUpperCase() && (oldSchool || newSchool)) {
    diffs.push({
      field: 'school',
      label: 'School / University',
      oldValue: oldSchool || '—',
      newValue: newSchool || '—',
    });
  }

  // 9. Branch
  const oldBranch = String(oldCanon.branch || oldUser?.review_branch || oldUser?.branch || '').trim();
  const newBranch = String(newCanon.branch || newUser?.review_branch || newUser?.branch || '').trim();
  if (oldBranch.toUpperCase() !== newBranch.toUpperCase() && (oldBranch || newBranch)) {
    diffs.push({
      field: 'branch',
      label: 'Review Branch',
      oldValue: oldBranch || '—',
      newValue: newBranch || '—',
    });
  }

  return diffs;
}

/**
 * Records a modification event when a profile is edited by Admin, Staff, or the Reviewee.
 */
export async function logProfileModification({
  editor,
  oldUser,
  updatedUser,
  customDiffs,
  customActionType,
  details,
}: {
  editor: any;
  oldUser: any;
  updatedUser: any;
  customDiffs?: FieldChange[];
  customActionType?: ActivityActionType;
  details?: string;
}): Promise<void> {
  try {
    const changes = customDiffs || calculateProfileDiffs(oldUser, updatedUser);
    
    // If no detectable changes and not a forced action, skip logging
    if (changes.length === 0 && !customActionType && !details) {
      return;
    }

    const editorCanon = resolveCanonicalUserIdentity(editor);
    const targetCanon = resolveCanonicalUserIdentity(updatedUser || oldUser);

    const editorRole = editorCanon.role || editor?.role || editor?.userRole || 'Admin';
    const editorName = formatFormalName(editorCanon) !== 'UNKNOWN USER' 
      ? formatFormalName(editorCanon) 
      : (editor?.displayName || editor?.email || 'Administrator');

    const targetName = formatFormalName(targetCanon) !== 'UNKNOWN USER'
      ? formatFormalName(targetCanon)
      : (targetCanon.email || 'Reviewee');

    const targetIdNumber = targetCanon.idNumber || updatedUser?.seqId || oldUser?.seqId || '—';

    // Determine Action Type
    let actionType: ActivityActionType = customActionType || 'profile_update';
    let actionTitle = 'Updated Reviewee Profile';

    if (!customActionType) {
      const hasIdChange = changes.some(c => c.field === 'idNumber');
      const hasRoleChange = changes.some(c => c.field === 'role');
      const hasStatusChange = changes.some(c => c.field === 'accountStatus');

      if (hasIdChange) {
        actionType = 'id_modification';
        actionTitle = 'Modified ID Number';
      } else if (hasRoleChange) {
        actionType = 'role_change';
        actionTitle = 'Changed User Role';
      } else if (hasStatusChange) {
        actionType = 'status_change';
        actionTitle = 'Changed Account Status';
      }
    } else {
      if (customActionType === 'user_deleted') actionTitle = 'Deleted User Account';
      else if (customActionType === 'user_dropped') actionTitle = 'Dropped User Profile';
      else if (customActionType === 'account_merged') actionTitle = 'Merged Duplicate Profile';
      else if (customActionType === 'user_created') actionTitle = 'Created New Profile';
    }

    const timestampIso = new Date().toISOString();
    const entryId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const logPayload: ActivityLogEntry = {
      id: entryId,
      actionType,
      actionTitle,
      timestamp: timestampIso,
      createdAtMillis: Date.now(),
      editor: {
        uid: editor?.uid || editor?.id || 'unknown',
        name: editorName,
        email: editor?.email || editorCanon.email || '',
        role: editorRole,
      },
      targetUser: {
        uid: updatedUser?.uid || updatedUser?.id || oldUser?.uid || oldUser?.id || 'unknown',
        name: targetName,
        email: targetCanon.email || updatedUser?.email || oldUser?.email || '',
        idNumber: targetIdNumber,
        role: targetCanon.role || updatedUser?.role || oldUser?.role || 'Reviewee',
      },
      changes,
      details,
    };

    // 1. Immediately cache locally for fast UI response
    saveToLocalCache(logPayload);

    // 2. Persist to Firestore
    if (firestoreDb) {
      const logsCol = collection(firestoreDb, 'activity_logs');
      await addDoc(logsCol, {
        ...logPayload,
        serverCreatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('Could not record activity log to Firestore, preserved in local cache:', err);
  }
}

/**
 * Subscribes to realtime activity logs from Firestore and merges with local entries.
 */
export function subscribeToActivityLogs(
  onUpdate: (logs: ActivityLogEntry[]) => void,
  maxItems: number = 100
): Unsubscribe {
  const localLogs = getLocalCache();
  if (localLogs.length > 0) {
    onUpdate(localLogs);
  }

  if (!firestoreDb) {
    return () => {};
  }

  try {
    const q = query(
      collection(firestoreDb, 'activity_logs'),
      orderBy('createdAtMillis', 'desc'),
      limit(maxItems)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const firestoreEntries: ActivityLogEntry[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            actionType: data.actionType || 'profile_update',
            actionTitle: data.actionTitle || 'Updated Profile',
            timestamp: data.timestamp || new Date().toISOString(),
            createdAtMillis: data.createdAtMillis || 0,
            editor: data.editor || { uid: '', name: 'System', email: '', role: 'Admin' },
            targetUser: data.targetUser || { uid: '', name: 'Reviewee', email: '', idNumber: '—', role: 'Reviewee' },
            changes: data.changes || [],
            details: data.details,
          };
        });

        // Merge Firestore logs with local logs
        const map = new Map<string, ActivityLogEntry>();
        firestoreEntries.forEach(item => map.set(item.id, item));
        localLogs.forEach(item => {
          if (!map.has(item.id)) {
            map.set(item.id, item);
          }
        });

        const merged = Array.from(map.values()).sort(
          (a, b) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0)
        );

        onUpdate(merged);
      },
      (err) => {
        console.warn('Activity log subscription fallback to local cache:', err);
        onUpdate(getLocalCache());
      }
    );
  } catch (err) {
    console.warn('Error setting up activity log listener:', err);
    return () => {};
  }
}
