import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import BusinessSetup from './pages/BusinessSetup';
import CreateInvoice from './pages/CreateInvoice';
import Invoices from './pages/Invoices';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Transporters from './pages/Transporters';
import Suppliers from './pages/Suppliers';
import Payments from './pages/Payments';
import Ledger from './pages/Ledger';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import GSTReports from './pages/GSTReports';
import AdminPanel from './pages/AdminPanel';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Support from './pages/Support';
import TaxTools from './pages/TaxTools';
import ITRDataEntry from './pages/ITRDataEntry';
import ITRReport from './pages/ITRReport';
import Expenses from './pages/Expenses';
// import Grow from './pages/Grow';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { useState, useEffect } from 'react';

// Auth Guard
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

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
  const isSetupPage = location.pathname === '/setup';

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
  const { profile, loading, originalProfile } = useAuth();

  if (loading) return null;
  const effectiveProfile = originalProfile || profile;
  const hasAdminAccess = effectiveProfile?.role === 'Admin' || effectiveProfile?.role === 'Super Admin' || effectiveProfile?.is_super_admin;
  if (!hasAdminAccess) return <Navigate to="/" />;

  return <>{children}</>;
};

export default function App() {
  const { appSettings } = useAuth();

  useEffect(() => {
    if (appSettings?.app_name) {
      document.title = appSettings.app_name;
    }
    
    if (appSettings?.logo_url) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (link) {
        link.href = appSettings.logo_url;
      }
    }
  }, [appSettings]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<ProtectedRoute><BusinessSetup /></ProtectedRoute>} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<CreateInvoice />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="customers" element={<Customers />} />
          <Route path="transporters" element={<Transporters />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="payments" element={<Payments />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="reports" element={<Reports />} />
          <Route path="gst-reports" element={<GSTReports />} />
          <Route path="tax-tools" element={<TaxTools />} />
          <Route path="gst" element={<TaxTools type="gst" />} />
          <Route path="itr" element={<TaxTools type="itr" />} />
          <Route path="itr-data-entry" element={<ITRDataEntry />} />
          <Route path="itr-report" element={<AdminRoute><ITRReport /></AdminRoute>} />
          <Route path="eway-bill" element={<TaxTools type="eway" />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="support" element={<Support />} />
          {/* <Route path="grow" element={<Grow />} /> */}
          <Route path="settings" element={<Settings />} />
          <Route path="admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}
