import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { ScoreFolder, RevieweeData } from '../types';
import {
  normalizeScoreFolder,
  normalizeFolderType,
  normalizeFolderPublicationStatus,
  FOLDER_TYPE_LABELS,
  FolderType,
  FolderPublicationStatus,
  ScoreFolderNormalized
} from '../constants/folderTypes';
import { isRevieweeInFolderScope, isFolderMatching } from '../utils/folderScope';
import { logFirestoreError } from '../utils/firestoreErrorHandling';
import { parseScores } from '../utils/scoreParser';

export interface AdminScoreFolderSummary {
  id: string;
  name: string;
  normalizedName: string;
  folderType: FolderType;
  folderTypeLabel: string;
  publicationStatus: FolderPublicationStatus;
  isArchived: boolean;
  isDeleted: boolean;
  schoolScope: 'all' | 'selected';
  selectedSchoolIds: string[];
  selectedSchoolNames: string[];
  branchScope: 'all' | 'selected';
  selectedBranchIds: string[];
  selectedBranchNames: string[];
  startDate?: any;
  endDate?: any;
  description?: string;
  readinessWeight?: number;
  includeInReadiness?: boolean;
  displayOrder?: number;
  createdBy?: string;
  createdByName?: string;
  createdAt?: any;
  updatedBy?: string;
  updatedAt?: any;
  // Sync verification metadata
  foundInCollections: Array<'scoreFolders' | 'score_folders'>;
  isSyncedAcrossCollections: boolean;
  isSyncedInPortal: boolean; // Published, active, not archived/deleted
  syncState: 'synced' | 'hidden' | 'draft' | 'archived' | 'deleted';
  eligibleRevieweesCount: number;
  associatedScoresCount: number;
  scopeSummary: string;
  syncIssues: string[];
  rawFolder: ScoreFolder;
}

export interface FolderSyncVerificationResult {
  folderId: string;
  folderName: string;
  existsInScoreFolders: boolean;
  existsInScoreFoldersSnake: boolean;
  isSyncedAcrossCollections: boolean;
  publicationStatus: FolderPublicationStatus;
  isPublished: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  isLiveInPortal: boolean;
  eligibleRevieweesCount: number;
  matchingScoresCount: number;
  syncDiagnostics: string[];
  verifiedAt: string;
}

export interface AdminIdentifier {
  uid?: string | null;
  email?: string | null;
  role?: string | null;
}

function parseTimeMillis(val: any): number {
  if (!val) return 0;
  if (typeof val === 'object' && typeof val.toMillis === 'function') return val.toMillis();
  if (val instanceof Date) return val.getTime();
  const d = new Date(val).getTime();
  return isNaN(d) ? 0 : d;
}

function formatScopeSummary(folder: ScoreFolderNormalized): string {
  const schoolText = folder.schoolScope === 'selected'
    ? `${folder.selectedSchoolNames?.length || folder.selectedSchoolIds?.length || 0} Schools`
    : 'All Schools';
  const branchText = folder.branchScope === 'selected'
    ? `${folder.selectedBranchNames?.length || folder.selectedBranchIds?.length || 0} Branches`
    : 'All Branches';
  return `${schoolText} • ${branchText}`;
}

/**
 * Normalizes an admin identifier (string UID/email or object)
 */
function extractAdminIdentifier(adminIdentifier?: AdminIdentifier | string | null): { uid?: string; email?: string } {
  if (!adminIdentifier) return {};
  if (typeof adminIdentifier === 'string') {
    if (adminIdentifier.includes('@')) {
      return { email: adminIdentifier.toLowerCase().trim() };
    }
    return { uid: adminIdentifier.trim() };
  }
  return {
    uid: adminIdentifier.uid?.trim(),
    email: adminIdentifier.email?.toLowerCase().trim(),
  };
}

/**
 * Checks if a folder was created by or is associated with the given admin
 */
