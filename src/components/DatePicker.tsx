import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { format, parse, isValid, parseISO } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  className,
  placeholder = 'DD/MM/YYYY'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // Sync internal input value with external value
  useEffect(() => {
    if (value) {
      try {
        const date = parseISO(value);
        if (isValid(date)) {
          setInputValue(format(date, 'dd/MM/yyyy'));
        }
      } catch (e) {
        console.error('Invalid date value:', value);
      }
    } else {
      setInputValue('');
    }
  }, [value]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = 350; // approximate height
        
        let style: React.CSSProperties = {
          position: 'fixed',
          left: rect.left,
          zIndex: 99999,
          minWidth: '300px'
        };

        if (spaceBelow < dropdownHeight && rect.top > spaceBelow) {
          style.bottom = window.innerHeight - rect.top + 8;
        } else {
          style.top = rect.bottom + 8;
        }
        
        // Ensure it doesn't go off screen horizontally
        if (rect.left + 300 > window.innerWidth) {
          style.left = undefined;
          style.right = window.innerWidth - rect.right;
        }

        setDropdownStyle(style);
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target) && 
          dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Try to parse if it's a complete date
    if (val.length === 10) {
      const parsedDate = parse(val, 'dd/MM/yyyy', new Date());
      if (isValid(parsedDate)) {
        onChange(format(parsedDate, 'yyyy-MM-dd'));
      }
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setIsOpen(false);
    }
  };

  const selectedDate = value ? parseISO(value) : undefined;

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div className="relative">
        <CalendarIcon 
          size={12} 
          className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-primary transition-colors" 
          onClick={() => setIsOpen(!isOpen)}
        />
        <input 
          type="text" 
          placeholder={placeholder}
          className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 font-medium placeholder:text-slate-400"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
        />
      </div>

      {isOpen && createPortal(
        <AnimatePresence>
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={dropdownStyle}
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="p-2">
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className="border-0 m-0"
                captionLayout="dropdown"
                startMonth={new Date(1900, 0)}
                endMonth={new Date(2100, 11)}
                footer={
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 w-full">
                    <button 
                      onClick={() => {
                        onChange('');
                        setIsOpen(false);
                      }}
                      className="text-primary text-xs font-bold hover:underline transition-all"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={() => handleDateSelect(new Date())}
                      className="text-primary text-xs font-bold hover:underline transition-all"
                    >
                      Today
                    </button>
                  </div>
                }
              />
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
