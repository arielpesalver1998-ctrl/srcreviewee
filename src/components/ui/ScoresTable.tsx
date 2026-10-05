import React from 'react';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';

export interface StatusBadgeProps {
  status: 'Passed' | 'Conditional' | 'Incomplete' | string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Standardized status badge pill for examination results.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  className = '',
}) => {
  const normStatus = String(status || '').trim().toLowerCase();

  let styleClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let label = 'Incomplete';

  if (normStatus === 'passed' || normStatus === 'pass') {
    styleClasses = 'bg-emerald-100 text-emerald-800 border-emerald-200/90';
    label = 'Passed';
  } else if (normStatus === 'conditional') {
    styleClasses = 'bg-amber-100 text-amber-800 border-amber-200/90';
    label = 'Conditional';
  } else if (normStatus === 'incomplete' || normStatus === 'pending') {
    styleClasses = 'bg-slate-100 text-slate-700 border-slate-200';
    label = normStatus === 'pending' ? 'Pending' : 'Incomplete';
  } else {
    label = status;
  }

  const sizeClasses =
    size === 'md'
      ? 'px-3 py-1 text-xs font-black'
      : 'px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border uppercase tracking-wider shadow-2xs ${sizeClasses} ${styleClasses} ${className}`}
    >
      {label}
    </span>
  );
};

export interface ScoresHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

/**
 * Standardized header component for score views across Admin, Staff, and Reviewee portals.
 */
export const ScoresHeader: React.FC<ScoresHeaderProps> = ({
  title,
  subtitle,
  action,
  badge,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-2 ${className}`}
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        {badge}
        {action}
      </div>
    </div>
  );
};

export interface ScoresPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemName?: string;
  className?: string;
}

/**
 * Standardized pagination component for score tables.
 */
export const ScoresPagination: React.FC<ScoresPaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemName = 'reviewees',
  className = '',
}) => {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-500 ${className}`}
    >
      <div>
        Showing {startItem}–{endItem} of {totalItems} {itemName}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              if (totalPages <= 7) return true;
              if (page === 1 || page === totalPages) return true;
              return Math.abs(page - currentPage) <= 2;
            })
            .map((page, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsis = prev && page - prev > 1;

              return (
                <React.Fragment key={page}>
                  {showEllipsis && (
                    <span className="px-1 text-slate-400 font-bold">...</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onPageChange(page)}
                    className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      currentPage === page
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                </React.Fragment>
              );
            })}

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export interface ScoresTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  swipeIndicator?: boolean;
  className?: string;
}

/**
 * Standardized score table container with mobile sticky column support and horizontal scrolling.
 */
export const ScoresTable: React.FC<ScoresTableProps> = ({
  children,
  swipeIndicator = true,
  className = '',
  ...props
}) => {
  return (
    <div className={`w-full space-y-2 ${className}`} {...props}>
      {swipeIndicator && (
        <div className="sm:hidden text-center text-xs font-medium text-blue-600 bg-blue-50/80 py-1.5 px-3 rounded-xl border border-blue-100">
          ← Swipe horizontally to see more columns →
        </div>
      )}

      <div className="w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
        <div className="overflow-x-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
