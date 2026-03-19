import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  X, 
  Loader2, 
  Save,
  Phone,
  Mail,
  MapPin,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  gstin: string;
  address: string;
  business_id: string;
}

export default function Customers() {
  const { user, profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  const businessId = profile?.business_id;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    gstin: '',
    address: ''
  });

  useEffect(() => {
    if (businessId) {
      fetchCustomers();
    }
  }, [businessId]);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    if (data) setCustomers(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setIsSaving(true);

    const customerData = {
      ...formData,
      business_id: businessId,
      created_by: user?.id
    };

    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([customerData]);
        
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setCustomerToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete);
      
      if (error) {
        if (error.code === '23503' || error.message.includes('foreign key constraint')) {
          throw new Error('Cannot delete this customer because they have associated invoices or other records. Please delete those records first.');
        }
        throw error;
      }
      fetchCustomers();
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      alert(error.message || 'Failed to delete customer.');
    } finally {
      setCustomerToDelete(null);
    }
  };

  const openModal = (customer: Customer | null = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        gstin: customer.gstin || '',
        address: customer.address || ''
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        gstin: '',
        address: ''
      });
    }
    setIsModalOpen(true);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.gstin?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customer Management</h1>
          <p className="text-xs text-slate-500">Manage your clients, their contact info, and GST details.</p>
        </div>
        <button className="btn-primary flex items-center px-4 py-2 text-sm" onClick={() => openModal()}>
          <Plus size={16} className="mr-1.5" />
          Add Customer
        </button>
      </div>

      {/* Customers Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by name, phone or GSTIN..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-transparent rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-all">
              <Filter size={16} />
            </button>
            <div className="h-5 w-[1px] bg-slate-200"></div>
            <p className="text-xs text-slate-500">Showing {filteredCustomers.length} customers</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Contact Info</th>
                <th className="px-4 py-3">GSTIN</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-slate-500 text-sm">Loading customers...</p>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Users className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-500 font-medium">No customers found</p>
                    <button onClick={() => openModal()} className="text-primary text-sm font-bold mt-2 hover:underline">Add your first customer</button>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold mr-3 text-xs">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{customer.name}</p>
                          <p className="text-[10px] text-slate-500">ID: {customer.id.split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center text-[10px] text-slate-600">
                          <Phone size={10} className="mr-1.5 text-slate-400" />
                          {customer.phone || 'N/A'}
                        </div>
                        <div className="flex items-center text-[10px] text-slate-600">
                          <Mail size={10} className="mr-1.5 text-slate-400" />
                          {customer.email || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                        {customer.gstin || 'No GSTIN'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start text-[10px] text-slate-600 max-w-[200px]">
                        <MapPin size={10} className="mr-1.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{customer.address || 'No address provided'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => openModal(customer)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => confirmDelete(customer.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Customer Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                  <input 
                    type="tel" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Email Address</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">GSTIN (Optional)</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all uppercase"
                  value={formData.gstin}
                  onChange={e => setFormData({...formData, gstin: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Billing Address</label>
                <textarea 
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all resize-none"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all flex items-center disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {editingCustomer ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setCustomerToDelete(null);
        }}
      />
    </div>
  );
}
