import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Download,
  Filter,
  Users,
  Award,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Folder,
  BarChart2,
  FileSpreadsheet,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import { RevieweeData, ScoreFolder } from '../../types';
import { ScoreRecord, parseScores } from '../../utils/scoreParser';
import { 
  normalizeScoreSubject, 
  normalizeScoreCategory, 
  isValidActiveRevieweeWithId, 
  getCanonicalRevieweeId, 
  isMatchingSubtopic 
} from '../../utils/scoreFieldResolver';
import { isFolderMatching } from '../../utils/folderScope';
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

const MAJOR_AREA_TITLES: Record<string, string> = {
  "CLJ": "Criminal Law and Jurisprudence",
  "LEA": "Law Enforcement Administration",
  "CDI": "Crime Detection and Investigation",
  "FS": "Forensic Science",
  "CRIM": "Criminology",
  "CA": "Correctional Administration",
};

const CATEGORIES = ["All Categories", "Daily Evaluation", "Diagnostic", "Pretest", "Posttest", "Quiz", "Removal", "Preboard"];

interface MajorAreaRevieweesBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  areaCode: string;
  allUsers: RevieweeData[];
  folders: ScoreFolder[];
  selectedFolderId?: string;
  initialCategory?: string;
}

export function MajorAreaRevieweesBreakdownModal({
  isOpen,
  onClose,
  areaCode,
  allUsers,
  folders,
  selectedFolderId = 'all',
  initialCategory = 'All Categories',
}: MajorAreaRevieweesBreakdownModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory || 'All Categories');
  const [activeFolderId, setActiveFolderId] = useState<string>(selectedFolderId || 'all');
  const [sortBy, setSortBy] = useState<'percentage_desc' | 'percentage_asc' | 'id' | 'name'>('percentage_desc');

  const subtopics = useMemo(() => {
    return SUBJECTS_BY_AREA[areaCode] || [];
  }, [areaCode]);

  const activeFolder = useMemo(() => {
    if (activeFolderId === 'all') return null;
    return folders.find(f => f.id === activeFolderId) || null;
  }, [folders, activeFolderId]);

  const folderSelectOptions = useMemo<AnimatedSelectOption[]>(() => {
    return [
      {
        value: 'all',
        label: 'All Folders',
        description: 'Pooled across all score folders',
        badge: 'All',
        icon: <Folder size={14} className="text-teal-600" />,
      },
      ...folders.map(f => ({
        value: f.id,
        label: f.name,
        description: f.description || `Folder ID: ${f.id}`,
        badge: 'Folder',
        icon: <Folder size={14} className="text-slate-500" />,
      })),
    ];
  }, [folders]);

  const sortSelectOptions: AnimatedSelectOption[] = [
    { value: 'percentage_desc', label: 'Highest Rating (%)', description: 'Rank from highest to lowest score', badge: 'Top', icon: <TrendingUp size={14} className="text-emerald-600" /> },
    { value: 'percentage_asc', label: 'Lowest Rating (%)', description: 'Rank from lowest to highest score', badge: 'Asc', icon: <ArrowUpDown size={14} className="text-amber-600" /> },
    { value: 'id', label: 'Reviewee ID Number', description: 'Numeric sequence order', badge: 'ID', icon: <Sparkles size={14} className="text-blue-600" /> },
    { value: 'name', label: 'Reviewee Name (A-Z)', description: 'Alphabetical student name', badge: 'A-Z', icon: <Users size={14} className="text-purple-600" /> },
  ];

  // Filter ONLY active enrolled reviewees with an ID number (exclude dropped, pending, unverified, staff, admin)
  const reviewees = useMemo(() => {
    return allUsers.filter(u => isValidActiveRevieweeWithId(u));
  }, [allUsers]);

  // Calculate reviewee scores across the subtopics for the selected area
  const revieweeRows = useMemo(() => {
    const targetNormCat = activeCategory === 'All Categories' ? null : normalizeScoreCategory(activeCategory);

    return reviewees.map(user => {
      const allParsed = parseScores(user);

      // Filter by folder if selected
      const folderFiltered = activeFolder
        ? allParsed.filter(r => isFolderMatching(r.scoreFolderId || (r as any).folderId, activeFolder.id, activeFolder.name))
        : allParsed;

      // Filter by category if selected
      const catFiltered = targetNormCat
        ? folderFiltered.filter(r => normalizeScoreCategory(r.category) === targetNormCat)
        : folderFiltered;

      // Map scores per subtopic
      const subtopicScores: Record<string, { earned: number; possible: number; percentage: number; hasScore: boolean; count: number }> = {};
      let totalEarned = 0;
      let totalPossible = 0;

      subtopics.forEach(sub => {
        const matchingRecs = catFiltered.filter(r => isMatchingSubtopic(r.area, sub.code, sub.title));

        if (matchingRecs.length > 0) {
          const sumEarned = matchingRecs.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
          const sumPossible = matchingRecs.reduce((sum, r) => sum + (Number(r.totalItems) || 100), 0);
          const pct = sumPossible > 0 ? (sumEarned / sumPossible) * 100 : 0;

          subtopicScores[sub.code] = {
            earned: Number(sumEarned.toFixed(1)),
            possible: Number(sumPossible.toFixed(0)),
            percentage: Number(pct.toFixed(1)),
            hasScore: true,
            count: matchingRecs.length,
          };

          totalEarned += sumEarned;
          totalPossible += sumPossible;
        } else {
          subtopicScores[sub.code] = {
            earned: 0,
            possible: 0,
            percentage: 0,
            hasScore: false,
            count: 0,
          };
        }
      });

      // Also check if user has comprehensive major area records (e.g. area = "CLJ")
      const compTargetNorm = normalizeScoreSubject(areaCode);
      const compRecs = catFiltered.filter(r => {
        const rNorm = normalizeScoreSubject(r.area);
        return rNorm === compTargetNorm && !subtopics.some(sub => isMatchingSubtopic(r.area, sub.code, sub.title));
      });

      if (compRecs.length > 0) {
        const compEarned = compRecs.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
        const compPossible = compRecs.reduce((sum, r) => sum + (Number(r.totalItems) || 100), 0);
        totalEarned += compEarned;
        totalPossible += compPossible;
      }

      const overallPercentage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
      const idNumber = getCanonicalRevieweeId(user);
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.displayName || user.email || 'Unnamed';

      return {
        user,
        idNumber,
        fullName,
        subtopicScores,
        totalEarned: Number(totalEarned.toFixed(1)),
        totalPossible: Number(totalPossible.toFixed(0)),
        percentage: Number(overallPercentage.toFixed(2)),
        hasEvaluations: totalPossible > 0,
      };
    });
  }, [reviewees, activeFolder, activeCategory, subtopics, areaCode]);

  // Filter by search query & Sort
  const filteredAndSortedRows = useMemo(() => {
    let result = revieweeRows;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => {
        const idMatch = r.idNumber.toLowerCase().includes(q);
        const nameMatch = r.fullName.toLowerCase().includes(q);
        const schoolMatch = ((r.user as any).school || (r.user as any).school_name || '').toLowerCase().includes(q);
        return idMatch || nameMatch || schoolMatch;
      });
    }

    // Sort
    return [...result].sort((a, b) => {
      if (sortBy === 'percentage_desc') {
        return b.percentage - a.percentage;
      }
      if (sortBy === 'percentage_asc') {
        return a.percentage - b.percentage;
      }
      if (sortBy === 'id') {
        return a.idNumber.localeCompare(b.idNumber);
      }
      if (sortBy === 'name') {
        return a.fullName.localeCompare(b.fullName);
      }
      return 0;
    });
  }, [revieweeRows, searchQuery, sortBy]);

  // Analytics
  const stats = useMemo(() => {
    const scoredRows = revieweeRows.filter(r => r.hasEvaluations);
    if (scoredRows.length === 0) {
      return { avg: 0, passingCount: 0, passingRate: 0, highest: 0, total: revieweeRows.length };
    }
    const sumPct = scoredRows.reduce((sum, r) => sum + r.percentage, 0);
    const avg = sumPct / scoredRows.length;
    const passingCount = scoredRows.filter(r => r.percentage >= 75).length;
    const passingRate = (passingCount / scoredRows.length) * 100;
    const highest = Math.max(...scoredRows.map(r => r.percentage));

    return {
      avg: Number(avg.toFixed(2)),
      passingCount,
      passingRate: Number(passingRate.toFixed(1)),
      highest: Number(highest.toFixed(2)),
      total: revieweeRows.length,
      evaluatedCount: scoredRows.length,
    };
  }, [revieweeRows]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['#', 'Reviewee ID', 'Full Name', 'School', ...subtopics.map(s => s.code), 'Total Score Earned', 'Total Possible Points', 'Percentage (%)', 'Status'];
    const rows = filteredAndSortedRows.map((row, idx) => {
      const subValues = subtopics.map(s => {
        const st = row.subtopicScores[s.code];
        return st && st.hasScore ? `${st.earned}/${st.possible} (${st.percentage}%)` : '-';
      });
      return [
        idx + 1,
        `"${row.idNumber}"`,
        `"${row.fullName}"`,
        `"${(row.user as any).school || (row.user as any).school_name || ''}"`,
        ...subValues,
        row.totalEarned,
        row.totalPossible,
        `${row.percentage}%`,
        row.percentage >= 75 ? 'PASSED' : row.hasEvaluations ? 'BELOW 75%' : 'NO SCORES',
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${areaCode}_Reviewees_Subtopics_${activeCategory.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100005] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-7xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 text-white p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 font-black text-xl shrink-0 shadow-inner">
              {areaCode}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {areaCode} — {MAJOR_AREA_TITLES[areaCode] || 'Major Board Area'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Subtopic Score Matrix
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Detailed breakdown of all enrolled reviewees across subtopics ({subtopics.map(s => s.code).join(', ')}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 border border-teal-400/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Export complete subtopic table to CSV"
            >
              <FileSpreadsheet size={15} />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter & Controls Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/90 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
              <Filter size={12} />
              Cat:
            </span>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-slate-900 text-white shadow-xs font-black'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Folder & Search & Sort Animated Droplist Cards */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {/* Folder Animated Select */}
            <div className="w-full sm:w-48">
              <AnimatedSelect
                value={activeFolderId}
                options={folderSelectOptions}
                onChange={setActiveFolderId}
                placeholder="Select folder..."
                searchPlaceholder="Search folder..."
                label="Target Score Folder"
                variant="compact-popover"
                triggerClassName="h-9 bg-white border-slate-200 text-slate-900 hover:border-slate-300 shadow-2xs"
                triggerTextClassName="text-slate-900 font-bold text-xs"
              />
            </div>

            {/* Sort Animated Select */}
            <div className="w-full sm:w-48">
              <AnimatedSelect
                value={sortBy}
                options={sortSelectOptions}
                onChange={(val) => setSortBy(val as any)}
                placeholder="Sort reviewees..."
                label="Sort Order"
                variant="compact-popover"
                searchable={false}
                triggerClassName="h-9 bg-white border-slate-200 text-slate-900 hover:border-slate-300 shadow-2xs"
                triggerTextClassName="text-slate-900 font-bold text-xs"
              />
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, student, school..."
                className="w-full pl-8 pr-3 h-9 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Quick Top Performance Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-slate-100/60 border-b border-slate-200">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Class Average</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base sm:text-lg font-black text-slate-900 font-mono">{stats.avg}%</span>
              <span className={`text-[10px] font-bold ${stats.avg >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {stats.avg >= 75 ? 'Passing' : 'Below 75%'}
              </span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Board Passing Rate</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base sm:text-lg font-black text-teal-700 font-mono">{stats.passingRate}%</span>
              <span className="text-[10px] font-semibold text-slate-500">({stats.passingCount} passed)</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Highest Reviewee</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base sm:text-lg font-black text-emerald-600 font-mono">{stats.highest}%</span>
              <span className="text-[10px] font-semibold text-slate-400">top score</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Students</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base sm:text-lg font-black text-slate-900 font-mono">{filteredAndSortedRows.length}</span>
              <span className="text-[10px] font-semibold text-slate-500">reviewees</span>
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 shadow-xs">
              <tr className="bg-[#0f172a] text-white">
                <th className="px-3 py-3 font-black text-center w-12 border-r border-slate-700/60">#</th>
                <th className="px-3.5 py-3 font-black w-28 border-r border-slate-700/60">Reviewee ID</th>
                <th className="px-4 py-3 font-black min-w-[200px] border-r border-slate-700/60">Full Name</th>
                
                {/* Subtopic Header Columns */}
                {subtopics.map(sub => (
                  <th
                    key={sub.code}
                    className="px-3 py-3 font-black text-center min-w-[85px] border-r border-slate-700/60 whitespace-nowrap"
                    title={`${sub.code}: ${sub.title}`}
                  >
                    <div className="text-teal-300 font-black">{sub.code}</div>
                    <div className="text-[9px] font-normal text-slate-400 truncate max-w-[90px]">{sub.title}</div>
                  </th>
                ))}

                <th className="px-3.5 py-3 font-black text-center w-28 border-r border-slate-700/60 bg-slate-900">
                  Total Score<br/><span className="text-[9px] font-normal text-slate-400">Earned / Possible</span>
                </th>
                <th className="px-3.5 py-3 font-black text-center w-24 bg-teal-950 text-teal-200">
                  Percentage<br/><span className="text-[9px] font-normal text-teal-400">(Rating)</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredAndSortedRows.map((row, idx) => {
                const isPassing = row.percentage >= 75;
                return (
                  <tr key={row.user.uid || (row.user as any).id || (row.user as any).doc_id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2.5 text-center text-slate-400 font-semibold border-r border-slate-100">
                      {idx + 1}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 border-r border-slate-100">
                      {row.idNumber}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-100">
                      <div className="flex items-center gap-2">
                        <UserAvatar photoURL={(row.user as any).photoURL || row.user.photoUrl} altText={row.fullName} size={30} />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{row.fullName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{((row.user as any).school || (row.user as any).school_name || 'Enrolled Reviewee')}</p>
                        </div>
                      </div>
                    </td>

                    {/* Subtopic Scores */}
                    {subtopics.map(sub => {
                      const st = row.subtopicScores[sub.code];
                      return (
                        <td key={sub.code} className="px-3 py-2.5 text-center border-r border-slate-100 font-mono">
                          {st && st.hasScore ? (
                            <div>
                              <span className="font-bold text-slate-800">{st.earned}</span>
                              <span className="text-[10px] text-slate-400">/{st.possible}</span>
                              <div className={`text-[9px] font-black ${st.percentage >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {st.percentage}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-xs">—</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Total Score Column */}
                    <td className="px-3.5 py-2.5 text-center border-r border-slate-100 font-mono font-bold bg-slate-50/40 text-slate-800">
                      {row.hasEvaluations ? (
                        <span>{row.totalEarned} <span className="text-slate-400 font-normal">/ {row.totalPossible}</span></span>
                      ) : (
                        <span className="text-slate-300 font-normal">—</span>
                      )}
                    </td>

                    {/* Percentage Column */}
                    <td className="px-3.5 py-2.5 text-center font-black bg-teal-50/40 font-mono">
                      {row.hasEvaluations ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          isPassing ? 'text-emerald-700 font-black' : 'text-amber-700 font-black'
                        }`}>
                          {row.percentage.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-300 font-medium">0.00%</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredAndSortedRows.length === 0 && (
                <tr>
                  <td colSpan={5 + subtopics.length} className="px-4 py-12 text-center text-slate-400 font-medium">
                    No reviewees match the search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Scores $\ge 75\%$ satisfy PRC Board Examination Passing Standard.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer self-end sm:self-auto"
          >
            Close Breakdown
          </button>
        </div>

      </div>
    </div>
  );
}
