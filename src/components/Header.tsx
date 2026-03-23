import React, { useState, useRef, useEffect } from 'react';
import { Bell, User, LogOut, Search, Settings, ShieldCheck, HelpCircle, Lock, Menu, X, CheckCircle2, LogIn } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, profile, signOut, isImpersonating, stopImpersonating, originalProfile } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Subscribe to new notifications
      const channel = supabase
        .channel('public:notifications')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications' 
        }, (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id]);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      // DEBUG: Fetch directly from notifications table
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('DEBUG: Notifications:', data);
      
      setNotifications(data || []);
      setUnreadCount(data?.length || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (!error) fetchNotifications();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
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
    <>
      {isImpersonating && (
        <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider z-[60] sticky top-0">
          <div className="flex items-center">
            <ShieldCheck size={14} className="mr-2" />
            <span>Impersonating: {profile?.name || profile?.email}</span>
            <span className="mx-2 opacity-50">|</span>
            <span>Original Admin: {originalProfile?.name || originalProfile?.email}</span>
          </div>
          <button 
            onClick={stopImpersonating}
            className="bg-white text-emerald-600 px-3 py-1 rounded-lg hover:bg-emerald-50 transition-all flex items-center"
          >
            <LogOut size={12} className="mr-1.5" />
            Exit Profile
          </button>
        </div>
      )}
      <header className={cn(
        "h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky z-30 px-4 md:px-6 flex items-center justify-between",
        isImpersonating ? "top-[34px]" : "top-0"
      )}>
      {/* Left Section: Menu Toggle (Mobile) & Search (Desktop) */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
        >
          <Menu size={20} />
        </button>

        <div className="hidden md:flex items-center relative">
          <input 
            type="text"
            placeholder="Search..."
            className="bg-slate-100 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all w-64"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-4">
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) setUnreadCount(0);
            }}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>

          {showNotifications && (
            <>
              {/* Mobile Backdrop */}
              <div 
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 sm:hidden" 
                onClick={() => setShowNotifications(false)}
              />
              
              <div className="fixed inset-x-4 top-24 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-900">Notifications</h3>
                <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Bell size={16} className="text-slate-300" />
                    </div>
                    <p className="text-[10px] text-slate-500">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifications.map((notif) => (
                      <div key={notif.id} className="p-4 hover:bg-slate-50 transition-colors cursor-default">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                            <Bell size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-slate-900 truncate">{notif.title}</p>
                            <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
                            {notif.link && (
                              <a href={notif.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-bold mt-1 inline-block hover:underline">View Link</a>
                            )}
                            <div className="flex justify-between items-center mt-1.5">
                              <p className="text-[9px] text-slate-400 flex items-center">
                                <CheckCircle2 size={10} className="mr-1 text-emerald-500" />
                                {new Date(notif.created_at).toLocaleDateString()}
                              </p>
                              {/* Clear button disabled for debug */}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {notifications.length > 0 && (
                <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                  <button className="text-[10px] font-bold text-primary hover:underline">
                    View All Notifications
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
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
              <button onClick={() => { navigate('/settings?tab=security'); setShowMenu(false); }} className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                <Lock size={16} />
                <span>Change password</span>
              </button>
              {(profile?.role === 'Admin' || profile?.role === 'Super Admin' || profile?.is_super_admin || originalProfile?.role === 'Admin' || originalProfile?.role === 'Super Admin' || originalProfile?.is_super_admin) && (
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
              {isImpersonating && (
                <button 
                  onClick={() => { stopImpersonating(); setShowMenu(false); }} 
                  className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  <span>Exit Impersonation</span>
                </button>
              )}
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
    </>
  );
}
