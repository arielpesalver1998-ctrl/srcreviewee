import { ScoreRecord, parseScores } from '../../utils/scoreParser';
import { getCanonicalRevieweeId } from '../../utils/canonicalActiveReviewee';
import { normalizeScoreSubject, normalizeScoreCategory } from '../../utils/scoreFieldResolver';

export interface RevieweeScoreMatrixRow {
  uid: string;
  idNumber: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  branch: string;
  batch: string;
  user: any;
  clj: number | null;
  lea: number | null;
  fs: number | null;
  cdi: number | null;
  crim: number | null;
  ca: number | null;
  average: number | null;
  status: 'Passed' | 'Conditional' | 'Incomplete';
  filteredScore?: number | null; // Specific score when filtered by area/subtopic
}

export type SortField = 'index' | 'idNumber' | 'name' | 'clj' | 'lea' | 'fs' | 'cdi' | 'crim' | 'ca' | 'average' | 'status';
export type SortOrder = 'asc' | 'desc';

export const MAJOR_AREA_KEYS = ['clj', 'lea', 'fs', 'cdi', 'crim', 'ca'] as const;

export const MAJOR_AREA_LABELS: Record<string, { short: string; full: string }> = {
  clj: { short: 'CLJ', full: 'Criminal Law and Jurisprudence (CLJ)' },
  lea: { short: 'LEA', full: 'Law Enforcement Administration (LEA)' },
  fs: { short: 'FS', full: 'Forensic Science (FS)' },
  cdi: { short: 'CDI', full: 'Criminalistics and Investigation (CDI)' },
  crim: { short: 'CRIM', full: 'Criminology (CRIM)' },
  ca: { short: 'CA', full: 'Correctional Administration (CA)' },
};

