import React, { useMemo, useState } from 'react';
import { 
  FileText, 
  TrendingUp, 
  Award, 
  CheckCircle2, 
  Check, 
  User, 
  Folder, 
  FolderSync, 
  Plus, 
  Upload,
  Search,
  Users,
  ChevronDown,
  Building2,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { RevieweeData, ScoreFolder } from '../../types';
import { ScoreRecord, parseScores } from '../../utils/scoreParser';
import { 
  normalizeScoreCategory, 
  normalizeScoreSubject, 
  isValidActiveRevieweeWithId, 
  getCanonicalRevieweeId, 
  isMatchingSubtopic 
} from '../../utils/scoreFieldResolver';
import { useScoreFolders } from '../../hooks/useScoreFolders';
import { useFirestoreUsers } from '../../hooks/useFirestoreUsers';
import { isRevieweeInFolderScope, isFolderMatching } from '../../utils/folderScope';
import { BoardMajorAreaCard } from './BoardMajorAreaCard';
import { isFolderVisibleToReviewee } from '../../constants/folderTypes';
import { deduplicateUsersByIdNumber } from '../../services/userIdentityResolver';
import { AdminFolderSyncViewer } from '../AdminFolderSyncViewer';
import { AddScoreModal } from '../AddScoreModal';
import { BulkScoreUploadModal } from '../BulkScoreUploadModal';
import { MajorAreaRevieweesBreakdownModal } from './MajorAreaRevieweesBreakdownModal';
import { isAdminLike } from '../../utils/roleUtils';
import { UserAvatar } from '../UserAvatar';
import { AnimatedSelect, AnimatedSelectOption } from '../ui/animated-select';

const SUBJECTS_BY_AREA: Record<string, { code: string; title: string }[]> = {
  "CLJ": [
    { code: "CLJ 1", title: "Introduction to Philippine Criminal Justice System" },
    { code: "CLJ 2", title: "Human Rights Education" },
    { code: "CLJ 3", title: "Criminal Law Book 1" },
    { code: "CLJ 4", title: "Criminal Law Book 2" },
    { code: "CLJ 5", title: "Evidence" },
    { code: "CLJ 6", title: "Criminal Procedure" },
    { code: "CLJ 7", title: "Court Testimony" },
  ],
  "LEA": [
    { code: "LEA 1", title: "Law Enforcement Administration (Inter-Agency Approach)" },
    { code: "LEA 2", title: "Comparative Models in Policing" },
    { code: "LEA 3", title: "Introduction to Industrial Security Concepts" },
    { code: "LEA 4", title: "Law Enforcement Operation and Planning with Crime Mapping" },
    { code: "CLFM 1", title: "Character Formation, Nationalism, and Patriotism" },
    { code: "CLFM 2", title: "Leadership, Decision Making, Management, and Administration" },
  ],
  "CDI": [
    { code: "CDI 1", title: "Fundamentals of Criminal Investigation with Intelligence" },
    { code: "CDI 2", title: "Specialized Crime Investigation 1 with Legal Medicine" },
    { code: "CDI 3", title: "Specialized Crime Investigation 2 with Simulation on Interrogation and Interview" },
    { code: "CDI 4", title: "Traffic Management and Accident Investigation with Driving" },
    { code: "CDI 5", title: "Technical English 1 (Investigative Report Writing and Presentation)" },
    { code: "CDI 6", title: "Technical English 2 (Legal Forms)" },
    { code: "CDI 7", title: "Vice and Drug Education and Control" },
    { code: "CDI 8", title: "Organized Crime Investigation" },
    { code: "CDI 9", title: "Introduction to Cybercrime and Environmental Laws and Protection" },
  ],
  "FS": [
    { code: "FS 1", title: "Personal Identification Techniques" },
    { code: "FS 2", title: "Forensic Photography" },
    { code: "FS 3", title: "Forensic Chemistry and Toxicology" },
    { code: "FS 4", title: "Questioned Documents Examination" },
    { code: "FS 5", title: "Lie Detection Techniques" },
    { code: "FS 6", title: "Forensic Ballistics" },
  ],
  "CRIM": [
    { code: "CRIM 1", title: "Introduction to Criminology" },
    { code: "CRIM 2", title: "Theories of Crime Causation" },
    { code: "CRIM 3", title: "Human Behavior and Victimology" },
    { code: "CRIM 4", title: "Professional Conduct and Ethical Standards" },
    { code: "CRIM 5", title: "Juvenile Delinquency and Juvenile Justice System" },
    { code: "CRIM 6", title: "Dispute Resolution and Crises/Incidents Management" },
    { code: "CRIM 7", title: "Criminological Research 1" },
    { code: "CRIM 8", title: "Criminological Research 2" },
  ],
  "CA": [
    { code: "CA 1", title: "Institutional Corrections" },
    { code: "CA 2", title: "Non-Institutional Corrections" },
    { code: "CA 3", title: "Therapeutic Modalities" },
  ]
};

const MAJOR_AREAS = ["CLJ", "LEA", "CDI", "FS", "CRIM", "CA"];
const CATEGORIES = ["Daily Evaluation", "Diagnostic", "Pretest", "Posttest", "Quiz", "Removal", "Preboard"];

function getScoreColor(rating: number) {
  if (rating >= 80) return { text: "text-teal-600", bg: "bg-teal-50", label: "Very Good" };
  if (rating >= 75) return { text: "text-emerald-600", bg: "bg-emerald-50", label: "Passing Standard" };
  if (rating >= 60) return { text: "text-blue-600", bg: "bg-blue-50", label: "Average" };
  if (rating >= 50) return { text: "text-orange-600", bg: "bg-orange-50", label: "Below Average" };
  return { text: "text-rose-600", bg: "bg-rose-50", label: "Needs Improvement" };
}

interface Props {
  currentUser: RevieweeData;
}

const DEFAULT_MAIN_SCORE_FOLDER: ScoreFolder = {
  id: 'main',
  name: 'Main Score Folder',
  normalizedName: 'main score folder',
  type: 'custom',
  description: 'Default main score folder',
  schoolScope: 'all',
  selectedSchoolIds: [],
  selectedSchoolNames: [],
  branchScope: 'all',
  selectedBranchIds: [],
  selectedBranchNames: [],
  startDate: null,
  endDate: null,
  publicationStatus: 'published',
  isArchived: false,
  includeInReadiness: true,
  readinessWeight: 1,
  displayOrder: 0,
  createdBy: 'system',
  createdAt: new Date().toISOString(),
  updatedBy: 'system',
  updatedAt: new Date().toISOString()
};

export default function RevieweeScoresDashboard({ currentUser }: Props) {
  const isStaffOrAdmin = isAdminLike(currentUser);
  const { folders } = useScoreFolders();
  const { allUsers } = useFirestoreUsers();

  const publishedFolders = useMemo(() => {
    const validFolders = folders.filter(f => 
      isFolderVisibleToReviewee(f, currentUser, isRevieweeInFolderScope)
    );
    if (validFolders.length === 0) {
      return [DEFAULT_MAIN_SCORE_FOLDER];
    }
    return validFolders;
  }, [folders, currentUser]);

  const [selectedFolder, setSelectedFolder] = useState<ScoreFolder | null>(null);
  const [isFolderSyncModalOpen, setIsFolderSyncModalOpen] = useState(false);
  const [isAddScoreModalOpen, setIsAddScoreModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [breakdownModalArea, setBreakdownModalArea] = useState<string | null>(null);

  // Filter reviewee users - ONLY active enrolled reviewees with an assigned ID number (deduplicated)
  const revieweesList = useMemo(() => {
    return deduplicateUsersByIdNumber(allUsers).filter(u => isValidActiveRevieweeWithId(u));
  }, [allUsers]);

  // Selected reviewee for Admin/Staff mode - defaults to active reviewee instead of 'all'
  const [selectedRevieweeId, setSelectedRevieweeId] = useState<string>('');
  const [revieweeSearchQuery, setRevieweeSearchQuery] = useState('');

  // Auto-initialize default reviewee to the first active reviewee (not 'all')
  React.useEffect(() => {
    if (isStaffOrAdmin && revieweesList.length > 0) {
      if (!selectedRevieweeId || (selectedRevieweeId !== 'all' && !revieweesList.some(u => (u.uid || (u as any).id || (u as any).doc_id) === selectedRevieweeId))) {
        const firstActive = revieweesList[0];
        const firstActiveId = firstActive.uid || (firstActive as any).id || (firstActive as any).doc_id;
        setSelectedRevieweeId(firstActiveId);
      }
    }
  }, [isStaffOrAdmin, revieweesList, selectedRevieweeId]);

  // Auto-initialize default folder
  React.useEffect(() => {
    if (publishedFolders.length > 0) {
      if (!selectedFolder || !publishedFolders.some(f => f.id === selectedFolder.id)) {
        setSelectedFolder(publishedFolders[0]);
      }
    } else {
      setSelectedFolder(null);
    }
  }, [publishedFolders, selectedFolder]);

  // Determine active target reviewee data
  const targetUser = useMemo(() => {
    if (!isStaffOrAdmin) {
      return currentUser;
    }
    if (selectedRevieweeId === 'all') {
      return null; // Cohort / All mode
    }
    return revieweesList.find(u => (u.uid || u.id || (u as any).doc_id) === selectedRevieweeId) || null;
  }, [isStaffOrAdmin, currentUser, selectedRevieweeId, revieweesList]);

  const [selectedMajorArea, setSelectedMajorArea] = useState("CLJ");
  const [selectedCategory, setSelectedCategory] = useState("Daily Evaluation");

  // Parse records based on targetUser or cohort
  const records = useMemo(() => {
    if (targetUser) {
      return parseScores(targetUser);
    }

    if (isStaffOrAdmin && selectedRevieweeId === 'all') {
      // Aggregate across all reviewees
      const allRecords: ScoreRecord[] = [];
      revieweesList.forEach(rev => {
        const revRecords = parseScores(rev);
        allRecords.push(...revRecords);
      });
      return allRecords;
    }

    return parseScores(currentUser);
  }, [targetUser, isStaffOrAdmin, selectedRevieweeId, revieweesList, currentUser]);

  // Filter records by selected folder
  const filteredRecords = useMemo(() => {
    if (!selectedFolder || selectedFolder.id === 'all') return records;
    return records.filter(r => isFolderMatching(r.scoreFolderId || (r as any).folderId, selectedFolder.id, selectedFolder.name));
  }, [records, selectedFolder]);

  // Aggregate Top-Level Metrics
  const totalEarnedOverall = filteredRecords.reduce((acc, r) => acc + (Number(r.score) || 0), 0);
  const totalPossibleOverall = filteredRecords.reduce((acc, r) => acc + (Number(r.totalItems) || 100), 0);
  const overallRating = totalPossibleOverall > 0 ? (totalEarnedOverall / totalPossibleOverall) * 100 : 0;
  
  const completedExams = new Set(filteredRecords.map(r => `${r.date}_${r.category}_${r.area}`)).size;

  // Major Area Stats
  const majorAreaStats = useMemo(() => {
    return MAJOR_AREAS.map(area => {
      const targetSubjNorm = normalizeScoreSubject(area);
      const areaRecords = filteredRecords.filter(r => {
        const rSubjNorm = normalizeScoreSubject(r.area);
        return rSubjNorm === targetSubjNorm || rSubjNorm.startsWith(targetSubjNorm);
      });
      const earned = areaRecords.reduce((acc, r) => acc + (Number(r.score) || 0), 0);
      const possible = areaRecords.reduce((acc, r) => acc + (Number(r.totalItems) || 100), 0);
      const rating = possible > 0 ? (earned / possible) * 100 : 0;
      return { area, rating, hasRecords: possible > 0, count: areaRecords.length };
    });
  }, [filteredRecords]);

  const highestArea = [...majorAreaStats].filter(s => s.hasRecords).sort((a, b) => b.rating - a.rating)[0];

  const MAJOR_AREA_TITLES: Record<string, string> = {
    "CLJ": "Criminal Law and Jurisprudence",
    "LEA": "Law Enforcement Administration",
    "CDI": "Crime Detection and Investigation",
    "FS": "Forensic Science",
    "CRIM": "Criminology",
    "CA": "Correctional Administration",
  };

  // Specific Category Records
  const currentCategoryRecords = useMemo(() => {
    const targetNormCat = normalizeScoreCategory(selectedCategory);
    return filteredRecords.filter(r => 
      normalizeScoreCategory(r.category) === targetNormCat
    );
  }, [filteredRecords, selectedCategory]);

  // Gather unique dates for the selected category & area
  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    const targetSubj = normalizeScoreSubject(selectedMajorArea);

    currentCategoryRecords.forEach(r => {
      const scoreSubj = normalizeScoreSubject(r.area);
      if (scoreSubj === targetSubj || scoreSubj.startsWith(targetSubj)) {
        if (r.date) dates.add(r.date);
      }
    });
    return Array.from(dates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [currentCategoryRecords, selectedMajorArea]);

  const subjects = useMemo(() => {
    const defaultSubjs = SUBJECTS_BY_AREA[selectedMajorArea] || [];
    return defaultSubjs;
  }, [selectedMajorArea]);

  // Compute table data for sub-subjects
  const tableData = useMemo(() => {
    return subjects.map(subj => {
      const subjRecords = currentCategoryRecords.filter(r => isMatchingSubtopic(r.area, subj.code, subj.title));

      let rowEarned = 0;
      let rowPossible = 0;
      const dateScores: Record<string, { earned: number; possible: number; count: number }> = {};
      
      if (uniqueDates.length > 0) {
        uniqueDates.forEach(d => {
          const recs = subjRecords.filter(r => r.date === d);
          if (recs.length > 0) {
            const sumEarned = recs.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
            const sumPossible = recs.reduce((sum, r) => sum + (Number(r.totalItems) || 100), 0);
            dateScores[d] = {
              earned: Number((sumEarned / recs.length).toFixed(1)),
              possible: Number((sumPossible / recs.length).toFixed(0)),
              count: recs.length
            };
            rowEarned += dateScores[d].earned;
            rowPossible += dateScores[d].possible;
          }
        });
      } else if (subjRecords.length > 0) {
        subjRecords.forEach(rec => {
          rowEarned += Number(rec.score) || 0;
          rowPossible += Number(rec.totalItems) || 100;
        });
      }

      return {
        subject: subj,
        dateScores,
        rowEarned,
        rowPossible,
        rating: rowPossible > 0 ? (rowEarned / rowPossible) * 100 : 0,
        hasRecords: rowPossible > 0
      };
    });
  }, [subjects, currentCategoryRecords, uniqueDates]);

  // Major Area Level Score Records (e.g. general area examination scores like "FS", "CLJ", etc.)
  const majorAreaWideRecords = useMemo(() => {
    const targetNormArea = normalizeScoreSubject(selectedMajorArea);
    return currentCategoryRecords.filter(r => {
      const scoreSubj = normalizeScoreSubject(r.area);
      return scoreSubj === targetNormArea;
    });
  }, [currentCategoryRecords, selectedMajorArea]);

  const majorAreaWideData = useMemo(() => {
    if (majorAreaWideRecords.length === 0) return null;
    
    let rowEarned = 0;
    let rowPossible = 0;
    const dateScores: Record<string, { earned: number; possible: number; count: number }> = {};
    
    uniqueDates.forEach(d => {
      const recs = majorAreaWideRecords.filter(r => r.date === d);
      if (recs.length > 0) {
        const sumEarned = recs.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
        const sumPossible = recs.reduce((sum, r) => sum + (Number(r.totalItems) || 100), 0);
        dateScores[d] = {
          earned: Number((sumEarned / recs.length).toFixed(1)),
          possible: Number((sumPossible / recs.length).toFixed(0)),
          count: recs.length,
        };
        rowEarned += dateScores[d].earned;
        rowPossible += dateScores[d].possible;
      }
    });

    return {
      subject: { 
        code: selectedMajorArea, 
        title: `${MAJOR_AREA_TITLES[selectedMajorArea] || selectedMajorArea} (Comprehensive / Area Score)` 
      },
      dateScores,
      rowEarned,
      rowPossible,
      rating: rowPossible > 0 ? (rowEarned / rowPossible) * 100 : 0,
      hasRecords: rowPossible > 0
    };
  }, [majorAreaWideRecords, uniqueDates, selectedMajorArea, MAJOR_AREA_TITLES]);

  // Combined totals for the area
  const totalAreaEarned = tableData.reduce((acc, row) => acc + row.rowEarned, 0) + (majorAreaWideData?.rowEarned || 0);
  const totalAreaPossible = tableData.reduce((acc, row) => acc + row.rowPossible, 0) + (majorAreaWideData?.rowPossible || 0);
  const totalAreaRating = totalAreaPossible > 0 ? (totalAreaEarned / totalAreaPossible) * 100 : 0;

  // Options for AnimatedSelect Reviewee Dropdown Card
  const revieweeSelectOptions = useMemo<AnimatedSelectOption[]>(() => {
    const list: AnimatedSelectOption[] = [
      {
        value: 'all',
        label: 'All Reviewees (Class Cohort)',
        description: 'Aggregate class performance matrix & distribution',
        badge: `${revieweesList.length} Students`,
        icon: <Users size={14} className="text-teal-600" />,
      },
    ];

    revieweesList.forEach(u => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.displayName || u.email;
      const idNum = getCanonicalRevieweeId(u);
      const school = (u as any).school || (u as any).school_name || 'Enrolled Reviewee';
      const uid = u.uid || (u as any).id || (u as any).doc_id;

      list.push({
        value: uid,
        label: name,
        description: `ID: ${idNum} • ${school}`,
        badge: idNum,
      });
    });

    return list;
  }, [revieweesList]);

  return (
    <div className="flex flex-col h-full bg-white overflow-auto">
      <div className="space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="text-teal-600" size={24} />
              <span>Score Management & Performance Matrix</span>
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
              Review examination ratings, evaluation dates, and major area score distributions in real time.
            </p>
          </div>
          <div className="bg-teal-50/80 px-3.5 py-1.5 rounded-xl border border-teal-200/80 flex items-center gap-2 self-start sm:self-auto shadow-2xs">
            <TrendingUp className="text-teal-600" size={15} />
            <span className="text-xs font-black text-teal-800">Live Synchronized</span>
          </div>
        </div>

        {/* ADMIN / STAFF: Reviewee Student Selector Bar */}
        {isStaffOrAdmin && (
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-3.5 sm:p-4 shadow-md border border-slate-700/70 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                  Target Reviewee Performance Scope
                  <span className="text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full border border-teal-400/30">
                    {revieweesList.length} Reviewees
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300 font-medium">
                  {selectedRevieweeId === 'all' 
                    ? 'Showing aggregated class cohort performance across all reviewees' 
                    : targetUser 
                    ? `Showing individual score records for ${targetUser.first_name} ${targetUser.last_name} (${targetUser.seq_id || targetUser.id_number || 'No ID'})`
                    : 'Select a reviewee to inspect individual scores'}
                </p>
              </div>
            </div>

            {/* Selector Animated Dropdown Card */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0 lg:max-w-md w-full">
              <div className="flex-1 min-w-0">
                <AnimatedSelect
                  value={selectedRevieweeId}
                  options={revieweeSelectOptions}
                  onChange={setSelectedRevieweeId}
                  placeholder="Select a reviewee..."
                  searchPlaceholder="Search reviewee by name or ID..."
                  label="Target Reviewee Performance Scope"
                  variant="compact-popover"
                  triggerClassName="h-10 bg-slate-800/90 border-slate-600/90 text-white hover:bg-slate-800 hover:border-teal-400/50 shadow-sm"
                  triggerTextClassName="text-white font-bold text-xs"
                />
              </div>

              {selectedRevieweeId !== 'all' ? (
                <button
                  type="button"
                  onClick={() => setSelectedRevieweeId('all')}
                  className="px-3 h-10 bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 flex items-center justify-center border border-slate-600/70 whitespace-nowrap"
                  title="Switch to All Reviewees cohort summary"
                >
                  Cohort View
                </button>
              ) : (
                revieweesList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const firstActive = revieweesList[0];
                      const firstActiveId = firstActive.uid || (firstActive as any).id || (firstActive as any).doc_id;
                      setSelectedRevieweeId(firstActiveId);
                    }}
                    className="px-3 h-10 bg-teal-700/80 hover:bg-teal-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 flex items-center justify-center border border-teal-500/70 whitespace-nowrap"
                    title="Switch back to active reviewee view"
                  >
                    Active Reviewee
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* Published Folder Selector Bar & Action Controls */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Folder size={14} className="text-slate-500" />
            Folder:
          </span>
          {publishedFolders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setSelectedFolder(folder)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedFolder?.id === folder.id
                  ? 'bg-slate-900 text-white shadow-sm scale-[1.02]'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Folder size={13} className={selectedFolder?.id === folder.id ? "text-teal-400" : "text-slate-400"} />
              <span>{folder.name}</span>
            </button>
          ))}
          {publishedFolders.length === 0 && (
            <div className="text-xs font-bold text-slate-400 italic py-1.5">No published score folders</div>
          )}

          {isStaffOrAdmin && (
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsBulkUploadModalOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                title="Upload examination scores in bulk via CSV spreadsheet or ZipGrade"
              >
                <Upload size={13} className="stroke-[2.5]" />
                <span>Upload CSV</span>
              </button>
              <button
                onClick={() => setIsAddScoreModalOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white shadow-xs cursor-pointer"
                title="Add or encode a new score"
              >
                <Plus size={13} className="stroke-[3]" />
                <span>Add Score</span>
              </button>
              <button
                onClick={() => setIsFolderSyncModalOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200/80 shadow-2xs cursor-pointer"
                title="Verify and synchronize folders created by admin"
              >
                <FolderSync size={13} className="text-teal-600" />
                <span className="hidden sm:inline">Sync Hub</span>
              </button>
            </div>
          )}
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-teal-50 text-teal-600 border border-teal-200/60 flex items-center justify-center shrink-0">
              <TrendingUp size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider truncate">
                {selectedRevieweeId === 'all' && isStaffOrAdmin ? 'Cohort Average' : 'Overall Rating'}
              </p>
              <p className="text-lg sm:text-xl font-black text-slate-900 font-mono tracking-tight">
                {overallRating.toFixed(2)}%
              </p>
              <p className={`text-[10px] font-extrabold truncate ${getScoreColor(overallRating).text}`}>
                {getScoreColor(overallRating).label}
              </p>
            </div>
          </div>
          
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
              <Award size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider truncate">Highest Major Area</p>
              <p className="text-lg sm:text-xl font-black text-slate-900 truncate">{highestArea?.area || 'N/A'}</p>
              {highestArea && highestArea.hasRecords ? (
                <p className={`text-[10px] font-extrabold truncate ${getScoreColor(highestArea.rating).text}`}>
                  {highestArea.rating.toFixed(2)}% average
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 font-medium">Awaiting exams</p>
              )}
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center shrink-0">
              <FileText size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider truncate">Evaluations Recorded</p>
              <p className="text-lg sm:text-xl font-black text-slate-900 font-mono">{filteredRecords.length}</p>
              <p className="text-[10px] font-bold text-slate-400 truncate">{completedExams} distinct sessions</p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <User size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider truncate">
                {selectedRevieweeId === 'all' && isStaffOrAdmin ? 'Cohort Scope' : 'Reviewee ID'}
              </p>
              <p className="text-sm sm:text-base font-black text-slate-900 truncate font-mono">
                {targetUser 
                  ? (targetUser.seq_id || targetUser.seqId || targetUser.id_number || 'No ID')
                  : selectedRevieweeId === 'all'
                  ? `${revieweesList.length} Students`
                  : (currentUser.seq_id || currentUser.id_number || 'No ID')}
              </p>
              <p className="text-[10px] font-bold text-slate-500 truncate">
                {targetUser 
                  ? `${targetUser.first_name || ''} ${targetUser.last_name || ''}`.trim()
                  : selectedRevieweeId === 'all'
                  ? 'All Enrolled Reviewees'
                  : `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()}
              </p>
            </div>
          </div>
        </div>

        {/* Board Major Area Grid Cards */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <span>Board Major Areas (6 Subject Areas)</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-extrabold border border-slate-200">
                  Double-click to view reviewee subtopic list
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Click any major area card to switch the matrix inspection view. <strong className="text-teal-700">Double-click</strong> any card to open the complete reviewee subtopic scores table.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBreakdownModalArea(selectedMajorArea)}
                className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title={`Open full ${selectedMajorArea} subtopic reviewee breakdown table`}
              >
                <Users size={13} className="text-teal-600" />
                <span>Open {selectedMajorArea} Subtopics</span>
              </button>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-1 rounded-lg">
                Active: {selectedMajorArea}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {majorAreaStats.map(stat => {
              const isSelected = selectedMajorArea === stat.area;
              const colors: Record<string, string> = {
                CLJ: '#10B981',
                LEA: '#3B82F6',
                CDI: '#0D9488',
                FS: '#8B5CF6',
                CRIM: '#10B981',
                CA: '#06B6D4'
              };
              const color = colors[stat.area.toUpperCase()] || '#10B981';
              
              return (
                <BoardMajorAreaCard
                  key={stat.area}
                  areaCode={stat.area}
                  title={MAJOR_AREA_TITLES[stat.area] || stat.area}
                  percentage={stat.rating}
                  color={color}
                  watermark={stat.area}
                  isSelected={isSelected}
                  onClick={() => setSelectedMajorArea(stat.area)}
                  onDoubleClick={() => setBreakdownModalArea(stat.area)}
                />
              );
            })}
          </div>
        </div>

        {/* Target Category Matrix Section */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Selected Major Area:</span>
                <span className="text-teal-700 font-mono">{selectedMajorArea}</span>
                <span className="text-xs text-slate-400 font-normal">({MAJOR_AREA_TITLES[selectedMajorArea]})</span>
              </h2>
            </div>

            {/* Category Selector Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black uppercase text-slate-400 mr-1">Category:</span>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-teal-700 text-white shadow-xs font-black'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/90 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr>
                    <th rowSpan={2} className="px-3.5 py-3 bg-[#0f172a] text-white font-black w-10 text-center border-r border-slate-700/60">#</th>
                    <th rowSpan={2} className="px-3.5 py-3 bg-[#0f172a] text-white font-black min-w-[260px] border-r border-slate-700/60">Subject & Examination Title</th>
                    <th colSpan={Math.max(uniqueDates.length, 1)} className="px-3.5 py-2 bg-[#1e293b] text-teal-300 text-center font-black uppercase tracking-wider text-[10px] border-b border-slate-700/60 border-r border-slate-700/60">
                      {selectedCategory} Scores ({selectedMajorArea})
                    </th>
                    <th rowSpan={2} className="px-3.5 py-3 bg-[#0f172a] text-white font-black text-center w-28 border-r border-slate-700/60">
                      Combined<br/><span className="text-[9px] font-normal text-slate-400">Total Points</span>
                    </th>
                    <th rowSpan={2} className="px-3.5 py-3 bg-[#0f172a] text-white font-black text-center w-24">
                      Rating<br/><span className="text-[9px] font-normal text-slate-400">(Percentage)</span>
                    </th>
                  </tr>
                  <tr>
                    {uniqueDates.length === 0 ? (
                      <th className="px-3.5 py-2 bg-[#0f172a] text-slate-400 text-center text-[10px] font-semibold border-r border-slate-700/60">
                        No examination dates recorded in this category
                      </th>
                    ) : (
                      uniqueDates.map(date => (
                        <th key={date} className="px-3 py-2 bg-[#0f172a] text-slate-200 text-center text-[10px] font-bold border-r border-slate-700/60 whitespace-nowrap">
                          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {/* Comprehensive Area Row if available */}
                  {majorAreaWideData && (
                    <tr className="bg-teal-50/40 hover:bg-teal-50/70 transition-colors border-b-2 border-teal-200/80">
                      <td className="px-3.5 py-3 text-center text-teal-700 font-black border-r border-teal-100">★</td>
                      <td className="px-3.5 py-3 text-teal-950 font-black border-r border-teal-100">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-teal-600 text-white text-[9px] font-black">{selectedMajorArea}</span>
                          <span>{majorAreaWideData.subject.title}</span>
                        </div>
                      </td>
                      {uniqueDates.length === 0 ? (
                        <td className="px-3.5 py-3 text-center text-slate-300 border-r border-teal-100">-</td>
                      ) : (
                        uniqueDates.map(date => {
                          const val = majorAreaWideData.dateScores[date];
                          return (
                            <td key={date} className="px-3.5 py-3 text-center border-r border-teal-100 font-black bg-teal-50/60">
                              {val ? (
                                <span className="text-teal-800 font-mono font-black">{val.earned}/{val.possible}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })
                      )}
                      <td className="px-3.5 py-3 text-center border-r border-teal-100 font-black bg-teal-100/50 text-teal-900 font-mono">
                        {majorAreaWideData.hasRecords ? `${majorAreaWideData.rowEarned}/${majorAreaWideData.rowPossible}` : '-'}
                      </td>
                      <td className="px-3.5 py-3 text-center font-black bg-teal-100/60">
                        {majorAreaWideData.hasRecords ? (
                          <span className="text-teal-800 font-mono">{majorAreaWideData.rating.toFixed(2)}%</span>
                        ) : (
                          <span className="text-slate-400 font-bold">0.00%</span>
                        )}
                      </td>
                    </tr>
                  )}

                  {/* Sub-Subject Rows */}
                  {tableData.map((row, idx) => (
                    <tr key={row.subject.code} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-2.5 text-center text-slate-400 font-semibold border-r border-slate-100">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 text-slate-800 border-r border-slate-100">
                        <span className="font-black text-slate-900 mr-1.5">{row.subject.code}</span>
                        <span className="text-slate-600 text-xs">{row.subject.title}</span>
                      </td>
                      {uniqueDates.length === 0 ? (
                        <td className="px-3.5 py-2.5 text-center text-slate-300 border-r border-slate-100">-</td>
                      ) : (
                        uniqueDates.map(date => {
                          const val = row.dateScores[date];
                          return (
                            <td key={date} className="px-3 py-2.5 text-center border-r border-slate-100">
                              {val ? (
                                <span className="font-bold font-mono text-slate-800">{val.earned}/{val.possible}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })
                      )}
                      <td className="px-3.5 py-2.5 text-center border-r border-slate-100 font-bold bg-slate-50/40 text-slate-800 font-mono">
                        {row.hasRecords ? `${row.rowEarned}/${row.rowPossible}` : '-'}
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-black bg-slate-50/40">
                        {row.hasRecords ? (
                          <span className={`${getScoreColor(row.rating).text} font-mono`}>{row.rating.toFixed(2)}%</span>
                        ) : (
                          <span className="text-slate-400 font-bold font-mono">0.00%</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {tableData.length === 0 && !majorAreaWideData && (
                    <tr>
                      <td colSpan={5 + Math.max(uniqueDates.length, 1)} className="px-4 py-8 text-center text-slate-500 font-medium">
                        No evaluation scores found for {selectedMajorArea} in category "{selectedCategory}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Area Matrix Total Summary Footer */}
            <div className="bg-slate-50 border-t border-slate-200/80 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900">Total {selectedMajorArea} ({selectedCategory}):</span>
                  <p className="text-[11px] text-slate-500 font-medium">Combined score and performance index for this category</p>
                </div>
              </div>
              <div className="flex items-baseline gap-3 self-end sm:self-auto">
                <span className="text-sm font-bold font-mono text-slate-600">{totalAreaEarned} / {totalAreaPossible} pts</span>
                <span className="text-base font-black font-mono text-teal-800">{totalAreaRating.toFixed(2)}%</span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getScoreColor(totalAreaRating).bg} ${getScoreColor(totalAreaRating).text}`}>
                  {getScoreColor(totalAreaRating).label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isFolderSyncModalOpen && (
        <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-50 rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col min-h-0 animate-in zoom-in-95">
            <AdminFolderSyncViewer
              currentUser={currentUser}
              isModal={true}
              onClose={() => setIsFolderSyncModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Add / Encode Score Modal */}
      {isAddScoreModalOpen && (
        <AddScoreModal
          isOpen={isAddScoreModalOpen}
          onClose={() => setIsAddScoreModalOpen(false)}
          allUsers={allUsers}
          currentUser={currentUser}
          preselectedUser={targetUser || (currentUser?.role === 'Reviewee' ? currentUser : null)}
          preselectedFolderId={selectedFolder?.id}
        />
      )}

      {/* Bulk CSV Score Upload Modal */}
      {isBulkUploadModalOpen && (
        <BulkScoreUploadModal
          isOpen={isBulkUploadModalOpen}
          onClose={() => setIsBulkUploadModalOpen(false)}
          allUsers={allUsers}
          currentUser={currentUser}
          preselectedFolderId={selectedFolder?.id}
        />
      )}

      {/* Double-Click Major Area Subtopics Reviewee Breakdown Modal */}
      {breakdownModalArea && (
        <MajorAreaRevieweesBreakdownModal
          isOpen={!!breakdownModalArea}
          onClose={() => setBreakdownModalArea(null)}
          areaCode={breakdownModalArea}
          allUsers={allUsers}
          folders={publishedFolders}
          selectedFolderId={selectedFolder?.id || 'all'}
          initialCategory={selectedCategory}
        />
      )}
    </div>
  );
}
