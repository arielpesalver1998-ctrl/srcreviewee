import React, { useMemo } from 'react';
import { RevieweeData, ScoreFolder } from '../../types';
import { useScoreFolders } from '../../hooks/useScoreFolders';
import { isRevieweeInFolderScope, isFolderMatching } from '../../utils/folderScope';
import { MyScoresBoardSubjectAreas } from './MyScoresBoardSubjectAreas';
import { DailyEvaluationSubjectTable, RevieweeDateCol } from './DailyEvaluationSubjectTable';
import { calculateAggregatedAreaRating } from '../../lib/scoreCalculations';
import { normalizeScoreCategory, normalizeScoreSubject, getResolvedScore } from '../../utils/scoreFieldResolver';
import { ScoreRecord } from '../../utils/scoreParser';
import { getSubjectsByArea, MajorAreaCode, MAJOR_AREAS } from '../../config/criminologyCurriculum';
import { motion } from 'motion/react';
import { useRevieweeMyScoresPreferences } from '../../hooks/useRevieweeMyScoresPreferences';
import { calculateRevieweeArea } from '../../utils/calculateRevieweeArea';
import { DEFAULT_GRADE_WEIGHTS, GradeWeights, GradeCategoryKey } from '../../utils/gradeCalculation';
import { isFolderVisibleToReviewee } from '../../constants/folderTypes';

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

