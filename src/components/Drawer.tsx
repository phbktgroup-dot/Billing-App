import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  maxWidth?: string;
}

export default function Drawer({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer, 
  icon,
  maxWidth = "max-w-none"
}: DrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex bg-slate-900/50 backdrop-blur-sm w-screen"
        >
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-white flex-1 h-full lg:ml-[280px] flex flex-col overflow-hidden shadow-2xl relative"
          >
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <h3 className="text-base font-bold text-slate-900 flex items-center">
                {icon && <span className="mr-2 text-primary">{icon}</span>}
                {title}
              </h3>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className={cn("w-full transition-all duration-300", maxWidth)}>
                {children}
              </div>
            </div>

            {footer && (
              <div className="p-3 border-t border-slate-100 flex items-center justify-end space-x-2 bg-slate-50/50 sticky bottom-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
