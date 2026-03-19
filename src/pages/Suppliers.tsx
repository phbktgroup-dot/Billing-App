import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Edit, Trash2, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Suppliers() {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);

  const businessId = profile?.business_id;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    gstin: '',
    address: ''
  });

  useEffect(() => {
    if (businessId) fetchSuppliers();
  }, [businessId]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback to local storage if table doesn't exist
        const localSuppliers = JSON.parse(localStorage.getItem(`suppliers_${businessId}`) || '[]');
        setSuppliers(localSuppliers);
      } else if (data) {
        setSuppliers(data);
      }
    } catch (error) {
      const localSuppliers = JSON.parse(localStorage.getItem(`suppliers_${businessId}`) || '[]');
      setSuppliers(localSuppliers);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const supplierData = {
      ...formData,
      business_id: businessId,
    };

    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(supplierData)
          .eq('id', editingSupplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert([supplierData]);
        if (error) throw error;
      }
      fetchSuppliers();
      closeModal();
    } catch (error: any) {
      // Fallback to local storage
      let localSuppliers = JSON.parse(localStorage.getItem(`suppliers_${businessId}`) || '[]');
      if (editingSupplier) {
        localSuppliers = localSuppliers.map((s: any) => s.id === editingSupplier.id ? { ...s, ...supplierData } : s);
      } else {
        localSuppliers.push({ id: Date.now().toString(), ...supplierData, created_at: new Date().toISOString() });
      }
      localStorage.setItem(`suppliers_${businessId}`, JSON.stringify(localSuppliers));
      setSuppliers(localSuppliers);
      closeModal();
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setSupplierToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;
    
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', supplierToDelete);
      if (error) {
        if (error.code === '23503' || error.message.includes('foreign key constraint')) {
          throw new Error('Cannot delete this supplier because they have associated purchase records. Please delete those first.');
        }
        throw error;
      }
      fetchSuppliers();
    } catch (error: any) {
      console.error('Error deleting supplier:', error);
      alert(error.message || 'Failed to delete supplier.');
    } finally {
      setSupplierToDelete(null);
    }
  };

  const openModal = (supplier?: any) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        email: supplier.email || '',
        phone: supplier.phone || '',
        gstin: supplier.gstin || '',
        address: supplier.address || ''
      });
    } else {
      setEditingSupplier(null);
      setFormData({ name: '', email: '', phone: '', gstin: '', address: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone && s.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-xs text-slate-500">Manage your vendors and suppliers.</p>
        </div>
        <button className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold flex items-center hover:bg-primary/90 transition-all" onClick={() => openModal()}>
          <Plus size={14} className="mr-1.5" />
          Add Supplier
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search suppliers..." 
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-xs transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">GSTIN</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-500">
                    No suppliers found.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs font-medium text-slate-900">{supplier.name}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-900">{supplier.phone}</div>
                      <div className="text-[10px] text-slate-500">{supplier.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 uppercase">{supplier.gstin || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{supplier.address || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button 
                          onClick={() => openModal(supplier)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => confirmDelete(supplier.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
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
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Supplier Name *</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input 
                    type="email" 
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">GSTIN</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all uppercase"
                  value={formData.gstin}
                  onChange={e => setFormData({...formData, gstin: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                <textarea 
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all resize-none"
                  rows={2}
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                ></textarea>
              </div>
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-1.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold flex items-center disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setSupplierToDelete(null);
        }}
      />
    </div>
  );
}
