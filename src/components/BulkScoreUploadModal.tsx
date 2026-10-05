import React, { useState, useMemo, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Folder,
  Calendar,
  Layers,
  Search,
  Download,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  User,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Building2,
  Trash2,
  Minimize2,
} from 'lucide-react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { useScoreFolders } from '../hooks/useScoreFolders';
import { useFirestoreUsers } from '../hooks/useFirestoreUsers';
import { resolveCanonicalUserIdentity } from '../services/userIdentityResolver';
import { normalizeScoreCategory, normalizeScoreSubject, getScoreFieldName } from '../utils/scoreFieldResolver';
import { logProfileModification } from '../services/activityLogService';
import { useScoreUpload } from '../context/ScoreUploadContext';

const MAJOR_AREAS = [
  { code: 'CLJ', name: 'Criminal Law and Jurisprudence' },
  { code: 'LEA', name: 'Law Enforcement Administration' },
  { code: 'CDI', name: 'Crime Detection and Investigation' },
  { code: 'FS', name: 'Forensic Science' },
  { code: 'CRIM', name: 'Criminology' },
  { code: 'CA', name: 'Correctional Administration' },
];

const CATEGORIES = [
  'Daily Evaluation',
  'Diagnostic',
  'Pretest',
  'Posttest',
  'Quiz',
  'Removal',
  'Preboard',
];

export interface BulkScoreUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  allUsers?: any[];
  preselectedFolderId?: string | null;
  onUploadComplete?: (result: { totalProcessed: number; successCount: number; folderId: string }) => void;
}

interface ParsedScoreRow {
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
  
  // Matching Info
  matchedUser: any | null;
  matchType: 'EXACT_ID' | 'EXACT_NAME' | 'MANUAL' | 'NONE';
  status: 'READY' | 'WARNING_OVERWRITE' | 'CONFLICT_NAME' | 'UNMATCHED' | 'INVALID_SCORE';
  statusMessage: string;
  selected: boolean;
}

