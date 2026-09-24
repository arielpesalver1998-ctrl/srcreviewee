import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { logFirestoreError } from '../utils/firestoreErrorHandling';
import { deduplicateUsersByIdNumber, getUserAccountStatus } from '../services/userIdentityResolver';

export function useFirestoreUsers() {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!firestoreDb) return;

    const q = query(collection(firestoreDb, "users"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rawUsers = snapshot.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        }));

        // Diagnostic logger for admin dashboard visibility and status inspection
        if (typeof window !== 'undefined') {
          console.groupCollapsed(`[Admin Users Diagnostic] Fetched ${rawUsers.length} raw Firestore user docs`);
          console.table(rawUsers.map((u: any) => ({
            docId: u.uid || u.id,
            email: u.email || u.normalizedEmail || '(none)',
            name: `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim() || u.name || '(none)',
            role: u.role || u.userRole || 'Reviewee',
            rawStatus: u.status || '(none)',
            rawAccountStatus: u.accountStatus || '(none)',
            computedStatus: getUserAccountStatus(u),
            seqId: u.seqId || u.seq_id || u.id_number || u.srcId || '(none)',
            isDeleted: Boolean(u.isDeleted || u.deleted),
            mergedIntoUid: u.mergedIntoUid || '(none)',
          })));
          console.groupEnd();
        }

        const uniqueUsers = deduplicateUsersByIdNumber(rawUsers);
        setAllUsers(uniqueUsers);
        setLoading(false);
        setError(null);
      },
      (err) => {
        const issue = logFirestoreError("users-hook", err);
        setError(issue);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { allUsers, loading, error };
}

