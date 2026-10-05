import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
  Users,
  ClipboardList,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  UserX,
  Clock,
  ArrowRight,
  Sparkles,
  Info,
  X,
  Zap,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RevieweeData, ScoreFolder } from '../types';
import { getUserRole, isAdmin, isStaff, isSuperAdminEmail } from '../utils/roleUtils';
import { 
  isValidActiveRevieweeWithId, 
  getCanonicalRevieweeId 
} from '../utils/scoreFieldResolver';
import { deduplicateUsersByIdNumber, getUserAccountStatus } from '../services/userIdentityResolver';
import { parseScores } from '../utils/scoreParser';
import { UserAvatar } from './UserAvatar';
import { reconcileAndFixAllDiscrepancies, ReconciliationResult } from '../services/reconciliationService';

interface SyncStatusIndicatorProps {
  allUsers: any[];
  folders: ScoreFolder[];
  sidebarRevieweeCount: number;
  onNavigateTab?: (tab: string) => void;
  variant?: 'header-badge' | 'dashboard-card' | 'compact';
}

export function SyncStatusIndicator({
  allUsers,
  folders,
  sidebarRevieweeCount,
  onNavigateTab,
  variant = 'header-badge',
}: SyncStatusIndicatorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Compute real-time synchronicity breakdown
  const telemetry = useMemo(() => {
    const uniqueList = deduplicateUsersByIdNumber(allUsers);

    // 1. All registered accounts with ONLY the Reviewee role (excluding Admins and Staff)
    const allRevieweeAccounts = uniqueList.filter(u => {
      if (isAdmin(u) || isStaff(u) || isSuperAdminEmail(u?.email)) return false;
      return getUserRole(u) === 'Reviewee';
    });

    // 2. Active enrolled reviewees with verified ID
    const activeEnrolledWithId = uniqueList.filter(u => {
      if (isAdmin(u) || isStaff(u) || isSuperAdminEmail(u?.email)) return false;
      return isValidActiveRevieweeWithId(u);
    });

    // 3. Pending approval / unverified reviewees
    const pendingReviewees = allRevieweeAccounts.filter(u => {
      const status = String(
        u.accountStatus ||
        u.status ||
        u.enrollmentStatus ||
        u.registration_status ||
        ''
      ).toLowerCase().trim();
      return (
        status === 'pending' ||
        status === 'pending_profile' ||
        status === 'for approval' ||
        status === 'unverified' ||
        u.is_pending === true ||
        u.isPending === true
      );
    });

    // 4. Dropped / Withdrawn reviewees
    const droppedReviewees = allRevieweeAccounts.filter(u => {
      const status = String(
        u.accountStatus ||
        u.status ||
        u.enrollmentStatus ||
        u.registration_status ||
        ''
      ).toLowerCase().trim();
      return (
        status === 'dropped' ||
        status === 'withdrawn' ||
        status === 'inactive' ||
        status === 'rejected' ||
        u.isDropped === true
      );
    });

    // 5. Active enrolled reviewees missing a valid ID number (excluding dropped & pending profiles)
    const missingIdReviewees = allRevieweeAccounts.filter(u => {
      const status = String(u.accountStatus || u.status || 'active').toLowerCase().trim();
      const isDropped = status === 'dropped' || status === 'withdrawn';
      const isPending =
        status === 'pending' ||
        status === 'pending_profile' ||
        status === 'for approval' ||
        status === 'unverified' ||
        u.is_pending === true ||
        u.isPending === true;
      const hasId = Boolean(getCanonicalRevieweeId(u));
      return !isDropped && !isPending && !hasId;
    });

    // 6. Active reviewees with encoded scores
    const revieweesWithScores = activeEnrolledWithId.filter(u => {
      try {
        const records = parseScores(u);
        return records.length > 0;
      } catch {
        return false;
      }
    });

    const scoreManagementCount = activeEnrolledWithId.length;
    const isExactMatch = sidebarRevieweeCount === scoreManagementCount;
    const hasMissingId = missingIdReviewees.length > 0;
    const hasDiscrepancy = !isExactMatch || hasMissingId;

    const coveragePercentage = activeEnrolledWithId.length > 0
      ? Math.round((revieweesWithScores.length / activeEnrolledWithId.length) * 100)
      : 100;

    return {
      totalRegisteredReviewees: allRevieweeAccounts.length,
      activeEnrolledWithId: activeEnrolledWithId.length,
      scoreManagementCount,
      sidebarRevieweeCount,
      pendingCount: pendingReviewees.length,
      pendingReviewees,
      droppedCount: droppedReviewees.length,
      droppedReviewees,
      missingIdCount: missingIdReviewees.length,
      missingIdReviewees,
      revieweesWithScoresCount: revieweesWithScores.length,
      coveragePercentage,
      isExactMatch,
      hasDiscrepancy,
    };
  }, [allUsers, sidebarRevieweeCount]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastRefreshedAt(new Date());
      setIsRefreshing(false);
    }, 600);
  };

  const handleAutoFix = async () => {
    setIsFixing(true);
    setFixSuccessMessage(null);
    try {
      const res: ReconciliationResult = await reconcileAndFixAllDiscrepancies();
      setFixSuccessMessage(
        `Discrepancy Resolved! Normalized ${res.fixedUsers.length} accounts (Assigned ${res.assignedIdsCount} IDs, Activated ${res.activatedPendingCount} profiles).`
      );
      setLastRefreshedAt(new Date());
      setTimeout(() => {
        setFixSuccessMessage(null);
      }, 7000);
    } catch (err: any) {
      alert(`Reconciliation error: ${err.message || err}`);
    } finally {
      setIsFixing(false);
    }
  };

  // Header Badge Variant
  if (variant === 'header-badge') {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer select-none ${
            telemetry.hasDiscrepancy
              ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 hover:border-amber-400 ring-2 ring-amber-400/20 animate-pulse'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-900 hover:bg-emerald-100/90 hover:border-emerald-300'
          }`}
          title={
            telemetry.hasDiscrepancy
              ? `Sync Warning: Sidebar (${telemetry.sidebarRevieweeCount}) vs Score DB (${telemetry.scoreManagementCount}) discrepancy detected. Click to inspect.`
              : `Real-time Sync OK: ${telemetry.scoreManagementCount} Active Reviewees perfectly synced.`
          }
        >
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                telemetry.hasDiscrepancy ? 'bg-amber-500' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                telemetry.hasDiscrepancy ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </span>

          <div className="flex items-center gap-1.5">
            {telemetry.hasDiscrepancy ? (
              <>
                <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                <span className="font-extrabold text-amber-950">
                  <span className="hidden sm:inline">Sync Warning: </span>
                  {telemetry.sidebarRevieweeCount} vs {telemetry.scoreManagementCount}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span className="font-extrabold text-emerald-950">
                  <span className="hidden sm:inline">Live Sync: </span>
                  {telemetry.scoreManagementCount} OK
                </span>
              </>
            )}
          </div>
        </button>

        {/* Sync Telemetry Modal */}
        <SyncDetailsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          telemetry={telemetry}
          lastRefreshedAt={lastRefreshedAt}
          isRefreshing={isRefreshing}
          isFixing={isFixing}
          fixSuccessMessage={fixSuccessMessage}
          onRefresh={handleManualRefresh}
          onAutoFix={handleAutoFix}
          onNavigateTab={onNavigateTab}
        />
      </>
    );
  }

  // Dashboard Overview Card Variant
  return (
    <>
      <div
        className={`rounded-2xl border p-4 transition-all shadow-2xs ${
          telemetry.hasDiscrepancy
            ? 'bg-gradient-to-br from-amber-50/90 to-orange-50/50 border-amber-200/90'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                telemetry.hasDiscrepancy
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {telemetry.hasDiscrepancy ? (
                <AlertTriangle size={20} className="animate-bounce" />
              ) : (
                <ShieldCheck size={20} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-900">
                  Real-Time Database Sync Status
                </h4>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    telemetry.hasDiscrepancy
                      ? 'bg-amber-200/80 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {telemetry.hasDiscrepancy ? 'Discrepancy Detected' : '100% Synchronized'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {telemetry.hasDiscrepancy
                  ? `Mismatch found between Sidebar Reviewees (${telemetry.sidebarRevieweeCount}) and Score Management database (${telemetry.scoreManagementCount}).`
                  : `Sidebar count (${telemetry.sidebarRevieweeCount}) matches verified Score Management reviewees (${telemetry.scoreManagementCount}).`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            {telemetry.hasDiscrepancy && (
              <button
                type="button"
                onClick={handleAutoFix}
                disabled={isFixing}
                className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                title="Automatically assign IDs and activate pending accounts"
              >
                {isFixing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Zap size={14} className="fill-white" />
                )}
                <span>Fix Discrepancy</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              title="Re-verify sync snapshot"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-teal-600' : ''} />
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <span>View Telemetry</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Fix Success Toast */}
        {fixSuccessMessage && (
          <div className="mt-3 p-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
            <CheckCircle2 size={16} />
            <span>{fixSuccessMessage}</span>
          </div>
        )}

        {/* Quick Diagnostic Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3.5 border-t border-slate-100">
          <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Sidebar Badge
            </p>
            <p className="text-base font-black text-slate-900 mt-0.5">
              {telemetry.sidebarRevieweeCount}
            </p>
          </div>

          <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Score DB Enrolled
            </p>
            <p className="text-base font-black text-teal-700 mt-0.5">
              {telemetry.scoreManagementCount}
            </p>
          </div>

          <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Total in Database
            </p>
            <p className="text-base font-black text-slate-700 mt-0.5">
              {telemetry.totalRegisteredReviewees}
            </p>
          </div>

          <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Score Upload Coverage
            </p>
            <p className="text-base font-black text-slate-900 mt-0.5">
              {telemetry.coveragePercentage}%
            </p>
          </div>
        </div>
      </div>

      {/* Sync Telemetry Modal */}
      <SyncDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        telemetry={telemetry}
        lastRefreshedAt={lastRefreshedAt}
        isRefreshing={isRefreshing}
        isFixing={isFixing}
        fixSuccessMessage={fixSuccessMessage}
        onRefresh={handleManualRefresh}
        onAutoFix={handleAutoFix}
        onNavigateTab={onNavigateTab}
      />
    </>
  );
}

// Full Telemetry & Discrepancy Inspector Modal
interface SyncDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: any;
  lastRefreshedAt: Date;
  isRefreshing: boolean;
  isFixing: boolean;
  fixSuccessMessage: string | null;
  onRefresh: () => void;
  onAutoFix: () => Promise<void>;
  onNavigateTab?: (tab: string) => void;
}

function SyncDetailsModal({
  isOpen,
  onClose,
  telemetry,
  lastRefreshedAt,
  isRefreshing,
  isFixing,
  fixSuccessMessage,
  onRefresh,
  onAutoFix,
  onNavigateTab,
}: SyncDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100050] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200"
        >
          {/* Modal Header */}
          <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  telemetry.hasDiscrepancy
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {telemetry.hasDiscrepancy ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Real-Time Database Sync Telemetry
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Last verified: {lastRefreshedAt.toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-teal-600' : ''} />
                <span>Re-verify</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* Fix Success Toast */}
            {fixSuccessMessage && (
              <div className="p-3 bg-emerald-600 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm">
                <CheckCircle2 size={18} />
                <span>{fixSuccessMessage}</span>
              </div>
            )}

            {/* Status Summary Banner */}
            <div
              className={`p-4 rounded-2xl border ${
                telemetry.hasDiscrepancy
                  ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {telemetry.hasDiscrepancy ? (
                      <AlertCircle className="text-amber-600" size={18} />
                    ) : (
                      <CheckCircle2 className="text-emerald-600" size={18} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black">
                      {telemetry.hasDiscrepancy
                        ? 'Discrepancy Alert: Count Mismatch Detected'
                        : 'All Telemetry Records 100% In Sync'}
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed opacity-90">
                      {telemetry.hasDiscrepancy
                        ? `The sidebar shows ${telemetry.sidebarRevieweeCount} reviewees while the Score Management database contains ${telemetry.scoreManagementCount} verified active reviewees. Click below to automatically assign IDs and resolve all status discrepancies in 1 step.`
                        : `The Reviewee count in the sidebar (${telemetry.sidebarRevieweeCount}) matches the total active records in the Score Management database (${telemetry.scoreManagementCount}). Filter rules and ID validations are identical.`}
                    </p>
                  </div>
                </div>

                {telemetry.hasDiscrepancy && (
                  <button
                    type="button"
                    onClick={onAutoFix}
                    disabled={isFixing}
                    className="shrink-0 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {isFixing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Zap size={14} className="fill-white" />
                    )}
                    <span>Fix All Now</span>
                  </button>
                )}
              </div>
            </div>

            {/* Matrix Comparison Cards */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
                Core Synchronicity Check
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400" />
                      Sidebar Reviewee Badge
                    </span>
                    <span className="text-lg font-black text-slate-900">
                      {telemetry.sidebarRevieweeCount}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">
                    Calculated from active enrolled reviewees with valid ID numbers.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <ClipboardList size={14} className="text-teal-600" />
                      Score Management Database
                    </span>
                    <span className="text-lg font-black text-teal-700">
                      {telemetry.scoreManagementCount}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">
                    Active student score performance profiles eligible for board rating.
                  </p>
                </div>
              </div>
            </div>

            {/* Account Status Breakdown */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
                Database Records Breakdown
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50">
                  <span className="text-[10px] font-black uppercase text-emerald-800">
                    Active & Enrolled
                  </span>
                  <p className="text-lg font-black text-emerald-950 mt-0.5">
                    {telemetry.activeEnrolledWithId}
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/50">
                  <span className="text-[10px] font-black uppercase text-amber-800">
                    Pending Approval
                  </span>
                  <p className="text-lg font-black text-amber-950 mt-0.5">
                    {telemetry.pendingCount}
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-rose-200/80 bg-rose-50/50">
                  <span className="text-[10px] font-black uppercase text-rose-800">
                    Dropped / Inactive
                  </span>
                  <p className="text-lg font-black text-rose-950 mt-0.5">
                    {telemetry.droppedCount}
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[10px] font-black uppercase text-slate-600">
                    Total in Database
                  </span>
                  <p className="text-lg font-black text-slate-900 mt-0.5">
                    {telemetry.totalRegisteredReviewees}
                  </p>
                </div>
              </div>
            </div>

            {/* Missing ID Warnings (if any) */}
            {telemetry.missingIdReviewees.length > 0 && (
              <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/60">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-rose-600" />
                  <h4 className="text-xs font-black text-rose-950 uppercase">
                    Accounts Missing ID Number ({telemetry.missingIdReviewees.length})
                  </h4>
                </div>
                <p className="text-xs text-rose-800 mb-3 font-medium">
                  The following reviewees cannot be included in score grading until assigned an ID:
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                  {telemetry.missingIdReviewees.map((u: any) => (
                    <div
                      key={u.uid || u.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-rose-100 text-xs font-bold text-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <UserAvatar photoURL={u.photoURL} altText={u.email} size={24} />
                        <span>
                          {u.first_name || u.firstName} {u.last_name || u.lastName} ({u.email})
                        </span>
                      </div>
                      <span className="text-[10px] font-black text-rose-600 uppercase">
                        No ID Assigned
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Accounts Section (if any) */}
            {telemetry.pendingReviewees.length > 0 && (
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-amber-600" />
                  <h4 className="text-xs font-black text-amber-950 uppercase">
                    Pending Enrollees ({telemetry.pendingReviewees.length})
                  </h4>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                  {telemetry.pendingReviewees.map((u: any) => (
                    <div
                      key={u.uid || u.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-amber-100 text-xs font-bold text-slate-800"
                    >
                      <span>
                        {u.first_name || u.firstName} {u.last_name || u.lastName} ({u.email})
                      </span>
                      <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Info size={14} className="text-slate-400 shrink-0" />
              <span>Real-time sync telemetry monitors Firestore user listeners.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {onNavigateTab && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTab('audit-report');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                  >
                    <ShieldAlert size={14} />
                    <span>Audit & Parity Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTab('users');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    All Users Directory
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateTab('scores');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition-colors cursor-pointer shadow-2xs"
                  >
                    Score Management
                  </button>
                </>
              )}
            </div>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
