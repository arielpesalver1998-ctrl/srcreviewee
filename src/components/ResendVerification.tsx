import React from 'react';
import { motion } from 'motion/react';
import { Mail, RefreshCw, Loader2, LogOut, ExternalLink, CheckCircle2, Inbox } from 'lucide-react';
import { GmailIcon } from './GmailIcon';

interface ResendVerificationProps {
  email: string | null | undefined;
  resendingEmail: boolean;
  emailMsg?: string | null;
  onCheckVerified: () => void;
  onResendEmail: () => void;
  onLogout: () => void;
}

export const ResendVerification: React.FC<ResendVerificationProps> = ({
  email,
  resendingEmail,
  emailMsg,
  onCheckVerified,
  onResendEmail,
  onLogout,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="bg-white/90 dark:bg-[#0B1220]/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 max-w-md w-full text-center flex flex-col items-center"
    >
      {/* Icon Badge */}
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-500/10 via-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/20 border border-teal-200/60 dark:border-teal-800/60 flex items-center justify-center text-teal-600 dark:text-[#00B8A9] shadow-inner">
          <GmailIcon className="w-10 h-10 shrink-0" />
        </div>
        <div className="absolute -bottom-1 -right-1 bg-teal-600 text-white p-1.5 rounded-full shadow-md border-2 border-white dark:border-[#0B1220]">
          <Mail size={12} />
        </div>
      </div>

      {/* Header */}
      <div className="space-y-1.5">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Verify Your Email
        </h2>
        <p className="text-[11px] font-extrabold text-teal-600 dark:text-[#00B8A9] uppercase tracking-wider flex items-center justify-center gap-1.5">
          <Inbox size={13} />
          Confirmation Link Sent
        </p>
      </div>

      {/* Email Indicator Card */}
      <div className="w-full bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-left">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 block">
            Registered Email Address
          </span>
          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 truncate block">
            {email || 'Your Email Address'}
          </span>
        </div>
        <div className="shrink-0 bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 p-1.5 rounded-xl">
          <CheckCircle2 size={16} />
        </div>
      </div>

      {/* Instructions */}
      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed text-left bg-teal-50/50 dark:bg-teal-950/20 p-4 rounded-2xl border border-teal-100 dark:border-teal-900/40">
        <p className="font-semibold text-slate-800 dark:text-slate-200">
          To complete your account activation:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
          <li>Check your email inbox for our verification message.</li>
          <li>Click the verification link provided in the email.</li>
          <li>Return here and click <strong className="text-teal-700 dark:text-teal-300">"I Have Verified My Email"</strong>.</li>
        </ol>
        <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold pt-1 border-t border-teal-200/40 dark:border-teal-900/40">
          * Notice: If you don't see the email in your inbox, please check your SPAM or Junk folder.
        </p>
      </div>

      {/* Quick Action: Open Gmail */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          const mobileIntent = 'googlegmail://';
          const webUrl = 'https://mail.google.com';
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isMobile) {
            window.location.href = mobileIntent;
            setTimeout(() => {
              window.open(webUrl, '_blank', 'noopener,noreferrer');
            }, 600);
          } else {
            window.open(webUrl, '_blank', 'noopener,noreferrer');
          }
        }}
        className="w-full py-3.5 px-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-400 text-slate-800 dark:text-white rounded-2xl font-extrabold text-xs tracking-wide uppercase transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-3 cursor-pointer group"
      >
        <GmailIcon className="w-5 h-5 shrink-0" />
        <span>Open Gmail Inbox</span>
        <ExternalLink size={14} className="text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
      </button>

      {/* Status Message feedback if any */}
      {emailMsg && (
        <div className="text-xs bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-emerald-800 dark:text-emerald-200 font-bold w-full text-center">
          {emailMsg}
        </div>
      )}

      {/* Main Buttons */}
      <div className="w-full space-y-2.5 pt-1">
        <button
          type="button"
          onClick={onCheckVerified}
          className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 dark:bg-[#00B8A9] dark:hover:bg-teal-600 text-white rounded-2xl font-black text-xs tracking-wider uppercase transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} />
          I Have Verified My Email
        </button>

        <button
          type="button"
          disabled={resendingEmail}
          onClick={onResendEmail}
          className="w-full py-3 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {resendingEmail ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Resending Email...</span>
            </>
          ) : (
            <>
              <Mail size={13} />
              <span>Resend Verification Email</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="w-full py-2.5 bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold hover:underline flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <LogOut size={13} />
          <span>Logout / Use another account</span>
        </button>
      </div>
    </motion.div>
  );
};
