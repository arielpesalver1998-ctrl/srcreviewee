import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, ClipboardList, BookOpen, Calendar, 
  TrendingUp, User, Activity, ClipboardCheck, Star, Award,
  ArrowRight,
  ChevronRight,
  Trophy,
  History,
  Target,
  Bell,
  Menu,
  LogOut,
  FolderSync,
  Shield
} from 'lucide-react';
import type { RevieweeData } from '../types';
import { parseScores } from '../utils/scoreParser';
import { getUserRole, isAdmin, isStaff, isReviewee, isAdminLike } from '../utils/roleUtils';
import { getDisplayIdNumber } from '../utils/idResolver';
import { useFirestoreUsers } from '../hooks/useFirestoreUsers';
import { useNotifications } from '../hooks/useNotifications';
import { firestoreDb } from '../utils/firebaseClient';
import { MyScoresPage } from './reviewee/MyScoresPage';
import { PortalLayout } from './PortalLayout';
import { AreaProgressCard, ScoreTrend, getScoreColor, getScoreLabel } from './DashboardShared';
import { StatCard, ActivityFeed, SimpleTable, SectionHeader, QuickActionsGrid } from './DashboardKit';
import { ProfileDashboard } from './ProfileDashboard';
import { AdminFolderSyncViewer } from './AdminFolderSyncViewer';
import { doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { DEFAULT_GRADE_WEIGHTS, GradeWeights, SubjectArea, GRADE_CATEGORY_LABELS, GradeCategoryKey } from '../utils/gradeCalculation';
import { calculateRevieweeArea } from '../utils/calculateRevieweeArea';
import { AreaPerformanceCircle } from './AreaPerformanceCircle';
import { BoardSubjectAreasSection } from './BoardSubjectAreasSection';
import { AreaPerformanceModal } from './performance/AreaPerformanceModal';
import { getResolvedScore } from '../utils/scoreFieldResolver';
import { isValidRevieweeRecord } from '../services/userIdentityResolver';
import { UserAvatar } from './UserAvatar';
import { PortalBottomMenu } from './ui/portal-bottom-menu';

const areaTitleMap: Record<string, string> = {
  "CLJ": "Criminal Law and Jurisprudence",
  "LEA": "Law Enforcement Administration",
  "CDI": "Crime Detection and Investigation",
  "FS": "Forensic Science",
  "CRIM": "Criminology",
  "COR-AD": "Correctional Administration",
};

export function RevieweePortal({ 
  data, 
  onLogout,
  onSwitchToAdmin,
}: { 
  data: RevieweeData; 
  onLogout: () => void;
  onSwitchToAdmin?: () => void;
}) {
  const [revieweeData, setRevieweeData] = useState(data);
  
  useEffect(() => {
    if (!data.uid) return;
    const unsub = onSnapshot(
      doc(firestoreDb, "users", data.uid),
      (snap) => {
        if (snap.exists()) {
          setRevieweeData(snap.data() as RevieweeData);
        }
      },
      (err) => console.error("Error listening to user data:", err)
    );
    return () => unsub();
  }, [data.uid]);

  const [activeTab, setActiveTab] = useState(() => {
    const normalizedPath = decodeURIComponent(window.location.pathname).toLowerCase();
    if (normalizedPath.includes('/reviewee/my-scores')) {
      return 'my-scores';
    }
    if (normalizedPath.includes('/reviewee/scores') || normalizedPath.includes('/scores')) {
      return 'scores';
    }
    if (normalizedPath.includes('/reviewee/profile') || normalizedPath.includes('/profile')) {
      return 'profile';
    }
    return localStorage.getItem('reviewee_active_tab') || 'dashboard';
  });
  const [showAdminFolderModal, setShowAdminFolderModal] = useState(false);
  const { allUsers } = useFirestoreUsers();
  const { notifications } = useNotifications(firestoreDb, data.uid || "");
  
  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const handleTabChange = (tab: string) => {
    setSelectedSubjectBreakdown(null);
    
    // Map 'daily' and 'eval' to 'my-scores'
    const targetTab = (tab === 'daily' || tab === 'eval') ? 'my-scores' : tab;
    
    setActiveTab(targetTab);
    localStorage.setItem('reviewee_active_tab', targetTab);
    
    let url = '/reviewee/dashboard';
    if (targetTab === 'my-scores') {
      url = '/reviewee/my-scores';
    } else if (targetTab === 'scores') {
      url = '/reviewee/scores';
    } else if (targetTab === 'profile') {
      url = '/reviewee/profile';
    }
    window.history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [gradeWeights, setGradeWeights] = useState<GradeWeights>(DEFAULT_GRADE_WEIGHTS);
  const [selectedSubjectBreakdown, setSelectedSubjectBreakdown] = useState<{
    subject: string;
    revieweeName?: string;
    breakdown: any[];
    totalPercentage: number;
    totalEarned: number;
    totalPossible: number;
  } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestoreDb, "system_settings", "grade_calculation"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && data.weights) {
            setGradeWeights(data.weights);
          }
        }
      },
      (err) => console.error("Error listening to grade weights:", err)
    );
    return () => unsub();
  }, []);

  const handleAreaCardClick = (subjectLabel: string, subjectKey: SubjectArea) => {
    const result = calculateRevieweeArea(revieweeData, subjectKey, gradeWeights);
    const name = [
      revieweeData.first_name,
      revieweeData.middle_name,
      revieweeData.last_name
    ].filter(Boolean).join(' ').trim() || "Reviewee";
    setSelectedSubjectBreakdown({
      subject: subjectLabel,
      revieweeName: name,
      breakdown: result.breakdown,
      totalPercentage: result.percentage,
      totalEarned: result.totalEarned,
      totalPossible: result.totalPossible
    });
  };
  
  const scores = useMemo(() => parseScores(revieweeData), [revieweeData]);
  
  const avgScore = useMemo(() => {
    const subjects: SubjectArea[] = ["clj", "lea", "cdi", "fs", "crim", "ca"];
    const areaScores = subjects.map(subj => {
      return calculateRevieweeArea(revieweeData, subj, gradeWeights).percentage;
    });
    return Number((areaScores.reduce((sum, val) => sum + val, 0) / subjects.length).toFixed(1));
  }, [revieweeData, gradeWeights]);
  
  // Calculate dynamic rank for this specific reviewee among all reviewees
  const rankInfo = useMemo(() => {
    if (!allUsers || allUsers.length === 0 || scores.length === 0) {
      return { rank: "0", subtitle: "No scores yet", topPercent: null };
    }

    const revieweesList = allUsers.filter((u: any) => getUserRole(u) === "Reviewee");
    
    // Calculate average for each reviewee
    const ranked = revieweesList.map((u: any) => {
      const subjects: SubjectArea[] = ["clj", "lea", "cdi", "fs", "crim", "ca"];
      const areaScores = subjects.map(subj => {
        return calculateRevieweeArea(u, subj, gradeWeights).percentage;
      });
      const uAvg = areaScores.reduce((sum, val) => sum + val, 0) / subjects.length;
      const count = subjects.reduce((sum, subj) => {
        const categories: GradeCategoryKey[] = ["preboard", "pretest", "posttest", "quiz", "dailyEvaluation", "removal", "diagnostic"];
        const actualCount = categories.reduce((c, cat) => getResolvedScore(u, cat, subj) !== null ? c + 1 : c, 0);
        return sum + actualCount;
      }, 0);
      const uSeq = u.seq_id || u.seqId || u.srcId || u.id_number || u.uid || u.id;
      return {
        uid: u.uid || u.id,
        seqId: uSeq,
        avg: uAvg,
        count
      };
    }).filter(u => u.count > 0);

    ranked.sort((a, b) => b.avg - a.avg);

    const rData = revieweeData as any;
    const currentSeq = rData.seq_id || rData.seqId || rData.srcId || rData.id_number || rData.uid || rData.id;
    const currentUid = rData.uid || rData.id;

    const idx = ranked.findIndex(r => 
      (currentUid && r.uid === currentUid) || 
      (currentSeq && r.seqId === currentSeq)
    );

    if (idx === -1) {
      return { rank: "0", subtitle: `Out of ${revieweesList.length} Reviewees`, topPercent: null };
    }

    const rankNum = idx + 1;
    const total = ranked.length;
    const percentile = Math.max(1, Math.round((rankNum / total) * 100));

    return {
      rank: `#${rankNum}`,
      subtitle: `Out of ${total} Evaluated Reviewees`,
      topPercent: percentile <= 20 ? `Top ${percentile}% of Batch` : `Ranked ${rankNum} of ${total}`
    };
  }, [allUsers, revieweeData, scores, gradeWeights]);

  // Calculate dynamic course progress for this specific reviewee
  const progressInfo = useMemo(() => {
    const evaluatedAreasCount = new Set(scores.map(s => s.area)).size;
    const progressPercent = Math.min(100, Math.round((evaluatedAreasCount / 6) * 100));
    return {
      percentStr: scores.length > 0 ? `${progressPercent}%` : "0.00%",
      subtitle: scores.length > 0 ? `${evaluatedAreasCount} of 6 Subject Areas Evaluated` : "No scores yet"
    };
  }, [scores]);

  const trendData = useMemo(() => {
    const sorted = [...scores].sort((a,b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    return sorted.slice(-8).map(s => ({ date: s.date || 'N/A', score: s.percentage }));
  }, [scores]);
  
  const areaScores = useMemo(() => {
    const subjects: { key: SubjectArea; label: string }[] = [
      { key: "clj", label: "CLJ" },
      { key: "lea", label: "LEA" },
      { key: "cdi", label: "CDI" },
      { key: "fs", label: "FS" },
      { key: "crim", label: "CRIM" },
      { key: "ca", label: "COR-AD" },
    ];

    return subjects.map(subj => {
      const result = calculateRevieweeArea(revieweeData, subj.key, gradeWeights);
      const categories: GradeCategoryKey[] = ["preboard", "pretest", "posttest", "quiz", "dailyEvaluation", "removal", "diagnostic"];
      const actualCount = categories.reduce((c, cat) => getResolvedScore(revieweeData, cat, subj.key) !== null ? c + 1 : c, 0);
      return {
        key: subj.key,
        area: subj.label,
        title: areaTitleMap[subj.label] || subj.label,
        percent: result.percentage,
        count: actualCount,
        subtitle: `${actualCount} ${actualCount === 1 ? 'evaluation' : 'evaluations'} encoded`
      };
    });
  }, [revieweeData, gradeWeights]);

  const latestResultsItems = useMemo(() => scores.slice(-5).reverse().map((s, idx) => ({
    id: `${s.date}-${idx}`,
    title: `${s.category} ${s.area}`,
    meta: s.date || 'Recently Encoded',
    tag: `${s.percentage}%`,
    tone: (s.percentage >= 75 ? 'emerald' : s.percentage >= 50 ? 'amber' : 'rose') as any,
    icon: <Award size={16} />
  })), [scores]);

  const latestTableRows = useMemo(() => scores.slice(-8).reverse().map((s, idx) => ({
    id: `${s.date}-${idx}`,
    category: s.category,
    area: s.area,
    score: s.percentage,
    date: s.date || '—',
  })), [scores]);

  const revieweeName = `${revieweeData.first_name || ''} ${revieweeData.middle_name ? revieweeData.middle_name + ' ' : ''}${revieweeData.last_name || ''}`.trim() || 'Reviewee';

  const renderDashboard = () => (
    <div className="space-y-4 sm:space-y-6">
      {/* Admin Folder Sync Banner */}
      {isAdminLike(revieweeData) && (
        <div className="bg-gradient-to-r from-slate-900 to-teal-950 text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-teal-500/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0">
              <FolderSync size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                Admin Score Folders & Sync Hub
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  Admin Tools
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-0.5 line-clamp-1 sm:line-clamp-none">
                Verify folders created in Firebase Firestore, audit dual-collection sync, and manage portal publication status.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAdminFolderModal(true)}
            className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Verify Folders</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatCard
          label="Overall Average"
          value={scores.length > 0 ? `${Number(avgScore).toFixed(2)}%` : '0.00%'}
          icon={<Star size={18} />}
          tone="blue"
          subtitle={scores.length > 0 ? getScoreLabel(avgScore) : 'No scores yet'}
        />
        <StatCard
          label="Course Progress"
          value={progressInfo.percentStr}
          icon={<TrendingUp size={18} />}
          tone="emerald"
          subtitle={progressInfo.subtitle}
        />
        <StatCard
          label="My Rank"
          value={rankInfo.rank}
          icon={<Trophy size={18} />}
          tone="sky"
          subtitle={rankInfo.topPercent || rankInfo.subtitle}
        />
        <StatCard
          label="Evaluations Taken"
          value={scores.length.toString()}
          icon={<ClipboardCheck size={18} />}
          tone="purple"
          subtitle="Total encoded sessions"
        />
      </div>

      {/* Area Scores */}
      <BoardSubjectAreasSection
        title="Board Subject Areas"
        subtitle="Click any area to view full category breakdown"
        areas={areaScores.map((item) => ({
          key: item.key,
          area: item.area,
          title: item.title,
          percent: item.percent,
          count: item.count,
          onClick: () => handleAreaCardClick(item.area, item.key as SubjectArea),
        }))}
        onViewAll={() => handleTabChange('progress')}
      />

      {/* Trend + Latest Results */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ScoreTrend trendData={trendData} />
        </div>

        <section className="xl:col-span-2 rounded-2xl sm:rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <SectionHeader title="Latest Results" onViewAll={() => handleTabChange('scores')} />
          <ActivityFeed items={latestResultsItems} emptyLabel="No scores encoded yet." />
        </section>
      </div>

      {/* Detailed Score History */}
      <section className="rounded-2xl sm:rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <SectionHeader title="Recent Score Logs" onViewAll={() => handleTabChange('scores')} />
        <SimpleTable 
          rows={latestTableRows}
          columns={[
            { key: 'category', header: 'Category', render: (r) => <span className="text-sm font-black text-slate-900">{r.category}</span> },
            { key: 'area', header: 'Board Area', render: (r) => <span className="text-xs font-black text-[#007C89]">{r.area}</span> },
            { 
              key: 'score', 
              header: 'Score', 
              render: (r) => (
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black ${getScoreColor(r.score)}`}>{r.score}%</span>
                  <div className="hidden sm:block h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${r.score >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${r.score}%` }} />
                  </div>
                </div>
              ) 
            },
            { key: 'date', header: 'Date Taken', render: (r) => <span className="text-xs font-semibold text-slate-500">{r.date}</span> },
          ]}
        />
      </section>

      {/* Quick Access Grid */}
      <section className="space-y-2.5 sm:space-y-3">
        <h3 className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Student Utilities</h3>
        <QuickActionsGrid 
          actions={[
            { key: 'scores', label: 'Score History', icon: <ClipboardList size={18} />, onClick: () => handleTabChange('scores') },
            { key: 'eval', label: 'Daily Evaluation', icon: <Calendar size={18} />, onClick: () => handleTabChange('daily') },
            { key: 'progress', label: 'Progress Analytics', icon: <TrendingUp size={18} />, onClick: () => handleTabChange('progress') },
            { key: 'profile', label: 'My Account', icon: <User size={18} />, onClick: () => handleTabChange('profile') },
          ]}
        />
      </section>
    </div>
  );

  const renderProgress = () => (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title="Progress Analytics" />
      <div className="grid grid-cols-1 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Overall Average"
          value={scores.length > 0 ? `${avgScore}%` : '0.00%'}
          icon={<Star size={18} />}
          tone="blue"
          subtitle={scores.length > 0 ? getScoreLabel(avgScore) : 'No scores yet'}
        />
        <StatCard
          label="Course Progress"
          value={progressInfo.percentStr}
          icon={<TrendingUp size={18} />}
          tone="emerald"
          subtitle={progressInfo.subtitle}
        />
        <StatCard
          label="My Rank"
          value={rankInfo.rank}
          icon={<Trophy size={18} />}
          tone="sky"
          subtitle={rankInfo.topPercent || rankInfo.subtitle}
        />
      </div>

      <BoardSubjectAreasSection
        title="Subject Area Performance"
        subtitle="Click any area to view full category breakdown"
        areas={areaScores.map((item) => ({
          key: item.key,
          area: item.area,
          title: item.title,
          percent: item.percent,
          count: item.count,
          onClick: () => handleAreaCardClick(item.area, item.key as SubjectArea),
        }))}
      />

      <section className="rounded-2xl sm:rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <ScoreTrend trendData={trendData} />
      </section>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-4 sm:space-y-6">
      <SectionHeader title="Evaluation Results" />
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-5">
        <section className="xl:col-span-2 rounded-2xl sm:rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <SectionHeader title="Latest Evaluation Feeds" />
          <ActivityFeed items={latestResultsItems} emptyLabel="No scores encoded yet." />
        </section>

        <section className="xl:col-span-3 rounded-2xl sm:rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <SectionHeader title="Full Score Records" />
          <SimpleTable 
            rows={scores}
            columns={[
              { key: 'category', header: 'Category', render: (r) => <span className="text-sm font-black text-slate-900">{r.category}</span> },
              { key: 'area', header: 'Board Area', render: (r) => <span className="text-xs font-black text-[#007C89]">{r.area}</span> },
              { 
                key: 'score', 
                header: 'Score', 
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black ${getScoreColor(r.percentage)}`}>{r.percentage}%</span>
                    <div className="hidden sm:block h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${r.percentage >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${r.percentage}%` }} />
                    </div>
                  </div>
                ) 
              },
              { key: 'date', header: 'Date Taken', render: (r) => <span className="text-xs font-semibold text-slate-500">{r.date || 'Recently Encoded'}</span> },
            ]}
          />
        </section>
      </div>
    </div>
  );

  const drawerNavItems = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { key: 'my-scores', label: 'My Scores', icon: <ClipboardList size={18} /> },
    { key: 'progress', label: 'Progress Analytics', icon: <TrendingUp size={18} /> },
    { key: 'results', label: 'Evaluation Results', icon: <Award size={18} /> },
    { key: 'profile', label: 'My Profile', icon: <User size={18} /> },
  ];

  const bottomNavItems = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { key: 'my-scores', label: 'Scores', icon: <ClipboardList size={18} /> },
    { key: 'progress', label: 'Progress', icon: <TrendingUp size={18} /> },
    { key: 'results', label: 'Results', icon: <Award size={18} /> },
    { key: 'profile', label: 'Profile', icon: <User size={18} /> },
  ];

  const revieweeId = getDisplayIdNumber("Reviewee", revieweeData) || 'No ID assigned';

  return (
    <div className="h-full w-full">
      <PortalLayout
        title={revieweeName}
        subtitle="Reviewee Portal"
        role="Reviewee"
        roleDetail={revieweeName}
        seqId={revieweeId}
        idNumber={revieweeId}
        photoURL={revieweeData?.photo_url || revieweeData?.photoUrl}
        activeTab={activeTab === 'scores' ? 'my-scores' : activeTab}
        onTabChange={handleTabChange}
        onLogout={onLogout}
        db={firestoreDb}
        navItems={drawerNavItems}
        footerItems={bottomNavItems}
        headerRightExtra={
          isAdmin(revieweeData) ? (
            <button
              onClick={() => setShowAdminFolderModal(true)}
              className="flex h-8 sm:h-9 items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors border border-teal-200/80 font-bold text-[11px] sm:text-xs shadow-sm cursor-pointer"
              title="Admin Folder Synchronization"
            >
              <FolderSync size={14} className="text-teal-600" />
              <span className="hidden sm:inline">Folder Sync</span>
            </button>
          ) : undefined
        }
      >
        <div className="mx-auto max-w-5xl">
          {(activeTab === "dashboard" || activeTab === "daily") && renderDashboard()}
          {(activeTab === "my-scores" || activeTab === "scores") && (
            <MyScoresPage 
              revieweeData={revieweeData} 
              scores={scores}
              gradeWeights={gradeWeights}
            />
          )}
          {activeTab === "progress" && renderProgress()}
          {activeTab === "results" && renderResults()}
          {activeTab === "profile" && <ProfileDashboard currentUser={revieweeData} onUpdate={setRevieweeData} />}
        </div>
      </PortalLayout>

      {selectedSubjectBreakdown && (
        <AreaPerformanceModal
          isOpen={!!selectedSubjectBreakdown}
          onClose={() => setSelectedSubjectBreakdown(null)}
          areaTitle={selectedSubjectBreakdown.subject}
          areaCode={selectedSubjectBreakdown.subject}
          revieweeLabel={selectedSubjectBreakdown.revieweeName}
          breakdown={selectedSubjectBreakdown.breakdown}
          totalPercentage={selectedSubjectBreakdown.totalPercentage}
          totalEarned={selectedSubjectBreakdown.totalEarned}
          totalPossible={selectedSubjectBreakdown.totalPossible}
        />
      )}

      {showAdminFolderModal && isAdmin(revieweeData) && (
        <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95">
            <AdminFolderSyncViewer
              currentUser={revieweeData}
              isModal={true}
              onClose={() => setShowAdminFolderModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
