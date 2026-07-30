import {
  GradeWeights,
  SubjectArea,
  GradeCategoryKey,
} from "./gradeCalculation";
import {
  getResolvedDetailedScore,
  normalizeScoreCategory,
  normalizeScoreSubject,
  parseOptionalNumber,
} from "./scoreFieldResolver";
import { isFolderMatching } from "./folderScope";
import { ScoreFolder } from "../types";

export type CategoryGradeResult = {
  categoryId: string;
  categoryName: string;
  earned: number;
  possible: number;
  rating: number;
  weight: number;
  contribution: number;
  hasScores: boolean;
};

export type MajorAreaGradeResult = {
  majorAreaId: string;
  majorAreaName: string;
  categoryWeightTotal: number;
  finalRating: number;
  categories: CategoryGradeResult[];
};

const CATEGORY_MAP: { key: GradeCategoryKey; label: string }[] = [
  { key: "preboard", label: "Preboard" },
  { key: "pretest", label: "Pretest" },
  { key: "posttest", label: "Posttest" },
  { key: "quiz", label: "Quiz" },
  { key: "dailyEvaluation", label: "Daily Evaluation" },
  { key: "removal", label: "Removal" },
  { key: "diagnostic", label: "Diagnostic" },
];

export function calculateCategoryRating(earned: number, possible: number): number {
  if (!Number.isFinite(possible) || possible <= 0) return 0;
  const earnedNum = Number(earned);
  if (!Number.isFinite(earnedNum)) return 0;
  return (earnedNum / possible) * 100;
}

export function calculateWeightedContribution(categoryRating: number, categoryWeight: number): number {
  const rating = Number(categoryRating) || 0;
  const weight = Number(categoryWeight) || 0;
  return rating * (weight / 100);
}

function extractFolderInfo(scoreFolderId?: string | ScoreFolder | null, scoreFolderName?: string): { folderId?: string; folderName?: string } {
  if (!scoreFolderId) return { folderId: undefined, folderName: scoreFolderName };
  if (typeof scoreFolderId === 'object') {
    return { folderId: scoreFolderId.id, folderName: scoreFolderId.name || scoreFolderName };
  }
  return { folderId: scoreFolderId, folderName: scoreFolderName };
}

export function getCategoryScoreTotals(
  reviewee: Record<string, any>,
  category: string,
  subject: string,
  scoreFolderId?: string | ScoreFolder | null,
  scoreFolderName?: string
): { earned: number; possible: number; hasScores: boolean } {
  const catKey = normalizeScoreCategory(category);
  const subjKey = normalizeScoreSubject(subject);

  let earnedTotal = 0;
  let possibleTotal = 0;
  let count = 0;

  const { folderId, folderName } = extractFolderInfo(scoreFolderId, scoreFolderName);

  const matchesFolder = (entrySfId: any) => {
    return isFolderMatching(entrySfId, folderId, folderName);
  };

  // 1. Check scoresByDate
  if (reviewee?.scoresByDate && typeof reviewee.scoresByDate === "object") {
    Object.values(reviewee.scoresByDate).forEach((entry: any) => {
      if (!entry || (typeof entry === "object" && entry.publicationStatus === 'hidden')) return;
      if (!matchesFolder(entry.scoreFolderId || entry.folderId)) return;

      const entryCatKey = normalizeScoreCategory(entry.category || entry.categoryKey || '');
      const entrySubjKey = normalizeScoreSubject(entry.subject || entry.area || '');

      const catMatches = entryCatKey === catKey || String(entry.category || '').toLowerCase().includes(catKey);
      const subjMatches = entrySubjKey === subjKey || String(entry.subject || entry.area || '').toLowerCase().includes(subjKey);

      if (catMatches && subjMatches) {
        const earned = parseOptionalNumber(entry.earnedPoints ?? entry.rawScore ?? entry.score);
        const possible = parseOptionalNumber(entry.possiblePoints ?? entry.totalItems) ?? 100;
        if (earned !== null && Number.isFinite(earned)) {
          earnedTotal += earned;
          possibleTotal += (possible > 0 ? possible : 100);
          count += 1;
        }
      }
    });
  }

  // 2. Check assessmentRecords
  if (reviewee?.assessmentRecords && typeof reviewee.assessmentRecords === "object") {
    Object.values(reviewee.assessmentRecords).forEach((entry: any) => {
      if (!entry || (typeof entry === "object" && entry.publicationStatus === 'hidden')) return;
      if (!matchesFolder(entry.scoreFolderId || entry.folderId)) return;

      const entryCatKey = normalizeScoreCategory(entry.category || '');
      const entrySubjKey = normalizeScoreSubject(entry.area || entry.subject || '');

      const catMatches = entryCatKey === catKey || String(entry.category || '').toLowerCase().includes(catKey);
      const subjMatches = entrySubjKey === subjKey || String(entry.area || entry.subject || '').toLowerCase().includes(subjKey);

      if (catMatches && subjMatches) {
        const earned = parseOptionalNumber(entry.score ?? entry.earnedScore ?? entry.rawScore);
        const possible = parseOptionalNumber(entry.totalScore ?? entry.totalItems ?? entry.possiblePoints) ?? 100;
        if (earned !== null && Number.isFinite(earned)) {
          earnedTotal += earned;
          possibleTotal += (possible > 0 ? possible : 100);
          count += 1;
        }
      }
    });
  }

  // 3. Fallback to getResolvedDetailedScore (flat fields)
  if (count === 0 && (!folderId || folderId === 'main' || folderName === 'main')) {
    const detailed = getResolvedDetailedScore(reviewee, category, subject);
    if (detailed.earnedScore !== null && detailed.earnedScore !== undefined) {
      earnedTotal = detailed.earnedScore;
      possibleTotal = detailed.possiblePoints > 0 ? detailed.possiblePoints : 100;
      count = 1;
    }
  }

  return {
    earned: earnedTotal,
    possible: possibleTotal,
    hasScores: count > 0 && possibleTotal > 0,
  };
}

