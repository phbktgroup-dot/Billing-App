import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary/20 selection:text-primary">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0 h-screen overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