export function isFolderAssociatedWithAdmin(folder: any, adminIdentifier?: AdminIdentifier | string | null): boolean {
  if (!adminIdentifier) return true; // If no filter provided, matches all folders
  const { uid, email } = extractAdminIdentifier(adminIdentifier);
  if (!uid && !email) return true;

  const createdBy = String(folder.createdBy || folder.created_by || '').trim();
  const updatedBy = String(folder.updatedBy || folder.updated_by || '').trim();
  const adminEmail = String(folder.adminEmail || folder.creatorEmail || '').toLowerCase().trim();
  const adminUid = String(folder.adminUid || folder.creatorUid || '').trim();

  if (uid) {
    if (createdBy === uid || updatedBy === uid || adminUid === uid) return true;
  }
  if (email) {
    if (adminEmail === email || createdBy.toLowerCase() === email || updatedBy.toLowerCase() === email) return true;
  }

  // System or admin default creator labels also associate if caller is admin
  if (createdBy === 'system' || createdBy === 'admin') return true;

  return false;
}

/**
 * Service to fetch all folders associated with the admin account from Firestore,
 * checking both `scoreFolders` and `score_folders` collections and verifying their portal sync state.
 */
export async function fetchAdminFolders(adminIdentifier?: AdminIdentifier | string | null): Promise<AdminScoreFolderSummary[]> {
  if (!firestoreDb) {
    console.warn('[AdminFolderService] Firestore database is not configured.');
    return [];
  }

  try {
    // 1. Fetch from scoreFolders (camelCase) and score_folders (snake_case)
    const [snapCamel, snapSnake, usersSnap] = await Promise.all([
      getDocs(collection(firestoreDb, 'scoreFolders')).catch((err) => {
        logFirestoreError('fetch-scoreFolders-camel', err);
        return { docs: [] };
      }),
      getDocs(collection(firestoreDb, 'score_folders')).catch((err) => {
        logFirestoreError('fetch-scoreFolders-snake', err);
        return { docs: [] };
      }),
      getDocs(collection(firestoreDb, 'users')).catch((err) => {
        logFirestoreError('fetch-users-for-folders', err);
        return { docs: [] };
      }),
    ]);

    const usersList: RevieweeData[] = usersSnap.docs.map((d: any) => ({
      uid: d.id,
      ...d.data(),
    }));

    // Index all folders by document ID
    const mergedFoldersMap = new Map<string, {
      data: any;
      foundIn: Array<'scoreFolders' | 'score_folders'>;
    }>();

    // Ingest camelCase documents
    snapCamel.docs.forEach((docSnap: any) => {
      const id = docSnap.id;
      const raw = { id, ...docSnap.data() };
      mergedFoldersMap.set(id, {
        data: raw,
        foundIn: ['scoreFolders'],
      });
    });

    // Ingest snake_case documents (merge or add)
    snapSnake.docs.forEach((docSnap: any) => {
      const id = docSnap.id;
      const raw = { id, ...docSnap.data() };
      const existing = mergedFoldersMap.get(id);

      if (existing) {
        existing.foundIn.push('score_folders');
        // Choose the record with the latest update or more detailed properties
        const tExisting = parseTimeMillis(existing.data.updatedAt || existing.data.createdAt);
        const tNew = parseTimeMillis(raw.updatedAt || raw.createdAt);
        if (tNew >= tExisting) {
          existing.data = { ...existing.data, ...raw };
        } else {
          existing.data = { ...raw, ...existing.data };
        }
      } else {
        mergedFoldersMap.set(id, {
          data: raw,
          foundIn: ['score_folders'],
        });
      }
    });

    // Compile reviewees and scores for scope / records count calculation
    const reviewees = usersList.filter(
      (u) => String(u.role || (u as any).userRole || '').toLowerCase() === 'reviewee' || !u.role
    );

    const summaries: AdminScoreFolderSummary[] = [];

    mergedFoldersMap.forEach((entry, id) => {
      const normalized = normalizeScoreFolder(entry.data);
      const isAssociated = isFolderAssociatedWithAdmin(normalized, adminIdentifier);

      // If filtering by admin, skip unassociated folders
      if (!isAssociated) return;

      const isSyncedAcrossCollections = entry.foundIn.includes('scoreFolders') && entry.foundIn.includes('score_folders');
      const isLiveInPortal =
        normalized.publicationStatus === 'published' &&
        !normalized.isArchived &&
        !normalized.isDeleted;

      let syncState: AdminScoreFolderSummary['syncState'] = 'synced';
      if (normalized.isDeleted) syncState = 'deleted';
      else if (normalized.isArchived) syncState = 'archived';
      else if (normalized.publicationStatus === 'draft') syncState = 'draft';
      else if (normalized.publicationStatus === 'hidden') syncState = 'hidden';
      else syncState = 'synced';

      // Count eligible reviewees based on folder scope
      const eligibleReviewees = reviewees.filter((r) => isRevieweeInFolderScope(r, normalized as any));

      // Count associated assessment scores across all users
      let matchingScoresCount = 0;
      usersList.forEach((user) => {
        const records = parseScores(user);
        const matched = records.filter((rec) =>
          isFolderMatching(rec.scoreFolderId || (rec as any).folderId, normalized.id, normalized.name)
        );
        matchingScoresCount += matched.length;
      });

      const syncIssues: string[] = [];
      if (!isSyncedAcrossCollections) {
        if (!entry.foundIn.includes('scoreFolders')) {
          syncIssues.push('Folder is missing from "scoreFolders" collection (only in score_folders).');
        }
        if (!entry.foundIn.includes('score_folders')) {
          syncIssues.push('Folder is missing from "score_folders" collection (only in scoreFolders).');
        }
      }
      if (normalized.publicationStatus === 'hidden') {
        syncIssues.push('Status is set to "hidden". Reviewees cannot see this folder in the portal.');
      }
      if (normalized.publicationStatus === 'draft') {
        syncIssues.push('Folder is in "draft" state. Publish it to allow score visibility.');
      }
      if (normalized.isArchived) {
        syncIssues.push('Folder is archived.');
      }
      if (normalized.isDeleted) {
        syncIssues.push('Folder is marked as deleted.');
      }
      if (normalized.schoolScope === 'selected' && (!normalized.selectedSchoolIds || normalized.selectedSchoolIds.length === 0)) {
        syncIssues.push('School scope is set to "selected" but no schools are chosen.');
      }
      if (normalized.branchScope === 'selected' && (!normalized.selectedBranchIds || normalized.selectedBranchIds.length === 0)) {
        syncIssues.push('Branch scope is set to "selected" but no branches are chosen.');
      }

      summaries.push({
        id: normalized.id,
        name: normalized.name || 'Untitled Folder',
        normalizedName: normalized.normalizedName || (normalized.name || '').toLowerCase().trim(),
        folderType: normalized.folderType,
        folderTypeLabel: normalized.folderTypeLabel || FOLDER_TYPE_LABELS[normalized.folderType] || 'Custom',
        publicationStatus: normalized.publicationStatus,
        isArchived: normalized.isArchived,
        isDeleted: normalized.isDeleted,
        schoolScope: (normalized.schoolScope as any) === 'selected' ? 'selected' : 'all',
        selectedSchoolIds: normalized.selectedSchoolIds || [],
        selectedSchoolNames: normalized.selectedSchoolNames || [],
        branchScope: (normalized.branchScope as any) === 'selected' ? 'selected' : 'all',
        selectedBranchIds: normalized.selectedBranchIds || [],
        selectedBranchNames: normalized.selectedBranchNames || [],
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        description: normalized.description,
        readinessWeight: normalized.readinessWeight,
        includeInReadiness: normalized.includeInReadiness,
        displayOrder: normalized.displayOrder,
        createdBy: normalized.createdBy,
        createdByName: normalized.createdBy === 'YD0CnZExOigBV1hs3P6FLCPjbAq1' ? 'Ariel Pesalver (Admin)' : (normalized.createdBy || 'Admin'),
        createdAt: normalized.createdAt,
        updatedBy: normalized.updatedBy,
        updatedAt: normalized.updatedAt,
        foundInCollections: entry.foundIn,
        isSyncedAcrossCollections,
        isSyncedInPortal: isLiveInPortal,
        syncState,
        eligibleRevieweesCount: eligibleReviewees.length,
        associatedScoresCount: matchingScoresCount,
        scopeSummary: formatScopeSummary(normalized),
        syncIssues,
        rawFolder: normalized as unknown as ScoreFolder,
      });
    });

    // Sort: live synced first, then by createdAt desc
    summaries.sort((a, b) => {
      const timeA = parseTimeMillis(a.updatedAt || a.createdAt);
      const timeB = parseTimeMillis(b.updatedAt || b.createdAt);
      return timeB - timeA;
    });

    return summaries;
  } catch (err) {
    console.error('[AdminFolderService] Error fetching admin folders:', err);
    throw err;
  }
}

