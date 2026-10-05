import { getUserRole, isAdmin, isStaff, isSuperAdminEmail } from './roleUtils';
import { deduplicateUsersByIdNumber, getUserAccountStatus } from '../services/userIdentityResolver';

/**
 * Normalizes user account status string with whitespace trimming and lowercase canonicalization.
 */
export function normalizeStatus(value?: string | null): string {
  const clean = String(value ?? '').trim().toLowerCase();
  if (
    clean === 'active' ||
    clean === 'enrolled' ||
    clean === 'verified'
  ) {
    return 'active';
  }
  if (
    clean === 'pending_profile' ||
    clean === 'pending' ||
    clean === 'for approval' ||
    clean === 'unverified' ||
    clean === 'pending_verification' ||
    clean === 'unlinked' ||
    clean === 'incomplete'
  ) {
    return 'pending_profile';
  }
  if (
    clean === 'dropped' ||
    clean === 'withdrawn' ||
    clean === 'inactive' ||
    clean === 'rejected' ||
    clean === 'archived'
  ) {
    return 'dropped';
  }
  if (
    clean === 'merged' ||
    clean === 'deleted'
  ) {
    return clean;
  }
  return clean || 'pending_profile';
}

/**
 * Normalizes user role string with whitespace trimming and administrative exclusion.
 */
export function normalizeRole(value?: string | null): string {
  const clean = String(value ?? '').trim().toLowerCase();
  if (
    clean === 'admin' ||
    clean === 'administrator' ||
    clean === 'superadmin' ||
    clean === 'super_admin'
  ) {
    return 'admin';
  }
  if (
    clean === 'staff' ||
    clean === 'instructor' ||
    clean === 'teacher' ||
    clean === 'coordinator'
  ) {
    return 'staff';
  }
  if (clean === 'reviewee' || clean === 'student' || clean === 'enrollee') {
    return 'reviewee';
  }
  return clean || 'reviewee';
}

/**
 * Validates whether an ID string is a legitimate Reviewee/SRC sequence ID.
 * Explicitly rejects null, undefined, blank, placeholder strings, and raw Firebase Auth UIDs.
 */
export function isValidRevieweeId(value?: unknown): boolean {
  const rawId = String(value ?? '').trim();
  if (!rawId) return false;

  const invalid = new Set([
    'n/a',
    'na',
    'none',
    'null',
    'undefined',
    'temp',
    'pending',
    'no id',
    'no id assigned',
    '-',
    '—',
    '— missing id —',
  ]);

  if (invalid.has(rawId.toLowerCase())) {
    return false;
  }

  // Reject legacy REV- IDs (e.g. REV-0227) as non-official SRC Reviewee IDs
  if (rawId.toUpperCase().startsWith('REV')) {
    return false;
  }

  // A 20+ char alphanumeric string with no spaces/hyphens is a raw Firebase Auth UID, not an assigned student ID
  const isRawFirebaseUid =
    rawId.length >= 20 &&
    !rawId.includes(' ') &&
    !rawId.includes('-') &&
    !rawId.startsWith('SRC') &&
    !rawId.startsWith('STF') &&
    !rawId.startsWith('ADM') &&
    !rawId.startsWith('REV');

  if (isRawFirebaseUid) {
    return false;
  }

  return true;
}

/**
 * Extracts the canonical Reviewee ID from all known database aliases.
 */
export function getCanonicalRevieweeId(u: any): string {
  if (!u || typeof u !== 'object') return '';
  const rawId = String(
    u.seqId ??
    u.seq_id ??
    u.idNumber ??
    u.id_number ??
    u.studentId ??
    u.student_id ??
    u.revieweeId ??
    u.reviewee_id ??
    u.srcId ??
    u.src_id ??
    ''
  ).trim();

  return isValidRevieweeId(rawId) ? rawId : '';
}

/**
 * ONE CANONICAL ACTIVE REVIEWEE RULE:
 * A user is an ACTIVE REVIEWEE if and only if ALL conditions are satisfied:
 *  1. role === "reviewee" (never admin, staff, instructor, or superadmin)
 *  2. canonicalStatus === "active" (resolved by account status & profile completion)
 *  3. hasValidRevieweeId === true
 *  4. isNotDeleted === true
 *  5. isNotMergedDuplicate === true
 */
export function isCanonicalActiveReviewee(user: any): boolean {
  if (!user || typeof user !== 'object') return false;

  // 1. Role Check: Must strictly normalize to 'reviewee'
  if (isAdmin(user) || isStaff(user) || isSuperAdminEmail(user?.email)) {
    return false;
  }
  const role = normalizeRole(user.role || user.userRole || user.user_type || user.roleType || getUserRole(user));
  if (role !== 'reviewee') {
    return false;
  }

  // 2. Soft-deleted / Merged check
  if (
    user.deletedAt ||
    user.isDeleted === true ||
    user.deleted === true ||
    user.is_deleted === true ||
    user.mergedInto ||
    user.merged_into ||
    user.isMerged === true ||
    user.is_merged === true
  ) {
    return false;
  }

  // 3. Status Check: Must resolve to 'active'
  const resolvedStatus = getUserAccountStatus(user);
  if (resolvedStatus !== 'active') {
    return false;
  }

  // 4. ID Check: Must possess a valid Reviewee ID
  const idNum = getCanonicalRevieweeId(user);
  if (!idNum) {
    return false;
  }

  return true;
}

/**
 * Alias to maintain full backwards-compatibility with existing scoreFieldResolver imports.
 */
export const isValidActiveRevieweeWithId = isCanonicalActiveReviewee;

/**
 * Returns the deduplicated list of canonical Active Reviewees from any input users array.
 */
export function getCanonicalActiveReviewees(users: any[]): any[] {
  if (!Array.isArray(users) || users.length === 0) return [];
  const uniqueUsers = deduplicateUsersByIdNumber(users);
  return uniqueUsers.filter(isCanonicalActiveReviewee);
}

/**
 * Returns the exact count of canonical Active Reviewees.
 */
export function getCanonicalActiveRevieweeCount(users: any[]): number {
  return getCanonicalActiveReviewees(users).length;
}
