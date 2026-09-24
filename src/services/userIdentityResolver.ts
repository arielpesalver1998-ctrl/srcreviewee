import { getUserRole } from '../utils/roleUtils';
import { normalizeNameForComparison } from '../utils/nameNormalization';

export type CanonicalUserIdentity = {
  userDocId: string;
  firebaseUid: string;
  idNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: string;
  school: string;
  branch: string;
  profilePicture?: string;
  isArchived?: boolean;
};

export const INVALID_MIDDLE_NAME_VALUES = new Set([
  "",
  "blank",
  "null",
  "undefined",
  "n/a",
  "none",
  "na",
  "-",
  "—",
  "[object object]",
]);

export function cleanOptionalName(value: unknown): string {
  const cleaned = String(value ?? "").trim();
  if (INVALID_MIDDLE_NAME_VALUES.has(cleaned.toLowerCase())) {
    return "";
  }
  return cleaned;
}

export function formatMiddleName(value: unknown): string {
  const cleaned = cleanOptionalName(value);
  return cleaned || "-";
}

export function normalizeForSort(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase();
}

export function normalizeIdNumber(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function canonicalizeIdNumber(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value).trim();
  if (!s || s === "—" || s === "-" || s.toLowerCase() === "n/a" || s.toLowerCase() === "none") {
    return "";
  }
  return s.toUpperCase().replace(/\s+/g, " ");
}

