import type { RevieweeData } from '../types';
import { normalizeScoreSubject, normalizeScoreCategory, getResolvedDetailedScore } from './scoreFieldResolver';

export interface ScoreRecord {
  area: string;
  category: string;
  date: string;
  score: number;
  totalItems: number;
  percentage: number;
  result: string;
  source: string;
  scoreFolderId?: string;
  publicationStatus?: string;
}

const AREAS = [
  { id: 'clj', label: 'CLJ' },
  { id: 'lea', label: 'LEA' },
  { id: 'cdi', label: 'CDI' },
  { id: 'fs', label: 'FS' },
  { id: 'crim', label: 'Criminology' },
  { id: 'ca', label: 'COR-AD' },
];

const FLAT_CATEGORIES = [
  { key: 'score', label: 'Daily Evaluation' },
  { key: 'diag', label: 'Diagnostic' },
  { key: 'pretest', label: 'Pretest' },
  { key: 'post', label: 'Posttest' },
  { key: 'posttest', label: 'Posttest' },
  { key: 'preboard', label: 'Pre-board' },
  { key: 'final', label: 'Final Coaching' },
  { key: 'mock', label: 'Mock Exam' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'removal', label: 'Removal' },
];

export function getResultLabel(percentage: number): string {
  if (percentage >= 90) return 'Excellent';
  if (percentage >= 80) return 'Very Good';
  if (percentage >= 75) return 'Good';
  return 'Needs Improvement';
}

export function getNormalizedAreaLabel(subject: string): string {
  const s = String(subject || '').toLowerCase().trim();
  if (s === 'clj' || s === 'criminal law') return 'CLJ';
  if (s === 'lea' || s === 'law enforcement') return 'LEA';
  if (s === 'cdi' || s === 'crime detection') return 'CDI';
  if (s === 'fs' || s === 'forensic science') return 'FS';
  if (s === 'crim' || s === 'criminology') return 'CRIM';
  if (s === 'ca' || s === 'cor-ad' || s === 'correctional') return 'CA';
  
  if (/^(clj|lea|cdi|fs|crim|ca)\s/i.test(s)) {
    return subject.toUpperCase();
  }
  
  return subject;
}

export function parseScores(data: any): ScoreRecord[] {
  const records: ScoreRecord[] = [];
  
  if (!data) return [];

  // 1. Parse assessmentRecords
  if (data.assessmentRecords && typeof data.assessmentRecords === 'object') {
    Object.values(data.assessmentRecords).forEach((entry: any) => {
      if (entry && typeof entry === 'object') {
        if (entry.publicationStatus === 'hidden') {
          return;
        }

        const numScore = Number(entry.score ?? entry.rawScore ?? entry.earnedScore);
        const totalItems = Number(entry.totalScore ?? entry.totalItems ?? entry.possiblePoints) || 100;
        if (!isNaN(numScore) && totalItems > 0) {
           const rawArea = entry.area || entry.subject || entry.subjectCode || 'General';
           const normalizedArea = getNormalizedAreaLabel(rawArea);

           records.push({
             area: normalizedArea,
             category: entry.category || 'Evaluation',
             date: entry.date || entry.createdAt?.split('T')[0] || '',
             score: numScore,
             totalItems: totalItems,
             percentage: (numScore / totalItems) * 100,
             result: getResultLabel((numScore / totalItems) * 100),
             source: 'AssessmentRecord',
             scoreFolderId: entry.scoreFolderId || entry.folderId || 'main',
             publicationStatus: entry.publicationStatus || 'published'
           });
        }
      }
    });
  }

  // 2. Parse scoresByDate
  if (data.scoresByDate && typeof data.scoresByDate === 'object') {
    Object.values(data.scoresByDate).forEach((entry: any) => {
      if (entry && typeof entry === 'object') {
        if (entry.publicationStatus === 'hidden') {
          return;
        }

        const numScore = Number(entry.earnedPoints ?? entry.rawScore ?? entry.score);
        const totalItems = Number(entry.possiblePoints ?? entry.totalItems) || 100;
        if (!isNaN(numScore) && totalItems > 0) {
           const rawArea = entry.subject || entry.area || 'General';
           const normalizedArea = getNormalizedAreaLabel(rawArea);

           records.push({
             area: normalizedArea,
             category: entry.category || entry.categoryKey || 'Daily Evaluation',
             date: entry.date || entry.updatedAt?.split('T')[0] || '',
             score: numScore,
             totalItems: totalItems,
             percentage: (numScore / totalItems) * 100,
             result: getResultLabel((numScore / totalItems) * 100),
             source: 'ScoresByDate',
             scoreFolderId: entry.scoreFolderId || entry.folderId || 'main',
             publicationStatus: entry.publicationStatus || 'published'
           });
        }
      }
    });
  }

  // 3. Parse flat fields and resolved detailed scores
  AREAS.forEach(area => {
    FLAT_CATEGORIES.forEach(cat => {
      const { earnedScore, possiblePoints } = getResolvedDetailedScore(data, cat.label, area.label);
      if (earnedScore !== null && earnedScore !== undefined && !isNaN(earnedScore)) {
        let dateStr = '';
        const possibleDateKeys = [
          `date_${area.id}_${cat.key}`,
          `date_${area.id}_${cat.label.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          `date_${cat.key}_${area.id}`
        ];
        
        for (const dk of possibleDateKeys) {
          if (data[dk]) {
            dateStr = data[dk];
            break;
          }
        }
        
        if (!dateStr && data.timestamp) {
           dateStr = String(data.timestamp).split('T')[0];
        }

        records.push({
          area: getNormalizedAreaLabel(area.label),
          category: cat.label,
          date: dateStr,
          score: earnedScore,
          totalItems: possiblePoints > 0 ? possiblePoints : 100,
          percentage: possiblePoints > 0 ? (earnedScore / possiblePoints) * 100 : earnedScore,
          result: getResultLabel(possiblePoints > 0 ? (earnedScore / possiblePoints) * 100 : earnedScore),
          source: 'FlatField',
          scoreFolderId: 'main',
          publicationStatus: 'published'
        });
      }
    });
  });

  // Deduplicate records (if same area, category, and date)
  const uniqueRecords = new Map<string, ScoreRecord>();
  records.forEach(r => {
    const key = `${normalizeScoreSubject(r.area)}_${normalizeScoreCategory(r.category)}_${r.date}`;
    const existing = uniqueRecords.get(key);
    // Prefer AssessmentRecord / ScoresByDate over FlatField
    if (!existing || r.source === 'AssessmentRecord' || r.source === 'ScoresByDate') {
      uniqueRecords.set(key, r);
    }
  });

  return Array.from(uniqueRecords.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
