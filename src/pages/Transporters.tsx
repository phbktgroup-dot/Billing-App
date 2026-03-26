import React, { useState, useEffect } from 'react';
import { 
  Truck, 
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
  IdCard
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';
import Drawer from '../components/Drawer';

interface Transporter {
  id: string;
  name: string;
  transporter_id: string;
  email: string;
  phone: string;
  address: string;
  business_id: string;
  created_at?: string;
}

export default function Transporters() {
  const { user, profile } = useAuth();
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransporter, setEditingTransporter] = useState<Transporter | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transporterToDelete, setTransporterToDelete] = useState<string | null>(null);

  const businessId = profile?.business_id;

  const [formData, setFormData] = useState({
    name: '',
    transporter_id: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    if (businessId) {
      fetchTransporters();
    }
  }, [businessId]);

  const fetchTransporters = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transporters')
        .select('*')
        .eq('business_id', businessId)
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) setTransporters(data);
    } catch (error: any) {
      console.error('Error fetching transporters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setIsSaving(true);

    const transporterData = {
      ...formData,
      business_id: businessId
    };

    try {
      if (editingTransporter) {
        const { error } = await supabase
          .from('transporters')
          .update(transporterData)
          .eq('id', editingTransporter.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('transporters')
          .insert([transporterData]);
        
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchTransporters();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setTransporterToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!transporterToDelete) return;
    try {
      const { error } = await supabase
        .from('transporters')
        .delete()
        .eq('id', transporterToDelete);
      
      if (error) throw error;
      fetchTransporters();
    } catch (error: any) {
      console.error('Error deleting transporter:', error);
      alert(error.message || 'Failed to delete transporter.');
    } finally {
      setTransporterToDelete(null);
    }
  };

  const openModal = (transporter: Transporter | null = null) => {
    if (transporter) {
      setEditingTransporter(transporter);
      setFormData({
        name: transporter.name,
        transporter_id: transporter.transporter_id,
        email: transporter.email || '',
        phone: transporter.phone || '',
        address: transporter.address || ''
      });
    } else {
      setEditingTransporter(null);
      setFormData({
        name: '',
        transporter_id: '',
        email: '',
        phone: '',
        address: ''
      });
    }
    setIsModalOpen(true);
  };

  const filteredTransporters = transporters.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.transporter_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Transporter Management" 
        description="Manage your transporters for E-Way Bill generation."
      >
        <button className="btn-primary flex items-center px-4 py-2 text-sm" onClick={() => openModal()}>
          <Plus size={16} className="mr-1.5" />
          Add Transporter
        </button>
      </PageHeader>

      {/* Transporters Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by name, ID or phone..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-transparent rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <p className="text-xs text-slate-500">Showing {filteredTransporters.length} of {transporters.length} transporters</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-2.5 py-1.5">Transporter Name</th>
                <th className="px-2.5 py-1.5">Transporter ID / GSTIN</th>
                <th className="px-2.5 py-1.5">Contact Info</th>
                <th className="px-2.5 py-1.5">Address</th>
                <th className="px-2.5 py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-slate-500 text-sm">Loading transporters...</p>
                  </td>
                </tr>
              ) : filteredTransporters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Truck className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-500 font-medium">No transporters found</p>
                    <button onClick={() => openModal()} className="text-primary text-sm font-bold mt-2 hover:underline">Add your first transporter</button>
                  </td>
                </tr>
              ) : (
                filteredTransporters.map((transporter) => (
                  <tr key={transporter.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold mr-3 text-xs">
                          {transporter.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{transporter.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-700 w-fit">
                        <IdCard size={10} className="mr-1.5 text-slate-400" />
                        {transporter.transporter_id}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="space-y-1">
                        <div className="flex items-center text-[10px] text-slate-600">
                          <Phone size={10} className="mr-1.5 text-slate-400" />
                          {transporter.phone || 'N/A'}
                        </div>
                        <div className="flex items-center text-[10px] text-slate-600">
                          <Mail size={10} className="mr-1.5 text-slate-400" />
                          {transporter.email || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-start text-[10px] text-slate-600 max-w-[200px]">
                        <MapPin size={10} className="mr-1.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{transporter.address || 'No address provided'}</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button 
                          onClick={() => openModal(transporter)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => confirmDelete(transporter.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
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

      {/* Add/Edit Modal */}
      <Drawer
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTransporter ? 'Edit Transporter' : 'Add New Transporter'}
        icon={<Truck size={18} />}
        maxWidth="max-w-none"
        footer={
          <div className="flex items-center justify-end space-x-3 w-full">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              form="transporter-form"
              disabled={isSaving}
              className="flex-1 px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all flex items-center justify-center disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {editingTransporter ? 'Update' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="transporter-form" onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Transporter Name</label>
              <input 
                required
                type="text" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Transporter ID / GSTIN</label>
              <input 
                required
                type="text" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all uppercase"
                value={formData.transporter_id}
                onChange={e => setFormData({...formData, transporter_id: e.target.value.toUpperCase()})}
                placeholder="e.g. 27AAAAA0000A1Z5"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Phone Number</label>
              <input 
                type="tel" 
                maxLength={10}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Address</label>
            <textarea 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all resize-none h-24"
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
            />
          </div>
        </form>
      </Drawer>

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Transporter"
        message="Are you sure you want to delete this transporter? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setTransporterToDelete(null);
        }}
      />
    </div>
  );
}
