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
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getDateRange, FilterType } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';
import { DateFilter } from '../components/DateFilter';
import Drawer from '../components/Drawer';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  gstin: string;
  state: string;
  address: string;
  address1?: string;
  address2?: string;
  city?: string;
  pincode?: string;
  business_id: string;
  created_at?: string;
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
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('allTime');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [day, setDay] = useState(new Date().toISOString().split('T')[0]);
  const [year, setYear] = useState(new Date().getFullYear());

  const businessId = profile?.business_id;

  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    gstin: '',
    state: '',
    address1: '',
    address2: '',
    city: '',
    pincode: ''
  });

  useEffect(() => {
    if (businessId) {
      fetchCustomers();
    }
  }, [businessId, filterType, customRange, day, year]);

  const toggleSelectAll = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map(c => c.id));
    }
  };

  const toggleSelectCustomer = (id: string) => {
    setSelectedCustomers(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const fetchCustomers = async () => {
    setLoading(true);
    const { startDate, endDate } = getDateRange(filterType, day, year, customRange);

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('name', { ascending: true });

    if (data) setCustomers(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setIsSaving(true);

    const { address1, address2, city, pincode, ...restData } = formData;
    const address = [address1, address2, city, pincode].filter(Boolean).join(', ');

    const customerData = {
      ...restData,
      address,
      address1,
      address2,
      city,
      pincode,
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
    setIsBulkDelete(false);
    setDeleteModalOpen(true);
  };

  const confirmBulkDelete = () => {
    setIsBulkDelete(true);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      if (isBulkDelete) {
        const { error } = await supabase
          .from('customers')
          .delete()
          .in('id', selectedCustomers);
        
        if (error) {
          if (error.code === '23503' || error.message.includes('foreign key constraint')) {
            throw new Error('Some customers cannot be deleted because they have associated records. Please delete those records first.');
          }
          throw error;
        }
        setSelectedCustomers([]);
      } else {
        if (!customerToDelete) return;
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', customerToDelete);
        
        if (error) {
          if (error.code === '23503' || error.message.includes('foreign key constraint')) {
            // Fetch associated invoices to show in the error message
            const { data: invoices } = await supabase
              .from('invoices')
              .select('invoice_number')
              .eq('customer_id', customerToDelete)
              .limit(5);

            let message = 'Cannot delete this customer because they have associated invoices or other records.';
            if (invoices && invoices.length > 0) {
              const numbers = invoices.map(inv => inv.invoice_number).join(', ');
              message += `\n\nAssociated Invoices: ${numbers}${invoices.length >= 5 ? '...' : ''}`;
            }
            message += '\n\nPlease delete those records first.';
            throw new Error(message);
          }
          throw error;
        }
      }
      fetchCustomers();
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      alert(error.message || 'Failed to delete customer.');
    } finally {
      setCustomerToDelete(null);
      setIsBulkDelete(false);
    }
  };

  const openModal = (customer: Customer | null = null) => {
    if (customer) {
      setEditingCustomer(customer);
      
      // Use separate fields if they exist, otherwise try to parse the combined address
      const address1 = customer.address1 || '';
      const address2 = customer.address2 || '';
      const city = customer.city || '';
      const pincode = customer.pincode || '';
      
      setFormData({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        gstin: customer.gstin || '',
        state: customer.state || '',
        address1,
        address2,
        city,
        pincode
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        gstin: '',
        state: '',
        address1: '',
        address2: '',
        city: '',
        pincode: ''
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-2 pt-2 relative"
    >
      <PageHeader 
        title="Customer Management" 
        description="Maintain your client database, track their purchase history, and manage relationships."
      >
        <div className="flex items-center space-x-2">
          
          <button className="btn-primary h-10 sm:h-9" onClick={() => openModal()}>
            <Plus size={16} className="mr-1.5" />
            Add Customer
          </button>
        </div>
      </PageHeader>

      {/* Customers Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
            {selectedCustomers.length > 0 && (
              <button 
                onClick={confirmBulkDelete}
                className="bg-red-600 text-white px-3 h-10 sm:h-9 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-red-700 transition-all"
              >
                <Trash2 size={14} />
                Bulk Delete ({selectedCustomers.length})
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-all">
              <Filter size={16} />
            </button>
            <div className="h-5 w-[1px] bg-slate-200"></div>
            <p className="text-xs text-slate-500">Showing {filteredCustomers.length} of {customers.length} customers</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                <th className="px-2.5 py-1.5 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                    checked={filteredCustomers.length > 0 && selectedCustomers.length === filteredCustomers.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-2.5 py-1.5">Customer Name</th>
                <th className="px-2.5 py-1.5">Contact Info</th>
                <th className="px-2.5 py-1.5">GSTIN</th>
                <th className="px-2.5 py-1.5">Address</th>
                <th className="px-2.5 py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-slate-500 text-sm">Loading customers...</p>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Users className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-500 font-medium">No customers found</p>
                    <button onClick={() => openModal()} className="text-primary text-sm font-bold mt-2 hover:underline">Add your first customer</button>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    className={cn(
                      "hover:bg-slate-50/50 transition-colors",
                      selectedCustomers.includes(customer.id) && "bg-primary/5"
                    )}
                  >
                    <td className="px-2.5 py-1.5">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                        checked={selectedCustomers.includes(customer.id)}
                        onChange={() => toggleSelectCustomer(customer.id)}
                      />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold mr-3 text-[10px]">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-900">{customer.name}</p>
                          <p className="text-[8px] text-slate-500">ID: {customer.id.split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5">
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
                    <td className="px-2.5 py-1.5">
                      <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                        {customer.gstin || 'No GSTIN'}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-start text-[10px] text-slate-600 max-w-[200px]">
                        <MapPin size={10} className="mr-1.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{customer.address || 'No address provided'}</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button 
                          onClick={() => openModal(customer)}
                          className="p-1 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all h-10 sm:h-9 w-10 flex items-center justify-center"
                          title="Edit"
                        >
                          <Edit size={12} />
                        </button>
                        <button 
                          onClick={() => confirmDelete(customer.id)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all h-10 sm:h-9 w-10 flex items-center justify-center"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                        <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all h-10 sm:h-9 w-10 flex items-center justify-center">
                          <MoreVertical size={12} />
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
      <Drawer
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        icon={<Users size={18} />}
        maxWidth="max-w-none"
        footer={
          <>
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 h-10 sm:h-9 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-xs"
            >
              Cancel
            </button>
            <button 
              onClick={(e) => {
                e.preventDefault();
                handleSave(e as any);
              }}
              disabled={isSaving}
              className="px-6 h-10 sm:h-9 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all flex items-center disabled:opacity-50 text-xs"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {editingCustomer ? 'Update' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Customer Name</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phone Number</label>
              <input 
                required
                type="tel" 
                maxLength={10}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
              <input 
                type="email" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">GSTIN (Optional)</label>
              <input 
                type="text" 
                maxLength={15}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all uppercase"
                value={formData.gstin}
                onChange={e => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">State</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
                value={formData.state}
                onChange={e => setFormData({...formData, state: e.target.value})}
                placeholder="e.g. Maharashtra"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Address Line 1</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
                value={formData.address1}
                onChange={e => setFormData({...formData, address1: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Address Line 2</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
                value={formData.address2}
                onChange={e => setFormData({...formData, address2: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">City</label>
              <input 
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
                value={formData.city}
                onChange={e => setFormData({...formData, city: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pin Code</label>
              <input 
                type="text"
                maxLength={6}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
                value={formData.pincode}
                onChange={e => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '')})}
              />
            </div>
          </div>
        </form>
      </Drawer>
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title={isBulkDelete ? "Bulk Delete Customers" : "Delete Customer"}
        message={isBulkDelete 
          ? `Are you sure you want to delete ${selectedCustomers.length} selected customers? This action cannot be undone.`
          : "Are you sure you want to delete this customer? This action cannot be undone."}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setCustomerToDelete(null);
          setIsBulkDelete(false);
        }}
      />
      </motion.div>
  );
}
