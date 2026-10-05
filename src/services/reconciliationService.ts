import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { getCanonicalRevieweeId } from '../utils/scoreFieldResolver';
import { getUserRole, isAdmin, isStaff, isSuperAdminEmail } from '../utils/roleUtils';

export interface ReconciliationResult {
  totalProcessed: number;
  assignedIdsCount: number;
  activatedPendingCount: number;
  normalizedStatusCount: number;
  fixedUsers: Array<{
    id: string;
    name: string;
    email: string;
    assignedId?: string;
    statusChange?: string;
  }>;
}

/**
 * Scans all reviewees in Firestore and reconciles all discrepancies:
 * 1. Strictly targets ONLY users with the 'Reviewee' role (never touches Admins or Staff).
 * 2. Assigns a standardized ID number to any active reviewee missing an ID.
 * 3. Promotes pending/unverified reviewee profiles to active enrolled status.
 * 4. Normalizes all status & sequence ID keys for 100% database synchronicity.
 */
export async function reconcileAndFixAllDiscrepancies(): Promise<ReconciliationResult> {
  if (!firestoreDb) {
    throw new Error("Firestore database connection is unavailable.");
  }

  const usersCol = collection(firestoreDb, 'users');
  const snapshot = await getDocs(usersCol);

  // Extract all existing numeric IDs to prevent collision
  const existingIds = new Set<string>();
  let maxSeqNumber = 0;

  snapshot.docs.forEach(d => {
    const data = d.data();
    const id = getCanonicalRevieweeId(data);
    if (id) {
      existingIds.add(id.toUpperCase());
      const numMatch = id.match(/\d+/);
      if (numMatch) {
        const n = parseInt(numMatch[0], 10);
        if (!isNaN(n) && n > maxSeqNumber && n < 99999) {
          maxSeqNumber = n;
        }
      }
    }
  });

  if (maxSeqNumber === 0) {
    maxSeqNumber = snapshot.size;
  }

  const result: ReconciliationResult = {
    totalProcessed: snapshot.size,
    assignedIdsCount: 0,
    activatedPendingCount: 0,
    normalizedStatusCount: 0,
    fixedUsers: [],
  };

  let batch = writeBatch(firestoreDb);
  let batchOpsCount = 0;
  const BATCH_LIMIT = 400;

  for (const userDoc of snapshot.docs) {
    const u = userDoc.data();
    const docId = userDoc.id;

    // STRICT ROLE GUARD: Strictly target ONLY the Reviewee role.
    // Never modify or assign IDs to Admins, Staff, or Super Admin accounts.
    if (isAdmin(u) || isStaff(u) || isSuperAdminEmail(u?.email)) {
      continue;
    }

    const calculatedRole = getUserRole(u);
    if (calculatedRole !== 'Reviewee') {
      continue;
    }

    const currentId = getCanonicalRevieweeId(u);
    const rawStatus = String(
      u.accountStatus ||
      u.status ||
      u.enrollmentStatus ||
      u.registration_status ||
      'active'
    ).toLowerCase().trim();

    const isDropped = rawStatus === 'dropped' || rawStatus === 'withdrawn';
    const isPending =
      rawStatus === 'pending' ||
      rawStatus === 'pending_profile' ||
      rawStatus === 'for approval' ||
      rawStatus === 'unverified' ||
      u.is_pending === true ||
      u.isPending === true;

    let needsUpdate = false;
    const updates: Record<string, any> = {};
    let assignedIdForUser: string | undefined;
    let statusChangeForUser: string | undefined;

    // 1. Assign ID if missing (and not dropped)
    if (!currentId && !isDropped) {
      maxSeqNumber++;
      const generatedId = `REV-${String(maxSeqNumber).padStart(4, '0')}`;
      existingIds.add(generatedId);

      updates.seqId = generatedId;
      updates.seq_id = generatedId;
      updates.idNumber = generatedId;
      updates.id_number = generatedId;
      assignedIdForUser = generatedId;
      result.assignedIdsCount++;
      needsUpdate = true;
    } else if (currentId) {
      // Ensure all ID fields are synced to the canonical ID
      if (u.seqId !== currentId || u.seq_id !== currentId || u.idNumber !== currentId || u.id_number !== currentId) {
        updates.seqId = currentId;
        updates.seq_id = currentId;
        updates.idNumber = currentId;
        updates.id_number = currentId;
        needsUpdate = true;
      }
    }

    // 2. Reconcile Pending / Unverified to Active
    if (isPending) {
      updates.accountStatus = 'active';
      updates.status = 'active';
      updates.enrollmentStatus = 'enrolled';
      updates.is_pending = false;
      updates.isPending = false;
      statusChangeForUser = `${rawStatus} -> active`;
      result.activatedPendingCount++;
      needsUpdate = true;
    } else if (!isDropped && rawStatus !== 'active') {
      updates.accountStatus = 'active';
      updates.status = 'active';
      statusChangeForUser = `${rawStatus} -> active`;
      result.normalizedStatusCount++;
      needsUpdate = true;
    }

    // 3. Ensure canonical role is Reviewee
    if (u.role !== 'Reviewee' && u.userRole !== 'Reviewee') {
      updates.role = 'Reviewee';
      updates.userRole = 'Reviewee';
      needsUpdate = true;
    }

    if (needsUpdate) {
      updates.updatedAt = new Date().toISOString();
      batch.update(doc(firestoreDb, 'users', docId), updates);
      batchOpsCount++;

      const name = `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim() || u.email || 'Reviewee';
      result.fixedUsers.push({
        id: docId,
        name,
        email: u.email || '',
        assignedId: assignedIdForUser,
        statusChange: statusChangeForUser,
      });

      if (batchOpsCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(firestoreDb);
        batchOpsCount = 0;
      }
    }
  }

  if (batchOpsCount > 0) {
    await batch.commit();
  }

  return result;
}
