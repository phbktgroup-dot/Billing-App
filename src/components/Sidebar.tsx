import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Package, 
  Box, 
  Users, 
  Truck, 
  ShoppingCart, 
  BarChart3, 
  FileSpreadsheet, 
  Calculator, 
  FileCheck, 
  PieChart, 
  Settings, 
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Receipt
} from 'lucide-react';
import { cn } from '../lib/utils';

import { useAuth } from '../contexts/AuthContext';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: PlusCircle, label: 'Sales Create Invoice', path: '/invoices/new' },
  { icon: FileText, label: 'Sales Invoice', path: '/invoices' },
  { icon: Package, label: 'Sales Inventory', path: '/inventory' },
  { icon: Users, label: 'Sales Customer', path: '/customers' },
  { icon: Truck, label: 'Suppliers', path: '/suppliers' },
  { icon: ShoppingCart, label: 'Purchases', path: '/purchases' },
  { icon: Receipt, label: 'Expenses', path: '/expenses' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: FileSpreadsheet, label: 'GST Reports', path: '/gst-reports' },
  { icon: Calculator, label: 'ITR Tools', path: '/itr' },
  { icon: FileCheck, label: 'E-Way Bill', path: '/eway-bill' },
  { icon: PieChart, label: 'Analytics', path: '/analytics' },
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: ShieldCheck, label: 'Admin Panel', path: '/admin', adminOnly: true },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { profile, originalProfile, appSettings, settingsLoading } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const filteredMenuItems = menuItems.filter(item => {
    if (!item.adminOnly) return true;
    const effectiveProfile = originalProfile || profile;
    const hasAdminAccess = effectiveProfile?.role === 'Admin' || effectiveProfile?.role === 'Super Admin' || effectiveProfile?.is_super_admin;
    return hasAdminAccess;
  });

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isCollapsed ? '80px' : '280px',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-slate-200 z-[70] flex flex-col shadow-2xl lg:shadow-none transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo Section */}
        <div className="h-32 flex items-center justify-between px-6 border-b border-slate-100">
          <div className="flex flex-col items-center">
            {settingsLoading ? (
              <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse shrink-0" />
            ) : appSettings?.logo_url ? (
              <img 
                src={appSettings.logo_url} 
                alt="Logo" 
                className="w-10 h-10 object-contain rounded-xl shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0">
                P
              </div>
            )}
            {(!isCollapsed || isOpen) && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 font-bold text-base text-primary whitespace-nowrap overflow-hidden"
              >
                {appSettings?.app_name || 'PHBKT Billing Pro+'}
              </motion.span>
            )}
          </div>
          
          {/* Mobile Close Button */}
          <button 
            onClick={onClose}
            className="lg:hidden p-2 text-slate-400 hover:text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
          {filteredMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 1024) onClose?.();
              }}
              end={item.path === '/invoices' || item.path === '/'}
              className={({ isActive }) => cn(
                "flex items-center px-3 py-3 rounded-xl transition-all group relative",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-primary"
              )}
            >
              <item.icon size={18} className={cn("shrink-0", (isCollapsed && !isOpen) ? "mx-auto" : "mr-3")} />
              {(!isCollapsed || isOpen) && (
                <span className="font-medium text-[11px]">{item.label}</span>
              )}
              {(isCollapsed && !isOpen) && (
                <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </NavLink>
          ))}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex h-12 items-center justify-center border-t border-slate-100 text-slate-400 hover:text-primary transition-colors"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </motion.aside>
    </>
  );
}
