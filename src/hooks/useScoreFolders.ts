import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { ScoreFolder } from '../types';
import { logFirestoreError } from '../utils/firestoreErrorHandling';
import { normalizeScoreFolder } from '../constants/folderTypes';

export function useScoreFolders() {
  const [folders, setFolders] = useState<ScoreFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!firestoreDb) {
      setLoading(false);
      return;
    }

    let camelMap = new Map<string, any>();
    let snakeMap = new Map<string, any>();

    const updateCombinedFolders = () => {
      const mergedMap = new Map<string, any>();

      // Ingest camelCase docs
      camelMap.forEach((val, id) => {
        mergedMap.set(id, val);
      });

      // Ingest snake_case docs
      snakeMap.forEach((val, id) => {
        const existing = mergedMap.get(id);
        if (existing) {
          const tExisting = getMillis(existing.updatedAt || existing.createdAt);
          const tNew = getMillis(val.updatedAt || val.createdAt);
          if (tNew >= tExisting) {
            mergedMap.set(id, { ...existing, ...val });
          } else {
            mergedMap.set(id, { ...val, ...existing });
          }
        } else {
          mergedMap.set(id, val);
        }
      });

      const folderList: ScoreFolder[] = [];
      mergedMap.forEach((data, id) => {
        const normalized = normalizeScoreFolder({ id, ...data });
        folderList.push(normalized as unknown as ScoreFolder);
      });

      folderList.sort((a, b) => {
        const timeA = getMillis(a.createdAt);
        const timeB = getMillis(b.createdAt);
        if (timeA !== timeB) return timeB - timeA;
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      });

      setFolders(folderList);
      setLoading(false);
      setError(null);
    };

    const getMillis = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'object' && typeof val.toMillis === 'function') return val.toMillis();
      if (val instanceof Date) return val.getTime();
      const t = new Date(val).getTime();
      return isNaN(t) ? 0 : t;
    };

    const unsubCamel = onSnapshot(
      collection(firestoreDb, 'scoreFolders'),
      (snapshot) => {
        camelMap.clear();
        snapshot.forEach((doc) => {
          camelMap.set(doc.id, doc.data());
        });
        updateCombinedFolders();
      },
      (err) => {
        const issue = logFirestoreError("score-folders-camel-hook", err);
        setError(issue);
        setLoading(false);
      }
    );

    const unsubSnake = onSnapshot(
      collection(firestoreDb, 'score_folders'),
      (snapshot) => {
        snakeMap.clear();
        snapshot.forEach((doc) => {
          snakeMap.set(doc.id, doc.data());
        });
        updateCombinedFolders();
      },
      (err) => {
        // Snake case may not be accessible if rules differ or collection doesn't exist
        logFirestoreError("score-folders-snake-hook", err);
      }
    );

    return () => {
      unsubCamel();
      unsubSnake();
    };
  }, []);

  return { folders, loading, error };
}
