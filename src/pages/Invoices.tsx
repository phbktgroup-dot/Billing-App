import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  MoreVertical, 
  Loader2,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { ConfirmModal } from '../components/ConfirmModal';

interface Invoice {
  id: string;
  invoice_number: string;
  date: string;
  total: number;
  status: 'unpaid' | 'paid' | 'canceled' | 'overdue';
  payment_mode?: string;
  customer_id: string;
  customers: {
    name: string;
  };
}

export default function Invoices() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);

  const businessId = profile?.business_id;

  useEffect(() => {
    if (businessId) {
      fetchInvoices();
    }
  }, [businessId]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (name)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setInvoices(data);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      alert('Failed to load invoices: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      fetchInvoices();
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert('Failed to update status: ' + error.message);
    }
  };

  const confirmDelete = (id: string) => {
    setInvoiceToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      // Fetch full invoice details
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (*),
          invoice_items (
            *,
            products (name)
          )
        `)
        .eq('id', invoice.id)
        .single();

      if (invoiceError) throw invoiceError;

      // Fetch business profile
      const { data: businessProfile, error: businessError } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('id', businessId)
        .single();

      if (businessError) throw businessError;

      // Format data for PDF generator
      const pdfData = {
        invoice_number: invoiceData.invoice_number,
        date: new Date(invoiceData.date).toISOString(),
        customer_name: invoiceData.customers?.name || 'Walk-in Customer',
        customer_gstin: invoiceData.customers?.gstin,
        payment_mode: invoiceData.payment_mode,
        items: invoiceData.invoice_items.map((item: any) => ({
          name: item.products?.name || 'Unknown Item',
          quantity: item.quantity,
          rate: item.unit_price,
          gstRate: item.gst_rate,
          amount: item.total_price || item.amount || 0
        })),
        subtotal: invoiceData.subtotal,
        tax_amount: invoiceData.tax_amount,
        total: invoiceData.total
      };

      await generateInvoicePDF(pdfData, businessProfile);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF: ' + error.message);
    }
  };

  const deleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceToDelete);
      if (error) throw error;
      fetchInvoices();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice: ' + error.message);
    } finally {
      setInvoiceToDelete(null);
    }
  };

  const handlePreview = (invoice: Invoice) => {
    setPreviewInvoice(invoice);
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         inv.customers?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'unpaid': return 'bg-orange-100 text-orange-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'canceled': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle2 size={14} className="mr-1" />;
      case 'unpaid': return <Clock size={14} className="mr-1" />;
      case 'overdue': return <AlertCircle size={14} className="mr-1" />;
      case 'canceled': return <X size={14} className="mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500">View and manage all your generated invoices.</p>
        </div>
        <button 
          onClick={() => navigate('/invoices/new')}
          className="btn-primary flex items-center"
        >
          <Plus size={18} className="mr-2" />
          Create Invoice
        </button>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by invoice # or customer..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-3">
            <select 
              className="px-4 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all">
              <Filter size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Payment Mode</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-slate-500 text-sm">Loading invoices...</p>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-500 font-medium">No invoices found</p>
                    <button 
                      onClick={() => navigate('/invoices/new')}
                      className="text-primary text-sm font-bold mt-2 hover:underline"
                    >
                      Create your first invoice
                    </button>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">{invoice.invoice_number}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <User size={14} className="mr-2 text-slate-400" />
                        <span className="text-sm text-slate-600">{invoice.customers?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-slate-600">
                        <Calendar size={14} className="mr-2 text-slate-400" />
                        {new Date(invoice.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">{formatCurrency(invoice.total)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        className={cn(
                          "px-2 py-1 rounded-lg text-xs font-bold uppercase outline-none cursor-pointer",
                          getStatusColor(invoice.status)
                        )}
                        value={invoice.status}
                        onChange={(e) => updateStatus(invoice.id, e.target.value)}
                      >
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{invoice.payment_mode || 'Cash'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => handlePreview(invoice)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                          title="Preview"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => handleDownloadPDF(invoice)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Download PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button 
                          onClick={() => confirmDelete(invoice.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900">Invoice Preview: {previewInvoice.invoice_number}</h3>
              <button onClick={() => setPreviewInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="text-center py-12 text-slate-500">
                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                <p>PDF Preview for {previewInvoice.invoice_number}</p>
                <p className="text-sm mt-2">This would show the generated PDF.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        onConfirm={deleteInvoice}
        onCancel={() => {
          setDeleteModalOpen(false);
          setInvoiceToDelete(null);
        }}
      />
    </div>
  );
}
