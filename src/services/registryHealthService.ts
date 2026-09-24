import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { getClientDb } from '../utils/firebaseClient';
import { resolveCanonicalUserIdentity } from './userIdentityResolver';

export interface RegistryScanResult {
  totalScanned: number;
  mergedUsersFound: number;
  healedCount: number;
  healedUsers: Array<{
    id: string;
    seqId: string;
    name: string;
    email: string;
    previousStatus: string;
  }>;
}

/**
 * Scans the Firestore 'users' collection for reviewees who have an assigned
 * sequence ID / reviewee ID or active profile, but were mistakenly marked as 'merged'.
 * Automatically heals their Firestore document to active status so they appear in
 * the Admin User Registry.
 */
export async function scanAndRepairMergedUsers(): Promise<RegistryScanResult> {
  const db = getClientDb();
  if (!db) {
    throw new Error('Firestore database is not initialized');
  }

  const snapshot = await getDocs(collection(db, 'users'));
  const batch = writeBatch(db);
  const healedUsers: RegistryScanResult['healedUsers'] = [];

  let totalScanned = 0;
  let mergedUsersFound = 0;
  let batchCount = 0;

  snapshot.forEach((docSnap) => {
    totalScanned++;
    const data = docSnap.data();
    const docId = docSnap.id;

    const rawStatus = String(data.accountStatus || data.status || '').toLowerCase();
    const canonical = resolveCanonicalUserIdentity(data);
    const seqId = String(
      canonical.idNumber ||
      data.seq_id ||
      data.seqId ||
      data.srcId ||
      data.src_id ||
      data.id_number ||
      data.idNumber ||
      data.student_id ||
      data.studentId ||
      ''
    ).trim();

    const isMergedStatus = rawStatus === 'merged';
    const hasValidSeqId = Boolean(seqId && seqId !== '—' && seqId.toUpperCase() !== 'NONE');
    const hasNameOrEmail = Boolean(canonical.fullName || canonical.email || data.email || data.email_lower);

    // If this record has status 'merged' but is actually an active user with an ID or email/profile
    if (isMergedStatus && (hasValidSeqId || hasNameOrEmail)) {
      mergedUsersFound++;

      const userRef = doc(db, 'users', docId);
      batch.update(userRef, {
        accountStatus: 'active',
        status: 'active',
        isDeleted: false,
        deleted: false,
        updatedAt: new Date().toISOString(),
      });

      batchCount++;
      healedUsers.push({
        id: docId,
        seqId: seqId || 'No ID',
        name: canonical.fullName || 'Reviewee',
        email: canonical.email || data.email || 'No email',
        previousStatus: rawStatus,
      });
    }
  });

  if (batchCount > 0) {
    await batch.commit();
  }

  return {
    totalScanned,
    mergedUsersFound,
    healedCount: healedUsers.length,
    healedUsers,
  };
}
