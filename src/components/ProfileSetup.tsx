import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap,
  MapPin,
  Loader2,
  User,
  ChevronDown,
  Check,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  UserCheck,
  CheckCircle2,
  Info,
  Mail,
  ExternalLink,
  Copy,
  PartyPopper,
  Home,
  BarChart3,
  TrendingUp,
  ChevronRight,
  Sparkles,
  Clock,
  Menu,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { linkOrCreateUserRecord, findMatchingUnlinkedCandidates } from '../utils/idGenerator';
import { auth, logout } from '../utils/auth';
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import { PortalLoading } from './PortalLoading';
import { getFriendlyErrorMessage, FriendlyError } from '../utils/getFriendlyErrorMessage';
import { maskEmail } from '../utils/stringUtils';
import { GmailIcon } from './GmailIcon';

const DEFAULT_SCHOOLS = [
  "CHRIST THE KING COLLEGE DE MARANDING, INC.",
  "LANAO SCHOOL OF SCIENCE AND TECHNOLOGY, INC.",
  "NORTH CENTRAL MINDANAO COLLEGE",
  "PHILIPPINE COLLEGE OF CRIMINOLOGY",
  "UNIVERSITY OF THE CORDILLERAS",
  "UNIVERSITY OF MANILA",
  "CAGAYAN DE ORO COLLEGE",
  "MISAMIS UNIVERSITY",
  "UNIVERSITY OF MINDANAO",
  "HOLY CROSS OF DAVAO COLLEGE",
  "WESTERN MINDANAO STATE UNIVERSITY",
  "BICOL UNIVERSITY",
  "BULACAN STATE UNIVERSITY",
  "CAVITE STATE UNIVERSITY",
  "CENTRAL LUZON STATE UNIVERSITY",
  "LAGUNA STATE POLYTECHNIC UNIVERSITY",
  "PANGASINAN STATE UNIVERSITY",
  "TARLAC STATE UNIVERSITY",
  "UNIVERSITY OF NORTHERN PHILIPPINES",
  "VISAYAS STATE UNIVERSITY",
  "WEST VISAYAS STATE UNIVERSITY",
  "ZAMBOANGA STATE COLLEGE OF MARINE SCIENCES AND TECHNOLOGY",
  "SAINT JOHN THE BAPTIST COLLEGE",
  "SAINT MICHAEL'S COLLEGE",
  "ILIGAN MEDICAL CENTER COLLEGE",
  "ILIGAN CAPITOL COLLEGE",
  "MINDANAO STATE UNIVERSITY",
  "LANAO DEL NORTE AGRICULTURAL COLLEGE",
  "ST. FRANCIS XAVIER ACADEMY",
  "OUR LADY OF PERPETUAL HELP EDUCATION SYSTEM"
];

const DEFAULT_BRANCHES = [
  "Iligan City",
  "Lala / Maranding",
  "Labason",
  "Valencia",
  "Balingasag",
  "Online Review"
];

const GoogleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

interface ProfileSetupProps {
  onCompleted: (data: any) => void;
  initialData?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    schoolName?: string;
    reviewBranch?: string;
    accountStatus?: string;
    seqId?: string;
    seq_id?: string;
    srcId?: string;
  };
}

