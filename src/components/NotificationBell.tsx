import React, { useState, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*, notifications(*)')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }
    setNotifications(data?.filter(n => n.notifications) || []);
    setUnreadCount(data?.filter(n => n.notifications).length || 0);
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (!error) fetchNotifications();
  };

  const clearAll = async () => {
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', user?.id)
      .eq('is_read', false);
    if (!error) fetchNotifications();
  };

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 text-slate-500 hover:text-primary transition-colors">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 sm:hidden" 
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed inset-x-4 top-24 sm:absolute sm:inset-auto sm:right-0 sm:mt-2 w-auto sm:w-80 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50"
            >
              <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Notifications</h3>
              <button onClick={clearAll} className="text-[10px] text-primary font-bold hover:underline">Mark all as read</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">No notifications</div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`p-3 border-b border-slate-50 ${n.is_read ? 'bg-white' : 'bg-blue-50/50'}`}>
                    <div className="flex justify-between items-start">
                      <div className="text-xs text-slate-700 break-words">
                        {n.notifications.message.split(/(https?:\/\/[^\s]+)/g).map((part: string, i: number) => {
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
                      </div>
                      {!n.is_read && <button onClick={() => markAsRead(n.id)} className="text-primary ml-2 shrink-0"><Check size={14} /></button>}
                    </div>
                    {n.notifications.link && (
                      <a href={n.notifications.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-bold mt-1 inline-block hover:underline">View Link</a>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </div>
  );
}
