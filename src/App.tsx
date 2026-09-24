import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Bug, WifiOff } from 'lucide-react';
import { AuthPage } from './components/AuthPage';
import { SuccessPage } from './components/SuccessPage';
import { RevieweePortal } from './components/RevieweePortal';
import { AdminDashboard } from './components/AdminDashboard';
import { StaffDashboard } from './components/StaffDashboard';
import { FirebaseDiagnosticPanel } from './components/FirebaseDiagnosticPanel';
import { logout } from './utils/auth';
import { firebaseConfigured, getFirebaseConfig } from './utils/firebase';
import { useBrowserOnlineStatus } from './hooks/useBrowserOnlineStatus';
import { getUserRole, isAdmin, isStaff, isReviewee } from './utils/roleUtils';
import type { RevieweeData } from './types';
import { requestNotificationPermission } from './utils/fcm';

export default function App() {
  const isOnline = useBrowserOnlineStatus();
  
  const [view, setView] = useState<'form' | 'success' | 'portal'>('form');
  const [enrollmentData, setEnrollmentData] = useState<RevieweeData | null>(null);
  const [lastGeneratedId, setLastGeneratedId] = useState<string | null>(null);
  const [portalMode, setPortalMode] = useState<'admin' | 'staff' | 'reviewee'>(() => {
    const normalizedPath = decodeURIComponent(window.location.pathname).toLowerCase();
    if (normalizedPath.startsWith('/admin')) {
      return 'admin';
    }
    if (normalizedPath.startsWith('/staff')) {
      return 'staff';
    }
    return (localStorage.getItem('user_portal_mode') as 'admin' | 'staff' | 'reviewee') || 'reviewee';
  });

  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  useEffect(() => {
    if (enrollmentData) {
      requestNotificationPermission();
    }
  }, [enrollmentData]);

  useEffect(() => {
    const checkPath = () => {
      const normalizedPath = decodeURIComponent(window.location.pathname).toLowerCase();
      
      // UNAUTHENTICATED USER ACCESS PROTECTION
      if (!enrollmentData) {
        if (
          normalizedPath.startsWith('/admin') || 
          normalizedPath.startsWith('/staff') || 
          normalizedPath.startsWith('/reviewee')
        ) {
          window.history.replaceState({}, '', '/login');
        }
        return;
      }

      // AUTHENTICATED USER ACCESS AND ROUTING
      const userRole = getUserRole(enrollmentData);
      const isUserAdmin = userRole === 'Admin';
      const isUserStaff = userRole === 'Staff';

      if (normalizedPath.startsWith('/admin')) {
        if (isUserAdmin) {
          setPortalMode('admin');
          localStorage.setItem('user_portal_mode', 'admin');
        } else if (isUserStaff) {
          // Staff cannot access admin: redirect to staff dashboard
          window.history.replaceState({}, '', '/staff/dashboard');
          setPortalMode('staff');
          localStorage.setItem('user_portal_mode', 'staff');
        } else {
          // Reviewee cannot access admin: strictly redirect to reviewee dashboard
          window.history.replaceState({}, '', '/reviewee/dashboard');
          setPortalMode('reviewee');
          localStorage.setItem('user_portal_mode', 'reviewee');
        }
      } else if (normalizedPath.startsWith('/staff')) {
        if (isUserAdmin || isUserStaff) {
          setPortalMode('staff');
          localStorage.setItem('user_portal_mode', 'staff');
        } else {
          // Reviewee cannot access staff: strictly redirect to reviewee dashboard
          window.history.replaceState({}, '', '/reviewee/dashboard');
          setPortalMode('reviewee');
          localStorage.setItem('user_portal_mode', 'reviewee');
        }
      } else if (normalizedPath.startsWith('/reviewee')) {
        setPortalMode('reviewee');
        localStorage.setItem('user_portal_mode', 'reviewee');
      }
    };

    checkPath();

    window.addEventListener('popstate', checkPath);
    return () => {
      window.removeEventListener('popstate', checkPath);
    };
  }, [enrollmentData]);

  const handleSwitchToAdmin = React.useCallback(() => {
    if (!isAdmin(enrollmentData)) {
      setPortalMode('reviewee');
      window.history.pushState({}, '', '/reviewee/dashboard');
      return;
    }
    setPortalMode('admin');
    localStorage.setItem('user_portal_mode', 'admin');
    window.history.pushState({}, '', '/admin/dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [enrollmentData]);

  const handleSwitchToStaff = React.useCallback(() => {
    if (!isAdmin(enrollmentData) && !isStaff(enrollmentData)) {
      setPortalMode('reviewee');
      window.history.pushState({}, '', '/reviewee/dashboard');
      return;
    }
    setPortalMode('staff');
    localStorage.setItem('user_portal_mode', 'staff');
    window.history.pushState({}, '', '/staff/dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [enrollmentData]);

  const handleSwitchToReviewee = React.useCallback(() => {
    setPortalMode('reviewee');
    localStorage.setItem('user_portal_mode', 'reviewee');
    window.history.pushState({}, '', '/reviewee/dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSuccess = React.useCallback((data: RevieweeData) => {
    setEnrollmentData(data);
    if (data && (data.seqId || data.seq_id)) {
      setLastGeneratedId(data.seqId || data.seq_id || null);
    }
    setView('portal');

    const currentPath = decodeURIComponent(window.location.pathname).toLowerCase();
    const userRole = getUserRole(data);
    const isUserAdmin = userRole === 'Admin';
    const isUserStaff = userRole === 'Staff';

    if (currentPath.startsWith('/admin')) {
      if (isUserAdmin) {
        setPortalMode('admin');
        localStorage.setItem('user_portal_mode', 'admin');
      } else if (isUserStaff) {
        window.history.replaceState({}, '', '/staff/dashboard');
        setPortalMode('staff');
        localStorage.setItem('user_portal_mode', 'staff');
      } else {
        window.history.replaceState({}, '', '/reviewee/dashboard');
        setPortalMode('reviewee');
        localStorage.setItem('user_portal_mode', 'reviewee');
      }
    } else if (currentPath.startsWith('/staff')) {
      if (isUserAdmin || isUserStaff) {
        setPortalMode('staff');
        localStorage.setItem('user_portal_mode', 'staff');
      } else {
        window.history.replaceState({}, '', '/reviewee/dashboard');
        setPortalMode('reviewee');
        localStorage.setItem('user_portal_mode', 'reviewee');
      }
    } else if (currentPath === '/' || currentPath === '/login' || currentPath === '/signup') {
      if (isUserAdmin) {
        window.history.replaceState({}, '', '/admin/dashboard');
        setPortalMode('admin');
        localStorage.setItem('user_portal_mode', 'admin');
      } else if (isUserStaff) {
        window.history.replaceState({}, '', '/staff/dashboard');
        setPortalMode('staff');
        localStorage.setItem('user_portal_mode', 'staff');
      } else {
        window.history.replaceState({}, '', '/reviewee/dashboard');
        setPortalMode('reviewee');
        localStorage.setItem('user_portal_mode', 'reviewee');
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleReset = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Firebase logout error during portal reset:", err);
    }
    setEnrollmentData(null);
    setView('form');
    window.history.replaceState({}, '', '/login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { missingFields: missingKeys } = getFirebaseConfig();

  if (!firebaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 text-center">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-3">Firebase Unconfigured</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            The application is currently unavailable because the Firebase configuration is incomplete. 
            Please provide the required environment variables or update the configuration file.
          </p>
          
          <div className="bg-slate-50 rounded-2xl p-5 text-left border border-slate-100 mb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Missing Required Fields:</p>
            <ul className="space-y-2">
              {missingKeys.map(key => (
                <li key={key} className="flex items-center text-sm text-slate-700 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-3" />
                  {key}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => setIsDiagnosticsOpen(true)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-500/20 mb-4"
          >
            <Bug className="w-4 h-4" />
            Open Firebase Diagnostics
          </button>
          
          <div className="pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-medium">
              If you are the developer, check your <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">.env</code> file or <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">firebase-applet-config.json</code>.
            </p>
          </div>
        </div>
        <FirebaseDiagnosticPanel isOpen={isDiagnosticsOpen} onClose={() => setIsDiagnosticsOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative selection:bg-blue-100 selection:text-blue-900 font-sans flex flex-col">
      <FirebaseDiagnosticPanel isOpen={isDiagnosticsOpen} onClose={() => setIsDiagnosticsOpen(false)} />

      {/* Teal Glow Background (Light & Dark mode aware) */}
      <div
        className="absolute inset-0 z-0 dark:hidden"
        style={{
          backgroundImage: `
            radial-gradient(125% 125% at 50% 90%, #ffffff 40%, #14b8a6 100%)
          `,
          backgroundSize: "100% 100%",
        }}
      />
      <div
        className="absolute inset-0 z-0 hidden dark:block"
        style={{
          backgroundImage: `
            radial-gradient(125% 125% at 50% 90%, #020617 40%, #0d9488 100%)
          `,
          backgroundSize: "100% 100%",
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-0 left-0 right-0 z-[100002] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-3 shadow-lg"
            >
              <WifiOff size={16} className="animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest">
                Connection Interrupted. Reconnecting…
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Pane */}
        <main className="flex-1 w-full px-4 sm:px-6 py-8 flex flex-col items-center justify-center">
          <div className="w-full flex flex-col items-center justify-center">
            {view === 'form' && (
              <div className="w-full max-w-lg animate-fade-in flex justify-center">
                <AuthPage onSuccess={handleSuccess} />
              </div>
            )}
            
            {view === 'success' && enrollmentData && (
              <div className="w-full max-w-lg animate-fade-in">
                <SuccessPage data={enrollmentData} onReset={handleReset} onOpenPortal={() => { setView('portal'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </div>
            )}

            {view === 'portal' && enrollmentData && (
              <div className="fixed inset-0 z-[100] w-full h-full bg-[#F8FAFC] dark:bg-[#020617] overflow-hidden animate-fade-in">
                {/* 1. ADMIN DASHBOARD: STRICTLY ACCESSIBLE BY ADMIN ONLY */}
                {isAdmin(enrollmentData) && portalMode === 'admin' ? (
                  <AdminDashboard
                    currentUser={enrollmentData}
                    onLogout={handleReset}
                    onSwitchToReviewee={handleSwitchToReviewee}
                    onSwitchToStaff={handleSwitchToStaff}
                  />
                ) : (isAdmin(enrollmentData) || isStaff(enrollmentData)) && portalMode === 'staff' ? (
                  /* 2. STAFF DASHBOARD: ACCESSIBLE BY STAFF (AND ADMIN PREVIEW) */
                  <StaffDashboard
                    currentUser={enrollmentData}
                    onLogout={handleReset}
                    onSwitchToReviewee={handleSwitchToReviewee}
                    onSwitchToAdmin={isAdmin(enrollmentData) ? handleSwitchToAdmin : undefined}
                  />
                ) : (
                  /* 3. REVIEWEE DASHBOARD: FOR REVIEWEE STUDENTS ONLY */
                  <RevieweePortal
                    data={enrollmentData}
                    onLogout={handleReset}
                    onSwitchToAdmin={isAdmin(enrollmentData) ? handleSwitchToAdmin : undefined}
                    onSwitchToStaff={isStaff(enrollmentData) ? handleSwitchToStaff : undefined}
                  />
                )}
              </div>
            )}
          </div>
        </main>

        {/* Footer copyright */}
        {view !== 'portal' && (
          <footer className="py-6 border-t border-slate-100 text-center text-slate-400 text-[11px] font-medium bg-white/40 space-y-1">
            <p>Developed by Ariel O. Pesalver, RCrim, MSCJ</p>
            <p>© {new Date().getFullYear()} SRC Registration Form. All rights reserved.</p>
          </footer>
        )}
      </div>
    </div>
  );
}

