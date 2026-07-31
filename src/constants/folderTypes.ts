export const FOLDER_TYPE_LABELS = {
  phase_1: "Phase 1",
  phase_2: "Phase 2",
  marathon: "Marathon",
  final_coaching: "Final Coaching",
  custom: "Custom"
} as const;

export type FolderType = keyof typeof FOLDER_TYPE_LABELS;

export function normalizeFolderType(value: unknown): FolderType {
  if (!value || typeof value !== 'string') return 'custom';
  const clean = value.trim().toLowerCase();
  
  if (clean === 'phase_1' || clean === 'phase1' || clean === 'phase 1' || clean === 'phase_1') return 'phase_1';
  if (clean === 'phase_2' || clean === 'phase2' || clean === 'phase 2' || clean === 'phase_2') return 'phase_2';
  if (clean === 'marathon') return 'marathon';
  if (clean === 'final_coaching' || clean === 'final-coaching' || clean === 'final coaching' || clean === 'finalcoaching' || clean === 'final_coaching') return 'final_coaching';
  if (clean === 'custom') return 'custom';
  
  return 'custom';
}

export const getFolderTypeLabel = (value: unknown): string => {
  const normalized = normalizeFolderType(value);
  return FOLDER_TYPE_LABELS[normalized] ?? FOLDER_TYPE_LABELS.custom;
};

export type FolderPublicationStatus = 'draft' | 'hidden' | 'published';

export function normalizeFolderPublicationStatus(value: unknown): FolderPublicationStatus {
  if (!value || typeof value !== 'string') return 'draft';
  const clean = value.trim().toLowerCase();
  if (clean === 'published' || clean === 'active' || clean === 'visible') return 'published';
  if (clean === 'hidden' || clean === 'inactive') return 'hidden';
  if (clean === 'draft') return 'draft';
  return 'draft';
}

export interface ScoreFolderNormalized {
  id: string;
  name: string;
  folderType: FolderType;
  folderTypeLabel: string;
  publicationStatus: FolderPublicationStatus;
  isArchived: boolean;
  isDeleted: boolean;
  schoolScope?: string;
  selectedSchoolIds?: string[];
  branchScope?: string;
  selectedBranchIds?: string[];
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export function normalizeScoreFolder(rawFolder: any): ScoreFolderNormalized {
  if (!rawFolder) {
    return {
      id: '',
      name: '',
      folderType: 'custom',
      folderTypeLabel: FOLDER_TYPE_LABELS.custom,
      publicationStatus: 'draft',
      isArchived: false,
      isDeleted: false,
    };
  }

  const id = rawFolder.id || '';
  const name = rawFolder.name || '';
  const folderType = normalizeFolderType(rawFolder.folderType ?? rawFolder.type ?? 'custom');
  const publicationStatus = normalizeFolderPublicationStatus(
    rawFolder.publicationStatus ?? rawFolder.status ?? (rawFolder.isPublished ? 'published' : 'hidden')
  );
  
  const isArchived = rawFolder.isArchived === true || String(rawFolder.isArchived) === 'true';
  const isDeleted = rawFolder.isDeleted === true || String(rawFolder.isDeleted) === 'true';

  return {
    ...rawFolder,
    id,
    name,
    folderType,
    folderTypeLabel: FOLDER_TYPE_LABELS[folderType],
    publicationStatus,
    isArchived,
    isDeleted,
    schoolScope: rawFolder.schoolScope,
    selectedSchoolIds: rawFolder.selectedSchoolIds,
    branchScope: rawFolder.branchScope,
    selectedBranchIds: rawFolder.selectedBranchIds,
    createdAt: rawFolder.createdAt,
    updatedAt: rawFolder.updatedAt,
  };
}

// Simple and robust reviewee visibility helper that combines checking status, archive, delete, and scope.
export function isFolderVisibleToReviewee(folder: any, reviewee: any, isRevieweeInFolderScopeHelper: (reviewee: any, folder: any) => boolean): boolean {
  if (!folder || !reviewee) return false;
  
  const normalized = normalizeScoreFolder(folder);
  
  // 1. Must be published
  if (normalized.publicationStatus !== 'published') return false;
  
  // 2. Must not be archived or deleted
  if (normalized.isArchived || normalized.isDeleted) return false;
  
  // 3. User status check (only if present, check for non-active)
  if (reviewee.status && String(reviewee.status).toLowerCase() !== 'active') {
    return false;
  }
  
  // 4. Delegate school/branch scope check to the authoritative isRevieweeInFolderScope helper
  return isRevieweeInFolderScopeHelper(reviewee, normalized);
}
