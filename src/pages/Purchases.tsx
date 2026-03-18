import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Search, Edit, Trash2, Loader2, X, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/utils';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Purchases() {
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);

  const businessId = profile?.business_id;

  const [formData, setFormData] = useState({
    supplier_id: '',
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    total_amount: 0,
    status: 'paid',
    notes: ''
  });

  useEffect(() => {
    if (businessId) {
      fetchPurchases();
      fetchSuppliers();
    }
  }, [businessId]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', businessId);
      
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      const localSuppliers = JSON.parse(localStorage.getItem(`suppliers_${businessId}`) || '[]');
      setSuppliers(localSuppliers);
    }
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          suppliers (
            name
          )
        `)
        .eq('business_id', businessId)
        .order('date', { ascending: false });

      if (error) {
        const localPurchases = JSON.parse(localStorage.getItem(`purchases_${businessId}`) || '[]');
        setPurchases(localPurchases);
      } else if (data) {
        setPurchases(data);
      }
    } catch (error) {
      const localPurchases = JSON.parse(localStorage.getItem(`purchases_${businessId}`) || '[]');
      setPurchases(localPurchases);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const purchaseData = {
      ...formData,
      business_id: businessId,
    };

    try {
      if (editingPurchase) {
        const { error } = await supabase
          .from('purchases')
          .update(purchaseData)
          .eq('id', editingPurchase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('purchases')
          .insert([purchaseData]);
        if (error) throw error;
      }
      fetchPurchases();
      closeModal();
    } catch (error: any) {
      // Fallback to local storage
      let localPurchases = JSON.parse(localStorage.getItem(`purchases_${businessId}`) || '[]');
      const supplierName = suppliers.find(s => s.id === formData.supplier_id)?.name || 'Unknown Supplier';
      
      if (editingPurchase) {
        localPurchases = localPurchases.map((p: any) => p.id === editingPurchase.id ? { ...p, ...purchaseData, suppliers: { name: supplierName } } : p);
      } else {
        localPurchases.push({ 
          id: Date.now().toString(), 
          ...purchaseData, 
          created_at: new Date().toISOString(),
          suppliers: { name: supplierName }
        });
      }
      localStorage.setItem(`purchases_${businessId}`, JSON.stringify(localPurchases));
      setPurchases(localPurchases);
      closeModal();
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setPurchaseToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!purchaseToDelete) return;
    
    try {
      const { error } = await supabase.from('purchases').delete().eq('id', purchaseToDelete);
      if (error) throw error;
      fetchPurchases();
    } catch (error) {
      let localPurchases = JSON.parse(localStorage.getItem(`purchases_${businessId}`) || '[]');
      localPurchases = localPurchases.filter((p: any) => p.id !== purchaseToDelete);
      localStorage.setItem(`purchases_${businessId}`, JSON.stringify(localPurchases));
      setPurchases(localPurchases);
    } finally {
      setPurchaseToDelete(null);
    }
  };

  const openModal = (purchase?: any) => {
    if (purchase) {
      setEditingPurchase(purchase);
      setFormData({
        supplier_id: purchase.supplier_id || '',
        invoice_number: purchase.invoice_number || '',
        date: purchase.date ? new Date(purchase.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        total_amount: purchase.total_amount || 0,
        status: purchase.status || 'paid',
        notes: purchase.notes || ''
      });
    } else {
      setEditingPurchase(null);
      setFormData({ 
        supplier_id: suppliers.length > 0 ? suppliers[0].id : '', 
        invoice_number: `PUR-${Date.now().toString().slice(-6)}`, 
        date: new Date().toISOString().split('T')[0], 
        total_amount: 0, 
        status: 'paid', 
        notes: '' 
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPurchase(null);
  };

  const filteredPurchases = purchases.filter(p => 
    p.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchases</h1>
          <p className="text-slate-500">Manage your purchase invoices and expenses.</p>
        </div>
        <button className="btn-primary flex items-center" onClick={() => openModal()}>
          <Plus size={18} className="mr-2" />
          Record Purchase
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by invoice number or supplier..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-primary outline-none text-sm transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No purchases found.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(purchase.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">{purchase.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {purchase.suppliers?.name || 'Unknown Supplier'}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {formatCurrency(purchase.total_amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                        purchase.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {purchase.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => openModal(purchase)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => confirmDelete(purchase.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingPurchase ? 'Edit Purchase' : 'Record Purchase'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier *</label>
                <select 
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none transition-all"
                  value={formData.supplier_id}
                  onChange={e => setFormData({...formData, supplier_id: e.target.value})}
                >
                  <option value="" disabled>Select a supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {suppliers.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">Please add a supplier first.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number *</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none transition-all"
                    value={formData.invoice_number}
                    onChange={e => setFormData({...formData, invoice_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input 
                    type="date" 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none transition-all"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none transition-all"
                    value={formData.total_amount}
                    onChange={e => setFormData({...formData, total_amount: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none transition-all"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none transition-all resize-none"
                  rows={3}
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                ></textarea>
              </div>
              <div className="pt-4 flex items-center justify-end space-x-3">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving || suppliers.length === 0}
                  className="btn-primary flex items-center disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editingPurchase ? 'Update Purchase' : 'Save Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Purchase"
        message="Are you sure you want to delete this purchase record? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setPurchaseToDelete(null);
        }}
      />
    </div>
  );
}
