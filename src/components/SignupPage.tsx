import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, Lock, Eye, EyeOff, Loader2, GraduationCap, MapPin, ChevronDown, Check, ArrowRight, ArrowLeft, Sun, Moon, UserCheck, CheckCircle2, Info, ExternalLink, ShieldCheck } from 'lucide-react';
import { auth, googleSignIn } from '../utils/auth';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { linkOrCreateUserRecord, findMatchingUnlinkedCandidates } from '../utils/idGenerator';
import { PortalLoading } from './PortalLoading';
import { normalizeEmail, maskEmail } from '../utils/stringUtils';
import { GmailIcon } from './GmailIcon';
import { openGmailApp } from '../utils/emailAppLauncher';

const GoogleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    xmlSpace="preserve"
    overflow="hidden"
    viewBox="0 0 268.152 273.883"
    className={className}
  >
    <defs>
      <linearGradient id="a">
        <stop offset="0" stopColor="#0fbc5c" />
        <stop offset="1" stopColor="#0cba65" />
      </linearGradient>
      <linearGradient id="g">
        <stop offset=".231" stopColor="#0fbc5f" />
        <stop offset=".312" stopColor="#0fbc5f" />
        <stop offset=".366" stopColor="#0fbc5e" />
        <stop offset=".458" stopColor="#0fbc5d" />
        <stop offset=".54" stopColor="#12bc58" />
        <stop offset=".699" stopColor="#28bf3c" />
        <stop offset=".771" stopColor="#38c02b" />
        <stop offset=".861" stopColor="#52c218" />
        <stop offset=".915" stopColor="#67c30f" />
        <stop offset="1" stopColor="#86c504" />
      </linearGradient>
      <linearGradient id="h">
        <stop offset=".142" stopColor="#1abd4d" />
        <stop offset=".248" stopColor="#6ec30d" />
        <stop offset=".312" stopColor="#8ac502" />
        <stop offset=".366" stopColor="#a2c600" />
        <stop offset=".446" stopColor="#c8c903" />
        <stop offset=".54" stopColor="#ebcb03" />
        <stop offset=".616" stopColor="#f7cd07" />
        <stop offset=".699" stopColor="#fdcd04" />
        <stop offset=".771" stopColor="#fdce05" />
        <stop offset=".861" stopColor="#ffce0a" />
      </linearGradient>
      <linearGradient id="f">
        <stop offset=".316" stopColor="#ff4c3c" />
        <stop offset=".604" stopColor="#ff692c" />
        <stop offset=".727" stopColor="#ff7825" />
        <stop offset=".885" stopColor="#ff8d1b" />
        <stop offset="1" stopColor="#ff9f13" />
      </linearGradient>
      <linearGradient id="b">
        <stop offset=".231" stopColor="#ff4541" />
        <stop offset=".312" stopColor="#ff4540" />
        <stop offset=".458" stopColor="#ff4640" />
        <stop offset=".54" stopColor="#ff473f" />
        <stop offset=".699" stopColor="#ff5138" />
        <stop offset=".771" stopColor="#ff5b33" />
        <stop offset=".861" stopColor="#ff6c29" />
        <stop offset="1" stopColor="#ff8c18" />
      </linearGradient>
      <linearGradient id="d">
        <stop offset=".408" stopColor="#fb4e5a" />
        <stop offset="1" stopColor="#ff4540" />
      </linearGradient>
      <linearGradient id="c">
        <stop offset=".132" stopColor="#0cba65" />
        <stop offset=".21" stopColor="#0bb86d" />
        <stop offset=".297" stopColor="#09b479" />
        <stop offset=".396" stopColor="#08ad93" />
        <stop offset=".477" stopColor="#0aa6a9" />
        <stop offset=".568" stopColor="#0d9cc6" />
        <stop offset=".667" stopColor="#1893dd" />
        <stop offset=".769" stopColor="#258bf1" />
        <stop offset=".859" stopColor="#3086ff" />
      </linearGradient>
      <linearGradient id="e">
        <stop offset=".366" stopColor="#ff4e3a" />
        <stop offset=".458" stopColor="#ff8a1b" />
        <stop offset=".54" stopColor="#ffa312" />
        <stop offset=".616" stopColor="#ffb60c" />
        <stop offset=".771" stopColor="#ffcd0a" />
        <stop offset=".861" stopColor="#fecf0a" />
        <stop offset=".915" stopColor="#fecf08" />
        <stop offset="1" stopColor="#fdcd01" />
      </linearGradient>
      <linearGradient xlinkHref="#a" id="s" x1="219.7" x2="254.467" y1="329.535" y2="329.535" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#b" id="m" cx="109.627" cy="135.862" r="71.46" fx="109.627" fy="135.862" gradientTransform="matrix(-1.93688 1.043 1.45573 2.55542 290.525 -400.634)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#c" id="n" cx="45.259" cy="279.274" r="71.46" fx="45.259" fy="279.274" gradientTransform="matrix(-3.5126 -4.45809 -1.69255 1.26062 870.8 191.554)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#d" id="l" cx="304.017" cy="118.009" r="47.854" fx="304.017" fy="118.009" gradientTransform="matrix(2.06435 0 0 2.59204 -297.679 -151.747)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#e" id="o" cx="181.001" cy="177.201" r="71.46" fx="181.001" fy="177.201" gradientTransform="matrix(-.24858 2.08314 2.96249 .33417 -255.146 -331.164)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#p" id="p-grad" cx="207.673" cy="108.097" r="41.102" fx="207.673" fy="108.097" gradientTransform="matrix(-1.2492 1.34326 -3.89684 -3.4257 880.501 194.905)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#g" id="r" cx="109.627" cy="135.862" r="71.46" fx="109.627" fy="135.862" gradientTransform="matrix(-1.93688 -1.043 1.45573 -2.55542 290.525 838.683)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#h" id="j" cx="154.87" cy="145.969" r="71.46" fx="154.87" fy="145.969" gradientTransform="matrix(-.0814 -1.93722 2.92674 -.11625 -215.135 632.86)" gradientUnits="userSpaceOnUse" />
      <filter id="q" width="1.097" height="1.116" x="-.048" y="-.058" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation="1.701" />
      </filter>
      <filter id="k" width="1.033" height="1.02" x="-.017" y="-.01" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation=".242" />
      </filter>
      <clipPath id="i" clipPathUnits="userSpaceOnUse">
        <path d="M371.378 193.24H237.083v53.438h77.167c-1.241 7.563-4.026 15.003-8.105 21.786-4.674 7.773-10.451 13.69-16.373 18.196-17.74 13.498-38.42 16.258-52.783 16.258-36.283 0-67.283-23.286-79.285-54.928-.484-1.149-.805-2.335-1.197-3.507a81.115 81.115 0 0 1-4.101-25.448c0-9.226 1.569-18.057 4.43-26.398 11.285-32.897 42.985-57.467 80.179-57.467 7.481 0 14.685.884 21.517 2.648a77.668 77.668 0 0 1 33.425 18.25l40.834-39.712c-24.839-22.616-57.219-36.32-95.844-36.32-30.878 0-59.386 9.553-82.748 25.7-18.945 13.093-34.483 30.625-44.97 50.985-9.753 18.879-15.094 39.8-15.094 62.294 0 22.495 5.35 43.633 15.103 62.337v.126c10.302 19.857 25.368 36.954 43.678 49.988 15.997 11.386 44.68 26.551 84.031 26.551 22.63 0 42.687-4.051 60.375-11.644 12.76-5.478 24.065-12.622 34.301-21.804 13.525-12.132 24.117-27.139 31.347-44.404 7.23-17.265 11.097-36.79 11.097-57.957 0-9.858-.998-19.87-2.689-28.968Z" />
      </clipPath>
    </defs>
    <g clipPath="url(#i)" transform="matrix(.95792 0 0 .98525 -90.174 -78.856)">
      <path fill="url(#j)" d="M92.076 219.958c.148 22.14 6.501 44.983 16.117 63.424v.127c6.949 13.392 16.445 23.97 27.26 34.452l65.327-23.67c-12.36-6.235-14.246-10.055-23.105-17.026-9.054-9.066-15.802-19.473-20.004-31.677h-.17l.17-.127c-2.765-8.058-3.037-16.613-3.14-25.503Z" filter="url(#k)" />
      <path fill="url(#l)" d="M237.083 79.025c-6.456 22.526-3.988 44.421 0 57.161 7.457.006 14.64.888 21.45 2.647a77.662 77.662 0 0 1 33.424 18.25l41.88-40.726c-24.81-22.59-54.667-37.297-96.754-37.332Z" filter="url(#k)" />
      <path fill="url(#m)" d="M236.943 78.847c-31.67 0-60.91 9.798-84.871 26.359a145.533 145.533 0 0 0-24.332 21.15c-1.904 17.744 14.257 39.551 46.262 39.37 15.528-17.936 38.495-29.542 64.056-29.542l.07.002-1.044-57.335c-.048 0-.093-.004-.14-.004Z" filter="url(#k)" />
      <path fill="url(#n)" d="m341.475 226.379-28.268 19.285c-1.24 7.562-4.028 15.002-8.107 21.786-4.674 7.772-10.45 13.69-16.373 18.196-17.702 13.47-38.328 16.244-52.687 16.255-14.842 25.102-17.444 37.675 1.043 57.934 22.877-.016 43.157-4.117 61.046-11.796 12.931-5.551 24.388-12.792 34.761-22.097 13.706-12.295 24.442-27.503 31.769-45 7.327-17.497 11.245-37.282 11.245-58.734Z" filter="url(#k)" />
      <path fill="#3086ff" d="M234.996 191.21v57.498h136.006c1.196-7.874 5.152-18.064 5.152-26.5 0-9.858-.996-21.899-2.687-30.998Z" filter="url(#k)" />
      <path fill="url(#o)" d="M128.39 124.327c-8.394 9.119-15.564 19.326-21.249 30.364-9.753 18.879-15.094 41.83-15.094 64.324 0 .317.026.627.029.944 4.32 8.224 59.666 6.649 62.456 0-.004-.31-.039-.613-.039-.924 0-9.226 1.57-16.026 4.43-24.367 3.53-10.289 9.056-19.763 16.123-27.926 1.602-2.031 5.875-6.397 7.121-9.016.475-.997-.862-1.557-.937-1.908-.083-.393-1.876-.077-2.277-.37-1.275-.929-3.8-1.414-5.334-1.845-3.277-.921-8.708-2.953-11.725-5.06-9.536-6.658-24.417-14.612-33.505-24.216Z" filter="url(#k)" />
      <path fill="url(#p-grad)" d="M162.099 155.857c22.112 13.301 28.471-6.714 43.173-12.977l-25.574-52.664a144.74 144.74 0 0 0-26.543 14.504c-12.316 8.512-23.192 18.9-32.176 30.72Z" filter="url(#q)" />
      <path fill="url(#r)" d="M171.099 290.222c-29.683 10.641-34.33 11.023-37.062 29.29a144.806 144.806 0 0 0 16.792 13.984c15.996 11.386 46.766 26.551 86.118 26.551.046 0 .09-.004.137-.004v-59.157l-.094.002c-14.736 0-26.512-3.843-38.585-10.527-2.977-1.648-8.378 2.777-11.123.799-3.786-2.729-12.9 2.35-16.183-.938Z" filter="url(#k)" />
      <path fill="url(#s)" d="M219.7 299.023v59.996c5.506.64 11.236 1.028 17.247 1.028 6.026 0 11.855-.307 17.52-.872v-59.748a105.119 105.119 0 0 1-17.477 1.461c-5.932 0-11.7-.686-17.29-1.865Z" filter="url(#k)" opacity=".5" />
    </g>
  </svg>
);

