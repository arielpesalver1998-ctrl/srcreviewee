import React from 'react';
import { 
  TrendingUp, 
  Award, 
  Target, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ChevronRight,
  BarChart3,
  Flame
} from 'lucide-react';
import { SubjectArea } from '../../utils/gradeCalculation';

interface MajorAreaScore {
  key: string;
  area: string;
  title: string;
  percent: number;
  count: number;
  onClick?: () => void;
}

interface AverageScoreProgressBarProps {
  averageScore: number;
  totalEvaluations: number;
  areaScores?: MajorAreaScore[];
  onAreaClick?: (areaLabel: string, areaKey: SubjectArea) => void;
  passingBenchmark?: number;
  className?: string;
  compact?: boolean;
}

export function AverageScoreProgressBar({
  averageScore,
  totalEvaluations,
  areaScores = [],
  onAreaClick,
  passingBenchmark = 75,
  className = '',
  compact = false,
}: AverageScoreProgressBarProps) {
  const safeScore = Number.isFinite(averageScore) ? Math.min(100, Math.max(0, averageScore)) : 0;
  const isPassing = safeScore >= passingBenchmark;
  const diffFromPassing = safeScore - passingBenchmark;
  const hasScores = totalEvaluations > 0 || safeScore > 0;

  // Status tiers & color themes
  const getPerformanceMeta = (score: number) => {
    if (!hasScores) {
      return {
        label: 'Awaiting Evaluations',
        description: 'No evaluation scores encoded yet',
        barGradient: 'from-slate-300 via-slate-400 to-slate-500',
        textColor: 'text-slate-600',
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: <Target size={15} className="text-slate-500" />,
        glowColor: 'rgba(148, 163, 184, 0.25)',
      };
    }
    if (score >= 90) {
      return {
        label: 'Topnotcher Level',
        description: 'Exceeding board exam excellence benchmark (90%+)',
        barGradient: 'from-emerald-500 via-teal-500 to-cyan-500',
        textColor: 'text-emerald-700',
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        icon: <Sparkles size={15} className="text-emerald-600" />,
        glowColor: 'rgba(16, 185, 129, 0.35)',
      };
    }
    if (score >= passingBenchmark) {
      return {
        label: 'Passing Standard Met',
        description: `Passed the ${passingBenchmark}% Board Exam Standard (+${diffFromPassing.toFixed(1)}%)`,
        barGradient: 'from-teal-500 via-emerald-500 to-emerald-400',
        textColor: 'text-teal-700',
        badgeBg: 'bg-teal-50 text-teal-800 border-teal-200',
        icon: <CheckCircle2 size={15} className="text-teal-600" />,
        glowColor: 'rgba(20, 184, 166, 0.35)',
      };
    }
    if (score >= 60) {
      return {
        label: 'Approaching Passing Standard',
        description: `${Math.abs(diffFromPassing).toFixed(1)}% needed to reach ${passingBenchmark}% passing mark`,
        barGradient: 'from-amber-400 via-amber-500 to-orange-500',
        textColor: 'text-amber-700',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
        icon: <TrendingUp size={15} className="text-amber-600" />,
        glowColor: 'rgba(245, 158, 11, 0.35)',
      };
    }
    return {
      label: 'Intensive Review Recommended',
      description: `${Math.abs(diffFromPassing).toFixed(1)}% below ${passingBenchmark}% board passing mark`,
      barGradient: 'from-rose-500 via-rose-400 to-amber-500',
      textColor: 'text-rose-700',
      badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
      icon: <AlertCircle size={15} className="text-rose-600" />,
      glowColor: 'rgba(244, 63, 94, 0.35)',
    };
  };

  const meta = getPerformanceMeta(safeScore);

  return (
    <div
      className={`rounded-2xl sm:rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-6 shadow-xs relative overflow-hidden transition-all ${className}`}
    >
      {/* Subtle background ambient light */}
      <div 
        className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-40 transition-all"
        style={{ background: meta.glowColor }}
      />

      {/* Header section with Current Average & Target Benchmark */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <BarChart3 size={14} className="text-teal-600" />
              Current Average Score
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${meta.badgeBg}`}>
              {meta.icon}
              <span>{meta.label}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {meta.description}
          </p>
        </div>

        {/* Large Score Callout */}
        <div className="flex items-baseline gap-2 sm:text-right">
          <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
            {hasScores ? `${safeScore.toFixed(2)}%` : '0.00%'}
          </span>
          <span className="text-xs font-bold text-slate-400">
            / 100%
          </span>
        </div>
      </div>

      {/* Visual Progress Bar Track */}
      <div className="relative z-10 my-3">
        <div className="h-5 sm:h-6 w-full bg-slate-100/90 rounded-xl p-1 border border-slate-200/80 shadow-inner relative overflow-hidden">
          {/* Active Fill Bar */}
          <div
            className={`h-full rounded-lg bg-gradient-to-r ${meta.barGradient} transition-all duration-700 ease-out shadow-xs relative`}
            style={{ width: `${safeScore}%` }}
          >
            {/* Animated shimmer on filled bar */}
            <div className="absolute inset-0 bg-white/20 rounded-lg animate-pulse" />
          </div>

          {/* 75% Passing Threshold Reference Pin */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-slate-800/80 z-20 pointer-events-none"
            style={{ left: `${passingBenchmark}%` }}
          />
        </div>

        {/* Passing Benchmark & Milestone Labels */}
        <div className="relative w-full mt-2 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          
          {/* Passing Target Flag */}
          <div 
            className="absolute -top-1 transform -translate-x-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${passingBenchmark}%` }}
          >
            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
              <Target size={9} className="text-amber-400" />
              <span>75% Pass</span>
            </span>
          </div>

          <span className="text-right">100%</span>
        </div>
      </div>

      {/* Major Area Quick Indicators (if available and not in compact mode) */}
      {!compact && areaScores.length > 0 && (
        <div className="relative z-10 mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Flame size={13} className="text-amber-500" />
              Subject Area Progress Breakdown
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              Click area to view full details
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {areaScores.map((area) => {
              const areaScore = Number.isFinite(area.percent) ? Math.min(100, Math.max(0, area.percent)) : 0;
              const areaPassed = areaScore >= passingBenchmark;
              return (
                <button
                  key={area.key}
                  type="button"
                  onClick={() => {
                    if (area.onClick) {
                      area.onClick();
                    } else if (onAreaClick) {
                      onAreaClick(area.area, area.key as SubjectArea);
                    }
                  }}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50/60 border border-slate-200/80 hover:border-teal-300 transition-all text-left cursor-pointer group shadow-2xs"
                  title={`${area.area} (${area.title}): ${areaScore.toFixed(1)}%`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 group-hover:text-teal-700 transition-colors">
                      {area.area}
                    </span>
                    <span className={`text-[11px] font-black font-mono ${areaPassed ? 'text-emerald-600' : areaScore > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {areaScore > 0 ? `${areaScore.toFixed(0)}%` : '—'}
                    </span>
                  </div>

                  {/* Mini Area Progress Bar */}
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${
                        areaPassed 
                          ? 'bg-emerald-500' 
                          : areaScore > 0 
                          ? 'bg-amber-500' 
                          : 'bg-slate-300'
                      }`}
                      style={{ width: `${areaScore}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-1 text-[9px] text-slate-400 font-medium">
                    <span className="truncate max-w-[80px]">{area.title}</span>
                    <ChevronRight size={10} className="text-slate-300 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
