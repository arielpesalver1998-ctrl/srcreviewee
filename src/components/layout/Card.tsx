import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: 'none' | 'compact' | 'normal' | 'spacious';
  variant?: 'default' | 'flat' | 'hoverable' | 'glass';
  className?: string;
}

const paddingClasses = {
  none: '',
  compact: 'p-3 sm:p-4',
  normal: 'p-4 sm:p-5 lg:p-6',
  spacious: 'p-5 sm:p-6 lg:p-8',
};

const variantClasses = {
  default: 'bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-2xs',
  flat: 'bg-slate-50 border border-slate-200/60 rounded-2xl sm:rounded-3xl',
  hoverable: 'bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-2xs hover:border-teal-400 hover:shadow-md transition-all cursor-pointer',
  glass: 'bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-2xl sm:rounded-3xl shadow-sm',
};

/**
 * Standardized dashboard card enforcing uniform padding, border radius, and surface styling.
 */
export const Card: React.FC<CardProps> = ({
  children,
  padding = 'normal',
  variant = 'default',
  className = '',
  ...props
}) => {
  return (
    <div
      className={`${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  title,
  subtitle,
  action,
  className = '',
  ...props
}) => {
  if (title || subtitle || action) {
    return (
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 ${className}`} {...props}>
        <div>
          {title && <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        {children}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-3 mb-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`w-full ${className}`} {...props}>
      {children}
    </div>
  );
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold ${className}`} {...props}>
      {children}
    </div>
  );
};

export interface TableCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * Specialty card container for tables enforcing scrollable boundaries and crisp rounded borders.
 */
export const TableCard: React.FC<TableCardProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-2xs overflow-hidden ${className}`} {...props}>
      <div className="overflow-x-auto custom-scrollbar">
        {children}
      </div>
    </div>
  );
};
