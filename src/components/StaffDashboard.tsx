import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  ScanLine,
  QrCode,
  FolderOpen,
  LogOut,
  Eye,
  Shield,
  GraduationCap,
  Sparkles,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertCircle,
  User,
  Building2
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { firestoreDb } from '../utils/firebaseClient';
import { useFirestoreUsers } from '../hooks/useFirestoreUsers';
import { useScoreFolders } from '../hooks/useScoreFolders';
import { getUserRole, isStaff } from '../utils/roleUtils';
import { UserAvatar } from './UserAvatar';
import RevieweeScoresDashboard from './reviewee/RevieweeScoresDashboard';
import { AllUsersDirectory } from './AllUsersDirectory';
import { EditUserModal } from './EditUserModal';
import { ScannerPage } from './ScannerPage';
import { VenueQRPage } from './VenueQRPage';
import { StatCard } from './DashboardKit';
import { PortalLayout } from './PortalLayout';
import { ProfileDashboard } from './ProfileDashboard';
import { deduplicateUsersByIdNumber, getUserAccountStatus } from '../services/userIdentityResolver';
import { logProfileModification } from '../services/activityLogService';

interface StaffDashboardProps {
  currentUser: any;
  onLogout: () => void;
  onSwitchToAdmin?: () => void;
}

