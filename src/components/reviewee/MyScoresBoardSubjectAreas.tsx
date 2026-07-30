import React from 'react';
import { AreaPerformanceCircle } from '../AreaPerformanceCircle';

export function MyScoresBoardSubjectAreas({ areas, selectedArea, onAreaClick }: { areas: any[], selectedArea?: string, onAreaClick: (area: string) => void }) {
  return (
    <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900">Board Subject Areas</h2>
          <p className="text-sm text-slate-500">Click any area to view full category breakdown</p>
        </div>
        <div className="bg-slate-50 text-slate-700 font-bold text-xs px-4 py-2 rounded-full border border-slate-100">
          {areas.length} Board Areas
        </div>
      </div>
      <div className="overflow-x-auto pb-3">
        <div className="flex gap-4 min-w-max lg:grid lg:grid-cols-6 lg:w-full">
          {areas.map((area) => (
            <div key={area.area} className="w-[180px] shrink-0 lg:w-auto">
              <AreaPerformanceCircle
                subject={area.area}
                percentage={area.percent || 0}
                subtitle={area.title}
                isSelected={selectedArea === area.area}
                onClick={() => onAreaClick(area.area)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
