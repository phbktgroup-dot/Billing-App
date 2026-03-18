import React from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'success' | 'error';
}

export default function MessageModal({ isOpen, onClose, title, message, type }: MessageModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {type === 'success' ? (
              <CheckCircle className="text-emerald-500" size={24} />
            ) : (
              <AlertCircle className="text-red-500" size={24} />
            )}
            <h3 className="font-bold text-lg text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-slate-600 mb-6">{message}</p>
        <button
          onClick={onClose}
          className="w-full py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
