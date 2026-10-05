import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Zap,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Users,
  Database,
  Search,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Loader2,
  ExternalLink,
  HelpCircle,
  Copy,
  Check,
  UserCheck,
  UserX,
  FileSpreadsheet
} from 'lucide-react';
import {
  runAutomatedAudit,
  AutomatedAuditReportData,
  AuditRevieweeItem,
  OrphanedScoreItem,
  assignRevieweeId,
  activateRevieweeProfile,
} from '../services/automatedAuditService';
import { reconcileAndFixAllDiscrepancies, ReconciliationResult } from '../services/reconciliationService';
import { UserAvatar } from './UserAvatar';

interface AutomatedAuditReportProps {
  allUsers?: any[];
  onNavigateTab?: (tab: string) => void;
  isEmbedded?: boolean;
}

export const AutomatedAuditReport: React.FC<AutomatedAuditReportProps> = ({
  allUsers = [],
  onNavigateTab,
  isEmbedded = false,
}) => {
  const [report, setReport] = useState<AutomatedAuditReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'issues' | 'missing_id' | 'orphaned' | 'pending' | 'unscored' | 'all'>('issues');
  const [searchQuery, setSearchQuery] = useState('');
  const [isHealerRunning, setIsHealerRunning] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fixingUserId, setFixingUserId] = useState<string | null>(null);

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const data = await runAutomatedAudit(allUsers);
      setReport(data);
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [allUsers]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunAutoHeal = async () => {
    setIsHealerRunning(true);
    setActionSuccessMsg(null);
    try {
      const res: ReconciliationResult = await reconcileAndFixAllDiscrepancies();
      setActionSuccessMsg(
        `⚡ Auto-Heal Complete: Normalized ${res.fixedUsers.length} accounts (Assigned ${res.assignedIdsCount} IDs, Activated ${res.activatedPendingCount} profiles).`
      );
      await fetchAudit();
      setTimeout(() => setActionSuccessMsg(null), 8000);
    } catch (err: any) {
      alert(`Auto-heal error: ${err.message || err}`);
    } finally {
      setIsHealerRunning(false);
    }
  };

  const handleAssignIdToUser = async (userDocId: string) => {
    setFixingUserId(userDocId);
    try {
      const assignedId = await assignRevieweeId(userDocId);
      setActionSuccessMsg(`Assigned new ID "${assignedId}" successfully!`);
      await fetchAudit();
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Failed to assign ID: ${err.message || err}`);
    } finally {
      setFixingUserId(null);
    }
  };

  const handleActivateProfile = async (userDocId: string) => {
    setFixingUserId(userDocId);
    try {
      await activateRevieweeProfile(userDocId);
      setActionSuccessMsg('Reviewee profile activated and verified successfully!');
      await fetchAudit();
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Failed to activate profile: ${err.message || err}`);
    } finally {
      setFixingUserId(null);
    }
  };

  const handleExportCsv = () => {
    if (!report) return;
    const headers = [
      'Student ID',
      'Reviewee Name',
      'Email',
      'Account Status',
      'Score Count',
      'Recent Score Date',
      'Detected Issues',
      'Recommended Action',
    ];

    const rows = report.revieweeAuditList.map(r => [
      `"${r.idNumber}"`,
      `"${r.name}"`,
      `"${r.email}"`,
      `"${r.accountStatus}"`,
      r.scoreCount,
      `"${r.recentScoreDate || 'N/A'}"`,
      `"${r.issues.join('; ')}"`,
      `"${r.recommendedAction}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Reviewee_Score_Audit_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    window.print();
  };

  // Filtered rows for current tab
  const displayedItems = useMemo(() => {
    if (!report) return [];
    let items: AuditRevieweeItem[] = [];

    switch (activeSubTab) {
      case 'missing_id':
        items = report.missingIdList;
        break;
      case 'pending':
        items = report.pendingProfileList;
        break;
      case 'unscored':
        items = report.unscoredList;
        break;
      case 'all':
        items = report.revieweeAuditList;
        break;
      case 'issues':
      default:
        items = report.revieweeAuditList.filter(i => i.issues.length > 0);
        break;
    }

    if (!searchQuery.trim()) return items;

    const q = searchQuery.toLowerCase();
    return items.filter(
      i =>
        i.name.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        i.idNumber.toLowerCase().includes(q) ||
        i.issues.some(issue => issue.toLowerCase().includes(q))
    );
  }, [report, activeSubTab, searchQuery]);

  const totalIssuesCount = (report?.missingIdList.length || 0) + (report?.pendingProfileList.length || 0) + (report?.orphanedScoresList.length || 0);

  if (loading && !report) {
    return (
      <div className="bg-white rounded-3xl p-12 border border-slate-200/80 text-center flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-teal-600" size={32} />
        <p className="text-sm font-black text-slate-700">Running Cross-Collection Registry & Score Audit...</p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className={`space-y-6 ${isEmbedded ? '' : 'p-4 sm:p-6'}`}>
      {/* Top Banner & Action Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-700/80 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className={`p-3.5 rounded-2xl ${report.isFullySynchronized ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'} shrink-0`}>
            {report.isFullySynchronized ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Automated Reviewee vs. Score Management Audit Report
              </h2>
              <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                report.isFullySynchronized 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' 
                  : 'bg-amber-500/20 text-amber-300 border-amber-400/30 animate-pulse'
              }`}>
                {report.isFullySynchronized ? '100% In Sync' : `${totalIssuesCount} Discrepancies`}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-1">
              Real-time Firestore cross-verification between registered <strong className="text-white">users / Reviewees</strong> and <strong className="text-white">Score Management</strong> matrices.
            </p>
            <div className="text-[11px] text-slate-400 font-semibold mt-2 flex items-center gap-2">
              <span>Audited at: {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span>•</span>
              <span>Parity Score: <strong className="text-teal-300">{report.parityPercentage}%</strong></span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap justify-end">
          <button
            type="button"
            onClick={fetchAudit}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black transition-all border border-slate-700 flex items-center gap-2 cursor-pointer"
            title="Refresh live audit"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-teal-400' : ''} />
            <span>Re-Scan</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black transition-all border border-slate-700 flex items-center gap-2 cursor-pointer"
            title="Download CSV report"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span>Export CSV</span>
          </button>

          {!report.isFullySynchronized && (
            <button
              type="button"
              onClick={handleRunAutoHeal}
              disabled={isHealerRunning}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black tracking-wide transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer shrink-0"
            >
              {isHealerRunning ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Zap size={15} className="fill-white" />
              )}
              <span>1-Click Auto-Heal</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Success Toast */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl text-xs font-black flex items-center gap-3 shadow-md animate-fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Active Reviewees */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Active Reviewees</span>
            <Users size={16} className="text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{report.activeEnrolledReviewees}</div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>Verified Enrolled</span>
          </div>
        </div>

        {/* Card 2: Score Management Entries */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Scores</span>
            <Database size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{report.totalScoreManagementEntries}</div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            Across {report.uniqueRevieweesWithScores} Reviewees
          </div>
        </div>

        {/* Card 3: Missing IDs */}
        <div className={`p-4 rounded-2xl border shadow-2xs ${report.revieweesWithMissingId > 0 ? 'bg-amber-50/70 border-amber-200 text-amber-950' : 'bg-white border-slate-200/80'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Missing Student IDs</span>
            <AlertTriangle size={16} className={report.revieweesWithMissingId > 0 ? 'text-amber-600' : 'text-slate-400'} />
          </div>
          <div className={`text-2xl font-black ${report.revieweesWithMissingId > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {report.revieweesWithMissingId}
          </div>
          <div className="text-[11px] font-semibold mt-1">
            {report.revieweesWithMissingId > 0 ? 'Needs sequence ID' : 'All IDs assigned'}
          </div>
        </div>

        {/* Card 4: Pending Profiles */}
        <div className={`p-4 rounded-2xl border shadow-2xs ${report.pendingReviewees > 0 ? 'bg-amber-50/70 border-amber-200 text-amber-950' : 'bg-white border-slate-200/80'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Pending Enrollees</span>
            <UserX size={16} className={report.pendingReviewees > 0 ? 'text-amber-600' : 'text-slate-400'} />
          </div>
          <div className={`text-2xl font-black ${report.pendingReviewees > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {report.pendingReviewees}
          </div>
          <div className="text-[11px] font-semibold mt-1">
            {report.pendingReviewees > 0 ? 'Unverified / Incomplete' : 'No pending enrollees'}
          </div>
        </div>

        {/* Card 5: Parity Metric */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Registry Parity</span>
            <Sparkles size={16} className="text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{report.parityPercentage}%</div>
          <div className={`text-[11px] font-semibold mt-1 ${report.isFullySynchronized ? 'text-emerald-600' : 'text-amber-600'}`}>
            {report.isFullySynchronized ? 'Synchronized' : 'Action Required'}
          </div>
        </div>
      </div>

      {/* Main Audit Data Table Section */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
        {/* Table Sub-Tabs & Filter Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('issues')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'issues'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle size={13} className={activeSubTab === 'issues' ? 'text-amber-400' : 'text-slate-400'} />
              <span>Issues & Discrepancies</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${activeSubTab === 'issues' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {report.revieweeAuditList.filter(i => i.issues.length > 0).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('missing_id')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'missing_id'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Missing IDs</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${activeSubTab === 'missing_id' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {report.missingIdList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('pending')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'pending'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Pending Profiles</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${activeSubTab === 'pending' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {report.pendingProfileList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('orphaned')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'orphaned'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Orphaned Scores</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${activeSubTab === 'orphaned' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {report.orphanedScoresList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('unscored')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'unscored'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Unscored (0)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${activeSubTab === 'unscored' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {report.unscoredList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('all')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeSubTab === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>All Registry ({report.totalUniqueReviewees})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search audit records..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
          </div>
        </div>

        {/* Content Table */}
        {activeSubTab === 'orphaned' ? (
          /* Orphaned Scores Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Subject & Area</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Score Recorded</th>
                  <th className="py-3.5 px-4">Exam Date</th>
                  <th className="py-3.5 px-4">Identifier / Reference</th>
                  <th className="py-3.5 px-4">Diagnostic Cause</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.orphanedScoresList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                      <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                      <span>Zero orphaned scores detected. All score entries are properly linked to registered reviewees!</span>
                    </td>
                  </tr>
                ) : (
                  report.orphanedScoresList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">{item.area}</td>
                      <td className="py-3 px-4 font-medium text-slate-600">{item.category}</td>
                      <td className="py-3 px-4 font-bold text-teal-700">{item.score} pts</td>
                      <td className="py-3 px-4 text-slate-500">{item.date}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700">{item.studentIdOrName}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {item.reason}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Standard Reviewee Audit Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Reviewee Identity</th>
                  <th className="py-3.5 px-4">Student ID</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Score Matrix Entries</th>
                  <th className="py-3.5 px-4">Diagnostic Issues</th>
                  <th className="py-3.5 px-4 text-right">Quick Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                      <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                      <span>No matching reviewees in this category. Everything is 100% in sync!</span>
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item) => {
                    const isFixing = fixingUserId === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Name & Email */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar altText={item.name} size={32} />
                            <div>
                              <div className="font-black text-slate-900 leading-snug">{item.name}</div>
                              <div className="text-[11px] text-slate-400 font-medium">{item.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* ID Number */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg border ${
                              item.hasValidId 
                                ? 'bg-slate-100 text-slate-800 border-slate-200' 
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {item.idNumber}
                            </span>
                            {item.hasValidId && (
                              <button
                                type="button"
                                onClick={() => handleCopy(item.idNumber)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                                title="Copy ID"
                              >
                                {copiedId === item.idNumber ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            item.accountStatus === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.accountStatus === 'dropped'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              item.accountStatus === 'active' ? 'bg-emerald-500' : item.accountStatus === 'dropped' ? 'bg-rose-500' : 'bg-amber-500'
                            }`} />
                            <span>{item.accountStatus.replace('_', ' ')}</span>
                          </span>
                        </td>

                        {/* Score Count */}
                        <td className="py-3.5 px-4">
                          <div className="font-black text-slate-800 flex items-center gap-1.5">
                            <span className={`text-xs ${item.scoreCount > 0 ? 'text-teal-700 font-bold' : 'text-slate-400'}`}>
                              {item.scoreCount} {item.scoreCount === 1 ? 'Score' : 'Scores'}
                            </span>
                          </div>
                          {item.scoreCount > 0 && (
                            <div className="text-[10px] text-slate-400 font-medium">
                              Latest: {item.recentScoreDate}
                            </div>
                          )}
                        </td>

                        {/* Diagnostic Issues */}
                        <td className="py-3.5 px-4">
                          {item.issues.length === 0 ? (
                            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 size={13} />
                              <span>No Issues Detected</span>
                            </span>
                          ) : (
                            <div className="space-y-1">
                              {item.issues.map((issue, i) => (
                                <div key={i} className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                  <span>{issue}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Quick Resolution Actions */}
                        <td className="py-3.5 px-4 text-right">
                          {item.canQuickFix && (
                            <div className="flex items-center justify-end gap-1.5">
                              {item.quickFixType === 'assign_id' && (
                                <button
                                  type="button"
                                  onClick={() => handleAssignIdToUser(item.id)}
                                  disabled={isFixing}
                                  className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-black transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                >
                                  {isFixing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                                  <span>Assign ID</span>
                                </button>
                              )}

                              {item.quickFixType === 'activate_profile' && (
                                <button
                                  type="button"
                                  onClick={() => handleActivateProfile(item.id)}
                                  disabled={isFixing}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-black transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                >
                                  {isFixing ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
                                  <span>Activate</span>
                                </button>
                              )}
                            </div>
                          )}

                          {!item.canQuickFix && item.issues.length === 0 && (
                            <span className="text-slate-400 font-bold text-[11px] italic">Fully Synced</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Summary */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-semibold gap-2">
          <div>
            Showing <strong className="text-slate-800">{displayedItems.length}</strong> record(s) in current audit filter view.
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-600 font-bold">
              <CheckCircle2 size={13} /> {report.activeEnrolledReviewees} Active Reviewees Verified
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
