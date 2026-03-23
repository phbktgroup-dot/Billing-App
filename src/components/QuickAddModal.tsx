import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Package } from 'lucide-react';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'customer' | 'product';
  onAdd: (data: any) => void;
}

export default function QuickAddModal({ isOpen, onClose, type, onAdd }: QuickAddModalProps) {
  const [formData, setFormData] = useState<any>({});

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-900 flex items-center">
              {type === 'customer' ? <UserPlus className="mr-2 text-primary" size={20} /> : <Package className="mr-2 text-primary" size={20} />}
              Add New {type === 'customer' ? 'Customer' : 'Product'}
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            {type === 'customer' ? (
              <>
                <input type="text" placeholder="Customer Name" className="w-full px-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:border-primary border border-transparent" onChange={e => setFormData({...formData, name: e.target.value})} />
                <input type="text" placeholder="Phone Number" className="w-full px-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:border-primary border border-transparent" onChange={e => setFormData({...formData, phone: e.target.value})} />
              </>
            ) : (
              <>
                <input type="text" placeholder="Product Name" className="w-full px-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:border-primary border border-transparent" onChange={e => setFormData({...formData, name: e.target.value})} />
                <input type="text" placeholder="Product Code (SKU)" className="w-full px-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:border-primary border border-transparent" onChange={e => setFormData({...formData, sku: e.target.value})} />
                <input type="number" placeholder="Price" className="w-full px-4 py-3 bg-slate-50 rounded-xl text-xs outline-none focus:border-primary border border-transparent" onChange={e => setFormData({...formData, price: e.target.value})} />
              </>
            )}
            <button 
              onClick={() => { onAdd(formData); onClose(); }}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary/90 transition-all"
            >
              Add {type === 'customer' ? 'Customer' : 'Product'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