export function calculateRevieweeMajorAreaRating(
  reviewee: Record<string, any>,
  subjectArea: string,
  weights: GradeWeights,
  scoreFolderId?: string | ScoreFolder | null,
  scoreFolderName?: string
): MajorAreaGradeResult {
  let categoryWeightTotal = 0;
  const categoriesResult: CategoryGradeResult[] = [];

  const categoryTotalsMap = CATEGORY_MAP.map(catInfo => {
    const totals = getCategoryScoreTotals(reviewee, catInfo.key, subjectArea, scoreFolderId, scoreFolderName);
    const weight = Number(weights[catInfo.key]) || 0;
    const rating = calculateCategoryRating(totals.earned, totals.possible);
    return {
      catInfo,
      totals,
      weight,
      rating,
      hasScores: totals.hasScores
    };
  });

  const takenCategories = categoryTotalsMap.filter(c => c.hasScores);
  const totalTakenWeight = takenCategories.reduce((sum, c) => sum + c.weight, 0);

  for (const item of categoryTotalsMap) {
    categoryWeightTotal += item.weight;

    const effectiveWeightRatio = (totalTakenWeight > 0 && item.hasScores) 
      ? item.weight / totalTakenWeight 
      : item.weight / 100;

    const contribution = item.hasScores ? item.rating * effectiveWeightRatio : 0;

    categoriesResult.push({
      categoryId: item.catInfo.key,
      categoryName: item.catInfo.label,
      earned: item.totals.earned,
      possible: item.totals.possible,
      rating: item.rating,
      weight: item.weight,
      contribution,
      hasScores: item.hasScores,
    });
  }

  const finalRating = categoriesResult.reduce((sum, c) => sum + c.contribution, 0);

  return {
    majorAreaId: subjectArea,
    majorAreaName: subjectArea.toUpperCase(),
    categoryWeightTotal,
    finalRating: Number.isFinite(finalRating) ? finalRating : 0,
    categories: categoriesResult,
  };
}

const MAJOR_AREA_WEIGHT_MAP: Record<string, number> = {
  clj: 20,
  lea: 20,
  cdi: 15,
  fs: 20,
  crim: 15,
  ca: 10,
};

export function calculateRevieweeOverallGrade(
  reviewee: Record<string, any>,
  weights: GradeWeights,
  scoreFolderId?: string | ScoreFolder | null,
  scoreFolderName?: string
): number {
  const subjects = ["clj", "lea", "cdi", "fs", "crim", "ca"];
  let overallContributionSum = 0;

  for (const subj of subjects) {
    const areaRating = calculateRevieweeMajorAreaRating(reviewee, subj, weights, scoreFolderId, scoreFolderName).finalRating;
    const areaWeight = MAJOR_AREA_WEIGHT_MAP[subj] || 10;
    const areaContribution = (areaRating * areaWeight) / 100;
    overallContributionSum += areaContribution;
  }

  return Number.isFinite(overallContributionSum) ? overallContributionSum : 0;
}

export function calculateRevieweeArea(
  reviewee: Record<string, any>,
  subject: SubjectArea | string,
  weights: GradeWeights,
  scoreFolderId?: string | ScoreFolder | null,
  scoreFolderName?: string
) {
  const majorResult = calculateRevieweeMajorAreaRating(reviewee, String(subject), weights, scoreFolderId, scoreFolderName);
  const totalEarned = majorResult.categories.reduce((sum, c) => sum + c.earned, 0);
  const totalPossible = majorResult.categories.reduce((sum, c) => sum + c.possible, 0);

  return {
    percentage: majorResult.finalRating,
    totalEarned,
    totalPossible,
    breakdown: majorResult.categories.map(c => ({
      category: c.categoryId,
      label: c.categoryName,
      score: c.rating,
      weight: c.weight,
      contribution: c.contribution,
    })),
  };
}

export function calculateAreaDashboardData(
  reviewees: Record<string, any>[],
  subject: SubjectArea | string,
  weights: GradeWeights,
) {
  const individualResults =
    reviewees.map(reviewee => ({
      revieweeId:
        reviewee.doc_id ??
        reviewee.uid ??
        reviewee.id,
      percentage:
        calculateRevieweeArea(
          reviewee,
          subject,
          weights,
        ).percentage,
    }));

  const validPercentages = individualResults
    .map(result => result.percentage)
    .filter(p => p !== null && p !== undefined && p > 0);
  
  const percentage = validPercentages.length > 0 
    ? validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length 
    : 0;

  return {
    percentage,
    revieweeCount:
      individualResults.length,
    individualResults,
  };
}
