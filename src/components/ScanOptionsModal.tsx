import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, Scan, FileText, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ScanOptionsModalProps {
  onClose: () => void;
  onFileSelect: (e: any) => void;
}

export default function ScanOptionsModal({ onClose, onFileSelect }: ScanOptionsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleNativeCamera = async () => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      if (image.base64String) {
        // Create a mock event to pass to onFileSelect
        const byteCharacters = atob(image.base64String);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: `image/${image.format}` });
        const file = new File([blob], `camera_scan.${image.format}`, { type: `image/${image.format}` });

        const mockEvent = {
          target: {
            files: [file]
          }
        };
        onFileSelect(mockEvent);
      }
    } catch (error) {
      console.error('Camera error:', error);
      // Fallback to hidden input if native fails or is cancelled
      if (Capacitor.isNativePlatform()) {
        cameraInputRef.current?.click();
      }
    }
  };

  const handleNativeGallery = async () => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos
      });

      if (image.base64String) {
        const byteCharacters = atob(image.base64String);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: `image/${image.format}` });
        const file = new File([blob], `gallery_scan.${image.format}`, { type: `image/${image.format}` });

        const mockEvent = {
          target: {
            files: [file]
          }
        };
        onFileSelect(mockEvent);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      if (Capacitor.isNativePlatform()) {
        fileInputRef.current?.click();
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100000] flex items-end justify-center sm:items-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        />

        {/* Modal Content */}
        <motion.div 
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Scan size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Scan Invoice</h3>
                <p className="text-[10px] text-slate-500">Choose a method to scan</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Options List */}
          <div className="p-4 space-y-2">
            <button 
              onClick={() => Capacitor.isNativePlatform() ? handleNativeCamera() : cameraInputRef.current?.click()}
              className="w-full flex items-center p-4 rounded-2xl hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-100"
            >
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mr-4 group-hover:scale-110 transition-transform">
                <Camera size={24} />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-slate-900 block">Use Camera</span>
                <span className="text-[10px] text-slate-500">Take a photo of the invoice</span>
              </div>
            </button>

            <button 
              onClick={() => Capacitor.isNativePlatform() ? handleNativeGallery() : fileInputRef.current?.click()}
              className="w-full flex items-center p-4 rounded-2xl hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-100"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mr-4 group-hover:scale-110 transition-transform">
                <ImageIcon size={24} />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-slate-900 block">Photo Gallery</span>
                <span className="text-[10px] text-slate-500">Choose from your photos</span>
              </div>
            </button>

            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center p-4 rounded-2xl hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-100"
            >
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mr-4 group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-slate-900 block">Upload PDF or Files</span>
                <span className="text-[10px] text-slate-500">Select a document from files</span>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50/50 border-t border-slate-50">
            <button 
              onClick={onClose}
              className="w-full py-3 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>

        {/* Hidden Inputs */}
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
      </div>
    </AnimatePresence>
  );
}
