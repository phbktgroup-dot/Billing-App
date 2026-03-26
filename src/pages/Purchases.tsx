import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Search, Edit, Trash2, Loader2, X, Download, Scan, Camera, Package, ShieldCheck, Filter, MoreVertical, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, getDateRange, FilterType, cn } from '../lib/utils';
import { ConfirmModal } from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';
import { DateFilter } from '../components/DateFilter';
import { GoogleGenAI } from '@google/genai';
import MessageModal from '../components/MessageModal';
import { getApiUrl } from '../lib/api';

export default function Purchases() {
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
  });

  const [filterType, setFilterType] = useState<FilterType>('thisMonth');
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [day, setDay] = useState<string>(getLocalToday());
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const businessId = profile?.business_id;

  const [selectedPurchases, setSelectedPurchases] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    supplier_id: '',
    supplier_name: '',
    supplier_gstin: '',
    supplier_email: '',
    supplier_phone: '',
    supplier_address: '',
    invoice_number: '',
    bill_date: new Date().toISOString().split('T')[0],
    upload_date: new Date().toISOString().split('T')[0],
    total_amount: 0,
    status: 'paid',
    notes: '',
    items: [] as any[]
  });

  const [showScannedReview, setShowScannedReview] = useState(false);
  const [scannedData, setScannedData] = useState<{
    supplier: any;
    items: any[];
    invoiceNumber: string;
    date: string;
    totalAmount: number;
  } | null>(null);

  const ScannedReviewModal = ({ data, onClose, onConfirm }: { data: any, onClose: () => void, onConfirm: (finalData: any) => void }) => {
    const [editedData, setEditedData] = useState(data);

    return (
      <div className="fixed inset-0 z-[60] flex items-stretch justify-end bg-slate-900/60 backdrop-blur-md">
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-white shadow-2xl overflow-hidden flex flex-col h-full"
          style={{ width: 'calc(100% - var(--sidebar-width))' }}
        >
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <Scan size={16} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900">Review Scanned Bill</h2>
                <p className="text-[9px] text-slate-500 font-medium">Verify and edit the extracted information</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Supplier Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                  <User size={12} className="mr-1.5" /> Supplier Information
                </h3>
                {(() => {
                  const supplierName = editedData.supplier.name;
                  const existingSupplier = suppliers.find(s => s.name.trim().toLowerCase() === supplierName.trim().toLowerCase());
                  if (!existingSupplier) {
                    return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black rounded-full uppercase tracking-tighter">New Supplier</span>;
                  }
                  return null;
                })()}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="space-y-0.5">
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Supplier Name</label>
                  <input 
                    type="text"
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-[10px] font-medium"
                    value={editedData.supplier.name}
                    onChange={e => setEditedData({...editedData, supplier: {...editedData.supplier, name: e.target.value}})}
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">GST Number</label>
                  <input 
                    type="text"
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-[10px] font-medium uppercase"
                    value={editedData.supplier.gstin}
                    onChange={e => setEditedData({...editedData, supplier: {...editedData.supplier, gstin: e.target.value.toUpperCase()}})}
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Invoice Number</label>
                  <input 
                    type="text"
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-[10px] font-medium"
                    value={editedData.invoiceNumber}
                    onChange={e => setEditedData({...editedData, invoiceNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Bill Date</label>
                  <input 
                    type="date"
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-[10px] font-medium"
                    value={editedData.date}
                    onChange={e => setEditedData({...editedData, date: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className="space-y-2">
              <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                <Package size={12} className="mr-1.5" /> Items Detected
              </h3>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-2.5 py-1.5">Item Name</th>
                      <th className="px-2.5 py-1.5 w-16 text-center">Qty</th>
                      <th className="px-2.5 py-1.5 w-20 text-right">Rate</th>
                      <th className="px-2.5 py-1.5 w-24 text-right">Amount</th>
                      <th className="px-2.5 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {editedData.items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-2.5 py-1.5">
                          <input 
                            type="text"
                            className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-medium p-0"
                            value={item.particular}
                            onChange={e => {
                              const newItems = [...editedData.items];
                              newItems[idx].particular = e.target.value;
                              setEditedData({...editedData, items: newItems});
                            }}
                          />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input 
                            type="number"
                            className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-center p-0"
                            value={item.quantity}
                            onChange={e => {
                              const newItems = [...editedData.items];
                              newItems[idx].quantity = Number(e.target.value);
                              newItems[idx].amount = newItems[idx].quantity * newItems[idx].rate;
                              setEditedData({...editedData, items: newItems});
                            }}
                          />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input 
                            type="number"
                            className="w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold text-right p-0"
                            value={item.rate}
                            onChange={e => {
                              const newItems = [...editedData.items];
                              newItems[idx].rate = Number(e.target.value);
                              newItems[idx].amount = newItems[idx].quantity * newItems[idx].rate;
                              setEditedData({...editedData, items: newItems});
                            }}
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-right text-[10px] font-black text-primary">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          <button 
                            onClick={() => {
                              const newItems = editedData.items.filter((_: any, i: number) => i !== idx);
                              setEditedData({...editedData, items: newItems});
                            }}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[10px] font-bold text-slate-500">
              Total: <span className="text-primary ml-1">{formatCurrency(editedData.items.reduce((sum: number, i: any) => sum + i.amount, 0))}</span>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={onClose}
                className="px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
              >
                Discard
              </button>
              <button 
                onClick={() => onConfirm(editedData)}
                className="px-4 py-1.5 bg-primary text-white rounded-lg text-[10px] font-black shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
              >
                Confirm Details
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  useEffect(() => {
    if (businessId) {
      fetchPurchases();
      fetchSuppliers();
      fetchProducts();
    }
  }, [businessId, filterType, customRange, day, year]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId);
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

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
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);

      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          suppliers (
            name
          )
        `)
        .eq('business_id', businessId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
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

    try {
      let currentSupplierId = formData.supplier_id;

      // 1. Handle Supplier (Create if new)
      if (!currentSupplierId && formData.supplier_name) {
        const existingSupplier = suppliers.find(s => s.name.trim().toLowerCase() === formData.supplier_name.trim().toLowerCase());
        
        if (existingSupplier) {
          currentSupplierId = existingSupplier.id;
        } else {
          const supplierInsert: any = {
            business_id: businessId,
            name: formData.supplier_name,
            gst_number: formData.supplier_gstin,
            email: formData.supplier_email,
            phone: formData.supplier_phone,
            address: formData.supplier_address,
            created_by: profile?.id
          };
          
          const { data: newSup, error: supError } = await supabase
            .from('suppliers')
            .insert([supplierInsert])
            .select()
            .single();
          
          if (supError) {
            throw supError;
          } else if (newSup) {
            currentSupplierId = newSup.id;
            setSuppliers(prev => [...prev, newSup]);
          }
        }
      } else if (currentSupplierId) {
        // Update existing supplier details
        const { error: supError } = await supabase
          .from('suppliers')
          .update({
            gst_number: formData.supplier_gstin,
            email: formData.supplier_email,
            phone: formData.supplier_phone,
            address: formData.supplier_address
          })
          .eq('id', currentSupplierId);
        
        if (supError) throw supError;
        
        // Update local state
        setSuppliers(prev => prev.map(s => s.id === currentSupplierId ? {
          ...s,
          gst_number: formData.supplier_gstin,
          email: formData.supplier_email,
          phone: formData.supplier_phone,
          address: formData.supplier_address
        } : s));
      }

      const purchaseData = {
        business_id: businessId,
        supplier_id: currentSupplierId,
        invoice_number: formData.invoice_number,
        date: formData.bill_date, // Keep for backward compatibility
        total_amount: formData.total_amount,
        status: formData.status,
        notes: formData.notes + (formData.upload_date ? `\nUpload Date: ${formData.upload_date}` : ''),
        created_by: profile?.id
      };

      // 2. Save Purchase
      let purchaseId = '';
      if (editingPurchase) {
        const { error } = await supabase
          .from('purchases')
          .update(purchaseData)
          .eq('id', editingPurchase.id);
        if (error) throw error;
        purchaseId = editingPurchase.id;
        
        // Delete old items if editing
        await supabase.from('purchase_items').delete().eq('purchase_id', purchaseId);
      } else {
        const { data: newPurchase, error } = await supabase
          .from('purchases')
          .insert([purchaseData])
          .select()
          .single();
        if (error) throw error;
        purchaseId = newPurchase.id;
      }

      // 3. Save Purchase Items & Update Inventory
      if (formData.items.length > 0) {
        const purchaseItems = formData.items.map(item => ({
          purchase_id: purchaseId,
          product_id: item.product_id || null,
          item_name: item.particular,
          hsn_code: item.hsn,
          quantity: item.quantity,
          unit_price: item.rate,
          total_price: item.amount
        }));

        const { error: itemsError } = await supabase
          .from('purchase_items').insert(purchaseItems);
        if (itemsError) throw itemsError;

        // Update Inventory
        let currentProducts = [...products];
        for (const item of formData.items) {
          if (!item.particular) continue;

          try {
            if (item.product_id) {
              // Update existing product stock
              const { data: product, error: fetchError } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.product_id)
                .single();
              
              if (!fetchError && product) {
                const { error: updateError } = await supabase
                  .from('products')
                  .update({ 
                    stock: (product.stock || 0) + item.quantity
                  })
                  .eq('id', item.product_id);
                if (updateError) console.error('Error updating product stock:', updateError);
              }
            } else {
              // Check if product exists by name first
              const existingProduct = currentProducts.find(p => p.name.trim().toLowerCase() === item.particular.trim().toLowerCase());
              if (existingProduct) {
                // Update existing product stock
                const { data: product, error: fetchError } = await supabase
                  .from('products')
                  .select('stock')
                  .eq('id', existingProduct.id)
                  .single();
                
                if (!fetchError && product) {
                  const { error: updateError } = await supabase
                    .from('products')
                    .update({ 
                      stock: (product.stock || 0) + item.quantity
                    })
                    .eq('id', existingProduct.id);
                  if (updateError) console.error('Error updating product stock:', updateError);
                }
                
                // Update the purchase item with the existing product_id
                await supabase
                  .from('purchase_items')
                  .update({ product_id: existingProduct.id })
                  .eq('purchase_id', purchaseId)
                  .eq('item_name', item.particular);
              } else {
                // Create new product if it doesn't exist
                const { data: newProd, error: prodError } = await supabase
                  .from('products')
                  .insert([{
                    business_id: businessId,
                    name: item.particular,
                    sku: `SKU-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`,
                    hsn_code: item.hsn,
                    category: 'General',
                    purchase_price: item.rate,
                    price: item.rate * 1.2, // Default 20% markup
                    stock: item.quantity,
                    created_by: profile?.id
                  }])
                  .select()
                  .single();
                
                if (!prodError && newProd) {
                  // Update the purchase item with the new product_id
                  await supabase
                    .from('purchase_items')
                    .update({ product_id: newProd.id })
                    .eq('purchase_id', purchaseId)
                    .eq('item_name', item.particular);
                    
                  // Update local products array
                  currentProducts.push(newProd);
                  setProducts(currentProducts);
                } else if (prodError) {
                  console.error('Error creating new product from purchase:', prodError);
                }
              }
            }
          } catch (itemErr) {
            console.error('Failed to process inventory update for item:', item.particular, itemErr);
          }
        }
      }

      fetchPurchases();
      fetchProducts();
      closeModal();
      setModal({ isOpen: true, title: 'Success', message: 'Purchase recorded and inventory updated!', type: 'success' });
    } catch (error: any) {
      console.error('Error saving purchase:', error);
      setModal({ isOpen: true, title: 'Error', message: error.message || 'Failed to save purchase', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setPurchaseToDelete(id);
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
          .from('purchases')
          .delete()
          .in('id', selectedPurchases);
        
        if (error) throw error;
        setSelectedPurchases([]);
      } else {
        if (!purchaseToDelete) return;
        const { error } = await supabase.from('purchases').delete().eq('id', purchaseToDelete);
        if (error) throw error;
      }
      fetchPurchases();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      alert('Failed to delete purchase. Please try again.');
    } finally {
      setPurchaseToDelete(null);
      setIsBulkDelete(false);
    }
  };

  const openModal = async (purchase?: any) => {
    if (purchase) {
      setEditingPurchase(purchase);
      
      // Fetch items for this purchase
      const { data: items } = await supabase
        .from('purchase_items')
        .select('*')
        .eq('purchase_id', purchase.id);

      setFormData({
        supplier_id: purchase.supplier_id || '',
        supplier_name: '',
        supplier_gstin: '',
        supplier_email: '',
        supplier_phone: '',
        supplier_address: '',
        invoice_number: purchase.invoice_number || '',
        bill_date: purchase.bill_date || purchase.date || new Date().toISOString().split('T')[0],
        upload_date: purchase.upload_date || new Date(purchase.created_at).toISOString().split('T')[0],
        total_amount: purchase.total_amount || 0,
        status: purchase.status || 'paid',
        notes: purchase.notes || '',
        items: items?.map(i => ({
          product_id: i.product_id,
          particular: i.item_name,
          hsn: i.hsn_code,
          quantity: i.quantity,
          rate: i.unit_price,
          amount: i.total_price
        })) || []
      });
    } else {
      setEditingPurchase(null);
      setFormData({ 
        supplier_id: suppliers.length > 0 ? suppliers[0].id : '', 
        supplier_name: '',
        supplier_gstin: '',
        supplier_email: '',
        supplier_phone: '',
        supplier_address: '',
        invoice_number: `PUR-${Date.now().toString().slice(-6)}`, 
        bill_date: new Date().toISOString().split('T')[0], 
        upload_date: new Date().toISOString().split('T')[0], 
        total_amount: 0, 
        status: 'paid', 
        notes: '',
        items: []
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPurchase(null);
  };

  const processScannedFile = async (base64Data: string, mimeType: string) => {
    setIsScanning(true);
    setProcessingProgress(0);
    const interval = setInterval(() => {
      setProcessingProgress(p => p < 90 ? p + 10 : p);
    }, 500);

    try {
      // Use business-specific API key if available, otherwise fallback to environment variable
      const apiKey = profile?.business_profiles?.gemini_api_key || import.meta.env.VITE_GEMINI_API_KEY;
      console.log('Using API Key for scan:', apiKey ? 'Provided' : 'None (falling back to backend default)');
      
      const prompt = `Extract purchase invoice details: 
- supplier name
- supplier GST number
- supplier email
- supplier phone
- supplier address
- invoice number
- date
- items (array of: { particular: string, hsn: string, quantity: number, rate: number, amount: number })
- total amount

Return as JSON format: { 
  supplierName: string, 
  supplierGstin: string,
  supplierEmail: string,
  supplierPhone: string,
  supplierAddress: string,
  invoiceNumber: string, 
  date: string, 
  items: Array<{ particular: string, hsn: string, quantity: number, rate: number, amount: number }>,
  totalAmount: number 
}`;

      let extractedText = '';

      try {
        // Try backend scanning first (more robust for Electron/CORS)
        const response = await fetch(getApiUrl('/api/scan'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data, mimeType, prompt, apiKey })
        });

        if (response.ok) {
          const result = await response.json();
          extractedText = result.text;
        } else {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 429) {
            throw new Error(errorData.error || "AI scanning is currently busy. Please try again in a minute.");
          }
          if (response.status === 400) {
            throw new Error("Invalid Gemini API key. Please check your API key in Settings.");
          }
          throw new Error(errorData.error || "Backend scan failed");
        }
      } catch (backendError: any) {
        // If it's a 429 or 400 from backend, don't fallback to client-side
        if (backendError.message.includes('capacity') || 
            backendError.message.includes('limit') || 
            backendError.message.includes('Invalid Gemini API key')) {
          throw backendError;
        }

        console.warn("Backend scan failed, falling back to client-side scan:", backendError);
        
        // Fallback to client-side scanning
        if (!apiKey) {
          throw new Error("Gemini API key is missing. Please update it in Settings.");
        }
        const ai = new GoogleGenAI({ apiKey });

        const retry = async (fn: () => Promise<any>, retries = 2, delay = 2000): Promise<any> => {
          try {
            return await fn();
          } catch (error: any) {
            const errorMsg = error.message || "";
            const isRateLimit = error.status === 429 || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429');
            if (retries <= 0 || !isRateLimit) throw error;
            console.warn(`Client-side AI Scan rate limit exceeded, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retry(fn, retries - 1, delay * 2);
          }
        };

        const response = await retry(() => ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType: mimeType, data: base64Data } }
              ]
            }
          ]
        }));
        extractedText = response.text || '';
      }

      setProcessingProgress(100);
      clearInterval(interval);

      if (!extractedText) {
        throw new Error("AI returned an empty response.");
      }

      try {
        const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          
          // Prepare scanned data for review
          setScannedData({
            supplier: {
              name: data.supplierName || data.supplier_name || '',
              gstin: data.supplierGstin || data.supplier_gstin || data.supplierGst || '',
              email: data.supplierEmail || data.supplier_email || '',
              phone: data.supplierPhone || data.supplier_phone || '',
              address: data.supplierAddress || data.supplier_address || '',
            },
            invoiceNumber: data.invoiceNumber || data.invoice_number || `PUR-${Date.now().toString().slice(-6)}`,
            date: (() => {
              if (!data.date) return new Date().toISOString().split('T')[0];
              const d = new Date(data.date);
              return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
            })(),
            totalAmount: data.totalAmount || 0,
            items: (data.items || []).map((item: any) => ({
              particular: item.particular || item.name || 'Unknown Item',
              hsn: item.hsn || '',
              quantity: Number(item.quantity) || 1,
              rate: Number(item.rate) || 0,
              amount: Number(item.amount) || 0,
            }))
          });
          
          setShowScannedReview(true);
        } else {
          throw new Error("Could not extract structured data from the bill.");
        }
      } catch (e: any) {
        console.error("Failed to parse AI response", e);
        throw new Error("Failed to process the AI response: " + e.message);
      }
    } catch (error: any) {
      console.error("AI Scan failed:", error);
      setModal({ isOpen: true, title: 'Scan Failed', message: error.message || "An error occurred while scanning the bill.", type: 'error' });
    } finally {
      clearInterval(interval);
      setTimeout(() => {
        setIsScanning(false);
        setProcessingProgress(0);
      }, 500);
    }
  };

  const filteredPurchases = purchases.filter(p => 
    p.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.suppliers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedPurchases.length === filteredPurchases.length) {
      setSelectedPurchases([]);
    } else {
      setSelectedPurchases(filteredPurchases.map(p => p.id));
    }
  };

  const toggleSelectPurchase = (id: string) => {
    setSelectedPurchases(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Purchases" 
        description="Manage your purchase invoices and expenses."
      >
        <div className="flex items-center space-x-2">
          <DateFilter 
            filterType={filterType}
            setFilterType={setFilterType}
            day={day}
            setDay={setDay}
            year={year}
            setYear={setYear}
            customRange={customRange}
            setCustomRange={setCustomRange}
          />
          <button 
            onClick={() => document.getElementById('purchase-file-input')?.click()}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50 flex items-center shadow-sm text-xs"
          >
            <Scan size={14} className="mr-1.5 text-primary" />
            Scan Bill
          </button>
          <input id="purchase-file-input" type="file" className="hidden" onChange={(e) => {
            if (e.target.files?.[0]) {
              const file = e.target.files[0];
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = async () => {
                const base64Data = (reader.result as string).split(',')[1];
                await processScannedFile(base64Data, file.type);
              };
            }
          }} />
          <button className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold flex items-center hover:bg-primary/90 transition-all" onClick={() => openModal()}>
            <Plus size={14} className="mr-1.5" />
            Record Purchase
          </button>
        </div>
      </PageHeader>

      <div className="glass-card overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3 w-full max-w-2xl">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Search by invoice number or supplier..." 
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-xs transition-all shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {selectedPurchases.length > 0 && (
              <button 
                onClick={confirmBulkDelete}
                className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-red-700 transition-all shrink-0"
              >
                <Trash2 size={14} />
                Bulk Delete ({selectedPurchases.length})
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-all">
              <Filter size={16} />
            </button>
            <div className="h-5 w-[1px] bg-slate-200"></div>
            <p className="text-xs text-slate-500">Showing {filteredPurchases.length} of {purchases.length} purchases</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-2.5 py-1.5 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                    checked={filteredPurchases.length > 0 && selectedPurchases.length === filteredPurchases.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-2.5 py-1.5">Bill Date</th>
                <th className="px-2.5 py-1.5">Upload Date</th>
                <th className="px-2.5 py-1.5">Invoice #</th>
                <th className="px-2.5 py-1.5">Supplier</th>
                <th className="px-2.5 py-1.5">Amount</th>
                <th className="px-2.5 py-1.5">Status</th>
                <th className="px-2.5 py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-xs text-slate-500">
                    No purchases found.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => (
                  <tr 
                    key={purchase.id} 
                    className={cn(
                      "hover:bg-slate-50/50 transition-colors",
                      selectedPurchases.includes(purchase.id) && "bg-primary/5"
                    )}
                  >
                    <td className="px-2.5 py-1.5">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                        checked={selectedPurchases.includes(purchase.id)}
                        onChange={() => toggleSelectPurchase(purchase.id)}
                      />
                    </td>
                    <td className="px-2.5 py-1.5 text-xs text-slate-500">
                      {new Date(purchase.date).toLocaleDateString()}
                    </td>
                    <td className="px-2.5 py-1.5 text-[10px] text-slate-400">
                      {new Date(purchase.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-2.5 py-1.5 text-xs font-medium text-slate-900">{purchase.invoice_number}</td>
                    <td className="px-2.5 py-1.5 text-xs text-slate-600">
                      {purchase.suppliers?.name || 'Unknown Supplier'}
                    </td>
                    <td className="px-2.5 py-1.5 text-xs font-bold text-slate-900">
                      {formatCurrency(purchase.total_amount)}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        purchase.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {purchase.status}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button 
                          onClick={() => openModal(purchase)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => confirmDelete(purchase.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                          <MoreVertical size={14} />
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

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="bg-white shadow-2xl overflow-hidden flex flex-col h-full transition-all duration-300"
              style={{ width: 'calc(100% - var(--sidebar-width))' }}
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900 flex items-center">
                  <ShoppingCart size={20} className="mr-2 text-primary" />
                  {editingPurchase ? 'Edit Purchase' : 'Record Purchase'}
                </h2>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Supplier & Invoice Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier Details</h3>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Select Supplier</label>
                    <select 
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[10px] transition-all"
                      value={formData.supplier_id}
                      onChange={e => {
                        const selected = suppliers.find(s => s.id === e.target.value);
                        setFormData({
                          ...formData, 
                          supplier_id: e.target.value, 
                          supplier_name: selected ? selected.name : '',
                          supplier_gstin: selected ? (selected.gstin || selected.gst_number || '') : '',
                          supplier_email: selected ? (selected.email || '') : '',
                          supplier_phone: selected ? (selected.phone || '') : '',
                          supplier_address: selected ? (selected.address || '') : ''
                        });
                      }}
                    >
                      <option value="">-- New Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 p-2 bg-primary/5 rounded-xl border border-primary/10">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Supplier Name *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Enter supplier name"
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[10px] transition-all"
                        value={formData.supplier_name}
                        onChange={e => setFormData({...formData, supplier_name: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">GST Number</label>
                        <input 
                          type="text" 
                          placeholder="GSTIN"
                          maxLength={15}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[10px] transition-all uppercase"
                          value={formData.supplier_gstin}
                          onChange={e => setFormData({...formData, supplier_gstin: e.target.value.toUpperCase()})}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Phone</label>
                        <input 
                          type="text" 
                          placeholder="Contact"
                          maxLength={10}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[10px] transition-all"
                          value={formData.supplier_phone}
                          onChange={e => setFormData({...formData, supplier_phone: e.target.value.replace(/\D/g, '')})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Email</label>
                      <input 
                        type="email" 
                        placeholder="Email address"
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[10px] transition-all"
                        value={formData.supplier_email}
                        onChange={e => setFormData({...formData, supplier_email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Address</label>
                      <textarea 
                        rows={1}
                        placeholder="Full address"
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[10px] transition-all resize-none"
                        value={formData.supplier_address}
                        onChange={e => setFormData({...formData, supplier_address: e.target.value})}
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invoice Info</h3>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Invoice Number *</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[10px] transition-all"
                      value={formData.invoice_number}
                      onChange={e => setFormData({...formData, invoice_number: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Bill Date *</label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[10px] transition-all"
                      value={formData.bill_date}
                      onChange={e => setFormData({...formData, bill_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Upload Date</label>
                    <input 
                      type="date" 
                      readOnly
                      className="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg outline-none text-[10px] text-slate-500 cursor-not-allowed"
                      value={formData.upload_date}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment & Notes</h3>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Status *</label>
                    <select 
                      required
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[10px] transition-all"
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                    >
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Notes</label>
                    <textarea 
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-[10px] transition-all resize-none"
                      rows={2}
                      placeholder="Additional info..."
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Items</h3>
                  <button 
                    type="button"
                    onClick={() => setFormData({
                      ...formData, 
                      items: [...formData.items, { particular: '', hsn: '', quantity: 1, rate: 0, amount: 0, product_id: null }]
                    })}
                    className="text-[10px] font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-all flex items-center"
                  >
                    <Plus size={12} className="mr-1" /> Add Item
                  </button>
                </div>
                
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-2.5 py-1.5">Particular (Item Name)</th>
                        <th className="px-2.5 py-1.5">HSN</th>
                        <th className="px-2.5 py-1.5 w-24">Qty</th>
                        <th className="px-2.5 py-1.5 w-32">Rate</th>
                        <th className="px-2.5 py-1.5 w-32">Amount</th>
                        <th className="px-2.5 py-1.5 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {formData.items.map((item, index) => (
                        <tr key={index} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="px-2.5 py-1.5">
                            <div className="space-y-1">
                              <input 
                                type="text"
                                placeholder="Item name"
                                className="w-full bg-transparent border-none focus:ring-0 text-xs font-medium p-0"
                                value={item.particular}
                                onChange={e => {
                                  const newItems = [...formData.items];
                                  newItems[index].particular = e.target.value;
                                  // Try to match product
                                  const matched = products.find(p => p.name.toLowerCase() === e.target.value.toLowerCase());
                                  newItems[index].product_id = matched?.id || null;
                                  setFormData({...formData, items: newItems});
                                }}
                              />
                              <div className="flex items-center text-[9px] text-slate-400">
                                <Package size={10} className="mr-1" />
                                {item.product_id ? (
                                  <span className="text-emerald-500 font-bold">Matched in Inventory</span>
                                ) : (
                                  <span>Will create new product</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-2.5 py-1.5">
                            <input 
                              type="text"
                              placeholder="HSN"
                              className="w-full bg-transparent border-none focus:ring-0 text-xs p-0"
                              value={item.hsn}
                              onChange={e => {
                                const newItems = [...formData.items];
                                newItems[index].hsn = e.target.value;
                                setFormData({...formData, items: newItems});
                              }}
                            />
                          </td>
                          <td className="px-2.5 py-1.5">
                            <input 
                              type="number"
                              className="w-full bg-transparent border-none focus:ring-0 text-xs p-0"
                              value={item.quantity}
                              onChange={e => {
                                const qty = parseInt(e.target.value) || 0;
                                const newItems = [...formData.items];
                                newItems[index].quantity = qty;
                                newItems[index].amount = qty * newItems[index].rate;
                                setFormData({
                                  ...formData, 
                                  items: newItems,
                                  total_amount: newItems.reduce((sum, i) => sum + i.amount, 0)
                                });
                              }}
                            />
                          </td>
                          <td className="px-2.5 py-1.5">
                            <input 
                              type="number"
                              className="w-full bg-transparent border-none focus:ring-0 text-xs p-0"
                              value={item.rate}
                              onChange={e => {
                                const rate = parseFloat(e.target.value) || 0;
                                const newItems = [...formData.items];
                                newItems[index].rate = rate;
                                newItems[index].amount = newItems[index].quantity * rate;
                                setFormData({
                                  ...formData, 
                                  items: newItems,
                                  total_amount: newItems.reduce((sum, i) => sum + i.amount, 0)
                                });
                              }}
                            />
                          </td>
                          <td className="px-2.5 py-1.5">
                            <input 
                              type="number"
                              readOnly
                              className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold p-0"
                              value={item.amount}
                            />
                          </td>
                          <td className="px-2.5 py-1.5 text-right">
                            <button 
                              type="button"
                              onClick={() => {
                                const newItems = formData.items.filter((_, i) => i !== index);
                                setFormData({
                                  ...formData, 
                                  items: newItems,
                                  total_amount: newItems.reduce((sum, i) => sum + i.amount, 0)
                                });
                              }}
                              className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {formData.items.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400 italic">
                            No items added. Use "Add Item" or scan a bill.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50/50">
                      <tr>
                        <td colSpan={4} className="px-2.5 py-1.5 text-right text-[10px] font-bold text-slate-500 uppercase">Total Amount</td>
                        <td className="px-2.5 py-1.5 text-[10px] font-black text-primary">{formatCurrency(formData.total_amount)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </form>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center text-[10px] text-slate-500">
                <ShieldCheck size={14} className="mr-1.5 text-emerald-500" />
                Inventory will be updated automatically on save.
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving || (!formData.supplier_id && !formData.supplier_name)}
                  className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-black flex items-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editingPurchase ? 'Update Record' : 'Save Purchase'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title={isBulkDelete ? "Bulk Delete Purchases" : "Delete Purchase"}
        message={isBulkDelete 
          ? `Are you sure you want to delete ${selectedPurchases.length} selected purchases? This action cannot be undone.`
          : "Are you sure you want to delete this purchase record? This action cannot be undone."}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setPurchaseToDelete(null);
          setIsBulkDelete(false);
        }}
      />

      <MessageModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      <AnimatePresence>
        {showScannedReview && scannedData && (
          <ScannedReviewModal 
            data={scannedData}
            onClose={() => setShowScannedReview(false)}
            onConfirm={(finalData) => {
              // Find or create supplier
              let supplierId = '';
              const supplierName = finalData.supplier.name;
              if (supplierName) {
                const existingSupplier = suppliers.find(s => s.name.trim().toLowerCase() === supplierName.trim().toLowerCase());
                if (existingSupplier) {
                  supplierId = existingSupplier.id;
                }
              }

              setFormData({
                supplier_id: supplierId,
                supplier_name: !supplierId ? supplierName : '',
                supplier_gstin: finalData.supplier.gstin,
                supplier_email: finalData.supplier.email,
                supplier_phone: finalData.supplier.phone,
                supplier_address: finalData.supplier.address,
                invoice_number: finalData.invoiceNumber,
                bill_date: finalData.date,
                upload_date: new Date().toISOString().split('T')[0],
                total_amount: finalData.items.reduce((sum: number, i: any) => sum + i.amount, 0),
                status: 'paid',
                notes: 'Scanned via AI',
                items: finalData.items.map((item: any) => {
                  const matchedProduct = products.find(p => p.name.trim().toLowerCase() === item.particular.trim().toLowerCase());
                  return {
                    ...item,
                    product_id: matchedProduct?.id || null
                  };
                })
              });
              
              setShowScannedReview(false);
              setIsModalOpen(true);
              setModal({ isOpen: true, title: 'Success', message: 'Bill details confirmed. You can now review and save.', type: 'success' });
            }}
          />
        )}
      </AnimatePresence>

      {isScanning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center">
            <div className="relative w-24 h-24 mb-4">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path
                  className="text-slate-200"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="text-primary transition-all duration-300"
                  strokeDasharray={processingProgress + ",100"}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-primary">
                {processingProgress}%
              </div>
            </div>
            <p className="text-slate-600 font-medium">Processing Bill...</p>
          </div>
        </div>
      )}
    </div>
  );
}
