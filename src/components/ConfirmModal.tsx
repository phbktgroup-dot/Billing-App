import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import Drawer from './Drawer';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmVariant?: 'danger' | 'primary' | 'success';
  isLoading?: boolean;
  progress?: number;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  confirmVariant = 'danger',
  isLoading = false,
  progress = 0
}) => {
  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700',
    primary: 'bg-primary hover:bg-primary/90',
    success: 'bg-emerald-600 hover:bg-emerald-700'
  };

  const footer = (
    <div className="flex items-center justify-end space-x-3 w-full">
      <button
        onClick={onCancel}
        disabled={isLoading}
        className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={isLoading}
        className={cn(
          "px-6 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-lg flex items-center justify-center min-w-[100px] disabled:opacity-70", 
          variantClasses[confirmVariant]
        )}
      >
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Processing...</span>
          </div>
        ) : confirmText}
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={isLoading ? undefined : onCancel}
      title={title}
      icon={<AlertTriangle size={18} className={cn(confirmVariant === 'danger' ? "text-red-600" : confirmVariant === 'success' ? "text-emerald-600" : "text-primary")} />}
      footer={footer}
      maxWidth="max-w-md"
    >
      <div className="py-2 space-y-4">
        {typeof message === 'string' ? (
          <p className="text-slate-600 text-[11px] font-medium leading-relaxed">{message}</p>
        ) : (
          message
        )}

        {isLoading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
              <span>{progress < 100 ? 'Processing Request' : 'Complete'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};
