import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';

// Pages
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import CreateInvoice from './pages/CreateInvoice';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Transporters from './pages/Transporters';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Expenses from './pages/Expenses';
import Payments from './pages/Payments';
import DataImport from './pages/DataImport';
import Reports from './pages/Reports';
import Ledger from './pages/Ledger';
import GSTReports from './pages/GSTReports';
import TaxTools from './pages/TaxTools';
import ITRReport from './pages/ITRReport';
import Analytics from './pages/Analytics';
import AdminPanel from './pages/AdminPanel';
import Support from './pages/Support';
import Settings from './pages/Settings';
import Login from './pages/Login';
import BusinessSetup from './pages/BusinessSetup';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-6"></div>
        <p className="text-slate-500 text-sm mb-4">Loading your profile...</p>
        {user && (
          <button 
            onClick={() => signOut()}
            className="text-xs text-slate-400 hover:text-primary underline"
          >
            Stuck? Sign Out
          </button>
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Check if user has a business linked
  // This handles manually created users in Supabase Auth/Public tables
  const hasBusiness = !!profile?.business_id;
  const isSetupPage = location.pathname.replace(/\/$/, '') === '/business-setup';

  console.log('[ProtectedRoute] State:', {
    pathname: location.pathname,
    hasBusiness,
    isSetupPage,
    hasProfile: !!profile,
    userId: user.id
  });

  if (!hasBusiness && !isSetupPage) {
    console.log('[ProtectedRoute] No business profile found, redirecting to setup...');
    return <Navigate to="/business-setup" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/business-setup" element={<ProtectedRoute><BusinessSetup /></ProtectedRoute>} />
        
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/new" element={<CreateInvoice />} />
          <Route path="/invoices/edit/:id" element={<CreateInvoice />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/transporters" element={<Transporters />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/data-import" element={<DataImport />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/gst-reports" element={<GSTReports />} />
          <Route path="/tax-tools" element={<TaxTools />} />
          <Route path="/itr-report" element={<ITRReport />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/support" element={<Support />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
}

export default App;
