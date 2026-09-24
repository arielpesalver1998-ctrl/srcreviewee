export type AppRole = "Admin" | "Staff" | "Reviewee";

export const normalizeRole = (role: any): string => {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/_/g, "");
};

export const normalizeLegacyRole = (role: any): AppRole => {
  const normalized = normalizeRole(role);

  if (normalized === "admin") return "Admin";
  if (normalized === "staff") return "Staff";
  if (normalized === "reviewee") return "Reviewee";

  if (normalized === "superadmin") return "Admin";
  if (normalized === "coadmin") return "Staff";
  if (normalized === "student") return "Reviewee";
  if (normalized === "user") return "Reviewee";
  if (normalized === "free") return "Reviewee";

  return "Reviewee";
};

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const clean = String(email).trim().toLowerCase();
  return (
    clean === 'arielpesalver1998@gmail.com' ||
    clean === 'arielpesalver@ckcm.edu.ph'
  );
};

export const getUserRole = (user: any): AppRole => {
  if (!user) return "Reviewee";

  // 1. Explicit document role takes top priority!
  const explicitRole = user?.role ?? user?.userRole ?? user?.role_name ?? user?.accountType;
  if (explicitRole !== undefined && explicitRole !== null && String(explicitRole).trim() !== "") {
    return normalizeLegacyRole(explicitRole);
  }

  // 2. Fallback to super admin email check ONLY if no explicit role is defined on the record
  const email = user?.email || user?.normalizedEmail || user?.email_lower;
  if (isSuperAdminEmail(email)) {
    return "Admin";
  }

  return "Reviewee";
};

export const isAdmin = (user: any): boolean => {
  return getUserRole(user) === "Admin";
};

export const isStaff = (user: any): boolean => {
  return getUserRole(user) === "Staff";
};

export const isReviewee = (user: any): boolean => {
  return getUserRole(user) === "Reviewee";
};

export const isAdminLike = (user: any): boolean => {
  return isAdmin(user) || isStaff(user);
};

export const canViewActivityLog = (user: any): boolean => {
  return isAdmin(user);
};

export const canManageScores = (user: any): boolean => {
  return isAdminLike(user);
};

export const canOpenSyncSettings = (user: any): boolean => {
  return isAdminLike(user);
};

export const hasScoreEditPermission = (user: any): boolean => {
  if (!user) return false;
  const role = getUserRole(user);
  if (role === "Admin") return true;
  if (role === "Staff") {
    if (user.score_edit === true) return true;
    if (user.permissions?.score_edit === true) return true;
    if (user.permissions?.includes?.("score_edit")) return true;
    if (user.role_permissions?.score_edit === true) return true;
    return user.score_edit !== false && user.permissions?.score_edit !== false;
  }
  return false;
};


