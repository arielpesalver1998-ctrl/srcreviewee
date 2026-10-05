import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { normalizeScoreCategory, normalizeScoreSubject, getScoreFieldName } from '../utils/scoreFieldResolver';
import { logProfileModification } from '../services/activityLogService';

export interface UploadProgress {
  current: number;
  total: number;
  percent: number;
}

export interface UploadSummary {
  fileName: string;
  folderId: string;
  folderName: string;
  category: string;
  area: string;
  successCount: number;
  failedCount: number;
  totalRows: number;
  startTime: string;
  endTime?: string;
  errorMessages?: string[];
}

export interface UploadRowData {
  id: string;
  rowIndex: number;
  rawId: string;
  normalizedId: string;
  rawName: string;
  rawScore: string;
  earnedScore: number | null;
  possiblePoints: number;
  percentage: number | null;
  area: string;
  subjectCode: string;
  category: string;
  examDate: string;
  quizName?: string;
  quizClass?: string;
  studentAnswers?: Record<string, string>;
  answerKeys?: Record<string, string>;
  matchedUser: any | null;
  matchType: 'EXACT_ID' | 'EXACT_NAME' | 'MANUAL' | 'NONE';
  status: 'READY' | 'WARNING_OVERWRITE' | 'CONFLICT_NAME' | 'UNMATCHED' | 'INVALID_SCORE';
  statusMessage: string;
  selected: boolean;
}

export interface UploadConfig {
  fileName: string;
  selectedFolderId: string;
  selectedFolderName: string;
  selectedCategory: string;
  selectedAreaMode: string;
  publicationStatus: 'published' | 'hidden';
  examDate: string;
  currentUser: any;
}

interface ScoreUploadContextType {
  isOpen: boolean;
  isMinimized: boolean;
  isUploading: boolean;
  progress: UploadProgress;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  summary: UploadSummary | null;
  activeRows: UploadRowData[];
  modalConfig: Partial<UploadConfig> | null;
  
  // Actions
  openUploadModal: (config?: Partial<UploadConfig>) => void;
  closeUploadModal: () => void;
  minimizeModal: () => void;
  restoreModal: () => void;
  dismissSummary: () => void;
  startBackgroundUpload: (
    config: UploadConfig,
    rows: UploadRowData[],
    onComplete?: (result: { totalProcessed: number; successCount: number; folderId: string }) => void
  ) => Promise<boolean>;
}

const ScoreUploadContext = createContext<ScoreUploadContextType | null>(null);

