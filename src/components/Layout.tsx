import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-2 md:p-4">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
