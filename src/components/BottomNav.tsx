import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Package, Menu, Plus, ShoppingCart, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Home', path: '/' },
  { icon: FileText, label: 'Invoices', path: '/invoices' },
  { isCenter: true, label: 'New Invoice', path: '/invoices/new' },
  { icon: ShoppingCart, label: 'Buy', path: '/purchases' },
  { icon: Package, label: 'Items', path: '/inventory' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/60 z-[10000] pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex justify-between items-center h-16 px-4 relative w-full">
        {navItems.map((item, index) => {
          if (item.isCenter) {
            return (
              <div key="center-btn" className="flex flex-col items-center justify-center w-full h-full relative">
                <button 
                  onClick={() => navigate(item.path)}
                  className="w-11 h-11 bg-gradient-to-tr from-primary to-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-transform mb-1"
                >
                  <Plus size={24} strokeWidth={2.5} />
                </button>
                <span className="text-[9px] font-bold text-primary uppercase tracking-tighter">Add</span>
              </div>
            );
          }
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center w-full h-full transition-all duration-200",
                isActive ? "text-primary scale-105" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {({ isActive }) => (
                <>
                  {item.icon && <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />}
                  <span className={cn("text-[9px] mt-1 truncate w-full text-center px-0.5", isActive ? "font-bold" : "font-medium")}>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
