import React, { useState, useEffect } from 'react';

interface BoardMajorAreaCardProps {
  areaCode: string;
  title: string;
  percentage: number;
  color: string;
  watermark: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export function BoardMajorAreaCard({
  areaCode,
  title,
  percentage,
  color,
  watermark,
  isSelected = false,
  onClick
}: BoardMajorAreaCardProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  useEffect(() => {
    // Animate the circular progress from 0% to the computed value when the page loads
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = Math.min(100, Math.max(0, animatedPercentage));
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  return (
    <div
      onClick={onClick}
      className={`relative w-full rounded-[20px] bg-white p-5 border text-center cursor-pointer select-none overflow-hidden transition-all duration-200 hover:-translate-y-1 ${
        isSelected
          ? 'shadow-md border-[2px]'
          : 'shadow-sm border-[#E5E7EB]'
      }`}
      style={{
        borderColor: isSelected ? color : '#E5E7EB',
        boxShadow: isSelected 
          ? `0 10px 15px -3px ${color}15, 0 4px 6px -4px ${color}15, 0 0 0 2px ${color}10` 
          : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* WATERMARK: Large abbreviation upper-right, opacity 3-5%, never overlaps readable text */}
      <span 
        className="absolute -top-1 -right-1 text-6xl font-black select-none pointer-events-none tracking-tight leading-none z-0 text-slate-900/[0.04]"
        style={{ userSelect: 'none' }}
      >
        {watermark}
      </span>

      <div className="flex flex-col items-center justify-between h-full w-full relative z-10 gap-4">
        {/* HEADER: Small uppercase letter spacing abbreviation */}
        <div className="w-full">
          <p 
            className="text-[10px] font-black uppercase tracking-[0.2em] text-center"
            style={{ color }}
          >
            {areaCode}
          </p>
        </div>

        {/* TITLE: Complete name, bold, uppercase, centered, h-12 to align across cards */}
        <div className="w-full flex items-center justify-center text-center h-[36px] overflow-hidden">
          <h4 className="text-[10px] font-black uppercase text-slate-800 leading-tight tracking-tight">
            {title}
          </h4>
        </div>

        {/* CIRCULAR PROGRESS */}
        <div className="relative h-28 w-28 flex items-center justify-center shrink-0">
          <svg
            viewBox="0 0 100 100"
            className="-rotate-90 w-full h-full"
          >
            {/* Light gray background ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#F3F4F6"
              strokeWidth="11"
            />
            {/* Colored progress ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* PERCENTAGE */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[15px] font-black tracking-tight text-black">
              {percentage.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
