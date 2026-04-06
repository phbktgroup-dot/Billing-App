import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Download, Leaf, X } from 'lucide-react';
import { APP_VERSION, UPDATE_URL } from '../constants/app';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function UpdateManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [isChecking, setIsChecking] = useState(false);
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

  const getDirectDownloadUrl = (url: string) => {
    if (!url) return url;
    
    // Handle Google Drive links
    if (url.includes('drive.google.com')) {
      let fileId = '';
      
      // Pattern 1: https://drive.google.com/file/d/FILE_ID/view
      const fileMatch = url.match(/\/file\/d\/([^\/]+)/);
      if (fileMatch && fileMatch[1]) {
        fileId = fileMatch[1];
      } else {
        // Pattern 2: https://drive.google.com/open?id=FILE_ID
        const idMatch = url.match(/[?&]id=([^&]+)/);
        if (idMatch && idMatch[1]) {
          fileId = idMatch[1];
        }
      }
      
      if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }
    
    return url;
  };

  const handleUpdateNow = () => {
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isWindows = /windows/.test(ua);
    const isMac = /macintosh/.test(ua);

    if (Capacitor.isNativePlatform() || isAndroid) {
      // Android / Mobile
      const url = getDirectDownloadUrl(updateConfig.apk_url || UPDATE_URL);
      window.open(url, '_blank');
    } else if (window.electron || isWindows || isMac) {
      // Desktop (Windows/Mac)
      const url = getDirectDownloadUrl(updateConfig.exe_url || UPDATE_URL);
      if (window.electron) {
        window.electron.downloadAndUpdate(url);
      } else {
        window.open(url, '_blank');
      }
    } else {
      // Fallback
      window.open(UPDATE_URL, '_blank');
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <AnimatePresence>
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
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">VERSION {latestVersion}</p>
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
    </AnimatePresence>
  );
}
