import React, { useState, useMemo } from 'react';
import { Users, Search, Shield, UserCheck, Mail, Building2, MapPin, CheckCircle2, Filter, Wrench, Trash2, Download, FileText, Loader2, X, ChevronDown, UserX, Calendar } from 'lucide-react';
import { getUserRole } from '../utils/roleUtils';
import { normalizeNameForComparison } from '../utils/nameNormalization';
import { resolveCanonicalUserIdentity, isValidUserRecord, formatMiddleName, compareUsersAlphabetically, formatFormalName, deduplicateUsersByIdNumber, getUserAccountStatus } from '../services/userIdentityResolver';
import { SimpleTable } from './DashboardKit';
import { RepairEmailModal } from './RepairEmailModal';
import { UserAvatar } from './UserAvatar';
import { downloadRegisteredUsersCsv } from '../utils/exportUsersCsv';
import { downloadRegisteredUsersPdf, ExportUsersPdfOptions } from '../utils/exportUsersPdf';

export function formatUserCreationDate(user: any): string | null {
  if (!user) return null;
  const rawDate =
    user.createdAt ||
    user.created_at ||
    user.registrationDate ||
    user.registeredAt ||
    user.timestamp ||
    user.creationTime ||
    user.metadata?.creationTime;
  if (!rawDate) return null;

  try {
    if (typeof rawDate === 'object' && typeof rawDate.toDate === 'function') {
      const d = rawDate.toDate();
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (typeof rawDate === 'object' && typeof rawDate.seconds === 'number') {
      const d = new Date(rawDate.seconds * 1000);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch (e) {
    return null;
  }
  return null;
}

interface AllUsersDirectoryProps {
  users: any[];
  loading: boolean;
  onEditUser: (user: any) => void;
  onDeleteUser?: (user: any) => void;
  currentUser?: any;
  onDownloadCsv?: () => void;
  isExportingCsv?: boolean;
  initialRoleFilter?: string;
}

export const AllUsersDirectory: React.FC<AllUsersDirectoryProps> = ({ 
  users, 
  loading, 
  onEditUser, 
  onDeleteUser, 
  currentUser, 
  onDownloadCsv,
  isExportingCsv = false,
  initialRoleFilter = 'all',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(initialRoleFilter);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'dropped' | 'pending'>('all');
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [internalExportingCsv, setInternalExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const loggedInRole = getUserRole(currentUser);
  const isStaffLoggedIn = loggedInRole === 'Staff';
  const isAdminLoggedIn = loggedInRole === 'Admin';

  const isDownloadingCsv = isExportingCsv || internalExportingCsv;

  const uniqueUsers = useMemo(() => {
    return deduplicateUsersByIdNumber(users);
  }, [users]);

  // Compute counts for roles and status
  const counts = useMemo(() => {
    const valid = uniqueUsers.filter((u) => {
      const status = getUserAccountStatus(u);
      return status !== 'merged' && status !== 'deleted';
    });

    let all = 0;
    let admin = 0;
    let staff = 0;
    let reviewee = 0;
    let active = 0;
    let dropped = 0;
    let pending = 0;

    valid.forEach((u) => {
      const status = getUserAccountStatus(u);
      if (status === 'active' && isValidUserRecord(u)) {
        active++;
        all++;
      } else if (status === 'dropped') {
        dropped++;
        all++;
      } else if (status === 'pending_profile') {
        pending++;
      }

      const r = getUserRole(u).toLowerCase();
      if (r === 'admin') admin++;
      else if (r === 'staff') staff++;
      else reviewee++;
    });

    return { all, admin, staff, reviewee, active, dropped, pending };
  }, [uniqueUsers]);

  const filteredUsers = useMemo(() => {
    const list = uniqueUsers.filter((u) => {
      const status = getUserAccountStatus(u);
      if (status === 'merged' || status === 'deleted') {
        return false;
      }

      if (statusFilter === 'active') {
        if (status !== 'active' || !isValidUserRecord(u)) {
          return false;
        }
      } else if (statusFilter === 'dropped') {
        if (status !== 'dropped') {
          return false;
        }
      } else if (statusFilter === 'pending') {
        if (status !== 'pending_profile') {
          return false;
        }
      } else if (statusFilter === 'all') {
        if (status !== 'active' && status !== 'dropped') {
          return false;
        }
        if (status === 'active' && !isValidUserRecord(u)) {
          return false;
        }
      }

      const role = getUserRole(u);
      if (roleFilter !== 'all' && role.toLowerCase() !== roleFilter.toLowerCase()) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const canonical = resolveCanonicalUserIdentity(u);

      const matchesName = canonical.fullName.toLowerCase().includes(q) || canonical.firstName.toLowerCase().includes(q) || canonical.lastName.toLowerCase().includes(q);
      const email = canonical.email.toLowerCase();
      const seqId = canonical.idNumber.toLowerCase();
      const school = canonical.school.toLowerCase();
      return matchesName || email.includes(q) || seqId.includes(q) || school.includes(q);
    });

    return [...list].sort(compareUsersAlphabetically);
  }, [uniqueUsers, searchQuery, roleFilter, statusFilter]);

  const handleDownloadCsvClick = async () => {
    if (onDownloadCsv) {
      onDownloadCsv();
      return;
    }
    setInternalExportingCsv(true);
    try {
      const res = await downloadRegisteredUsersCsv(users);
      if (!res.success) {
        alert(res.error || 'Failed to download users CSV.');
      }
    } catch (err: any) {
      alert(`Error downloading CSV: ${err?.message || err}`);
    } finally {
      setInternalExportingCsv(false);
    }
  };

  const handleDownloadPdf = async (exportStatus: 'all' | 'active' | 'dropped' | 'pending') => {
    setIsExportingPdf(true);
    try {
      const res = await downloadRegisteredUsersPdf(uniqueUsers, {
        statusFilter: exportStatus,
        roleFilter: roleFilter,
      });
      if (!res.success) {
        alert(res.error || 'Failed to generate PDF.');
      } else {
        setIsPdfModalOpen(false);
      }
    } catch (err: any) {
      alert(`Error exporting PDF: ${err?.message || err}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const rows = filteredUsers.map((u) => {
    const role = getUserRole(u);
    const canonical = resolveCanonicalUserIdentity(u);
    const name = formatFormalName(canonical);
    const email = canonical.email || 'No email';
    const seqId = canonical.idNumber || u.doc_id || '—';
    const school = canonical.school || '—';
    const accStatus = getUserAccountStatus(u);
    const isDropped = accStatus === 'dropped';
    const isPending = accStatus === 'pending_profile';
    const creationDate = formatUserCreationDate(u);
    let status = 'Active';
    if (isDropped) status = 'Dropped';
    else if (isPending) status = 'Pending Profile';

    let roleBadgeColor = 'bg-teal-50 text-teal-700 border-teal-200';
    if (role === 'Admin') roleBadgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
    else if (role === 'Staff') roleBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';

    return {
      originalUser: u,
      id: u.uid || u.doc_id || seqId,
      name,
      email,
      seqId,
      school,
      role,
      status,
      isDropped,
      isPending,
      creationDate,
      roleBadgeColor,
    };
  });

  const rolePills = [
    { key: 'all', label: 'ALL', count: counts.all },
    { key: 'admin', label: 'ADMIN', count: counts.admin },
    { key: 'staff', label: 'STAFF', count: counts.staff },
    { key: 'reviewee', label: 'REVIEWEE', count: counts.reviewee },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      {/* Top Directory Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
        {/* Title & Description */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users className="text-teal-600" size={24} /> All System Users Directory
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Viewing all registered accounts across Admin, Staff, and Reviewee roles ({counts.all} total unique users &bull; 1 user per ID number).
          </p>
        </div>

        {/* Top Search Bar */}
        <div className="relative w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Role Pills Row with Dynamic Numbers */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-slate-100/90 p-1.5 rounded-2xl">
          {rolePills.map((pill) => {
            const isActive = roleFilter === pill.key;
            return (
              <button
                key={pill.key}
                onClick={() => setRoleFilter(pill.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    isActive ? 'bg-slate-100 text-slate-900' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Filter (All, Active, Dropped) & Action Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            <span className="text-[10px] font-black uppercase text-slate-400 px-2 py-1 hidden xs:inline">
              Status:
            </span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'active'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-teal-700 hover:bg-teal-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Active ({counts.active})
            </button>
            <button
              onClick={() => setStatusFilter('dropped')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'dropped'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
              Dropped ({counts.dropped})
            </button>
            {counts.pending > 0 && (
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                Pending Profile ({counts.pending})
              </button>
            )}
          </div>

          {/* Action Buttons: Repair Links + Download PDF + Download CSV */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {isAdminLoggedIn && (
              <button
                onClick={() => setIsRepairModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Wrench size={14} className="text-slate-500" />
                <span>Repair Email Links</span>
              </button>
            )}

            {/* Download PDF Button with Modal Trigger */}
            <button
              onClick={() => setIsPdfModalOpen(true)}
              disabled={isExportingPdf}
              className="px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              title="Download Master User Directory as a high-quality PDF report"
            >
              {isExportingPdf ? (
                <Loader2 size={14} className="animate-spin text-rose-600" />
              ) : (
                <FileText size={14} className="text-rose-600" />
              )}
              <span>Download PDF</span>
            </button>

            {/* Download CSV Button */}
            <button
              onClick={handleDownloadCsvClick}
              disabled={isDownloadingCsv}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white border border-teal-500 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              title="Download all registered users as a CSV spreadsheet"
            >
              {isDownloadingCsv ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span>Download CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Directory Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-3 sm:p-5 shadow-sm overflow-hidden">
        <SimpleTable
          bordered
          compact
          loading={loading}
          emptyLabel="No users found matching your search or filter."
          rows={rows}
          columns={[
            {
              key: 'role',
              header: 'Role',
              width: '85px',
              align: 'center',
              render: (r) => (
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${r.roleBadgeColor}`}>
                  {r.role}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              width: '65px',
              align: 'center',
              render: (r) => (
                <div
                  className="flex items-center justify-center"
                  title={`Status: ${r.status}${r.isPending && r.creationDate ? ` • Account Created: ${r.creationDate}` : ''}`}
                >
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full shadow-xs transition-transform hover:scale-125 ${
                      r.isDropped
                        ? 'bg-rose-500 ring-2 ring-rose-200'
                        : r.isPending
                        ? 'bg-amber-500 ring-2 ring-amber-200 animate-pulse'
                        : 'bg-emerald-500 ring-2 ring-emerald-200'
                    }`}
                  />
                </div>
              ),
            },
            {
              key: 'seqId',
              header: 'ID Number',
              width: '105px',
              headerClassName: 'whitespace-nowrap',
              className: 'whitespace-nowrap',
              render: (r) => (
                <span className="font-mono text-[11px] font-bold text-slate-700 whitespace-nowrap block">
                  {r.seqId}
                </span>
              ),
            },
            {
              key: 'name',
              header: 'Full Name',
              headerClassName: 'whitespace-nowrap',
              className: 'whitespace-nowrap',
              render: (r) => (
                <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap min-w-0 py-0.5">
                  <UserAvatar
                    photoURL={r.originalUser.photoURL || r.originalUser.photo_url}
                    altText={r.name}
                    size={24}
                    className="rounded-full shrink-0"
                  />
                  <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap min-w-0">
                    <span
                      className={`font-bold text-xs leading-none whitespace-nowrap transition-colors ${
                        r.isDropped ? 'text-slate-400 line-through decoration-rose-400' : 'text-slate-900'
                      }`}
                    >
                      {r.name}
                    </span>
                    {r.isDropped && (
                      <span className="text-[8px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded leading-none shrink-0 whitespace-nowrap">
                        Dropped
                      </span>
                    )}
                    {r.isPending && (
                      <span
                        className="text-[8px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded leading-none shrink-0 whitespace-nowrap inline-flex items-center gap-1 shadow-2xs"
                        title={r.creationDate ? `Pending profile • Account created on ${r.creationDate}` : 'Pending Profile'}
                      >
                        <Calendar size={9} className="text-amber-600 shrink-0" />
                        <span>Pending {r.creationDate ? `(${r.creationDate})` : ''}</span>
                      </span>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'email',
              header: 'Email Address',
              render: (r) => (
                <div
                  className="flex items-center gap-1.5 min-w-0 text-slate-700 group py-0.5"
                  title={r.email}
                >
                  <div className="w-5 h-5 rounded bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-200/60">
                    <Mail size={11} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 truncate select-all">
                    {r.email}
                  </span>
                </div>
              ),
            },
            {
              key: 'school',
              header: 'School / University',
              render: (r) => (
                <div
                  className="flex items-center gap-1.5 min-w-0 text-slate-600 py-0.5"
                  title={r.school}
                >
                  <div className="w-5 h-5 rounded bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200/80">
                    <Building2 size={11} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 truncate">
                    {r.school}
                  </span>
                </div>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              width: '100px',
              align: 'center',
              render: (r) => {
                const canEdit = !isStaffLoggedIn || r.role === 'Reviewee';
                if (!canEdit) {
                  return (
                    <span
                      title="Staff members can only edit Reviewee accounts"
                      className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/80"
                    >
                      No Access
                    </span>
                  );
                }
                return (
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEditUser(r.originalUser)}
                      className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer border border-slate-200"
                    >
                      Edit
                    </button>
                    {isAdminLoggedIn && onDeleteUser && (
                      <button
                        type="button"
                        onClick={() => onDeleteUser(r.originalUser)}
                        className="p-1 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer border border-rose-200 flex items-center justify-center font-extrabold text-xs"
                        title={r.originalUser.uid === currentUser?.uid ? "You cannot delete your own active admin account" : `Delete ${r.name}`}
                        aria-label={`Delete ${r.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      {/* PDF Export Selection Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Export PDF Directory</h3>
                  <p className="text-xs text-slate-500">Select status options for the generated document</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 my-5">
              <button
                type="button"
                disabled={isExportingPdf}
                onClick={() => handleDownloadPdf('all')}
                className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-left transition-all cursor-pointer group flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-extrabold text-slate-900 group-hover:text-teal-700">
                    All Users (Include Active & Dropped)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Exports complete directory of {counts.all} users with Dropped status marked
                  </p>
                </div>
                <span className="text-xs font-black text-slate-400 group-hover:text-teal-600">
                  {counts.all}
                </span>
              </button>

              <button
                type="button"
                disabled={isExportingPdf}
                onClick={() => handleDownloadPdf('active')}
                className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all cursor-pointer group flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-700">
                    Active Users Only (Exclude Dropped)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Exports {counts.active} officially active reviewees, staff, and administrators
                  </p>
                </div>
                <span className="text-xs font-black text-emerald-600">
                  {counts.active}
                </span>
              </button>

              <button
                type="button"
                disabled={isExportingPdf}
                onClick={() => handleDownloadPdf('dropped')}
                className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50/40 text-left transition-all cursor-pointer group flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-extrabold text-slate-900 group-hover:text-rose-700">
                    Dropped Users Only
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Exports {counts.dropped} dropped or withdrawn reviewee records
                  </p>
                </div>
                <span className="text-xs font-black text-rose-600">
                  {counts.dropped}
                </span>
              </button>

              {counts.pending > 0 && (
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() => handleDownloadPdf('pending')}
                  className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 text-left transition-all cursor-pointer group flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-extrabold text-slate-900 group-hover:text-amber-700">
                      Pending Profile Users Only
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Exports {counts.pending} users with incomplete profile setup or unassigned ID
                    </p>
                  </div>
                  <span className="text-xs font-black text-amber-600">
                    {counts.pending}
                  </span>
                </button>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isExportingPdf}
                onClick={() => setIsPdfModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repair Email Modal */}
      <RepairEmailModal isOpen={isRepairModalOpen} onClose={() => setIsRepairModalOpen(false)} />
    </div>
  );
};
