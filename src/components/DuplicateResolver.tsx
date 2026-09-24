import React, { useState, useMemo } from 'react';
import {
  Users2,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  UserCheck,
  ShieldAlert,
  ArrowUpDown,
  Edit3,
  RefreshCw,
  Info,
  Mail,
  Building2,
  Hash,
  ExternalLink,
} from 'lucide-react';
import {
  resolveCanonicalUserIdentity,
  formatFormalName,
  canonicalizeIdNumber,
  getUserAccountStatus,
  deduplicateUsersByIdNumber,
} from '../services/userIdentityResolver';
import { getUserRole } from '../utils/roleUtils';
import { UserAvatar } from './UserAvatar';

interface DuplicateResolverProps {
  allUsers: any[];
  onEditUser: (user: any) => void;
  currentUser?: any;
}

export const DuplicateResolver: React.FC<DuplicateResolverProps> = ({
  allUsers,
  onEditUser,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState<'active_reviewees' | 'all_reviewees' | 'all_users'>('active_reviewees');
  const [viewMode, setViewMode] = useState<'conflicts_only' | 'all_ids'>('conflicts_only');

  // Analyze records based on the chosen scope
  const analysis = useMemo(() => {
    // 1. Filter target population based on scope using canonical deduplication and robust reviewee check
    const validUsers = deduplicateUsersByIdNumber(allUsers).filter(u => {
      const status = getUserAccountStatus(u);
      return status !== 'merged' && status !== 'deleted';
    });

    const targetUsers = validUsers.filter((u) => {
      const status = getUserAccountStatus(u);
      const role = getUserRole(u).toLowerCase();
      const isReviewee = role !== 'admin' && role !== 'staff';

      if (filterScope === 'active_reviewees') {
        return isReviewee && status === 'active';
      }
      if (filterScope === 'all_reviewees') {
        return isReviewee && status !== 'deleted';
      }
      return status !== 'deleted';
    });

    // 2. Group by canonical ID number
    const idMap = new Map<string, any[]>();
    const noIdUsers: any[] = [];

    targetUsers.forEach((u) => {
      const canonical = resolveCanonicalUserIdentity(u);
      const rawId = canonical.idNumber || u.seqId || u.seq_id || u.id_number || u.srcId || '';
      const cleanId = canonicalizeIdNumber(rawId);

      const isRawUid = rawId.length >= 20 && !rawId.includes(' ') && !rawId.startsWith('SRC') && !rawId.startsWith('STF') && !rawId.startsWith('ADM');

      if (!cleanId || isRawUid || rawId === '—' || rawId === '-' || rawId.toUpperCase() === 'N/A' || rawId.toUpperCase() === 'NONE') {
        noIdUsers.push(u);
      } else {
        const existing = idMap.get(cleanId) || [];
        existing.push(u);
        idMap.set(cleanId, existing);
      }
    });

    // 3. Extract duplicate groups (groups with > 1 user)
    const duplicateGroups: Array<{ idNumber: string; users: any[] }> = [];
    const uniqueGroups: Array<{ idNumber: string; users: any[] }> = [];

    idMap.forEach((users, idNumber) => {
      if (users.length > 1) {
        duplicateGroups.push({ idNumber, users });
      } else {
        uniqueGroups.push({ idNumber, users });
      }
    });

    // Sort duplicates alphabetically by ID number
    duplicateGroups.sort((a, b) => a.idNumber.localeCompare(b.idNumber));
    uniqueGroups.sort((a, b) => a.idNumber.localeCompare(b.idNumber));

    return {
      totalTargetUsers: targetUsers.length,
      totalAssignedIds: idMap.size,
      duplicateGroups,
      totalDuplicatesCount: duplicateGroups.reduce((acc, g) => acc + g.users.length, 0),
      uniqueGroups,
      noIdUsers,
    };
  }, [allUsers, filterScope]);

  // Filter groups according to search query
  const filteredDuplicateGroups = useMemo(() => {
    if (!searchQuery.trim()) return analysis.duplicateGroups;
    const q = searchQuery.toLowerCase().trim();

    return analysis.duplicateGroups.filter((group) => {
      if (group.idNumber.toLowerCase().includes(q)) return true;
      return group.users.some((u) => {
        const canonical = resolveCanonicalUserIdentity(u);
        const name = formatFormalName(canonical).toLowerCase();
        const email = String(canonical.email || u.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    });
  }, [analysis.duplicateGroups, searchQuery]);

  const filteredAllGroups = useMemo(() => {
    const combined = [...analysis.duplicateGroups, ...analysis.uniqueGroups];
    if (!searchQuery.trim()) return combined;
    const q = searchQuery.toLowerCase().trim();

    return combined.filter((group) => {
      if (group.idNumber.toLowerCase().includes(q)) return true;
      return group.users.some((u) => {
        const canonical = resolveCanonicalUserIdentity(u);
        const name = formatFormalName(canonical).toLowerCase();
        const email = String(canonical.email || u.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    });
  }, [analysis.duplicateGroups, analysis.uniqueGroups, searchQuery]);

  const displayedGroups = viewMode === 'conflicts_only' ? filteredDuplicateGroups : filteredAllGroups;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Users2 size={16} />
              <span>Identity & Duplicate ID Inspector</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Active Reviewee ID Audit
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 max-w-2xl leading-relaxed">
              Verify that every active reviewee has an assigned, 100% unique sequence ID. Detect and resolve any duplicate ID collisions.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className={`px-4 py-3 rounded-2xl flex items-center gap-3 border shadow-sm ${
              analysis.duplicateGroups.length === 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {analysis.duplicateGroups.length === 0 ? (
                <>
                  <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider opacity-80">Audit Status</div>
                    <div className="text-sm font-black">Zero Duplicate IDs</div>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle size={24} className="text-rose-400 shrink-0 animate-bounce" />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider opacity-80">Action Required</div>
                    <div className="text-sm font-black">{analysis.duplicateGroups.length} Conflicting ID{analysis.duplicateGroups.length > 1 ? 's' : ''}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Target Reviewees</span>
            <UserCheck size={16} className="text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{analysis.totalTargetUsers}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
            {filterScope === 'active_reviewees' ? 'Active accounts only' : 'Total accounts in scope'}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Unique Assigned IDs</span>
            <Hash size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{analysis.totalAssignedIds}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
            Distinct ID keys indexed
          </div>
        </div>

        <div className={`border rounded-2xl p-4 shadow-xs ${
          analysis.duplicateGroups.length > 0
            ? 'bg-rose-50/50 border-rose-200 text-rose-900'
            : 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span>Duplicate ID Conflicts</span>
            <ShieldAlert size={16} className={analysis.duplicateGroups.length > 0 ? 'text-rose-600' : 'text-emerald-600'} />
          </div>
          <div className="text-2xl font-black">{analysis.duplicateGroups.length}</div>
          <div className="text-[11px] font-medium mt-0.5 opacity-80">
            {analysis.duplicateGroups.length > 0 ? `${analysis.totalDuplicatesCount} total users affected` : 'All assigned IDs are unique'}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Unassigned / Pending IDs</span>
            <Info size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{analysis.noIdUsers.length}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
            Pending profile completion
          </div>
        </div>
      </div>

      {/* Scope Controls & Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Scope Selector */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-bold">
            <button
              onClick={() => setFilterScope('active_reviewees')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                filterScope === 'active_reviewees'
                  ? 'bg-white text-teal-800 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Reviewees ({allUsers.filter(u => getUserRole(u) === 'Reviewee' && getUserAccountStatus(u) === 'active').length})
            </button>
            <button
              onClick={() => setFilterScope('all_reviewees')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                filterScope === 'all_reviewees'
                  ? 'bg-white text-teal-800 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Reviewees
            </button>
            <button
              onClick={() => setFilterScope('all_users')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                filterScope === 'all_users'
                  ? 'bg-white text-teal-800 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Users & Staff
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('conflicts_only')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                viewMode === 'conflicts_only'
                  ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Conflicts Only ({analysis.duplicateGroups.length})
            </button>
            <button
              onClick={() => setViewMode('all_ids')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                viewMode === 'all_ids'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Assigned IDs ({analysis.totalAssignedIds})
            </button>
          </div>
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID Number, Student Name, or Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-900"
          />
        </div>
      </div>

      {/* Audit Results Table / Cards */}
      {displayedGroups.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-200/60 shadow-xs">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 mb-1">
            {viewMode === 'conflicts_only'
              ? 'No Duplicate ID Conflicts Found'
              : 'No Records Match Your Search'}
          </h3>
          <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
            {viewMode === 'conflicts_only'
              ? `All ${analysis.totalTargetUsers} active reviewees have unique sequence ID numbers. No overlapping assignments exist in the database.`
              : 'Try clearing your search query or selecting a different scope.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedGroups.map((group) => {
            const isDuplicate = group.users.length > 1;

            return (
              <div
                key={group.idNumber}
                className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition-all ${
                  isDuplicate
                    ? 'border-rose-300 ring-2 ring-rose-100 bg-rose-50/20'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-xl font-mono text-xs font-black tracking-wider flex items-center gap-1.5 shadow-2xs ${
                      isDuplicate
                        ? 'bg-rose-600 text-white'
                        : 'bg-indigo-600 text-white'
                    }`}>
                      <Hash size={13} />
                      <span>{group.idNumber}</span>
                    </div>

                    <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                      isDuplicate
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isDuplicate
                        ? `⚠️ Conflict: ${group.users.length} Users share this ID`
                        : '✓ Unique ID'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-medium">
                    {group.users.length} assigned user{group.users.length > 1 ? 's' : ''}
                  </div>
                </div>

                {/* User Cards in this Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.users.map((u, idx) => {
                    const canonical = resolveCanonicalUserIdentity(u);
                    const name = formatFormalName(canonical);
                    const email = canonical.email || u.email || 'No email';
                    const school = canonical.school || u.school_name || u.school || '—';
                    const status = getUserAccountStatus(u);
                    const role = getUserRole(u);

                    return (
                      <div
                        key={u.uid || u.id || u.doc_id || idx}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                          isDuplicate
                            ? 'bg-white border-rose-200 shadow-xs'
                            : 'bg-slate-50/60 border-slate-200/70'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar
                                photoURL={u.photoURL || u.photo_url}
                                altText={name}
                                size={28}
                                className="rounded-full shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-extrabold text-xs text-slate-900 truncate">
                                  {name}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                  <Mail size={10} className="text-slate-400 shrink-0" />
                                  <span>{email}</span>
                                </div>
                              </div>
                            </div>

                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                              status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : status === 'dropped'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {status}
                            </span>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <div className="flex items-center gap-1 truncate max-w-[200px]" title={school}>
                              <Building2 size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">{school}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{role}</span>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                          <button
                            type="button"
                            onClick={() => onEditUser(u)}
                            className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 size={12} />
                            <span>Edit / Reassign ID</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