export function formatFullName({
  firstName,
  middleName,
  lastName,
}: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
}): string {
  const first = String(firstName || "").trim().toUpperCase();
  const middle = cleanOptionalName(middleName).toUpperCase();
  const last = String(lastName || "").trim().toUpperCase();

  const middleInitial = middle ? `${middle.charAt(0)}.` : "";
  return [
    first,
    middleInitial,
    last,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function formatFormalName({
  firstName,
  middleName,
  lastName,
  suffix,
  fallbackFullName,
}: {
  firstName?: unknown;
  middleName?: unknown;
  lastName?: unknown;
  suffix?: unknown;
  fallbackFullName?: unknown;
}): string {
  const first = String(firstName ?? "").trim().toUpperCase();
  const middle = cleanOptionalName(middleName).toUpperCase();
  const last = String(lastName ?? "").trim().toUpperCase();
  const suf = String(suffix ?? "").trim().toUpperCase();
  const fallback = String(fallbackFullName ?? "").trim().toUpperCase();

  const middleInitial = middle ? `${middle.charAt(0)}.` : "";
  const lastWithSuffix = [last, suf].filter(Boolean).join(" ");

  if (lastWithSuffix && first) {
    return `${lastWithSuffix}, ${first}${middleInitial ? ` ${middleInitial}` : ""}`
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }
  if (lastWithSuffix) {
    return lastWithSuffix.toUpperCase();
  }
  if (first) {
    return `${first}${middleInitial ? ` ${middleInitial}` : ""}`.replace(/\s+/g, " ").trim().toUpperCase();
  }
  if (fallback) {
    const cleanFallback = fallback
      .replace(/\b(BLANK|NULL|UNDEFINED|N\/A|NONE|\[OBJECT OBJECT\])\b/gi, "")
      .replace(/,\s*-?\s*\.?$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return (cleanFallback || "UNKNOWN USER").toUpperCase();
  }
  return "UNKNOWN USER";
}

export function compareUsersAlphabetically(a: any, b: any): number {
  const aNorm = resolveCanonicalUserIdentity(a);
  const bNorm = resolveCanonicalUserIdentity(b);

  const lastNameCompare = normalizeForSort(aNorm.lastName).localeCompare(
    normalizeForSort(bNorm.lastName)
  );
  if (lastNameCompare !== 0) return lastNameCompare;

  const firstNameCompare = normalizeForSort(aNorm.firstName).localeCompare(
    normalizeForSort(bNorm.firstName)
  );
  if (firstNameCompare !== 0) return firstNameCompare;

  const middleNameCompare = normalizeForSort(cleanOptionalName(aNorm.middleName)).localeCompare(
    normalizeForSort(cleanOptionalName(bNorm.middleName))
  );
  if (middleNameCompare !== 0) return middleNameCompare;

  return normalizeForSort(aNorm.idNumber || aNorm.userDocId || a?.doc_id || a?.uid).localeCompare(
    normalizeForSort(bNorm.idNumber || bNorm.userDocId || b?.doc_id || b?.uid)
  );
}

export type UserAccountStatus = 'active' | 'dropped' | 'pending_profile' | 'merged' | 'deleted';

export function getUserAccountStatus(user: any): UserAccountStatus {
  if (!user) return 'deleted';

  const rawStatus = String(user.accountStatus || user.status || '').trim().toLowerCase();

  if (rawStatus === 'merged' || user.mergedIntoUid) return 'merged';
  if (rawStatus === 'deleted' || user.isDeleted || user.deleted || user.is_deleted) return 'deleted';
  if (rawStatus === 'dropped' || rawStatus === 'drop') return 'dropped';
  if (rawStatus === 'pending_profile' || rawStatus === 'pending') return 'pending_profile';

  const role = String(user.role || user.role_name || user.userRole || '').toLowerCase();
  const isAdminOrStaff = role === 'admin' || role === 'staff' || user.isAdmin || user.isStaff;

  if (isAdminOrStaff) {
    const hasName = Boolean(user.firstName || user.first_name || user.lastName || user.last_name || user.displayName || user.name);
    const hasEmail = Boolean(user.email);
    if (!hasName && !hasEmail) return 'pending_profile';
    return (rawStatus === 'active' || rawStatus === '') ? 'active' : 'pending_profile';
  }

  // For Reviewees:
  // Must satisfy profile completion AND have a valid reviewee ID and valid name
  if (user.profileCompleted === false) {
    return 'pending_profile';
  }

  const isRevieweeValid = isValidRevieweeRecord(user);
  if (!isRevieweeValid) {
    // If it lacks a valid sequence ID or valid name, classify as pending_profile instead of active
    return 'pending_profile';
  }

  if (rawStatus === 'active' || rawStatus === '') {
    return 'active';
  }

  return 'pending_profile';
}

export function isValidRevieweeRecord(user: any): boolean {
  if (!user) return false;

  // Account status check
  const status = String(user.accountStatus || user.status || "").toLowerCase();
  if (
    status === "merged" ||
    status === "deleted" ||
    status === "pending_profile" ||
    status === "pending" ||
    user.isDeleted ||
    user.deleted ||
    user.is_deleted
  ) {
    return false;
  }

  if (user.profileCompleted === false) {
    return false;
  }

  const idNumber = String(
    user.seq_id ??
    user.seqId ??
    user.id_number ??
    user.idNumber ??
    user.student_id ??
    user.studentId ??
    user.srcId ??
    ""
  ).trim();

  const firstName = String(user.first_name ?? user.firstName ?? "").trim();
  const middleName = String(user.middle_name ?? user.middleName ?? "").trim();
  const lastName = String(user.last_name ?? user.lastName ?? "").trim();
  const fullName = String(user.full_name ?? user.fullName ?? user.displayName ?? user.name ?? "").trim();

  const hasId = Boolean(idNumber && idNumber !== "—" && idNumber !== "-" && idNumber.toUpperCase() !== "N/A" && idNumber.toUpperCase() !== "NONE");

  // Check if formatted name is comma-only, blank, or placeholder
  const isCommaOnlyName =
    (!lastName && !firstName && (!fullName || fullName === "," || fullName === ", " || fullName.trim() === ",")) ||
    fullName.trim() === "," ||
    fullName.trim() === ", " ||
    fullName.toUpperCase() === "UNKNOWN USER" ||
    fullName.toUpperCase() === "UNNAMED USER";

  const hasName = Boolean((firstName || lastName || fullName) && !isCommaOnlyName);

  // A valid reviewee record MUST have both a non-blank ID and a valid (non-comma-only) name
  return Boolean(hasId && hasName && !isCommaOnlyName);
}

export function isValidUserRecord(user: any): boolean {
  if (!user) return false;

  const status = String(user.accountStatus || user.status || "").toLowerCase();
  if (
    status === "merged" ||
    status === "deleted" ||
    status === "pending_profile" ||
    status === "pending" ||
    user.isDeleted ||
    user.deleted ||
    user.is_deleted
  ) {
    return false;
  }

  const role = String(user.role || user.role_name || "").toLowerCase();
  const isReviewee = role === "reviewee" || role === "student" || (!role && !user.isAdmin && !user.isStaff);

  if (isReviewee) {
    return isValidRevieweeRecord(user);
  }

  const firstName = String(user.first_name ?? user.firstName ?? "").trim();
  const lastName = String(user.last_name ?? user.lastName ?? "").trim();
  const fullName = String(user.full_name ?? user.fullName ?? user.displayName ?? user.name ?? "").trim();
  const email = String(user.email ?? "").trim();

  const isCommaOnlyName =
    (!lastName && !firstName && (!fullName || fullName === "," || fullName === ", " || fullName.trim() === ",")) ||
    fullName.trim() === "," ||
    fullName.trim() === ", ";

  if (isCommaOnlyName) {
    return false;
  }

  return Boolean(email || firstName || lastName || fullName);
}

export function isValidScoreManagementUser(user: CanonicalUserIdentity | null | undefined): boolean {
  if (!user) return false;
  const idNumber = String(user.idNumber ?? "").trim();
  const firstName = String(user.firstName ?? "").trim();
  const middleName = String(user.middleName ?? "").trim();
  const lastName = String(user.lastName ?? "").trim();
  const fullName = String(user.fullName ?? "").trim();

  const isCommaOnlyName =
    (!lastName && !firstName && (!fullName || fullName === "," || fullName === ", " || fullName.trim() === ",")) ||
    fullName.trim() === "," ||
    fullName.trim() === ", ";

  const hasValidName = Boolean((firstName || middleName || lastName || fullName) && !isCommaOnlyName);
  const hasId = Boolean(idNumber && idNumber !== "—" && idNumber !== "-" && idNumber !== "N/A");

  return Boolean(hasId && hasValidName && !isCommaOnlyName);
}

/**
 * Resolves any user record (from Firestore users collection, score metadata, or CSV row)
 * into a robust CanonicalUserIdentity.
 */
export function resolveCanonicalUserIdentity(user: any): CanonicalUserIdentity {
  if (!user) {
    return {
      userDocId: "",
      firebaseUid: "",
      idNumber: "",
      firstName: "",
      middleName: "",
      lastName: "",
      fullName: "",
      email: "",
      role: "Reviewee",
      school: "",
      branch: "",
      isArchived: false,
    };
  }

  const userDocId = String(user.doc_id || user.userDocId || user.id || user.uid || "").trim();
  const firebaseUid = String(user.firebaseUid || user.uid || user.user_uid || "").trim();
  
  const idNumber = normalizeIdNumber(
    user.idNumber ??
    user.id_number ??
    user.revieweeId ??
    user.reviewee_id ??
    user.staffId ??
    user.staff_id ??
    user.adminId ??
    user.admin_id ??
    user.seq_id ??
    user.seqId ??
    ""
  );

  const firstName = String(
    user.firstName ??
    user.first_name ??
    user.givenName ??
    user.given_name ??
    ""
  ).trim().toUpperCase();

  const middleName = cleanOptionalName(
    user.middleName ??
    user.middle_name ??
    user.middleInitial ??
    user.middle_initial ??
    ""
  ).toUpperCase();

  const lastName = String(
    user.lastName ??
    user.last_name ??
    user.surname ??
    user.familyName ??
    user.family_name ??
    ""
  ).trim().toUpperCase();

  const email = String(
    user.email ??
    user.emailAddress ??
    user.email_address ??
    user.normalizedEmail ??
    ""
  ).trim();

  const role = getUserRole(user);

  const school = String(
    user.school ??
    user.schoolName ??
    user.school_name ??
    ""
  ).trim();

  const branch = String(
    user.branch ??
    user.reviewBranch ??
    user.review_branch ??
    ""
  ).trim();

  const profilePicture = user.profilePicture || user.profile_picture || user.avatar || user.photoURL || "";
  const isArchived = Boolean(user.isArchived || user.is_archived);

  const rawFullName = String(
    user.fullName ??
    user.full_name ??
    user.displayName ??
    user.display_name ??
    user.name ??
    ""
  ).trim();

  const fullName = formatFormalName({
    firstName,
    middleName,
    lastName,
    suffix: user.suffix || user.nameExtension,
    fallbackFullName: rawFullName,
  });

  return {
    userDocId,
    firebaseUid,
    idNumber,
    firstName,
    middleName,
    lastName,
    fullName,
    email,
    role,
    school,
    branch,
    profilePicture,
    isArchived,
  };
}

/**
 * Merges two duplicate user records into one canonical representation.
 * Preserves scores, ensures reviewee identity is prioritized for student IDs,
 * and maintains full profile attributes.
 */
function mergeDuplicateUserRecords(prev: any, incoming: any): any {
  if (!prev) return incoming;
  if (!incoming) return prev;

  const prevRole = getUserRole(prev);
  const incRole = getUserRole(incoming);

  // If this record has a student ID number and either record is Reviewee, keep Reviewee
  let chosenRole = prevRole;
  if (prevRole === "Reviewee" || incRole === "Reviewee") {
    chosenRole = "Reviewee";
  } else if (prevRole === "Staff" || incRole === "Staff") {
    chosenRole = "Staff";
  } else {
    chosenRole = "Admin";
  }

  // Combine scores so historical scores are never lost
  const mergedScoresByDate = {
    ...(prev.scoresByDate || {}),
    ...(incoming.scoresByDate || {}),
  };

  const mergedAssessmentRecords = {
    ...(prev.assessmentRecords || {}),
    ...(incoming.assessmentRecords || {}),
  };

  // Combine score / diagnostic / exam fields
  const scoreFields: Record<string, any> = {};
  [prev, incoming].forEach(record => {
    Object.keys(record).forEach(k => {
      if (
        k.startsWith('score_') ||
        k.startsWith('diag_') ||
        k.startsWith('preboard_') ||
        k.startsWith('post_') ||
        k.startsWith('final_')
      ) {
        if (record[k] !== undefined && record[k] !== null && record[k] !== '') {
          scoreFields[k] = record[k];
        }
      }
    });
  });

  // Prefer authentic Firebase UID if available
  const chosenUid = (incoming.authUid || incoming.firebaseUid || incoming.uid) ||
                    (prev.authUid || prev.firebaseUid || prev.uid);

  const chosenSeqId = incoming.seqId || incoming.seq_id || incoming.id_number || incoming.srcId ||
                      prev.seqId || prev.seq_id || prev.id_number || prev.srcId || "";

  return {
    ...prev,
    ...incoming,
    ...scoreFields,
    uid: chosenUid,
    id: chosenUid || prev.id || incoming.id,
    doc_id: chosenUid || prev.doc_id || incoming.doc_id,
    seqId: chosenSeqId,
    seq_id: chosenSeqId,
    role: chosenRole,
    userRole: chosenRole,
    scoresByDate: Object.keys(mergedScoresByDate).length > 0 ? mergedScoresByDate : prev.scoresByDate,
    assessmentRecords: Object.keys(mergedAssessmentRecords).length > 0 ? mergedAssessmentRecords : prev.assessmentRecords,
    email: (incoming.email && !incoming.email.includes("placeholder")) ? incoming.email : (prev.email || incoming.email || ""),
    firstName: incoming.firstName || prev.firstName || incoming.first_name || prev.first_name || "",
    first_name: incoming.first_name || prev.first_name || incoming.firstName || prev.firstName || "",
    middleName: cleanOptionalName(incoming.middleName || prev.middleName || incoming.middle_name || prev.middle_name),
    middle_name: cleanOptionalName(incoming.middle_name || prev.middle_name || incoming.middleName || prev.middleName),
    lastName: incoming.lastName || prev.lastName || incoming.last_name || prev.last_name || "",
    last_name: incoming.last_name || prev.last_name || incoming.lastName || prev.lastName || "",
    school_name: incoming.school_name || prev.school_name || incoming.school || prev.school || "",
    school: incoming.school || prev.school || incoming.school_name || prev.school_name || "",
    review_branch: incoming.review_branch || prev.review_branch || incoming.branch || prev.branch || "",
    branch: incoming.branch || prev.branch || incoming.review_branch || prev.review_branch || "",
    pin: incoming.pin || prev.pin || "",
    accountStatus: (incoming.accountStatus && incoming.accountStatus !== 'merged') ? incoming.accountStatus : (prev.accountStatus || 'active'),
    status: (incoming.status && incoming.status !== 'merged') ? incoming.status : (prev.status || 'active'),
  };
}

/**
 * Deduplicates any user list to strictly guarantee NO DUPLICATE ID NUMBERS AND NO DUPLICATE NAMES.
 * If multiple documents in Firestore share the same sequence/student ID or the same normalized name,
 * they are merged into a single canonical user record.
 */
export function deduplicateUsersByIdNumber<T = any>(users: T[]): T[] {
  if (!Array.isArray(users)) return [];

  const seenIds = new Map<string, any>();
  const seenNames = new Map<string, any>();
  const seenEmails = new Map<string, any>();
  const seenUids = new Map<string, any>();

  for (const rawUser of users) {
    if (!rawUser || typeof rawUser !== 'object') continue;
    const u = rawUser as any;

    const status = String(u.accountStatus || u.status || "").toLowerCase();
    if (status === "merged" || status === "deleted" || u.isDeleted || u.deleted || u.is_deleted) {
      continue;
    }

    const canonical = resolveCanonicalUserIdentity(u);
    const idKey = canonicalizeIdNumber(
      canonical.idNumber || u.seqId || u.seq_id || u.id_number || u.srcId || u.studentId || u.student_id
    );

    const email = String(canonical.email || u.email || "").trim().toLowerCase();
    const uid = String(u.uid || u.id || u.doc_id || "").trim();
    const normName = normalizeNameForComparison(
      canonical.fullName || [canonical.firstName, canonical.lastName].filter(Boolean).join(' ')
    );

    if (idKey) {
      // 1. Group by unique ID number
      if (!seenIds.has(idKey)) {
        seenIds.set(idKey, u);
      } else {
        const existing = seenIds.get(idKey);
        const merged = mergeDuplicateUserRecords(existing, u);
        seenIds.set(idKey, merged);
      }
      if (normName && normName.length > 2) {
        seenNames.set(normName, seenIds.get(idKey));
      }
    } else if (normName && normName.length > 2 && seenNames.has(normName)) {
      // 2. Matches an existing record with the exact same full name
      const existing = seenNames.get(normName);
      const merged = mergeDuplicateUserRecords(existing, u);
      const existingId = canonicalizeIdNumber(existing.seqId || existing.seq_id || existing.id_number || existing.srcId);
      if (existingId) {
        seenIds.set(existingId, merged);
      }
      seenNames.set(normName, merged);
    } else if (email) {
      // 3. Pure accounts without an ID number: deduplicate by email
      const emailKey = `email:${email}`;
      if (!seenEmails.has(emailKey)) {
        seenEmails.set(emailKey, u);
      } else {
        const existing = seenEmails.get(emailKey);
        const merged = mergeDuplicateUserRecords(existing, u);
        seenEmails.set(emailKey, merged);
      }
      if (normName && normName.length > 2) {
        seenNames.set(normName, seenEmails.get(emailKey));
      }
    } else if (normName && normName.length > 2 && !seenNames.has(normName)) {
      // 4. Unique Name without ID or Email
      seenNames.set(normName, u);
    } else if (uid) {
      // 5. Fallback: key by UID
      const uidKey = `uid:${uid}`;
      if (!seenUids.has(uidKey)) {
        seenUids.set(uidKey, u);
      } else {
        const existing = seenUids.get(uidKey);
        const merged = mergeDuplicateUserRecords(existing, u);
        seenUids.set(uidKey, merged);
      }
    }
  }

  const result: T[] = [];
  const processedNames = new Set<string>();

  // Add all unique ID number users
  seenIds.forEach((user) => {
    const canonical = resolveCanonicalUserIdentity(user);
    const normName = normalizeNameForComparison(
      canonical.fullName || [canonical.firstName, canonical.lastName].filter(Boolean).join(' ')
    );
    if (normName) processedNames.add(normName);
    result.push(user);
  });

  // Add all unique email users that do not already have an ID number or matching name in seenIds
  seenEmails.forEach((user) => {
    const idKey = canonicalizeIdNumber(user.seqId || user.seq_id || user.id_number || user.srcId);
    const canonical = resolveCanonicalUserIdentity(user);
    const normName = normalizeNameForComparison(
      canonical.fullName || [canonical.firstName, canonical.lastName].filter(Boolean).join(' ')
    );

    if ((!idKey || !seenIds.has(idKey)) && (!normName || !processedNames.has(normName))) {
      if (normName) processedNames.add(normName);
      result.push(user);
    }
  });

  // Add unique names that were not covered by ID or Email
  seenNames.forEach((user, nameKey) => {
    if (!processedNames.has(nameKey)) {
      processedNames.add(nameKey);
      result.push(user);
    }
  });

  // Add unique UID users
  seenUids.forEach((user) => {
    const idKey = canonicalizeIdNumber(user.seqId || user.seq_id || user.id_number || user.srcId);
    const email = String(user.email || "").trim().toLowerCase();
    const emailKey = `email:${email}`;
    const canonical = resolveCanonicalUserIdentity(user);
    const normName = normalizeNameForComparison(
      canonical.fullName || [canonical.firstName, canonical.lastName].filter(Boolean).join(' ')
    );

    if (
      (!idKey || !seenIds.has(idKey)) &&
      (!email || !seenEmails.has(emailKey)) &&
      (!normName || !processedNames.has(normName))
    ) {
      if (normName) processedNames.add(normName);
      result.push(user);
    }
  });

  return result;
}
