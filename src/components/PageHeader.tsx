import React from 'react';
import { cn } from '../lib/utils';

interface PageHeaderProps {
  title: string | React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  dateFilter?: React.ReactNode;
  className?: string;
  isDateFilterOpen?: boolean;
}

export default function PageHeader({ title, description, children, dateFilter, className, isDateFilterOpen }: PageHeaderProps) {
  return (
    <div className={cn(
      "flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-2 bg-white py-6 px-4 sm:p-3 rounded-2xl shadow-sm border border-slate-200 relative mb-2 sm:mb-2 text-slate-900 min-h-[140px] sm:min-h-0",
      className
    )}>
      <div className="relative z-10">
        <h1 className="text-xl sm:text-lg font-bold tracking-tight flex items-center">
          {title}
        </h1>
        {description && (
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 max-w-[280px] sm:max-w-md">
            {description}
          </p>
        )}
      </div>
      

      {dateFilter && (
        <div className="absolute top-4 right-4 z-10">
          {dateFilter}
        </div>
      )}

      {children && (
        <div className={cn("flex flex-row items-center gap-3 justify-end sm:mr-12 relative z-10 w-full sm:w-auto mt-5 md:mt-0", isDateFilterOpen && "hidden sm:flex")}>
          {children}
        </div>
      )}
    </div>
  );
}
