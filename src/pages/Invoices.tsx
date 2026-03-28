import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Trash2,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Package
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, formatCurrency, getDateRange, FilterType, downloadFile } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import { ConfirmModal } from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';
import Drawer from '../components/Drawer';
import { DateFilter } from '../components/DateFilter';
import { STATE_CODES } from '../constants/stateCodes';

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
    phone?: string;
    gstin?: string;
    address?: string;
    city?: string;
    pincode?: string;
    state?: string;
  };
  created_at: string;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  is_inter_state?: boolean;
  billing_state?: string;
  customer_state?: string;
  supply_type?: string;
  sub_supply_type?: string;
  eway_bills?: { id: string }[];
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
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const [filterType, setFilterType] = useState<FilterType>('thisMonth');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [day, setDay] = useState<string>(getLocalToday());
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [ewaySettings, setEwaySettings] = useState<any>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const businessId = profile?.business_id;

  useEffect(() => {
    const savedSettings = localStorage.getItem('business_profile_settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setEwaySettings({
        ewayBillEnabled: settings.ewayBillEnabled,
        ewayThreshold: settings.ewayThreshold || 50000
      });
    }
  }, []);

  useEffect(() => {
    if (businessId) {
      fetchInvoices();
    }
  }, [businessId, filterType, customRange, day, year]);

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id));
    }
  };

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoices(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (name, phone),
          eway_bills (id)
        `)
        .eq('business_id', businessId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
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
    setIsBulkDelete(false);
    setDeleteModalOpen(true);
  };

  const confirmBulkDelete = () => {
    setIsBulkDelete(true);
    setDeleteModalOpen(true);
  };

  const handleDownloadEwayBill = async (invoice: Invoice) => {
    try {
      // Fetch full invoice details to get customer and business info
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (*),
          invoice_items (
            *,
            products (name, sku, hsn_code, gst_rate)
          )
        `)
        .eq('id', invoice.id)
        .single();

      if (invoiceError) throw invoiceError;

      const { data: businessProfile, error: businessError } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('id', businessId)
        .single();

      if (businessError) throw businessError;

      const { data: ewayBills, error: ewayError } = await supabase
        .from('eway_bills')
        .select('*')
        .eq('invoice_id', invoice.id);
      
      if (ewayError) throw ewayError;

      // If no eway bill record, we'll pass an empty array, 
      // the generator will handle it by using defaults.
      const ewayBillsData = ewayBills || [];

      // Use the shared generator function
      const { generateEwayJSON } = await import('../lib/ewayGenerator');
      const ewayJson = generateEwayJSON([invoiceData], businessProfile, ewayBillsData, false);

      if (!ewayJson || !ewayJson.billLists || ewayJson.billLists.length === 0) {
        alert('Failed to generate E-way Bill JSON. Please check if all required data is present.');
        return;
      }

      const blob = new Blob([JSON.stringify(ewayJson, null, 2)], { type: 'application/json' });
      await downloadFile(blob, `eway_bill_${invoiceData.invoice_number}.json`);

    } catch (error: any) {
      console.error('Error generating E-way Bill JSON:', error);
      alert('Failed to generate E-way Bill JSON: ' + error.message);
    }
  };

  const getInvoicePDFData = async (invoice: Invoice) => {
    // Fetch full invoice details
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        customers (*),
        invoice_items (
          *,
          products (name, hsn_code, sku)
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
      customer_address: [
        invoiceData.customers?.address1,
        invoiceData.customers?.address2,
        [invoiceData.customers?.city, invoiceData.customers?.pincode].filter(Boolean).join(', ')
      ].filter(Boolean).join('\n'),
      payment_mode: invoiceData.payment_mode,
      items: invoiceData.invoice_items.map((item: any) => ({
        name: item.products?.name || 'Unknown Item',
        sku: item.products?.sku,
        hsnCode: item.hsn_code || item.products?.hsn_code || '',
        quantity: item.quantity,
        rate: item.unit_price,
        gstRate: item.gst_rate,
        amount: item.total_price || item.amount || 0
      })),
      subtotal: invoiceData.subtotal,
      raw_subtotal: invoiceData.subtotal + (invoiceData.discount || 0),
      discount: invoiceData.discount,
      discount_percentage: invoiceData.discount_percentage,
      tax_amount: invoiceData.tax_amount,
      cgst_amount: invoiceData.cgst_amount,
      sgst_amount: invoiceData.sgst_amount,
      igst_amount: invoiceData.igst_amount,
      is_inter_state: invoiceData.is_inter_state,
      billing_state: invoiceData.billing_state,
      customer_state: invoiceData.customer_state,
      customer_state_code: invoiceData.customers?.state 
        ? Object.entries(STATE_CODES).find(([code, name]) => name.toLowerCase() === invoiceData.customers.state.toLowerCase() || code === invoiceData.customers.state)?.[0] || ''
        : (invoiceData.customers?.gstin?.substring(0, 2) || ''),
      total: invoiceData.total,
      notes: invoiceData.notes,
      terms: invoiceData.terms
    };

    return { pdfData, businessProfile, invoiceData };
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      const { pdfData, businessProfile } = await getInvoicePDFData(invoice);
      await generateInvoicePDF(pdfData, businessProfile);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF: ' + error.message);
    }
  };

  const handleWhatsAppShare = async (invoice: Invoice) => {
    try {
      const { pdfData, businessProfile, invoiceData } = await getInvoicePDFData(invoice);

      // Generate PDF as blob for sharing
      const pdfBlob = await generateInvoicePDF(pdfData, businessProfile, true) as Blob;
      
      const customerPhone = invoiceData.customers?.phone;
      const message = `Dear ${invoiceData.customers?.name || 'Customer'},\n\nPlease find attached Invoice #${invoiceData.invoice_number} for ${formatCurrency(invoiceData.total)}.\n\nThank you for your business!`;

      // 1. Try Web Share API (Best for mobile - allows attaching the file)
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        const file = new File([pdfBlob], `Invoice_${invoiceData.invoice_number}.pdf`, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Invoice #${invoiceData.invoice_number}`,
              text: message
            });
            return; // If successful, we're done
          } catch (shareError) {
            console.log('Share cancelled or failed, falling back to direct link');
          }
        }
      }

      // 2. Fallback: Direct WhatsApp Link (Best for desktop - opens chat directly)
      if (customerPhone) {
        // Download the PDF first so the user has it ready to attach
        await generateInvoicePDF(pdfData, businessProfile);
        
        const cleanPhone = customerPhone.replace(/\D/g, '');
        // Add country code if missing (assuming India +91 if 10 digits)
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
        
        // Small delay to ensure PDF download starts before opening WhatsApp
        setTimeout(() => {
          window.open(whatsappUrl, '_blank');
        }, 1000);
      } else {
        alert('Customer phone number not found. Please add a phone number to the customer profile.');
      }
    } catch (error: any) {
      console.error('Error sharing via WhatsApp:', error);
      alert('Failed to share via WhatsApp: ' + error.message);
    }
  };

  const handleSystemShare = async (invoice: Invoice) => {
    try {
      const { pdfData, businessProfile, invoiceData } = await getInvoicePDFData(invoice);
      const pdfBlob = await generateInvoicePDF(pdfData, businessProfile, true) as Blob;
      const message = `Invoice #${invoiceData.invoice_number} for ${formatCurrency(invoiceData.total)}`;

      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        const file = new File([pdfBlob], `Invoice_${invoiceData.invoice_number}.pdf`, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Invoice #${invoiceData.invoice_number}`,
            text: message
          });
        } else {
          // Fallback to text share if file share not supported
          await navigator.share({
            title: `Invoice #${invoiceData.invoice_number}`,
            text: message,
            url: window.location.href
          });
        }
      } else {
        alert('Web Share not supported on this browser');
      }
    } catch (error: any) {
      console.error('Error sharing invoice:', error);
      alert('Failed to share invoice: ' + error.message);
    }
  };

  const deleteInvoice = async () => {
    try {
      if (isBulkDelete) {
        const { error } = await supabase
          .from('invoices')
          .delete()
          .in('id', selectedInvoices);
        
        if (error) {
          if (error.code === '23503' || error.message.includes('foreign key constraint')) {
            throw new Error('Some selected invoices cannot be deleted because they have associated items or records. Please delete those first.');
          }
          throw error;
        }
        setSelectedInvoices([]);
      } else {
        if (!invoiceToDelete) return;
        const { error } = await supabase
          .from('invoices')
          .delete()
          .eq('id', invoiceToDelete);
        if (error) {
          if (error.code === '23503' || error.message.includes('foreign key constraint')) {
            throw new Error('Cannot delete this invoice because it has associated items or records. Please delete those first.');
          }
          throw error;
        }
      }
      fetchInvoices();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      alert(error.message || 'Failed to delete invoice.');
    } finally {
      setInvoiceToDelete(null);
      setIsBulkDelete(false);
      setDeleteModalOpen(false);
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

  const totals = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0);
    const unpaid = invoices.filter(i => i.status === 'unpaid').reduce((sum, i) => sum + i.total, 0);
    const overdue = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.total, 0);
    return { paid, unpaid, overdue, total: paid + unpaid + overdue };
  }, [invoices]);

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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader 
        title="Invoices" 
        description="Manage your sales invoices, track payments, and generate professional billing documents."
        isDateFilterOpen={isDateFilterOpen}
        dateFilter={
          <DateFilter 
            filterType={filterType}
            setFilterType={setFilterType}
            day={day}
            setDay={setDay}
            year={year}
            setYear={setYear}
            customRange={customRange}
            setCustomRange={setCustomRange}
            iconOnly={true}
            isOpen={isDateFilterOpen}
            setIsOpen={setIsDateFilterOpen}
          />
        }
      >
        <div className="flex items-center space-x-2">
          
          <button 
            onClick={() => navigate('/invoices/new')}
            className="btn-primary h-10 sm:h-9"
          >
            <Plus size={14} className="mr-1.5" />
            Create Invoice
          </button>
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center space-x-4">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><FileText size={20} /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Invoices</p>
            <p className="text-lg font-bold text-slate-900">{invoices.length}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center space-x-4">
          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><CheckCircle2 size={20} /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Paid</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(totals.paid)}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center space-x-4">
          <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Clock size={20} /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Unpaid</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(totals.unpaid)}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center space-x-4">
          <div className="p-2 bg-red-100 rounded-lg text-red-600"><AlertTriangle size={20} /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Overdue</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(totals.overdue)}</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search by invoice # or customer..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            {selectedInvoices.length > 0 && (
              <button 
                onClick={confirmBulkDelete}
                className="bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-red-700 transition-all shrink-0 shadow-sm h-10 sm:h-9"
              >
                <Trash2 size={14} />
                Bulk Delete ({selectedInvoices.length})
              </button>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <select 
              className="px-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
            <div className="flex items-center space-x-2">
              <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all h-10 sm:h-9 w-10 flex items-center justify-center">
                <Filter size={16} />
              </button>
              <div className="h-4 w-[1px] bg-slate-200 mx-2"></div>
              <p className="text-[11px] font-medium text-slate-500">Showing {filteredInvoices.length} of {invoices.length} invoices</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="glass-card !overflow-visible">
        <div className="overflow-x-auto min-h-[450px] !overflow-visible">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-2.5 py-1.5 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                    checked={filteredInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-2.5 py-1.5">Invoice #</th>
                <th className="px-2.5 py-1.5">Customer</th>
                <th className="px-2.5 py-1.5">Date</th>
                <th className="px-2.5 py-1.5">Amount</th>
                <th className="px-2.5 py-1.5">Status</th>
                <th className="px-2.5 py-1.5">Payment Mode</th>
                <th className="px-2.5 py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-slate-500 text-xs">Loading invoices...</p>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-500 font-medium text-xs">No invoices found</p>
                    <button 
                      onClick={() => navigate('/invoices/new')}
                      className="text-primary text-xs font-bold mt-2 hover:underline h-10 sm:h-9"
                    >
                      Create your first invoice
                    </button>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {filteredInvoices.map((invoice) => (
                    <motion.tr 
                      key={invoice.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={cn(
                        "hover:bg-slate-50/50 transition-colors",
                        selectedInvoices.includes(invoice.id) && "bg-primary/5"
                      )}
                    >
                      <td className="px-2.5 py-1.5">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                          checked={selectedInvoices.includes(invoice.id)}
                          onChange={() => toggleSelectInvoice(invoice.id)}
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span className="text-xs font-bold text-slate-900">{invoice.invoice_number}</span>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex items-center">
                          <User size={14} className="mr-2 text-slate-400" />
                          <span className="text-xs text-slate-600">{invoice.customers?.name}</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex items-center text-xs text-slate-600">
                          <Calendar size={14} className="mr-2 text-slate-400" />
                          {new Date(invoice.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span className="text-xs font-bold text-slate-900">{formatCurrency(invoice.total)}</span>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <select 
                          className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase outline-none cursor-pointer",
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
                      <td className="px-2.5 py-1.5">
                        <span className="text-xs text-slate-600">{invoice.payment_mode || 'Cash'}</span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right relative">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => handlePreview(invoice)}
                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all h-10 sm:h-9 w-10 flex items-center justify-center"
                            title="Preview"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => handleDownloadPDF(invoice)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all h-10 sm:h-9 w-10 flex items-center justify-center"
                            title="Download PDF"
                          >
                            <Download size={16} />
                          </button>
                          {invoice.total > (ewaySettings?.ewayThreshold || 50000) && (
                            <button 
                              onClick={() => handleDownloadEwayBill(invoice)}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all h-10 sm:h-9 w-10 flex items-center justify-center"
                              title="Download E-way Bill JSON"
                            >
                              <Package size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => confirmDelete(invoice.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all h-10 sm:h-9 w-10 flex items-center justify-center"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div className="relative menu-container">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('Toggling menu for:', invoice.id);
                                setActiveMenu(activeMenu === invoice.id ? null : invoice.id);
                              }}
                              className={cn(
                                "p-2 rounded-xl transition-all h-10 sm:h-9 w-10 flex items-center justify-center",
                                activeMenu === invoice.id ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                              )}
                            >
                              <MoreVertical size={16} />
                            </button>
                            
                            {activeMenu === invoice.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-[60]" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenu(null);
                                  }}
                                />
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-[70] animate-in fade-in zoom-in duration-200 origin-top-right">
                                  <div className="px-3 py-2 mb-1 border-bottom border-slate-50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invoice Actions</p>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleWhatsAppShare(invoice);
                                      setActiveMenu(null);
                                    }}
                                    className="w-full flex items-center px-3 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors h-10 sm:h-9"
                                  >
                                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center mr-3 text-emerald-600">
                                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3z"></path>
                                      </svg>
                                    </div>
                                    <div className="text-left">
                                      <p className="font-bold">WhatsApp Share</p>
                                      <p className="text-[10px] opacity-70">Send PDF to customer</p>
                                    </div>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSystemShare(invoice);
                                      setActiveMenu(null);
                                    }}
                                    className="w-full flex items-center px-3 py-2.5 text-xs text-slate-700 hover:bg-primary/5 hover:text-primary transition-colors h-10 sm:h-9"
                                  >
                                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mr-3 text-primary">
                                      <Plus size={16} />
                                    </div>
                                    <div className="text-left">
                                      <p className="font-bold">System Share</p>
                                      <p className="text-[10px] opacity-70">Share via other apps</p>
                                    </div>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Preview Modal */}
      <Drawer
        isOpen={!!previewInvoice}
        onClose={() => setPreviewInvoice(null)}
        title={previewInvoice ? `Invoice Preview: ${previewInvoice.invoice_number}` : 'Invoice Preview'}
        icon={<FileText size={18} />}
        fullScreen={true}
      >
        {previewInvoice && (
          <div className="p-6">
            <div className="text-center py-12 text-slate-500">
              <FileText size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-xs">PDF Preview for {previewInvoice.invoice_number}</p>
              <p className="text-[11px] mt-2">This would show the generated PDF.</p>
            </div>
          </div>
        )}
      </Drawer>
      <ConfirmModal
        isOpen={deleteModalOpen}
        title={isBulkDelete ? "Bulk Delete Invoices" : "Delete Invoice"}
        message={isBulkDelete 
          ? `Are you sure you want to delete ${selectedInvoices.length} selected invoices? This action cannot be undone.`
          : "Are you sure you want to delete this invoice? This action cannot be undone."}
        onConfirm={deleteInvoice}
        onCancel={() => {
          setDeleteModalOpen(false);
          setInvoiceToDelete(null);
          setIsBulkDelete(false);
        }}
      />
    </motion.div>
  );
}