export const SUBJECTS_BY_AREA: Record<string, { code: string; title: string }[]> = {
  "clj": [
    { code: "CLJ 1", title: "Introduction to Philippine Criminal Justice System" },
    { code: "CLJ 2", title: "Human Rights Education" },
    { code: "CLJ 3", title: "Criminal Law Book 1" },
    { code: "CLJ 4", title: "Criminal Law Book 2" },
    { code: "CLJ 5", title: "Evidence" },
    { code: "CLJ 6", title: "Criminal Procedure" },
    { code: "CLJ 7", title: "Court Testimony" },
  ],
  "lea": [
    { code: "LEA 1", title: "Law Enforcement Administration (Inter-Agency Approach)" },
    { code: "LEA 2", title: "Comparative Models in Policing" },
    { code: "LEA 3", title: "Introduction to Industrial Security Concepts" },
    { code: "LEA 4", title: "Law Enforcement Operation and Planning with Crime Mapping" },
    { code: "CLFM 1", title: "Character Formation, Nationalism, and Patriotism" },
    { code: "CLFM 2", title: "Leadership, Decision Making, Management, and Administration" },
  ],
  "cdi": [
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
  "fs": [
    { code: "FS 1", title: "Personal Identification Techniques" },
    { code: "FS 2", title: "Forensic Photography" },
    { code: "FS 3", title: "Forensic Chemistry and Toxicology" },
    { code: "FS 4", title: "Questioned Documents Examination" },
    { code: "FS 5", title: "Lie Detection Techniques" },
    { code: "FS 6", title: "Forensic Ballistics" },
  ],
  "crim": [
    { code: "CRIM 1", title: "Introduction to Criminology" },
    { code: "CRIM 2", title: "Theories of Crime Causation" },
    { code: "CRIM 3", title: "Human Behavior and Victimology" },
    { code: "CRIM 4", title: "Professional Conduct and Ethical Standards" },
    { code: "CRIM 5", title: "Juvenile Delinquency and Juvenile Justice System" },
    { code: "CRIM 6", title: "Dispute Resolution and Crises/Incidents Management" },
    { code: "CRIM 7", title: "Criminological Research 1" },
    { code: "CRIM 8", title: "Criminological Research 2" },
  ],
  "ca": [
    { code: "CA 1", title: "Institutional Corrections" },
    { code: "CA 2", title: "Non-Institutional Corrections" },
    { code: "CA 3", title: "Therapeutic Modalities" },
  ]
};

/**
 * Parses and computes the scores for a reviewee user filtered by category, major area, and subtopic.
 */
export function computeRevieweeRowScores(
  user: any,
  categoryFilter = 'all',
  majorAreaFilter = 'all',
  subtopicFilter = 'all',
  folderFilter = 'all'
): RevieweeScoreMatrixRow {
  let records = parseScores(user);

  // Filter records by category if specified
  if (categoryFilter !== 'all') {
    const normCat = normalizeScoreCategory(categoryFilter);
    records = records.filter(r => normalizeScoreCategory(r.category) === normCat);
  }

  // Filter records by folder if specified
  if (folderFilter !== 'all') {
    records = records.filter(r => (r.scoreFolderId || 'main') === folderFilter);
  }

  const getAreaScore = (key: string): number | null => {
    const targetNorm = normalizeScoreSubject(key);

    let areaRecords = records.filter(r => {
      const norm = normalizeScoreSubject(r.area);
      return norm === targetNorm || norm.startsWith(targetNorm);
    });

    if (subtopicFilter !== 'all' && majorAreaFilter === key) {
      areaRecords = areaRecords.filter(r => {
        const areaStr = String(r.area || '').toLowerCase();
        const subtopicCode = subtopicFilter.toLowerCase();
        return areaStr.includes(subtopicCode);
      });
    }

    if (areaRecords.length > 0) {
      const earned = areaRecords.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
      const possible = areaRecords.reduce((sum, r) => sum + (Number(r.totalItems) || 100), 0);
      if (possible > 0) {
        return Number(((earned / possible) * 100).toFixed(2));
      }
    }

    // Fallback to flat fields if no records match and folderFilter is not filtering strictly
    if (folderFilter === 'all' && (majorAreaFilter === 'all' || majorAreaFilter === key)) {
      const flatKeys = [
        key,
        `score_${key}`,
        `score_${key}_${categoryFilter}`,
        `preboard_${key}`,
        `diag_${key}`,
        `post_${key}`,
      ];

      for (const fk of flatKeys) {
        const val = user?.[fk] ?? user?.scores?.[fk];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const num = Number(val);
          if (Number.isFinite(num) && num >= 0) {
            return Number(num.toFixed(2));
          }
        }
      }
    }

    return null;
  };

  const clj = getAreaScore('clj');
  const lea = getAreaScore('lea');
  const fs = getAreaScore('fs');
  const cdi = getAreaScore('cdi');
  const crim = getAreaScore('crim');
  const ca = getAreaScore('ca');

  const scoresMap: Record<string, number | null> = { clj, lea, fs, cdi, crim, ca };
  let filteredScore: number | null = null;
  if (majorAreaFilter !== 'all' && MAJOR_AREA_KEYS.includes(majorAreaFilter as any)) {
    filteredScore = scoresMap[majorAreaFilter] ?? null;
  }

  const WEIGHTS: Record<string, number> = { clj: 0.20, lea: 0.15, fs: 0.20, cdi: 0.20, crim: 0.15, ca: 0.10 };
  const validScores = [clj, lea, fs, cdi, crim, ca].filter((s): s is number => s !== null);

  let average: number | null = null;
  const scoreKeys = ['clj', 'lea', 'fs', 'cdi', 'crim', 'ca'] as const;
  const validScoreKeys = scoreKeys.filter(k => scoresMap[k] !== null);
  if (validScoreKeys.length > 0) {
    let sumProducts = 0;
    let sumWeights = 0;
    validScoreKeys.forEach(k => {
      const val = scoresMap[k] as number;
      const w = WEIGHTS[k];
      sumProducts += val * w;
      sumWeights += w;
    });
    average = Number((sumProducts / sumWeights).toFixed(2));
  }

  let status: 'Passed' | 'Conditional' | 'Incomplete' = 'Incomplete';
  if (average !== null) {
    if (average >= 75 && validScores.length === 6) {
      status = 'Passed';
    } else if (average >= 70) {
      status = 'Conditional';
    } else {
      status = 'Incomplete';
    }
  }

  const idNumber = getCanonicalRevieweeId(user) || '—';
  const firstName = user.first_name || user.firstName || '';
  const lastName = user.last_name || user.lastName || '';
  let name = `${lastName}, ${firstName}`.trim();
  if (name === ',') {
    name = user.displayName || user.name || user.email || 'Unnamed Reviewee';
  } else if (!lastName) {
    name = firstName || user.displayName || 'Unnamed Reviewee';
  }

  const branch = user.review_branch || user.reviewBranch || user.branch || 'Main Branch';
  const batch = user.batch || user.cohort || user.batchYear || 'Batch 2026';

  return {
    uid: user.uid || user.id || user.doc_id,
    idNumber,
    name: name.toUpperCase(),
    firstName,
    lastName,
    email: user.email || '',
    branch,
    batch,
    user,
    clj,
    lea,
    fs,
    cdi,
    crim,
    ca,
    average,
    status,
    filteredScore,
  };
}

export function sortScoreMatrixRows(
  rows: RevieweeScoreMatrixRow[],
  sortField: SortField,
  sortOrder: SortOrder
): RevieweeScoreMatrixRow[] {
  return [...rows].sort((a, b) => {
    let comparison = 0;

    if (sortField === 'idNumber') {
      comparison = a.idNumber.localeCompare(b.idNumber, undefined, { numeric: true });
    } else if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === 'status') {
      const orderMap = { Passed: 3, Conditional: 2, Incomplete: 1 };
      comparison = orderMap[a.status] - orderMap[b.status];
    } else if (sortField === 'average') {
      const valA = a.average ?? -1;
      const valB = b.average ?? -1;
      comparison = valA - valB;
    } else if (MAJOR_AREA_KEYS.includes(sortField as any)) {
      const valA = a[sortField as keyof RevieweeScoreMatrixRow] as number | null ?? -1;
      const valB = b[sortField as keyof RevieweeScoreMatrixRow] as number | null ?? -1;
      comparison = (valA as number) - (valB as number);
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });
}
