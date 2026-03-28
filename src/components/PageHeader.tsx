import React from 'react';
import { cn } from '../lib/utils';

interface PageHeaderProps {
  title: string | React.ReactNode;
  children?: React.ReactNode;
  dateFilter?: React.ReactNode;
  className?: string;
}

export default function PageHeader({ title, children, dateFilter, className }: PageHeaderProps) {
  return (
    <div className={cn(
      "flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-2 bg-[#89A5D9] py-6 px-4 sm:p-3 rounded-2xl shadow-sm border border-[#7A96CA] relative mb-2 sm:mb-2 text-white min-h-[140px] sm:min-h-0",
      className
    )}>
      <div className="relative z-10">
        <h1 className="text-xl sm:text-lg font-bold tracking-tight flex items-center">
          {title}
        </h1>
      </div>
      

      {dateFilter && (
        <div className="absolute top-4 right-4 z-10">
          {dateFilter}
        </div>
      )}

      {children && (
        <div className="flex flex-row items-center gap-3 justify-end sm:mr-12 relative z-20 w-full sm:w-auto mt-5 md:mt-0">
          {children}
        </div>
      )}
    </div>
  );
}