export type StaffTab = 'overview' | 'profile' | 'scores' | 'directory' | 'folders' | 'scanner' | 'venue-qr';

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  currentUser,
  onLogout,
  onSwitchToAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<StaffTab>(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/staff/scores')) return 'scores';
    if (path.includes('/staff/directory')) return 'directory';
    if (path.includes('/staff/folders')) return 'folders';
    if (path.includes('/staff/scanner')) return 'scanner';
    if (path.includes('/staff/venue-qr')) return 'venue-qr';
    return (localStorage.getItem('staff_active_tab') as StaffTab) || 'overview';
  });

  const { allUsers, loading: loadingUsers } = useFirestoreUsers();
  const { folders, loading: loadingFolders } = useScoreFolders();

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleTabChange = (tab: StaffTab) => {
    setActiveTab(tab);
    localStorage.setItem('staff_active_tab', tab);
    let path = '/staff/dashboard';
    if (tab === 'scores') path = '/staff/scores';
    else if (tab === 'directory') path = '/staff/directory';
    else if (tab === 'folders') path = '/staff/folders';
    else if (tab === 'scanner') path = '/staff/scanner';
    else if (tab === 'venue-qr') path = '/staff/venue-qr';
    window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const metrics = useMemo(() => {
    const validUsers = deduplicateUsersByIdNumber(allUsers).filter(u => {
      const status = getUserAccountStatus(u);
      return status !== 'merged' && status !== 'deleted';
    });
    const reviewees = validUsers.filter(u => {
      const r = getUserRole(u).toLowerCase();
      return r !== 'admin' && r !== 'staff';
    });
    const activeReviewees = reviewees.filter(u => getUserAccountStatus(u) === 'active');
    const publishedFolders = folders.filter(f => !f.isArchived && f.publicationStatus !== 'hidden');

    let totalScoresCount = 0;
    reviewees.forEach((u) => {
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
      totalReviewees: reviewees.length,
      activeReviewees: activeReviewees.length,
      publishedFolders: publishedFolders.length,
      totalScoresCount,
      recentReviewees: activeReviewees.slice(-6).reverse(),
    };
  }, [allUsers, folders]);

  const handleSaveUser = async (updatedData: any) => {
    if (!firestoreDb) return;
    const targetId = updatedData.uid || updatedData.id || updatedData.doc_id;
    if (!targetId) return;

    try {
      const docRef = doc(firestoreDb, "users", targetId);
      const cleanSeqId = String(updatedData.seqId || updatedData.seq_id || '').trim().toUpperCase();

      const targetStatus = updatedData.status === 'pending' ? 'pending_profile' : (updatedData.status || updatedData.accountStatus || 'active');
      const isPending = targetStatus === 'pending_profile' || targetStatus === 'pending';
      const isDropped = targetStatus === 'dropped';

      const oldUser = allUsers.find(u => (u.uid || u.id || u.doc_id) === targetId) || editingUser || {};
      const newPayload = {
        ...oldUser,
        ...updatedData,
        seqId: cleanSeqId,
        seq_id: cleanSeqId,
        idNumber: cleanSeqId,
        id_number: cleanSeqId,
        srcId: cleanSeqId,
        src_id: cleanSeqId,
        role: updatedData.role || 'Reviewee',
        userRole: updatedData.role || 'Reviewee',
        status: targetStatus,
        accountStatus: targetStatus,
      };

      await updateDoc(docRef, {
        firstName: updatedData.firstName || '',
        first_name: (updatedData.firstName || '').toUpperCase(),
        middleName: updatedData.middleName || '',
        middle_name: (updatedData.middleName || '').toUpperCase(),
        lastName: updatedData.lastName || '',
        last_name: (updatedData.lastName || '').toUpperCase(),
        email: updatedData.email || '',
        role: updatedData.role || 'Reviewee',
        userRole: updatedData.role || 'Reviewee',
        seqId: cleanSeqId,
        seq_id: cleanSeqId,
        idNumber: cleanSeqId,
        id_number: cleanSeqId,
        srcId: cleanSeqId,
        src_id: cleanSeqId,
        studentId: cleanSeqId,
        student_id: cleanSeqId,
        school: updatedData.school || updatedData.schoolName || '',
        school_name: updatedData.school_name || updatedData.schoolName || updatedData.school || '',
        branch: updatedData.branch || updatedData.reviewBranch || '',
        review_branch: updatedData.review_branch || updatedData.reviewBranch || updatedData.branch || '',
        status: targetStatus,
        accountStatus: targetStatus,
        profileCompleted: isPending ? false : isDropped ? false : true,
        updatedAt: new Date().toISOString(),
      });

      // Realtime Activity Log Recording
      await logProfileModification({
        editor: currentUser,
        oldUser,
        updatedUser: newPayload,
      });

      setActionNotice(`Reviewee ${updatedData.firstName} ${updatedData.lastName} updated successfully.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      console.error("Error updating user document:", err);
      alert(`Failed to update reviewee: ${err.message || err}`);
    }
  };

  const displayName = [currentUser?.firstName || currentUser?.first_name, currentUser?.lastName || currentUser?.last_name]
    .filter(Boolean)
    .join(' ') || currentUser?.displayName || currentUser?.email || 'Staff Officer';

  const drawerNavItems = [
    { key: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { key: 'profile', label: 'My Profile', icon: <User size={18} /> },
    { key: 'directory', label: 'Reviewee Directory', icon: <Users size={18} />, badge: metrics.totalReviewees },
    { key: 'scores', label: 'Score Matrix & Encoding', icon: <ClipboardList size={18} /> },
    { key: 'scanner', label: 'Attendance Scanner', icon: <ScanLine size={18} /> },
    { key: 'venue-qr', label: 'Venue QR Poster', icon: <QrCode size={18} /> },
    { key: 'folders', label: 'Score Folders', icon: <FolderOpen size={18} />, badge: metrics.publishedFolders },
  ];

  const bottomNavItems = [
    { key: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { key: 'directory', label: 'Directory', icon: <Users size={18} /> },
    { key: 'scores', label: 'Scores', icon: <ClipboardList size={18} /> },
    { key: 'scanner', label: 'Scanner', icon: <ScanLine size={18} /> },
    { key: 'profile', label: 'Profile', icon: <User size={18} /> },
  ];

  return (
    <div className="h-full w-full">
      <PortalLayout
        title="Staff Portal"
        subtitle="Samaritan Review Center Staff Console"
        role="Staff"
        roleDetail={displayName}
        idNumber="Staff Member"
        photoURL={currentUser?.photoURL || currentUser?.photo_url}
        activeTab={activeTab}
        onTabChange={(tab) => handleTabChange(tab as StaffTab)}
        onLogout={onLogout}
        db={firestoreDb}
        navItems={drawerNavItems}
        footerItems={bottomNavItems}
      >
        <div className="mx-auto max-w-7xl">
          {/* Status Notice */}
          {actionNotice && (
            <div className="mb-4 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
              <CheckCircle2 size={16} />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <ProfileDashboard currentUser={currentUser} />
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Staff Welcome Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-blue-900/50 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-blue-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1.5 sm:mb-2">
                    <Sparkles size={13} />
                    <span>Examination & Records Staff Portal</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                    Welcome, {displayName}!
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 sm:mt-1.5 max-w-2xl leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Encode examination marks across Criminology subject areas, audit student reviewee records, scan attendance QR codes, and assist in Samaritan Review Center operations.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                  <button
                    onClick={() => handleTabChange('scores')}
                    className="px-3 py-2 sm:px-4 sm:py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] sm:text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5 sm:gap-2 cursor-pointer"
                  >
                    <ClipboardList size={14} />
                    <span>Encode Scores</span>
                  </button>
                  <button
                    onClick={() => handleTabChange('scanner')}
                    className="px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-blue-300 font-black text-[11px] sm:text-xs uppercase tracking-wider rounded-xl transition-all border border-blue-800/50 flex items-center gap-1.5 sm:gap-2 cursor-pointer"
                  >
                    <ScanLine size={14} />
                    <span>Scan Attendance</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Staff Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
              <StatCard
                label="Active Reviewees"
                value={String(metrics.activeReviewees)}
                icon={<GraduationCap size={18} />}
                tone="blue"
                subtitle="Active student accounts"
              />
              <StatCard
                label="Score Folders Active"
                value={String(metrics.publishedFolders)}
                icon={<FolderOpen size={18} />}
                tone="teal"
                subtitle="Available for score entry"
              />
              <StatCard
                label="Total Scores Recorded"
                value={String(metrics.totalScoresCount)}
                icon={<ClipboardList size={18} />}
                tone="purple"
                subtitle="Assessment marks saved"
              />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
              <div
                onClick={() => handleTabChange('scores')}
                className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 hover:border-blue-400 transition-all shadow-sm cursor-pointer group hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-105 transition-transform">
                    <ClipboardList size={18} />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-blue-600 transition-colors">
                    Score Matrix & Encoding
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Enter examination scores for CLJ, LEA, CDI, Forensic Science, Criminology, and Correctional Administration.
                  </p>
                </div>
                <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-black text-blue-600 uppercase tracking-wider">
                  <span>Enter Score Matrix</span>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => handleTabChange('directory')}
                className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 hover:border-indigo-400 transition-all shadow-sm cursor-pointer group hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-105 transition-transform">
                    <Users size={18} />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-indigo-600 transition-colors">
                    Reviewee Student Directory
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Search reviewee records, verify ID numbers, schools, and review branches.
                  </p>
                </div>
                <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-black text-indigo-600 uppercase tracking-wider">
                  <span>Browse Reviewees</span>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => handleTabChange('scanner')}
                className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 hover:border-emerald-400 transition-all shadow-sm cursor-pointer group hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-105 transition-transform">
                    <ScanLine size={18} />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-emerald-600 transition-colors">
                    Attendance Scanner
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Scan student QR ID codes at the door for live venue and classroom check-ins.
                  </p>
                </div>
                <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs font-black text-emerald-600 uppercase tracking-wider">
                  <span>Open Scanner</span>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Recent Registrations Table preview */}
            <div className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Recent Reviewee Registrations</h3>
                  <p className="text-xs text-slate-500 font-medium">Recently enrolled students</p>
                </div>
                <button
                  onClick={() => handleTabChange('directory')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>View All Reviewees ({metrics.totalReviewees})</span>
                  <ChevronRight size={14} />
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
                      <th className="py-2.5 px-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 font-medium text-slate-700">
                    {metrics.recentReviewees.map((u: any, idx: number) => {
                      const name = [u.first_name || u.firstName, u.last_name || u.lastName].filter(Boolean).join(' ') || u.displayName || u.email;
                      const seq = u.seq_id || u.seqId || u.id_number || '—';
                      return (
                        <tr key={`${u.uid || u.id || 'u'}_${idx}`} className="hover:bg-blue-50/20 divide-x divide-slate-200/70 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-slate-900 flex items-center gap-2 whitespace-nowrap">
                            <UserAvatar photoURL={u.photoURL || u.photo_url} altText={name} size={24} className="rounded-full shrink-0" />
                            <span className="whitespace-nowrap">{name}</span>
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
                              Edit Info
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

        {/* SCORES TAB */}
        {activeTab === 'scores' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
            <RevieweeScoresDashboard currentUser={currentUser} />
          </div>
        )}

        {/* DIRECTORY TAB */}
        {activeTab === 'directory' && (
          <AllUsersDirectory
            users={allUsers}
            loading={loadingUsers}
            onEditUser={(user) => setEditingUser(user)}
            currentUser={currentUser}
          />
        )}

        {/* FOLDERS TAB */}
        {activeTab === 'folders' && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <FolderOpen className="text-blue-600" size={22} /> Examination Score Folders
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Active examination folders published in the Samaritan Review Center portal ({folders.length} total folders).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map((f) => (
                <div key={f.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">
                        {f.folderType || f.type || 'General'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        f.publicationStatus === 'hidden' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {f.publicationStatus === 'hidden' ? 'Hidden' : 'Live'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{f.name}</h3>
                    {((f as any).date || f.startDate) && (
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        {String((f as any).date || f.startDate).slice(0, 10)}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200/70 text-[11px] text-slate-500 font-medium">
                    Folder Type: <span className="font-bold text-slate-800 uppercase">{f.folderType || f.type || 'standard'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCANNER TAB */}
        {activeTab === 'scanner' && (
          <div>
            <ScannerPage
              onScan={(scanned) => {
                alert(`Attendance QR Scanned: ${scanned}`);
              }}
              onBack={() => handleTabChange('overview')}
            />
          </div>
        )}

        {/* VENUE QR TAB */}
        {activeTab === 'venue-qr' && (
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
        currentUserRole="Staff"
        allUsers={allUsers}
      />
    )}
  </div>
);
};