/**
 * Subscribes to real-time updates for folders in Firestore (both scoreFolders and score_folders)
 */
export function subscribeToAdminFolders(
  callback: (folders: AdminScoreFolderSummary[]) => void,
  adminIdentifier?: AdminIdentifier | string | null,
  onError?: (err: any) => void
): Unsubscribe {
  if (!firestoreDb) {
    return () => {};
  }

  let camelDocs: any[] = [];
  let snakeDocs: any[] = [];
  let usersList: any[] = [];

  const triggerUpdate = () => {
    try {
      const mergedFoldersMap = new Map<string, {
        data: any;
        foundIn: Array<'scoreFolders' | 'score_folders'>;
      }>();

      camelDocs.forEach((docSnap) => {
        const id = docSnap.id;
        mergedFoldersMap.set(id, {
          data: { id, ...docSnap.data() },
          foundIn: ['scoreFolders'],
        });
      });

      snakeDocs.forEach((docSnap) => {
        const id = docSnap.id;
        const raw = { id, ...docSnap.data() };
        const existing = mergedFoldersMap.get(id);
        if (existing) {
          existing.foundIn.push('score_folders');
          const tExisting = parseTimeMillis(existing.data.updatedAt || existing.data.createdAt);
          const tNew = parseTimeMillis(raw.updatedAt || raw.createdAt);
          if (tNew >= tExisting) {
            existing.data = { ...existing.data, ...raw };
          }
        } else {
          mergedFoldersMap.set(id, {
            data: raw,
            foundIn: ['score_folders'],
          });
        }
      });

      const reviewees = usersList.filter(
        (u) => String(u.role || (u as any).userRole || '').toLowerCase() === 'reviewee' || !u.role
      );

      const summaries: AdminScoreFolderSummary[] = [];

      mergedFoldersMap.forEach((entry) => {
        const normalized = normalizeScoreFolder(entry.data);
        if (!isFolderAssociatedWithAdmin(normalized, adminIdentifier)) return;

        const isSyncedAcrossCollections = entry.foundIn.includes('scoreFolders') && entry.foundIn.includes('score_folders');
        const isLiveInPortal =
          normalized.publicationStatus === 'published' &&
          !normalized.isArchived &&
          !normalized.isDeleted;

        let syncState: AdminScoreFolderSummary['syncState'] = 'synced';
        if (normalized.isDeleted) syncState = 'deleted';
        else if (normalized.isArchived) syncState = 'archived';
        else if (normalized.publicationStatus === 'draft') syncState = 'draft';
        else if (normalized.publicationStatus === 'hidden') syncState = 'hidden';

        const eligibleReviewees = reviewees.filter((r) => isRevieweeInFolderScope(r, normalized as any));

        let matchingScoresCount = 0;
        usersList.forEach((user) => {
          const records = parseScores(user);
          const matched = records.filter((rec) =>
            isFolderMatching(rec.scoreFolderId || (rec as any).folderId, normalized.id, normalized.name)
          );
          matchingScoresCount += matched.length;
        });

        const syncIssues: string[] = [];
        if (!isSyncedAcrossCollections) {
          if (!entry.foundIn.includes('scoreFolders')) {
            syncIssues.push('Folder missing from "scoreFolders" collection.');
          }
          if (!entry.foundIn.includes('score_folders')) {
            syncIssues.push('Folder missing from "score_folders" collection.');
          }
        }
        if (normalized.publicationStatus === 'hidden') {
          syncIssues.push('Status is hidden from reviewees.');
        }
        if (normalized.publicationStatus === 'draft') {
          syncIssues.push('Folder is draft (not published).');
        }

        summaries.push({
          id: normalized.id,
          name: normalized.name || 'Untitled Folder',
          normalizedName: normalized.normalizedName || (normalized.name || '').toLowerCase().trim(),
          folderType: normalized.folderType,
          folderTypeLabel: normalized.folderTypeLabel || FOLDER_TYPE_LABELS[normalized.folderType] || 'Custom',
          publicationStatus: normalized.publicationStatus,
          isArchived: normalized.isArchived,
          isDeleted: normalized.isDeleted,
          schoolScope: (normalized.schoolScope as any) === 'selected' ? 'selected' : 'all',
          selectedSchoolIds: normalized.selectedSchoolIds || [],
          selectedSchoolNames: normalized.selectedSchoolNames || [],
          branchScope: (normalized.branchScope as any) === 'selected' ? 'selected' : 'all',
          selectedBranchIds: normalized.selectedBranchIds || [],
          selectedBranchNames: normalized.selectedBranchNames || [],
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          description: normalized.description,
          readinessWeight: normalized.readinessWeight,
          includeInReadiness: normalized.includeInReadiness,
          displayOrder: normalized.displayOrder,
          createdBy: normalized.createdBy,
          createdByName: normalized.createdBy === 'YD0CnZExOigBV1hs3P6FLCPjbAq1' ? 'Ariel Pesalver (Admin)' : (normalized.createdBy || 'Admin'),
          createdAt: normalized.createdAt,
          updatedBy: normalized.updatedBy,
          updatedAt: normalized.updatedAt,
          foundInCollections: entry.foundIn,
          isSyncedAcrossCollections,
          isSyncedInPortal: isLiveInPortal,
          syncState,
          eligibleRevieweesCount: eligibleReviewees.length,
          associatedScoresCount: matchingScoresCount,
          scopeSummary: formatScopeSummary(normalized),
          syncIssues,
          rawFolder: normalized as unknown as ScoreFolder,
        });
      });

      summaries.sort((a, b) => {
        const timeA = parseTimeMillis(a.updatedAt || a.createdAt);
        const timeB = parseTimeMillis(b.updatedAt || b.createdAt);
        return timeB - timeA;
      });

      callback(summaries);
    } catch (err) {
      console.error('[AdminFolderService] Snapshot merge processing error:', err);
      if (onError) onError(err);
    }
  };

  const unsubCamel = onSnapshot(
    collection(firestoreDb, 'scoreFolders'),
    (snap) => {
      camelDocs = snap.docs;
      triggerUpdate();
    },
    (err) => {
      logFirestoreError('scoreFolders-realtime-sub', err);
      if (onError) onError(err);
    }
  );

  const unsubSnake = onSnapshot(
    collection(firestoreDb, 'score_folders'),
    (snap) => {
      snakeDocs = snap.docs;
      triggerUpdate();
    },
    (err) => {
      logFirestoreError('score_folders-realtime-sub', err);
      if (onError) onError(err);
    }
  );

  const unsubUsers = onSnapshot(
    collection(firestoreDb, 'users'),
    (snap) => {
      usersList = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      triggerUpdate();
    },
    (err) => {
      logFirestoreError('users-realtime-sub', err);
    }
  );

  return () => {
    unsubCamel();
    unsubSnake();
    unsubUsers();
  };
}

