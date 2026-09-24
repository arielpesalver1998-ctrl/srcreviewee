import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  FolderSync,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Plus,
  Shield,
  Layers,
  Database,
  ArrowRight,
  ExternalLink,
  Users,
  FileSpreadsheet,
  Check,
  Copy,
  Clock,
  Sparkles,
  Archive,
  ChevronRight,
  X,
  Calendar,
  Building,
  MapPin,
  CheckCheck
} from 'lucide-react';
import {
  fetchAdminFolders,
  subscribeToAdminFolders,
  verifyFolderPortalSync,
  setFolderPublicationStatus,
  syncFolderAcrossCollections,
  syncAllFoldersAcrossCollections,
  createAdminScoreFolder,
  AdminScoreFolderSummary,
  FolderSyncVerificationResult
} from '../services/adminFolderService';
import { FolderType, FolderPublicationStatus, FOLDER_TYPE_LABELS } from '../constants/folderTypes';
import { getUserRole } from '../utils/roleUtils';

interface AdminFolderSyncViewerProps {
  currentUser?: any;
  onClose?: () => void;
  onSelectFolder?: (folderId: string) => void;
  isModal?: boolean;
}

export const AdminFolderSyncViewer: React.FC<AdminFolderSyncViewerProps> = ({
  currentUser,
  onClose,
  onSelectFolder,
  isModal = false,
}) => {
  const [folders, setFolders] = useState<AdminScoreFolderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'hidden' | 'draft' | 'archived'>('all');
  const [onlyMyFolders, setOnlyMyFolders] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Verification modal state
  const [selectedVerification, setSelectedVerification] = useState<FolderSyncVerificationResult | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // New folder modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderType, setNewFolderType] = useState<FolderType>('phase_1');
  const [newFolderStatus, setNewFolderStatus] = useState<FolderPublicationStatus>('published');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const adminUid = currentUser?.uid || currentUser?.id || 'YD0CnZExOigBV1hs3P6FLCPjbAq1';
  const adminEmail = (currentUser?.email || '').toLowerCase();
  const role = getUserRole(currentUser);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Real-time subscription to admin folders
  useEffect(() => {
    setLoading(true);
    const filter = onlyMyFolders ? { uid: adminUid, email: adminEmail } : null;

    const unsubscribe = subscribeToAdminFolders(
      (data) => {
        setFolders(data);
        setLoading(false);
      },
      filter,
      (err) => {
        console.error('Real-time subscription error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [onlyMyFolders, adminUid, adminEmail]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const filter = onlyMyFolders ? { uid: adminUid, email: adminEmail } : null;
      const data = await fetchAdminFolders(filter);
      setFolders(data);
      showToast('Folders successfully refreshed from Firestore.');
    } catch (err: any) {
      showToast(`Refresh error: ${err.message || 'Failed to fetch folders'}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncAllCollections = async () => {
    setSyncingAll(true);
    try {
      const res = await syncAllFoldersAcrossCollections(currentUser);
      showToast(`Successfully synchronized ${res.syncedCount} folder(s) across Firestore collections!`);
      const filter = onlyMyFolders ? { uid: adminUid, email: adminEmail } : null;
      const data = await fetchAdminFolders(filter);
      setFolders(data);
    } catch (err: any) {
      showToast(`Sync error: ${err.message || 'Failed to synchronize collections'}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleTogglePublish = async (folder: AdminScoreFolderSummary) => {
    const nextStatus = folder.publicationStatus === 'published' ? 'hidden' : 'published';
    try {
      await setFolderPublicationStatus(folder.id, nextStatus, currentUser);
      showToast(`Folder "${folder.name}" is now ${nextStatus === 'published' ? 'Live & Published in Portal' : 'Hidden from Reviewees'}.`);
    } catch (err: any) {
      showToast(`Error updating folder status: ${err.message}`);
    }
  };

  const handleSyncSingleFolder = async (folderId: string) => {
    try {
      await syncFolderAcrossCollections(folderId, currentUser);
      showToast('Folder successfully mirrored to both collections!');
    } catch (err: any) {
      showToast(`Error syncing folder: ${err.message}`);
    }
  };

  const handleVerifySync = async (folderId: string) => {
    setVerifyingId(folderId);
    try {
      const result = await verifyFolderPortalSync(folderId);
      setSelectedVerification(result);
    } catch (err: any) {
      showToast(`Verification failed: ${err.message}`);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    try {
      const created = await createAdminScoreFolder(
        {
          name: newFolderName.trim(),
          folderType: newFolderType,
          publicationStatus: newFolderStatus,
          description: newFolderDesc.trim(),
          schoolScope: 'all',
          branchScope: 'all',
        },
        currentUser
      );
      showToast(`Folder "${created.name}" created and synced to Firestore!`);
      setIsCreateModalOpen(false);
      setNewFolderName('');
      setNewFolderDesc('');
    } catch (err: any) {
      showToast(`Error creating folder: ${err.message}`);
    } finally {
      setCreatingFolder(false);
    }
  };

  // Filtered list
  const filteredFolders = useMemo(() => {
    return folders.filter((f) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = f.name.toLowerCase().includes(q);
        const matchesType = f.folderTypeLabel.toLowerCase().includes(q) || f.folderType.toLowerCase().includes(q);
        const matchesId = f.id.toLowerCase().includes(q);
        const matchesScope = f.scopeSummary.toLowerCase().includes(q);
        if (!matchesName && !matchesType && !matchesId && !matchesScope) return false;
      }

      if (statusFilter === 'live') {
        return f.isSyncedInPortal;
      }
      if (statusFilter === 'hidden') {
        return f.publicationStatus === 'hidden' && !f.isArchived && !f.isDeleted;
      }
      if (statusFilter === 'draft') {
        return f.publicationStatus === 'draft';
      }
      if (statusFilter === 'archived') {
        return f.isArchived || f.isDeleted;
      }

      return true;
    });
  }, [folders, searchQuery, statusFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = folders.length;
    const live = folders.filter((f) => f.isSyncedInPortal).length;
    const hidden = folders.filter((f) => f.publicationStatus === 'hidden').length;
    const revieweesTotal = folders.reduce((sum, f) => sum + (f.eligibleRevieweesCount || 0), 0);
    const scoresTotal = folders.reduce((sum, f) => sum + (f.associatedScoresCount || 0), 0);
    return { total, live, hidden, revieweesTotal, scoresTotal };
  }, [folders]);

  return (
    <div className={`w-full ${isModal ? 'p-6' : 'p-4 sm:p-6'} bg-slate-50 min-h-[600px] flex flex-col`}>
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[1000] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold border border-teal-500/30 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={16} className="text-teal-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md">
              <FolderSync size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Admin Score Folders & Sync
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Verify folders created by the admin account, audit Firestore synchronization, and configure portal visibility.
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSyncAllCollections}
            disabled={syncingAll}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Mirror folders across scoreFolders & score_folders collections"
          >
            <Database size={14} className={syncingAll ? 'animate-spin text-teal-600' : 'text-slate-500'} />
            <span>{syncingAll ? 'Syncing...' : 'Sync Collections'}</span>
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-teal-600' : 'text-slate-500'} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>New Folder</span>
          </button>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-700 transition-colors ml-1"
              title="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Folders</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{metrics.total}</span>
            <Folder size={18} className="text-slate-400" />
          </div>
          <span className="text-[10px] font-semibold text-slate-500 mt-1">Managed in Firestore</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Live in Portal</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-emerald-700">{metrics.live}</span>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <span className="text-[10px] font-semibold text-emerald-600 mt-1">Published to Reviewees</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Hidden / Draft</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-700">{metrics.hidden}</span>
            <EyeOff size={18} className="text-amber-500" />
          </div>
          <span className="text-[10px] font-semibold text-amber-600 mt-1">Stored but unlisted</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">Records Mapped</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-blue-700">{metrics.scoresTotal}</span>
            <FileSpreadsheet size={18} className="text-blue-500" />
          </div>
          <span className="text-[10px] font-semibold text-blue-600 mt-1">Linked assessments</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search folders by name, type, ID, or scope..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-teal-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({folders.length})
          </button>
          <button
            onClick={() => setStatusFilter('live')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'live'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Live ({metrics.live})
          </button>
          <button
            onClick={() => setStatusFilter('hidden')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'hidden'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Hidden ({metrics.hidden})
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'archived'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Folders List */}
      <div className="flex-1 space-y-3">
        {loading ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
            <RefreshCw size={28} className="animate-spin text-teal-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">Connecting to Firestore & Verifying Folders...</p>
            <p className="text-xs text-slate-400 mt-1">Querying scoreFolders and score_folders collections...</p>
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300">
            <Folder size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">No score folders match your filter</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing your search query or creating a new folder.</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Create New Folder
            </button>
          </div>
        ) : (
          filteredFolders.map((folder) => {
            const isLive = folder.isSyncedInPortal;
            const hasSnake = folder.foundInCollections.includes('score_folders');
            const hasCamel = folder.foundInCollections.includes('scoreFolders');
            const isDualSynced = hasSnake && hasCamel;

            return (
              <div
                key={folder.id}
                className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-sm transition-all hover:shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Folder Info */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                      <Folder size={16} className={isLive ? 'text-teal-600' : 'text-slate-400'} />
                    </div>

                    <h3 className="text-base font-black text-slate-900 tracking-tight truncate">
                      {folder.name}
                    </h3>

                    {/* Folder Type Badge */}
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      {folder.folderTypeLabel}
                    </span>

                    {/* Sync Status Badge */}
                    {isLive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        Live in Portal
                      </span>
                    ) : folder.publicationStatus === 'hidden' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                        <EyeOff size={12} className="text-amber-500" />
                        Hidden
                      </span>
                    ) : folder.isArchived ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                        <Archive size={12} />
                        Archived
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                        <Clock size={12} />
                        Draft
                      </span>
                    )}

                    {/* Dual Collections Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-extrabold tracking-wider border ${
                        isDualSynced
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                      title={
                        isDualSynced
                          ? 'Present in both scoreFolders and score_folders'
                          : `Present only in ${folder.foundInCollections.join(', ')}`
                      }
                    >
                      <Database size={10} />
                      {isDualSynced ? 'Dual-Synced' : hasCamel ? 'scoreFolders only' : 'score_folders only'}
                    </span>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Shield size={12} className="text-slate-400" />
                      Creator: <strong className="text-slate-700">{folder.createdByName || 'Admin'}</strong>
                    </span>

                    <span className="flex items-center gap-1">
                      <Building size={12} className="text-slate-400" />
                      Scope: <strong className="text-slate-700">{folder.scopeSummary}</strong>
                    </span>

                    <span className="flex items-center gap-1">
                      <Users size={12} className="text-slate-400" />
                      Eligible Reviewees: <strong className="text-slate-700">{folder.eligibleRevieweesCount}</strong>
                    </span>

                    <span className="flex items-center gap-1">
                      <FileSpreadsheet size={12} className="text-slate-400" />
                      Mapped Scores: <strong className="text-slate-700">{folder.associatedScoresCount}</strong>
                    </span>

                    {/* Document ID with copy */}
                    <button
                      onClick={(e) => handleCopyId(folder.id, e)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-700 transition-colors bg-slate-50 px-2 py-0.5 rounded border border-slate-200 cursor-pointer"
                      title="Copy Folder ID"
                    >
                      <span>ID: {folder.id.substring(0, 10)}...</span>
                      {copiedId === folder.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    </button>
                  </div>

                  {/* Sync issues alert if any */}
                  {folder.syncIssues.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200/60">
                      <AlertCircle size={12} className="shrink-0 text-amber-600" />
                      <span>{folder.syncIssues[0]}</span>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {/* Mirror to other collection if needed */}
                  {!isDualSynced && (
                    <button
                      onClick={() => handleSyncSingleFolder(folder.id)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      title="Copy to both Firestore collections"
                    >
                      <Database size={13} />
                      <span>Sync Collections</span>
                    </button>
                  )}

                  {/* Toggle publish button */}
                  <button
                    onClick={() => handleTogglePublish(folder)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      folder.publicationStatus === 'published'
                        ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700'
                        : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                    }`}
                  >
                    {folder.publicationStatus === 'published' ? (
                      <>
                        <EyeOff size={13} />
                        <span>Hide</span>
                      </>
                    ) : (
                      <>
                        <Eye size={13} />
                        <span>Publish</span>
                      </>
                    )}
                  </button>

                  {/* Verify Sync Diagnostic Button */}
                  <button
                    onClick={() => handleVerifySync(folder.id)}
                    disabled={verifyingId === folder.id}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {verifyingId === folder.id ? (
                      <RefreshCw size={13} className="animate-spin text-teal-400" />
                    ) : (
                      <CheckCheck size={13} className="text-teal-400" />
                    )}
                    <span>Verify Sync</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sync Diagnostic Verification Modal */}
      {selectedVerification && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200 mb-2">
                  <FolderSync size={12} />
                  Firestore Diagnostic Report
                </div>
                <h3 className="text-lg font-black text-slate-900">{selectedVerification.folderName}</h3>
                <p className="text-xs font-mono text-slate-400">ID: {selectedVerification.folderId}</p>
              </div>
              <button
                onClick={() => setSelectedVerification(null)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Checklist */}
            <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-600">scoreFolders Collection:</span>
                <span className="font-bold flex items-center gap-1">
                  {selectedVerification.existsInScoreFolders ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Present
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1">
                      <AlertCircle size={13} /> Missing
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-600">score_folders Collection:</span>
                <span className="font-bold flex items-center gap-1">
                  {selectedVerification.existsInScoreFoldersSnake ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Present
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1">
                      <AlertCircle size={13} /> Missing
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-600">Publication Status:</span>
                <span className="font-bold uppercase text-slate-900">
                  {selectedVerification.publicationStatus}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-600">Live in Portal Dashboard:</span>
                <span className="font-bold flex items-center gap-1">
                  {selectedVerification.isLiveInPortal ? (
                    <span className="text-emerald-600 flex items-center gap-1 font-extrabold">
                      <CheckCircle2 size={13} /> Active & Visible
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1 font-extrabold">
                      <EyeOff size={13} /> Hidden from Portal
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-600">Eligible Enrolled Reviewees:</span>
                <span className="font-extrabold text-slate-900">
                  {selectedVerification.eligibleRevieweesCount} Reviewees
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="font-semibold text-slate-600">Assessment Scores Recorded:</span>
                <span className="font-extrabold text-slate-900">
                  {selectedVerification.matchingScoresCount} Records
                </span>
              </div>
            </div>

            {/* Diagnostic Log Output */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Diagnostic Logs</span>
              <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] space-y-1">
                {selectedVerification.syncDiagnostics.map((diag, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-teal-400 shrink-0">›</span>
                    <span>{diag}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedVerification(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateFolder}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Create New Score Folder</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Create a new folder and automatically sync it across all Firestore collections.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. CKCM MARATHON, Phase 3..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-teal-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Folder Type
                  </label>
                  <select
                    value={newFolderType}
                    onChange={(e) => setNewFolderType(e.target.value as FolderType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-teal-500"
                  >
                    <option value="phase_1">Phase 1</option>
                    <option value="phase_2">Phase 2</option>
                    <option value="marathon">Marathon</option>
                    <option value="final_coaching">Final Coaching</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Publication Status
                  </label>
                  <select
                    value={newFolderStatus}
                    onChange={(e) => setNewFolderStatus(e.target.value as FolderPublicationStatus)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-teal-500"
                  >
                    <option value="published">Published (Live)</option>
                    <option value="hidden">Hidden</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  placeholder="Notes, target examination batch, or instructions..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-teal-500 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingFolder || !newFolderName.trim()}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {creatingFolder ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={14} />}
                <span>Create & Sync</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
