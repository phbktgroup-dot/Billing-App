import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  CreditCard, 
  ArrowDownLeft, 
  ArrowUpRight,
  Calendar,
  User,
  MoreVertical,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, cn } from '../lib/utils';
import PageHeader from '../components/PageHeader';
import Drawer from '../components/Drawer';
import { ConfirmModal } from '../components/ConfirmModal';

interface Payment {
  id: string;
  amount: number;
  date: string;
  payment_mode: string;
  reference_number?: string;
  notes?: string;
  customer_id?: string;
  supplier_id?: string;
  type: 'receipt' | 'payment';
  customers?: { name: string };
  suppliers?: { name: string };
}

export default function Payments() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'receipt' | 'payment'>('all');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [partyInvoices, setPartyInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [formData, setFormData] = useState({
    type: 'receipt' as 'receipt' | 'payment',
    partyId: '',
    invoiceId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'Cash',
    referenceNumber: '',
    bankAccount: '',
    upiId: '',
    notes: ''
  });

  const businessId = profile?.business_id;

  useEffect(() => {
    if (businessId) {
      fetchData();
      fetchParties();
      fetchBusinessProfile();
    }
  }, [businessId]);

  const fetchBusinessProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('bank_accounts, upi_ids')
        .eq('id', businessId)
        .single();
      
      if (error) throw error;
      setBusinessProfile(data);
    } catch (error) {
      console.error('Error fetching business profile:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [receiptsRes, paymentsRes] = await Promise.all([
        supabase
          .from('customer_payments')
          .select('*, customers(name)')
          .eq('business_id', businessId)
          .order('date', { ascending: false }),
        supabase
          .from('supplier_payments')
          .select('*, suppliers(name)')
          .eq('business_id', businessId)
          .order('date', { ascending: false })
      ]);

      if (receiptsRes.error) throw receiptsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const combined: Payment[] = [
        ...(receiptsRes.data || []).map(r => ({ ...r, type: 'receipt' as const })),
        ...(paymentsRes.data || []).map(p => ({ ...p, type: 'payment' as const }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setPayments(combined);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParties = async () => {
    try {
      const [custRes, suppRes] = await Promise.all([
        supabase.from('customers').select('id, name').eq('business_id', businessId),
        supabase.from('suppliers').select('id, name').eq('business_id', businessId)
      ]);
      setCustomers(custRes.data || []);
      setSuppliers(suppRes.data || []);
    } catch (error) {
      console.error('Error fetching parties:', error);
    }
  };

  const fetchPartyInvoices = async (partyId: string, type: 'receipt' | 'payment') => {
    if (!partyId || !businessId) {
      setPartyInvoices([]);
      return;
    }

    setLoadingInvoices(true);
    try {
      console.log(`Fetching invoices for ${type}: partyId=${partyId}, businessId=${businessId}`);
      if (type === 'receipt') {
        const { data, error } = await supabase
          .from('invoices')
          .select('id, invoice_number, total, status')
          .eq('business_id', businessId)
          .eq('customer_id', partyId)
          .neq('status', 'paid')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching customer invoices:', error);
          throw error;
        }
        console.log('Fetched customer invoices:', data);
        setPartyInvoices(data || []);
      } else {
        const { data, error } = await supabase
          .from('purchases')
          .select('id, invoice_number, total_amount, status')
          .eq('business_id', businessId)
          .eq('supplier_id', partyId)
          .neq('status', 'paid')
          .order('date', { ascending: false });
        
        if (error) {
          console.error('Error fetching supplier purchases:', error);
          throw error;
        }
        console.log('Fetched supplier purchases:', data);
        setPartyInvoices(data || []);
      }
    } catch (error) {
      console.error('Error in fetchPartyInvoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handlePartyChange = (partyId: string) => {
    setFormData(prev => ({ ...prev, partyId, invoiceId: '', amount: '', referenceNumber: '' }));
    fetchPartyInvoices(partyId, formData.type);
  };

  const handleInvoiceChange = (invoiceId: string) => {
    const selectedInvoice = partyInvoices.find(inv => inv.id === invoiceId);
    if (selectedInvoice) {
      const amount = formData.type === 'receipt' ? selectedInvoice.total : selectedInvoice.total_amount;
      const ref = selectedInvoice.invoice_number;
      setFormData(prev => ({ 
        ...prev, 
        invoiceId, 
        amount: amount.toString(),
        referenceNumber: ref ? (formData.type === 'receipt' ? `INV-${ref}` : ref) : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, invoiceId: '', amount: '', referenceNumber: '' }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partyId || !formData.amount) return;

    setIsSaving(true);
    try {
      const isReceipt = formData.type === 'receipt';
      const table = isReceipt ? 'customer_payments' : 'supplier_payments';
      const partyKey = isReceipt ? 'customer_id' : 'supplier_id';
      const linkKey = isReceipt ? 'invoice_id' : 'purchase_id';

      const payload = {
        business_id: businessId,
        [partyKey]: formData.partyId,
        [linkKey]: formData.invoiceId || null,
        // Also include invoice_id for supplier_payments for backward compatibility if needed
        ...(isReceipt ? {} : { invoice_id: formData.invoiceId || null }),
        amount: parseFloat(formData.amount),
        date: formData.date,
        payment_mode: formData.paymentMode,
        reference_number: formData.referenceNumber,
        notes: [
          formData.bankAccount ? `Bank: ${formData.bankAccount}` : '',
          formData.upiId ? `UPI: ${formData.upiId}` : '',
          formData.notes
        ].filter(Boolean).join('\n'),
        created_by: profile?.id
      };

      console.log(`Saving payment to ${table}:`, payload);

      const { error } = await supabase
        .from(table)
        .insert([payload]);

      if (error) {
        console.error(`Error saving to ${table}:`, error);
        throw error;
      }

      // Update linked invoice/purchase status if selected
      if (formData.invoiceId) {
        const linkTable = isReceipt ? 'invoices' : 'purchases';
        const { error: updateError } = await supabase
          .from(linkTable)
          .update({ status: 'paid' })
          .eq('id', formData.invoiceId);
        
        if (updateError) console.error(`Error updating ${linkTable} status:`, updateError);
      }

      setIsDrawerOpen(false);
      setFormData({
        type: 'receipt',
        partyId: '',
        invoiceId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'Cash',
        referenceNumber: '',
        bankAccount: '',
        upiId: '',
        notes: ''
      });
      setPartyInvoices([]);
      fetchData();
    } catch (error: any) {
      alert('Error saving payment: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!paymentToDelete) return;
    const payment = payments.find(p => p.id === paymentToDelete);
    if (!payment) return;

    try {
      const table = payment.type === 'receipt' ? 'customer_payments' : 'supplier_payments';
      const { error } = await supabase.from(table).delete().eq('id', paymentToDelete);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert('Error deleting payment: ' + error.message);
    } finally {
      setIsDeleteModalOpen(false);
      setPaymentToDelete(null);
    }
  };

  const filteredPayments = payments.filter(p => {
    const partyName = p.type === 'receipt' ? p.customers?.name : p.suppliers?.name;
    const matchesSearch = partyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Payments & Receipts" 
        description="Track incoming and outgoing funds, reconcile accounts, and manage your cash flow."
      >
        <button 
          onClick={() => setIsDrawerOpen(true)}
          className="btn-primary"
        >
          <Plus size={14} className="mr-1.5" />
          Record Payment
        </button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-4 flex items-center space-x-4">
          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><ArrowDownLeft size={20} /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Receipts (Customers)</p>
            <p className="text-lg font-bold text-slate-900">
              {formatCurrency(payments.filter(p => p.type === 'receipt').reduce((sum, p) => sum + p.amount, 0))}
            </p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center space-x-4">
          <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><ArrowUpRight size={20} /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Payments (Suppliers)</p>
            <p className="text-lg font-bold text-slate-900">
              {formatCurrency(payments.filter(p => p.type === 'payment').reduce((sum, p) => sum + p.amount, 0))}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by party or reference..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-4">
            <select 
              className="px-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
            >
              <option value="all">All Types</option>
              <option value="receipt">Receipts (In)</option>
              <option value="payment">Payments (Out)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-slate-500 text-xs">Loading transactions...</p>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <CreditCard className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-500 font-medium text-xs">No transactions found</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {new Date(payment.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-slate-900">
                        {payment.type === 'receipt' ? payment.customers?.name : payment.suppliers?.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        payment.type === 'receipt' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {payment.type === 'receipt' ? "Receipt" : "Payment"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-xs font-bold",
                        payment.type === 'receipt' ? "text-emerald-600" : "text-orange-600"
                      )}>
                        {payment.type === 'receipt' ? "+" : "-"}{formatCurrency(payment.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{payment.payment_mode}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{payment.reference_number || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => {
                          setPaymentToDelete(payment.id);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Record Transaction"
        icon={<CreditCard size={18} />}
        fullScreen={true}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Transaction Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, type: 'receipt', partyId: '', invoiceId: '', amount: '', referenceNumber: '' });
                  setPartyInvoices([]);
                }}
                className={cn(
                  "py-2 rounded-xl text-xs font-bold border-2 transition-all",
                  formData.type === 'receipt' ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-100 text-slate-500"
                )}
              >
                Receipt (In)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, type: 'payment', partyId: '', invoiceId: '', amount: '', referenceNumber: '' });
                  setPartyInvoices([]);
                }}
                className={cn(
                  "py-2 rounded-xl text-xs font-bold border-2 transition-all",
                  formData.type === 'payment' ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-100 text-slate-500"
                )}
              >
                Payment (Out)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">
                {formData.type === 'receipt' ? 'Customer' : 'Supplier'}
              </label>
              <select
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                value={formData.partyId}
                onChange={e => handlePartyChange(e.target.value)}
              >
                <option value="">Select {formData.type === 'receipt' ? 'Customer' : 'Supplier'}</option>
                {(formData.type === 'receipt' ? customers : suppliers).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">
                Link to {formData.type === 'receipt' ? 'Invoice' : 'Purchase'} (Optional)
              </label>
              <div className="relative">
                <select
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs appearance-none"
                  value={formData.invoiceId}
                  onChange={e => handleInvoiceChange(e.target.value)}
                  disabled={!formData.partyId || loadingInvoices || partyInvoices.length === 0}
                >
                  <option value="">
                    {loadingInvoices 
                      ? 'Loading...' 
                      : !formData.partyId 
                        ? `Select ${formData.type === 'receipt' ? 'Customer' : 'Supplier'} first`
                        : partyInvoices.length === 0 
                          ? `No unpaid ${formData.type === 'receipt' ? 'invoices' : 'purchases'} found`
                          : `Select ${formData.type === 'receipt' ? 'Invoice' : 'Purchase'}`}
                  </option>
                  {partyInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} - {formatCurrency(formData.type === 'receipt' ? inv.total : inv.total_amount)}
                    </option>
                  ))}
                </select>
                {loadingInvoices && (
                  <div className="absolute right-8 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Amount</label>
              <input
                required
                type="number"
                step="0.01"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Date</label>
              <input
                required
                type="date"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Payment Mode</label>
              <select
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                value={formData.paymentMode}
                onChange={e => setFormData({ ...formData, paymentMode: e.target.value })}
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="UPI">UPI</option>
              </select>
            </div>

            {formData.paymentMode === 'Bank Transfer' && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Select Bank Account</label>
                <select
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                  value={formData.bankAccount}
                  onChange={e => setFormData({ ...formData, bankAccount: e.target.value })}
                >
                  <option value="">Select Bank Account</option>
                  {businessProfile?.bank_accounts?.map((acc: any, i: number) => (
                    <option key={i} value={`${acc.bankName} (x${acc.accountNo.slice(-4)})`}>
                      {acc.bankName} - {acc.accountNo.slice(-4)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.paymentMode === 'UPI' && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Select UPI ID</label>
                <select
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                  value={formData.upiId}
                  onChange={e => setFormData({ ...formData, upiId: e.target.value })}
                >
                  <option value="">Select UPI ID</option>
                  {businessProfile?.upi_ids?.map((upi: any, i: number) => (
                    <option key={i} value={upi.upiId}>
                      {upi.label ? `${upi.label} (${upi.upiId})` : upi.upiId}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.paymentMode === 'Cheque' && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Bank Name / Cheque Details</label>
                <input
                  list="bank-names"
                  type="text"
                  placeholder="Bank Name / Cheque #"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                  value={formData.bankAccount}
                  onChange={e => setFormData({ ...formData, bankAccount: e.target.value })}
                />
                <datalist id="bank-names">
                  {businessProfile?.bank_accounts?.map((acc: any, i: number) => (
                    <option key={i} value={acc.bankName} />
                  ))}
                </datalist>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Vch No. / Reference Number</label>
              <input
                type="text"
                placeholder="Vch No., Transaction ID, etc."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                value={formData.referenceNumber}
                onChange={e => setFormData({ ...formData, referenceNumber: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Notes</label>
              <textarea
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs min-h-[40px]"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
            Save Transaction
          </button>
        </form>
      </Drawer>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This will affect the ledger balance."
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
