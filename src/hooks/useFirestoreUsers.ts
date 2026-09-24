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

        const uniqueUsers = deduplicateUsersByIdNumber(rawUsers);
        setAllUsers(uniqueUsers);
        setLoading(false);
        setError(null);
      },
      (err) => {
        // Only log serious errors, ignore transient offline/backoff notices
        const msg = err.message?.toLowerCase() || '';
        if (!msg.includes('unavailable') && !msg.includes('offline') && !msg.includes('backoff')) {
          const issue = logFirestoreError("users-hook", err);
          setError(issue);
        }
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { allUsers, loading, error };
}

