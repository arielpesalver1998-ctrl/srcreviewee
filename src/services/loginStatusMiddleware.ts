import { doc, updateDoc } from 'firebase/firestore';
import { initFirebaseClient } from '../utils/firebaseClient';
import { User } from 'firebase/auth';

export interface LoginStatusCheckResult {
  shouldForcePending: boolean;
  reason?: string;
  updatedDocData?: Record<string, any>;
}

/**
 * Status-check middleware invoked during user authentication/login.
 * 
 * If a user logs in with an email found in the registry but has:
 * - A 'merged' status (or mergedIntoUid tombstone without a canonical active ID)
 * - An 'unknown' status or 'UNKNOWN USER' name placeholder
 * - An incomplete reviewee profile lacking an assigned Sequence ID ('seqId' / 'seq_id')
 * 
 * This middleware forces them into the 'pending' flow by:
 * 1. Setting their status & accountStatus to 'pending_profile' in Firestore.
 * 2. Marking profileCompleted = false.
 * 3. Instructing the auth router to redirect them to the ProfileSetup component.
 */
export async function runLoginStatusCheckMiddleware(
  firebaseUser: User,
  userData: any
): Promise<LoginStatusCheckResult> {
  if (!userData || !firebaseUser) {
    return { shouldForcePending: true, reason: 'no_user_data' };
  }

  const role = String(userData.role || userData.userRole || '').toLowerCase();
  const isAdminOrStaff = role === 'admin' || role === 'staff' || userData.isAdmin || userData.isStaff;

  // Admins and Staff are exempt from student profile-setup flow unless explicitly invalid
  if (isAdminOrStaff) {
    return { shouldForcePending: false };
  }

  const rawStatus = String(userData.status || userData.accountStatus || '').trim().toLowerCase();
  const rawAccountStatus = String(userData.accountStatus || '').trim().toLowerCase();

  const seqId = String(
    userData.seq_id ??
    userData.seqId ??
    userData.id_number ??
    userData.idNumber ??
    userData.srcId ??
    userData.src_id ??
    ''
  ).trim();

  const hasValidSeqId = Boolean(
    seqId &&
    seqId !== '—' &&
    seqId !== '-' &&
    seqId.toUpperCase() !== 'N/A' &&
    seqId.toUpperCase() !== 'NONE'
  );

  const firstName = String(userData.firstName ?? userData.first_name ?? '').trim();
  const lastName = String(userData.lastName ?? userData.last_name ?? '').trim();
  const fullName = String(userData.fullName ?? userData.full_name ?? userData.displayName ?? userData.name ?? '').trim();

  const isUnknownName =
    (!firstName && !lastName) ||
    fullName.toUpperCase() === 'UNKNOWN USER' ||
    fullName.toUpperCase() === 'UNNAMED USER' ||
    fullName === ',' ||
    fullName === ', ';

  const isMergedStatus = rawStatus === 'merged' || rawAccountStatus === 'merged';
  const isUnknownStatus = rawStatus === 'unknown' || rawAccountStatus === 'unknown';
  const isPendingStatus = rawStatus === 'pending_profile' || rawStatus === 'pending' || rawStatus === 'unlinked';
  const isIncompleteProfile = userData.profileCompleted === false;

  // Check if user requires the pending / ProfileSetup flow:
  // 1. Has 'merged' or 'unknown' status
  // 2. Has 'UNKNOWN USER' name or incomplete profile without a verified assigned Sequence ID
  // 3. Has pending status
  const requiresPendingSetup =
    isMergedStatus ||
    isUnknownStatus ||
    isPendingStatus ||
    (isUnknownName && !hasValidSeqId) ||
    (isIncompleteProfile && !hasValidSeqId);

  if (requiresPendingSetup) {
    console.warn(`[Login Status Middleware] User ${userData.email || firebaseUser.email} flagged with status '${rawStatus}' / isUnknownName=${isUnknownName} / hasSeqId=${hasValidSeqId}. Enforcing 'pending' profile setup flow.`);

    try {
      const { db } = await initFirebaseClient();
      if (db && firebaseUser.uid) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const patchData = {
          status: 'pending_profile',
          accountStatus: 'pending_profile',
          profileCompleted: false,
          updatedAt: new Date().toISOString(),
        };

        await updateDoc(userDocRef, patchData);
        console.log(`[Login Status Middleware] Successfully updated user ${firebaseUser.uid} Firestore status to 'pending_profile'.`);
      }
    } catch (err) {
      console.error('[Login Status Middleware] Failed to update user status in Firestore:', err);
    }

    return {
      shouldForcePending: true,
      reason: isMergedStatus ? 'merged_status' : isUnknownStatus ? 'unknown_status' : isUnknownName ? 'unknown_name' : 'incomplete_profile',
    };
  }

  return { shouldForcePending: false };
}
