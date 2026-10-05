import React from 'react';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

/**
 * Standardized main page layout container enforcing consistent horizontal padding,
 * max-width constraints, and vertical section spacing across all portal views.
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  maxWidth = 'max-w-[1600px]',
  className = '',
  ...props
}) => {
  return (
    <div
      className={`w-full ${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
