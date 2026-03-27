import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears, isSameDay } from 'date-fns';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { cn } from '../lib/utils';

type FilterType = 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'last7Days' | 'last30Days' | 'day' | 'custom' | 'year';

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
}

export const DateFilter: React.FC<DateFilterProps> = ({
  filterType, setFilterType, day, setDay, year, setYear, customRange, setCustomRange, className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'presets' | 'date' | 'range' | 'year'>('presets');
  
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
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetSelect = (type: FilterType) => {
    setFilterType(type);
    setIsOpen(false);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setDay(format(date, 'yyyy-MM-dd'));
      setFilterType('day');
      setIsOpen(false);
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

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 shadow-sm flex items-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95",
          className?.includes('w-full') && "w-full justify-center"
        )}
      >
        <CalendarIcon size={16} className="text-primary" />
        {getLabel()}
      </button>

      {isOpen && (
        <>
          {/* Mobile Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 sm:hidden" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="fixed inset-x-4 top-[15%] sm:absolute sm:inset-auto sm:right-0 sm:mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 w-auto sm:w-[340px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
            
            {/* Tabs */}
          <div className="flex border-b border-slate-100 p-1 bg-slate-50/50">
            <button 
              onClick={() => setActiveTab('presets')}
              className={cn(
                "flex-1 py-2 text-[11px] font-bold rounded-xl transition-all",
                activeTab === 'presets' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              )}
            >
              Presets
            </button>
            <button 
              onClick={() => setActiveTab('date')}
              className={cn(
                "flex-1 py-2 text-[11px] font-bold rounded-xl transition-all",
                activeTab === 'date' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              )}
            >
              Date
            </button>
            <button 
              onClick={() => setActiveTab('range')}
              className={cn(
                "flex-1 py-2 text-[11px] font-bold rounded-xl transition-all",
                activeTab === 'range' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              )}
            >
              Range
            </button>
            <button 
              onClick={() => setActiveTab('year')}
              className={cn(
                "flex-1 py-2 text-[11px] font-bold rounded-xl transition-all",
                activeTab === 'year' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              )}
            >
              Year
            </button>
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
                  captionLayout="dropdown"
                  fromYear={1900}
                  toYear={2100}
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
                  captionLayout="dropdown"
                  fromYear={1900}
                  toYear={2100}
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
      </>
    )}
  </div>
  );
};
