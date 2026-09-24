import React from 'react';
import { SAMARITAN_LOGO_URL } from '../../constants';
import { AlertTriangle } from 'lucide-react';

export type PortalLoadingScreenProps = {
  message?: string;
  subMessage?: string;
  status?: string;
  isTakingLonger?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onBackToLogin?: () => void;
};

export function PortalLoadingScreen({
  message = "Waiting to Log In",
  subMessage = "Please wait, Future RCrim.",
  status = "Preparing your portal…",
  isTakingLonger = false,
  error,
  onRetry,
  onBackToLogin,
}: PortalLoadingScreenProps) {
  const hasError = Boolean(error);
  const showActionPrompt = hasError || isTakingLonger;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-slate-50/95 dark:bg-slate-950/95 px-5 backdrop-blur-sm select-none"
      role="status"
      aria-live="polite"
      aria-label="Portal Loading Screen"
    >
      <div className="w-full max-w-sm rounded-3xl border border-teal-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-9 text-center shadow-2xl transition-all">
        {/* Official SRC Logo with soft jumping/bouncing animation */}
        <div className="mx-auto flex h-28 w-28 items-center justify-center relative">
          <img
            src={SAMARITAN_LOGO_URL}
            alt="Samaritan Review Center Official Logo"
            className="src-logo-bounce h-24 w-24 object-contain filter drop-shadow-md"
          />
        </div>

        {!showActionPrompt ? (
          <>
            <h1 className="mt-5 text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {message}
            </h1>

            <p className="mt-2 text-sm font-semibold text-teal-700">
              {subMessage}
            </p>

            {/* 3 Animated Bouncing Dots */}
            <div
              className="mt-5 flex items-center justify-center gap-1.5"
              aria-label="Loading"
            >
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-teal-600 [animation-delay:-0.3s]" />
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-teal-600 [animation-delay:-0.15s]" />
              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-teal-600" />
            </div>

            {status && (
              <p className="mt-4 text-xs font-medium text-slate-400 animate-pulse">
                {status}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="mx-auto mt-4 w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>

            <h1 className="mt-3 text-lg font-black text-slate-900 dark:text-white tracking-tight">
              {hasError ? "Unable to Load Profile" : "Taking longer than expected"}
            </h1>

            <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed px-2">
              {error || "We are having trouble connecting to your profile. Please check your connection and try again."}
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full rounded-xl bg-[#007C89] py-2.5 text-sm font-bold text-white hover:bg-[#006873] transition-colors shadow-sm cursor-pointer"
                >
                  Retry
                </button>
              )}
              {onBackToLogin && (
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Back to sign in
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
