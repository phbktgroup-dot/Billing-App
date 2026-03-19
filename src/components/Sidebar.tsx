import React, { useState, useEffect } from 'react';
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
  Menu,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';

import { useAuth } from '../contexts/AuthContext';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: PlusCircle, label: 'Create Invoice', path: '/invoices/new' },
  { icon: FileText, label: 'Invoices', path: '/invoices' },
  { icon: Package, label: 'Inventory', path: '/inventory' },
  { icon: Users, label: 'Customers', path: '/customers' },
  { icon: Truck, label: 'Suppliers', path: '/suppliers' },
  { icon: ShoppingCart, label: 'Purchases', path: '/purchases' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: FileSpreadsheet, label: 'GST Reports', path: '/gst' },
  { icon: Calculator, label: 'ITR Tools', path: '/itr' },
  { icon: FileCheck, label: 'E-Way Bill', path: '/eway-bill' },
  { icon: PieChart, label: 'Analytics', path: '/analytics' },
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: ShieldCheck, label: 'Admin Panel', path: '/admin', adminOnly: true },
];

export default function Sidebar() {
  const { profile } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

  const filteredMenuItems = menuItems.filter(item => {
    if (!item.adminOnly) return true;
    const hasAdminAccess = profile?.role === 'Admin' || profile?.role === 'Super Admin' || profile?.is_super_admin;
    return hasAdminAccess;
  });

  return (
    <>
      {/* Mobile Menu Button */}
      <button 
        onClick={toggleMobile}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleMobile}
            className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isCollapsed ? '80px' : '280px',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-slate-200 z-50 flex flex-col",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 transition-transform duration-300 ease-in-out"
        )}
      >
        {/* Logo Section */}
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0">
            P
          </div>
          {!isCollapsed && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="ml-3 font-bold text-base text-primary whitespace-nowrap overflow-hidden"
            >
              PHBKT Billing Pro+
            </motion.span>
          )}
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
          {filteredMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/invoices' || item.path === '/'}
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center px-3 py-3 rounded-xl transition-all group relative",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-primary"
              )}
            >
              <item.icon size={18} className={cn("shrink-0", isCollapsed ? "mx-auto" : "mr-3")} />
              {!isCollapsed && (
                <span className="font-medium text-[11px]">{item.label}</span>
              )}
              {isCollapsed && (
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
