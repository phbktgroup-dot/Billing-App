import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import Drawer from './Drawer';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmVariant?: 'danger' | 'primary' | 'success';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Delete',
  confirmVariant = 'danger'
}) => {
  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700',
    primary: 'bg-primary hover:bg-primary/90',
    success: 'bg-emerald-600 hover:bg-emerald-700'
  };

  const footer = (
    <>
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={() => {
          onConfirm();
          onCancel();
        }}
        className={cn("px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm", variantClasses[confirmVariant])}
      >
        {confirmText}
      </button>
    </>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      icon={<AlertTriangle size={18} className={cn(confirmVariant === 'danger' ? "text-red-600" : confirmVariant === 'success' ? "text-emerald-600" : "text-primary")} />}
      footer={footer}
      maxWidth="max-w-sm"
    >
      <div className="py-4">
        <p className="text-slate-600 text-sm">{message}</p>
      </div>
    </Drawer>
  );
};
