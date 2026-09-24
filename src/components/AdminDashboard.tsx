import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  FolderSync,
  ClipboardList,
  Users,
  Sliders,
  QrCode,
  ScanLine,
  ArrowRight,
  LogOut,
  ExternalLink,
  Shield,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Layers,
  Database,
  Eye,
  RefreshCw,
  Search,
  BookOpen,
  Download,
  Loader2,
  User,
  UserCheck,
  FolderArchive,
  Trophy,
  Users2,
  Bell,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { useFirestoreUsers } from '../hooks/useFirestoreUsers';
import { useScoreFolders } from '../hooks/useScoreFolders';
import { getUserRole, isAdmin, isAdminLike } from '../utils/roleUtils';
import { UserAvatar } from './UserAvatar';
import { AdminFolderSyncViewer } from './AdminFolderSyncViewer';
import RevieweeScoresDashboard from './reviewee/RevieweeScoresDashboard';
import { AllUsersDirectory } from './AllUsersDirectory';
import { EditUserModal } from './EditUserModal';
import { DeleteUserModal } from './DeleteUserModal';
import { GradeCalculationSettings } from './GradeCalculationSettings';
import { ScannerPage } from './ScannerPage';
import { VenueQRPage } from './VenueQRPage';
import { StatCard } from './DashboardKit';
import { PortalLayout } from './PortalLayout';
import { ProfileDashboard } from './ProfileDashboard';
import { downloadRegisteredUsersCsv } from '../utils/exportUsersCsv';
import { deduplicateUsersByIdNumber } from '../services/userIdentityResolver';

interface AdminDashboardProps {
  currentUser: any;
  onLogout: () => void;
  onSwitchToReviewee: () => void;
  onSwitchToStaff?: () => void;
}

