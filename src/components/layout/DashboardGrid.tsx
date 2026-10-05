import React from 'react';

export interface DashboardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4 | 5;
  className?: string;
}

const colsClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

/**
 * Standardized responsive grid layout component for metrics and action cards.
 */
export const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  cols = 3,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`grid ${colsClasses[cols]} gap-3.5 sm:gap-4 lg:gap-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface KpiGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * Specialty 4-column responsive KPI metric grid.
 */
export const KpiGrid: React.FC<KpiGridProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

export interface SectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * Standardized section wrapper for grouping related UI modules with uniform vertical spacing.
 */
export const Section: React.FC<SectionProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`space-y-4 sm:space-y-6 ${className}`} {...props}>
      {children}
    </div>
  );
};
