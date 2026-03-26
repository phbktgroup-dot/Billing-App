import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  fullScreen?: boolean;
  children: React.ReactNode;
}

const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  footer,
  maxWidth = 'max-w-md',
  fullScreen = false,
  children
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "fixed inset-0 z-50 flex items-center justify-center transition-all duration-300",
              fullScreen ? "p-0" : "p-4 md:p-8"
            )}
            style={{ 
              left: 'var(--sidebar-width, 0px)',
              width: 'calc(100% - var(--sidebar-width, 0px))'
            }}
          >
            <div 
              className={cn(
                "bg-white shadow-2xl flex flex-col w-full overflow-hidden",
                fullScreen ? "h-full max-w-none" : cn("max-h-[90vh] rounded-2xl", maxWidth)
              )}
              ref={drawerRef}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center space-x-3">
                  {icon && <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">{icon}</div>}
                  <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {children}
              </div>
              
              {footer && (
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3 shrink-0">
                  {footer}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Drawer;
