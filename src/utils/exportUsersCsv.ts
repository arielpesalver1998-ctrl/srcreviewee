import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { firestoreDb } from './firebaseClient';
import { resolveCanonicalUserIdentity, formatFormalName, cleanOptionalName, deduplicateUsersByIdNumber, getUserAccountStatus } from '../services/userIdentityResolver';
import { getUserRole } from './roleUtils';

function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

function formatDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
    return val.toDate().toISOString().replace('T', ' ').slice(0, 19);
  }
  if (val instanceof Date) {
    return val.toISOString().replace('T', ' ').slice(0, 19);
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toISOString().replace('T', ' ').slice(0, 19);
  }
  return String(val);
}

function countScores(user: any): number {
  let count = 0;
  if (!user || typeof user !== 'object') return 0;

  Object.keys(user).forEach((key) => {
    if (key.startsWith('score_') || key.startsWith('diag_') || key.startsWith('scoresByDate_')) {
      count++;
    }
  });

  if (user.scoresByDate && typeof user.scoresByDate === 'object') {
    count += Object.keys(user.scoresByDate).length;
  }

  return count;
}

export interface ExportUsersCsvResult {
  success: boolean;
  count: number;
  filename: string;
  error?: string;
}

/**
 * Fetches all registered users directly from Firestore and triggers a CSV file download
 * formatted for administrative record-keeping.
 */
export async function downloadRegisteredUsersCsv(fallbackUsers?: any[]): Promise<ExportUsersCsvResult> {
  let rawUsers: any[] = [];

  try {
    if (firestoreDb) {
      const snap = await getDocs(collection(firestoreDb, 'users'));
      rawUsers = snap.docs.map((docSnap) => ({
        uid: docSnap.id,
        id: docSnap.id,
        ...docSnap.data(),
      }));
    }
  } catch (err: any) {
    console.warn('[downloadRegisteredUsersCsv] Firestore direct fetch notice, using fallback if available:', err);
  }

  if (rawUsers.length === 0 && fallbackUsers && fallbackUsers.length > 0) {
    rawUsers = [...fallbackUsers];
  }

  if (rawUsers.length === 0) {
    return {
      success: false,
      count: 0,
      filename: '',
      error: 'No user records found in Firestore to export.',
    };
  }

  // Deduplicate strictly to ONLY ONE USER PER ID NUMBER, filter merged/deleted, sort alphabetically
  const uniqueUsers = deduplicateUsersByIdNumber(rawUsers);
  const processedUsers = uniqueUsers
    .filter((u) => {
      const status = String(u.accountStatus || u.status || '').toLowerCase();
      if (status === 'merged' || status === 'deleted' || u.isDeleted || u.deleted) {
        return false;
      }
      return true;
    })
    .map((u) => {
      const canonical = resolveCanonicalUserIdentity(u);
      const role = getUserRole(u);
      const formalName = formatFormalName(canonical);
      const totalScores = countScores(u);
      const regDate = formatDate(u.createdAt || u.created_at || u.registrationDate || u.registeredAt);

      return {
        idNumber: canonical.idNumber || u.seq_id || u.seqId || u.id_number || '—',
        lastName: canonical.lastName || u.last_name || u.lastName || '',
        firstName: canonical.firstName || u.first_name || u.firstName || '',
        middleName: cleanOptionalName(canonical.middleName || u.middle_name || u.middleName || ''),
        fullName: formalName || canonical.fullName || u.displayName || '',
        role: role,
        email: canonical.email || u.email || '',
        school: canonical.school || u.school_name || u.schoolName || u.school || '',
        branch: canonical.branch || u.review_branch || u.reviewBranch || u.branch || '',
        accountStatus: getUserAccountStatus(u),
        authProvider: u.authProvider || u.registrationMethod || (u.providerData?.[0]?.providerId) || 'password',
        scoresCount: totalScores,
        registrationDate: regDate,
        docId: u.uid || u.id || '',
      };
    });

  // Sort by Role (Admin first, then Staff, then Reviewees by Last Name)
  processedUsers.sort((a, b) => {
    const roleRank: Record<string, number> = { Admin: 1, Staff: 2, Reviewee: 3 };
    const rankDiff = (roleRank[a.role] || 9) - (roleRank[b.role] || 9);
    if (rankDiff !== 0) return rankDiff;
    return a.lastName.localeCompare(b.lastName);
  });

  // CSV Columns Header
  const headers = [
    'ID Number',
    'Last Name',
    'First Name',
    'Middle Name',
    'Full Name',
    'Role',
    'Email Address',
    'School / University',
    'Review Branch',
    'Account Status',
    'Auth Method',
    'Encoded Scores Count',
    'Registration Date',
    'Firestore Document ID',
  ];

  const csvRows: string[] = [
    headers.map(escapeCsvCell).join(','),
  ];

  processedUsers.forEach((u) => {
    const row = [
      escapeCsvCell(u.idNumber),
      escapeCsvCell(u.lastName),
      escapeCsvCell(u.firstName),
      escapeCsvCell(u.middleName),
      escapeCsvCell(u.fullName),
      escapeCsvCell(u.role),
      escapeCsvCell(u.email),
      escapeCsvCell(u.school),
      escapeCsvCell(u.branch),
      escapeCsvCell(u.accountStatus),
      escapeCsvCell(u.authProvider),
      escapeCsvCell(u.scoresCount),
      escapeCsvCell(u.registrationDate),
      escapeCsvCell(u.docId),
    ];
    csvRows.push(row.join(','));
  });

  const csvString = csvRows.join('\r\n');
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `SRC_Registered_Users_${dateStr}_${timeStr}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    success: true,
    count: processedUsers.length,
    filename,
  };
}
