import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import BusinessSetup from './pages/BusinessSetup';
import CreateInvoice from './pages/CreateInvoice';
import Invoices from './pages/Invoices';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import AdminPanel from './pages/AdminPanel';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import TaxTools from './pages/TaxTools';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { useState, useEffect } from 'react';

// Auth Guard
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-soft">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  
  // Check if user has a business
  // We check:
  // 1. business_id column in users table
  // 2. business_profiles relation (can be array or single object)
  const hasBusiness = !!(
    profile?.business_id || 
    (Array.isArray(profile?.business_profiles) && profile.business_profiles.length > 0) ||
    (profile?.business_profiles && !Array.isArray(profile.business_profiles))
  );
  const isSetupPage = window.location.pathname === '/setup';

  // If user has no business, they need to set up their business
  if (!hasBusiness && !isSetupPage) {
    return <Navigate to="/setup" />;
  }

  // If user ALREADY has a business and is on setup page, send them to dashboard
  if (hasBusiness && isSetupPage) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

// Admin Guard
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useAuth();

  if (loading) return null;
  const hasAdminAccess = profile?.role === 'Admin' || profile?.role === 'Super Admin' || profile?.is_super_admin;
  if (!hasAdminAccess) return <Navigate to="/" />;

  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<ProtectedRoute><BusinessSetup /></ProtectedRoute>} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<CreateInvoice />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="customers" element={<Customers />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="reports" element={<Reports />} />
          <Route path="gst" element={<TaxTools type="gst" />} />
          <Route path="itr" element={<TaxTools type="itr" />} />
          <Route path="eway-bill" element={<TaxTools type="eway" />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
