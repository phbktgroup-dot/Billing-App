import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  FileUp,
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
  Receipt,
  CreditCard,
  BookOpen,
  HelpCircle,
  Menu
} from 'lucide-react';
import { cn } from '../lib/utils';

import { useAuth } from '../contexts/AuthContext';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: PlusCircle, label: 'Sales Create Invoice', path: '/invoices/new' },
  { icon: FileText, label: 'Sales Invoice', path: '/invoices' },
  { icon: Package, label: 'Sales Inventory', path: '/inventory' },
  { icon: Users, label: 'Sales Customer', path: '/customers' },
  { icon: Truck, label: 'Transporters', path: '/transporters' },
  { icon: Truck, label: 'Suppliers', path: '/suppliers' },
  { icon: ShoppingCart, label: 'Purchases', path: '/purchases' },
  { icon: Receipt, label: 'Expenses', path: '/expenses' },
  { icon: CreditCard, label: 'Payments & Receipts', path: '/payments' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: BookOpen, label: 'Ledger', path: '/ledger' },
  { icon: FileSpreadsheet, label: 'GST Reports', path: '/gst-reports' },
  { icon: Calculator, label: 'Tax tool', path: '/tax-tools' },
  { icon: FileCheck, label: 'E-Way Bill', path: '/eway-bill' },
  { icon: FileText, label: 'ITR Report', path: '/itr-report', adminOnly: true },
  { icon: PieChart, label: 'Analytics', path: '/analytics' },
  { icon: ShieldCheck, label: 'Admin Panel', path: '/admin', adminOnly: true },
  { icon: HelpCircle, label: 'Help & Support', path: '/support' },
  { icon: Settings, label: 'Settings', path: '/settings' },
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

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const filteredMenuItems = menuItems.filter(item => {
    if (!item.adminOnly) return true;
    const effectiveProfile = originalProfile || profile;
    const hasAdminAccess = effectiveProfile?.role === 'Admin' || effectiveProfile?.role === 'Super Admin' || effectiveProfile?.is_super_admin;
    return hasAdminAccess;
  });

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarVariants = {
    expanded: { width: 240, x: 0 },
    collapsed: { width: 72, x: 0 },
    mobileOpen: { width: 240, x: 0 },
    mobileClosed: { width: 240, x: -240 },
  };

  const currentVariant = isOpen 
    ? 'mobileOpen' 
    : (windowWidth < 1024 ? 'mobileClosed' : (isCollapsed ? 'collapsed' : 'expanded'));

  useEffect(() => {
    const width = (windowWidth >= 1024) 
      ? (isCollapsed ? '72px' : '240px')
      : '0px';
    document.documentElement.style.setProperty('--sidebar-width', width);
  }, [isCollapsed, windowWidth]);

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
        animate={currentVariant}
        variants={sidebarVariants}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen bg-[#4D2152] z-[70] flex flex-col shadow-2xl lg:shadow-none overflow-hidden",
          !isOpen && "lg:translate-x-0"
        )}
      >
        {/* Logo Section / Top Left Menu */}
        <div className={cn(
          "h-16 md:h-16 flex items-center transition-all duration-300 relative",
          (isCollapsed && !isOpen) ? "justify-center px-0" : "px-4"
        )}>
          <div className={cn("flex items-center w-full overflow-hidden", (isCollapsed && !isOpen) ? "justify-center" : "gap-3")}>
            <button 
              onClick={() => {
                if (windowWidth < 1024) {
                  onClose?.();
                } else {
                  toggleSidebar();
                }
              }}
              className="p-1 text-white/70 hover:bg-white/10 rounded-xl transition-all shrink-0 flex items-center justify-center"
            >
              {profile?.business_profiles?.logo_url || appSettings?.logo_url ? (
                <img 
                  src={profile?.business_profiles?.logo_url || appSettings?.logo_url} 
                  alt="Logo" 
                  className="w-8 h-8 object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Menu size={20} />
              )}
            </button>

            {(!isCollapsed || isOpen) && (
              <div className="flex items-center justify-between flex-1 min-w-0">
                <motion.span 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-bold text-white text-sm truncate pr-2"
                >
                  {appSettings?.app_name || 'Billing Pro+'}
                </motion.span>
              </div>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <div className={cn(
          "flex-1 overflow-y-auto py-2 space-y-1 scrollbar-hide",
          (isCollapsed && !isOpen) ? "px-2" : "px-3"
        )}>
          {filteredMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 1024) onClose?.();
              }}
              end={item.path === '/invoices' || item.path === '/'}
              className={({ isActive }) => cn(
                "flex items-center rounded-xl transition-all group relative",
                (isCollapsed && !isOpen) ? "h-10 justify-center" : "py-3 px-3",
                isActive 
                  ? "bg-[#3D1A41] text-white shadow-lg shadow-black/20" 
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon size={18} className={cn("shrink-0", (isCollapsed && !isOpen) ? "" : "mr-3")} />
              {(!isCollapsed || isOpen) && (
                <span className="font-medium text-[11px] truncate">{item.label}</span>
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
        <div className="hidden lg:block">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSidebar();
            }}
            className="flex h-7 w-full items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </div>
          </button>
        </div>
      </motion.aside>
    </>
  );
}
