import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Plus,
  CheckCircle2,
  Calendar,
  Folder,
  BookOpen,
  Award,
  AlertCircle,
  Search,
  User,
  Building2,
  TrendingUp,
  FileText,
  Check,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { useScoreFolders } from '../hooks/useScoreFolders';
import { useFirestoreUsers } from '../hooks/useFirestoreUsers';
import { resolveCanonicalUserIdentity, canonicalizeIdNumber } from '../services/userIdentityResolver';
import { logProfileModification } from '../services/activityLogService';
import { normalizeScoreCategory, normalizeScoreSubject, getScoreFieldName } from '../utils/scoreFieldResolver';
import { BulkScoreUploadModal } from './BulkScoreUploadModal';

function getCanonicalFullName(user: any): { displayName: string; formalName: string } {
  const canon = resolveCanonicalUserIdentity(user);
  const name = canon.fullName || canon.email || 'Reviewee';
  return { displayName: name, formalName: name };
}

const MAJOR_AREAS = [
  { code: 'CLJ', name: 'Criminal Law and Jurisprudence' },
  { code: 'LEA', name: 'Law Enforcement Administration' },
  { code: 'CDI', name: 'Crime Detection and Investigation' },
  { code: 'FS', name: 'Forensic Science' },
  { code: 'CRIM', name: 'Criminology' },
  { code: 'CA', name: 'Correctional Administration' },
];

const SUBJECTS_BY_AREA: Record<string, { code: string; title: string }[]> = {
  CLJ: [
    { code: 'CLJ 1', title: 'Introduction to Philippine Criminal Justice System' },
    { code: 'CLJ 2', title: 'Human Rights Education' },
    { code: 'CLJ 3', title: 'Criminal Law Book 1' },
    { code: 'CLJ 4', title: 'Criminal Law Book 2' },
    { code: 'CLJ 5', title: 'Evidence' },
    { code: 'CLJ 6', title: 'Criminal Procedure' },
    { code: 'CLJ 7', title: 'Court Testimony' },
  ],
  LEA: [
    { code: 'LEA 1', title: 'Law Enforcement Administration (Inter-Agency Approach)' },
    { code: 'LEA 2', title: 'Comparative Models in Policing' },
    { code: 'LEA 3', title: 'Introduction to Industrial Security Concepts' },
    { code: 'LEA 4', title: 'Law Enforcement Operation and Planning with Crime Mapping' },
    { code: 'CLFM 1', title: 'Character Formation, Nationalism, and Patriotism' },
    { code: 'CLFM 2', title: 'Leadership, Decision Making, Management, and Administration' },
  ],
  CDI: [
    { code: 'CDI 1', title: 'Fundamentals of Criminal Investigation with Intelligence' },
    { code: 'CDI 2', title: 'Specialized Crime Investigation 1 with Legal Medicine' },
    { code: 'CDI 3', title: 'Specialized Crime Investigation 2 with Simulation' },
    { code: 'CDI 4', title: 'Traffic Management and Accident Investigation with Driving' },
    { code: 'CDI 5', title: 'Technical English 1 (Investigative Report Writing)' },
    { code: 'CDI 6', title: 'Technical English 2 (Legal Forms)' },
    { code: 'CDI 7', title: 'Vice and Drug Education and Control' },
    { code: 'CDI 8', title: 'Organized Crime Investigation' },
    { code: 'CDI 9', title: 'Cybercrime and Environmental Laws and Protection' },
  ],
  FS: [
    { code: 'FS 1', title: 'Personal Identification Techniques' },
    { code: 'FS 2', title: 'Forensic Photography' },
    { code: 'FS 3', title: 'Forensic Chemistry and Toxicology' },
    { code: 'FS 4', title: 'Questioned Documents Examination' },
    { code: 'FS 5', title: 'Lie Detection Techniques' },
    { code: 'FS 6', title: 'Forensic Ballistics' },
  ],
  CRIM: [
    { code: 'CRIM 1', title: 'Introduction to Criminology' },
    { code: 'CRIM 2', title: 'Theories of Crime Causation' },
    { code: 'CRIM 3', title: 'Human Behavior and Victimology' },
    { code: 'CRIM 4', title: 'Professional Conduct and Ethical Standards' },
    { code: 'CRIM 5', title: 'Juvenile Delinquency and Juvenile Justice System' },
    { code: 'CRIM 6', title: 'Dispute Resolution and Crises Management' },
    { code: 'CRIM 7', title: 'Criminological Research 1' },
    { code: 'CRIM 8', title: 'Criminological Research 2' },
  ],
  CA: [
    { code: 'CA 1', title: 'Institutional Corrections' },
    { code: 'CA 2', title: 'Non-Institutional Corrections' },
    { code: 'CA 3', title: 'Therapeutic Modalities' },
  ],
};

