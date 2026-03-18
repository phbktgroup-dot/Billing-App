import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  Scan, 
  Search, 
  UserPlus, 
  Package,
  Calculator,
  AlertCircle,
  Camera,
  Loader2
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn, formatCurrency } from '../lib/utils';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import MessageModal from '../components/MessageModal';

interface LineItem {
  id: string;
  productId: string;
  name: string;
  quantity: number | '';
  rate: number | '';
  gstRate: number | '';
  amount: number | '';
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  gst_rate: number;
  stock: number;
}

interface CreateInvoiceProps {
  isModal?: boolean;
  onClose?: () => void;
}

export default function CreateInvoice({ isModal = false, onClose }: CreateInvoiceProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [items, setItems] = useState<LineItem[]>([]);
  const [customer, setCustomer] = useState({ id: '', name: '', phone: '', gst: '' });
  const [newItem, setNewItem] = useState<LineItem>({ id: '', productId: '', name: '', quantity: '', rate: '', gstRate: '', amount: '' });
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
  });
  const [isScanning, setIsScanning] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [savedInvoiceData, setSavedInvoiceData] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [paymentMode, setPaymentMode] = useState('Cash');

  const businessId = profile?.business_id;
  const businessProfile = profile?.business_profiles;

  useEffect(() => {
    if (businessId) {
      fetchInitialData();
    }
  }, [businessId]);

  useEffect(() => {
    if (location.state?.scannedFile && location.state?.fileType) {
      const base64Data = location.state.scannedFile.split(',')[1];
      processScannedFile(base64Data, location.state.fileType);
      // Clear state so it doesn't re-run on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchInitialData = async () => {
    try {
      const { data: prod, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId);
      
      if (prodError) throw prodError;
      if (prod) setProducts(prod);

      const { data: cust, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId);
      
      if (custError) throw custError;
      if (cust) setCustomers(cust);
    } catch (error: any) {
      console.error('Error fetching initial data:', error);
      alert('Failed to load data: ' + error.message);
    }
  };

  const processScannedFile = async (base64Data: string, mimeType: string) => {
    setIsScanning(true);
    setProcessingProgress(0);
    const interval = setInterval(() => {
      setProcessingProgress(p => p < 90 ? p + 10 : p);
    }, 500);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { text: "Extract invoice details: customer name, items (name, quantity, price, gst). Return as JSON format: { customerName: string, items: [{ name: string, quantity: number, rate: number, gstRate: number }] }" },
              { inlineData: { mimeType: mimeType, data: base64Data } }
            ]
          }
        ]
      });

      setProcessingProgress(100);
      clearInterval(interval);

      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          if (data.customerName) setCustomer(prev => ({ ...prev, name: data.customerName }));
          if (data.items) {
            const currentProducts = [...products];
            const newItems = [];
            
            for (const item of data.items) {
              const itemName = item.name || 'Custom Item';
              let product = currentProducts.find(p => p.name.toLowerCase() === itemName.toLowerCase());
              
              if (!product) {
                // Create new product
                const { data: newProd, error: prodError } = await supabase
                  .from('products')
                  .insert([{
                    business_id: businessId,
                    created_by: user?.id,
                    name: itemName,
                    price: item.rate || 0,
                    gst_rate: item.gstRate || 18,
                    stock: 0,
                    sku: `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                    category: 'Uncategorized'
                  }])
                  .select()
                  .single();
                
                if (prodError) {
                  console.error("Failed to add product", prodError);
                } else {
                  product = newProd;
                  currentProducts.push(product);
                }
              }
              
              newItems.push({
                id: Math.random().toString(36).substr(2, 9),
                productId: product?.id || '',
                name: itemName,
                quantity: item.quantity || 1,
                rate: item.rate || 0,
                gstRate: item.gstRate || 18,
                amount: (item.quantity || 1) * (item.rate || 0) * (1 + (item.gstRate || 18) / 100)
              });
            }
            setProducts(currentProducts);
            setItems(newItems);
          }
        }
      } catch (e) {
        console.error("Failed to parse AI response", e);
      }
    } catch (error) {
      console.error("AI Scan failed:", error);
    } finally {
      clearInterval(interval);
      setTimeout(() => {
        setIsScanning(false);
        setProcessingProgress(0);
      }, 500);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        await processScannedFile(base64Data, file.type);
        setSavedInvoiceData(null);
      };
    } catch (error) {
      console.error("File read failed:", error);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': ['.jpeg', '.png', '.jpg'], 'application/pdf': ['.pdf'] },
    multiple: false 
  } as any);

  const addItem = () => {
    if (!newItem.productId && !newItem.name) return;
    setItems([...items, { ...newItem, id: Date.now().toString() }]);
    setNewItem({ id: '', productId: '', name: '', quantity: '', rate: '', gstRate: '', amount: '' });
    setSavedInvoiceData(null);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    setSavedInvoiceData(null);
  };

  const handleCustomerChange = (field: string, value: string) => {
    setCustomer(prev => ({ ...prev, [field]: value }));
    setSavedInvoiceData(null);
  };

  const updateNewItem = (field: keyof LineItem, value: any) => {
    let updated = { ...newItem, [field]: value };
    
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated.name = product.name;
        updated.rate = product.price;
        updated.gstRate = product.gst_rate;
      }
    }

    const qty = field === 'quantity' ? value : updated.quantity;
    const rate = field === 'rate' ? value : updated.rate;
    const gst = field === 'gstRate' ? value : updated.gstRate;
    updated.amount = (Number(qty) || 0) * (Number(rate) || 0) * (1 + (Number(gst) || 0) / 100);
    
    setNewItem(updated);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.rate) || 0)), 0);
    const gstTotal = items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.rate) || 0) * ((Number(item.gstRate) || 0) / 100)), 0);
    const total = subtotal + gstTotal;
    return { subtotal, gstTotal, total };
  };

  const { subtotal, gstTotal, total } = calculateTotals();

  const handleSave = async () => {
    if (!businessId || !businessProfile) {
      setModal({ isOpen: true, title: 'Error', message: 'Business profile not found. Please ensure your business setup is complete.', type: 'error' });
      return;
    }

    // Validation
    if (!customer.name && !customer.id) {
      setModal({ isOpen: true, title: 'Error', message: 'Please enter a customer name or select a customer.', type: 'error' });
      return;
    }

    if (items.length === 0) {
      setModal({ isOpen: true, title: 'Error', message: 'Please add at least one item to the invoice.', type: 'error' });
      return;
    }

    if (items.some(item => !item.name && !item.productId)) {
      setModal({ isOpen: true, title: 'Error', message: 'Please select a product or enter a name for all items.', type: 'error' });
      return;
    }

    setIsSaving(true);

    try {
      // 1. Handle Customer
      let customerId = customer.id;
      if (!customerId) {
        // Check if customer with same name and phone exists
        const existingCustomer = customers.find(c => 
          c.name.toLowerCase() === customer.name.toLowerCase() && 
          c.phone === customer.phone
        );

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: newCust, error: custError } = await supabase
            .from('customers')
            .insert([{
              business_id: businessId,
              name: customer.name || 'Walk-in Customer',
              phone: customer.phone || '0000000000',
              gstin: customer.gst,
              address: '',
              created_by: user?.id
            }])
            .select()
            .single();
          
          if (custError) throw custError;
          customerId = newCust.id;
        }
      }

      // 2. Create Invoice
      const invoiceNumber = `${businessProfile.invoice_prefix}-${Date.now()}`;
      const finalPaymentMode = paymentStatus === 'unpaid' ? 'Unpaid' : paymentMode;
      
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert([{
          business_id: businessId,
          customer_id: customerId,
          invoice_number: invoiceNumber,
          date: new Date().toISOString().split('T')[0],
          subtotal,
          tax_amount: gstTotal,
          total,
          status: paymentStatus,
          payment_mode: finalPaymentMode,
          created_by: user?.id
        }])
        .select()
        .single();
      
      if (invError) throw invError;

      // 3. Create missing products and prepare Invoice Items
      const invoiceItems = [];
      for (const item of items) {
        let productId = item.productId;
        
        if (!productId) {
          // Check if product with same name exists
          const itemName = item.name || 'Custom Item';
          const existingProduct = products.find(p => p.name.toLowerCase() === itemName.toLowerCase());
          
          if (existingProduct) {
            productId = existingProduct.id;
          } else {
            // Create new product
            const { data: newProd, error: prodError } = await supabase
              .from('products')
              .insert([{
                business_id: businessId,
                created_by: user?.id,
                name: itemName,
                price: Number(item.rate) || 0,
                gst_rate: Number(item.gstRate) || 18,
                stock: 0,
                sku: `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                category: 'Uncategorized'
              }])
              .select()
              .single();
            
            if (prodError) throw prodError;
            productId = newProd.id;
            
            // Update local products state so we don't create it again if there are duplicates
            setProducts(prev => [...prev, newProd]);
          }
        }

        invoiceItems.push({
          invoice_id: invoice.id,
          product_id: productId,
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.rate) || 0,
          gst_rate: Number(item.gstRate) || 0,
          amount: Number(item.amount) || 0
        });
      }

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);
      
      if (itemsError) throw itemsError;

      // Update Stock
      for (const item of items) {
        if (item.productId) {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            await supabase
              .from('products')
              .update({ stock: product.stock - (Number(item.quantity) || 0) })
              .eq('id', item.productId);
          }
        }
      }

      // Save data for download
      const invoiceDataToSave = {
        invoice_number: invoiceNumber,
        date: new Date().toISOString(),
        customer_name: customer.name || "Walk-in Customer",
        customer_gstin: customer.gst,
        payment_mode: finalPaymentMode,
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          rate: item.rate,
          gstRate: item.gstRate,
          amount: item.amount
        })),
        subtotal,
        tax_amount: gstTotal,
        total
      };
      setSavedInvoiceData(null);

      // Clear fields
      setItems([]);
      setCustomer({ id: '', name: '', phone: '', gst: '' });

      setIsSaving(false);
      setModal({ isOpen: true, title: 'Success', message: 'Invoice saved successfully!', type: 'success' });
      setTimeout(() => navigate('/invoices'), 1500);
    } catch (error: any) {
      console.error("Error saving invoice:", error);
      setModal({ isOpen: true, title: 'Error', message: error.message, type: 'error' });
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create New Invoice</h1>
          <p className="text-slate-500">Generate professional invoices.</p>
        </div>
        <button 
          onClick={() => document.getElementById('file-input')?.click()}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold flex items-center hover:bg-primary/90 transition-all"
        >
          <Scan size={16} className="mr-2" />
          AI Scan
        </button>
        <input id="file-input" type="file" className="hidden" onChange={(e) => {
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
      </div>

      {/* Customer Details & Item Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-6">
          <h3 className="font-bold text-slate-900 mb-4">Customer Details</h3>
          <div className="space-y-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Customer Name"
                className="w-full px-4 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
                value={customer.name}
                onChange={e => {
                  const val = e.target.value;
                  handleCustomerChange('name', val);
                  const existing = customers.find(c => c.name.toLowerCase() === val.toLowerCase());
                  if (existing) {
                    handleCustomerChange('id', existing.id);
                    handleCustomerChange('phone', existing.phone || '');
                    handleCustomerChange('gst', existing.gstin || '');
                  } else {
                    handleCustomerChange('id', '');
                  }
                }}
                list="customer-list"
              />
              <datalist id="customer-list">
                {customers.map(c => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
            <input 
              type="text" 
              placeholder="Phone"
              className="w-full px-4 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
              value={customer.phone}
              onChange={e => {
                const val = e.target.value;
                handleCustomerChange('phone', val);
                const existing = customers.find(c => c.phone === val && c.name.toLowerCase() === customer.name.toLowerCase());
                if (existing) {
                  handleCustomerChange('id', existing.id);
                  handleCustomerChange('gst', existing.gstin || '');
                }
              }}
            />
            <input 
              type="text" 
              placeholder="GSTIN"
              className="w-full px-4 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all uppercase"
              value={customer.gst}
              onChange={e => handleCustomerChange('gst', e.target.value)}
            />
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Payment Status</label>
                <select 
                  className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-lg focus:border-primary outline-none text-sm transition-all"
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value)}
                >
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Payment Mode</label>
                <select 
                  className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-lg focus:border-primary outline-none text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  disabled={paymentStatus === 'unpaid'}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Online Bank NEFT">Online Bank NEFT</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <h3 className="font-bold text-slate-900 mb-4">Item Details</h3>
          <div className="space-y-4">
            <select 
              className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-lg focus:border-primary outline-none text-sm transition-all"
              value={newItem.productId}
              onChange={e => updateNewItem('productId', e.target.value)}
            >
              <option value="">Select Item</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-4 gap-4">
              <input 
                type="number" 
                placeholder="Qty"
                className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-lg focus:border-primary outline-none text-sm transition-all"
                value={newItem.quantity}
                onChange={e => updateNewItem('quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
              />
              <input 
                type="number" 
                placeholder="Rate"
                className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-lg focus:border-primary outline-none text-sm transition-all"
                value={newItem.rate}
                onChange={e => updateNewItem('rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
              />
              <select 
                className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-lg focus:border-primary outline-none text-sm transition-all"
                value={newItem.gstRate}
                onChange={e => updateNewItem('gstRate', e.target.value === '' ? '' : parseFloat(e.target.value))}
              >
                <option value="">GST</option>
                <option value={0}>0%</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
              <div className="text-sm font-bold text-slate-900 flex items-center justify-end">
                {formatCurrency(Number(newItem.amount) || 0)}
              </div>
            </div>
            <button 
              onClick={addItem}
              className="w-full py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold flex items-center justify-center hover:bg-emerald-600 transition-all"
            >
              <Plus size={16} className="mr-2" />
              Add Item
            </button>
          </div>
        </div>
      </div>

      {/* Added Items */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Added Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="px-6 py-3">#</th>
                <th className="px-6 py-3">Item</th>
                <th className="px-6 py-3">QTY</th>
                <th className="px-6 py-3">Unit Price</th>
                <th className="px-6 py-3">GST</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-6 py-4">{index + 1}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                  <td className="px-6 py-4">{item.quantity}</td>
                  <td className="px-6 py-4">{formatCurrency(Number(item.rate) || 0)}</td>
                  <td className="px-6 py-4">{item.gstRate}%</td>
                  <td className="px-6 py-4 font-bold">{formatCurrency(Number(item.amount) || 0)}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Summary */}
      <div className="glass-card p-6 bg-primary text-white">
        <h3 className="font-bold mb-4">Invoice Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="opacity-70">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">GST Total</span>
            <span className="font-medium">{formatCurrency(gstTotal)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
            <span>Grand Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-8 py-4 bg-primary text-white rounded-xl font-bold flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Save size={18} className="mr-2" />
          )}
          Save Invoice
        </button>
      </div>

      <MessageModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
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
                  strokeDasharray={`${processingProgress}, 100`}
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
            <p className="text-slate-600 font-medium">Processing Invoice...</p>
          </div>
        </div>
      )}
    </div>
  );
}
