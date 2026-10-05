import React from 'react';
import { CheckCircle2, AlertTriangle, Info, GraduationCap } from 'lucide-react';
import { computeRevieweeRowScores, MAJOR_AREA_LABELS, MAJOR_AREA_KEYS } from './scoreMatrixUtils';
import { getCanonicalRevieweeId } from '../../utils/canonicalActiveReviewee';

interface MyScoresTableProps {
  revieweeData: any;
  scores?: any[];
}

export const MyScoresTable: React.FC<MyScoresTableProps> = ({ revieweeData, scores }) => {
  const row = computeRevieweeRowScores(revieweeData);
  const idNumber = getCanonicalRevieweeId(revieweeData) || '—';

  const getRemarksBadge = (score: number | null) => {
    if (score === null) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
          Pending
        </span>
      );
    }
    if (score >= 75) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
          Passed
        </span>
      );
    }
    if (score >= 70) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
          Conditional
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
        Needs Improvement
      </span>
    );
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            My Scores
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
            View your review performance
          </p>
        </div>

        {/* TOP RIGHT REVIEWEE ID BADGE */}
        <div className="bg-slate-100 border border-slate-200/80 rounded-2xl px-4 py-2 flex flex-col items-start sm:items-end self-start sm:self-auto shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Reviewee ID
          </span>
          <span className="text-sm font-black font-mono text-slate-800">
            {idNumber}
          </span>
        </div>
      </div>

      {/* 3-COLUMN TABLE CONTAINER */}
      <div className="w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            {/* TABLE HEADER */}
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80 text-[11px] uppercase tracking-wider">
              <tr>
                <th scope="col" className="py-3 px-4 sm:px-6 font-bold text-slate-700 min-w-[180px] sm:min-w-[260px]">
                  Major Area
                </th>
                <th scope="col" className="py-3 px-4 text-center font-bold text-slate-700 w-[80px] sm:w-[100px]">
                  Score
                </th>
                <th scope="col" className="py-3 px-4 text-center font-bold text-slate-700 w-[100px] sm:w-[120px]">
                  Remarks
                </th>
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="divide-y divide-slate-100 bg-white">
              {MAJOR_AREA_KEYS.map((key) => {
                const labelInfo = MAJOR_AREA_LABELS[key];
                const score = row[key as keyof typeof row] as number | null;

                return (
                  <tr key={key} className="hover:bg-slate-50/70 transition-colors">
                    {/* Major Area Name */}
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-800">
                      {labelInfo.full}
                    </td>

                    {/* Score */}
                    <td className="py-3.5 px-4 text-center font-bold tabular-nums text-slate-900">
                      {score !== null ? score.toFixed(2) : '—'}
                    </td>

                    {/* Remarks */}
                    <td className="py-3.5 px-4 text-center">
                      {getRemarksBadge(score)}
                    </td>
                  </tr>
                );
              })}

              {/* SUMMARY ROW: AVERAGE SCORE */}
              <tr className="bg-blue-50/70 border-t-2 border-blue-200/80 font-black">
                <td className="py-4 px-4 sm:px-6 text-slate-900 text-sm sm:text-base font-black">
                  Average Score
                </td>
                <td className="py-4 px-4 text-center text-blue-900 text-base sm:text-lg font-black tabular-nums">
                  {row.average !== null ? row.average.toFixed(2) : '—'}
                </td>
                <td className="py-4 px-4 text-center">
                  {row.status === 'Passed' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200/90 shadow-2xs">
                      Passed
                    </span>
                  )}
                  {row.status === 'Conditional' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200/90 shadow-2xs">
                      Conditional
                    </span>
                  )}
                  {row.status === 'Incomplete' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                      Incomplete
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ENCOURAGEMENT BANNER CARD */}
      <div className={`p-4 sm:p-5 rounded-2xl border flex items-center gap-3.5 shadow-2xs ${
        row.status === 'Passed'
          ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-950'
          : row.status === 'Conditional'
          ? 'bg-amber-50/80 border-amber-200/80 text-amber-950'
          : 'bg-slate-50 border-slate-200 text-slate-900'
      }`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          row.status === 'Passed'
            ? 'bg-emerald-100 text-emerald-700'
            : row.status === 'Conditional'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-200 text-slate-700'
        }`}>
          {row.status === 'Passed' ? (
            <CheckCircle2 size={22} className="stroke-[2.5]" />
          ) : row.status === 'Conditional' ? (
            <AlertTriangle size={22} className="stroke-[2.5]" />
          ) : (
            <Info size={22} className="stroke-[2.5]" />
          )}
        </div>

        <div>
          <p className="font-black text-sm sm:text-base leading-snug">
            {row.status === 'Passed'
              ? 'You passed the review program. Keep up the good work!'
              : row.status === 'Conditional'
              ? 'Your performance is conditional. Keep pushing to reach 75%!'
              : 'Some scores are pending or incomplete. Complete all assessment items to view your final status.'}
          </p>
          <p className="text-xs font-medium opacity-80 mt-0.5">
            Updated in real time from official examination records.
          </p>
        </div>
      </div>
    </div>
  );
};