const CATEGORIES = [
  'Daily Evaluation',
  'Diagnostic',
  'Pretest',
  'Posttest',
  'Quiz',
  'Removal',
  'Preboard',
];

interface AddScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers?: any[];
  currentUser: any;
  preselectedUser?: any | null;
  preselectedFolderId?: string | null;
  initialMode?: 'single' | 'bulk';
  onScoreAdded?: (result: { revieweeName: string; score: number; total: number }) => void;
}

export const AddScoreModal: React.FC<AddScoreModalProps> = ({
  isOpen,
  onClose,
  allUsers = [],
  currentUser,
  preselectedUser = null,
  preselectedFolderId = null,
  initialMode = 'single',
  onScoreAdded,
}) => {
  const { folders } = useScoreFolders();
  const { allUsers: firestoreUsers } = useFirestoreUsers();

  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>(() => initialMode);

  useEffect(() => {
    if (initialMode) {
      setEntryMode(initialMode);
    }
  }, [initialMode, isOpen]);

  const userSource = useMemo(() => {
    return allUsers && allUsers.length > 0 ? allUsers : firestoreUsers;
  }, [allUsers, firestoreUsers]);

  // Reviewee list (filter to reviewees only)
  const revieweeList = useMemo(() => {
    return userSource.filter((u) => {
      const role = String(u.role || u.userRole || 'Reviewee').toLowerCase();
      return role === 'reviewee' || role === 'student';
    });
  }, [userSource]);

  // Form State
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const [selectedFolderId, setSelectedFolderId] = useState<string>(() => preselectedFolderId || 'main');
  const [selectedCategory, setSelectedCategory] = useState<string>('Daily Evaluation');
  const [selectedArea, setSelectedArea] = useState<string>('CLJ');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('');
  const [examDate, setExamDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [earnedScore, setEarnedScore] = useState<string>('');
  const [totalItems, setTotalItems] = useState<string>('100');
  const [publicationStatus, setPublicationStatus] = useState<'published' | 'hidden'>('published');
  const [remarks, setRemarks] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Sync preselectedFolderId if provided
  useEffect(() => {
    if (preselectedFolderId) {
      setSelectedFolderId(preselectedFolderId);
    }
  }, [preselectedFolderId, isOpen]);

  // Initialize selected reviewee when modal opens or preselectedUser changes
  useEffect(() => {
    if (preselectedUser) {
      const id = preselectedUser.uid || preselectedUser.id || preselectedUser.doc_id;
      setSelectedUserId(id);
      const name = getCanonicalFullName(preselectedUser).displayName;
      setUserSearchQuery(name);
    } else if (revieweeList.length > 0 && !selectedUserId) {
      const firstId = revieweeList[0].uid || revieweeList[0].id || revieweeList[0].doc_id;
      setSelectedUserId(firstId);
      setUserSearchQuery(getCanonicalFullName(revieweeList[0]).displayName);
    }
  }, [preselectedUser, isOpen]);

  // Set default subject code when area changes
  useEffect(() => {
    const list = SUBJECTS_BY_AREA[selectedArea] || [];
    if (list.length > 0) {
      setSelectedSubjectCode(list[0].code);
    } else {
      setSelectedSubjectCode(selectedArea);
    }
  }, [selectedArea]);

  // Active selected user object
  const activeUser = useMemo(() => {
    return revieweeList.find((u) => (u.uid || u.id || u.doc_id) === selectedUserId) || null;
  }, [revieweeList, selectedUserId]);

  // Filtered reviewee candidates for search
  const filteredReviewees = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return revieweeList.slice(0, 15);
    return revieweeList
      .filter((u) => {
        const canon = getCanonicalFullName(u);
        const name = canon.displayName.toLowerCase();
        const idNum = String(u.seq_id || u.seqId || u.id_number || '').toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const school = String(u.school_name || u.schoolName || u.school || '').toLowerCase();
        return name.includes(q) || idNum.includes(q) || email.includes(q) || school.includes(q);
      })
      .slice(0, 20);
  }, [revieweeList, userSearchQuery]);

  // Score Calculation
  const numEarned = parseFloat(earnedScore);
  const numTotal = parseFloat(totalItems) || 100;
  const percentage = !isNaN(numEarned) && numTotal > 0 ? (numEarned / numTotal) * 100 : null;

  const ratingGrade = useMemo(() => {
    if (percentage === null) return null;
    if (percentage >= 90) return { label: 'Excellent', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (percentage >= 80) return { label: 'Very Good', color: 'text-teal-700 bg-teal-50 border-teal-200' };
    if (percentage >= 75) return { label: 'Good', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (percentage >= 60) return { label: 'Fair', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Needs Improvement', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  }, [percentage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedUserId || !activeUser) {
      setErrorMsg('Please select a valid reviewee to record scores for.');
      return;
    }

    if (isNaN(numEarned) || numEarned < 0) {
      setErrorMsg('Please enter a valid earned score (0 or greater).');
      return;
    }

    if (numTotal <= 0) {
      setErrorMsg('Total items must be greater than zero.');
      return;
    }

    if (numEarned > numTotal) {
      setErrorMsg(`Earned score (${numEarned}) cannot exceed total items (${numTotal}).`);
      return;
    }

    if (!firestoreDb) {
      setErrorMsg('Database connection is currently unavailable.');
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const normCatKey = normalizeScoreCategory(selectedCategory);
      const normSubjKey = normalizeScoreSubject(selectedArea);
      const cleanDate = examDate || nowIso.split('T')[0];

      // Build composite score keys
      const scoreRecordKey = `${selectedUserId}_${normCatKey}_${normSubjKey}_${cleanDate.replace(/[^0-9]/g, '')}`;
      const assessmentKey = `ar_${normCatKey}_${normSubjKey}_${cleanDate.replace(/[^0-9]/g, '')}`;

      const subjectObj = (SUBJECTS_BY_AREA[selectedArea] || []).find((s) => s.code === selectedSubjectCode);
      const fullSubjectLabel = subjectObj ? `${subjectObj.code} - ${subjectObj.title}` : selectedSubjectCode || selectedArea;

      // 1. Detailed score record payload for scoresByDate
      const scoreRecordPayload = {
        category: selectedCategory,
        categoryKey: normCatKey,
        area: selectedArea,
        subject: selectedSubjectCode || selectedArea,
        subjectTitle: fullSubjectLabel,
        score: numEarned,
        rawScore: numEarned,
        earnedPoints: numEarned,
        possiblePoints: numTotal,
        totalItems: numTotal,
        percentage: percentage !== null ? Number(percentage.toFixed(2)) : numEarned,
        date: cleanDate,
        scoreFolderId: selectedFolderId || 'main',
        folderId: selectedFolderId || 'main',
        publicationStatus: publicationStatus,
        remarks: remarks.trim() || 'Encoded via Admin Score Panel',
        source: 'Admin Score Entry',
        encodedBy: currentUser?.email || 'Admin',
        updatedAt: nowIso,
      };

      // 2. Assessment record for cross-compatibility
      const assessmentRecordPayload = {
        ...scoreRecordPayload,
        earnedScore: numEarned,
        totalScore: numTotal,
        createdAt: nowIso,
      };

      // 3. Flat field keys for legacy dashboards
      const flatFieldKey = getScoreFieldName(selectedCategory, selectedArea);
      const dateFieldKey = `date_${selectedArea.toLowerCase()}_${normCatKey}`;

      const userDocRef = doc(firestoreDb, 'users', selectedUserId);

      const updatePayload: Record<string, any> = {
        [`scoresByDate.${scoreRecordKey}`]: scoreRecordPayload,
        [`assessmentRecords.${assessmentKey}`]: assessmentRecordPayload,
        [`latestScores.${normCatKey}`]: scoreRecordPayload,
        [flatFieldKey]: numEarned,
        [dateFieldKey]: cleanDate,
        latestScoreUploadAt: nowIso,
        updatedAt: nowIso,
      };

      // Category-specific shorthand dates
      if (normCatKey === 'pretest' || normCatKey === 'diagnostic') {
        updatePayload[`date_${selectedArea.toLowerCase()}_diag`] = cleanDate;
        updatePayload[`diag_${selectedArea.toLowerCase()}`] = numEarned;
      } else if (normCatKey === 'posttest') {
        updatePayload[`date_${selectedArea.toLowerCase()}_post`] = cleanDate;
        updatePayload[`post_${selectedArea.toLowerCase()}`] = numEarned;
      } else if (normCatKey === 'preboard') {
        updatePayload[`date_${selectedArea.toLowerCase()}_preboard`] = cleanDate;
        updatePayload[`preboard_${selectedArea.toLowerCase()}`] = numEarned;
      }

      await updateDoc(userDocRef, updatePayload).catch(async () => {
        // Fallback to setDoc with merge if doc needs initialization
        await setDoc(userDocRef, updatePayload, { merge: true });
      });

      // 4. Log modification activity for audit history
      const revieweeName = getCanonicalFullName(activeUser).displayName;
      await logProfileModification({
        editor: currentUser,
        oldUser: activeUser,
        updatedUser: {
          ...activeUser,
          ...updatePayload,
        },
        customActionType: 'profile_update',
        details: `Added ${selectedCategory} score: ${numEarned}/${numTotal} (${percentage?.toFixed(1)}%) in ${selectedArea} (${selectedSubjectCode || selectedArea})`,
      });

      setSuccessToast(`Score for ${revieweeName} successfully saved and synced!`);

      if (onScoreAdded) {
        onScoreAdded({
          revieweeName,
          score: numEarned,
          total: numTotal,
        });
      }

      // Reset score entry fields for next input
      setEarnedScore('');
      setRemarks('');

      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Error saving score:', err);
      setErrorMsg(err?.message || 'Failed to save score. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (entryMode === 'bulk') {
    return (
      <BulkScoreUploadModal
        isOpen={isOpen}
        onClose={onClose}
        currentUser={currentUser}
        allUsers={allUsers}
        preselectedFolderId={selectedFolderId || preselectedFolderId}
        onUploadComplete={(res) => {
          if (onScoreAdded) {
            onScoreAdded({ revieweeName: 'Bulk Import', score: res.successCount, total: res.totalProcessed });
          }
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <Plus size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Add / Encode Reviewee Score
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Record official evaluation marks into Firestore in real time
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setEntryMode('single')}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer bg-white text-slate-900 shadow-sm font-extrabold"
            >
              <User size={14} className="text-teal-600" />
              <span>Single Entry</span>
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('bulk')}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900"
            >
              <FileSpreadsheet size={14} className="text-slate-500" />
              <span>Bulk CSV Upload</span>
              <span className="px-1.5 py-0.5 bg-teal-100 text-teal-800 text-[10px] font-black rounded-md">
                Batch
              </span>
            </button>
          </div>
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 font-bold">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Banner */}
          {successToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 font-extrabold animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successToast}</span>
            </div>
          )}

          {/* 1. Reviewee Selection */}
          <div className="space-y-1.5 relative">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
              Target Reviewee <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <div className="flex items-center gap-2 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus-within:bg-white focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/10 transition-all">
                <Search size={15} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search student by name, ID number, or school..."
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setIsUserDropdownOpen(true);
                  }}
                  onFocus={() => setIsUserDropdownOpen(true)}
                  className="w-full bg-transparent outline-none text-xs font-bold text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Autocomplete Dropdown */}
              {isUserDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                    {filteredReviewees.length === 0 ? (
                      <div className="p-3 text-center text-xs font-semibold text-slate-400">
                        No reviewees matching &ldquo;{userSearchQuery}&rdquo;
                      </div>
                    ) : (
                      filteredReviewees.map((u) => {
                        const canon = getCanonicalFullName(u);
                        const id = u.uid || u.id || u.doc_id;
                        const isSelected = id === selectedUserId;
                        const seq = u.seq_id || u.seqId || u.id_number || 'No ID';
                        const school = u.school_name || u.schoolName || u.school || 'Unassigned School';

                        return (
                          <div
                            key={id}
                            onClick={() => {
                              setSelectedUserId(id);
                              setUserSearchQuery(canon.displayName);
                              setIsUserDropdownOpen(false);
                            }}
                            className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected ? 'bg-teal-50/80 text-teal-900' : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-extrabold truncate">{canon.displayName}</p>
                              <p className="text-[10px] text-slate-500 font-semibold truncate flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-teal-700 bg-teal-50 px-1 rounded">{seq}</span>
                                <span>•</span>
                                <span className="truncate">{school}</span>
                              </p>
                            </div>
                            {isSelected && <Check size={14} className="text-teal-600 shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Selected User Summary Badge */}
            {activeUser && (
              <div className="p-2.5 bg-teal-50/60 rounded-xl border border-teal-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <User size={13} className="text-teal-600 shrink-0" />
                  <span className="font-bold text-teal-900 truncate">
                    {getCanonicalFullName(activeUser).displayName}
                  </span>
                </div>
                <span className="font-mono text-[10px] font-black text-teal-700 bg-white px-2 py-0.5 rounded-md border border-teal-200 shrink-0">
                  {activeUser.seq_id || activeUser.seqId || activeUser.id_number || 'SRC-ACTIVE'}
                </span>
              </div>
            )}
          </div>

          {/* 2. Folder & Category Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Score Folder <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-teal-500"
              >
                <option value="main">Main Score Folder (Default)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.folderType || f.type || 'Custom'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Examination Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-teal-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Major Board Area & Specific Subject Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Major Board Area <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-teal-500"
              >
                {MAJOR_AREAS.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Subject Course Code
              </label>
              <select
                value={selectedSubjectCode}
                onChange={(e) => setSelectedSubjectCode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-teal-500 truncate"
              >
                {(SUBJECTS_BY_AREA[selectedArea] || []).map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code}: {s.title}
                  </option>
                ))}
                <option value={selectedArea}>Area General ({selectedArea})</option>
              </select>
            </div>
          </div>

          {/* 4. Examination Date */}
          <div>
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Examination Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-teal-500"
              />
            </div>
          </div>

          {/* 5. Score Input & Realtime Rating */}
          <div className="p-4 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-3">
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Earned Score <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="e.g. 85"
                  value={earnedScore}
                  onChange={(e) => setEarnedScore(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Total Items <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  placeholder="100"
                  value={totalItems}
                  onChange={(e) => setTotalItems(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                />
              </div>
            </div>

            {/* Live Calculation Preview */}
            {percentage !== null && (
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Calculated Performance:</span>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-sm">{percentage.toFixed(2)}%</span>
                  {ratingGrade && (
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${ratingGrade.color}`}>
                      {ratingGrade.label}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 6. Publication Status & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Portal Visibility
              </label>
              <select
                value={publicationStatus}
                onChange={(e) => setPublicationStatus(e.target.value as 'published' | 'hidden')}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-teal-500"
              >
                <option value="published">Published (Visible Live in Portal)</option>
                <option value="hidden">Hidden / Draft (Staff Only)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Notes / Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Set A, Diagnostic Batch 1"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-teal-500"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || !earnedScore}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Saving Score...</span>
                </>
              ) : (
                <>
                  <Plus size={15} />
                  <span>Save & Sync Score</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
