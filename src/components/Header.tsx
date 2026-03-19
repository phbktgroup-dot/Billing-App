import React, { useState, useRef, useEffect } from 'react';
import { Bell, User, LogOut, Search, Settings, ShieldCheck, HelpCircle, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-6 flex items-center justify-end md:justify-between">
      {/* Search Box */}
      <div className="hidden md:flex items-center relative">
        <input 
          type="text"
          placeholder="Search..."
          className="bg-slate-100 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all w-64"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-4">
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

        <div 
          ref={menuRef}
          className="flex items-center space-x-3 cursor-pointer relative"
          onClick={() => setShowMenu(!showMenu)}
        >
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-900 hover:text-primary transition-colors">
              {profile?.name || user?.email?.split('@')[0] || 'Admin User'}
            </p>
            <p className="text-[11px] text-slate-500">{profile?.business_profiles?.name || 'PHBKT Group Ltd'}</p>
          </div>
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 hover:bg-primary/10 hover:text-primary transition-all overflow-hidden">
            {profile?.business_profiles?.logo_url ? (
              <img src={profile.business_profiles.logo_url} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <User size={20} />
            )}
          </div>

          {/* Click Dropdown for Logout */}
          {showMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 transition-all z-50 p-2">
              <button onClick={() => { navigate('/settings'); setShowMenu(false); }} className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                <Settings size={16} />
                <span>Setting</span>
              </button>
              <button onClick={() => { navigate('/settings'); setShowMenu(false); }} className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                <Lock size={16} />
                <span>Change password</span>
              </button>
              {(profile?.role === 'Admin' || profile?.role === 'Super Admin' || profile?.is_super_admin) && (
                <button onClick={() => { navigate('/admin'); setShowMenu(false); }} className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  <ShieldCheck size={16} />
                  <span>Admin Panel</span>
                </button>
              )}
              <button onClick={() => { navigate('/support'); setShowMenu(false); }} className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                <HelpCircle size={16} />
                <span>Help/Support</span>
              </button>
              <div className="h-[1px] bg-slate-100 my-1"></div>
              <button 
                onClick={handleSignOut}
                className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
