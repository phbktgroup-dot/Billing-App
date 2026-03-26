import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  Receipt,
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
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: FileSpreadsheet, label: 'GST Reports', path: '/gst-reports' },
  { icon: Calculator, label: 'Tax Tools', path: '/gst' },
  { icon: FileCheck, label: 'E-Way Bill', path: '/eway-bill' },
  { icon: FileText, label: 'ITR Report', path: '/itr-report', adminOnly: true },
  { icon: PieChart, label: 'Analytics', path: '/analytics' },
  { icon: HelpCircle, label: 'Help & Support', path: '/support' },
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
  const [showTopMenu, setShowTopMenu] = useState(false);
  const topMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (topMenuRef.current && !topMenuRef.current.contains(event.target as Node)) {
        setShowTopMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarVariants = {
    expanded: { width: 280, x: 0 },
    collapsed: { width: 80, x: 0 },
    mobileOpen: { width: 280, x: 0 },
    mobileClosed: { width: 280, x: -280 },
  };

  const currentVariant = isOpen 
    ? 'mobileOpen' 
    : (windowWidth < 1024 ? 'mobileClosed' : (isCollapsed ? 'collapsed' : 'expanded'));

  useEffect(() => {
    const width = (windowWidth >= 1024) 
      ? (isCollapsed ? '80px' : '280px')
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
          "fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-slate-200 z-[70] flex flex-col shadow-2xl lg:shadow-none overflow-hidden",
          !isOpen && "lg:translate-x-0"
        )}
      >
        {/* Logo Section / Top Left Menu */}
        <div className={cn(
          "h-20 flex items-center border-b border-slate-100 transition-all duration-300 relative",
          (isCollapsed && !isOpen) ? "justify-center px-0" : "justify-between px-6"
        )} ref={topMenuRef}>
          <div className="flex items-center">
            <button 
              onClick={() => setShowTopMenu(!showTopMenu)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              <Menu size={20} />
            </button>

            <AnimatePresence>
              {showTopMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute top-full left-4 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] p-2 overflow-hidden"
                >
                  {['File', 'Edit', 'View', 'Help'].map((item) => (
                    <button
                      key={item}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-colors group"
                    >
                      <span>{item}</span>
                      <ChevronRight size={14} className="text-slate-400 group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Mobile Close Button */}
          {isOpen && (
            <button 
              onClick={onClose}
              className="lg:hidden p-2 text-slate-400 hover:text-primary transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
          {filteredMenuItems.filter(item => item.path !== '/support').map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 1024) onClose?.();
              }}
              end={item.path === '/invoices' || item.path === '/'}
              className={({ isActive }) => cn(
                "flex items-center py-3 rounded-xl transition-all group relative",
                (isCollapsed && !isOpen) ? "px-0 justify-center" : "px-3",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-primary"
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

        {/* Support Section at Bottom */}
        <div className="px-3 py-1 border-t border-slate-100">
          <NavLink
            to="/support"
            onClick={() => {
              if (window.innerWidth < 1024) onClose?.();
            }}
            className={({ isActive }) => cn(
              "flex items-center py-1.5 rounded-xl transition-all group relative",
              (isCollapsed && !isOpen) ? "px-0 justify-center" : "px-3",
              isActive 
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "text-slate-600 hover:bg-slate-50 hover:text-primary"
            )}
          >
            <HelpCircle size={18} className={cn("shrink-0", (isCollapsed && !isOpen) ? "" : "mr-3")} />
            {(!isCollapsed || isOpen) && (
              <span className="font-medium text-[11px] truncate">Help & Support</span>
            )}
            {(isCollapsed && !isOpen) && (
              <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                Help & Support
              </div>
            )}
          </NavLink>
        </div>

        {/* Collapse Toggle */}
        <div className="hidden lg:block border-t border-slate-100">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSidebar();
            }}
            className="flex h-12 w-full items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-50 transition-all cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
              {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </div>
          </button>
        </div>
      </motion.aside>
    </>
  );
}
