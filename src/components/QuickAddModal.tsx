import React, { useState } from 'react';
import { UserPlus, Package, Save, Loader2 } from 'lucide-react';
import Drawer from './Drawer';
import { STATE_CODES } from '../constants/stateCodes';
import { UNIT_TYPES } from '../constants/unitTypes';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'customer' | 'product';
  onAdd: (data: any) => void;
}

export default function QuickAddModal({ isOpen, onClose, type, onAdd }: QuickAddModalProps) {
  const [formData, setFormData] = useState<any>(
    type === 'product' 
      ? { gst_rate: 18, min_stock: 5, purchase_price: '', price: '', stock: '', category: '', name: '', sku: '', unit_type: 'NUMBERS' }
      : {}
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onAdd(formData);
      onClose();
    } catch (error) {
      console.error('Error adding:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const footer = (
    <>
      <button 
        type="button"
        onClick={onClose}
        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all text-[10px] shadow-sm"
      >
        Cancel
      </button>
      <button 
        onClick={handleSubmit}
        disabled={isSaving}
        className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-all flex items-center disabled:opacity-50 text-[10px] shadow-lg shadow-primary/20"
      >
        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
        Add {type === 'customer' ? 'Customer' : 'Product'}
      </button>
    </>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Add New ${type === 'customer' ? 'Customer' : 'Product'}`}
      icon={type === 'customer' ? <UserPlus size={18} /> : <Package size={18} />}
      footer={footer}
      fullScreen={true}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'customer' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Customer Name</label>
              <input 
                required
                type="text" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="Enter customer name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Phone Number</label>
              <input 
                type="text" 
                maxLength={10}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.phone || ''}
                onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} 
                placeholder="Contact number"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">GST Number</label>
              <input 
                type="text" 
                maxLength={15}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.gst_number || ''}
                onChange={e => setFormData({...formData, gst_number: e.target.value.toUpperCase()})} 
                placeholder="GSTIN"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Address Line 1</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                onChange={e => setFormData({...formData, address1: e.target.value})} 
                placeholder="Building, Street, etc."
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Address Line 2</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                onChange={e => setFormData({...formData, address2: e.target.value})} 
                placeholder="Area, Locality, etc."
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">City</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                onChange={e => setFormData({...formData, city: e.target.value})} 
                placeholder="City"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">State</label>
              <select 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.state || ''}
                onChange={e => setFormData({...formData, state: e.target.value})}
              >
                <option value="">Select State</option>
                {Object.entries(STATE_CODES).map(([code, name]) => (
                  <option key={code} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Pin Code</label>
              <input 
                type="text" 
                maxLength={6}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.pincode || ''}
                onChange={e => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '')})} 
                placeholder="Pincode"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Product Name</label>
              <input 
                required
                type="text" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Enter product name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Product/HSN Code</label>
              <input 
                required
                type="text" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.sku}
                onChange={e => setFormData({...formData, sku: e.target.value, hsn_code: e.target.value})}
                placeholder="e.g. PROD-001 or 8471"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Category</label>
              <input 
                type="text" 
                list="categories"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                placeholder="Select or type category"
              />
              <datalist id="categories">
                <option value="Electronics" />
                <option value="Furniture" />
                <option value="Accessories" />
                <option value="Stationery" />
                <option value="Services" />
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">GST Rate (%)</label>
              <select 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.gst_rate}
                onChange={e => setFormData({...formData, gst_rate: Number(e.target.value)})}
              >
                <option value={0}>0% (Exempt)</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Unit Type</label>
              <select 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.unit_type || 'NUMBERS'}
                onChange={e => setFormData({...formData, unit_type: e.target.value})}
              >
                {UNIT_TYPES.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Purchase Price</label>
              <input 
                required
                type="number" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.purchase_price}
                onChange={e => setFormData({...formData, purchase_price: e.target.value})}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Selling Price</label>
              <input 
                required
                type="number" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Initial Stock</label>
              <input 
                required
                type="number" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.stock}
                onChange={e => setFormData({...formData, stock: e.target.value})}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Min Stock Level</label>
              <input 
                required
                type="number" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all shadow-sm"
                value={formData.min_stock}
                onChange={e => setFormData({...formData, min_stock: Number(e.target.value)})}
              />
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );
}
