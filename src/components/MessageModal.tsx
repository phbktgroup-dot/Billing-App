import React from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import Drawer from './Drawer';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'success' | 'error';
}

export default function MessageModal({ isOpen, onClose, title, message, type }: MessageModalProps) {
  const footer = (
    <button
      onClick={onClose}
      className="w-full py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors text-xs"
    >
      Close
    </button>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={type === 'success' ? <CheckCircle className="text-emerald-500" size={18} /> : <AlertCircle className="text-red-500" size={18} />}
      footer={footer}
      maxWidth="max-w-md"
    >
      <div className="py-4">
        <p className="text-slate-600 text-sm">{message}</p>
      </div>
    </Drawer>
  );
}
