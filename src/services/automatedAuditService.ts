import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { getUserRole, isAdmin, isStaff, isSuperAdminEmail } from '../utils/roleUtils';
import { deduplicateUsersByIdNumber, getUserAccountStatus } from './userIdentityResolver';
import { isValidActiveRevieweeWithId, getCanonicalRevieweeId } from '../utils/scoreFieldResolver';
import { parseScores, ScoreRecord } from '../utils/scoreParser';

export interface AuditRevieweeItem {
  id: string;
  name: string;
  email: string;
  idNumber: string;
  role: string;
  accountStatus: string;
  hasValidId: boolean;
  scoreCount: number;
  recentScoreDate?: string;
  issues: string[];
  recommendedAction: string;
  canQuickFix: boolean;
  quickFixType?: 'assign_id' | 'activate_profile' | 'relink_scores';
}

export interface OrphanedScoreItem {
  scoreKey: string;
  studentIdOrName: string;
  scoreFolderId?: string;
  area: string;
  category: string;
  score: number;
  date: string;
  source: string;
  reason: string;
}

export interface AutomatedAuditReportData {
  timestamp: string;
  totalRegisteredUsers: number;
  totalRevieweesRaw: number;
  totalUniqueReviewees: number;
  activeEnrolledReviewees: number;
  pendingReviewees: number;
  droppedReviewees: number;
  revieweesWithMissingId: number;
  
  totalScoreManagementEntries: number;
  uniqueRevieweesWithScores: number;
  unscoredActiveReviewees: number;
  orphanedScoreEntriesCount: number;
  
  parityPercentage: number;
  isFullySynchronized: boolean;
  
  revieweeAuditList: AuditRevieweeItem[];
  missingIdList: AuditRevieweeItem[];
  pendingProfileList: AuditRevieweeItem[];
  unscoredList: AuditRevieweeItem[];
  orphanedScoresList: OrphanedScoreItem[];
  duplicateCollisionsList: AuditRevieweeItem[];
}

/**
 * Runs a comprehensive automated audit comparing Registered Reviewees vs Score Management.
 */