export const BulkScoreUploadModal: React.FC<BulkScoreUploadModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers = [],
  preselectedFolderId = null,
  onUploadComplete,
}) => {
  const { folders } = useScoreFolders();
  const { allUsers: firestoreUsers } = useFirestoreUsers();
  const scoreUploadCtx = useScoreUpload();

  const effectiveUsers = useMemo(() => {
    return allUsers && allUsers.length > 0 ? allUsers : firestoreUsers;
  }, [allUsers, firestoreUsers]);

  const revieweeList = useMemo(() => {
    return effectiveUsers.filter((u) => {
      const role = String(u.role || u.userRole || 'Reviewee').toLowerCase();
      return role === 'reviewee' || role === 'student';
    });
  }, [effectiveUsers]);

  // Configuration State
  const [uploadScope, setUploadScope] = useState<'single' | 'matrix'>('single');
  const [selectedFolderId, setSelectedFolderId] = useState<string>(() => preselectedFolderId || 'main');
  const [selectedCategory, setSelectedCategory] = useState<string>('Daily Evaluation');
  const [selectedAreaMode, setSelectedAreaMode] = useState<string>('CLJ'); // 'CLJ', 'LEA', etc.
  const [defaultTotalItems, setDefaultTotalItems] = useState<string>('100');
  const [examDate, setExamDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [publicationStatus, setPublicationStatus] = useState<'published' | 'hidden'>('published');

  // File & Parsing State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedScoreRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Table Filter & Search
  const [tableFilter, setTableFilter] = useState<'all' | 'ready' | 'warnings' | 'unmatched'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Upload Execution State
  const isUploading = scoreUploadCtx.isUploading;
  const uploadProgress = scoreUploadCtx.progress;
  const uploadSuccessSummary = scoreUploadCtx.summary;

  // Reset or initialize folder
  React.useEffect(() => {
    if (preselectedFolderId) {
      setSelectedFolderId(preselectedFolderId);
    }
  }, [preselectedFolderId, isOpen]);

  // Build lookup index of reviewees by ID and Name for fast matching
  const revieweeIndex = useMemo(() => {
    const byId = new Map<string, any>();
    const byName = new Map<string, any>();

    for (const user of revieweeList) {
      const canon = resolveCanonicalUserIdentity(user);

      // Map by standard normalized IDs
      const rawIds = [
        canon.idNumber,
        user.seqId,
        user.seq_id,
        user.idNumber,
        user.id_number,
        user.srcId,
        user.customId,
        user.zipGradeId,
        user.studentId,
        user.uid,
        user.doc_id,
      ];

      for (const id of rawIds) {
        if (!id) continue;
        const clean = String(id).trim().replace(/^[#\s\-]+/, '').toUpperCase();
        if (clean && !byId.has(clean)) {
          byId.set(clean, user);
        }
        const digitsOnly = clean.replace(/[^0-9]/g, '');
        if (digitsOnly && !byId.has(digitsOnly)) {
          byId.set(digitsOnly, user);
        }
        const noLeadingZero = digitsOnly.replace(/^0+/, '');
        if (noLeadingZero && !byId.has(noLeadingZero)) {
          byId.set(noLeadingZero, user);
        }
      }

      // Map by formal name and full name
      const nameKeys = [
        canon.fullName.toLowerCase().trim(),
        `${canon.lastName}, ${canon.firstName}`.toLowerCase().trim(),
        `${canon.firstName} ${canon.lastName}`.toLowerCase().trim(),
        `${canon.lastName} ${canon.firstName}`.toLowerCase().trim(),
        `${user.last_name || ''}, ${user.first_name || ''}`.toLowerCase().trim(),
        `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().trim(),
        String(user.name || '').toLowerCase().trim(),
        String(user.displayName || '').toLowerCase().trim(),
      ];

      for (const nk of nameKeys) {
        if (nk && !byName.has(nk)) {
          byName.set(nk, user);
        }
      }
    }

    return { byId, byName };
  }, [revieweeList]);

  // Clean and normalize ID string
  const cleanId = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val)
      .trim()
      .replace(/\.0+$/, '')
      .replace(/^[#\s\-]+/, '')
      .replace(/^(SRC|ID)-?/i, '')
      .toUpperCase();
  };

  // Clean and normalize Name string
  const cleanName = (val: any): string => {
    if (!val) return '';
    return String(val).trim().replace(/\s+/g, ' ');
  };

  // Parse CSV File Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');
    setParseError(null);
    setIsParsing(true);
    setParsedRows([]);
    scoreUploadCtx.dismissSummary();

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          processCsvData(results.data, results.meta.fields || []);
        } catch (err: any) {
          console.error('Error processing CSV:', err);
          setParseError(err?.message || 'Failed to parse CSV data.');
        } finally {
          setIsParsing(false);
        }
      },
      error: (error) => {
        setIsParsing(false);
        setParseError(`CSV Parsing Error: ${error.message}`);
      },
    });
  };

  // Process and Match parsed CSV rows
  const processCsvData = (rows: any[], headers: string[]) => {
    if (!rows || rows.length === 0) {
      setParseError('The uploaded CSV file contains no data rows.');
      return;
    }

    const defaultPossible = parseFloat(defaultTotalItems) || 100;
    const normHeaders = headers.map((h) => ({ original: h, clean: h.trim().toLowerCase().replace(/[^a-z0-9]/g, '') }));

    // Helper to map column header to major area
    const mapHeaderToMajorArea = (h: string): string | null => {
      const clean = h.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (clean === 'CLJ' || clean.includes('CRIMINALLAW')) return 'CLJ';
      if (clean === 'LEA' || clean.includes('LAWENFORCEMENT')) return 'LEA';
      if (clean === 'CDI' || clean.includes('CRIMEDETECTION') || clean.includes('INVESTIGATION')) return 'CDI';
      if (clean === 'FS' || clean.includes('FORENSIC') || clean.includes('FORENSICS')) return 'FS';
      if (clean === 'CRIM' || clean.includes('CRIMINOLOGY')) return 'CRIM';
      if (clean === 'CA' || clean.includes('CORRECTIONAL') || clean.includes('CORRECTION') || clean === 'CORAD') return 'CA';
      return null;
    };

    // Helper to detect major area and category from quiz name (e.g. "CKCM EVALUATION FS JUNE")
    const detectFromQuizName = (qName: string): { detectedArea?: string; detectedCategory?: string } => {
      if (!qName) return {};
      const upper = qName.toUpperCase();
      let detectedArea: string | undefined;
      let detectedCategory: string | undefined;

      // Major area check
      if (/\bCLJ\b/i.test(upper) || upper.includes('CRIMINAL LAW')) detectedArea = 'CLJ';
      else if (/\bLEA\b/i.test(upper) || upper.includes('LAW ENFORCEMENT')) detectedArea = 'LEA';
      else if (/\bCDI\b/i.test(upper) || upper.includes('CRIME DETECTION') || upper.includes('INVESTIGATION')) detectedArea = 'CDI';
      else if (/\bFS\b/i.test(upper) || upper.includes('FORENSIC')) detectedArea = 'FS';
      else if (/\bCRIM\b/i.test(upper) || upper.includes('CRIMINOLOGY')) detectedArea = 'CRIM';
      else if (/\bCA\b/i.test(upper) || upper.includes('CORRECTIONAL') || upper.includes('CORAD')) detectedArea = 'CA';

      // Category check
      if (upper.includes('PREBOARD') || upper.includes('PRE-BOARD')) detectedCategory = 'Preboard';
      else if (upper.includes('DIAGNOSTIC') || upper.includes('DIAG')) detectedCategory = 'Diagnostic';
      else if (upper.includes('PRETEST') || upper.includes('PRE-TEST')) detectedCategory = 'Pretest';
      else if (upper.includes('POSTTEST') || upper.includes('POST-TEST')) detectedCategory = 'Posttest';
      else if (upper.includes('EVALUATION')) detectedCategory = 'Daily Evaluation';
      else if (upper.includes('QUIZ')) detectedCategory = 'Quiz';
      else if (upper.includes('REMOVAL')) detectedCategory = 'Removal';

      return { detectedArea, detectedCategory };
    };

    // Find relevant column keys
    const firstNameKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['firstname', 'first', 'fname', 'givenname'].includes(c);
    });

    const lastNameKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['lastname', 'last', 'lname', 'surname', 'familyname'].includes(c);
    });

    const zipGradeKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['zipgradeid', 'zipgrade_id'].includes(c);
    });

    const externalIdKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['externalid', 'external_id'].includes(c);
    });

    const quizNameKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['quizname', 'examname', 'quiz_name', 'examtitle', 'title'].includes(c);
    });

    const quizClassKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['quizclass', 'class', 'branch', 'school', 'section'].includes(c);
    });

    const quizCreatedKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['quizcreated', 'created', 'datecreated'].includes(c);
    });

    const idKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['zipgradeid', 'externalid', 'idnumber', 'id', 'studentid', 'student_id', 'seqid', 'seq_id', 'customid', 'pin'].includes(c);
    }) || headers.find((h) => h.toLowerCase().includes('id')) || headers[0];

    const nameKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['name', 'fullname', 'studentname', 'revieweename', 'student'].includes(c);
    });

    const scoreKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return [
        'earnedpts',
        'earnedpoints',
        'earnedpt',
        'score',
        'rawscore',
        'points',
        'earned',
        'totalscore',
        'grade',
        'ptsearned',
      ].includes(c);
    });

    const totalKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return [
        'possiblepts',
        'possiblepoints',
        'possiblept',
        'posspts',
        'total',
        'totalitems',
        'items',
        'maxscore',
        'possible',
        'ptspossible',
      ].includes(c);
    });

    const areaKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['area', 'subject', 'subjectcode', 'majorarea', 'course'].includes(c);
    });

    const categoryKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['category', 'examcategory', 'type', 'examtype'].includes(c);
    });

    const dateKey = headers.find((h) => {
      const c = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return ['date', 'examdate', 'testdate', 'createdat', 'quizcreated'].includes(c);
    });

    // Check if CSV has multi-subject major area columns (CLJ, LEA, CDI, FS, CRIM, CA)
    const detectedAreaCols: { originalHeader: string; areaCode: string }[] = [];
    headers.forEach((h) => {
      const mapped = mapHeaderToMajorArea(h);
      if (mapped) {
        detectedAreaCols.push({ originalHeader: h, areaCode: mapped });
      }
    });

    // Use matrix format if 2 or more major area columns are present
    const isMatrixFormat = detectedAreaCols.length >= 2;
    const singleAreaCol = detectedAreaCols.length === 1 ? detectedAreaCols[0] : null;
    const effectiveScoreKey = scoreKey || singleAreaCol?.originalHeader || (headers.length >= 4 ? headers[3] : undefined);

    const processed: ParsedScoreRow[] = [];

    rows.forEach((row, idx) => {
      // Pick best student ID from ZipGradeID, ExternalID or idKey
      const rawZipId = zipGradeKey && row[zipGradeKey] !== undefined ? String(row[zipGradeKey]).trim() : '';
      const rawExtId = externalIdKey && row[externalIdKey] !== undefined ? String(row[externalIdKey]).trim() : '';
      const rawFallbackId = idKey && row[idKey] !== undefined ? String(row[idKey]).trim() : '';
      const rawId = rawZipId || rawExtId || rawFallbackId;
      const normId = cleanId(rawId);
      const digitsId = normId.replace(/[^0-9]/g, '');
      const noZeroId = digitsId.replace(/^0+/, '');

      const fName = firstNameKey && row[firstNameKey] ? cleanName(row[firstNameKey]) : '';
      const lName = lastNameKey && row[lastNameKey] ? cleanName(row[lastNameKey]) : '';

      let rawName = '';
      if (lName && fName) {
        rawName = `${lName}, ${fName}`;
      } else if (fName) {
        rawName = fName;
      } else if (nameKey && row[nameKey]) {
        rawName = cleanName(row[nameKey]);
      }

      // Quiz name and class if present
      const rowQuizName = quizNameKey && row[quizNameKey] ? String(row[quizNameKey]).trim() : '';
      const rowQuizClass = quizClassKey && row[quizClassKey] ? String(row[quizClassKey]).trim() : '';
      const { detectedArea, detectedCategory } = detectFromQuizName(rowQuizName);

      // Auto-update modal controls on first row if detected
      if (idx === 0 && detectedArea && detectedArea !== selectedAreaMode) {
        setSelectedAreaMode(detectedArea);
      }
      if (idx === 0 && detectedCategory && detectedCategory !== selectedCategory) {
        setSelectedCategory(detectedCategory);
      }

      // Try matching reviewee in database:
      // Priority 1: Exact ID match (normalized, digits only, or zero stripped)
      let matchedUser: any | null = null;
      let matchType: 'EXACT_ID' | 'EXACT_NAME' | 'MANUAL' | 'NONE' = 'NONE';

      if (normId && revieweeIndex.byId.has(normId)) {
        matchedUser = revieweeIndex.byId.get(normId);
        matchType = 'EXACT_ID';
      } else if (digitsId && revieweeIndex.byId.has(digitsId)) {
        matchedUser = revieweeIndex.byId.get(digitsId);
        matchType = 'EXACT_ID';
      } else if (noZeroId && revieweeIndex.byId.has(noZeroId)) {
        matchedUser = revieweeIndex.byId.get(noZeroId);
        matchType = 'EXACT_ID';
      } else if (lName && fName) {
        const fullReverse = `${lName}, ${fName}`.toLowerCase();
        const fullDirect = `${fName} ${lName}`.toLowerCase();
        if (revieweeIndex.byName.has(fullReverse)) {
          matchedUser = revieweeIndex.byName.get(fullReverse);
          matchType = 'EXACT_NAME';
        } else if (revieweeIndex.byName.has(fullDirect)) {
          matchedUser = revieweeIndex.byName.get(fullDirect);
          matchType = 'EXACT_NAME';
        }
      } else if (rawName && revieweeIndex.byName.has(rawName.toLowerCase())) {
        matchedUser = revieweeIndex.byName.get(rawName.toLowerCase());
        matchType = 'EXACT_NAME';
      }

      // Priority 3: Fuzzy startswith match for truncated names (e.g. BAUT for BAUTISTA)
      if (!matchedUser && lName && fName) {
        const normL = lName.toLowerCase().replace(/[^a-z]/g, '');
        const normF = fName.toLowerCase().replace(/[^a-z]/g, '');
        matchedUser = revieweeList.find((u) => {
          const canon = resolveCanonicalUserIdentity(u);
          const uLast = canon.lastName.toLowerCase().replace(/[^a-z]/g, '');
          const uFirst = canon.firstName.toLowerCase().replace(/[^a-z]/g, '');
          const lastMatches = uLast === normL || (normL.length >= 3 && uLast.startsWith(normL)) || (uLast.length >= 3 && normL.startsWith(uLast));
          const firstMatches = uFirst === normF || (normF.length >= 3 && uFirst.startsWith(normF)) || (uFirst.length >= 3 && normF.startsWith(uFirst));
          return lastMatches && firstMatches;
        }) || null;

        if (matchedUser) {
          matchType = 'EXACT_NAME';
        }
      }

      // Collect item answers (Stu1-Stu100, Key1-Key100)
      const studentAnswers: Record<string, string> = {};
      const answerKeys: Record<string, string> = {};
      for (let q = 1; q <= 100; q++) {
        if (row[`Stu${q}`] !== undefined && String(row[`Stu${q}`]).trim() !== '') {
          studentAnswers[`Stu${q}`] = String(row[`Stu${q}`]).trim().toUpperCase();
        }
        if (row[`Key${q}`] !== undefined && String(row[`Key${q}`]).trim() !== '') {
          answerKeys[`Key${q}`] = String(row[`Key${q}`]).trim().toUpperCase();
        } else if (row[`PriKey${q}`] !== undefined && String(row[`PriKey${q}`]).trim() !== '') {
          answerKeys[`Key${q}`] = String(row[`PriKey${q}`]).trim().toUpperCase();
        }
      }

      // Determine date and category
      let rowDate = (dateKey && row[dateKey]) ? String(row[dateKey]).trim() : examDate;
      if (quizCreatedKey && row[quizCreatedKey]) {
        const parsedCreated = new Date(row[quizCreatedKey]);
        if (!isNaN(parsedCreated.getTime())) {
          rowDate = parsedCreated.toISOString().split('T')[0];
        }
      }

      const rowCat = detectedCategory || ((categoryKey && row[categoryKey]) ? String(row[categoryKey]).trim() : selectedCategory);

      if (isMatrixFormat) {
        // Multi-subject matrix row: generate a parsed entry for each valid major area score
        detectedAreaCols.forEach(({ originalHeader, areaCode }) => {
          const rawVal = row[originalHeader] !== undefined ? String(row[originalHeader]).trim() : '';
          if (rawVal === '' || rawVal === '-') return;

          const numScore = parseFloat(rawVal);
          const rowPossible = defaultPossible;
          const percentage = !isNaN(numScore) && rowPossible > 0 ? (numScore / rowPossible) * 100 : null;

          let status: ParsedScoreRow['status'] = 'READY';
          let statusMessage = 'Ready to import';

          if (isNaN(numScore) || numScore < 0) {
            status = 'INVALID_SCORE';
            statusMessage = `Invalid numeric score "${rawVal}"`;
          } else if (numScore > rowPossible) {
            status = 'INVALID_SCORE';
            statusMessage = `Score (${numScore}) exceeds max (${rowPossible})`;
          } else if (!matchedUser) {
            status = 'UNMATCHED';
            statusMessage = `Reviewee not found in database for ID "${rawId || 'N/A'}"`;
          } else {
            statusMessage = matchType === 'EXACT_ID' ? `Matched by ID (${normId})` : `Matched by Name (${rawName})`;
          }

          processed.push({
            id: `row_${idx}_${areaCode}`,
            rowIndex: idx + 1,
            rawId,
            normalizedId: normId,
            rawName: rawName || (matchedUser ? resolveCanonicalUserIdentity(matchedUser).fullName : 'Unknown'),
            rawScore: rawVal,
            earnedScore: !isNaN(numScore) ? numScore : null,
            possiblePoints: rowPossible,
            percentage,
            area: areaCode,
            subjectCode: areaCode,
            category: rowCat,
            examDate: rowDate,
            quizName: rowQuizName,
            quizClass: rowQuizClass,
            studentAnswers,
            answerKeys,
            matchedUser,
            matchType,
            status,
            statusMessage,
            selected: status === 'READY',
          });
        });
      } else {
        // Single exam score per row (e.g. EarnedPts, PossiblePts)
        const scoreFieldToUse = effectiveScoreKey || scoreKey;
        const rawScoreVal = scoreFieldToUse && row[scoreFieldToUse] !== undefined ? String(row[scoreFieldToUse]).trim() : '';
        const rawTotalVal = totalKey && row[totalKey] !== undefined ? String(row[totalKey]).trim() : '';

        const earned = parseFloat(rawScoreVal);
        const possible = parseFloat(rawTotalVal) || defaultPossible;
        const percentage = !isNaN(earned) && possible > 0 ? (earned / possible) * 100 : null;

        const rowArea = detectedArea || singleAreaCol?.areaCode || ((areaKey && row[areaKey]) ? String(row[areaKey]).trim().toUpperCase() : selectedAreaMode);

        let status: ParsedScoreRow['status'] = 'READY';
        let statusMessage = 'Ready to import';

        if (isNaN(earned) || earned < 0) {
          status = 'INVALID_SCORE';
          statusMessage = `Invalid numeric score "${rawScoreVal}"`;
        } else if (earned > possible) {
          status = 'INVALID_SCORE';
          statusMessage = `Score (${earned}) exceeds possible (${possible})`;
        } else if (!matchedUser) {
          status = 'UNMATCHED';
          statusMessage = `Reviewee not found in DB with ID "${rawId || 'N/A'}" or name "${rawName || 'N/A'}"`;
        } else {
          statusMessage = matchType === 'EXACT_ID' ? `Matched by ID (${normId})` : `Matched by Name (${rawName})`;
        }

        processed.push({
          id: `row_${idx}`,
          rowIndex: idx + 1,
          rawId,
          normalizedId: normId,
          rawName: rawName || (matchedUser ? resolveCanonicalUserIdentity(matchedUser).fullName : 'Unknown'),
          rawScore: rawScoreVal,
          earnedScore: !isNaN(earned) ? earned : null,
          possiblePoints: possible,
          percentage,
          area: rowArea,
          subjectCode: rowArea,
          category: rowCat,
          examDate: rowDate,
          quizName: rowQuizName,
          quizClass: rowQuizClass,
          studentAnswers,
          answerKeys,
          matchedUser,
          matchType,
          status,
          statusMessage,
          selected: status === 'READY',
        });
      }
    });

    setParsedRows(processed);
  };

  // Toggle individual row selection
  const handleToggleRowSelect = (rowId: string) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, selected: !r.selected } : r))
    );
  };

  // Toggle select all valid rows
  const handleToggleSelectAll = (select: boolean) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.status === 'INVALID_SCORE') return r;
        return { ...r, selected: select };
      })
    );
  };

  // Filtered preview rows based on tab & search
  const visibleRows = useMemo(() => {
    let rows = parsedRows;

    if (tableFilter === 'ready') {
      rows = rows.filter((r) => r.status === 'READY');
    } else if (tableFilter === 'warnings') {
      rows = rows.filter((r) => r.status === 'WARNING_OVERWRITE' || r.status === 'CONFLICT_NAME');
    } else if (tableFilter === 'unmatched') {
      rows = rows.filter((r) => r.status === 'UNMATCHED' || r.status === 'INVALID_SCORE');
    }

    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      rows = rows.filter((r) => {
        return (
          r.rawName.toLowerCase().includes(q) ||
          r.normalizedId.toLowerCase().includes(q) ||
          r.rawId.toLowerCase().includes(q) ||
          r.area.toLowerCase().includes(q)
        );
      });
    }

    return rows;
  }, [parsedRows, tableFilter, searchFilter]);

  // Statistics summaries
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const ready = parsedRows.filter((r) => r.status === 'READY').length;
    const warnings = parsedRows.filter((r) => r.status === 'WARNING_OVERWRITE' || r.status === 'CONFLICT_NAME').length;
    const unmatched = parsedRows.filter((r) => r.status === 'UNMATCHED' || r.status === 'INVALID_SCORE').length;
    const selectedCount = parsedRows.filter((r) => r.selected).length;

    return { total, ready, warnings, unmatched, selectedCount };
  }, [parsedRows]);

  // Download Template (Single Area, All Areas Matrix, or ZipGrade Export)
  const handleDownloadTemplate = (format: 'single' | 'matrix' | 'zipgrade' = uploadScope, withReviewees: boolean = false) => {
    let csvContent = '';
    const activeArea = selectedAreaMode || 'CLJ';

    if (format === 'zipgrade') {
      csvContent = 'QuizName,QuizClass,FirstName,LastName,ZipGradeID,ExternalID,EarnedPts,PossiblePts,PercentCorrect,QuizCreated,DataExported,KeyVersion\n';

      if (withReviewees && revieweeList.length > 0) {
        revieweeList.forEach((user) => {
          const canon = resolveCanonicalUserIdentity(user);
          const fName = (canon.firstName || user.first_name || user.firstName || '').replace(/,/g, ' ').trim();
          const lName = (canon.lastName || user.last_name || user.lastName || '').replace(/,/g, ' ').trim();
          const idNum = (canon.idNumber || user.seqId || user.seq_id || user.id_number || '').replace(/,/g, ' ').trim();
          csvContent += `"CKCM EVALUATION ${activeArea} JUNE","CKCM BRANCH","${fName}","${lName}",${idNum},"",,100.0,,"Jun 04 2026 03:50 pm","Jun 18 2026 10:17 pm",""\n`;
        });
      } else {
        csvContent += '"CKCM EVALUATION FS JUNE","CKCM BRANCH","JEAN","BAUT",115526,"",38.0,100.0,38.0,"Jun 04 2026 03:50 pm","Jun 18 2026 10:17 pm",""\n';
        csvContent += '"CKCM EVALUATION FS JUNE","CKCM BRANCH","REXLER","YPIL",104226,"",55.0,100.0,55.0,"Jun 04 2026 03:55 pm","Jun 18 2026 10:17 pm",""\n';
        csvContent += '"CKCM EVALUATION FS JUNE","CKCM BRANCH","JUNWEL","GUMISAD",106726,"",48.0,100.0,48.0,"Jun 04 2026 03:56 pm","Jun 18 2026 10:17 pm",""\n';
        csvContent += '"CKCM EVALUATION FS JUNE","CKCM BRANCH","JOHN LENON","SENTE",108526,"",65.0,100.0,65.0,"Jun 04 2026 03:56 pm","Jun 18 2026 10:17 pm",""\n';
        csvContent += '"CKCM EVALUATION FS JUNE","CKCM BRANCH","JOHN PHILIP","ODCHIGUE",112126,"",61.0,100.0,61.0,"Jun 04 2026 03:58 pm","Jun 18 2026 10:17 pm",""\n';
      }
    } else if (format === 'single') {
      csvContent = 'First Name,Last Name,ID Number,Score\n';

      if (withReviewees && revieweeList.length > 0) {
        revieweeList.forEach((user) => {
          const canon = resolveCanonicalUserIdentity(user);
          const fName = (canon.firstName || user.first_name || user.firstName || '').replace(/,/g, ' ').trim();
          const lName = (canon.lastName || user.last_name || user.lastName || '').replace(/,/g, ' ').trim();
          const idNum = (canon.idNumber || user.seqId || user.seq_id || user.id_number || '').replace(/,/g, ' ').trim();
          csvContent += `"${fName}","${lName}","${idNum}",\n`;
        });
      } else {
        csvContent += 'Juan,Dela Cruz,2026-001,88\n';
        csvContent += 'Maria,Santos,2026-002,92\n';
        csvContent += 'Carlos,Reyes,2026-003,78\n';
        csvContent += 'Ana,Garcia,2026-004,85\n';
        csvContent += 'Mark,Bautista,2026-005,80\n';
      }
    } else {
      csvContent = 'First Name,Last Name,ID Number,CLJ,LEA,CDI,FS,CRIM,CA\n';

      if (withReviewees && revieweeList.length > 0) {
        revieweeList.forEach((user) => {
          const canon = resolveCanonicalUserIdentity(user);
          const fName = (canon.firstName || user.first_name || user.firstName || '').replace(/,/g, ' ').trim();
          const lName = (canon.lastName || user.last_name || user.lastName || '').replace(/,/g, ' ').trim();
          const idNum = (canon.idNumber || user.seqId || user.seq_id || user.id_number || '').replace(/,/g, ' ').trim();
          csvContent += `"${fName}","${lName}","${idNum}",,,,,,\n`;
        });
      } else {
        csvContent += 'Juan,Dela Cruz,2026-001,85,90,82,78,88,91\n';
        csvContent += 'Maria,Santos,2026-002,92,89,94,88,90,93\n';
        csvContent += 'Carlos,Reyes,2026-003,78,75,80,72,79,84\n';
        csvContent += 'Ana,Garcia,2026-004,88,91,85,82,86,89\n';
        csvContent += 'Mark,Bautista,2026-005,82,84,79,88,90,85\n';
      }
    }

    const downloadFileName = format === 'zipgrade'
      ? (withReviewees ? `ZipGrade_${activeArea}_Evaluation_Reviewees.csv` : `ZipGrade_${activeArea}_Evaluation_Template.csv`)
      : format === 'single'
      ? (withReviewees ? `Samaritan_${activeArea}_Single_Area_Reviewees.csv` : `Samaritan_${activeArea}_Single_Area_Template.csv`)
      : (withReviewees ? 'Samaritan_All_Areas_Reviewees.csv' : 'Samaritan_All_Areas_Matrix_Template.csv');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', downloadFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Execute Bulk Upload to Firestore
  const handleExecuteUpload = async () => {
    const selectedRows = parsedRows.filter((r) => r.selected && r.matchedUser && r.earnedScore !== null);
    if (selectedRows.length === 0) {
      alert('Please select at least one matched row to import.');
      return;
    }

    if (!firestoreDb) {
      alert('Firestore database connection is unavailable.');
      return;
    }

    const targetFolderName = folders.find((f) => f.id === selectedFolderId)?.name || 'Main Folder';

    await scoreUploadCtx.startBackgroundUpload(
      {
        fileName: fileName || 'Scores.csv',
        selectedFolderId: selectedFolderId || 'main',
        selectedFolderName: targetFolderName,
        selectedCategory: selectedCategory || 'Daily Evaluation',
        selectedAreaMode: selectedAreaMode || 'CLJ',
        publicationStatus: publicationStatus || 'published',
        examDate: examDate || new Date().toISOString().split('T')[0],
        currentUser,
      },
      parsedRows,
      onUploadComplete
    );
  };

  const handleCloseOrMinimize = () => {
    if (isUploading) {
      scoreUploadCtx.minimizeModal();
      onClose();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-teal-300">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                Bulk Score CSV Upload
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-200 border border-teal-400/30">
                  Batch Processor
                </span>
              </h2>
              <p className="text-xs text-teal-100/80 font-medium">
                Upload student assessment marks in bulk from CSV, Excel exported sheets, or ZipGrade matrices.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                scoreUploadCtx.minimizeModal();
                onClose();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Minimize to background - upload will continue running while you navigate"
            >
              <Minimize2 size={15} />
              <span className="hidden sm:inline">Minimize</span>
            </button>
            <button
              onClick={handleCloseOrMinimize}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title={isUploading ? "Minimize upload to background" : "Close"}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: Global Upload Configuration */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Folder size={15} className="text-teal-600" />
                1. Target Folder & Examination Context
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('zipgrade', false)}
                  className="text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl border border-amber-300 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Download ZipGrade standard CSV template with QuizName, FirstName, LastName, ZipGradeID, EarnedPts, PossiblePts"
                >
                  <Download size={13} className="text-amber-700" />
                  <span>Download ZipGrade Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate(uploadScope, false)}
                  className="text-[11px] font-bold text-teal-800 hover:text-teal-900 bg-teal-100/80 hover:bg-teal-200/80 px-3 py-1.5 rounded-xl border border-teal-300/80 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title={uploadScope === 'single' ? "Download CSV template for a single major area" : "Download CSV template for all 6 major areas"}
                >
                  <Download size={13} className="text-teal-700" />
                  <span>
                    {uploadScope === 'single'
                      ? `Download Single Area Template`
                      : `Download Matrix Template (6 Areas)`}
                  </span>
                </button>
                {revieweeList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate(uploadScope, true)}
                    className="text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    title="Export all current reviewees into this CSV format with pre-filled names and IDs"
                  >
                    <Download size={13} className="text-slate-500" />
                    <span>Pre-fill with {revieweeList.length} Reviewees</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scope Mode Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl border border-slate-300/70">
              <button
                type="button"
                onClick={() => setUploadScope('single')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  uploadScope === 'single'
                    ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={14} className={uploadScope === 'single' ? 'text-teal-600' : 'text-slate-400'} />
                <span>Single Major Area (First Name, Last Name, ID Number, Score)</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadScope('matrix')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  uploadScope === 'matrix'
                    ? 'bg-white text-slate-900 shadow-sm font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet size={14} className={uploadScope === 'matrix' ? 'text-teal-600' : 'text-slate-400'} />
                <span>All 6 Major Areas Matrix (CLJ, LEA, CDI, FS, CRIM, CA)</span>
              </button>
            </div>

            {/* Template Column Structure Guide */}
            <div className="p-3 bg-white border border-slate-200/90 rounded-xl space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-black uppercase tracking-wider text-slate-700">
                <span className="flex items-center gap-1.5 text-teal-800">
                  <FileSpreadsheet size={13} className="text-teal-600" />
                  Required CSV Columns ({uploadScope === 'single' ? 'Single Area' : 'All 6 Major Areas'})
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {uploadScope === 'single'
                    ? 'First Name, Last Name, ID Number, Score'
                    : 'First Name, Last Name, ID Number, then score per major area'}
                </span>
              </div>
              {uploadScope === 'single' ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 font-bold border border-blue-200 rounded-md">First Name</span>
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 font-bold border border-blue-200 rounded-md">Last Name</span>
                    <span className="px-2.5 py-0.5 bg-purple-50 text-purple-800 font-bold border border-purple-200 rounded-md">ID Number</span>
                    <span className="px-2.5 py-0.5 bg-teal-100 text-teal-900 font-extrabold border border-teal-300 rounded-md">
                      Score ({selectedAreaMode || 'CLJ'})
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Uploads scores for <strong>{MAJOR_AREAS.find((a) => a.code === selectedAreaMode)?.name || selectedAreaMode}</strong>. You can name the score column <code>Score</code> or <code>{selectedAreaMode}</code>.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-800 font-bold border border-blue-200 rounded-md">First Name</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-800 font-bold border border-blue-200 rounded-md">Last Name</span>
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-800 font-bold border border-purple-200 rounded-md">ID Number</span>
                    <span className="px-2 py-0.5 bg-teal-50 text-teal-800 font-bold border border-teal-200 rounded-md">CLJ</span>
                    <span className="px-2 py-0.5 bg-teal-50 text-teal-800 font-bold border border-teal-200 rounded-md">LEA</span>
                    <span className="px-2 py-0.5 bg-teal-50 text-teal-800 font-bold border border-teal-200 rounded-md">CDI</span>
                    <span className="px-2 py-0.5 bg-teal-50 text-teal-800 font-bold border border-teal-200 rounded-md">FS</span>
                    <span className="px-2 py-0.5 bg-teal-50 text-teal-800 font-bold border border-teal-200 rounded-md">CRIM</span>
                    <span className="px-2 py-0.5 bg-teal-50 text-teal-800 font-bold border border-teal-200 rounded-md">CA</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    <strong>Major Areas:</strong> CLJ (Criminal Law), LEA (Law Enforcement), CDI (Crime Detection), FS (Forensic Science), CRIM (Criminology), CA (Correctional Administration). Blank cells are automatically skipped.
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* Folder Selector */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Target Score Folder <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
                >
                  <option value="main">Main Score Folder (Default)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.folderType || f.type || 'Custom'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Selector */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Default Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Area / Subject Mode */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Target Major Area <span className="text-rose-500">*</span>
                </label>
                {uploadScope === 'single' ? (
                  <select
                    value={selectedAreaMode}
                    onChange={(e) => setSelectedAreaMode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-teal-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-teal-500 ring-2 ring-teal-500/10"
                  >
                    {MAJOR_AREAS.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-teal-600" />
                    <span>All 6 Areas from Columns</span>
                  </div>
                )}
              </div>

              {/* Default Max Score / Total Items */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Total Items / Possible Points
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={defaultTotalItems}
                  onChange={(e) => setDefaultTotalItems(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
                />
              </div>

              {/* Examination Date */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Examination Date
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
                />
              </div>

              {/* Publication Status */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Portal Visibility
                </label>
                <div className="flex items-center gap-2 h-9">
                  <button
                    type="button"
                    onClick={() => setPublicationStatus('published')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      publicationStatus === 'published'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Eye size={13} className={publicationStatus === 'published' ? 'text-emerald-600' : ''} />
                    <span>Live / Published</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublicationStatus('hidden')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      publicationStatus === 'hidden'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <EyeOff size={13} className={publicationStatus === 'hidden' ? 'text-amber-600' : ''} />
                    <span>Draft / Hidden</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: CSV File Upload Dropzone */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,text/csv"
              className="hidden"
            />

            {!fileName ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-teal-50/30 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-sm">
                  <Upload size={26} />
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-800 group-hover:text-teal-700 transition-colors">
                  Click to select or drag and drop your CSV score file
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1 max-w-md mx-auto">
                  Upload CSV files exported directly from <strong>ZipGrade</strong> (with <code>EarnedPts</code> and <code>PossiblePts</code>), single area spreadsheets, or grade matrices.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-slate-600">
                  <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg font-mono">
                    ZipGrade: EarnedPts &bull; PossiblePts (100/100) &bull; Stu1..Stu100
                  </span>
                  <span className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-900 rounded-lg font-mono">
                    Table: First Name, Last Name, ID Number, Score
                  </span>
                  <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg">
                    Auto-matches ZipGrade ID / Student ID
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 truncate max-w-sm">{fileName}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Size: {fileSize} &bull; Parsed Rows: <strong className="text-slate-800">{parsedRows.length}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Change File
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFileName(null);
                      setParsedRows([]);
                      setParseError(null);
                      scoreUploadCtx.dismissSummary();
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}

            {isParsing && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-teal-600">
                <RefreshCw size={15} className="animate-spin" />
                <span>Parsing CSV and matching reviewees in database...</span>
              </div>
            )}

            {parseError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700">
                <AlertCircle size={16} className="shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          {/* STEP 3: Pre-Flight Review Table & Filter Tabs */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              {/* Stat Summary Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div
                  onClick={() => setTableFilter('all')}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    tableFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Total Rows</span>
                  <span className="text-xl font-black">{stats.total}</span>
                </div>

                <div
                  onClick={() => setTableFilter('ready')}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    tableFilter === 'ready'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                      : 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:border-emerald-300'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Ready to Import</span>
                  <span className="text-xl font-black">{stats.ready}</span>
                </div>

                <div
                  onClick={() => setTableFilter('warnings')}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    tableFilter === 'warnings'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                      : 'bg-amber-50/70 text-amber-900 border-amber-200 hover:border-amber-300'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Warnings / Conflicts</span>
                  <span className="text-xl font-black">{stats.warnings}</span>
                </div>

                <div
                  onClick={() => setTableFilter('unmatched')}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    tableFilter === 'unmatched'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                      : 'bg-rose-50/70 text-rose-900 border-rose-200 hover:border-rose-300'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Unmatched / Errors</span>
                  <span className="text-xl font-black">{stats.unmatched}</span>
                </div>
              </div>

              {/* Table Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by student ID, name, or area..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(true)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(false)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                  <span className="text-xs font-extrabold text-teal-800 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200">
                    {stats.selectedCount} selected for import
                  </span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm max-h-80 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-black text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 backdrop-blur-sm">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">Import</th>
                      <th className="py-2.5 px-3">CSV Student ID</th>
                      <th className="py-2.5 px-3">Matched Reviewee</th>
                      <th className="py-2.5 px-3">Subject / Area</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                          No rows match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((row) => (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            !row.selected ? 'opacity-50 bg-slate-50/30' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => handleToggleRowSelect(row.id)}
                              disabled={row.status === 'INVALID_SCORE'}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            />
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {row.rawId || '—'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            {row.matchedUser ? (
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate">
                                  {resolveCanonicalUserIdentity(row.matchedUser).fullName}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium truncate">
                                  {row.matchedUser.school || 'Samaritan Reviewee'}
                                </div>
                              </div>
                            ) : (
                              <div className="text-rose-600 font-bold text-[11px] flex items-center gap-1">
                                <AlertCircle size={12} />
                                <span>{row.rawName || 'Unmatched Account'}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 font-extrabold text-teal-700">
                            {row.area}
                          </td>

                          <td className="py-2.5 px-3">
                            {row.earnedScore !== null ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-slate-900">
                                  {row.earnedScore} / {row.possiblePoints}
                                </span>
                                {row.percentage !== null && (
                                  <span
                                    className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                      row.percentage >= 75
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {row.percentage.toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-rose-500 font-bold">Invalid</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                row.status === 'READY'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : row.status === 'WARNING_OVERWRITE'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : row.status === 'UNMATCHED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {row.status === 'READY' && <CheckCircle2 size={10} />}
                              {row.status === 'UNMATCHED' && <AlertCircle size={10} />}
                              {row.statusMessage}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress Bar during Execution */}
          {isUploading && uploadProgress && (
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-teal-900">
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-teal-600 shrink-0" />
                  <span>Writing score records into Firestore & synchronizing reviewee portals in the background...</span>
                </span>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <span>
                    {uploadProgress.current} / {uploadProgress.total} (
                    {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      scoreUploadCtx.minimizeModal();
                      onClose();
                    }}
                    className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                    title="Minimize dialog and continue uploading in the background"
                  >
                    <Minimize2 size={12} />
                    <span>Minimize</span>
                  </button>
                </div>
              </div>
              <div className="w-full h-2.5 bg-teal-200/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 transition-all duration-200"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-teal-700 font-medium">
                You can minimize this dialog and freely navigate to other pages or screens — the upload will continue running in the background without cancellation.
              </p>
            </div>
          )}

          {/* Upload Complete Summary */}
          {uploadSuccessSummary && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-900">Bulk Upload Successful!</h4>
                  <p className="text-xs text-emerald-700 font-medium">
                    Successfully wrote and synchronized <strong className="font-black">{uploadSuccessSummary.successCount}</strong> score record(s) into folder{' '}
                    <strong>{folders.find((f) => f.id === selectedFolderId)?.name || 'Default'}</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shrink-0 cursor-pointer self-end sm:self-auto"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {stats.selectedCount > 0 ? (
              <span>
                Ready to import <strong className="text-slate-800 font-black">{stats.selectedCount}</strong> score(s) into folder{' '}
                <strong className="text-teal-700 font-bold">{folders.find((f) => f.id === selectedFolderId)?.name || 'Main Folder'}</strong>
              </span>
            ) : (
              <span>Select or drop a CSV file above to review parsed rows.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isUploading ? (
              <button
                type="button"
                onClick={() => {
                  scoreUploadCtx.minimizeModal();
                  onClose();
                }}
                className="px-4 py-2.5 bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Minimize2 size={14} />
                <span>Minimize to Background</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={handleExecuteUpload}
              disabled={isUploading || stats.selectedCount === 0}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Importing Scores...</span>
                </>
              ) : (
                <>
                  <Upload size={14} className="stroke-[2.5]" />
                  <span>Import {stats.selectedCount} Scores</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
