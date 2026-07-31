import React from 'react';
import { BoardMajorAreaCard } from './BoardMajorAreaCard';

export function MyScoresBoardSubjectAreas({ 
  areas, 
  selectedArea, 
  onAreaClick 
}: { 
  areas: any[], 
  selectedArea?: string, 
  onAreaClick: (area: string) => void 
}) {
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
      
      {/* Responsive Grid Layout matching exact specifications */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 w-full">
        {areas.map((area) => {
          const colors: Record<string, string> = {
            CLJ: '#10B981',
            LEA: '#3B82F6',
            CDI: '#0D9488',
            FS: '#8B5CF6',
            CRIM: '#10B981',
            CA: '#06B6D4'
          };
          const color = colors[area.area.toUpperCase()] || '#10B981';

          return (
            <BoardMajorAreaCard
              key={area.area}
              areaCode={area.area}
              title={area.title}
              percentage={area.percent || 0}
              color={color}
              watermark={area.area}
              isSelected={selectedArea === area.area}
              onClick={() => onAreaClick(area.area)}
            />
          );
        })}
      </div>
    </section>
  );
}
