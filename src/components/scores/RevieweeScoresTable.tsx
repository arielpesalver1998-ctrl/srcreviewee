import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Download,
  MoreVertical,
  Plus,
  Eye,
  Edit,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  X,
  Filter,
  Folder,
  FolderOpen,
} from 'lucide-react';
import {
  computeRevieweeRowScores,
  sortScoreMatrixRows,
  RevieweeScoreMatrixRow,
  SortField,
  SortOrder,
  MAJOR_AREA_KEYS,
  MAJOR_AREA_LABELS,
  SUBJECTS_BY_AREA,
} from './scoreMatrixUtils';
import { downloadRegisteredUsersCsv } from '../../utils/exportUsersCsv';
import { isCanonicalActiveReviewee } from '../../utils/canonicalActiveReviewee';
import { UserAvatar } from '../UserAvatar';
import { AnimatedSelect, AnimatedSelectOption } from '../ui/animated-select';
import { useScoreFolders } from '../../hooks/useScoreFolders';
import { firestoreDb } from '../../utils/firebaseClient';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { hasScoreEditPermission } from '../../utils/roleUtils';
import { logProfileModification } from '../../services/activityLogService';
import { calculateAreaContribution } from '../../utils/categoryRating';
import { normalizeScoreCategory, normalizeScoreSubject, getScoreFieldName } from '../../utils/scoreFieldResolver';

interface EditableScoreCellProps {
  userUid: string;
  userName: string;
  userIdNumber: string;
  category: string;
  subjectKey: string;
  initialValue: number | null;
  maxScore?: number;
  canEdit: boolean;
  isEditing: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onInitiateSave: (newVal: string) => void;
  draftValue: string;
  onDraftChange: (val: string) => void;
  weightPercent: number;
}

const EditableScoreCell: React.FC<EditableScoreCellProps> = ({
  userUid,
  userName,
  userIdNumber,
  category,
  subjectKey,
  initialValue,
  maxScore = 100,
  canEdit,
  isEditing,
  onStartEditing,
  onCancelEditing,
  onInitiateSave,
  draftValue,
  onDraftChange,
  weightPercent,
}) => {
  const numericDraft = parseFloat(draftValue);
  const livePercentage = !isNaN(numericDraft) ? numericDraft * weightPercent : (initialValue !== null ? initialValue * weightPercent : 0);

  if (!isEditing) {
    return (
      <div className="flex flex-col items-center justify-center py-1.5 px-2 min-h-[50px] w-full">
        <div className="flex items-center justify-between w-full gap-2">
          <span className="font-bold tabular-nums text-slate-900 text-xs">
            {initialValue !== null ? `${initialValue} / ${maxScore}` : `— / ${maxScore}`}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={onStartEditing}
              aria-label={`Edit ${subjectKey.toUpperCase()} score for ${userName}`}
              className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              Edit
            </button>
          )}
        </div>
        <span className="text-[10px] font-bold text-teal-700 mt-1 tabular-nums self-start">
          {initialValue !== null ? `${(initialValue * weightPercent).toFixed(2)}%` : '0.00%'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-1.5 px-1 min-h-[50px] w-full bg-blue-50/60 rounded-xl p-2 border border-blue-200">
      <div className="flex items-center justify-between w-full gap-1">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            max={maxScore}
            value={draftValue}
            onChange={(e) => onDraftChange(e.target.value)}
            autoFocus
            className="w-[52px] text-center font-bold tabular-nums text-xs h-7 bg-white border border-teal-600 rounded text-slate-950 focus:outline-hidden shadow-xs"
          />
          <span className="text-slate-500 font-semibold text-[11px]">/ {maxScore}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onInitiateSave(draftValue)}
            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold text-[10px] rounded-lg cursor-pointer shadow-2xs transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancelEditing}
            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] rounded-lg cursor-pointer transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
      <span className="text-[10px] font-bold text-teal-700 mt-1 tabular-nums self-start">
        {!isNaN(numericDraft) ? `${livePercentage.toFixed(2)}%` : '0.00%'}
      </span>
    </div>
  );
};
import {
  ScoresHeader,
  StatusBadge,
  ScoresPagination,
  ScoresTable,
} from '../ui/ScoresTable';
import { parseScores } from '../../utils/scoreParser';

interface RevieweeScoresTableProps {
  role: 'admin' | 'staff';
  users: any[];
  currentUser?: any;
  onAddScore?: (user: any) => void;
  onEditUser?: (user: any) => void;
  onViewProfile?: (user: any) => void;
  isLoading?: boolean;
}

