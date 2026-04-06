import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Download, Leaf, X } from 'lucide-react';
import { APP_VERSION, UPDATE_URL } from '../constants/app';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

declare global {
  interface Window {
    electron?: {
      relaunch: () => void;
    };
  }
}

export default function UpdateManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updateConfig, setUpdateConfig] = useState<{ apk_url?: string; exe_url?: string }>({});

  useEffect(() => {
    const checkUpdate = async () => {
      if (!isSupabaseConfigured || dismissed) return;
      
      setIsChecking(true);
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('latest_version, apk_url, exe_url')
          .eq('id', 'global')
          .single();

        if (data) {
          const version = data.latest_version;
          const apkUrl = data.apk_url;
          const exeUrl = data.exe_url;

          if (version && version !== APP_VERSION) {
            setLatestVersion(version);
            setUpdateConfig({ apk_url: apkUrl, exe_url: exeUrl });
            setUpdateAvailable(true);
          }
        }
      } catch (err) {
        console.error('Update check failed:', err);
      } finally {
        setIsChecking(false);
      }
    };

    checkUpdate();
    const interval = setInterval(checkUpdate, 3600000);
    return () => clearInterval(interval);
  }, [dismissed]);

  const handleRelaunch = () => {
    if (window.electron) {
      window.electron.relaunch();
    } else {
      window.location.reload();
    }
  };

  const handleUpdateNow = () => {
    if (Capacitor.isNativePlatform()) {
      if (updateConfig.apk_url) {
        window.open(updateConfig.apk_url, '_blank');
      } else {
        window.open(UPDATE_URL, '_blank');
      }
    } else if (window.electron) {
      if (updateConfig.exe_url) {
        window.open(updateConfig.exe_url, '_blank');
      } else {
        window.open(UPDATE_URL, '_blank');
      }
    } else {
      setShowFullModal(true);
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <AnimatePresence>
      {/* Small Initial Popup */}
      {!showFullModal && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 20, x: '-50%' }}
          exit={{ opacity: 0, y: -50, x: '-50%' }}
          className="fixed top-0 left-1/2 z-[100001] w-[90%] max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary animate-bounce">
              <RefreshCw size={20} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">New Update Available</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Version {latestVersion}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setDismissed(true)}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
            <button
              onClick={handleUpdateNow}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-bold shadow-sm active:scale-95 transition-all"
            >
              Update Now
            </button>
          </div>
        </motion.div>
      )}

      {/* Full Modal (Relaunch UI) */}
      {showFullModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-[32px] shadow-2xl p-8 max-w-sm w-full text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
            </div>

            <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner">
              <Leaf size={48} className="text-slate-800" strokeWidth={1.5} />
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">
              Updated to {latestVersion}
            </h2>
            <p className="text-slate-400 text-sm mb-8 font-medium">
              Relaunch to apply
            </p>

            <div className="space-y-3">
              <button
                onClick={handleRelaunch}
                className="w-full py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95 flex items-center justify-center space-x-2"
              >
                <span>Relaunch</span>
              </button>

              <button
                onClick={() => setDismissed(true)}
                className="text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-slate-600 transition-colors pt-4 block mx-auto"
              >
                Update Later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
