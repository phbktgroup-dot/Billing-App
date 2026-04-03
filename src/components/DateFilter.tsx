import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { FilterIcon } from './icons/FilterIcon';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears, isSameDay } from 'date-fns';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { cn, FilterType } from '../lib/utils';

interface DateFilterProps {
  filterType: FilterType;
  setFilterType: (type: FilterType) => void;
  day: string;
  setDay: (day: string) => void;
  year: number;
  setYear: (year: number) => void;
  customRange: { start: string, end: string };
  setCustomRange: (range: { start: string, end: string }) => void;
  className?: string;
  iconOnly?: boolean;
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => void;
  allowedTabs?: ('presets' | 'date' | 'range' | 'year')[];
  onSelect?: () => void;
}

export const DateFilter: React.FC<DateFilterProps> = ({
  filterType, setFilterType, day, setDay, year, setYear, customRange, setCustomRange, className, iconOnly, isOpen: externalIsOpen, setIsOpen: externalSetIsOpen, allowedTabs, onSelect
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalSetIsOpen || setInternalIsOpen;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'presets' | 'date' | 'range' | 'year'>(allowedTabs ? allowedTabs[0] : 'presets');
  
  useEffect(() => {
    if (allowedTabs && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [allowedTabs]);
  const parseDateString = (dateStr: string) => {
    if (!dateStr) return undefined;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(day ? parseDateString(day) : new Date());
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>({
    from: parseDateString(customRange.start),
    to: parseDateString(customRange.end)
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!document.contains(target)) return; // Ignore clicks on elements removed from DOM
      if (dropdownRef.current && !dropdownRef.current.contains(target) && 
          portalRef.current && !portalRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetSelect = (type: FilterType) => {
    setFilterType(type);
    setIsOpen(false);
    onSelect?.();
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setDay(format(date, 'yyyy-MM-dd'));
      setFilterType('day');
      setIsOpen(false);
      onSelect?.();
    }
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setSelectedRange(range);
    if (range?.from && range?.to) {
      setCustomRange({
        start: format(range.from, 'yyyy-MM-dd'),
        end: format(range.to, 'yyyy-MM-dd')
      });
      setFilterType('custom');
      // Don't close immediately on range select to allow user to see selection
    }
  };

  const applyRange = () => {
    if (selectedRange?.from && selectedRange?.to) {
      setCustomRange({
        start: format(selectedRange.from, 'yyyy-MM-dd'),
        end: format(selectedRange.to, 'yyyy-MM-dd')
      });
      setFilterType('custom');
      setIsOpen(false);
      onSelect?.();
    }
  };

  const getLabel = () => {
    switch (filterType) {
      case 'thisMonth': return 'This Month';
      case 'lastMonth': return 'Last Month';
      case 'thisYear': return 'This Year';
      case 'lastYear': return 'Last Year';
      case 'last7Days': return 'Last 7 Days';
      case 'last30Days': return 'Last 30 Days';
      case 'year': return `Year ${year}`;
      case 'day': {
        if (!day) return 'Select Date';
        const [y, m, d] = day.split('-').map(Number);
        return format(new Date(y, m - 1, d), 'MMM dd, yyyy');
      }
      case 'custom': 
        if (customRange.start && customRange.end) {
          const [sy, sm, sd] = customRange.start.split('-').map(Number);
          const [ey, em, ed] = customRange.end.split('-').map(Number);
          return `${format(new Date(sy, sm - 1, sd), 'MMM dd')} - ${format(new Date(ey, em - 1, ed), 'MMM dd, yyyy')}`;
        }
        return 'Custom Range';
      default: return 'Filter';
    }
  };

  const presets = [
    { id: 'thisMonth', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'thisYear', label: 'This Year' },
    { id: 'lastYear', label: 'Last Year' },
    { id: 'last7Days', label: 'Last 7 Days' },
    { id: 'last30Days', label: 'Last 30 Days' },
  ];

  const dialogContent = isOpen && (
    <div ref={portalRef}>
      {/* Mobile Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998] sm:hidden" 
        onClick={() => setIsOpen(false)}
      />
      
      <div className="fixed inset-0 sm:top-20 sm:right-4 sm:bottom-auto sm:left-auto w-full h-full sm:h-auto sm:w-[340px] bg-white sm:rounded-2xl shadow-2xl border border-slate-200 z-[9999] flex flex-col duration-200 overflow-hidden opacity-100">
        
        {/* Mobile Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 sm:hidden">
          <h3 className="text-sm font-bold text-slate-900">Filter by Date</h3>
          <button onClick={() => setIsOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
      <div className="flex border-b border-slate-100 p-1 bg-slate-50/50">
        {(!allowedTabs || allowedTabs.includes('presets')) && (
          <button 
            onClick={() => setActiveTab('presets')}
            className={cn(
              "flex-1 py-2 text-[11px] font-bold rounded-xl transition-all",
              activeTab === 'presets' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            )}
          >
            Presets
          </button>
        )}
        {(!allowedTabs || allowedTabs.includes('date')) && (
          <button 
            onClick={() => setActiveTab('date')}
            className={cn(
              "flex-1 py-2 text-[11px] font-bold rounded-xl transition-all",
              activeTab === 'date' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            )}
          >
            Date
          </button>
        )}
        {(!allowedTabs || allowedTabs.includes('range')) && (
          <button 
            onClick={() => setActiveTab('range')}
            className={cn(
              "flex-1 py-2 text-[11px] font-bold rounded-xl transition-all",
              activeTab === 'range' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            )}
          >
            Range
          </button>
        )}
        {(!allowedTabs || allowedTabs.includes('year')) && (
          <button 
            onClick={() => setActiveTab('year')}
            className={cn(
              "flex-1 py-2 text-[11px] font-bold rounded-xl transition-all",
              activeTab === 'year' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            )}
          >
            Year
          </button>
        )}
      </div>

      <div className="p-4">
        {activeTab === 'presets' && (
          <div className="space-y-1">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id as FilterType)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between transition-colors",
                  filterType === preset.id 
                    ? "bg-primary/10 text-primary" 
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                {preset.label}
                {filterType === preset.id && <Check size={16} />}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'date' && (
          <div className="flex flex-col items-center">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="border-0 p-3"
              startMonth={new Date(1900, 0)}
              endMonth={new Date(2100, 11)}
              captionLayout="dropdown"
            />
          </div>
        )}

        {activeTab === 'range' && (
          <div className="flex flex-col items-center">
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={handleRangeSelect}
              className="border-0 p-3"
              startMonth={new Date(1900, 0)}
              endMonth={new Date(2100, 11)}
              captionLayout="dropdown"
            />
            <div className="w-full mt-4 pt-4 border-t border-slate-100 flex justify-end">
              <button 
                onClick={applyRange}
                disabled={!selectedRange?.from || !selectedRange?.to}
                className="btn-primary py-2 px-4 text-xs disabled:opacity-50"
              >
                Apply Range
              </button>
            </div>
          </div>
        )}

        {activeTab === 'year' && (
          <div className="flex flex-col items-center p-4">
            <div className="grid grid-cols-3 gap-2 w-full max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
              {Array.from({ length: 201 }, (_, i) => 1900 + i).map(y => (
                <button
                  key={y}
                  onClick={() => {
                    setYear(y);
                    setFilterType('year');
                    setIsOpen(false);
                    onSelect?.();
                  }}
                  className={cn(
                    "py-3 rounded-xl text-sm font-medium transition-colors",
                    year === y && filterType === 'year'
                      ? "bg-primary text-white shadow-sm"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          iconOnly 
            ? "p-2 rounded-full hover:bg-slate-100 transition-all active:scale-95 text-primary"
            : "bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 shadow-sm flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95",
          className
        )}
      >
        <FilterIcon size={iconOnly ? 20 : 16} className={cn("text-primary", className?.includes('text-') && "text-inherit")} />
        {!iconOnly && getLabel()}
      </button>

      {createPortal(dialogContent, document.body)}
    </div>
  );
};