export function MyScoresPage({ revieweeData, scores, gradeWeights = DEFAULT_GRADE_WEIGHTS }: { revieweeData: RevieweeData; scores: ScoreRecord[]; gradeWeights?: GradeWeights }) {
  const { folders } = useScoreFolders();
  const publishedFolders = useMemo(() => {
    const validFolders = folders.filter(f => 
      isFolderVisibleToReviewee(f, revieweeData, isRevieweeInFolderScope)
    );

    const hasMainScores = scores.some(s => {
      const sfId = (s as any).scoreFolderId || (s as any).folderId;
      return !sfId || sfId === 'main';
    });

    const hasMainInFolders = validFolders.some(f => f.id === 'main' || f.name?.toLowerCase() === 'main score folder' || f.name?.toLowerCase() === 'main');

    if ((validFolders.length === 0 || hasMainScores) && !hasMainInFolders) {
      return [
        DEFAULT_MAIN_SCORE_FOLDER,
        ...validFolders
      ];
    }

    return validFolders;
  }, [folders, revieweeData, scores]);

  const rawCategories = useMemo(() => {
    const raw = Array.from(new Set(scores.map(r => r.category || 'Evaluation')));
    const defaults = ['Daily Evaluation', 'Diagnostic', 'Pretest', 'Posttest', 'Quiz', 'Removal', 'Preboard'];
    return Array.from(new Set([...defaults, ...raw]));
  }, [scores]);

  const { preference, isPreferencesReady, updateCategoryView, savePreference, isRestoring } = useRevieweeMyScoresPreferences(
    revieweeData?.uid || (revieweeData as any)?.id || (revieweeData as any)?.seqId,
    publishedFolders,
    rawCategories
  );

  const selectedFolder = useMemo(() => {
    if (publishedFolders.length === 0) return null;
    if (!preference.folderId) return publishedFolders[0] || null;
    return publishedFolders.find(f => f.id === preference.folderId) || publishedFolders[0] || null;
  }, [preference.folderId, publishedFolders]);

  const selectedCategory = preference.lastCategoryId || 'Daily Evaluation';
  const currentCatView = preference.categoryViews[selectedCategory] || { majorAreaId: 'CLJ', subjectId: null, evaluationDate: null };
  const selectedArea = currentCatView.majorAreaId || 'CLJ';

  const handleSelectFolder = (folder: ScoreFolder) => {
    savePreference({ folderId: folder.id });
  };

  const handleSelectCategory = (cat: string) => {
    updateCategoryView(cat, {});
  };

  const handleSelectArea = (area: string) => {
    updateCategoryView(selectedCategory, { majorAreaId: area });
  };

  // Filter scores based on the selected folder
  const filteredScores = useMemo(() => {
    if (!selectedFolder) return scores;
    const folderScores = scores.filter(s => {
      const sfId = (s as any).scoreFolderId || (s as any).folderId;
      return isFolderMatching(sfId, selectedFolder.id, selectedFolder.name);
    });
    return folderScores;
  }, [scores, selectedFolder]);

  const categories = useMemo(() => {
    const rawCategories = Array.from(new Set(filteredScores.map(r => r.category || 'Evaluation')));
    const defaults = ['Daily Evaluation', 'Diagnostic', 'Pretest', 'Posttest', 'Quiz', 'Removal', 'Preboard'];
    const merged = Array.from(new Set([...defaults, ...rawCategories]));
    return merged;
  }, [filteredScores]);

  const isDailyEvaluation = normalizeScoreCategory(selectedCategory) === 'dailyevaluation';

  if (!isPreferencesReady || isRestoring) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-600">Restoring your last My Scores view…</p>
      </div>
    );
  }

  // 1. Data computation for Daily Evaluation
  const dailyEvalData = useMemo(() => {
    if (!isDailyEvaluation) return null;

    const normArea = (selectedArea || 'CLJ').toUpperCase() as MajorAreaCode;
    const catRecords = filteredScores.filter(r => normalizeScoreCategory(r.category || '') === 'dailyevaluation');

    const matchesFolder = (entrySfId: any) => {
      if (!selectedFolder) return true;
      return isFolderMatching(entrySfId, selectedFolder.id, selectedFolder.name);
    };

    // Also look at revieweeData.assessmentRecords & scoresByDate
    const assessmentRecords = Object.values(revieweeData?.assessmentRecords || {})
      .filter((r: any) => r && r.publicationStatus !== 'hidden' && matchesFolder(r.scoreFolderId || r.folderId));
    const scoresByDateEntries = Object.values((revieweeData as any)?.scoresByDate || {})
      .filter((e: any) => e && e.publicationStatus !== 'hidden' && matchesFolder(e.scoreFolderId || e.folderId));

    // Collect dates
    const dateSet = new Set<string>();
    catRecords.forEach(r => { if (r.date) dateSet.add(r.date); });
    assessmentRecords.forEach((r: any) => {
      if (normalizeScoreCategory(r.category || '') === 'dailyevaluation' && r.date) {
        dateSet.add(r.date);
      }
    });
    scoresByDateEntries.forEach((e: any) => {
      if (normalizeScoreCategory(e.category || e.categoryKey || '') === 'dailyevaluation' && e.date) {
        dateSet.add(e.date);
      }
    });

    const uniqueDates = Array.from(dateSet).sort();

    const formatDate = (d: string) => {
      if (!d) return '—';
      try {
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return d;
        return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return d;
      }
    };

    const dateCols: RevieweeDateCol[] = uniqueDates.map((d, i) => ({
      id: `d_${d}_${i}`,
      date: d,
      label: formatDate(d),
    }));

    // Build subject scores matrix
    const subjects = getSubjectsByArea(normArea);
    const scoresBySubjectAndDate: Record<string, Record<string, { earned: number | null; possible: number | null }>> = {};

    subjects.forEach((subj) => {
      scoresBySubjectAndDate[subj.subjectCode] = {};

      dateCols.forEach((d) => {
        // Find matching score record
        let earned: number | null = null;
        let possible: number | null = null;

        // Check scoresByDate
        const sbdMatch = scoresByDateEntries.find((e: any) => {
          const catMatches = normalizeScoreCategory(e.category || e.categoryKey || '') === 'dailyevaluation';
          const dateMatches = e.date === d.date;
          const subjMatches = String(e.subject || '').toUpperCase().includes(subj.subjectCode.toUpperCase()) ||
                              String(e.subjectCode || '').toUpperCase() === subj.subjectCode.toUpperCase();
          return catMatches && dateMatches && subjMatches;
        }) as any;

        if (sbdMatch) {
          earned = sbdMatch.earnedPoints ?? sbdMatch.rawScore ?? sbdMatch.score ?? null;
          possible = sbdMatch.possiblePoints ?? sbdMatch.totalItems ?? 100;
        } else {
          // Check assessmentRecords
          const arMatch = assessmentRecords.find((r: any) => {
            const catMatches = normalizeScoreCategory(r.category || '') === 'dailyevaluation';
            const dateMatches = r.date === d.date;
            const subjMatches = String(r.subject || r.area || '').toUpperCase().includes(subj.subjectCode.toUpperCase());
            return catMatches && dateMatches && subjMatches;
          }) as any;

          if (arMatch) {
            earned = Number(arMatch.score ?? arMatch.earned);
            possible = Number(arMatch.totalScore ?? arMatch.totalItems) || 100;
          } else {
            // Check parsed scores
            const scoreMatch = catRecords.find(r => {
              const dateMatches = r.date === d.date;
              const subjMatches = normalizeScoreSubject(r.area || '') === normalizeScoreSubject(normArea);
              return dateMatches && subjMatches;
            });

            if (scoreMatch) {
              earned = Number(scoreMatch.score);
              possible = Number(scoreMatch.totalItems || 100);
            }
          }
        }

        scoresBySubjectAndDate[subj.subjectCode][d.id] = {
          earned: earned !== null && !isNaN(Number(earned)) ? Number(earned) : null,
          possible: possible !== null && !isNaN(Number(possible)) ? Number(possible) : 100,
        };
      });
    });

    return {
      dateCols,
      scoresBySubjectAndDate,
    };
  }, [isDailyEvaluation, selectedArea, scores, revieweeData]);

  // 2. Data computation for other categories
  const standardCategoryData = useMemo(() => {
    if (isDailyEvaluation) return null;

    const subjects = MAJOR_AREAS.map(a => ({ key: a.code, label: a.code, title: a.title }));
    const categoryKey = normalizeScoreCategory(selectedCategory);
    const categoryRecords = filteredScores.filter(r => normalizeScoreCategory(r.category || 'Evaluation') === categoryKey);

    const uniqueDates = Array.from(new Set(categoryRecords.map(r => r.date || 'Unknown Date'))).sort();

    const formatDate = (d: string) => {
      if (d === 'Unknown Date' || !d) return d;
      try {
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return d;
        return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      } catch {
        return d;
      }
    };

    const dates = uniqueDates.map((d, i) => ({ id: `d${i}`, date: d, label: formatDate(d) }));

    const computedAreaScores = subjects.map(subj => {
      const subjKey = normalizeScoreSubject(subj.label);
      const areaRecords = categoryRecords.filter(r => normalizeScoreSubject(r.area || '') === subjKey);

      const calcScores = areaRecords.map(r => ({
        earned: Number(r.score),
        totalItems: Number(r.totalItems || 100),
        published: true
      }));
      const result = calculateAggregatedAreaRating(calcScores);
      return {
        area: subj.label,
        title: subj.title,
        percent: result.rating,
      };
    });

    const tableRows = subjects.map(subj => {
      const subjKey = normalizeScoreSubject(subj.label);
      const areaRecords = categoryRecords.filter(r => normalizeScoreSubject(r.area || '') === subjKey);

      const cellsByDateId: Record<string, any> = {};
      dates.forEach((dateCol) => {
        const record = areaRecords.find(r => (r.date || 'Unknown Date') === dateCol.date);
        if (record) {
          cellsByDateId[dateCol.id] = { earned: Number(record.score), total: Number(record.totalItems || 100) };
        }
      });

      const calcScores = areaRecords.map(r => ({
        earned: Number(r.score),
        totalItems: Number(r.totalItems || 100),
        published: true
      }));

      const aggregate = calculateAggregatedAreaRating(calcScores);
      return {
        area: subj.label,
        cellsByDateId,
        aggregate: { ...aggregate, missingCount: 0 }
      };
    });

    return { areaScores: computedAreaScores, tableRows, dates };
  }, [isDailyEvaluation, selectedCategory, scores]);

  // Overall Board Subject Areas computation for top cards
  const boardSubjectAreaScores = useMemo(() => {
    return MAJOR_AREAS.map((ma) => {
      const result = calculateRevieweeArea(revieweeData, ma.code, gradeWeights, selectedFolder?.id, selectedFolder?.name);
      const categories: GradeCategoryKey[] = ["preboard", "pretest", "posttest", "quiz", "dailyEvaluation", "removal", "diagnostic"];
      const actualCount = categories.reduce((c, cat) => getResolvedScore(revieweeData, cat, ma.code) !== null ? c + 1 : c, 0);

      return {
        area: ma.code,
        title: ma.title,
        percent: result.percentage,
        count: actualCount,
        subtitle: `${actualCount} ${actualCount === 1 ? 'evaluation' : 'evaluations'} encoded`
      };
    });
  }, [revieweeData, gradeWeights, selectedFolder]);

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">My Scores</h1>
        <p className="text-sm text-slate-600">
          View your scores by board subject area, examination category, and evaluation dates.
        </p>
        {selectedFolder && (
          <div className="mt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Currently Viewing:</span>
            <div className="text-sm font-black text-teal-700 bg-teal-50 px-3 py-1 rounded-full inline-block ml-2 border border-teal-100">
              {selectedFolder.name}
            </div>
          </div>
        )}
      </div>

      {/* Published Folder Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {publishedFolders.map(folder => (
          <button
            key={folder.id}
            onClick={() => handleSelectFolder(folder)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              selectedFolder?.id === folder.id
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {folder.name}
          </button>
        ))}
      </div>

      <motion.div
        key={selectedFolder?.id || 'none'}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        {/* Privacy Notice */}
        <div className="bg-slate-100 rounded-2xl p-4 text-center mt-4">
          <p className="text-xs font-semibold text-slate-500">
            “Only your Published scores from active score folders are visible to you.”
          </p>
        </div>

        {/* Board Subject Areas Selection */}
        <MyScoresBoardSubjectAreas
          areas={boardSubjectAreaScores}
          selectedArea={selectedArea}
          onAreaClick={(area) => handleSelectArea(area)}
        />

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Category Toolbar */}
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="text-xs font-bold text-slate-500">
              Selected Major Area: <span className="text-teal-700 font-black">{selectedArea}</span>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-6">
            {isDailyEvaluation && dailyEvalData ? (
              <DailyEvaluationSubjectTable
                areaCode={selectedArea as MajorAreaCode}
                dates={dailyEvalData.dateCols}
                scoresBySubjectAndDate={dailyEvalData.scoresBySubjectAndDate}
              />
            ) : standardCategoryData ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="w-full text-xs text-left text-slate-600">
                  <thead className="text-[10px] text-slate-300 uppercase font-black bg-slate-900 border-b border-slate-800">
                    <tr>
                      <th rowSpan={2} className="px-4 py-3 sticky left-0 bg-slate-900 z-20 shadow-[1px_0_0_0_rgba(255,255,255,0.1)]">
                        Area
                      </th>
                      <th colSpan={Math.max(1, standardCategoryData.dates.length)} className="px-4 py-3 text-center border-b border-slate-800">
                        {selectedCategory}
                      </th>
                      <th rowSpan={2} className="px-4 py-3 text-center bg-slate-800 shadow-[-1px_0_0_0_rgba(255,255,255,0.1)]">
                        Combined
                      </th>
                      <th rowSpan={2} className="px-4 py-3 text-center bg-slate-800 shadow-[-1px_0_0_0_rgba(255,255,255,0.1)]">
                        Rating
                      </th>
                    </tr>
                    <tr>
                      {standardCategoryData.dates.length > 0 ? (
                        standardCategoryData.dates.map((d) => (
                          <th key={d.id} className="px-4 py-2 border-r border-slate-800 whitespace-nowrap text-center bg-slate-800/50">
                            {d.label}
                          </th>
                        ))
                      ) : (
                        <th className="px-4 py-2 border-r border-slate-800 whitespace-nowrap text-center bg-slate-800/50">
                          No Dates Available
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {standardCategoryData.tableRows.map((row) => {
                      const isSelected = selectedArea === row.area;
                      return (
                        <tr
                          key={row.area}
                          onClick={() => handleSelectArea(row.area)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-teal-50/50 hover:bg-teal-50/80' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td
                            className={`px-4 py-3 font-black sticky left-0 z-10 border-r border-slate-100 ${
                              isSelected ? 'bg-teal-50 text-teal-900' : 'bg-white text-slate-900'
                            }`}
                          >
                            {row.area}
                          </td>
                          {standardCategoryData.dates.length > 0 ? (
                            standardCategoryData.dates.map((date) => {
                              const cell = row.cellsByDateId[date.id];
                              return (
                                <td key={date.id} className="px-4 py-3 border-r border-slate-100 text-center font-medium">
                                  {cell ? `${cell.earned}/${cell.total}` : <span className="text-slate-300">—</span>}
                                </td>
                              );
                            })
                          ) : (
                            <td className="px-4 py-3 border-r border-slate-100 text-center text-slate-300">—</td>
                          )}
                          <td
                            className={`px-4 py-3 font-bold text-center border-l border-slate-100 ${
                              isSelected ? 'bg-teal-50/30' : 'bg-slate-50'
                            }`}
                          >
                            {row.aggregate.totalEarned}/{row.aggregate.totalPossible}
                          </td>
                          <td
                            className={`px-4 py-3 font-black text-center ${
                              isSelected ? 'bg-teal-50/50 text-teal-700' : 'bg-slate-50 text-teal-600'
                            }`}
                          >
                            {row.aggregate.rating !== null ? `${row.aggregate.rating.toFixed(2)}%` : '0.00%'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
