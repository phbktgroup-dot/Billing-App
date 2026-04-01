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
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  confirmVariant = 'danger',
  isLoading = false
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
        onClick={() => {
          onConfirm();
        }}
        disabled={isLoading}
        className={cn("px-6 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-lg flex items-center disabled:opacity-50", variantClasses[confirmVariant])}
      >
        {isLoading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />}
        {confirmText}
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      icon={<AlertTriangle size={18} className={cn(confirmVariant === 'danger' ? "text-red-600" : confirmVariant === 'success' ? "text-emerald-600" : "text-primary")} />}
      footer={footer}
      maxWidth="max-w-md"
    >
      <div className="py-2">
        {typeof message === 'string' ? (
          <p className="text-slate-600 text-[11px] font-medium leading-relaxed">{message}</p>
        ) : (
          message
        )}
      </div>
    </Drawer>
  );
};
