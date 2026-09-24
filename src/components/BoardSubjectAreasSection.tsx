import React from "react";
import { AreaPerformanceCircle } from "./AreaPerformanceCircle";

export type BoardAreaCardData = {
  key: string;
  area: string;
  title: string;
  percent: number;
  weight?: number;
  contribution?: number;
  count: number;
  onClick: () => void;
};

export function BoardSubjectAreasSection({
  areas,
  onViewAll,
  title = "Board Subject Areas",
  subtitle = "Click any area to view full category breakdown",
}: {
  areas: BoardAreaCardData[];
  onViewAll?: () => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="rounded-2xl sm:rounded-[28px] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-0.5 sm:mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-xs font-black text-teal-700 hover:text-teal-800 dark:text-teal-400 transition-colors"
            >
              View All →
            </button>
          )}
          <span className="rounded-full bg-teal-50 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-100/60 dark:border-teal-900">
            {areas.length} Board Areas
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2 sm:pb-3">
        <div className="flex gap-3 sm:gap-4 min-w-max lg:grid lg:grid-cols-6 lg:w-full">
          {areas.map((item) => (
            <div key={item.key || item.area} className="w-[150px] sm:w-[180px] shrink-0 lg:w-auto">
              <AreaPerformanceCircle
                subject={item.area}
                percentage={item.percent || 0}
                subtitle={item.title}
                revieweeCount={item.count}
                onClick={item.onClick}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

