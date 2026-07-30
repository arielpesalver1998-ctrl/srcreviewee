import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { ScoreFolder } from '../types';
import { logFirestoreError } from '../utils/firestoreErrorHandling';

export function useScoreFolders() {
  const [folders, setFolders] = useState<ScoreFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!firestoreDb) {
      setLoading(false);
      return;
    }

    const q = collection(firestoreDb, 'scoreFolders');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const folderList: ScoreFolder[] = [];
      snapshot.forEach((doc) => {
        folderList.push({ id: doc.id, ...doc.data() } as ScoreFolder);
      });

      folderList.sort((a, b) => {
        const getMillis = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'object' && typeof val.toMillis === 'function') return val.toMillis();
          if (val instanceof Date) return val.getTime();
          const t = new Date(val).getTime();
          return isNaN(t) ? 0 : t;
        };
        const timeA = getMillis(a.createdAt);
        const timeB = getMillis(b.createdAt);
        if (timeA !== timeB) return timeB - timeA;
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      });

      setFolders(folderList);
      setLoading(false);
      setError(null);
    }, (err) => {
      const issue = logFirestoreError("score-folders-hook", err);
      setError(issue);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { folders, loading, error };
}
