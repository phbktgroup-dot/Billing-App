import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, Scan, X } from 'lucide-react';

interface ScanOptionsModalProps {
  onClose: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ScanOptionsModal({ onClose, onFileSelect }: ScanOptionsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center">
            <Scan className="mr-2 text-primary" />
            Scan Invoice
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-slate-500 text-xs text-center mb-6">Choose how you want to scan your invoice.</p>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary mb-3 transition-colors">
                <Camera size={24} />
              </div>
              <span className="text-sm font-medium text-slate-700">Camera</span>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary mb-3 transition-colors">
                <ImageIcon size={24} />
              </div>
              <span className="text-sm font-medium text-slate-700">Upload</span>
            </button>
          </div>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={onFileSelect} 
          accept="image/*" 
          className="hidden" 
        />
        <input 
          type="file" 
          ref={cameraInputRef} 
          onChange={onFileSelect} 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
        />
      </div>
    </div>
  );
}
