import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, Scan } from 'lucide-react';
import Drawer from './Drawer';

interface ScanOptionsModalProps {
  onClose: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ScanOptionsModal({ onClose, onFileSelect }: ScanOptionsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const footer = (
    <button 
      onClick={onClose}
      className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all text-[10px] shadow-sm"
    >
      Cancel
    </button>
  );

  return (
    <Drawer
      isOpen={true}
      onClose={onClose}
      title="Scan Invoice"
      icon={<Scan size={18} />}
      footer={footer}
      fullScreen={true}
    >
      <div className="flex flex-col items-center justify-center py-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
            <Scan size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Choose Scan Method</h3>
          <p className="text-slate-500 text-xs mt-1">Choose how you want to scan your invoice for AI processing.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <button 
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-8 border-2 border-slate-100 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group text-center"
          >
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary mb-4 transition-colors">
              <Camera size={32} />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 block">Use Camera</span>
              <span className="text-xs text-slate-500">Take a photo of the physical invoice</span>
            </div>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-8 border-2 border-slate-100 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group text-center"
          >
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary mb-4 transition-colors">
              <ImageIcon size={32} />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 block">Upload Image or PDF</span>
              <span className="text-xs text-slate-500">Select an existing image or PDF from your device</span>
            </div>
          </button>
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={onFileSelect} 
        accept="image/*,application/pdf" 
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
    </Drawer>
  );
}
