import React from 'react';

interface PageHeaderProps {
  title: string | React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  dateFilter?: React.ReactNode;
}

export default function PageHeader({ title, description, children, dateFilter }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative mb-6">
      <div className="relative z-10">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center">
          {title}
        </h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      

      {dateFilter && (
        <div className="absolute top-2 right-2 z-10">
          {dateFilter}
        </div>
      )}

      {children && (
        <div className="flex flex-row items-center gap-3 justify-end sm:mr-12 relative z-20 w-full sm:w-auto mt-4 md:mt-0">
          {children}
        </div>
      )}
    </div>
  );
}
