import React, { useState, useRef, useEffect } from 'react';
import { Bell, User, LogOut, Search, Settings, ShieldCheck, HelpCircle, Lock, Menu, X, CheckCircle2, LogIn, RefreshCw, Calendar } from 'lucide-react';
import { cn, FilterType } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DateFilter } from './DateFilter';

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

  // Date Filter States for Notifications
  const [filterType, setFilterType] = useState<FilterType>('thisMonth');
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [day, setDay] = useState<string>(getLocalToday());
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const handleRefresh = () => {
    window.location.reload();
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Subscribe to new user-specific notifications
      const channel = supabase
        .channel(`user-notifications:${user.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchNotifications();
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
      // Fetch from unread user_notifications joined with notifications
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*, notifications(*)')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map to a flatter structure for the UI
      const mappedNotifications = data
        ?.filter(n => n.notifications) // Only show if we can read the notification content
        .map(n => ({
          ...n.notifications,
          user_notification_id: n.id,
          is_read: n.is_read
        })) || [];
      
      setNotifications(mappedNotifications);
      setUnreadCount(mappedNotifications.length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const markAsRead = async (userNotificationId: string) => {
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', userNotificationId);
    if (!error) fetchNotifications();
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
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
        "h-16 md:h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky z-[60] px-4 md:px-8 flex items-center justify-between",
        isImpersonating ? "top-[34px]" : "top-0"
      )}>
        <div className="absolute inset-0 -z-10 pointer-events-none" />
      {/* Left Section: Menu Toggle (Mobile) & Search (Desktop) */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
        >
          <Menu size={20} />
        </button>

        <div className="hidden md:flex items-center relative">
          <input 
            type="text"
            placeholder="Search anything..."
            className="bg-slate-100/50 border border-slate-200 rounded-full py-2 pl-10 pr-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white transition-all w-72"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={handleRefresh}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
        >
          <RefreshCw size={20} />
        </button>
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
            }}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-black">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              {/* Mobile Backdrop */}
              <div 
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 sm:hidden" 
                onClick={() => setShowNotifications(false)}
              />
              
              <div className="fixed inset-0 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-full h-full sm:h-auto sm:w-96 !bg-white sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 z-[110] flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden opacity-100">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                  </div>
                  <div className="flex items-center space-x-4">
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-[11px] text-primary font-bold hover:underline">
                        Mark all as read
                      </button>
                    )}
                    <button onClick={() => setShowNotifications(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 sm:hidden">
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto sm:max-h-[480px]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Bell size={16} className="text-slate-600" />
                    </div>
                    <p className="text-[10px] text-slate-500">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map((notif) => (
                      <div key={notif.user_notification_id} className={cn(
                        "p-4 hover:bg-slate-50 transition-colors cursor-default",
                        !notif.is_read && "bg-primary/5"
                      )}>
                        <div className="flex items-start space-x-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            notif.is_read ? "bg-slate-100 text-slate-500" : "bg-primary/10 text-primary"
                          )}>
                            <Bell size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-slate-900 truncate">{notif.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed break-words">
                              {notif.message.split(/(https?:\/\/[^\s]+)/g).map((part: string, i: number) => {
                                if (part.match(/https?:\/\/[^\s]+/)) {
                                  return (
                                    <a 
                                      key={i} 
                                      href={part} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-primary hover:underline font-medium"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {part}
                                    </a>
                                  );
                                }
                                return part;
                              })}
                            </p>
                            {notif.link && (
                              <a href={notif.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-bold mt-1 inline-block hover:underline">View Link</a>
                            )}
                            <div className="flex justify-between items-center mt-1.5">
                              <p className="text-[9px] text-slate-500 flex items-center">
                                <CheckCircle2 size={10} className={cn("mr-1", notif.is_read ? "text-emerald-500" : "text-slate-600")} />
                                {new Date(notif.created_at).toLocaleDateString()}
                              </p>
                              {!notif.is_read && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notif.user_notification_id);
                                  }}
                                  className="text-[9px] font-bold text-primary hover:underline"
                                >
                                  Mark as read
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {notifications.length > 0 && (
                <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
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
            <p className="text-sm font-semibold text-slate-900 hover:text-primary transition-colors">
              {profile?.name || user?.email?.split('@')[0] || 'Admin User'}
            </p>
            <p className="text-xs text-slate-500 font-medium">{profile?.business_profiles?.name || 'PHBKT Group Ltd'}</p>
          </div>
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-primary/10 hover:text-primary transition-all overflow-hidden border border-slate-200 shadow-sm">
            {profile?.business_profiles?.logo_url ? (
              <img src={profile.business_profiles.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <User size={20} />
            )}
          </div>

          {/* Click Dropdown for Logout */}
          {showMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 !bg-white rounded-xl shadow-xl border border-slate-100 transition-all z-[100] p-2 opacity-100">
              <button onClick={() => { navigate('/settings'); setShowMenu(false); }} className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                <Settings size={16} />
                <span>Setting</span>
              </button>
              <button onClick={() => { navigate('/settings?tab=security'); setShowMenu(false); }} className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                <Lock size={16} />
                <span>Change password</span>
              </button>
              {(profile?.role === 'Admin' || profile?.role === 'Super Admin' || profile?.is_super_admin || originalProfile?.role === 'Admin' || originalProfile?.role === 'Super Admin' || originalProfile?.is_super_admin) && (
                <button onClick={() => { navigate('/admin'); setShowMenu(false); }} className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                  <ShieldCheck size={16} />
                  <span>Admin Panel</span>
                </button>
              )}
              <button onClick={() => { navigate('/support'); setShowMenu(false); }} className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                <HelpCircle size={16} />
                <span>Help & Support</span>
              </button>
              <div className="h-[1px] bg-slate-100 my-1"></div>
              {isImpersonating && (
                <button 
                  onClick={() => { stopImpersonating(); setShowMenu(false); }} 
                  className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  <span>Exit Impersonation</span>
                </button>
              )}
              <button 
                onClick={handleSignOut}
                className="w-full flex items-center space-x-3 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