export async function runAutomatedAudit(allUsers: any[] = []): Promise<AutomatedAuditReportData> {
  const now = new Date().toISOString();

  // If allUsers not provided or empty, fetch directly from Firestore
  let rawUsers = allUsers;
  if (!rawUsers || rawUsers.length === 0) {
    if (firestoreDb) {
      try {
        const snap = await getDocs(collection(firestoreDb, 'users'));
        rawUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      } catch (err) {
        console.error('Failed to fetch users for audit:', err);
      }
    }
  }

  // Filter for Reviewees only
  const allRevieweesRaw = (rawUsers || []).filter(u => {
    if (isAdmin(u) || isStaff(u) || isSuperAdminEmail(u?.email)) return false;
    return getUserRole(u) === 'Reviewee';
  });

  const uniqueReviewees = deduplicateUsersByIdNumber(allRevieweesRaw);

  const revieweeAuditList: AuditRevieweeItem[] = [];
  const missingIdList: AuditRevieweeItem[] = [];
  const pendingProfileList: AuditRevieweeItem[] = [];
  const unscoredList: AuditRevieweeItem[] = [];
  const duplicateCollisionsList: AuditRevieweeItem[] = [];
  const orphanedScoresList: OrphanedScoreItem[] = [];

  let totalScoreManagementEntries = 0;
  let uniqueRevieweesWithScores = 0;
  let activeEnrolledCount = 0;
  let pendingCount = 0;
  let droppedCount = 0;
  let missingIdCount = 0;

  // Track ID occurrence to catch collisions
  const idToUsersMap = new Map<string, any[]>();

  uniqueReviewees.forEach(u => {
    const rawId = getCanonicalRevieweeId(u);
    if (rawId) {
      const upper = rawId.toUpperCase();
      const existing = idToUsersMap.get(upper) || [];
      existing.push(u);
      idToUsersMap.set(upper, existing);
    }
  });

  uniqueReviewees.forEach(u => {
    const docId = u.uid || u.id || u.doc_id || '';
    const rawName = `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim();
    const formalName = [u.last_name || u.lastName, u.first_name || u.firstName].filter(Boolean).join(', ') || rawName || u.displayName || u.email || 'Unnamed Reviewee';
    const email = u.email || 'No email';
    const idNumber = getCanonicalRevieweeId(u);
    const hasValidId = Boolean(idNumber);
    const accountStatus = getUserAccountStatus(u);
    const isActive = isValidActiveRevieweeWithId(u);

    // Parse scores
    let scores: ScoreRecord[] = [];
    try {
      scores = parseScores(u);
    } catch {
      scores = [];
    }

    const scoreCount = scores.length;
    totalScoreManagementEntries += scoreCount;
    if (scoreCount > 0) {
      uniqueRevieweesWithScores++;
    }

    const issues: string[] = [];
    let recommendedAction = 'In Sync';
    let canQuickFix = false;
    let quickFixType: 'assign_id' | 'activate_profile' | 'relink_scores' | undefined;

    if (accountStatus === 'dropped') {
      droppedCount++;
      issues.push('Account marked as Dropped / Withdrawn');
      recommendedAction = 'Archived reviewee record';
    } else if (accountStatus === 'pending_profile') {
      pendingCount++;
      issues.push('Profile is unverified / pending enrollment completion');
      recommendedAction = 'Promote to active enrolled status';
      canQuickFix = true;
      quickFixType = 'activate_profile';
    } else if (isActive) {
      activeEnrolledCount++;
    }

    if (!hasValidId && accountStatus !== 'dropped') {
      missingIdCount++;
      issues.push('Missing assigned Student ID Number');
      recommendedAction = 'Assign standardized REV-XXXX student ID';
      canQuickFix = true;
      quickFixType = 'assign_id';
    }

    // Check for ID duplicate collisions
    if (idNumber) {
      const peers = idToUsersMap.get(idNumber.toUpperCase()) || [];
      if (peers.length > 1) {
        issues.push(`ID Collision: ${idNumber} shared with ${peers.length - 1} other record(s)`);
        recommendedAction = 'Resolve duplicate profile merge';
      }
    }

    if (isActive && scoreCount === 0) {
      issues.push('Active reviewee with 0 uploaded examination scores');
      recommendedAction = 'Encode scores via CSV upload or Add Score';
    }

    const auditItem: AuditRevieweeItem = {
      id: docId,
      name: formalName,
      email,
      idNumber: idNumber || '— Missing ID —',
      role: 'Reviewee',
      accountStatus,
      hasValidId,
      scoreCount,
      recentScoreDate: scores[0]?.date || 'None',
      issues,
      recommendedAction,
      canQuickFix,
      quickFixType,
    };

    revieweeAuditList.push(auditItem);

    if (!hasValidId && accountStatus !== 'dropped') {
      missingIdList.push(auditItem);
    }
    if (accountStatus === 'pending_profile') {
      pendingProfileList.push(auditItem);
    }
    if (isActive && scoreCount === 0) {
      unscoredList.push(auditItem);
    }
    if (issues.some(i => i.includes('Collision'))) {
      duplicateCollisionsList.push(auditItem);
    }
  });

  // Check for Orphaned Score records in raw users or assessment collections
  rawUsers.forEach(u => {
    const status = getUserAccountStatus(u);
    if (status === 'dropped' || status === 'deleted' || status === 'merged') {
      try {
        const scores = parseScores(u);
        if (scores.length > 0) {
          scores.forEach(s => {
            orphanedScoresList.push({
              scoreKey: `${u.uid}_${s.area}_${s.date}`,
              studentIdOrName: getCanonicalRevieweeId(u) || u.email || u.uid,
              scoreFolderId: s.scoreFolderId,
              area: s.area,
              category: s.category,
              score: s.score,
              date: s.date,
              source: s.source,
              reason: `Belongs to ${status} reviewee account (${u.email || u.uid})`,
            });
          });
        }
      } catch {}
    }
  });

  // Calculate Parity Percentage
  const targetActive = activeEnrolledCount;
  const targetUniqueWithScores = uniqueRevieweesWithScores;
  const parityPercentage = targetActive > 0 
    ? Math.min(100, Number(((Math.min(targetActive, targetUniqueWithScores) / Math.max(targetActive, targetUniqueWithScores)) * 100).toFixed(1)))
    : 100;

  const isFullySynchronized = missingIdCount === 0 && pendingCount === 0 && (targetActive === uniqueReviewees.length);

  return {
    timestamp: now,
    totalRegisteredUsers: (rawUsers || []).length,
    totalRevieweesRaw: allRevieweesRaw.length,
    totalUniqueReviewees: uniqueReviewees.length,
    activeEnrolledReviewees: activeEnrolledCount,
    pendingReviewees: pendingCount,
    droppedReviewees: droppedCount,
    revieweesWithMissingId: missingIdCount,
    totalScoreManagementEntries,
    uniqueRevieweesWithScores,
    unscoredActiveReviewees: unscoredList.length,
    orphanedScoreEntriesCount: orphanedScoresList.length,
    parityPercentage,
    isFullySynchronized,
    revieweeAuditList,
    missingIdList,
    pendingProfileList,
    unscoredList,
    orphanedScoresList,
    duplicateCollisionsList,
  };
}

/**
 * Assigns a specific ID to an individual reviewee doc in Firestore.
 */
export async function assignRevieweeId(userDocId: string, customId?: string): Promise<string> {
  if (!firestoreDb) throw new Error('Firestore connection is unavailable.');

  let finalId = customId?.trim();
  if (!finalId) {
    const snap = await getDocs(collection(firestoreDb, 'users'));
    let maxNum = 0;
    snap.docs.forEach(d => {
      const id = getCanonicalRevieweeId(d.data());
      const numMatch = id.match(/\d+/);
      if (numMatch) {
        const n = parseInt(numMatch[0], 10);
        if (!isNaN(n) && n > maxNum && n < 99999) maxNum = n;
      }
    });
    maxNum++;
    finalId = `REV-${String(maxNum).padStart(4, '0')}`;
  }

  const updates = {
    seqId: finalId,
    seq_id: finalId,
    idNumber: finalId,
    id_number: finalId,
    accountStatus: 'active',
    status: 'active',
    updatedAt: new Date().toISOString(),
  };

  const userRef = doc(firestoreDb, 'users', userDocId);
  const batch = writeBatch(firestoreDb);
  batch.update(userRef, updates);
  await batch.commit();

  return finalId;
}

/**
 * Promotes a pending reviewee to active enrolled status.
 */
export async function activateRevieweeProfile(userDocId: string): Promise<void> {
  if (!firestoreDb) throw new Error('Firestore connection is unavailable.');

  const updates = {
    accountStatus: 'active',
    status: 'active',
    enrollmentStatus: 'enrolled',
    is_pending: false,
    isPending: false,
    profileCompleted: true,
    updatedAt: new Date().toISOString(),
  };

  const userRef = doc(firestoreDb, 'users', userDocId);
  const batch = writeBatch(firestoreDb);
  batch.update(userRef, updates);
  await batch.commit();
}
