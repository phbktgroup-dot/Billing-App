import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
  const { user, loading, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user && !profile?.business_id && window.location.pathname !== '/business-setup') {
    return <Navigate to="/business-setup" />;
  }

  return <>{children}</>;
}

function App() {
  return (
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/business-setup" element={<BusinessSetup />} />
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