export const RevieweeScoresTable: React.FC<RevieweeScoresTableProps> = ({
  role,
  users,
  currentUser,
  onAddScore,
  onEditUser,
  onViewProfile,
  isLoading = false,
}) => {
  // Search & Academic Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [majorAreaFilter, setMajorAreaFilter] = useState('all');
  const [subtopicFilter, setSubtopicFilter] = useState('all');

  // Folders filtering state
  const { folders, loading: loadingFolders } = useScoreFolders();
  const [folderFilter, setFolderFilter] = useState('all');

  // Sorting state (Default: Name A-Z)
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Active action menu row UID
  const [activeMenuUid, setActiveMenuUid] = useState<string | null>(null);

  // 1. Filter out only canonical active reviewees
  const revieweesOnly = useMemo(() => {
    return users.filter((u) => isCanonicalActiveReviewee(u));
  }, [users]);

  // 2. Extract unique available categories from all reviewee score records
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    const defaults = ['Diagnostic Exam', 'Pre-Board', 'Pre-Test', 'Post-Test', 'Marathon', 'Coaching', 'Final Coaching', 'Daily Evaluation', 'Quiz', 'Removal'];
    defaults.forEach(d => set.add(d));

    revieweesOnly.forEach((u) => {
      const records = parseScores(u);
      records.forEach(r => {
        if (r.category && String(r.category).trim()) {
          set.add(String(r.category).trim());
        }
      });
    });

    return Array.from(set).sort();
  }, [revieweesOnly]);

  // 3. Subtopics for selected major area
  const availableSubtopics = useMemo(() => {
    if (majorAreaFilter === 'all' || !SUBJECTS_BY_AREA[majorAreaFilter]) {
      return [];
    }
    return SUBJECTS_BY_AREA[majorAreaFilter];
  }, [majorAreaFilter]);

  // 4. Compute score matrix rows with academic filters
  const allMatrixRows = useMemo(() => {
    return revieweesOnly.map((u) => computeRevieweeRowScores(u, categoryFilter, majorAreaFilter, subtopicFilter, folderFilter));
  }, [revieweesOnly, categoryFilter, majorAreaFilter, subtopicFilter, folderFilter]);

  // 5. Apply Search Filter
  const filteredRows = useMemo(() => {
    return allMatrixRows.filter((row) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = row.name.toLowerCase().includes(q);
        const matchesId = row.idNumber.toLowerCase().includes(q);
        const matchesEmail = row.email.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesEmail) return false;
      }
      return true;
    });
  }, [allMatrixRows, searchQuery]);

  // 6. Apply Sorting
  const sortedRows = useMemo(() => {
    return sortScoreMatrixRows(filteredRows, sortField, sortOrder);
  }, [filteredRows, sortField, sortOrder]);

  // 7. Pagination Calculations
  const totalItems = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, safeCurrentPage, pageSize]);

  // Toggle sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'name' || field === 'idNumber' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="text-slate-300 opacity-60 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={12} className="text-blue-600" />
    ) : (
      <ArrowDown size={12} className="text-blue-600" />
    );
  };

  // Clear filters handler
  const handleClearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setMajorAreaFilter('all');
    setSubtopicFilter('all');
    setFolderFilter('all');
    setCurrentPage(1);
  };

  const isFiltersActive = categoryFilter !== 'all' || majorAreaFilter !== 'all' || subtopicFilter !== 'all' || folderFilter !== 'all' || searchQuery.trim() !== '';

  const categoryOptions = useMemo<AnimatedSelectOption[]>(() => {
    return [
      { value: 'all', label: 'All Categories' },
      ...availableCategories.map((cat) => ({ value: cat, label: cat })),
    ];
  }, [availableCategories]);

  const majorAreaOptions = useMemo<AnimatedSelectOption[]>(() => {
    return [
      { value: 'all', label: 'All Major Areas' },
      ...MAJOR_AREA_KEYS.map((k) => ({
        value: k,
        label: `${k.toUpperCase()} — ${MAJOR_AREA_LABELS[k].full.split('(')[0].trim()}`,
      })),
    ];
  }, []);

  const subtopicOptions = useMemo<AnimatedSelectOption[]>(() => {
    return [
      {
        value: 'all',
        label: majorAreaFilter === 'all' ? 'Select Major Area First' : `All ${majorAreaFilter.toUpperCase()} Subtopics`,
      },
      ...availableSubtopics.map((sub) => ({
        value: sub.code,
        label: `${sub.code}: ${sub.title}`,
      })),
    ];
  }, [majorAreaFilter, availableSubtopics]);

  // Export Scores CSV
  const [isExporting, setIsExporting] = useState(false);
  const handleExportScores = async () => {
    try {
      setIsExporting(true);
      const filteredUsers = sortedRows.map((r) => r.user);
      await downloadRegisteredUsersCsv(filteredUsers);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const canEdit = hasScoreEditPermission(currentUser);

  const [editingCell, setEditingCell] = useState<{
    userUid: string;
    subjectKey: string;
    originalScore: number | null;
    draftValue: string;
    maxScore: number;
  } | null>(null);

  const [pendingEditingCell, setPendingEditingCell] = useState<{
    userUid: string;
    subjectKey: string;
    originalScore: number | null;
    draftValue: string;
    maxScore: number;
  } | null>(null);

  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const [confirmationModalData, setConfirmationModalData] = useState<{
    userUid: string;
    userName: string;
    userIdNumber: string;
    category: string;
    subjectKey: string;
    oldScore: number | null;
    newScore: number;
    maxScore: number;
    oldPercentage: number;
    newPercentage: number;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const getWeightFactor = (subjectKey: string): number => {
    const map: Record<string, number> = { clj: 0.20, lea: 0.15, fs: 0.20, cdi: 0.20, crim: 0.15, ca: 0.10 };
    return map[subjectKey.toLowerCase()] || 0.20;
  };

  const handleStartEditing = (userUid: string, subjectKey: string, initialValue: number | null, userName: string, idNumber: string) => {
    if (!canEdit) return;
    const draft = initialValue !== null ? String(initialValue) : '';
    const newCellState = { userUid, subjectKey, originalScore: initialValue, draftValue: draft, maxScore: 100 };

    if (editingCell && (editingCell.userUid !== userUid || editingCell.subjectKey !== subjectKey)) {
      const hasUnsavedChanges = editingCell.draftValue !== (editingCell.originalScore !== null ? String(editingCell.originalScore) : '');
      if (hasUnsavedChanges) {
        setPendingEditingCell(newCellState);
        setUnsavedModalOpen(true);
        return;
      }
    }
    setEditingCell(newCellState);
  };

  const handleDiscardAndProceed = () => {
    if (pendingEditingCell) {
      setEditingCell(pendingEditingCell);
      setPendingEditingCell(null);
    }
    setUnsavedModalOpen(false);
  };

  const handleInitiateSave = (newValStr: string) => {
    if (!editingCell) return;
    setToastMessage(null);

    const trimmed = newValStr.trim();
    if (trimmed === '') {
      setToastMessage('Score cannot be blank.');
      return;
    }

    const num = Number(trimmed);
    if (!Number.isFinite(num) || isNaN(num)) {
      setToastMessage('Score must be a valid number.');
      return;
    }

    if (num < 0) {
      setToastMessage('Score cannot be negative.');
      return;
    }

    if (num > editingCell.maxScore) {
      setToastMessage(`Score cannot exceed ${editingCell.maxScore}.`);
      return;
    }

    if (editingCell.originalScore !== null && num === editingCell.originalScore) {
      setToastMessage('No changes to save.');
      return;
    }

    const reviewee = users.find(u => (u.uid || u.id || u.doc_id) === editingCell.userUid);
    if (!reviewee) {
      setToastMessage('Reviewee record not found.');
      return;
    }

    const revieweeName = reviewee.fullName || [reviewee.first_name, reviewee.last_name].filter(Boolean).join(' ') || 'Reviewee';
    const idNumber = reviewee.id_number || reviewee.studentId || reviewee.seqId || '—';
    const weight = getWeightFactor(editingCell.subjectKey);

    const oldScore = editingCell.originalScore;
    const newScore = num;
    const oldPct = oldScore !== null ? oldScore * weight : 0;
    const newPct = newScore * weight;

    setConfirmationModalData({
      userUid: editingCell.userUid,
      userName: revieweeName,
      userIdNumber: idNumber,
      category: categoryFilter,
      subjectKey: editingCell.subjectKey,
      oldScore,
      newScore,
      maxScore: editingCell.maxScore,
      oldPercentage: oldPct,
      newPercentage: newPct,
    });
  };

  const handleConfirmSave = async () => {
    if (!confirmationModalData || !editingCell) return;
    if (!canEdit) {
      setToastMessage('You do not have permission to edit this score.');
      return;
    }

    setIsSaving(true);
    setToastMessage(null);

    try {
      const reviewee = users.find(u => (u.uid || u.id || u.doc_id) === confirmationModalData.userUid);
      if (!reviewee) {
        throw new Error('Reviewee record not found.');
      }

      const catKey = normalizeScoreCategory(confirmationModalData.category);
      const subjKey = normalizeScoreSubject(confirmationModalData.subjectKey);
      const flatFieldKey = getScoreFieldName(confirmationModalData.category, confirmationModalData.subjectKey);

      const currentStoredScore = reviewee[flatFieldKey] ?? null;
      if (editingCell.originalScore !== null && currentStoredScore !== null && Number(currentStoredScore) !== Number(editingCell.originalScore)) {
        throw new Error(`This score was modified by another authorized user (current: ${currentStoredScore}). Please refresh before saving.`);
      }

      const nowIso = new Date().toISOString();
      const cleanDate = nowIso.split('T')[0];
      const scoreRecordKey = `${confirmationModalData.userUid}_${catKey}_${subjKey}_${cleanDate.replace(/[^0-9]/g, '')}`;
      const assessmentKey = `ar_${catKey}_${subjKey}_${cleanDate.replace(/[^0-9]/g, '')}`;

      const scoreRecordPayload = {
        category: confirmationModalData.category,
        categoryKey: catKey,
        area: confirmationModalData.subjectKey.toUpperCase(),
        subject: confirmationModalData.subjectKey.toUpperCase(),
        subjectTitle: `${confirmationModalData.subjectKey.toUpperCase()} - Manual Safe Edit`,
        score: confirmationModalData.newScore,
        rawScore: confirmationModalData.newScore,
        earnedPoints: confirmationModalData.newScore,
        possiblePoints: confirmationModalData.maxScore,
        totalItems: confirmationModalData.maxScore,
        percentage: confirmationModalData.newScore,
        date: cleanDate,
        scoreFolderId: folderFilter !== 'all' ? folderFilter : 'main',
        folderId: folderFilter !== 'all' ? folderFilter : 'main',
        publicationStatus: 'published',
        remarks: 'Manual safe edit via Score Management Matrix',
        source: 'Admin/Staff Score Edit',
        encodedBy: currentUser?.email || 'Admin/Staff',
        updatedAt: nowIso,
      };

      const userDocRef = doc(firestoreDb, 'users', confirmationModalData.userUid);
      const updatePayload: Record<string, any> = {
        [`scoresByDate.${scoreRecordKey}`]: scoreRecordPayload,
        [`assessmentRecords.${assessmentKey}`]: scoreRecordPayload,
        [`latestScores.${catKey}`]: scoreRecordPayload,
        [flatFieldKey]: confirmationModalData.newScore,
        [`date_${subjKey}_${catKey}`]: cleanDate,
        latestScoreUploadAt: nowIso,
        updatedAt: nowIso,
      };

      if (catKey === 'pretest' || catKey === 'diagnostic') {
        updatePayload[`date_${subjKey}_diag`] = cleanDate;
        updatePayload[`diag_${subjKey}`] = confirmationModalData.newScore;
      } else if (catKey === 'posttest') {
        updatePayload[`date_${subjKey}_post`] = cleanDate;
        updatePayload[`post_${subjKey}`] = confirmationModalData.newScore;
      } else if (catKey === 'preboard') {
        updatePayload[`date_${subjKey}_preboard`] = cleanDate;
        updatePayload[`preboard_${subjKey}`] = confirmationModalData.newScore;
      }

      await updateDoc(userDocRef, updatePayload).catch(async () => {
        await setDoc(userDocRef, updatePayload, { merge: true });
      });

      await logProfileModification({
        editor: currentUser,
        oldUser: reviewee,
        updatedUser: {
          ...reviewee,
          ...updatePayload,
        },
        customActionType: 'profile_update',
        details: `Updated ${confirmationModalData.subjectKey.toUpperCase()} score for ${confirmationModalData.userName} (${confirmationModalData.category}) from ${confirmationModalData.oldScore ?? '—'} to ${confirmationModalData.newScore}`,
      });

      setToastMessage(null);
      setConfirmationModalData(null);
      setEditingCell(null);
    } catch (err: any) {
      console.error('Failed to save score:', err);
      setToastMessage(err.message || 'Score could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-5">
      {/* HEADER SECTION */}
      <ScoresHeader
        title="Reviewee Scores"
        subtitle={
          role === 'admin'
            ? 'Manage and monitor reviewee performance'
            : 'Monitor reviewee performance'
        }
        action={
          <button
            type="button"
            onClick={handleExportScores}
            disabled={isExporting}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export Scores</span>
            <span className="sm:hidden">Export</span>
          </button>
        }
      />

      {/* ACADEMIC ASSESSMENT TOOLBAR (No Branch/School/Batch/Status) */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 sm:gap-3 bg-slate-50/80 p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Search Reviewee (Largest width on desktop) */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search Reviewee..."
            className="w-full pl-9 pr-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400 shadow-2xs h-10"
          />
        </div>

        {/* Category Filter */}
        <div className="min-w-[160px] flex-1 sm:flex-initial">
          <AnimatedSelect
            value={categoryFilter}
            options={categoryOptions}
            onChange={(val) => {
              setCategoryFilter(val);
              setCurrentPage(1);
            }}
            placeholder="All Categories"
            searchable={false}
            triggerClassName="h-10 bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-2xs rounded-xl"
            triggerTextClassName="text-slate-700 font-bold text-xs"
          />
        </div>

        {/* Major Area Filter */}
        <div className="min-w-[170px] flex-1 sm:flex-initial">
          <AnimatedSelect
            value={majorAreaFilter}
            options={majorAreaOptions}
            onChange={(val) => {
              setMajorAreaFilter(val);
              setSubtopicFilter('all');
              setCurrentPage(1);
            }}
            placeholder="All Major Areas"
            searchable={false}
            triggerClassName="h-10 bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-2xs rounded-xl"
            triggerTextClassName="text-slate-700 font-bold text-xs"
          />
        </div>

        {/* Subtopic Filter (Dependent on Major Area) */}
        <div className="min-w-[180px] flex-1 sm:flex-initial">
          <AnimatedSelect
            value={subtopicFilter}
            options={subtopicOptions}
            disabled={majorAreaFilter === 'all'}
            onChange={(val) => {
              setSubtopicFilter(val);
              setCurrentPage(1);
            }}
            placeholder={majorAreaFilter === 'all' ? 'Select Major Area First' : 'All Subtopics'}
            searchable={false}
            triggerClassName="h-10 bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-2xs rounded-xl disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            triggerTextClassName="text-slate-700 font-bold text-xs"
          />
        </div>

        {/* Clear Filters Option */}
        {isFiltersActive && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-3 py-2 bg-slate-200/80 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer h-10 shrink-0 justify-center"
            title="Reset all filters"
          >
            <X size={14} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* SCORE FOLDERS BAR */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <FolderOpen size={14} className="text-blue-500" />
            <span>Filter by Score Folder</span>
          </h3>
          {folderFilter !== 'all' && (
            <button
              onClick={() => setFolderFilter('all')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
          {/* All Folders Option */}
          <button
            onClick={() => {
              setFolderFilter('all');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left transition-all min-w-[140px] shrink-0 cursor-pointer ${
              folderFilter === 'all'
                ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
            }`}
          >
            {folderFilter === 'all' ? <FolderOpen size={16} /> : <Folder size={16} className="text-slate-400" />}
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">All Folders</p>
              <p className={`text-[10px] font-medium truncate ${folderFilter === 'all' ? 'text-blue-100' : 'text-slate-400'}`}>
                Unfiltered Matrix
              </p>
            </div>
          </button>

          {/* Dynamic Firestore Folders */}
          {folders.map((fold) => {
            const isActive = folderFilter === fold.id;
            return (
              <button
                key={fold.id}
                onClick={() => {
                  setFolderFilter(fold.id);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left transition-all min-w-[160px] max-w-[220px] shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {isActive ? <FolderOpen size={16} /> : <Folder size={16} className="text-blue-500" />}
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{fold.name}</p>
                  <p className={`text-[10px] font-medium truncate ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    {(fold as any).category || fold.type || 'General'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTIVE FILTER SUMMARY */}
      {isFiltersActive && (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-blue-50/70 border border-blue-100/80 px-3.5 py-2 rounded-xl">
          <Filter size={14} className="text-blue-600 shrink-0" />
          <span>
            Viewing scores for: <strong className="text-slate-900">{categoryFilter !== 'all' ? categoryFilter : 'All Categories'}</strong>
            {' • '}
            <strong className="text-slate-900">{majorAreaFilter !== 'all' ? majorAreaFilter.toUpperCase() : 'All Major Areas'}</strong>
            {subtopicFilter !== 'all' && <> {' • '} <strong className="text-slate-900">{subtopicFilter}</strong></>}
            {folderFilter !== 'all' && <> {' • '} Folder: <strong className="text-slate-900">{folders.find(f => f.id === folderFilter)?.name || folderFilter}</strong></>}
            {searchQuery && <> {' • '} Search: "<strong className="text-slate-900">{searchQuery}</strong>"</>}
          </span>
        </div>
      )}

      {/* MANUAL INLINE EDITING GUIDE BANNER */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs font-semibold text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse shrink-0" />
          <div className="min-w-0">
            <p className="font-extrabold text-slate-800 text-xs">
              {categoryFilter !== 'all' 
                ? `✏️ Manual Inline Score Editing Enabled for Category: "${categoryFilter}"`
                : "ℹ️ Select a Specific Score Category above to enable Manual Inline Score Editing"}
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {categoryFilter !== 'all'
                ? "Click any score box to modify, then click outside or press Enter to save instantly. Weighted % is displayed below each score."
                : "Choose a specific assessment (e.g. Diagnostic Exam, Pre-Board) to type and save reviewee scores directly inside the table columns."}
            </p>
          </div>
        </div>
        {categoryFilter !== 'all' && (
          <span className="px-2.5 py-1 bg-teal-50 text-teal-800 text-[10px] font-extrabold uppercase tracking-wider rounded-lg border border-teal-200 shrink-0 self-start sm:self-auto">
            Editable Mode
          </span>
        )}
      </div>

      {/* TABLE CONTAINER CARD WITH STICKY REVIEWEE COLUMN SUPPORT */}
      <ScoresTable swipeIndicator={true}>
        <table className="w-full border-collapse text-left text-xs">
          {/* TABLE HEADER */}
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80 text-[11px] uppercase tracking-wider sticky top-0 z-20">
            <tr>
              {/* # Column */}
              <th scope="col" className="py-3 w-10 min-w-[40px] max-w-[40px] text-center font-bold text-slate-500 bg-slate-50 sticky left-0 z-30 lg:relative border-r border-slate-200/80 lg:border-r-0">
                #
              </th>

              {/* Reviewee Identity Column */}
              <th
                scope="col"
                onClick={() => handleSort('name')}
                className="py-3 px-3.5 min-w-[170px] sm:min-w-[220px] font-bold cursor-pointer hover:text-slate-900 group bg-slate-50 sticky left-10 lg:static z-30 border-r border-slate-200/80 lg:border-r-0"
              >
                <div className="flex items-center gap-1.5">
                  <span>Reviewee</span>
                  {renderSortIcon('name')}
                </div>
              </th>

              {/* Major Area Columns (or Filtered Score Column) */}
              {majorAreaFilter === 'all' ? (
                MAJOR_AREA_KEYS.map((key) => {
                  const weightPercent = 
                    key === 'clj' ? '20%' :
                    key === 'lea' ? '15%' :
                    key === 'fs' ? '20%' :
                    key === 'cdi' ? '20%' :
                    key === 'crim' ? '15%' :
                    key === 'ca' ? '10%' : '';
                  return (
                    <th
                      key={key}
                      scope="col"
                      onClick={() => handleSort(key as SortField)}
                      className="py-2 px-2 w-[70px] sm:w-[78px] text-center font-bold cursor-pointer hover:text-slate-900 group"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1">
                          <span>{key.toUpperCase()}</span>
                          {renderSortIcon(key as SortField)}
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold tracking-normal mt-0.5 lowercase">
                          {weightPercent}
                        </span>
                      </div>
                    </th>
                  );
                })
              ) : (
                <th
                  scope="col"
                  onClick={() => handleSort(majorAreaFilter as SortField)}
                  className="py-3 px-4 text-center font-bold cursor-pointer hover:text-slate-900 group min-w-[120px]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{majorAreaFilter.toUpperCase()} {subtopicFilter !== 'all' ? `(${subtopicFilter})` : 'Score'}</span>
                    {renderSortIcon(majorAreaFilter as SortField)}
                  </div>
                </th>
              )}

              {/* Total Score Column */}
              <th
                scope="col"
                className="py-3 px-2 w-[90px] text-center font-bold text-slate-500 bg-slate-50 border-r border-slate-100"
              >
                <div className="flex flex-col items-center justify-center">
                  <span>Total Score</span>
                  <span className="text-[9px] font-semibold text-slate-400 normal-case tracking-normal">Sum / 600</span>
                </div>
              </th>

              {/* Percentage Column */}
              <th
                scope="col"
                onClick={() => handleSort('average')}
                className="py-3 px-3 w-[105px] text-center font-bold cursor-pointer hover:text-slate-900 group"
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>Percentage</span>
                    {renderSortIcon('average')}
                  </div>
                  <span className="text-[9px] font-semibold text-slate-400 normal-case tracking-normal">Weighted Rating</span>
                </div>
              </th>

              {/* Status Column */}
              <th
                scope="col"
                onClick={() => handleSort('status')}
                className="py-3 px-3 w-[100px] text-center font-bold cursor-pointer hover:text-slate-900 group"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Status</span>
                  {renderSortIcon('status')}
                </div>
              </th>

              {/* Action Column */}
              <th scope="col" className="py-3 px-2 w-[60px] text-center font-bold text-slate-500">
                Action
              </th>
            </tr>
          </thead>

          {/* TABLE BODY */}
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400 font-medium">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Loading reviewee scores...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-500 font-medium">
                  <div className="max-w-md mx-auto space-y-2 p-4">
                    <p className="font-bold text-slate-800 text-sm">No scores found for the selected assessment.</p>
                    <p className="text-xs text-slate-500">Try changing the Category, Major Area, or Subtopic filter, or clear filters to view all records.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => {
                const globalIndex = sortedRows.indexOf(row) + 1;
                const isMenuOpen = activeMenuUid === row.uid;

                return (
                  <tr
                    key={row.uid}
                    className="hover:bg-slate-50/80 transition-colors group text-slate-800"
                  >
                    {/* # Index Column */}
                    <td className="py-3.5 w-10 min-w-[40px] max-w-[40px] text-center font-bold text-slate-400 bg-white group-hover:bg-slate-50/80 sticky left-0 z-10 lg:relative border-r border-slate-100/60 lg:border-r-0">
                      {globalIndex}
                    </td>

                    {/* Reviewee Identity Column */}
                    <td className="py-3.5 px-3.5 font-bold text-slate-900 bg-white group-hover:bg-slate-50/80 sticky left-10 lg:static z-10 border-r border-slate-100/80 lg:border-r-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar photoURL={row.user.photoURL} altText={row.name} size={28} />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate leading-tight">
                            {row.name}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono font-semibold mt-0.5">
                            {row.idNumber}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Score Columns */}
                    {majorAreaFilter === 'all' ? (
                      [
                        { key: 'clj', val: row.clj, w: 0.20 },
                        { key: 'lea', val: row.lea, w: 0.15 },
                        { key: 'fs', val: row.fs, w: 0.20 },
                        { key: 'cdi', val: row.cdi, w: 0.20 },
                        { key: 'crim', val: row.crim, w: 0.15 },
                        { key: 'ca', val: row.ca, w: 0.10 },
                      ].map(({ key, val, w }) => {
                        const isSelectedCellEditing = editingCell?.userUid === row.uid && editingCell?.subjectKey === key;
                        return (
                          <td key={key} className="py-1 px-1 text-center">
                            {categoryFilter !== 'all' ? (
                              <EditableScoreCell
                                userUid={row.uid}
                                userName={row.name}
                                userIdNumber={row.idNumber}
                                category={categoryFilter}
                                subjectKey={key}
                                initialValue={val}
                                maxScore={100}
                                canEdit={canEdit}
                                isEditing={isSelectedCellEditing}
                                onStartEditing={() => handleStartEditing(row.uid, key, val, row.name, row.idNumber)}
                                onCancelEditing={() => setEditingCell(null)}
                                onInitiateSave={handleInitiateSave}
                                draftValue={isSelectedCellEditing ? editingCell.draftValue : (val !== null ? String(val) : '')}
                                onDraftChange={(dVal) => {
                                  if (editingCell && editingCell.userUid === row.uid && editingCell.subjectKey === key) {
                                    setEditingCell({ ...editingCell, draftValue: dVal });
                                  }
                                }}
                                weightPercent={w}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center py-1.5 px-2">
                                <span className="font-bold tabular-nums text-slate-900 text-xs">{val !== null ? `${val} / 100` : '— / 100'}</span>
                                <span className="text-[10px] font-bold text-teal-700 mt-0.5 tabular-nums">{val !== null ? `${(val * w).toFixed(2)}%` : '0.00%'}</span>
                              </div>
                            )}
                          </td>
                        );
                      })
                    ) : (
                      <td className="py-3.5 px-4 text-center font-black tabular-nums text-blue-900 text-sm">
                        {row.filteredScore !== null && row.filteredScore !== undefined ? row.filteredScore : '—'}
                      </td>
                    )}

                    {/* Total Score Column */}
                    <td className="py-3.5 px-2 text-center font-bold tabular-nums text-slate-700 bg-slate-50/40 border-r border-slate-100">
                      {(() => {
                        const scoreValues = [row.clj, row.lea, row.fs, row.cdi, row.crim, row.ca];
                        const sum = scoreValues.reduce((acc: number, val) => acc + (val !== null ? val : 0), 0);
                        const anyScores = scoreValues.some(val => val !== null);
                        return anyScores ? `${sum.toFixed(1)}/600` : '—';
                      })()}
                    </td>

                    {/* Percentage Column */}
                    <td className="py-3.5 px-3 text-center font-black tabular-nums text-teal-800 text-sm">
                      {row.average !== null ? `${row.average.toFixed(2)}%` : '—'}
                    </td>

                    {/* Status Column */}
                    <td className="py-3.5 px-3 text-center">
                      <StatusBadge status={row.status} />
                    </td>

                    {/* Action Menu Column */}
                    <td className="py-3.5 px-2 text-center relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuUid(isMenuOpen ? null : row.uid)}
                        aria-label={`Actions for ${row.name}`}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Action Menu Popover */}
                      {isMenuOpen && (
                        <div
                          className="absolute right-2 top-10 z-50 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 text-left text-xs font-semibold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onAddScore && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuUid(null);
                                onAddScore(row.user);
                              }}
                              className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                            >
                              <Plus size={14} />
                              <span>Add Score</span>
                            </button>
                          )}

                          {onViewProfile && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuUid(null);
                                onViewProfile(row.user);
                              }}
                              className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                            >
                              <Eye size={14} />
                              <span>View Profile</span>
                            </button>
                          )}

                          {role === 'admin' && onEditUser && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuUid(null);
                                onEditUser(row.user);
                              }}
                              className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                            >
                              <Edit size={14} />
                              <span>Edit Reviewee</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ScoresTable>

      {/* FOOTER & PAGINATION */}
      <ScoresPagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        itemName="reviewees"
        className="pt-1"
      />

      {/* UNSAVED CHANGES PROMPT MODAL */}
      {unsavedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-md:w-full max-w-sm p-6 space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Unsaved Score Change</h3>
              <p className="text-xs text-slate-500">You have an unsaved score change. Do you want to keep editing or discard changes?</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUnsavedModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleDiscardAndProceed}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE SCORE CONFIRMATION MODAL */}
      {confirmationModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-md:w-full max-w-md p-6 space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Save Score Changes?</h3>
              <p className="text-xs text-slate-500">Please review the score modification before confirming database write.</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-xs border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Reviewee:</span>
                <span className="font-bold text-slate-900">{confirmationModalData.userName} ({confirmationModalData.userIdNumber})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Category:</span>
                <span className="font-bold text-slate-900">{confirmationModalData.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Major Area:</span>
                <span className="font-bold text-slate-900 uppercase">{confirmationModalData.subjectKey}</span>
              </div>
              <hr className="border-slate-200" />
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Raw Score:</span>
                <div className="flex items-center gap-2">
                  <span className="line-through text-slate-400 font-bold">{confirmationModalData.oldScore !== null ? `${confirmationModalData.oldScore} / ${confirmationModalData.maxScore}` : `— / ${confirmationModalData.maxScore}`}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-black text-teal-700 text-sm">{confirmationModalData.newScore} / {confirmationModalData.maxScore}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Weighted %:</span>
                <div className="flex items-center gap-2">
                  <span className="line-through text-slate-400 font-bold">{confirmationModalData.oldScore !== null ? `${(confirmationModalData.oldScore * getWeightFactor(confirmationModalData.subjectKey)).toFixed(2)}%` : '0.00%'}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-black text-teal-700 text-sm">{confirmationModalData.newPercentage.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {toastMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
                {toastMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setConfirmationModalData(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmSave}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Confirm Save</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INLINE ERROR TOAST (IF ANY OTHER ERROR) */}
      {toastMessage && !confirmationModalData && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
