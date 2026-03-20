import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ScanOptionsModal from '../components/ScanOptionsModal';
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
  Loader2,
  FileText,
  Calendar,
  CreditCard,
  Percent,
  ChevronRight,
  Eye,
  Edit3,
  X,
  Share2
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatCurrency } from '../lib/utils';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import MessageModal from '../components/MessageModal';
import QuickAddModal from '../components/QuickAddModal';
import { getApiUrl } from '../lib/api';

// ... (rest of the component)

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
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [savedInvoiceData, setSavedInvoiceData] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [quickAdd, setQuickAdd] = useState<{ isOpen: boolean; type: 'customer' | 'product' }>({ isOpen: false, type: 'customer' });
  const [isAutosaving, setIsAutosaving] = useState(false);

  const businessId = profile?.business_id;
  const businessProfile = profile?.business_profiles;

  // Autosave
  useEffect(() => {
    const timer = setTimeout(() => {
      if (items.length > 0 || customer.name) {
        setIsAutosaving(true);
        localStorage.setItem('invoice_draft', JSON.stringify({ items, customer, discount, discountType, notes, terms }));
        setTimeout(() => setIsAutosaving(false), 1000);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [items, customer, discount, discountType, notes, terms]);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Data = reader.result as string;
        processScannedFile(base64Data.split(',')[1], file.type);
      };
    }
    setShowScanOptions(false);
  };

  const processScannedFile = async (base64Data: string, mimeType: string) => {
    setIsScanning(true);
    setProcessingProgress(0);
    const interval = setInterval(() => {
      setProcessingProgress(p => p < 90 ? p + 10 : p);
    }, 500);

    try {
      const apiKey = profile?.business_profiles?.gemini_api_key || process.env.GEMINI_API_KEY;
      console.log('Using API Key for scan:', apiKey ? 'Provided' : 'None');
      
      const prompt = "Extract invoice details: customer name, items (name, quantity, price, gst). Return as JSON format: { customerName: string, items: [{ name: string, quantity: number, rate: number, gstRate: number }] }";

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
          throw new Error(errorData.error || "Backend scan failed");
        }
      } catch (backendError: any) {
        // If it's a 429 from backend, don't fallback to client-side (it will likely fail too)
        if (backendError.message.includes('capacity') || backendError.message.includes('limit')) {
          throw backendError;
        }

        console.warn("Backend scan failed, falling back to client-side scan:", backendError);
        
        // Fallback to client-side scanning
        if (!apiKey) {
          throw new Error("Gemini API key is missing. Please contact support.");
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
          if (data.customerName) setCustomer(prev => ({ ...prev, name: data.customerName }));
          if (data.items && Array.isArray(data.items)) {
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
            setModal({ isOpen: true, title: 'Success', message: 'Invoice scanned and items extracted successfully!', type: 'success' });
          } else {
            throw new Error("No items found in the scanned invoice.");
          }
        } else {
          throw new Error("Could not extract structured data from the invoice.");
        }
      } catch (e: any) {
        console.error("Failed to parse AI response", e);
        throw new Error("Failed to process the AI response: " + e.message);
      }
    } catch (error: any) {
      console.error("AI Scan failed:", error);
      setModal({ 
        isOpen: true, 
        title: 'Scan Failed', 
        message: error.message.includes('quota') 
          ? "AI scanning quota exceeded. Please try again later or add your own Gemini API key in Settings to avoid shared limits."
          : (error.message || "An error occurred while scanning the invoice."), 
        type: 'error' 
      });
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
    
    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = (subtotal * discount) / 100;
    } else {
      discountAmount = discount;
    }

    const total = subtotal + gstTotal - discountAmount;
    return { subtotal, gstTotal, total, discountAmount };
  };

  const { subtotal, gstTotal, total, discountAmount } = calculateTotals();

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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6 pb-10"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create New Invoice</h1>
            <p className="text-xs text-slate-500">Draft professional invoices with AI assistance.</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {isAutosaving && <span className="text-[10px] text-slate-400 animate-pulse">Saving draft...</span>}
          
          <button 
            onClick={() => setShowScanOptions(true)}
            className="px-4 py-2 bg-primary text-white rounded-xl text-[11px] font-bold flex items-center hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Scan size={14} className="mr-2" />
            AI Scan
          </button>
        </div>
        
        {showScanOptions && (
          <ScanOptionsModal 
            onClose={() => setShowScanOptions(false)} 
            onFileSelect={handleFileSelect} 
          />
        )}
      </div>

      <QuickAddModal 
        isOpen={quickAdd.isOpen} 
        type={quickAdd.type} 
        onClose={() => setQuickAdd({ ...quickAdd, isOpen: false })}
        onAdd={(data) => {
          if (quickAdd.type === 'customer') {
            setCustomer(prev => ({ ...prev, name: data.name, phone: data.phone }));
          } else {
            setProducts(prev => [...prev, { ...data, id: Date.now().toString(), stock: 0, sku: 'NEW', gst_rate: 18 }]);
          }
        }}
      />

      <AnimatePresence mode="wait">
        {viewMode === 'edit' ? (
          <motion.div 
            key="edit-view"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start"
          >
            <div className="xl:col-span-2 space-y-6 pr-2">
              {/* Customer & Details Section */}
              <div className="p-6 rounded-2xl bg-[#111827] text-white">
                <div className="flex items-center space-x-2 mb-6">
                  <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                    <UserPlus size={18} />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Customer & Billing</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Customer Name</label>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input 
                          type="text" 
                          placeholder="Search or enter name"
                          className="w-full pl-9 pr-3 py-2 bg-[#1f2937] border border-transparent rounded-xl focus:bg-[#374151] focus:border-blue-500 outline-none text-xs transition-all text-white placeholder-slate-500"
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
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Phone Number</label>
                        <input 
                          type="text" 
                          placeholder="Contact number"
                          className="w-full px-3 py-2 bg-[#1f2937] border border-transparent rounded-xl focus:bg-[#374151] focus:border-blue-500 outline-none text-xs transition-all text-white placeholder-slate-500"
                          value={customer.phone}
                          onChange={e => handleCustomerChange('phone', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">GSTIN (Optional)</label>
                        <input 
                          type="text" 
                          placeholder="GST Number"
                          className="w-full px-3 py-2 bg-[#1f2937] border border-transparent rounded-xl focus:bg-[#374151] focus:border-blue-500 outline-none text-xs transition-all uppercase text-white placeholder-slate-500"
                          value={customer.gst}
                          onChange={e => handleCustomerChange('gst', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Invoice Date</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="date" 
                            className="w-full pl-9 pr-3 py-2 bg-white border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all text-black"
                            defaultValue={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Due Date</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="date" 
                            className="w-full pl-9 pr-3 py-2 bg-white border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all text-black"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
                        <div className="relative">
                          <AlertCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <select 
                            className="w-full pl-9 pr-3 py-2 bg-white border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all appearance-none text-black"
                            value={paymentStatus}
                            onChange={e => setPaymentStatus(e.target.value)}
                          >
                            <option value="paid">Paid</option>
                            <option value="unpaid">Unpaid</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Mode</label>
                        <div className="relative">
                          <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <select 
                            className="w-full pl-9 pr-3 py-2 bg-white border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all appearance-none disabled:opacity-50 text-black"
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
                </div>
              </div>

              {/* Items Section */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Package size={18} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Line Items</h3>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                    {items.length} Items Added
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Item Input Row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="md:col-span-4 space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Product / Service</label>
                      <select 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-primary outline-none text-xs transition-all"
                        value={newItem.productId}
                        onChange={e => updateNewItem('productId', e.target.value)}
                      >
                        <option value="">Select Item</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Quantity</label>
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-primary outline-none text-xs transition-all"
                        value={newItem.quantity}
                        onChange={e => updateNewItem('quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Rate</label>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-primary outline-none text-xs transition-all"
                        value={newItem.rate}
                        onChange={e => updateNewItem('rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">GST %</label>
                      <select 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-primary outline-none text-xs transition-all"
                        value={newItem.gstRate}
                        onChange={e => updateNewItem('gstRate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button 
                        onClick={addItem}
                        className="w-full py-2 bg-emerald-500 text-white rounded-xl text-[11px] font-bold flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <Plus size={14} className="mr-1.5" />
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[10px] text-slate-400 uppercase border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 font-bold">Item Description</th>
                          <th className="px-4 py-3 font-bold text-center">Qty</th>
                          <th className="px-4 py-3 font-bold text-right">Price</th>
                          <th className="px-4 py-3 font-bold text-center">GST</th>
                          <th className="px-4 py-3 font-bold text-right">Total</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                              <div className="flex flex-col items-center">
                                <Package size={32} className="opacity-20 mb-2" />
                                <p>No items added yet. Start by adding products above.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          items.map((item, index) => (
                            <motion.tr 
                              key={item.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="group hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="px-4 py-4">
                                <div className="font-bold text-slate-900">{item.name}</div>
                                <div className="text-[10px] text-slate-400">Item #{index + 1}</div>
                              </td>
                              <td className="px-4 py-4 text-center font-medium">{item.quantity}</td>
                              <td className="px-4 py-4 text-right font-medium">{formatCurrency(Number(item.rate) || 0)}</td>
                              <td className="px-4 py-4 text-center">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                                  {item.gstRate}%
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right font-bold text-slate-900">
                                {formatCurrency(Number(item.amount) || 0)}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <button 
                                  onClick={() => removeItem(item.id)} 
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </motion.tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="text-xs font-bold text-slate-900 mb-4 uppercase tracking-wider">Notes</h3>
                  <textarea 
                    placeholder="Add a personal note to the customer..."
                    className="w-full h-24 px-4 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:border-primary outline-none text-xs transition-all resize-none"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
                <div className="glass-card p-6">
                  <h3 className="text-xs font-bold text-slate-900 mb-4 uppercase tracking-wider">Terms & Conditions</h3>
                  <textarea 
                    placeholder="Payment terms, return policy, etc."
                    className="w-full h-24 px-4 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:border-primary outline-none text-xs transition-all resize-none"
                    value={terms}
                    onChange={e => setTerms(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-4 tracking-wider">Quick Actions</h3>
                  <div className="space-y-2">
                    <button className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-between group transition-all">
                      <div className="flex items-center space-x-3">
                        <div className="p-1.5 bg-white rounded-lg text-slate-600">
                          <Download size={14} />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700">Download Draft</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-between group transition-all">
                      <div className="flex items-center space-x-3">
                        <div className="p-1.5 bg-white rounded-lg text-slate-600">
                          <Calculator size={14} />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700">Tax Breakdown</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
                
                {/* AI Assistant Card */}
                <div className="glass-card p-6 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                  <h3 className="text-[10px] font-bold uppercase mb-2 tracking-wider opacity-80">AI Assistant</h3>
                  <p className="text-sm font-bold mb-4">Need help with this invoice?</p>
                  <button className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-all">
                    Ask AI for Suggestions
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar Summary */}
            <div className="space-y-6 xl:col-span-1">
              <div className="glass-card p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider">Invoice Summary</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-bold text-slate-900">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Tax (GST)</span>
                    <span className="font-bold text-slate-900">{formatCurrency(gstTotal)}</span>
                  </div>
                  
                  {/* Discount Section */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Percent size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-500">Discount</span>
                      </div>
                      <div className="flex bg-slate-100 p-0.5 rounded-lg">
                        <button 
                          onClick={() => setDiscountType('percentage')}
                          className={cn(
                            "px-2 py-1 rounded-md text-[9px] font-bold transition-all",
                            discountType === 'percentage' ? "bg-white text-primary shadow-sm" : "text-slate-500"
                          )}
                        >
                          %
                        </button>
                        <button 
                          onClick={() => setDiscountType('fixed')}
                          className={cn(
                            "px-2 py-1 rounded-md text-[9px] font-bold transition-all",
                            discountType === 'fixed' ? "bg-white text-primary shadow-sm" : "text-slate-500"
                          )}
                        >
                          ₹
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all pr-12"
                        value={discount === 0 ? '' : discount}
                        onChange={e => setDiscount(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        {discountType === 'percentage' ? '%' : 'INR'}
                      </span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between items-center text-xs text-emerald-600 font-bold">
                        <span>Discount Applied</span>
                        <span>-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-sm font-bold text-slate-900">Total Amount</span>
                      <span className="text-xl font-black text-primary">{formatCurrency(total)}</span>
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setViewMode('preview')}
                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold flex items-center justify-center hover:bg-slate-200 transition-all"
                      >
                        <Eye size={18} className="mr-2" />
                        Preview
                      </button>
                      <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-primary text-white rounded-2xl font-bold flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-all shadow-xl shadow-primary/20 group"
                      >
                        {isSaving ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                          <>
                            <Save size={18} className="mr-2 group-hover:scale-110 transition-transform" />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                    
                    <p className="text-[10px] text-center text-slate-400 mt-4">
                      By saving, you agree to our terms of service and tax compliance guidelines.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="preview-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-4xl mx-auto"
          >
            <div className="glass-card p-12 bg-white shadow-2xl min-h-[800px] flex flex-col">
              {/* Invoice Header */}
              <div className="flex justify-between items-start mb-12">
                <div>
                  <div className="text-3xl font-black text-primary mb-2">INVOICE</div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    #{businessProfile?.invoice_prefix || 'INV'}-{Date.now().toString().slice(-6)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900">{businessProfile?.business_name}</div>
                  <div className="text-xs text-slate-500 max-w-[200px] ml-auto">
                    {businessProfile?.address || 'Your Business Address'}
                  </div>
                  {businessProfile?.gstin && (
                    <div className="text-[10px] font-bold text-slate-400 mt-1">GSTIN: {businessProfile.gstin}</div>
                  )}
                </div>
              </div>

              {/* Billing Info */}
              <div className="grid grid-cols-2 gap-12 mb-12">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider">Bill To</div>
                  <div className="text-base font-bold text-slate-900">{customer.name || 'Walk-in Customer'}</div>
                  <div className="text-xs text-slate-500 mt-1">{customer.phone}</div>
                  {customer.gst && (
                    <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">GSTIN: {customer.gst}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider">Details</div>
                  <div className="space-y-1">
                    <div className="flex justify-end space-x-4 text-xs">
                      <span className="text-slate-400">Date:</span>
                      <span className="font-bold text-slate-900">{new Date().toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-end space-x-4 text-xs">
                      <span className="text-slate-400">Due Date:</span>
                      <span className="font-bold text-slate-900">{new Date(dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-end space-x-4 text-xs">
                      <span className="text-slate-400">Status:</span>
                      <span className={cn(
                        "font-bold uppercase text-[9px] px-2 py-0.5 rounded",
                        paymentStatus === 'paid' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                      )}>
                        {paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="flex-grow">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <th className="py-4 text-[10px] font-black uppercase tracking-wider">Description</th>
                      <th className="py-4 text-[10px] font-black uppercase tracking-wider text-center">Qty</th>
                      <th className="py-4 text-[10px] font-black uppercase tracking-wider text-right">Rate</th>
                      <th className="py-4 text-[10px] font-black uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-4">
                          <div className="text-sm font-bold text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-400">GST {item.gstRate}%</div>
                        </td>
                        <td className="py-4 text-center text-sm">{item.quantity}</td>
                        <td className="py-4 text-right text-sm">{formatCurrency(Number(item.rate) || 0)}</td>
                        <td className="py-4 text-right text-sm font-bold">{formatCurrency(Number(item.amount) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-12 pt-12 border-t border-slate-100">
                <div className="flex justify-end">
                  <div className="w-64 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Subtotal</span>
                      <span className="font-bold text-slate-900">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Tax (GST)</span>
                      <span className="font-bold text-slate-900">{formatCurrency(gstTotal)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-xs text-emerald-600">
                        <span>Discount</span>
                        <span className="font-bold">-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900">
                      <span className="text-sm font-black uppercase">Total</span>
                      <span className="text-xl font-black text-primary">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-12 grid grid-cols-2 gap-12">
                <div>
                  {notes && (
                    <div className="mb-6">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Notes</div>
                      <div className="text-xs text-slate-500 leading-relaxed">{notes}</div>
                    </div>
                  )}
                  {terms && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Terms</div>
                      <div className="text-xs text-slate-500 leading-relaxed">{terms}</div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-end items-end">
                  <div className="w-32 h-1 bg-slate-100 mb-2" />
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Authorized Signatory</div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-center space-x-4">
              <button 
                onClick={() => setViewMode('edit')}
                className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-lg"
              >
                Back to Edit
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-8 py-3 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                Confirm & Save Invoice
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MessageModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
      
      {/* Scanning Overlay */}
      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-10 rounded-[32px] shadow-2xl flex flex-col items-center max-w-sm w-full mx-4"
            >
              <div className="relative w-32 h-32 mb-8">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle
                    className="text-slate-100"
                    cx="18" cy="18" r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <motion.circle
                    className="text-primary"
                    cx="18" cy="18" r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="100"
                    initial={{ strokeDashoffset: 100 }}
                    animate={{ strokeDashoffset: 100 - processingProgress }}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-black text-2xl text-primary">
                  {processingProgress}%
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">AI is Analyzing</h3>
              <p className="text-slate-500 text-center text-sm leading-relaxed">
                We're extracting items and customer details from your invoice. Please wait...
              </p>
              
              <div className="mt-8 w-full space-y-2">
                <div className="flex items-center space-x-3 text-xs text-emerald-500 font-bold">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>OCR Processing...</span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-300 font-bold">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span>Entity Extraction...</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <datalist id="customer-list">
        {customers.map(c => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
    </motion.div>
  );
}