export function ScoreUploadProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ current: 0, total: 0, percent: 0 });
  const [status, setStatus] = useState<'idle' | 'uploading' | 'completed' | 'error'>('idle');
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [activeRows, setActiveRows] = useState<UploadRowData[]>([]);
  const [modalConfig, setModalConfig] = useState<Partial<UploadConfig> | null>(null);

  const abortControllerRef = useRef<boolean>(false);

  const openUploadModal = useCallback((config?: Partial<UploadConfig>) => {
    if (config) {
      setModalConfig(config);
    }
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const closeUploadModal = useCallback(() => {
    if (isUploading) {
      // If currently uploading, minimize instead of cancelling
      setIsMinimized(true);
      setIsOpen(false);
    } else {
      setIsOpen(false);
      setIsMinimized(false);
    }
  }, [isUploading]);

  const minimizeModal = useCallback(() => {
    setIsMinimized(true);
    setIsOpen(false);
  }, []);

  const restoreModal = useCallback(() => {
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const dismissSummary = useCallback(() => {
    setSummary(null);
    setStatus('idle');
    setIsMinimized(false);
  }, []);

  const startBackgroundUpload = useCallback(async (
    config: UploadConfig,
    rows: UploadRowData[],
    onComplete?: (result: { totalProcessed: number; successCount: number; folderId: string }) => void
  ): Promise<boolean> => {
    const selectedRows = rows.filter((r) => r.selected && r.matchedUser && r.earnedScore !== null);
    if (selectedRows.length === 0) {
      return false;
    }

    if (!firestoreDb) {
      console.error('Firestore connection unavailable for score upload');
      return false;
    }

    setIsUploading(true);
    setStatus('uploading');
    setActiveRows(rows);
    setProgress({ current: 0, total: selectedRows.length, percent: 0 });

    const startTime = new Date().toISOString();
    const currentSummary: UploadSummary = {
      fileName: config.fileName || 'Scores.csv',
      folderId: config.selectedFolderId || 'main',
      folderName: config.selectedFolderName || 'Main Folder',
      category: config.selectedCategory || 'Daily Evaluation',
      area: config.selectedAreaMode || 'CLJ',
      successCount: 0,
      failedCount: 0,
      totalRows: selectedRows.length,
      startTime,
      errorMessages: [],
    };
    setSummary(currentSummary);

    let successCount = 0;
    let failedCount = 0;
    const errorMessages: string[] = [];
    const nowIso = new Date().toISOString();

    // Process rows in chunks of 5
    const chunkSize = 5;
    for (let i = 0; i < selectedRows.length; i += chunkSize) {
      if (abortControllerRef.current) {
        break;
      }

      const chunk = selectedRows.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map(async (row) => {
          try {
            const user = row.matchedUser;
            const userId = user.uid || user.id || user.doc_id;
            const normCatKey = normalizeScoreCategory(row.category);
            const normSubjKey = normalizeScoreSubject(row.area);
            const cleanDate = row.examDate || nowIso.split('T')[0];

            const scoreRecordKey = `${userId}_${normCatKey}_${normSubjKey}_${cleanDate.replace(/[^0-9]/g, '')}`;
            const assessmentKey = `ar_${normCatKey}_${normSubjKey}_${cleanDate.replace(/[^0-9]/g, '')}`;

            const scoreRecordPayload: Record<string, any> = {
              category: row.category,
              categoryKey: normCatKey,
              area: row.area,
              subject: row.subjectCode || row.area,
              subjectTitle: `${row.area} Assessment`,
              score: row.earnedScore,
              rawScore: row.earnedScore,
              earnedPoints: row.earnedScore,
              possiblePoints: row.possiblePoints,
              totalItems: row.possiblePoints,
              percentage: row.percentage !== null ? Number(row.percentage.toFixed(2)) : row.earnedScore,
              date: cleanDate,
              scoreFolderId: config.selectedFolderId || 'main',
              folderId: config.selectedFolderId || 'main',
              publicationStatus: config.publicationStatus || 'published',
              remarks: `Bulk CSV Import (${config.fileName || 'CSV'})`,
              source: 'Bulk CSV Upload',
              encodedBy: config.currentUser?.email || 'Admin',
              updatedAt: nowIso,
            };

            const assessmentRecordPayload: Record<string, any> = {
              ...scoreRecordPayload,
              earnedScore: row.earnedScore,
              totalScore: row.possiblePoints,
              createdAt: nowIso,
            };

            const flatFieldKey = getScoreFieldName(row.category, row.area);
            const dateFieldKey = `date_${row.area.toLowerCase()}_${normCatKey}`;

            const userDocRef = doc(firestoreDb, 'users', userId);

            const updatePayload: Record<string, any> = {
              [`scoresByDate.${scoreRecordKey}`]: scoreRecordPayload,
              [`assessmentRecords.${assessmentKey}`]: assessmentRecordPayload,
              [`latestScores.${normCatKey}`]: scoreRecordPayload,
              [flatFieldKey]: row.earnedScore,
              [dateFieldKey]: cleanDate,
              latestScoreUploadAt: nowIso,
              updatedAt: nowIso,
            };

            // Category specific shorthand keys
            if (normCatKey === 'pretest' || normCatKey === 'diagnostic') {
              updatePayload[`date_${row.area.toLowerCase()}_diag`] = cleanDate;
              updatePayload[`diag_${row.area.toLowerCase()}`] = row.earnedScore;
            } else if (normCatKey === 'posttest') {
              updatePayload[`date_${row.area.toLowerCase()}_post`] = cleanDate;
              updatePayload[`post_${row.area.toLowerCase()}`] = row.earnedScore;
            } else if (normCatKey === 'preboard') {
              updatePayload[`date_${row.area.toLowerCase()}_preboard`] = cleanDate;
              updatePayload[`preboard_${row.area.toLowerCase()}`] = row.earnedScore;
            }

            // Save individual item answers (Stu1-Stu100) and keys if present
            if (row.studentAnswers && Object.keys(row.studentAnswers).length > 0) {
              scoreRecordPayload['studentAnswers'] = row.studentAnswers;
              assessmentRecordPayload['studentAnswers'] = row.studentAnswers;
              for (let q = 1; q <= 100; q++) {
                if (row.studentAnswers[`Stu${q}`] !== undefined) {
                  updatePayload[`${row.area.toLowerCase()}_Stu${q}`] = row.studentAnswers[`Stu${q}`];
                  updatePayload[`Stu${q}`] = row.studentAnswers[`Stu${q}`];
                }
              }
            }
            if (row.answerKeys && Object.keys(row.answerKeys).length > 0) {
              scoreRecordPayload['answerKeys'] = row.answerKeys;
              assessmentRecordPayload['answerKeys'] = row.answerKeys;
              for (let q = 1; q <= 100; q++) {
                if (row.answerKeys[`Key${q}`] !== undefined) {
                  updatePayload[`${row.area.toLowerCase()}_Key${q}`] = row.answerKeys[`Key${q}`];
                  updatePayload[`Key${q}`] = row.answerKeys[`Key${q}`];
                }
              }
            }
            if (row.quizName) {
              scoreRecordPayload['examTitle'] = row.quizName;
              assessmentRecordPayload['examTitle'] = row.quizName;
            }

            await updateDoc(userDocRef, updatePayload).catch(async () => {
              await setDoc(userDocRef, updatePayload, { merge: true });
            });

            await logProfileModification({
              editor: config.currentUser || { email: 'admin@samaritan.edu' },
              oldUser: user,
              updatedUser: { ...user, ...updatePayload },
              customActionType: 'profile_update',
              details: `Bulk score upload for ${row.area} (${row.category}): ${row.earnedScore}/${row.possiblePoints}`,
            });

            successCount++;
          } catch (err: any) {
            console.error('Failed to update score for row:', row, err);
            failedCount++;
            errorMessages.push(`${row.rawName || row.rawId}: ${err?.message || 'Update failed'}`);
          }
        })
      );

      const currentDone = Math.min(selectedRows.length, i + chunk.length);
      const percentDone = Math.round((currentDone / selectedRows.length) * 100);
      setProgress({
        current: currentDone,
        total: selectedRows.length,
        percent: percentDone,
      });

      setSummary((prev) => prev ? {
        ...prev,
        successCount,
        failedCount,
        errorMessages,
      } : null);
    }

    const endTime = new Date().toISOString();
    setIsUploading(false);
    setStatus(failedCount === selectedRows.length ? 'error' : 'completed');
    
    setSummary((prev) => prev ? {
      ...prev,
      successCount,
      failedCount,
      endTime,
      errorMessages,
    } : null);

    if (onComplete) {
      onComplete({
        totalProcessed: selectedRows.length,
        successCount,
        folderId: config.selectedFolderId || 'main',
      });
    }

    return successCount > 0;
  }, []);

  return (
    <ScoreUploadContext.Provider
      value={{
        isOpen,
        isMinimized,
        isUploading,
        progress,
        status,
        summary,
        activeRows,
        modalConfig,
        openUploadModal,
        closeUploadModal,
        minimizeModal,
        restoreModal,
        dismissSummary,
        startBackgroundUpload,
      }}
    >
      {children}
    </ScoreUploadContext.Provider>
  );
}

export function useScoreUpload() {
  const context = useContext(ScoreUploadContext);
  if (!context) {
    throw new Error('useScoreUpload must be used within a ScoreUploadProvider');
  }
  return context;
}