/**
 * Runs a comprehensive verification for a specific folder to verify it is correctly synced in Firestore and the portal
 */
export async function verifyFolderPortalSync(folderId: string): Promise<FolderSyncVerificationResult> {
  if (!firestoreDb) {
    throw new Error('Firestore is not available');
  }

  const [docCamelSnap, docSnakeSnap, usersSnap] = await Promise.all([
    getDoc(doc(firestoreDb, 'scoreFolders', folderId)),
    getDoc(doc(firestoreDb, 'score_folders', folderId)),
    getDocs(collection(firestoreDb, 'users')),
  ]);

  const existsCamel = docCamelSnap.exists();
  const existsSnake = docSnakeSnap.exists();

  if (!existsCamel && !existsSnake) {
    throw new Error(`Folder with ID "${folderId}" was not found in Firestore.`);
  }

  const rawData = existsSnake ? { ...docSnakeSnap.data(), ...docCamelSnap.data() } : docCamelSnap.data();
  const normalized = normalizeScoreFolder({ id: folderId, ...rawData });

  const users: any[] = usersSnap.docs.map((d: any) => ({ uid: d.id, ...d.data() }));
  const reviewees = users.filter((u: any) => String(u.role || u.userRole || '').toLowerCase() === 'reviewee' || !u.role);
  const eligibleReviewees = reviewees.filter((r) => isRevieweeInFolderScope(r, normalized as any));

  let matchingScoresCount = 0;
  users.forEach((user) => {
    const records = parseScores(user);
    const matched = records.filter((rec) =>
      isFolderMatching(rec.scoreFolderId || (rec as any).folderId, normalized.id, normalized.name)
    );
    matchingScoresCount += matched.length;
  });

  const diagnostics: string[] = [];
  if (existsCamel && existsSnake) {
    diagnostics.push('Synchronized in both "scoreFolders" and "score_folders" collections.');
  } else if (existsCamel && !existsSnake) {
    diagnostics.push('Present in "scoreFolders", but missing from "score_folders".');
  } else {
    diagnostics.push('Present in "score_folders", but missing from "scoreFolders".');
  }

  if (normalized.publicationStatus === 'published') {
    diagnostics.push('Publication status is "published" — visible to reviewees matching scope.');
  } else {
    diagnostics.push(`Publication status is "${normalized.publicationStatus}" — hidden from reviewees.`);
  }

  if (normalized.isArchived) {
    diagnostics.push('Folder is archived — will not appear on reviewee dashboards.');
  }
  if (normalized.isDeleted) {
    diagnostics.push('Folder is soft-deleted.');
  }

  diagnostics.push(`${eligibleReviewees.length} reviewees currently match the school and branch scope.`);
  diagnostics.push(`${matchingScoresCount} assessment scores recorded in this folder.`);

  const isLiveInPortal =
    normalized.publicationStatus === 'published' &&
    !normalized.isArchived &&
    !normalized.isDeleted;

  return {
    folderId,
    folderName: normalized.name,
    existsInScoreFolders: existsCamel,
    existsInScoreFoldersSnake: existsSnake,
    isSyncedAcrossCollections: existsCamel && existsSnake,
    publicationStatus: normalized.publicationStatus,
    isPublished: normalized.publicationStatus === 'published',
    isArchived: normalized.isArchived,
    isDeleted: normalized.isDeleted,
    isLiveInPortal,
    eligibleRevieweesCount: eligibleReviewees.length,
    matchingScoresCount,
    syncDiagnostics: diagnostics,
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Ensures a folder is mirrored and synchronized across both `scoreFolders` and `score_folders` collections
 */
export async function syncFolderAcrossCollections(folderId: string, adminUser?: any): Promise<void> {
  if (!firestoreDb) return;

  const [docCamelSnap, docSnakeSnap] = await Promise.all([
    getDoc(doc(firestoreDb, 'scoreFolders', folderId)),
    getDoc(doc(firestoreDb, 'score_folders', folderId)),
  ]);

  if (!docCamelSnap.exists() && !docSnakeSnap.exists()) {
    throw new Error(`Folder with ID "${folderId}" does not exist in any collection.`);
  }

  const merged = {
    ...(docSnakeSnap.exists() ? docSnakeSnap.data() : {}),
    ...(docCamelSnap.exists() ? docCamelSnap.data() : {}),
    id: folderId,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUser?.uid || adminUser?.id || 'admin',
  };

  await Promise.all([
    setDoc(doc(firestoreDb, 'scoreFolders', folderId), merged, { merge: true }),
    setDoc(doc(firestoreDb, 'score_folders', folderId), merged, { merge: true }),
  ]);
}

/**
 * Synchronizes all folders in Firestore so that any folder in `score_folders` is copied into `scoreFolders` and vice-versa
 */
export async function syncAllFoldersAcrossCollections(adminUser?: any): Promise<{ syncedCount: number }> {
  if (!firestoreDb) return { syncedCount: 0 };

  const [snapCamel, snapSnake] = await Promise.all([
    getDocs(collection(firestoreDb, 'scoreFolders')),
    getDocs(collection(firestoreDb, 'score_folders')),
  ]);

  const allMap = new Map<string, any>();

  snapSnake.docs.forEach((d) => {
    allMap.set(d.id, { id: d.id, ...d.data() });
  });

  snapCamel.docs.forEach((d) => {
    const existing = allMap.get(d.id);
    if (existing) {
      allMap.set(d.id, { ...existing, ...d.data(), id: d.id });
    } else {
      allMap.set(d.id, { id: d.id, ...d.data() });
    }
  });

  let syncedCount = 0;
  const syncPromises: Promise<any>[] = [];

  allMap.forEach((folderData, id) => {
    const payload = {
      ...folderData,
      id,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUser?.uid || adminUser?.id || 'admin-sync',
    };
    syncPromises.push(setDoc(doc(firestoreDb, 'scoreFolders', id), payload, { merge: true }));
    syncPromises.push(setDoc(doc(firestoreDb, 'score_folders', id), payload, { merge: true }));
    syncedCount++;
  });

  await Promise.all(syncPromises);
  return { syncedCount };
}

/**
 * Changes publication status of a folder in both collections
 */
export async function setFolderPublicationStatus(
  folderId: string,
  status: 'published' | 'hidden' | 'draft',
  adminUser?: any
): Promise<void> {
  if (!firestoreDb) return;

  const updatePayload = {
    publicationStatus: status,
    isPublished: status === 'published',
    updatedAt: new Date().toISOString(),
    updatedBy: adminUser?.uid || adminUser?.id || 'admin',
  };

  await Promise.all([
    updateDoc(doc(firestoreDb, 'scoreFolders', folderId), updatePayload).catch(() =>
      setDoc(doc(firestoreDb, 'scoreFolders', folderId), updatePayload, { merge: true })
    ),
    updateDoc(doc(firestoreDb, 'score_folders', folderId), updatePayload).catch(() =>
      setDoc(doc(firestoreDb, 'score_folders', folderId), updatePayload, { merge: true })
    ),
  ]);
}

/**
 * Creates a new score folder in Firestore in both collections and returns the created folder
 */
export async function createAdminScoreFolder(
  folderData: {
    name: string;
    folderType: FolderType;
    publicationStatus?: FolderPublicationStatus;
    schoolScope?: 'all' | 'selected';
    selectedSchoolIds?: string[];
    selectedSchoolNames?: string[];
    branchScope?: 'all' | 'selected';
    selectedBranchIds?: string[];
    selectedBranchNames?: string[];
    description?: string;
    startDate?: string;
    endDate?: string | null;
    includeInReadiness?: boolean;
    readinessWeight?: number;
  },
  adminUser?: any
): Promise<ScoreFolder> {
  if (!firestoreDb) throw new Error('Firestore is not configured.');

  const folderId = `sf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const creatorUid = adminUser?.uid || adminUser?.id || 'YD0CnZExOigBV1hs3P6FLCPjbAq1';
  const now = new Date().toISOString();

  const newFolder: ScoreFolder = {
    id: folderId,
    name: folderData.name.trim(),
    normalizedName: folderData.name.toLowerCase().trim(),
    type: folderData.folderType,
    folderType: folderData.folderType,
    description: folderData.description || '',
    publicationStatus: (folderData.publicationStatus || 'published') as any,
    isArchived: false,
    isDeleted: false,
    schoolScope: folderData.schoolScope || 'all',
    selectedSchoolIds: folderData.selectedSchoolIds || [],
    selectedSchoolNames: folderData.selectedSchoolNames || [],
    branchScope: folderData.branchScope || 'all',
    selectedBranchIds: folderData.selectedBranchIds || [],
    selectedBranchNames: folderData.selectedBranchNames || [],
    startDate: folderData.startDate || now,
    endDate: folderData.endDate || null,
    includeInReadiness: folderData.includeInReadiness ?? true,
    readinessWeight: folderData.readinessWeight ?? 10,
    displayOrder: 1,
    createdBy: creatorUid,
    createdAt: now,
    updatedBy: creatorUid,
    updatedAt: now,
  };

  // Write to both scoreFolders and score_folders
  await Promise.all([
    setDoc(doc(firestoreDb, 'scoreFolders', folderId), newFolder),
    setDoc(doc(firestoreDb, 'score_folders', folderId), newFolder),
  ]);

  return newFolder;
}
