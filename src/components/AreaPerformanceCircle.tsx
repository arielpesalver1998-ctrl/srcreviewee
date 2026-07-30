import React from "react";
import {
  getPerformanceLevel,
} from "../utils/gradeCalculation";

type AreaPerformanceCircleProps = {
  key?: React.Key;
  subject: string;
  percentage: number;
  revieweeCount?: number;
  subtitle?: string;
  onClick?: () => void;
  isSelected?: boolean;
};

const AREA_CONFIGS: Record<string, { fullName: string; color: string }> = {
  CLJ: { fullName: "Criminal Law and Jurisprudence", color: "#10B981" },
  LEA: { fullName: "Law Enforcement Administration", color: "#3B82F6" },
  CDI: { fullName: "Crime Detection and Investigation", color: "#00B8A9" },
  FS: { fullName: "Forensic Science", color: "#6366F1" },
  CRIM: { fullName: "Criminology", color: "#10B981" },
  CA: { fullName: "Correctional Administration", color: "#06B6D4" },
  "COR-AD": { fullName: "Correctional Administration", color: "#06B6D4" },
  CORAD: { fullName: "Correctional Administration", color: "#06B6D4" },
};

export function AreaPerformanceCircle({
  subject,
  percentage,
  revieweeCount,
  subtitle,
  onClick,
  isSelected,
}: AreaPerformanceCircleProps) {
  const safePercentage = Math.min(
    100,
    Math.max(0, Number.isFinite(percentage) ? percentage : 0)
  );

  const displaySubject =
    subject === "CORAD" || subject === "COR-AD" ? "CA" : subject;

  const config = AREA_CONFIGS[displaySubject] || {
    fullName: subtitle && !subtitle.includes("evaluation") ? subtitle : displaySubject,
    color: "#00B8A9",
  };

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safePercentage / 100) * circumference;

  const performance = getPerformanceLevel(safePercentage);

  const statusColorClass =
    safePercentage >= 90
      ? "text-emerald-600 dark:text-emerald-400"
      : safePercentage >= 85
      ? "text-blue-600 dark:text-blue-400"
      : safePercentage >= 75
      ? "text-amber-500 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400";

  const evalCountLabel =
    typeof revieweeCount === "number"
      ? `${revieweeCount} ${revieweeCount === 1 ? "evaluation" : "evaluations"}`
      : subtitle && subtitle.includes("evaluation")
      ? subtitle
      : "0 evaluations";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-h-[320px] w-full flex-col items-center justify-between rounded-[24px] border bg-white p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:bg-slate-900 cursor-pointer overflow-hidden ${
        isSelected
          ? "border-teal-500 ring-2 ring-teal-500 dark:border-teal-400"
          : "border-slate-200/90 dark:border-slate-800"
      }`}
    >
      {/* Subject Header */}
      <div className="flex flex-col items-center w-full">
        <p className="text-xs font-black uppercase tracking-wider text-teal-700 dark:text-teal-400">
          {displaySubject}
        </p>
        <h4 className="mt-1 text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 leading-tight tracking-tight h-7 flex items-center justify-center text-center max-w-[130px] px-1">
          {config.fullName}
        </h4>
      </div>

      {/* Circle Progress Gauge */}
      <div className="relative mt-4 mb-2 h-36 w-36 flex items-center justify-center shrink-0">
        {/* Watermark in center background */}
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-5xl font-black text-slate-900/[0.08] dark:text-white/[0.08] tracking-wider uppercase z-0"
        >
          {displaySubject}
        </span>

        {/* SVG Ring */}
        <svg
          viewBox="0 0 100 100"
          className="-rotate-90 w-full h-full z-10"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="10"
            className="dark:stroke-slate-800"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={config.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Percentage Text */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {safePercentage.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Status & Eval Count */}
      <div className="flex flex-col items-center w-full">
        <p className={`text-sm font-black leading-tight ${statusColorClass}`}>
          {performance.label}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
          {evalCountLabel}
        </p>
      </div>

      {/* Action link */}
      <div className="mt-3 text-xs font-bold text-teal-700 hover:text-teal-800 dark:text-teal-400 transition-colors flex items-center gap-1">
        View Breakdown →
      </div>
    </button>
  );
}

