import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { ScoreFolder } from '../types';

export interface CategoryViewPrefs {
  majorAreaId: string | null;
  subjectId: string | null;
  evaluationDate: string | null;
}

export type RevieweeMyScoresPreference = {
  folderId: string | null;
  lastCategoryId: string | null;
  categoryViews: Record<string, CategoryViewPrefs>;
  viewMode: string | null;
  mobileSection: string | null;
};

const DEFAULT_PREFERENCE: RevieweeMyScoresPreference = {
  folderId: null,
  lastCategoryId: 'Daily Evaluation',
  categoryViews: {},
  viewMode: 'scores',
  mobileSection: 'table',
};

export function useRevieweeMyScoresPreferences(
  uid: string | undefined,
  publishedFolders: ScoreFolder[],
  availableCategories: string[]
) {
  const [preference, setPreference] = useState<RevieweeMyScoresPreference>(DEFAULT_PREFERENCE);
  const [isPreferencesReady, setIsPreferencesReady] = useState(false);
  const isRestoringRef = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const localStorageKey = uid ? `src-reviewee-my-scores-view:${uid}` : null;

  // 1. Load preferences from Firestore & localStorage, and parse URL params
  useEffect(() => {
    if (!uid) {
      setIsPreferencesReady(true);
      isRestoringRef.current = false;
      return;
    }

    let isMounted = true;

    async function loadPrefs() {
      try {
        // Step A: Check URL params first
        const urlParams = new URLSearchParams(window.location.search);
        const urlFolder = urlParams.get('folder');
        const urlCategory = urlParams.get('category');
        const urlArea = urlParams.get('area') || urlParams.get('majorArea');
        const urlSubject = urlParams.get('subject');

        let loadedPref: RevieweeMyScoresPreference = { ...DEFAULT_PREFERENCE };

        // Step B: Check localStorage fallback
        if (localStorageKey) {
          const localVal = localStorage.getItem(localStorageKey);
          if (localVal) {
            try {
              const parsed = JSON.parse(localVal);
              if (parsed && typeof parsed === 'object') {
                loadedPref = { ...loadedPref, ...parsed };
              }
            } catch (e) {
              console.error("Error parsing local preference:", e);
            }
          }
        }

        // Step C: Check Firestore (user_preferences/{uid} or users/{uid})
        try {
          if (firestoreDb && uid) {
            const prefDocRef = doc(firestoreDb as any, 'user_preferences', uid);
            const prefSnap = await getDoc(prefDocRef);
            if (prefSnap.exists() && prefSnap.data()?.revieweeMyScores) {
              const firestorePref = prefSnap.data().revieweeMyScores;
              loadedPref = { ...loadedPref, ...firestorePref };
            } else {
              // Fallback check users/{uid}
              const userDocRef = doc(firestoreDb as any, 'users', uid);
              const userSnap = await getDoc(userDocRef);
              if (userSnap.exists() && userSnap.data()?.revieweeMyScores) {
                const userPref = userSnap.data().revieweeMyScores;
                loadedPref = { ...loadedPref, ...userPref };
              }
            }
          }
        } catch (err) {
          console.error("Failed to load Firestore reviewee preferences:", err);
        }

        if (!isMounted) return;

        // Step D: Validate and apply folder
        let validFolderId = loadedPref.folderId;
        const matchingFolder = publishedFolders.find(f => f.id === validFolderId);
        if (!matchingFolder && publishedFolders.length > 0) {
          validFolderId = publishedFolders[0].id;
        }

        // Step E: Validate and apply category
        let validCategory = urlCategory || loadedPref.lastCategoryId || availableCategories[0] || 'Daily Evaluation';
        if (availableCategories.length > 0 && !availableCategories.includes(validCategory)) {
          validCategory = availableCategories[0];
        }

        // Step F: Category-scoped view overrides from URL or stored prefs
        const categoryViews = loadedPref.categoryViews || {};
        const currentCatView = categoryViews[validCategory] || { majorAreaId: 'CLJ', subjectId: null, evaluationDate: null };

        if (urlArea) {
          currentCatView.majorAreaId = urlArea.toUpperCase();
        }
        if (urlSubject) {
          currentCatView.subjectId = urlSubject;
        }

        categoryViews[validCategory] = currentCatView;

        const finalPref: RevieweeMyScoresPreference = {
          folderId: validFolderId || (publishedFolders[0]?.id ?? null),
          lastCategoryId: validCategory,
          categoryViews,
          viewMode: loadedPref.viewMode || 'scores',
          mobileSection: loadedPref.mobileSection || 'table',
        };

        setPreference(finalPref);
        if (localStorageKey) {
          localStorage.setItem(localStorageKey, JSON.stringify(finalPref));
        }
      } catch (e) {
        console.error("Error in loadPrefs:", e);
      } finally {
        if (isMounted) {
          setIsPreferencesReady(true);
          isRestoringRef.current = false;
        }
      }
    }

    loadPrefs();

    return () => {
      isMounted = false;
    };
  }, [uid, publishedFolders.map(f => f.id).join(','), availableCategories.join(',')]);

  // 2. Save preference function (localStorage immediately, debounced Firestore write)
  const savePreference = useCallback((newPartial: Partial<RevieweeMyScoresPreference>) => {
    if (!uid || isRestoringRef.current) return;

    setPreference(prev => {
      const updated: RevieweeMyScoresPreference = {
        ...prev,
        ...newPartial,
        categoryViews: newPartial.categoryViews 
          ? { ...prev.categoryViews, ...newPartial.categoryViews }
          : prev.categoryViews
      };

      // Save to localStorage immediately
      if (localStorageKey) {
        try {
          localStorage.setItem(localStorageKey, JSON.stringify(updated));
        } catch (e) {
          console.error("Error saving to localStorage:", e);
        }
      }

      // Sync to URL parameters
      try {
        const url = new URL(window.location.href);
        if (updated.folderId) url.searchParams.set('folder', updated.folderId);
        if (updated.lastCategoryId) url.searchParams.set('category', updated.lastCategoryId);
        
        const catView = updated.categoryViews[updated.lastCategoryId || ''];
        if (catView?.majorAreaId) {
          url.searchParams.set('area', catView.majorAreaId);
        } else {
          url.searchParams.delete('area');
        }
        if (catView?.subjectId) {
          url.searchParams.set('subject', catView.subjectId);
        } else {
          url.searchParams.delete('subject');
        }

        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // Ignore URL sync errors in iframe/sandboxed environments
      }

      // Debounced Firestore write
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          if (!firestoreDb) return;
          const prefRef = doc(firestoreDb as any, 'user_preferences', uid);
          await setDoc(
            prefRef,
            {
              revieweeMyScores: updated,
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );

          // Also update users/{uid} for redundancy
          const userRef = doc(firestoreDb as any, 'users', uid);
          await setDoc(
            userRef,
            {
              revieweeMyScores: updated,
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        } catch (err) {
          console.error("Failed to sync reviewee preferences to Firestore:", err);
        }
      }, 500);

      return updated;
    });
  }, [uid, localStorageKey]);

  // Helper for updating specific category view
  const updateCategoryView = useCallback((category: string, viewUpdate: Partial<CategoryViewPrefs>) => {
    setPreference(prev => {
      const existingCatView = prev.categoryViews[category] || { majorAreaId: 'CLJ', subjectId: null, evaluationDate: null };
      const updatedCatView = { ...existingCatView, ...viewUpdate };
      
      const newCategoryViews = {
        ...prev.categoryViews,
        [category]: updatedCatView
      };

      savePreference({
        lastCategoryId: category,
        categoryViews: newCategoryViews
      });

      return {
        ...prev,
        lastCategoryId: category,
        categoryViews: newCategoryViews
      };
    });
  }, [savePreference]);

  return {
    preference,
    isPreferencesReady,
    savePreference,
    updateCategoryView,
    isRestoring: isRestoringRef.current
  };
}