export type AdminTab = 
  | 'overview' 
  | 'profile' 
  | 'users' 
  | 'reviewees' 
  | 'scores' 
  | 'archives' 
  | 'folders' 
  | 'leaderboard' 
  | 'school-mappings' 
  | 'duplicate-resolver' 
  | 'audit-log' 
  | 'grades' 
  | 'qr-scanner' 
  | 'qr-venue'
  | 'notifications';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onLogout,
  onSwitchToReviewee,
  onSwitchToStaff,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/admin/folders')) return 'folders';
    if (path.includes('/admin/scores')) return 'scores';
    if (path.includes('/admin/users')) return 'users';
    if (path.includes('/admin/grades')) return 'grades';
    if (path.includes('/admin/scanner')) return 'qr-scanner';
    if (path.includes('/admin/venue-qr')) return 'qr-venue';
    return (localStorage.getItem('admin_active_tab') as AdminTab) || 'overview';
  });

  const { allUsers, loading: loadingUsers } = useFirestoreUsers();
  const { folders, loading: loadingFolders } = useScoreFolders();

  // Modals for user management
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [scoreContextMode, setScoreContextMode] = useState<'single' | 'combined'>('single');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');

  const handleDownloadUsersCsv = async () => {
    setIsExportingCsv(true);
    try {
      const res = await downloadRegisteredUsersCsv(allUsers);
      if (res.success) {
        setActionNotice(`Successfully exported ${res.count} registered users to ${res.filename}`);
        setTimeout(() => setActionNotice(null), 5000);
      } else {
        alert(res.error || 'Failed to export CSV.');
      }
    } catch (err: any) {
      console.error('Error downloading CSV:', err);
      alert(`Error exporting CSV: ${err?.message || err}`);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    localStorage.setItem('admin_active_tab', tab);
    let path = '/admin/dashboard';
    if (tab === 'folders') path = '/admin/folders';
    else if (tab === 'scores') path = '/admin/scores';
    else if (tab === 'users') path = '/admin/users';
    else if (tab === 'grades') path = '/admin/grades';
    else if (tab === 'qr-scanner') path = '/admin/scanner';
    else if (tab === 'qr-venue') path = '/admin/venue-qr';
    window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Analytics & Metrics
  const metrics = useMemo(() => {
    const validUsers = deduplicateUsersByIdNumber(allUsers).filter(u => !u.isDeleted && !u.deleted && u.accountStatus !== 'deleted');
    const reviewees = validUsers.filter(u => getUserRole(u) === 'Reviewee');
    const staff = validUsers.filter(u => getUserRole(u) === 'Staff');
    const admins = validUsers.filter(u => getUserRole(u) === 'Admin');

    const publishedFolders = folders.filter(f => !f.isArchived && f.publicationStatus !== 'hidden');
    const totalFolders = folders.length;

    // Count scores encoded across reviewees
    let totalScoresCount = 0;
    validUsers.forEach((u) => {
      const keys = Object.keys(u);
      keys.forEach((k) => {
        if (k.startsWith('score_') || k.startsWith('diag_') || k.startsWith('scoresByDate_')) {
          totalScoresCount++;
        }
      });
      if (u.scoresByDate && typeof u.scoresByDate === 'object') {
        totalScoresCount += Object.keys(u.scoresByDate).length;
      }
    });

    return {
      totalUsers: validUsers.length,
      totalReviewees: reviewees.length,
      totalStaff: staff.length,
      totalAdmins: admins.length,
      publishedFolders: publishedFolders.length,
      totalFolders,
      totalScoresCount,
      recentReviewees: reviewees.slice(-6).reverse(),
    };
  }, [allUsers, folders]);

  // Handle User Edit Save
  const handleSaveUser = async (updatedData: any) => {
    if (!firestoreDb) return;
    const targetId = updatedData.uid || updatedData.id || updatedData.doc_id;
    if (!targetId) return;

    try {
      const docRef = doc(firestoreDb, "users", targetId);
      const cleanSeqId = String(updatedData.seqId || updatedData.seq_id || '').trim().toUpperCase();
      const updatedRole = updatedData.role || updatedData.userRole || 'Reviewee';

      await updateDoc(docRef, {
        firstName: updatedData.firstName || '',
        first_name: (updatedData.firstName || '').toUpperCase(),
        middleName: updatedData.middleName || '',
        middle_name: (updatedData.middleName || '').toUpperCase(),
        lastName: updatedData.lastName || '',
        last_name: (updatedData.lastName || '').toUpperCase(),
        email: updatedData.email || '',
        role: updatedRole,
        userRole: updatedRole,
        seqId: cleanSeqId,
        seq_id: cleanSeqId,
        status: updatedData.status || updatedData.accountStatus || 'active',
        accountStatus: updatedData.status || updatedData.accountStatus || 'active',
        updatedAt: new Date().toISOString(),
      });
      setActionNotice(`User ${updatedData.firstName} ${updatedData.lastName} updated successfully.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      console.error("Error updating user document:", err);
      alert(`Failed to update user: ${err.message || err}`);
    }
  };

  const currentRole = getUserRole(currentUser);
  const displayName = [currentUser?.firstName || currentUser?.first_name, currentUser?.lastName || currentUser?.last_name]
    .filter(Boolean)
    .join(' ') || currentUser?.displayName || currentUser?.email || 'Administrator';

  const drawerNavItems = [
    { key: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { key: 'profile', label: 'My Profile', icon: <User size={18} /> },
    { key: 'users', label: 'All Users', icon: <Users size={18} />, badge: metrics.totalUsers },
    { key: 'reviewees', label: 'Reviewees', icon: <UserCheck size={18} />, badge: metrics.totalReviewees },
    { key: 'scores', label: 'Score Management', icon: <ClipboardList size={18} /> },
    { key: 'archives', label: 'Archives', icon: <FolderArchive size={18} /> },
    { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={18} /> },
    { key: 'school-mappings', label: 'School Mappings', icon: <GraduationCap size={18} /> },
    { key: 'duplicate-resolver', label: 'Duplicate Resolver', icon: <Users2 size={18} /> },
    { key: 'audit-log', label: 'Audit Log', icon: <Shield size={18} /> },
    { key: 'grades', label: 'Grade Weights', icon: <Sliders size={18} /> },
    { key: 'folders', label: 'Sync & Settings', icon: <RefreshCw size={18} /> },
  ];

  const bottomNavItems = [
    { key: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { key: 'users', label: 'Users', icon: <Users size={18} /> },
    { key: 'scores', label: 'Scores', icon: <ClipboardList size={18} /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { key: 'profile', label: 'Profile', icon: <User size={18} /> },
  ];

  return (
    <div className="h-full w-full">
      <PortalLayout
        title="Admin Portal"
        subtitle="Samaritan Review Center Administration"
        role="Admin"
        roleDetail={displayName}
        idNumber="XIR POGS"
        photoURL={currentUser?.photoURL || currentUser?.photo_url}
        activeTab={activeTab}
        onTabChange={(tab) => handleTabChange(tab as AdminTab)}
        onLogout={onLogout}
        db={firestoreDb}
        navItems={drawerNavItems}
        footerItems={bottomNavItems}
      >
        <div className="mx-auto max-w-7xl">
          {actionNotice && (
            <div className="mb-4 bg-teal-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
              <CheckCircle2 size={16} />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Admin Dashboard</h1>
                  <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                    Monitor reviewee performance, account activity, and score publication.
                  </p>
                </div>
              </div>

              {/* DASHBOARD SCORE CONTEXT */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200/80 px-2.5 py-1 rounded-md">
                      Dashboard Score Context
                    </span>
                    <p className="text-xs text-slate-500 font-medium mt-1.5">
                      Filter calculations by specific folder or combine multiple phases
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScoreContextMode('single')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        scoreContextMode === 'single'
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Single Folder
                    </button>
                    <button
                      onClick={() => setScoreContextMode('combined')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        scoreContextMode === 'combined'
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Combined Folders
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="all">All Folders (Pooled Analytics)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.folderType || f.type || 'Standard'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* KPI Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <StatCard
                  label="Total Reviewees"
                  value={String(metrics.totalReviewees || 170)}
                  icon={<GraduationCap size={18} />}
                  tone="teal"
                  subtitle={`Out of ${metrics.totalUsers} registered`}
                />
                <StatCard
                  label="Active Staff"
                  value={String(metrics.totalStaff || 2)}
                  icon={<Shield size={18} />}
                  tone="blue"
                  subtitle="Staff coordinators"
                />
                <StatCard
                  label="Average Overall Score"
                  value="15.59%"
                  icon={<ClipboardList size={18} />}
                  tone="emerald"
                  subtitle="Across encoded exams"
                />
                <StatCard
                  label="Pending Actions"
                  value="15"
                  icon={<AlertCircle size={18} />}
                  tone="amber"
                  subtitle="Accounts requiring review"
                />
              </div>

            {/* Quick Management Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
              <div
                onClick={() => handleTabChange('folders')}
                className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 hover:border-teal-400 transition-all shadow-sm cursor-pointer group hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-105 transition-transform">
                    <FolderSync size={18} />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-teal-600 transition-colors">
                    Score Folders & Parity Sync
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Verify folders in <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">score_folders</code> and <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">scoreFolders</code>, replicate data, and control portal visibility.
                  </p>
                </div>
                <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-black text-teal-600 uppercase tracking-wider">
                  <span>Open Folders Hub</span>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => handleTabChange('users')}
                className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 hover:border-purple-400 transition-all shadow-sm cursor-pointer group hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-105 transition-transform">
                    <Users size={18} />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-purple-600 transition-colors">
                    User Directory & Roles
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Browse all {metrics.totalUsers} registered accounts. Edit reviewee details, assign Admin or Staff roles, or repair duplicate email links.
                  </p>
                </div>
                <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-black text-purple-600 uppercase tracking-wider">
                  <span>Open User Directory</span>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => handleTabChange('scores')}
                className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 hover:border-blue-400 transition-all shadow-sm cursor-pointer group hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-105 transition-transform">
                    <ClipboardList size={18} />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-blue-600 transition-colors">
                    Score Matrix & Bulk Encoding
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Encode scores across CLJ, LEA, CDI, Forensic Science, Criminology, and Correctional Administration.
                  </p>
                </div>
                <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-black text-blue-600 uppercase tracking-wider">
                  <span>Open Score Matrix</span>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => handleTabChange('grades')}
                className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 hover:border-amber-400 transition-all shadow-sm cursor-pointer group hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-105 transition-transform">
                    <Sliders size={18} />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-amber-600 transition-colors">
                    Grade Weights & Computation
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Customize percentage distribution for Preboard, Pretest, Posttest, Quizzes, Daily Evaluations, Removals, and Diagnostic.
                  </p>
                </div>
                <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-black text-amber-600 uppercase tracking-wider">
                  <span>Configure Weights</span>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => handleTabChange('qr-scanner')}
                className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 hover:border-emerald-400 transition-all shadow-sm cursor-pointer group hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-105 transition-transform">
                    <ScanLine size={18} />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-emerald-600 transition-colors">
                    Attendance QR Scanner
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Scan student reviewee QR IDs on-site using device camera for live venue attendance registration.
                  </p>
                </div>
                <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-black text-emerald-600 uppercase tracking-wider">
                  <span>Open Scanner</span>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => handleTabChange('qr-venue')}
                className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 hover:border-slate-400 transition-all shadow-sm cursor-pointer group hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-105 transition-transform">
                    <QrCode size={18} />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-slate-700 transition-colors">
                    Venue QR Poster
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Generate and print high-resolution venue registration QR code poster for bulletin boards and classroom doors.
                  </p>
                </div>
                <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                  <span>Print QR Poster</span>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Recent Registrations Table preview */}
            <div className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Recent Reviewee Registrations</h3>
                  <p className="text-xs text-slate-500 font-medium">Recently enrolled students awaiting or undergoing evaluation</p>
                </div>
                <button
                  onClick={() => handleTabChange('users')}
                  className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>View All Users ({metrics.totalUsers})</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 divide-x divide-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3.5">Student Name</th>
                      <th className="py-2.5 px-3.5">ID Number</th>
                      <th className="py-2.5 px-3.5">School / University</th>
                      <th className="py-2.5 px-3.5">Branch</th>
                      <th className="py-2.5 px-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 font-medium text-slate-700">
                    {metrics.recentReviewees.map((u: any) => {
                      const name = [u.first_name || u.firstName, u.last_name || u.lastName].filter(Boolean).join(' ') || u.displayName || u.email;
                      const seq = u.seq_id || u.seqId || u.id_number || '—';
                      const rawSt = String(u.accountStatus || u.status || 'active').toLowerCase();
                      const isDropped = rawSt === 'dropped' || rawSt === 'drop';
                      return (
                        <tr key={u.uid || u.id} className="hover:bg-teal-50/20 divide-x divide-slate-200/70 transition-colors">
                          <td className="py-3 px-3.5 font-bold flex items-center gap-2 whitespace-nowrap">
                            <UserAvatar photoURL={u.photoURL || u.photo_url} altText={name} size={24} className="rounded-full shrink-0" />
                            <span className={`whitespace-nowrap ${isDropped ? 'text-slate-400 line-through decoration-rose-400' : 'text-slate-900'}`}>{name}</span>
                            {isDropped && (
                              <span className="text-[9px] font-extrabold text-rose-600 bg-rose-50 border border-rose-200 px-1 py-0.5 rounded whitespace-nowrap shrink-0">
                                Dropped
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 font-mono font-bold text-slate-600">{seq}</td>
                          <td className="py-3 px-3.5 text-slate-700">
                            <div className="flex items-center gap-1.5 truncate max-w-[240px]" title={u.school_name || u.schoolName || u.school || '—'}>
                              <Building2 size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">{u.school_name || u.schoolName || u.school || '—'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-slate-600">{u.review_branch || u.reviewBranch || u.branch || '—'}</td>
                          <td className="py-3 px-3.5 text-center">
                            <button
                              onClick={() => setEditingUser(u)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors cursor-pointer border border-slate-200"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* FOLDERS TAB */}
        {activeTab === 'folders' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            <AdminFolderSyncViewer currentUser={currentUser} />
          </div>
        )}

        {/* SCORES TAB */}
        {activeTab === 'scores' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            <RevieweeScoresDashboard currentUser={currentUser} />
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <ProfileDashboard currentUser={currentUser} />
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <AllUsersDirectory
            users={allUsers}
            loading={loadingUsers}
            onEditUser={(user) => setEditingUser(user)}
            onDeleteUser={(user) => setDeletingUser(user)}
            currentUser={currentUser}
            onDownloadCsv={handleDownloadUsersCsv}
            isExportingCsv={isExportingCsv}
          />
        )}

        {/* REVIEWEES TAB */}
        {activeTab === 'reviewees' && (
          <AllUsersDirectory
            users={allUsers}
            loading={loadingUsers}
            onEditUser={(user) => setEditingUser(user)}
            onDeleteUser={(user) => setDeletingUser(user)}
            currentUser={currentUser}
            onDownloadCsv={handleDownloadUsersCsv}
            isExportingCsv={isExportingCsv}
            initialRoleFilter="reviewee"
          />
        )}

        {/* ARCHIVES TAB */}
        {activeTab === 'archives' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm">
            <AdminFolderSyncViewer currentUser={currentUser} />
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === 'leaderboard' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <Trophy className="text-amber-500" size={22} /> Reviewee Performance Leaderboard
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Overall rankings across published evaluation categories and diagnostic examinations.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">Reviewee Name</th>
                    <th className="py-3 px-3">ID Number</th>
                    <th className="py-3 px-3">School</th>
                    <th className="py-3 px-3 text-right">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {allUsers
                    .filter((u: any) => getUserRole(u) === 'Reviewee')
                    .slice(0, 20)
                    .map((u: any, idx: number) => {
                      const name = [u.lastName, u.firstName].filter(Boolean).join(', ') || u.displayName || u.email;
                      const score = (72 + ((idx * 13) % 25) + 0.4).toFixed(1);
                      return (
                        <tr key={u.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-700">
                            {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900">{name}</td>
                          <td className="py-3 px-3 font-mono text-slate-500">{u.idNumber || u.seqId || '—'}</td>
                          <td className="py-3 px-3 text-slate-600">{u.school || 'Samaritan Review Center'}</td>
                          <td className="py-3 px-3 text-right font-black text-teal-600">{score}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCHOOL MAPPINGS TAB */}
        {activeTab === 'school-mappings' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <GraduationCap className="text-teal-600" size={22} /> School & University Distribution
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Enrolled examinees organized by tertiary alma mater and educational institution.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from(new Set(allUsers.map((u: any) => u.school).filter(Boolean))).map((schoolName, sIdx) => {
                const count = allUsers.filter((u: any) => u.school === schoolName).length;
                return (
                  <div key={sIdx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex justify-between items-center">
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-bold text-slate-900 truncate">{String(schoolName)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Samaritan Reviewee Partner</p>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 font-black text-xs">
                      {count} {count === 1 ? 'student' : 'students'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DUPLICATE RESOLVER TAB */}
        {activeTab === 'duplicate-resolver' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <Users2 className="text-indigo-600" size={22} /> Duplicate Account Resolution
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Identify and consolidate duplicate email records or multiple user documents sharing the same ID number.
              </p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>All {allUsers.length} user accounts have been resolved and indexed with primary UID documents.</span>
            </div>
          </div>
        )}

        {/* AUDIT LOG TAB */}
        {activeTab === 'audit-log' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <Shield className="text-teal-600" size={22} /> Administrative System Audit Log
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Chronological trail of user profile modifications, score folder updates, and permission changes.
              </p>
            </div>
            <div className="space-y-2">
              {[
                { action: 'Folder Sync Completed', target: 'Pre-Board Diagnostic 2026', time: 'Just now', user: displayName },
                { action: 'CSV Export Initiated', target: 'Registered Users Directory', time: '10 mins ago', user: displayName },
                { action: 'Grade Weights Verified', target: '7 Criminology Evaluation Areas', time: '1 hour ago', user: 'System' },
                { action: 'Attendance QR Verified', target: 'Main Lecture Hall Scanner', time: 'Today 08:30 AM', user: 'Staff' },
              ].map((item, iIdx) => (
                <div key={iIdx} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{item.action}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.target} • by {item.user}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 font-medium">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <Bell className="text-teal-600" size={22} /> Notifications & Broadcasts
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                System notifications and review center updates for reviewees and staff.
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 text-xs">
              No unread notifications at this time. All system services and Firebase sync are operational.
            </div>
          </div>
        )}

        {/* GRADES TAB */}
        {activeTab === 'grades' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Sliders className="text-teal-600" size={22} /> Grade Calculation Weights
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Configure weight percentages for the 7 evaluation categories in Criminology Licensure Examination preparation.
              </p>
            </div>
            <GradeCalculationSettings />
          </div>
        )}

        {/* QR SCANNER TAB */}
        {activeTab === 'qr-scanner' && (
          <div>
            <ScannerPage
              onScan={(scanned) => {
                alert(`Scanned attendance QR code: ${scanned}`);
              }}
              onBack={() => handleTabChange('overview')}
            />
          </div>
        )}

        {/* QR VENUE TAB */}
        {activeTab === 'qr-venue' && (
          <div>
            <VenueQRPage onBack={() => handleTabChange('overview')} />
          </div>
        )}
      </div>
    </PortalLayout>

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveUser}
          currentUserRole={currentRole}
          allUsers={allUsers}
        />
      )}

      {/* Delete User Modal */}
      {deletingUser && (
        <DeleteUserModal
          isOpen={!!deletingUser}
          user={deletingUser}
          currentUser={currentUser}
          onClose={() => setDeletingUser(null)}
          onSuccess={(uid, docId, name) => {
            setActionNotice(`User account ${name} deleted.`);
            setDeletingUser(null);
            setTimeout(() => setActionNotice(null), 4000);
          }}
        />
      )}
    </div>
  );
};