export function ProfileSetup({ onCompleted, initialData }: ProfileSetupProps) {
  // Step state (1: Connect, 2: Profile, 3: ID, 4: Welcome)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [firstName, setFirstName] = useState(() => (initialData?.firstName ? String(initialData.firstName).toUpperCase() : ''));
  const [middleName, setMiddleName] = useState(() => (initialData?.middleName ? String(initialData.middleName).toUpperCase() : ''));
  const [lastName, setLastName] = useState(() => (initialData?.lastName ? String(initialData.lastName).toUpperCase() : ''));
  
  // Password states (for linking to Google account)
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Check if Firebase Auth user already has password provider linked
  const [hasPasswordLinked, setHasPasswordLinked] = useState<boolean>(() => {
    return Boolean(auth.currentUser?.providerData?.some((p) => p.providerId === 'password'));
  });

  // Searchable School State
  const [schoolInput, setSchoolInput] = useState(initialData?.schoolName || '');
  const [selectedSchool, setSelectedSchool] = useState(initialData?.schoolName || '');
  const [schoolSuggestions, setSchoolSuggestions] = useState<string[]>([]);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);

  // Searchable Branch State
  const [branchInput, setBranchInput] = useState(initialData?.reviewBranch || '');
  const [selectedBranch, setSelectedBranch] = useState(initialData?.reviewBranch || '');
  const [branchSuggestions, setBranchSuggestions] = useState<string[]>([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  // Track initialization to avoid ever resetting user inputs during typing or deletion
  const initializedRef = useRef(false);

  // Saved record from step 2 submission
  const [savedUserData, setSavedUserData] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  // Match candidate state for "Is this you?" flow
  const [matchCandidate, setMatchCandidate] = useState<any | null>(null);
  const [checkingMatch, setCheckingMatch] = useState(false);
  const [userMatchChoice, setUserMatchChoice] = useState<'pending' | 'yes' | 'no'>('pending');

  const userEmail = auth.currentUser?.email || initialData?.email || 'reviewee@gmail.com';

  // Password Requirements Checker (matching Create Account)
  const passwordRequirements = useMemo(() => {
    const value = password;
    return [
      { text: "At least 8 characters", met: value.length >= 8 },
      { text: "At least one uppercase letter", met: /[A-Z]/.test(value) },
      { text: "At least one lowercase letter", met: /[a-z]/.test(value) },
      { text: "At least one number", met: /[0-9]/.test(value) },
      { text: "At least one special character", met: /[^A-Za-z0-9]/.test(value) },
      { text: "Passwords match", met: value !== "" && value === confirmPassword },
    ];
  }, [password, confirmPassword]);

  const allRequirementsMet = useMemo(
    () => passwordRequirements.every((req) => req.met),
    [passwordRequirements]
  );

  // Re-check provider linked status if auth state changes
  useEffect(() => {
    if (auth.currentUser) {
      const isLinked = auth.currentUser.providerData?.some((p) => p.providerId === 'password');
      setHasPasswordLinked(Boolean(isLinked));
    }
  }, []);

  // Search for matching unlinked records when First Name & Last Name are provided
  useEffect(() => {
    if (!firstName.trim() || !lastName.trim() || firstName.trim().length < 2 || lastName.trim().length < 2) {
      setMatchCandidate(null);
      setUserMatchChoice('pending');
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingMatch(true);
      try {
        const candidates = await findMatchingUnlinkedCandidates(firstName.trim(), lastName.trim());
        if (candidates && candidates.length > 0) {
          setMatchCandidate(candidates[0]);
          setUserMatchChoice('pending');
        } else {
          setMatchCandidate(null);
          setUserMatchChoice('pending');
        }
      } catch (err) {
        console.warn("Candidate match check error:", err);
      } finally {
        setCheckingMatch(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [firstName, lastName]);

  // Seed initialData only ONCE on mount if initialData was loaded asynchronously
  useEffect(() => {
    if (initializedRef.current) return;
    if (initialData) {
      initializedRef.current = true;
      if (initialData.firstName) setFirstName(String(initialData.firstName).toUpperCase());
      if (initialData.middleName) setMiddleName(String(initialData.middleName).toUpperCase());
      if (initialData.lastName) setLastName(String(initialData.lastName).toUpperCase());
      if (initialData.schoolName) {
        setSelectedSchool(initialData.schoolName);
        setSchoolInput(initialData.schoolName);
      }
      if (initialData.reviewBranch) {
        setSelectedBranch(initialData.reviewBranch);
        setBranchInput(initialData.reviewBranch);
      }
    }
  }, [initialData]);

  // Fetch school list suggestions on mount or from API
  useEffect(() => {
    fetch('/api/schools')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && data.schools) {
          const merged = Array.from(new Set([...DEFAULT_SCHOOLS, ...data.schools]));
          setSchoolSuggestions(merged);
        } else {
          setSchoolSuggestions(DEFAULT_SCHOOLS);
        }
      })
      .catch(() => {
        setSchoolSuggestions(DEFAULT_SCHOOLS);
      });

    setBranchSuggestions(DEFAULT_BRANCHES);
  }, []);

  // Filter school suggestions
  const filteredSchools = schoolInput.trim() === '' 
    ? schoolSuggestions 
    : schoolSuggestions.filter(s => s.toLowerCase().includes(schoolInput.toLowerCase()));

  // Filter branch suggestions
  const filteredBranches = branchInput.trim() === ''
    ? branchSuggestions
    : branchSuggestions.filter(b => b.toLowerCase().includes(branchInput.toLowerCase()));

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if (!firstName.trim() || !lastName.trim()) {
      setError({ title: "Incomplete Fields", message: "Please fill out your First Name and Last Name." });
      return;
    }

    const finalSchool = selectedSchool || schoolInput.trim();
    if (!finalSchool) {
      setError({ title: "School Required", message: "Please select or enter your School / University." });
      return;
    }

    const finalBranch = selectedBranch || branchInput.trim();
    if (!finalBranch) {
      setError({ title: "Review Branch Required", message: "Please select or enter your Review Branch." });
      return;
    }

    // Validate password if user hasn't already linked a password
    if (!hasPasswordLinked) {
      if (!allRequirementsMet) {
        setError({
          title: "Password Requirements",
          message: "Please ensure all password requirements are satisfied before proceeding."
        });
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated user found.");
      }

      // 1. Link email/password credential to this SAME Google Firebase Auth user
      if (!hasPasswordLinked && password) {
        try {
          const emailForAuth = user.email || initialData?.email || userEmail;
          const credential = EmailAuthProvider.credential(emailForAuth, password);
          await linkWithCredential(user, credential);
          setHasPasswordLinked(true);
        } catch (linkErr: any) {
          console.warn("Password link result:", linkErr);
          if (linkErr?.code === 'auth/provider-already-linked') {
            setHasPasswordLinked(true);
          } else if (linkErr?.code === 'auth/credential-already-in-use') {
            // Credential already belongs to this or another account
          } else {
            throw linkErr;
          }
        }
      }

      // 2. Link or create user record in Firestore (NEVER writing password to Firestore)
      const res = await linkOrCreateUserRecord(
        user.uid,
        user.email || initialData?.email || "",
        firstName.trim(),
        middleName.trim(),
        lastName.trim(),
        finalSchool,
        finalBranch,
        userMatchChoice === 'yes' ? matchCandidate : null,
        userMatchChoice === 'no',
        'google'
      );

      setSavedUserData(res);
      // Advance to Step 3 (Reviewee ID Confirmation)
      setCurrentStep(3);
    } catch (err: any) {
      console.error("Profile Setup Error:", err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = () => {
    const idToCopy = savedUserData?.seqId || savedUserData?.seq_id || savedUserData?.srcId || 'SRC ID';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(idToCopy);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  };

  const handleFinishOnboarding = () => {
    onCompleted(savedUserData || { email: userEmail });
  };

  const stepsList = [
    { number: 1, label: 'Connect' },
    { number: 2, label: 'Profile' },
    { number: 3, label: 'ID' },
    { number: 4, label: 'Welcome' },
  ];

  return (
    <>
      {loading && (
        <PortalLoading message="Activating Account…" subMessage="Please wait, Future RCrim." status="Activating Account…" />
      )}

      <div className="min-h-screen bg-slate-50/60 flex flex-col items-center justify-start p-3 sm:p-6 w-full">
        {/* Main Card Container with Mobile Frame Look */}
        <div className="bg-white border border-slate-200/90 rounded-[2rem] shadow-xl max-w-md w-full overflow-hidden flex flex-col my-auto transition-all">
          
          {/* Header Bar */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-black text-[#007C89] text-xl tracking-tight">SRC</span>
              <span className="text-slate-300">|</span>
              <span className="text-xs font-bold text-slate-800 tracking-tight leading-tight">
                Samaritan<br />Review Center
              </span>
            </div>
            
            <button
              type="button"
              onClick={async () => {
                try {
                  await logout();
                } catch (e) {
                  console.error(e);
                }
              }}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Stepper Bar */}
          <div className="px-6 py-4 bg-white border-b border-slate-100">
            <div className="relative flex justify-between items-center max-w-xs mx-auto">
              <div className="absolute left-0 top-3.5 w-full h-[2px] bg-slate-100 -z-0"></div>
              <div
                className="absolute left-0 top-3.5 h-[2px] bg-[#007b83] -z-0 transition-all duration-300"
                style={{
                  width:
                    currentStep === 1 ? '0%' :
                    currentStep === 2 ? '33.3%' :
                    currentStep === 3 ? '66.6%' : '100%',
                }}
              ></div>

              {stepsList.map((s) => {
                const isActive = currentStep === s.number;
                const isCompleted = currentStep > s.number;

                return (
                  <div key={s.number} className="flex flex-col items-center gap-1.5 bg-white px-1.5 relative z-10">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-[#007b83] text-white shadow-sm'
                          : isCompleted
                          ? 'bg-teal-50 text-[#007b83] border border-teal-200 font-bold'
                          : 'bg-slate-50 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {s.number}
                    </div>
                    <span
                      className={`text-[10px] transition-colors ${
                        isActive
                          ? 'text-[#007b83] font-bold'
                          : isCompleted
                          ? 'text-[#007b83] font-medium'
                          : 'text-slate-400 font-medium'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error Callout */}
          {error && (
            <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-red-800">{error.title}</p>
                <p className="text-[11px] text-red-700 leading-tight mt-0.5">{error.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-xs text-red-400 hover:text-red-600 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Step Contents */}
          <div className="p-6 flex-1 flex flex-col justify-between">
            {/* STEP 1: CONNECT ACCOUNT */}
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center text-center space-y-5 my-auto py-2"
              >
                {/* Green Check Icon Circle */}
                <div className="w-16 h-16 rounded-full bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
                  <Check className="w-8 h-8" strokeWidth={3} />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Google account<br />connected
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-xs leading-relaxed">
                    Complete your reviewee profile to access your scores.
                  </p>
                </div>

                {/* Pending Profile Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-200/80 text-amber-900 text-xs font-bold shadow-xs">
                  <Clock size={13} className="text-amber-700" />
                  <span>Pending Profile</span>
                </div>

                {/* Signed-in Account Card */}
                <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 text-left">
                  <div className="p-2 bg-white rounded-xl border border-slate-200/80 shadow-xs shrink-0">
                    <GoogleIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signed in as</p>
                    <p className="text-xs sm:text-sm font-black text-slate-800 truncate" title={userEmail}>
                      {userEmail}
                    </p>
                  </div>
                </div>

                {/* Continue Setup Button */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-full py-3.5 bg-[#007C89] hover:bg-[#006873] active:scale-[0.99] text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-4"
                >
                  <span>Continue setup</span>
                  <ArrowRight size={16} />
                </button>
              </motion.div>
            )}

            {/* STEP 2: COMPLETE PROFILE */}
            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Complete your profile
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Provide your details to complete your reviewee account.
                  </p>
                </div>

                <form onSubmit={handleStep2Submit} className="space-y-3.5">
                  {/* First Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      First Name <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ENTER YOUR FIRST NAME"
                      value={firstName}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => setFirstName(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-[#007C89] rounded-xl text-xs sm:text-sm font-semibold uppercase tracking-wide transition-all outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-900"
                    />
                  </div>

                  {/* Middle Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Middle Name <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ENTER YOUR MIDDLE NAME"
                      value={middleName}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => setMiddleName(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-[#007C89] rounded-xl text-xs sm:text-sm font-semibold uppercase tracking-wide transition-all outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-900"
                    />
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      Last Name <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ENTER YOUR LAST NAME"
                      value={lastName}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => setLastName(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-[#007C89] rounded-xl text-xs sm:text-sm font-semibold uppercase tracking-wide transition-all outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-900"
                    />
                  </div>

                  {/* Candidate Match Alert (if existing records detected) */}
                  <AnimatePresence>
                    {matchCandidate && userMatchChoice === 'pending' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-3.5 shadow-md space-y-2.5 my-2"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="bg-amber-500 text-white p-1.5 rounded-lg shrink-0 mt-0.5">
                            <UserCheck size={16} />
                          </div>
                          <div className="space-y-1 flex-1 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full">
                              Existing Record Found
                            </span>
                            <p className="text-xs text-amber-950 font-bold">
                              Found ID <span className="font-mono text-amber-800 font-black">{matchCandidate.seq_id || matchCandidate.seqId || matchCandidate.srcId}</span> for:
                            </p>
                            <p className="text-xs font-bold text-amber-900">
                              {(matchCandidate.first_name || matchCandidate.firstName || "").toUpperCase()} {(matchCandidate.last_name || matchCandidate.lastName || "").toUpperCase()}
                            </p>
                            <p className="text-[11px] text-amber-800 font-medium">
                              {matchCandidate.school_name || matchCandidate.schoolName || ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-amber-200">
                          <button
                            type="button"
                            onClick={() => {
                              setUserMatchChoice('yes');
                              if (matchCandidate.school_name || matchCandidate.schoolName) {
                                const sc = matchCandidate.school_name || matchCandidate.schoolName;
                                setSelectedSchool(sc);
                                setSchoolInput(sc);
                              }
                              if (matchCandidate.review_branch || matchCandidate.reviewBranch) {
                                const br = matchCandidate.review_branch || matchCandidate.reviewBranch;
                                setSelectedBranch(br);
                                setBranchInput(br);
                              }
                            }}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black py-2 px-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 size={13} />
                            <span>Yes, link this ID</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserMatchChoice('no')}
                            className="bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold py-2 px-3 rounded-xl border border-slate-300 transition-all cursor-pointer"
                          >
                            Create new ID
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {matchCandidate && userMatchChoice === 'yes' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-900 font-bold"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          <span className="truncate">Linking to ID: <strong className="font-mono">{matchCandidate.seq_id || matchCandidate.seqId || matchCandidate.srcId}</strong></span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUserMatchChoice('pending')}
                          className="text-[10px] text-emerald-700 underline font-bold shrink-0 ml-2"
                        >
                          Change
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* School / University Dropdown */}
                  <div className="space-y-1 relative">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      School / University <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Select your school / university"
                        value={selectedSchool ? selectedSchool : schoolInput}
                        onChange={(e) => {
                          setSelectedSchool('');
                          setSchoolInput(e.target.value);
                          setShowSchoolDropdown(true);
                        }}
                        onFocus={() => setShowSchoolDropdown(true)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-[#007C89] rounded-xl text-xs sm:text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-teal-500/20 pr-8 text-slate-900 truncate"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSchoolDropdown(!showSchoolDropdown)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <ChevronDown size={15} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {showSchoolDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
                        >
                          {filteredSchools.length > 0 ? (
                            filteredSchools.map((school, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSelectedSchool(school);
                                  setSchoolInput('');
                                  setShowSchoolDropdown(false);
                                }}
                                className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                              >
                                <span className="truncate pr-2">{school}</span>
                                {selectedSchool === school && <Check size={13} className="text-[#007C89] shrink-0" />}
                              </button>
                            ))
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowSchoolDropdown(false)}
                              className="w-full px-3 py-2.5 text-left text-xs text-slate-500 italic"
                            >
                              No exact match. Your custom entry will be saved.
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Review Branch Dropdown */}
                  <div className="space-y-1 relative">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      Review Branch <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Select review branch"
                        value={selectedBranch ? selectedBranch : branchInput}
                        onChange={(e) => {
                          setSelectedBranch('');
                          setBranchInput(e.target.value);
                          setShowBranchDropdown(true);
                        }}
                        onFocus={() => setShowBranchDropdown(true)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-[#007C89] rounded-xl text-xs sm:text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-teal-500/20 pr-8 text-slate-900 truncate"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <ChevronDown size={15} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {showBranchDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute z-45 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
                        >
                          {filteredBranches.length > 0 ? (
                            filteredBranches.map((branch, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSelectedBranch(branch);
                                  setBranchInput('');
                                  setShowBranchDropdown(false);
                                }}
                                className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                              >
                                <span>{branch}</span>
                                {selectedBranch === branch && <Check size={13} className="text-[#007C89]" />}
                              </button>
                            ))
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowBranchDropdown(false)}
                              className="w-full px-3 py-2 text-left text-xs text-slate-500 italic"
                            >
                              Custom branch will be saved.
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Password & Confirm Password Section (Required if user has not yet linked a password) */}
                  {!hasPasswordLinked ? (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Lock size={14} className="text-[#007C89]" />
                        <span>Set Account Password</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Set a secure password so you can also log in directly using your email address.
                      </p>

                      {/* Password Field */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          Password <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            placeholder="Create a password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-[#007C89] rounded-xl text-xs sm:text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-teal-500/20 pr-10 text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password Field */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          Confirm Password <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-[#007C89] rounded-xl text-xs sm:text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-teal-500/20 pr-10 text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      {/* Password Requirements List */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Password Requirements:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                          {passwordRequirements.map((req, index) => (
                            <div
                              key={index}
                              className={`flex items-center gap-1.5 ${
                                req.met ? "text-emerald-700 font-semibold" : "text-slate-400"
                              }`}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                                  req.met ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-transparent"
                                }`}
                              >
                                <Check size={10} strokeWidth={3} />
                              </span>
                              <span className="truncate">{req.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                      <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                      <span>Password credentials already linked to this account.</span>
                    </div>
                  )}

                  {/* Required Info Notice */}
                  <div className="bg-sky-50/80 border border-sky-200/80 rounded-xl p-2.5 flex items-center gap-2 text-sky-800 text-xs font-medium">
                    <Info size={14} className="text-sky-600 shrink-0" />
                    <span>Required details cannot be skipped.</span>
                  </div>

                  {/* Bottom Controls (Back and Next) */}
                  <div className="flex items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft size={15} />
                      <span>Back</span>
                    </button>

                    <button
                      type="submit"
                      disabled={loading || (!hasPasswordLinked && !allRequirementsMet)}
                      className="flex-1 py-3 bg-[#007C89] hover:bg-[#006873] active:scale-[0.99] text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Saving…</span>
                        </>
                      ) : (
                        <>
                          <span>Next</span>
                          <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* STEP 3: REVIEWEE ID (Account Active) */}
            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center text-center space-y-5 my-auto py-2"
              >
                {/* Celebratory Icon */}
                <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[#007C89] shadow-sm">
                  <PartyPopper className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Reviewee account<br />active
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-xs leading-relaxed">
                    Your reviewee account has been successfully set up!
                  </p>
                </div>

                {/* ID Display Card with Copy Feature */}
                <div className="w-full bg-teal-50/50 border border-teal-200/90 rounded-2xl p-5 space-y-1.5 shadow-xs">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Your Reviewee ID
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-2xl sm:text-3xl font-black text-[#007C89] tracking-wider">
                      {savedUserData?.seqId || savedUserData?.seq_id || savedUserData?.srcId || 'SRC ID'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="p-1.5 rounded-lg hover:bg-teal-100 text-[#007C89] transition-colors cursor-pointer"
                      title={copiedId ? "Copied!" : "Copy Reviewee ID"}
                    >
                      {copiedId ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                    </button>
                  </div>
                  {copiedId && (
                    <p className="text-[10px] font-bold text-emerald-600 animate-fade-in">
                      Copied to clipboard!
                    </p>
                  )}
                </div>

                <p className="text-xs text-slate-600 font-medium">
                  Your scores are now linked to your account.
                </p>

                {/* Continue to Welcome Button */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="w-full py-3.5 bg-[#007C89] hover:bg-[#006873] active:scale-[0.99] text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-4"
                >
                  <span>Continue</span>
                  <ArrowRight size={16} />
                </button>
              </motion.div>
            )}

            {/* STEP 4: WELCOME (Guide to Portal) */}
            {currentStep === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[#007C89] shadow-sm">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Welcome to your<br />Reviewee Portal
                  </h2>
                  <p className="text-xs text-slate-500 max-w-xs">
                    You're all set! Here are some things you can do in your portal.
                  </p>
                </div>

                {/* Guide Cards */}
                <div className="space-y-2.5 pt-1">
                  {/* Home Card */}
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between hover:border-teal-300 transition-colors shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#007C89] shrink-0">
                        <Home size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Home</p>
                        <p className="text-[11px] text-slate-500">View your progress</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>

                  {/* Scores Card */}
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between hover:border-teal-300 transition-colors shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#007C89] shrink-0">
                        <BarChart3 size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Scores</p>
                        <p className="text-[11px] text-slate-500">See examination results</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>

                  {/* Profile Card */}
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between hover:border-teal-300 transition-colors shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#007C89] shrink-0">
                        <User size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Profile</p>
                        <p className="text-[11px] text-slate-500">Update your details</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </div>

                {/* Bottom Actions: Open Portal & Skip Guide */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleFinishOnboarding}
                    className="w-full py-3.5 bg-[#007C89] hover:bg-[#006873] active:scale-[0.99] text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Open Portal</span>
                    <ArrowRight size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishOnboarding}
                    className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-all flex items-center justify-center cursor-pointer"
                  >
                    Skip guide
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
