import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Search,
  Filter,
  Download,
  RefreshCw,
  User,
  Shield,
  Clock,
  ArrowRight,
  AlertCircle,
  FileText,
  Trash2,
  GitMerge,
  UserCheck,
  Calendar,
  Sparkles,
  ChevronDown,
  Layers,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { 
  ActivityLogEntry, 
  ActivityActionType, 
  subscribeToActivityLogs 
} from '../services/activityLogService';
import { UserAvatar } from './UserAvatar';

interface ActivityLogTabProps {
  currentUser: any;
  onEditUser?: (user: any) => void;
}

export const ActivityLogTab: React.FC<ActivityLogTabProps> = ({
  currentUser,
  onEditUser,
}) => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [selectedEditorRole, setSelectedEditorRole] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToActivityLogs((updatedLogs) => {
      setLogs(updatedLogs);
      setLoading(false);
    }, 200);

    return () => unsubscribe();
  }, []);

  // Filtered logs calculation
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    return logs.filter((log) => {
      // 1. Action Type Filter
      if (selectedActionType !== 'all') {
        if (selectedActionType === 'id_modification' && log.actionType !== 'id_modification') return false;
        if (selectedActionType === 'profile_update' && log.actionType !== 'profile_update') return false;
        if (selectedActionType === 'status_role' && log.actionType !== 'status_change' && log.actionType !== 'role_change') return false;
        if (selectedActionType === 'deletions' && log.actionType !== 'user_deleted' && log.actionType !== 'user_dropped') return false;
        if (selectedActionType === 'merges' && log.actionType !== 'account_merged') return false;
      }

      // 2. Editor Role Filter
      if (selectedEditorRole !== 'all') {
        const editorRoleLower = (log.editor?.role || '').toLowerCase();
        if (selectedEditorRole === 'admin' && editorRoleLower !== 'admin') return false;
        if (selectedEditorRole === 'staff' && editorRoleLower !== 'staff') return false;
        if (selectedEditorRole === 'reviewee' && editorRoleLower !== 'reviewee') return false;
      }

      // 3. Time Range Filter
      if (selectedTimeRange !== 'all') {
        const entryTime = log.createdAtMillis || new Date(log.timestamp).getTime();
        const diffMs = now - entryTime;
        if (selectedTimeRange === 'today' && diffMs > ONE_DAY_MS) return false;
        if (selectedTimeRange === '7days' && diffMs > 7 * ONE_DAY_MS) return false;
        if (selectedTimeRange === '30days' && diffMs > 30 * ONE_DAY_MS) return false;
      }

      // 4. Text Search
      if (q) {
        const editorMatch = 
          (log.editor?.name || '').toLowerCase().includes(q) ||
          (log.editor?.email || '').toLowerCase().includes(q) ||
          (log.editor?.role || '').toLowerCase().includes(q);

        const targetMatch = 
          (log.targetUser?.name || '').toLowerCase().includes(q) ||
          (log.targetUser?.email || '').toLowerCase().includes(q) ||
          (log.targetUser?.idNumber || '').toLowerCase().includes(q);

        const changesMatch = log.changes?.some(c => 
          c.label.toLowerCase().includes(q) ||
          (c.oldValue || '').toLowerCase().includes(q) ||
          (c.newValue || '').toLowerCase().includes(q)
        );

        const actionMatch = (log.actionTitle || '').toLowerCase().includes(q);

        return editorMatch || targetMatch || changesMatch || actionMatch;
      }

      return true;
    });
  }, [logs, searchQuery, selectedActionType, selectedEditorRole, selectedTimeRange]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const idChanges = logs.filter(l => l.actionType === 'id_modification').length;
    const profileUpdates = logs.filter(l => l.actionType === 'profile_update').length;
    const statusAndRole = logs.filter(l => l.actionType === 'status_change' || l.actionType === 'role_change').length;
    const distinctEditors = new Set(logs.map(l => l.editor?.name).filter(Boolean)).size;

    return { total, idChanges, profileUpdates, statusAndRole, distinctEditors };
  }, [logs]);

  // Export CSV
  const handleExportCsv = () => {
    setIsExporting(true);
    try {
      if (filteredLogs.length === 0) {
        alert('No activity logs to export.');
        return;
      }

      const headers = ['Timestamp', 'Action', 'Editor Name', 'Editor Email', 'Editor Role', 'Target Reviewee', 'Target ID', 'Target Email', 'Modifications'];
      const rows = filteredLogs.map((log) => {
        const changesText = log.changes?.map(c => `${c.label}: "${c.oldValue || '—'}" -> "${c.newValue || '—'}"`).join(' | ') || (log.details || 'No field diff');
        return [
          `"${new Date(log.timestamp).toLocaleString()}"`,
          `"${log.actionTitle || log.actionType}"`,
          `"${log.editor?.name || 'System'}"`,
          `"${log.editor?.email || '—'}"`,
          `"${log.editor?.role || 'Admin'}"`,
          `"${log.targetUser?.name || 'Reviewee'}"`,
          `"${log.targetUser?.idNumber || '—'}"`,
          `"${log.targetUser?.email || '—'}"`,
          `"${changesText.replace(/"/g, '""')}"`
        ];
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `samaritan_activity_log_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export activity logs:', err);
      alert('Failed to export activity logs.');
    } finally {
      setIsExporting(false);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const now = Date.now();
      const past = new Date(isoString).getTime();
      const diffMs = now - past;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHr / 24);

      if (diffSec < 45) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const renderActionBadge = (actionType: ActivityActionType) => {
    switch (actionType) {
      case 'id_modification':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
            <KeyRound size={12} className="text-amber-600" /> ID Modified
          </span>
        );
      case 'role_change':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/80">
            <Shield size={12} className="text-purple-600" /> Role Changed
          </span>
        );
      case 'status_change':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
            <UserCheck size={12} className="text-blue-600" /> Status Changed
          </span>
        );
      case 'user_deleted':
      case 'user_dropped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
            <Trash2 size={12} className="text-rose-600" /> Account Deleted
          </span>
        );
      case 'account_merged':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
            <GitMerge size={12} className="text-indigo-600" /> Account Merged
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200/80">
            <Activity size={12} className="text-teal-600" /> Profile Updated
          </span>
        );
    }
  };

  const renderRolePill = (role: string) => {
    const r = (role || 'Admin').toUpperCase();
    if (r === 'ADMIN') {
      return <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-purple-100 text-purple-800 border border-purple-200">Admin</span>;
    }
    if (r === 'STAFF') {
      return <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-blue-100 text-blue-800 border border-blue-200">Staff</span>;
    }
    return <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-slate-100 text-slate-700 border border-slate-200">Reviewee</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats Header */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 text-white shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Activity size={160} />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  <Activity size={13} className="animate-pulse" /> Live Audit Trail
                </span>
                <span className="text-xs text-slate-400 font-mono">Real-time Persistence</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-2 text-white">
                Reviewee Profile Activity & Audit Logs
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1">
                Track all modifications made to reviewee sequence IDs, personal credentials, schools, branches, and statuses. Accurately highlights who (Staff/Admin) changed which field and when.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                onClick={handleExportCsv}
                disabled={isExporting || filteredLogs.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={14} />
                <span>{isExporting ? 'Exporting...' : 'Export Log (CSV)'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Recorded Events</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-1">{stats.total}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
              <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                <KeyRound size={12} /> ID Modifications
              </p>
              <p className="text-xl sm:text-2xl font-black text-amber-300 mt-1">{stats.idChanges}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
              <p className="text-[11px] font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1">
                <UserCheck size={12} /> Status & Role Changes
              </p>
              <p className="text-xl sm:text-2xl font-black text-teal-300 mt-1">{stats.statusAndRole}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Editors</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-1">{stats.distinctEditors}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Editor, Reviewee Name, ID Number (e.g. SRC 192/26), or Field..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Time Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedTimeRange('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedTimeRange === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All Time
            </button>
            <button
              onClick={() => setSelectedTimeRange('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedTimeRange === 'today' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedTimeRange('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedTimeRange === '7days' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Past 7 Days
            </button>
          </div>
        </div>

        {/* Action Type & Role Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
            <Filter size={12} /> Filter:
          </span>

          <button
            onClick={() => setSelectedActionType('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${selectedActionType === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All Actions ({logs.length})
          </button>
          <button
            onClick={() => setSelectedActionType('id_modification')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${selectedActionType === 'id_modification' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'}`}
          >
            ID Modified ({stats.idChanges})
          </button>
          <button
            onClick={() => setSelectedActionType('profile_update')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${selectedActionType === 'profile_update' ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'}`}
          >
            Profile Edits ({stats.profileUpdates})
          </button>
          <button
            onClick={() => setSelectedActionType('status_role')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${selectedActionType === 'status_role' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'}`}
          >
            Status & Role ({stats.statusAndRole})
          </button>
          <button
            onClick={() => setSelectedActionType('deletions')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${selectedActionType === 'deletions' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'}`}
          >
            Deletions / Drops
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Role selector */}
          <select
            value={selectedEditorRole}
            onChange={(e) => setSelectedEditorRole(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="all">All Editors (Admin & Staff)</option>
            <option value="admin">Admin Editors Only</option>
            <option value="staff">Staff Editors Only</option>
            <option value="reviewee">Self / Reviewee Only</option>
          </select>
        </div>
      </div>

      {/* Activity Logs Stream */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <RefreshCw className="animate-spin text-teal-600 mx-auto mb-3" size={28} />
            <p className="text-sm font-bold text-slate-700">Loading activity trail...</p>
            <p className="text-xs text-slate-400 mt-1">Fetching recorded profile modifications from Firestore.</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <FileText size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Activity Logs Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {searchQuery || selectedActionType !== 'all' || selectedEditorRole !== 'all'
                ? 'No activity records match your filter criteria. Try adjusting the search term or clearing the active filters.'
                : 'No modifications to reviewee profiles have been recorded yet. Any profile or sequence ID edits by Admins and Staff will appear here in real time.'}
            </p>
            {(searchQuery || selectedActionType !== 'all' || selectedEditorRole !== 'all' || selectedTimeRange !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedActionType('all');
                  setSelectedEditorRole('all');
                  setSelectedTimeRange('all');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const hasIdChange = log.changes?.some(c => c.field === 'idNumber');

            return (
              <div
                key={log.id}
                className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-sm transition hover:shadow-md ${
                  hasIdChange ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200/80'
                }`}
              >
                {/* Header row: Action Type, Editor Info, Time */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {renderActionBadge(log.actionType)}
                    <span className="text-xs font-black text-slate-900">{log.actionTitle}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-mono font-medium text-slate-400" title={new Date(log.timestamp).toLocaleString()}>
                      <Clock size={13} />
                      <span>{formatRelativeTime(log.timestamp)}</span>
                      <span className="hidden md:inline text-slate-300">• {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>
                </div>

                {/* Content: Editor & Target Details */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 my-3.5 items-start">
                  {/* Who Made The Change */}
                  <div className="md:col-span-5 flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {log.editor?.name ? log.editor.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate">{log.editor?.name || 'Unknown Editor'}</span>
                        {renderRolePill(log.editor?.role || 'Admin')}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{log.editor?.email || 'System Initiator'}</p>
                      <span className="inline-block mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modified By</span>
                    </div>
                  </div>

                  {/* Target Reviewee */}
                  <div className="md:col-span-7 flex items-start gap-3 bg-teal-50/50 p-3 rounded-xl border border-teal-100/80">
                    <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {log.targetUser?.name ? log.targetUser.name.charAt(0).toUpperCase() : 'R'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-xs font-extrabold text-slate-900 truncate">
                            {log.targetUser?.name || 'Reviewee Profile'}
                          </span>
                          {log.targetUser?.idNumber && log.targetUser.idNumber !== '—' && (
                            <span className="px-2 py-0.5 rounded font-mono font-black text-[11px] bg-teal-100 text-teal-800 border border-teal-200">
                              {log.targetUser.idNumber}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate mt-0.5">{log.targetUser?.email || '—'}</p>
                      <span className="inline-block mt-1 text-[10px] font-bold text-teal-700 uppercase tracking-wider">Target Profile</span>
                    </div>
                  </div>
                </div>

                {/* Diff Container / What Changed */}
                {log.changes && log.changes.length > 0 ? (
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Layers size={11} /> Field-Level Modifications ({log.changes.length})
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {log.changes.map((change, cIdx) => {
                        const isIdField = change.field === 'idNumber';

                        return (
                          <div
                            key={cIdx}
                            className={`p-2.5 rounded-lg border text-xs ${
                              isIdField
                                ? 'bg-amber-50 border-amber-200/90'
                                : 'bg-white border-slate-200/70'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-bold text-[11px] text-slate-700">{change.label}</span>
                              {isIdField && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-mono">
                                  ID Key
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap">
                              {/* Old Value */}
                              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 line-through max-w-[130px] truncate" title={change.oldValue || 'None'}>
                                {change.oldValue || '—'}
                              </span>

                              <ArrowRight size={12} className="text-slate-400 shrink-0" />

                              {/* New Value */}
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold max-w-[130px] truncate" title={change.newValue || 'None'}>
                                {change.newValue || '—'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : log.details ? (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-600">
                    <span className="font-bold text-slate-700">Details: </span> {log.details}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