const LOGO_URL = '/logo.svg';

const labelBase =
  "text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5";

const inputBase =
  "w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-bold outline-none focus:border-[#00B8A9] text-xs transition-all placeholder:text-[10px] placeholder:font-normal";

const pillButton =
  "w-full bg-gradient-to-r from-[#0057FF] via-[#00B8A9] to-[#22C55E] hover:brightness-110 text-white py-3 lg:py-4 rounded-full font-bold text-xs lg:text-sm uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:translate-y-[-2px] active:scale-[0.98] flex items-center justify-center gap-2";

const googleButton =
  "w-full rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-3 lg:py-4 text-xs lg:text-sm font-black uppercase tracking-widest text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-sm cursor-pointer disabled:opacity-50";

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

interface SignupPageProps {
  onSuccess: (user: any, linkResult: any) => void;
  onToggleLogin: () => void;
}

export function SignupPage({ onSuccess, onToggleLogin }: SignupPageProps) {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  
  // Searchable School State
  const [schoolInput, setSchoolInput] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [schoolSuggestions, setSchoolSuggestions] = useState<string[]>([]);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);

  // Searchable Branch State
  const [branchInput, setBranchInput] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branchSuggestions, setBranchSuggestions] = useState<string[]>([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Multi-step Registration flow state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailDuplicateError, setEmailDuplicateError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Debounced email duplicate check
  useEffect(() => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      setEmailDuplicateError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const res = await fetch(`/api/check-email?email=${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.exists) {
            setEmailDuplicateError("This email address is already registered. Please sign in instead.");
          } else {
            setEmailDuplicateError(null);
          }
        }
      } catch (err) {
        console.warn("Email check error:", err);
      } finally {
        setCheckingEmail(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [email]);

  // Dark/Light Mode state
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
  });

  // Match candidate state for "Is this you?" flow
  const [matchCandidate, setMatchCandidate] = useState<any | null>(null);
  const [checkingMatch, setCheckingMatch] = useState(false);
  const [userMatchChoice, setUserMatchChoice] = useState<'pending' | 'yes' | 'no'>('pending');

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

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleGoogleSignup = async () => {
    if (loading || googleLoading) return;
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await googleSignIn();
      if (res && res.user) {
        onSuccess(res.user, { status: 'active' });
      }
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setError(err?.message || "Google Authentication failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // Fetch school list suggestions on mount or from API
  useEffect(() => {
    fetch('/api/schools')
      .then(res => res.ok ? res.json() : null)
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

  // Password Validation Engine
  const passwordRequirements = useMemo(() => {
    const value = password;

    return [
      {
        text: "At least 8 characters",
        met: value.length >= 8,
      },
      {
        text: "At least one uppercase letter",
        met: /[A-Z]/.test(value),
      },
      {
        text: "At least one lowercase letter",
        met: /[a-z]/.test(value),
      },
      {
        text: "At least one number",
        met: /[0-9]/.test(value),
      },
      {
        text: "At least one special character",
        met: /[^A-Za-z0-9]/.test(value),
      },
      {
        text: "Passwords match",
        met: value !== "" && value === confirmPassword,
      },
    ];
  }, [password, confirmPassword]);

  const allRequirementsMet = useMemo(
    () => passwordRequirements.every((req) => req.met),
    [passwordRequirements]
  );

  const isStep1Valid = useMemo(() => firstName.trim().length >= 2 && lastName.trim().length >= 2, [firstName, lastName]);
  const isStep2Valid = useMemo(() => Boolean((selectedSchool || schoolInput).trim()) && Boolean((selectedBranch || branchInput).trim()), [selectedSchool, schoolInput, selectedBranch, branchInput]);
  const isStep3Valid = useMemo(() => Boolean(email.trim().includes('@') && email.trim().includes('.')) && allRequirementsMet && !emailDuplicateError, [email, allRequirementsMet, emailDuplicateError]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || googleLoading) return;
    setError(null);

    // Inputs Validation
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please fill out your First Name and Last Name.");
      return;
    }

    const finalSchool = selectedSchool || schoolInput.trim();
    if (!finalSchool) {
      setError("Please select or enter your School Name.");
      return;
    }

    const finalBranch = selectedBranch || branchInput.trim();
    if (!finalBranch) {
      setError("Please select or enter your Review Branch.");
      return;
    }

    if (!allRequirementsMet) {
      setError("Please ensure all password requirements are satisfied.");
      return;
    }

    if (emailDuplicateError) {
      setError("This email address is already registered. Please sign in instead.");
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = normalizeEmail(email);

      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // 2. Link or Create database record (handles auto ID / user match choice / score preservation)
      const linkResult = await linkOrCreateUserRecord(
        user.uid,
        cleanEmail,
        firstName.trim(),
        middleName.trim(),
        lastName.trim(),
        finalSchool,
        finalBranch,
        userMatchChoice === 'yes' ? matchCandidate : null,
        userMatchChoice === 'no',
        'manual'
      );

      // 3. Send verification email
      try {
        await sendEmailVerification(user);
      } catch (emailErr) {
        console.warn("Failed to send verification email:", emailErr);
      }

      // Success callback
      onSuccess(user, linkResult);

    } catch (err: any) {
      console.error("Signup Error:", err);
      let errMsg = "An error occurred during account creation.";
      if (err.code === 'auth/email-already-in-use') {
        errMsg = "This email address is already in use.";
      } else if (err.code === 'auth/invalid-email') {
        errMsg = "The email address is badly formatted.";
      } else if (err?.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {(loading || googleLoading) && (
        <PortalLoading message="Waiting to Log In" subMessage="Please wait, Future RCrim." status="Creating your account…" />
      )}
      <div className="max-w-xl w-full bg-white dark:bg-[#0B1220] border border-slate-100 dark:border-slate-800/80 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden space-y-8">
      {/* Dark/Light mode toggle */}
      <button
        type="button"
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1.5 rounded-lg border border-slate-100 dark:border-slate-800/80"
        title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {darkMode ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-3">
        {/* Floating/Bounce Logo animation */}
        <a
          href="https://samaritanreviewcenter.com/student/"
          className="animate-float cursor-pointer hover:scale-105 transition-transform duration-300 block"
          title="Samaritan Review Center"
        >
          <img
            src={LOGO_URL}
            alt="Samaritan Review Center Logo"
            className="w-20 h-20 object-contain pointer-events-none select-none"
          />
        </a>

        <div className="space-y-1">
          <p className="text-[10px] font-bold text-teal-600 dark:text-[#00B8A9] uppercase tracking-widest font-mono font-bold">Welcome to</p>
          <a
            href="https://samaritanreviewcenter.com/student/"
            className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-white uppercase font-display hover:text-teal-600 dark:hover:text-[#00B8A9] transition-colors block"
          >
            Samaritan Review Center
          </a>
          <button
            type="button"
            onClick={onToggleLogin}
            className="text-[11px] font-bold text-teal-600 dark:text-[#00B8A9] hover:underline cursor-pointer"
          >
            Have an account? Sign in
          </button>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 dark:bg-rose-950/30 border-l-4 border-rose-500 text-rose-700 dark:text-rose-300 p-4 rounded-xl text-xs font-semibold"
        >
          {error}
        </motion.div>
      )}

      {/* Google Signup Button */}
      <button
        type="button"
        disabled={googleLoading}
        onClick={handleGoogleSignup}
        className={googleButton}
      >
        {googleLoading ? (
          <Loader2 size={16} className="animate-spin text-teal-600" />
        ) : (
          <GoogleIcon className="w-5 h-5 shrink-0" />
        )}
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center text-slate-300 dark:text-slate-800 text-xs font-bold gap-3">
        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
        <span className="uppercase text-[10px] tracking-wider font-extrabold text-slate-400 dark:text-slate-500">or manual signup</span>
        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
      </div>

      {/* Form */}
      <form onSubmit={handleSignup} className="space-y-5">
        {/* Visual Step-Progress Indicator */}
        <div className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 dark:text-[#00B8A9] bg-teal-50 dark:bg-teal-950/50 px-2.5 py-0.5 rounded-full border border-teal-200/80 dark:border-teal-800">
                  Step {currentStep} of 3
                </span>
                <span className="text-xs font-black text-slate-800 dark:text-white">
                  {currentStep === 1 && "Personal Information"}
                  {currentStep === 2 && "School & Review Branch"}
                  {currentStep === 3 && "Account & Security"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {currentStep === 1 && "Enter your legal full name as registered with Samaritan Review Center"}
                {currentStep === 2 && "Select your college or university and review branch location"}
                {currentStep === 3 && "Set up your email and password credentials for sign in"}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                currentStep === 3
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}>
                {currentStep === 1 && "2 steps left"}
                {currentStep === 2 && "1 step left"}
                {currentStep === 3 && "Final step!"}
              </span>
            </div>
          </div>

          {/* Progress Line */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-teal-500 via-[#00B8A9] to-emerald-500 rounded-full transition-all duration-500 ease-out shadow-xs"
              style={{
                width: currentStep === 1 ? '33.3%' : currentStep === 2 ? '66.6%' : '100%',
              }}
            />
          </div>

          {/* Interactive Stepper Nodes */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { number: 1, label: "Personal", icon: User },
              { number: 2, label: "School", icon: GraduationCap },
              { number: 3, label: "Security", icon: ShieldCheck },
            ].map((s) => {
              const isActive = currentStep === s.number;
              const isCompleted = currentStep > s.number;
              const IconComp = s.icon;

              return (
                <button
                  key={s.number}
                  type="button"
                  onClick={() => {
                    if (s.number < currentStep || (s.number === 2 && isStep1Valid) || (s.number === 3 && isStep1Valid && isStep2Valid)) {
                      setCurrentStep(s.number as 1 | 2 | 3);
                    }
                  }}
                  disabled={s.number > currentStep && ((s.number === 2 && !isStep1Valid) || (s.number === 3 && (!isStep1Valid || !isStep2Valid)))}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 border-teal-500 dark:border-[#00B8A9] shadow-xs ring-2 ring-teal-500/20'
                      : isCompleted
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400'
                      : 'bg-transparent border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-all ${
                      isActive
                        ? 'bg-teal-600 dark:bg-[#00B8A9] text-white'
                        : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isCompleted ? <Check size={12} strokeWidth={3} /> : <IconComp size={12} />}
                  </div>
                  <div className="min-w-0 flex-1 hidden sm:block">
                    <p className={`text-[10px] font-black uppercase tracking-wider truncate ${
                      isActive ? 'text-teal-700 dark:text-[#00B8A9]' : isCompleted ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {s.label}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 1: PERSONAL INFORMATION */}
        {currentStep === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* First Name */}
              <div className="space-y-1">
                <label className={labelBase}>
                  <User size={11} className="text-teal-600 dark:text-[#00B8A9]" /> First Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="ARIEL"
                  value={firstName}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setFirstName(e.target.value.toUpperCase())}
                  className={`${inputBase} uppercase font-semibold`}
                />
              </div>

              {/* Middle Name */}
              <div className="space-y-1">
                <label className={labelBase}>
                  Middle Name <span className="text-slate-400 dark:text-slate-500 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="ORCIA"
                  value={middleName}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setMiddleName(e.target.value.toUpperCase())}
                  className={`${inputBase} uppercase font-semibold`}
                />
              </div>
            </div>

            {/* Last Name */}
            <div className="space-y-1">
              <label className={labelBase}>
                <User size={11} className="text-teal-600 dark:text-[#00B8A9]" /> Last Name
              </label>
              <input
                type="text"
                required
                placeholder="PESALVER"
                value={lastName}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setLastName(e.target.value.toUpperCase())}
                className={`${inputBase} uppercase font-semibold`}
              />
            </div>

            {/* Feedback Alert Prompt for Existing ID Match */}
            <AnimatePresence>
              {matchCandidate && userMatchChoice === 'pending' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -5 }}
                  className="bg-amber-50/90 dark:bg-amber-950/60 border-2 border-amber-400 dark:border-amber-600 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3 my-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-amber-500 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-md">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-200 bg-amber-200/80 dark:bg-amber-900/80 px-2.5 py-0.5 rounded-full">
                          Existing Record Found
                        </span>
                        <span className="text-xs font-mono font-extrabold text-amber-900 dark:text-amber-100 bg-amber-200 dark:bg-amber-900 px-2.5 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700">
                          ID: {matchCandidate.seq_id || matchCandidate.seqId || matchCandidate.srcId || matchCandidate.id_number || "Unassigned"}
                        </span>
                      </div>
                      
                      <p className="text-xs text-amber-950 dark:text-amber-100 font-bold leading-relaxed">
                        An existing profile with ID Number <strong className="font-extrabold text-amber-700 dark:text-amber-300 font-mono underline">{matchCandidate.seq_id || matchCandidate.seqId || matchCandidate.id_number}</strong> was found under:
                      </p>
                      
                      <div className="bg-white/80 dark:bg-amber-900/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 text-xs space-y-0.5">
                        <div className="font-black text-amber-900 dark:text-amber-100">
                          👤 {(matchCandidate.first_name || matchCandidate.firstName || "").toUpperCase()} {(matchCandidate.last_name || matchCandidate.lastName || "").toUpperCase()}
                        </div>
                        {(matchCandidate.school_name || matchCandidate.schoolName) && (
                          <div className="text-[11px] text-amber-800 dark:text-amber-200 font-medium">
                            🏫 {matchCandidate.school_name || matchCandidate.schoolName}
                          </div>
                        )}
                        {(matchCandidate.review_branch || matchCandidate.reviewBranch) && (
                          <div className="text-[11px] text-amber-800 dark:text-amber-200 font-medium">
                            📍 Branch: {matchCandidate.review_branch || matchCandidate.reviewBranch}
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold pt-1">
                        <strong>Is this you?</strong> If yes, your account will adopt this ID Number and all your previous scores will be linked immediately so you can see them.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-amber-200/80 dark:border-amber-800">
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
                      className="w-full sm:flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black py-2.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Yes, this is me (Use this ID & Load Scores)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserMatchChoice('no')}
                      className="w-full sm:w-auto bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                    >
                      No, create new ID
                    </button>
                  </div>
                </motion.div>
              )}

              {matchCandidate && userMatchChoice === 'yes' && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-50/90 dark:bg-emerald-950/60 border-2 border-emerald-400 dark:border-emerald-600 rounded-2xl p-4 shadow-md space-y-2.5 my-2"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-200 dark:border-emerald-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                        Linked to ID: <strong className="font-mono font-black text-emerald-700 dark:text-emerald-300">{matchCandidate.seq_id || matchCandidate.seqId || matchCandidate.id_number}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUserMatchChoice('pending')}
                      className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div className="space-y-1 text-xs text-emerald-950 dark:text-emerald-100 font-medium leading-relaxed">
                    <p>
                      To open and confirm this account, log in using the registered email address:
                    </p>
                    <div 
                      onClick={() => openGmailApp(matchCandidate.email || matchCandidate.email_lower || email || '')}
                      title="Click to Open Gmail App"
                      className="bg-white dark:bg-emerald-900/40 p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 font-mono font-extrabold text-xs text-emerald-900 dark:text-emerald-100 flex items-center gap-2 cursor-pointer hover:border-emerald-500 transition-all shadow-sm active:scale-[0.99]"
                    >
                      <Mail size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{maskEmail(matchCandidate.email || matchCandidate.email_lower || email || '')}</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-200 font-semibold pt-0.5">
                      We sent an email to confirm login. Please check your inbox or sign in using this email address to proceed.
                    </p>
                    <button
                      type="button"
                      onClick={() => openGmailApp(matchCandidate.email || matchCandidate.email_lower || email || '')}
                      className="mt-2 w-full py-2 px-3 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 rounded-xl font-bold text-xs text-emerald-950 dark:text-emerald-100 flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all group active:scale-[0.99]"
                    >
                      <GmailIcon className="w-4 h-4 shrink-0" />
                      <span>Open Gmail App</span>
                      <ExternalLink size={12} className="text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-800 dark:group-hover:text-emerald-200" />
                    </button>
                  </div>
                </motion.div>
              )}

              {matchCandidate && userMatchChoice === 'no' && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium my-2"
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Creating a new ID Number for this account.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUserMatchChoice('pending')}
                    className="text-[10px] uppercase font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Next Step Button for Step 1 */}
            <button
              type="button"
              disabled={!isStep1Valid}
              onClick={() => {
                if (isStep1Valid) {
                  setError(null);
                  setCurrentStep(2);
                } else {
                  setError("Please enter both your First Name and Last Name to continue.");
                }
              }}
              className={pillButton}
            >
              <span>Continue to School & Branch</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>
        )}

        {/* STEP 2: SCHOOL & REVIEW BRANCH */}
        {currentStep === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            {/* School Name Dropdown */}
            <div className="space-y-1 relative">
              <label className={labelBase}>
                <GraduationCap size={12} className="text-teal-600 dark:text-[#00B8A9]" /> School Name
              </label>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search or enter school name..."
                  value={selectedSchool ? selectedSchool : schoolInput}
                  onChange={(e) => {
                    setSelectedSchool('');
                    setSchoolInput(e.target.value);
                    setShowSchoolDropdown(true);
                  }}
                  onFocus={() => setShowSchoolDropdown(true)}
                  className={inputBase + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowSchoolDropdown(!showSchoolDropdown)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
                    className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden"
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
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 last:border-0 cursor-pointer"
                        >
                          <span>{school}</span>
                          {selectedSchool === school && <Check size={14} className="text-teal-600 dark:text-[#00B8A9]" />}
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowSchoolDropdown(false)}
                        className="w-full px-4 py-2.5 text-left text-xs text-slate-500 dark:text-slate-400 italic"
                      >
                        No exact match. Your custom text will be saved.
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Review Branch Dropdown */}
            <div className="space-y-1 relative">
              <label className={labelBase}>
                <MapPin size={12} className="text-teal-600 dark:text-[#00B8A9]" /> Review Branch
              </label>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search or enter review branch..."
                  value={selectedBranch ? selectedBranch : branchInput}
                  onChange={(e) => {
                    setSelectedBranch('');
                    setBranchInput(e.target.value);
                    setShowBranchDropdown(true);
                  }}
                  onFocus={() => setShowBranchDropdown(true)}
                  className={inputBase + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
                    className="absolute z-40 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden"
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
                          className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 last:border-0 cursor-pointer"
                        >
                          <span>{branch}</span>
                          {selectedBranch === branch && <Check size={14} className="text-teal-600 dark:text-[#00B8A9]" />}
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowBranchDropdown(false)}
                        className="w-full px-4 py-2.5 text-left text-xs text-slate-500 dark:text-slate-400 italic"
                      >
                        No exact match. Your custom text will be saved.
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation Buttons for Step 2 */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCurrentStep(1);
                }}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full font-extrabold text-xs uppercase transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={!isStep2Valid}
                onClick={() => {
                  if (isStep2Valid) {
                    setError(null);
                    setCurrentStep(3);
                  } else {
                    setError("Please select or enter both your School Name and Review Branch.");
                  }
                }}
                className={pillButton + " flex-1"}
              >
                <span>Continue to Account Security</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: ACCOUNT CREDENTIALS & SECURITY */}
        {currentStep === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            {/* Email Address */}
            <div className="space-y-1">
              <label className={labelBase}>
                <Mail size={11} className="text-teal-600 dark:text-[#00B8A9]" /> Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="username@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`${inputBase} ${emailDuplicateError ? '!border-rose-500 !bg-rose-50/30 dark:!bg-rose-950/20' : ''}`}
                />
                {checkingEmail && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                    Checking...
                  </span>
                )}
              </div>
              {emailDuplicateError ? (
                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 ml-1 mt-1 flex items-center gap-1.5">
                  <span>⚠️</span> {emailDuplicateError}
                </p>
              ) : (
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 ml-1 mt-0.5">
                  You may use any active email address. Verification will be sent to this email.
                </p>
              )}
            </div>

            {/* Passwords in 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password */}
              <div className="space-y-1 relative">
                <label className={labelBase}>
                  <Lock size={11} className="text-teal-600 dark:text-[#00B8A9]" /> Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Min. 8 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputBase + " pr-11"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00B8A9] cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1 relative">
                <label className={labelBase}>
                  <Lock size={11} className="text-teal-600 dark:text-[#00B8A9]" /> Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputBase} pr-11 ${
                      confirmPassword && password
                        ? confirmPassword === password
                          ? "border-emerald-500 focus:border-emerald-600 ring-1 ring-emerald-500/20"
                          : "border-rose-400 focus:border-rose-500 ring-1 ring-rose-500/20"
                        : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00B8A9] cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Confirm Password Status & Reminder Box */}
            {password && (
              <div className="text-[11px] font-bold">
                {confirmPassword ? (
                  confirmPassword === password ? (
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Passwords match perfectly.</span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
                      <span>Passwords do not match yet. Please retype identical password.</span>
                    </div>
                  )
                ) : (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <span className="text-amber-600 font-bold shrink-0">Reminder:</span>
                    <span>Please re-enter your password in "Confirm Password" to complete this step.</span>
                  </div>
                )}
              </div>
            )}

            {/* Password Requirements & Step Checklist Box */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Password Security Checklist
                </p>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  allRequirementsMet 
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                }`}>
                  {passwordRequirements.filter(r => r.met).length} of {passwordRequirements.length} Met
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {passwordRequirements.map((req) => (
                  <div
                    key={req.text}
                    className={`flex items-center gap-2 text-[10px] font-bold transition-colors ${
                      req.met
                        ? "text-[#16A34A]"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                        req.met
                          ? "border-[#22C55E] bg-[#22C55E] text-white"
                          : "border-slate-300 dark:border-slate-700 text-transparent"
                      }`}
                    >
                      {req.met ? "✓" : ""}
                    </span>

                    <span>{req.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Buttons for Step 3 */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCurrentStep(2);
                }}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full font-extrabold text-xs uppercase transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={loading || googleLoading || !allRequirementsMet || Boolean(emailDuplicateError)}
                className={pillButton + " flex-1"}
              >
                {loading ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                ) : (
                  "CREATE ACCOUNT"
                )}
              </button>
            </div>
          </motion.div>
        )}
      </form>

      {/* Switch to Login */}
      <div className="text-center text-xs text-slate-500">
        Already have an account?{" "}
        <button
          onClick={onToggleLogin}
          className="text-teal-600 dark:text-[#00B8A9] hover:text-teal-700 dark:hover:text-teal-400 font-extrabold"
        >
          Sign In
        </button>
      </div>
    </div>
    </>
  );
}
