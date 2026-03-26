import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
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
import { cn, formatCurrency, getDateRange, FilterType, formatSeriesNumber } from '../lib/utils';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateInvoicePDF } from '../lib/pdfGenerator';
import MessageModal from '../components/MessageModal';
import QuickAddModal from '../components/QuickAddModal';
import { getApiUrl } from '../lib/api';
import { DateFilter } from '../components/DateFilter';

// ... (rest of the component)

import { STATE_CODES } from '../constants/stateCodes';

interface LineItem {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  quantity: number | '';
  rate: number | '';
  gstRate: number | '';
  discount?: number | '';
  amount: number | '';
}

interface Product {
  id: string;
  name: string;
  sku: string;
  hsn_code?: string;
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
  const [customer, setCustomer] = useState({ id: '', name: '', phone: '', gst: '', address1: '', address2: '', city: '', pincode: '', stateCode: '' });
  const [newItem, setNewItem] = useState<LineItem>({ id: '', productId: '', name: '', quantity: '', rate: '', gstRate: '', discount: '', amount: '' });
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
  const [invoiceSeries, setInvoiceSeries] = useState<any[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [savedInvoiceData, setSavedInvoiceData] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ isOpen: boolean; type: 'customer' | 'product' }>({ isOpen: false, type: 'customer' });
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [showSeriesList, setShowSeriesList] = useState(false);
  const [isScannedInvoiceNumberFound, setIsScannedInvoiceNumberFound] = useState(false);
  const [includeEwayBill, setIncludeEwayBill] = useState(false);

  // E-way bill state
  const [ewaySettings, setEwaySettings] = useState<any>(null);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [ewayData, setEwayData] = useState({
    ewayBillNo: '',
    transporterId: '',
    transporterName: '',
    transDocNo: '',
    transMode: '1',
    transDistance: 100,
    transDocDate: '',
    vehicleNo: '',
    vehicleType: 'R',
    transactionType: 1,
    supplyType: 'O',
    subSupplyType: '1',
    TotNonAdvolVal: 0,
    OthValue: 0
  });

  const [filterType, setFilterType] = useState<FilterType>('thisMonth');
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [day, setDay] = useState<string>(getLocalToday());
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (invoiceSeries.length > 0 && !invoiceNumber && !isScannedInvoiceNumberFound) {
      // Prefer INV- series as default
      const invSeries = invoiceSeries.find(s => s.prefix === 'INV-');
      const series = invSeries || invoiceSeries[0];
      setInvoiceNumber(formatSeriesNumber(series));
      setSelectedSeriesId(series.id);
    }
  }, [invoiceSeries, invoiceNumber, isScannedInvoiceNumberFound]);

  const handlePreview = async () => {
    setViewMode('preview');
    setPreviewPdfUrl(null);
    
    // Ensure we have an invoice number and it's consistent
    let currentInvoiceNumber = invoiceNumber;
    if (!currentInvoiceNumber) {
      const selectedSeries = invoiceSeries.find(s => s.id === selectedSeriesId);
      if (selectedSeries) {
        currentInvoiceNumber = formatSeriesNumber(selectedSeries);
      } else {
        const prefix = businessProfile?.invoice_prefix || 'INV';
        const number = Date.now().toString().slice(-6);
        currentInvoiceNumber = `${prefix}-${number}`;
      }
      setInvoiceNumber(currentInvoiceNumber);
    }

    const invoiceData = {
      invoice_number: currentInvoiceNumber,
      date: new Date().toISOString(),
      customer_name: customer.name || 'Walk-in Customer',
      customer_gstin: customer.gst,
      customer_address: [customer.address1, customer.address2, [customer.city, customer.pincode].filter(Boolean).join(', ')].filter(Boolean).join('\n'),
      payment_mode: paymentMode,
      discount: totalDiscount,
      discount_percentage: discountType === 'percentage' ? discount : undefined,
      due_date: dueDate,
      items: items.map(item => ({
        name: item.name,
        quantity: Number(item.quantity) || 0,
        rate: Number(item.rate) || 0,
        gstRate: Number(item.gstRate) || 0,
        amount: Number(item.amount) || 0
      })),
      subtotal: taxableAmount,
      raw_subtotal: rawSubtotal,
      tax_amount: gstTotal,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      is_inter_state: isInterState,
      eway_bill_no: ewayData.ewayBillNo,
      total,
      notes,
      terms
    };
    
    const blob = await generateInvoicePDF(invoiceData, {
      name: businessProfile?.name || '',
      address1: businessProfile?.address1,
      address2: businessProfile?.address2,
      city: businessProfile?.city,
      state: businessProfile?.state,
      pincode: businessProfile?.pincode,
      mobile: businessProfile?.mobile,
      email: businessProfile?.email,
      gst_number: businessProfile?.gst_number,
      pan_number: businessProfile?.pan_number,
      bank_name: businessProfile?.bank_name,
      bank_account_no: businessProfile?.bank_account_no,
      bank_ifsc: businessProfile?.bank_ifsc,
      bank_branch: businessProfile?.bank_branch,
      logo_url: businessProfile?.logo_url,
      invoice_prefix: businessProfile?.invoice_prefix
    }, true) as Blob;
    
    const blobUrl = URL.createObjectURL(blob);
    setPreviewPdfUrl(blobUrl);
  };

  const handleScanClick = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      cameraInputRef.current?.click();
    } else {
      setShowScanOptions(true);
    }
  };

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
    if (businessProfile) {
      if (!notes && businessProfile.default_notes) {
        setNotes(businessProfile.default_notes);
      }
      if (!terms && businessProfile.default_terms) {
        setTerms(businessProfile.default_terms);
      }
    }
  }, [businessProfile]);

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
      if (businessId) {
        const savedEway = localStorage.getItem(`eway_settings_${businessId}`);
        if (savedEway) {
          try {
            const parsed = JSON.parse(savedEway);
            setEwaySettings(parsed);
            if (parsed.ewayBillEnabled) {
              setEwayData(prev => ({
                ...prev,
                transporterId: parsed.ewayDefaultTransporterId || '',
                transporterName: parsed.ewayDefaultTransporterName || ''
              }));
            }
          } catch (e) {
            console.error("Failed to parse eway settings");
          }
        }
      }

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

      const { data: series, error: seriesError } = await supabase
        .from('invoice_series')
        .select('*')
        .eq('business_id', businessId);
      
      if (seriesError) throw seriesError;
      
      let finalSeries = series || [];
      if (finalSeries.length === 0) {
        // Create default INV- series
        const { data: newSeries, error: createError } = await supabase
          .from('invoice_series')
          .insert([{
            business_id: businessId,
            name: 'INV-0000000001',
            prefix: 'INV-',
            current_number: 1
          }])
          .select()
          .single();
        
        if (!createError && newSeries) {
          finalSeries = [newSeries];
        }
      }
      
      setInvoiceSeries(finalSeries);
      if (finalSeries.length > 0) {
        // Prefer INV- series as default
        const invSeries = finalSeries.find(s => s.prefix === 'INV-');
        if (invSeries) {
          setSelectedSeriesId(invSeries.id);
        } else {
          setSelectedSeriesId(finalSeries[0].id);
        }
      }

      const { data: trans, error: transError } = await supabase
        .from('transporters')
        .select('*')
        .eq('business_id', businessId);
      
      if (transError) throw transError;
      if (trans) setTransporters(trans);
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
      const apiKey = profile?.business_profiles?.gemini_api_key || import.meta.env.VITE_GEMINI_API_KEY;
      console.log('Using API Key for scan:', apiKey ? 'Provided' : 'None');
      
      const prompt = "Extract invoice details: invoice number, customer name, customer phone, customer email, customer gst, customer address line 1, customer address line 2, customer city, customer pincode, items (name, quantity, price, gst, hsn code). Return as JSON format: { invoiceNumber: string, customerName: string, customerPhone: string, customerEmail: string, customerGst: string, customerAddress1: string, customerAddress2: string, customerCity: string, customerPincode: string, items: [{ name: string, quantity: number, rate: number, gstRate: number, hsnCode: string }] }";

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
        
        // If it's an API key error from backend, don't fallback to client-side
        if (backendError.message.includes('API key not valid') || backendError.message.includes('API_KEY_INVALID')) {
          throw new Error("The Gemini API key is invalid or missing. Please update it in Settings.");
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
          
          if (data.invoiceNumber) {
            const currentSeries = invoiceSeries.find(s => s.id === selectedSeriesId);
            let finalScannedInvoiceNumber = data.invoiceNumber;
            if (currentSeries && !data.invoiceNumber.startsWith(currentSeries.prefix)) {
              finalScannedInvoiceNumber = `${currentSeries.prefix}${data.invoiceNumber}`;
            }

            // Check if invoice number already exists
            const { data: existingInvoice } = await supabase
              .from('invoices')
              .select('id')
              .eq('business_id', profile?.business_id)
              .eq('invoice_number', finalScannedInvoiceNumber)
              .maybeSingle();

            if (existingInvoice) {
              // If it exists, use the next number from current series
              const series = currentSeries || invoiceSeries.find(s => s.prefix === 'INV-') || invoiceSeries[0];
              if (series) {
                finalScannedInvoiceNumber = formatSeriesNumber(series);
                setSelectedSeriesId(series.id);
              }
            }
            
            setInvoiceNumber(finalScannedInvoiceNumber);
            setIsScannedInvoiceNumberFound(true);
            
            // Extract prefix and number more intelligently (e.g., SN-001 -> SN-, 001; INV/100 -> INV/, 100)
            const numberMatch = finalScannedInvoiceNumber.match(/^(.*?)([0-9]+)$/);
            let scannedPrefix = '';
            let scannedNumber = 1;
            
            if (numberMatch) {
              scannedPrefix = numberMatch[1];
              scannedNumber = parseInt(numberMatch[2]);
            } else {
              scannedPrefix = finalScannedInvoiceNumber;
            }
            
            // Clean up prefix if it's just the whole string (no numeric part at end)
            if (!scannedPrefix && finalScannedInvoiceNumber) {
              scannedPrefix = finalScannedInvoiceNumber;
            }

            let matchingSeries = invoiceSeries.find(s => s.prefix === scannedPrefix);
            
            if (!matchingSeries) {
              // Add new series
              const currentBusinessId = profile?.business_id;
              if (currentBusinessId) {
                const { data: newSeries, error: seriesError } = await supabase
                  .from('invoice_series')
                  .insert([{
                    business_id: currentBusinessId,
                    name: data.invoiceNumber, // Store original to preserve padding
                    prefix: scannedPrefix,
                    current_number: scannedNumber + 1
                  }])
                  .select()
                  .single();
                
                if (seriesError) {
                  console.error("Failed to add invoice series", seriesError);
                  setModal({ isOpen: true, title: 'Series Error', message: `Failed to save new invoice series: ${seriesError.message}`, type: 'error' });
                } else if (newSeries) {
                  matchingSeries = newSeries;
                  // Check if default series exists and remove it
                  const defaultSeries = invoiceSeries.find(s => s.name === 'INV-0000000001' && s.current_number === 1);
                  if (defaultSeries) {
                    await supabase.from('invoice_series').delete().eq('id', defaultSeries.id);
                    setInvoiceSeries(prev => [...prev.filter(s => s.id !== defaultSeries.id), newSeries]);
                  } else {
                    setInvoiceSeries(prev => [...prev, newSeries]);
                  }
                }
              }
            } else {
              // If series exists, update its current number if the scanned one is higher
              if (scannedNumber >= (matchingSeries.current_number || 0)) {
                await supabase
                  .from('invoice_series')
                  .update({ 
                    current_number: scannedNumber + 1
                  })
                  .eq('id', matchingSeries.id);
                
                // Update local state
                setInvoiceSeries(prev => prev.map(s => 
                  s.id === matchingSeries?.id 
                    ? { ...s, current_number: scannedNumber + 1 } 
                    : s
                ));
              }
            }
            
            if (matchingSeries) {
              setSelectedSeriesId(matchingSeries.id);
            }
          } else {
            setIsScannedInvoiceNumberFound(false);
            const series = invoiceSeries.find(s => s.id === selectedSeriesId) || invoiceSeries[0];
            if (series) {
              setInvoiceNumber(formatSeriesNumber(series));
            } else {
              setInvoiceNumber(`${businessProfile?.invoice_prefix || 'INV'}-${Date.now().toString().slice(-6)}`);
            }
          }

          // Update customer details
          let customerData = { 
            name: data.customerName || '', 
            phone: data.customerPhone || '', 
            gst: data.customerGst || '',
            email: data.customerEmail || '',
            address1: data.customerAddress1 || data.customerAddress || '',
            address2: data.customerAddress2 || '',
            city: data.customerCity || '',
            pincode: data.customerPincode || ''
          };
          
          // Find or create customer
          let customerRecord = customers.find(c => c.name.toLowerCase() === customerData.name.toLowerCase());
          
          if (!customerRecord) {
            const { data: newCust, error: custError } = await supabase
              .from('customers')
              .insert([{
                business_id: businessId,
                created_by: user?.id,
                name: customerData.name,
                phone: customerData.phone,
                gstin: customerData.gst,
                email: customerData.email,
                address: [customerData.address1, customerData.address2, customerData.city, customerData.pincode].filter(Boolean).join(', '),
                state: customerData.gst && customerData.gst.length >= 2 ? STATE_CODES[customerData.gst.substring(0, 2)] : ''
              }])
              .select()
              .single();
            
            if (custError) {
              console.error("Failed to add customer", custError);
            } else {
              customerRecord = newCust;
              setCustomers([...customers, customerRecord]);
            }
          }
          
          if (customerRecord) {
            setCustomer({ 
              id: customerRecord.id, 
              name: customerRecord.name, 
              phone: customerRecord.phone || '', 
              gst: customerRecord.gstin || '',
              address1: customerRecord.address1 || '',
              address2: customerRecord.address2 || '',
              city: customerRecord.city || '',
              pincode: customerRecord.pincode || '',
              stateCode: customerRecord.state ? (Object.entries(STATE_CODES).find(([code, name]) => name.toLowerCase() === customerRecord.state.toLowerCase() || code === customerRecord.state)?.[0] || '') : ''
            });
          } else {
            setCustomer({ 
              id: '', 
              name: customerData.name,
              phone: customerData.phone,
              gst: customerData.gst,
              address1: customerData.address1,
              address2: customerData.address2,
              city: customerData.city,
              pincode: customerData.pincode,
              stateCode: customerData.gst && customerData.gst.length >= 2 ? customerData.gst.substring(0, 2) : ''
            });
          }

          if (data.items && Array.isArray(data.items)) {
            const currentProducts = [...products];
            const newItems = [];
            
            for (const item of data.items) {
              const itemName = item.name || 'Custom Item';
              const itemHsnCode = item.hsnCode || item.productCode || '';
              
              let product = currentProducts.find(p => p.name.toLowerCase() === itemName.toLowerCase() || (itemHsnCode && p.hsn_code === itemHsnCode));
              
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
                    hsn_code: itemHsnCode,
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
                sku: product?.sku || '',
                quantity: item.quantity || 1,
                rate: item.rate || 0,
                gstRate: item.gstRate || 18,
                amount: (item.quantity || 1) * (item.rate || 0) * (1 + (item.gstRate || 18) / 100)
              });
            }
            setProducts(currentProducts);
            setItems(newItems);
            setModal({ isOpen: true, title: 'Success', message: 'Invoice scanned and details extracted successfully!', type: 'success' });
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

    // Check stock
    if (newItem.productId) {
      const product = products.find(p => p.id === newItem.productId);
      if (product && product.stock < (Number(newItem.quantity) || 0)) {
        setModal({ isOpen: true, title: 'Stock Not Available', message: `Insufficient stock for product: ${product.name}`, type: 'error' });
        return;
      }
    }

    setItems([...items, { ...newItem, id: Date.now().toString() }]);
    setNewItem({ id: '', productId: '', name: '', sku: '', quantity: '', rate: '', gstRate: '', amount: '' });
    setSavedInvoiceData(null);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    setSavedInvoiceData(null);
  };

  const handleCustomerChange = (field: string, value: string) => {
    setCustomer(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'gst' && value.length >= 2) {
        const stateCode = value.substring(0, 2);
        if (STATE_CODES[stateCode]) {
          updated.stateCode = stateCode;
        }
      }
      return updated;
    });
    setSavedInvoiceData(null);
  };

  const updateNewItem = (field: keyof LineItem, value: any) => {
    let updated = { ...newItem, [field]: value };
    
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated.name = product.name;
        updated.sku = product.sku;
        updated.rate = product.price;
        updated.gstRate = product.gst_rate;
        updated.quantity = 1; // Default quantity to 1
      }
    }

    const qty = field === 'quantity' ? value : updated.quantity;
    const rate = field === 'rate' ? value : updated.rate;
    const gst = field === 'gstRate' ? value : updated.gstRate;
    const disc = field === 'discount' ? value : updated.discount;
    
    const baseAmount = (Number(qty) || 0) * (Number(rate) || 0);
    const discountAmount = baseAmount * ((Number(disc) || 0) / 100);
    const amountAfterDiscount = baseAmount - discountAmount;
    updated.amount = amountAfterDiscount * (1 + (Number(gst) || 0) / 100);
    
    setNewItem(updated);
  };

  const calculateTotals = () => {
    const rawSubtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0), 0);
    const itemDiscountTotal = items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.rate) || 0) * ((Number(item.discount) || 0) / 100)), 0);
    const subtotal = rawSubtotal - itemDiscountTotal;
    
    // Calculate GST based on item-level discounted amounts
    const gstTotalBeforeInvoiceDiscount = items.reduce((sum, item) => {
      const baseAmount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
      const itemDiscountAmount = baseAmount * ((Number(item.discount) || 0) / 100);
      const amountAfterDiscount = baseAmount - itemDiscountAmount;
      return sum + (amountAfterDiscount * ((Number(item.gstRate) || 0) / 100));
    }, 0);
    
    let invoiceDiscountAmount = 0;
    if (discountType === 'percentage') {
      invoiceDiscountAmount = (subtotal * discount) / 100;
    } else {
      invoiceDiscountAmount = discount;
    }

    // Reduce GST proportionally by the invoice discount ratio
    const discountRatio = subtotal > 0 ? (invoiceDiscountAmount / subtotal) : 0;
    const gstTotal = gstTotalBeforeInvoiceDiscount * (1 - discountRatio);

    const totalDiscount = itemDiscountTotal + invoiceDiscountAmount;
    const taxableAmount = subtotal - invoiceDiscountAmount;

    // GST Bifurcation Logic
    const getBusinessStateCode = () => {
      if (businessProfile?.gst_number) {
        return businessProfile.gst_number.substring(0, 2);
      }
      if (businessProfile?.state) {
        const stateEntry = Object.entries(STATE_CODES).find(([code, name]) => 
          name.toLowerCase() === businessProfile.state.toLowerCase()
        );
        if (stateEntry) return stateEntry[0];
      }
      return '';
    };

    const bState = getBusinessStateCode().toString().trim().padStart(2, '0');
    const cState = (customer.stateCode || '').toString().trim().substring(0, 2).padStart(2, '0');
    
    // Default to Intra-state (CGST/SGST) if no customer state is provided
    // Only Inter-state if both states are provided, valid, and they are different
    const isInterState = cState !== '00' && cState !== '' && bState !== '00' && bState !== '' && bState !== cState;
    
    const isEwayEnabled = ewaySettings?.ewayBillEnabled && (
      isInterState 
        ? (ewaySettings.interStateEnabled ?? true) 
        : (ewaySettings.intraStateEnabled ?? true)
    );
    const ewayThreshold = isInterState ? (ewaySettings?.ewayThreshold || 50000) : (ewaySettings?.intraStateThreshold || 100000);
    
    const cgstAmount = isInterState ? 0 : gstTotal / 2;
    const sgstAmount = isInterState ? 0 : gstTotal / 2;
    const igstAmount = isInterState ? gstTotal : 0;
    
    const totalGstAmount = isInterState ? igstAmount : (cgstAmount + sgstAmount);
    const finalTotal = taxableAmount + totalGstAmount;
    
    const gstRates = [...new Set(items.map(i => Number(i.gstRate) || 0))].filter(r => r > 0);
    const isSingleRate = gstRates.length === 1;
    const totalGstRate = isSingleRate ? gstRates[0] : 0;

    return { 
      rawSubtotal, 
      itemDiscountTotal, 
      subtotal, 
      gstTotal: totalGstAmount, 
      total: finalTotal, 
      invoiceDiscountAmount, 
      totalDiscount, 
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      isInterState,
      isEwayEnabled,
      ewayThreshold,
      totalGstRate,
      isSingleRate,
      businessState: bState ? STATE_CODES[bState] : '',
      customerState: cState ? STATE_CODES[cState] : ''
    };
  };

  const { 
    rawSubtotal, 
    itemDiscountTotal, 
    subtotal, 
    gstTotal, 
    total, 
    invoiceDiscountAmount, 
    totalDiscount, 
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    isInterState,
    isEwayEnabled,
    ewayThreshold,
    totalGstRate,
    isSingleRate,
    businessState,
    customerState
  } = calculateTotals();

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

    if (isEwayEnabled && total > ewayThreshold && includeEwayBill) {
      if (!customer.address1 || !customer.address2 || !customer.city || !customer.pincode || !customer.stateCode) {
        setModal({ isOpen: true, title: 'E-way Bill Error', message: 'Address Line 1, Address Line 2, City, Pincode, and State Code are mandatory for E-way bills.', type: 'error' });
        return;
      }
      
      if (!ewayData.transporterId || !ewayData.transporterName || !ewayData.transDocNo || !ewayData.transDocDate || !ewayData.vehicleNo || !customer.stateCode || !ewayData.transDistance) {
        setModal({ isOpen: true, title: 'E-way Bill Error', message: `All E-way Bill Details are mandatory for invoices exceeding ₹${ewayThreshold.toLocaleString()}.`, type: 'error' });
        return;
      }
      
      if (customer.gst && customer.gst.length >= 2) {
        const gstinStateCode = customer.gst.substring(0, 2);
        if (gstinStateCode !== customer.stateCode.padStart(2, '0')) {
          setModal({ isOpen: true, title: 'E-way Bill Error', message: "Customer State code doesn't match GSTIN!", type: 'error' });
          return;
        }
      }
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
              address: [customer.address1, customer.address2, customer.city, customer.pincode].filter(Boolean).join(', '),
              address1: customer.address1,
              address2: customer.address2,
              city: customer.city,
              pincode: customer.pincode,
              state: customer.stateCode ? STATE_CODES[customer.stateCode] : '',
              created_by: user?.id
            }])
            .select()
            .single();
          
          if (custError) throw custError;
          customerId = newCust.id;
        }
      }

      // 2. Create Invoice
      
      // Stock Check
      for (const item of items) {
        if (item.productId) {
          const product = products.find(p => p.id === item.productId);
          if (product && product.stock < (Number(item.quantity) || 0)) {
            setModal({ isOpen: true, title: 'Stock Not Available', message: `Insufficient stock for product: ${product.name}`, type: 'error' });
            setIsSaving(false);
            return;
          }
        }
      }

      const selectedSeries = invoiceSeries.find(s => s.id === selectedSeriesId);
      let finalInvoiceNumber = invoiceNumber;
      if (!finalInvoiceNumber) {
        if (selectedSeries) {
          finalInvoiceNumber = formatSeriesNumber(selectedSeries);
        } else {
          const prefix = businessProfile?.invoice_prefix || 'INV';
          finalInvoiceNumber = `${prefix}-${Date.now().toString().slice(-6)}`;
        }
      }

      // Check if invoice number already exists
      const { data: existingInvoice, error: checkError } = await supabase
        .from('invoices')
        .select('id')
        .eq('business_id', businessId)
        .eq('invoice_number', finalInvoiceNumber)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingInvoice) {
        setModal({ 
          isOpen: true, 
          title: 'Duplicate Invoice Number', 
          message: `Invoice number ${finalInvoiceNumber} is already in use. Please use a different number.`, 
          type: 'error' 
        });
        setIsSaving(false);
        return;
      }
      
      const finalPaymentMode = paymentStatus === 'unpaid' ? 'Unpaid' : paymentMode;
      
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert([{
          business_id: businessId,
          customer_id: customerId,
          invoice_series_id: selectedSeriesId || null,
          invoice_number: finalInvoiceNumber,
          date: new Date().toISOString().split('T')[0],
          subtotal: taxableAmount,
          discount: totalDiscount,
          discount_percentage: discountType === 'percentage' ? discount : 0,
          tax_amount: gstTotal,
          cgst_amount: cgstAmount,
          sgst_amount: sgstAmount,
          igst_amount: igstAmount,
          is_inter_state: isInterState,
          billing_state: businessState,
          customer_state: customerState,
          total,
          status: paymentStatus,
          payment_mode: finalPaymentMode,
          notes,
          terms,
          created_by: user?.id,
          supply_type: ewayData.supplyType,
          sub_supply_type: ewayData.subSupplyType
        }])
        .select()
        .single();
      
      if (invError) throw invError;

      // Update current_number in invoice_series
      if (selectedSeries) {
        // Extract number from finalInvoiceNumber to ensure series is updated correctly
        const numberMatch = finalInvoiceNumber.match(/([0-9]+)$/);
        const currentNum = numberMatch ? parseInt(numberMatch[1]) : (selectedSeries.current_number || 1);
        const nextNum = currentNum + 1;
        
        if (nextNum > (selectedSeries.current_number || 0)) {
          await supabase
            .from('invoice_series')
            .update({ 
              current_number: nextNum
            })
            .eq('id', selectedSeries.id);
        }
      }

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
          discount: Number(item.discount) || 0,
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

      // Save E-way bill data if enabled and applicable
      if (isEwayEnabled && total > ewayThreshold && includeEwayBill) {
        const fromState = parseInt(businessProfile?.gst_number?.substring(0, 2)) || 0;
        const toState = parseInt(customer.stateCode) || 0;
        
        await supabase
          .from('eway_bills')
          .insert([{
            business_id: businessId,
            invoice_id: invoice.id,
            supply_type: ewayData.supplyType,
            sub_supply_type: ewayData.subSupplyType,
            transaction_type: ewayData.transactionType,
            trans_mode: ewayData.transMode,
            trans_distance: ewayData.transDistance,
            transporter_name: ewayData.transporterName,
            transporter_id: ewayData.transporterId,
            trans_doc_no: ewayData.transDocNo,
            trans_doc_date: ewayData.transDocDate || null,
            vehicle_no: ewayData.vehicleNo,
            vehicle_type: ewayData.vehicleType,
            total_value: taxableAmount,
            cgst_value: cgstAmount,
            sgst_value: sgstAmount,
            igst_amount: igstAmount,
            cess_value: 0,
            tot_non_advol_val: ewayData.TotNonAdvolVal,
            oth_value: ewayData.OthValue,
            tot_inv_value: total,
            to_addr1: customer.address1 || '',
            to_addr2: customer.address2 || '',
            to_place: customer.city || '',
            to_pincode: parseInt(customer.pincode) || 0,
            to_state_code: toState,
            from_state_code: fromState
          }]);
      }

      // Save data for download and generate PDF
      const invoiceDataForPdf = {
        invoice_number: finalInvoiceNumber,
        date: new Date().toISOString(),
        customer_name: customer.name || "Walk-in Customer",
        customer_gstin: customer.gst,
        customer_address: [customer.address1, customer.address2, [customer.city, customer.pincode].filter(Boolean).join(', ')].filter(Boolean).join('\n'),
        payment_mode: finalPaymentMode,
        items: items.map(item => ({
          name: item.name,
          sku: item.sku,
          quantity: Number(item.quantity) || 0,
          rate: Number(item.rate) || 0,
          gstRate: Number(item.gstRate) || 0,
          amount: Number(item.amount) || 0
        })),
        subtotal: taxableAmount,
        raw_subtotal: rawSubtotal,
        tax_amount: gstTotal,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: igstAmount,
        is_inter_state: isInterState,
        eway_bill_no: includeEwayBill ? ewayData.ewayBillNo : '',
        billing_state: businessState,
        customer_state: customerState,
        customer_state_code: customer.stateCode,
        total,
        notes,
        terms,
        discount: totalDiscount,
        discount_percentage: discountType === 'percentage' ? discount : undefined,
        due_date: dueDate
      };

      // Generate and download PDF
      await generateInvoicePDF(invoiceDataForPdf, businessProfile);
      
      setSavedInvoiceData(null);

      // Clear fields
      setItems([]);
      setCustomer({ id: '', name: '', phone: '', gst: '', address1: '', address2: '', city: '', pincode: '', stateCode: '' });

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
      <PageHeader 
        title="Create New Invoice" 
        description="Draft professional invoices with AI assistance."
      >
        <div className="flex items-center space-x-4">
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
          {isAutosaving && <span className="text-[10px] font-bold text-slate-400 animate-pulse bg-slate-100 px-2 py-1 rounded-md">Saving draft...</span>}
          
          <button 
            onClick={handleScanClick}
            className="px-5 py-2.5 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl text-[11px] font-bold flex items-center hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95"
          >
            <Scan size={16} className="mr-2" strokeWidth={2.5} />
            AI Scan
          </button>
        </div>
      </PageHeader>
        
        {showScanOptions && (
          <ScanOptionsModal 
            onClose={() => setShowScanOptions(false)} 
            onFileSelect={handleFileSelect} 
          />
        )}
        <input 
          type="file" 
          ref={cameraInputRef} 
          onChange={handleFileSelect} 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
        />

      <QuickAddModal 
        isOpen={quickAdd.isOpen} 
        type={quickAdd.type} 
        onClose={() => setQuickAdd({ ...quickAdd, isOpen: false })}
        onAdd={async (data) => {
          const businessId = profile?.business_id;
          if (!businessId) {
            setModal({ isOpen: true, title: 'Error', message: 'Business ID not found. Please check your profile.', type: 'error' });
            return;
          }

          if (quickAdd.type === 'customer') {
            try {
              const { data: newCustomer, error } = await supabase
                .from('customers')
                .insert([{
                  business_id: businessId,
                  created_by: user?.id,
                  name: data.name,
                  phone: data.phone,
                  address1: data.address1,
                  address2: data.address2,
                  city: data.city,
                  pincode: data.pincode
                }])
                .select()
                .single();

              if (error) throw error;
              
              setCustomers(prev => [...prev, newCustomer]);
              setCustomer({
                id: newCustomer.id,
                name: newCustomer.name || '',
                phone: newCustomer.phone || '',
                gst: newCustomer.gstin || '',
                address1: newCustomer.address1 || '',
                address2: newCustomer.address2 || '',
                city: newCustomer.city || '',
                pincode: newCustomer.pincode || '',
                stateCode: '' // Will be updated if GSTIN is provided later
              });
            } catch (error: any) {
              setModal({ isOpen: true, title: 'Error', message: error.message || 'Failed to add customer', type: 'error' });
            }
          } else {
            try {
              const { data: newProduct, error } = await supabase
                .from('products')
                .insert([{
                  business_id: businessId,
                  created_by: user?.id,
                  name: data.name,
                  sku: data.sku || `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                  hsn_code: data.hsn_code || data.sku,
                  category: data.category || 'Uncategorized',
                  gst_rate: Number(data.gst_rate) || 18,
                  purchase_price: Number(data.purchase_price) || 0,
                  price: Number(data.price) || 0,
                  stock: Number(data.stock) || 0,
                  min_stock: Number(data.min_stock) || 5
                }])
                .select()
                .single();

              if (error) throw error;
              
              setProducts(prev => [...prev, newProduct]);
            } catch (error: any) {
              setModal({ isOpen: true, title: 'Error', message: error.message || 'Failed to add product', type: 'error' });
            }
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
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                      <UserPlus size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Customer Details</h3>
                      <p className="text-[11px] font-medium text-slate-500">Billing information and dates</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setQuickAdd({ isOpen: true, type: 'customer' })}
                    className="text-[11px] font-bold text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center"
                  >
                    <Plus size={14} className="mr-1" /> New Customer
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice Series</label>
                    <div className="relative">
                      <input 
                        type="text"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 font-medium"
                        value={invoiceNumber}
                        onFocus={() => setShowSeriesList(true)}
                        onBlur={() => {
                          // Delay closing to allow clicking on dropdown items
                          setTimeout(() => setShowSeriesList(false), 200);
                        }}
                        onChange={e => {
                          const val = e.target.value;
                          setInvoiceNumber(val);
                          setIsScannedInvoiceNumberFound(false);
                          
                          if (!val) {
                            setSelectedSeriesId('');
                            return;
                          }
                          
                          const matchingSeries = [...invoiceSeries]
                            .sort((a, b) => (b.prefix?.length || 0) - (a.prefix?.length || 0))
                            .find(s => s.prefix && val.startsWith(s.prefix));
                            
                          if (matchingSeries) {
                            setSelectedSeriesId(matchingSeries.id);
                          } else {
                            setSelectedSeriesId('');
                          }
                        }}
                        placeholder="Enter invoice series or number"
                      />
                      {invoiceSeries.length > 0 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
                          <ChevronRight size={14} className={cn("text-slate-400 transition-transform", showSeriesList ? "rotate-90" : "rotate-0")} />
                        </div>
                      )}
                      
                      {/* Custom Dropdown List */}
                      {showSeriesList && invoiceSeries.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl transition-all max-h-48 overflow-y-auto">
                          <div className="p-1">
                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50">
                              Saved Series List
                            </div>
                            {invoiceSeries.map(series => (
                              <button
                                key={series.id}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between"
                                onClick={() => {
                                  setInvoiceNumber(formatSeriesNumber(series));
                                  setSelectedSeriesId(series.id);
                                  setIsScannedInvoiceNumberFound(false);
                                  setShowSeriesList(false);
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-900">{series.name}</span>
                                  <span className="text-[10px] text-slate-500 font-medium">Prefix: {series.prefix}</span>
                                </div>
                                <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-md">
                                  Next: {formatSeriesNumber(series)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer Name</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search or enter name"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 placeholder-slate-400 font-medium"
                        value={customer.name || ''}
                        onChange={e => {
                          const val = e.target.value;
                          handleCustomerChange('name', val);
                          const existing = customers.find(c => c.name.toLowerCase() === val.toLowerCase());
                          if (existing) {
                            setCustomer({
                              id: existing.id,
                              name: existing.name,
                              phone: existing.phone || '',
                              gst: existing.gstin || '',
                              address1: existing.address1 || existing.address || '',
                              address2: existing.address2 || '',
                              city: existing.city || '',
                              pincode: existing.pincode || '',
                              stateCode: existing.state ? (Object.entries(STATE_CODES).find(([code, name]) => name.toLowerCase() === existing.state.toLowerCase() || code === existing.state)?.[0] || '') : ''
                            });
                          } else {
                            handleCustomerChange('id', '');
                          }
                        }}
                        list="customer-list"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice Date</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="date" 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 font-medium"
                        value={new Date().toISOString().split('T')[0]}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                    <input 
                      type="text" 
                      placeholder="Contact number"
                      maxLength={10}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 placeholder-slate-400 font-medium"
                      value={customer.phone || ''}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        handleCustomerChange('phone', val);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GSTIN (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="GST Number"
                      maxLength={15}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all uppercase text-slate-900 placeholder-slate-400 font-medium"
                      value={customer.gst || ''}
                      onChange={e => handleCustomerChange('gst', e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
                
                {/* Customer Address Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Address Line 1 {isEwayEnabled && total > ewayThreshold && includeEwayBill && <span className="text-red-500">*</span>}</label>
                    <input 
                      type="text" 
                      placeholder="Building, Street, etc."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 placeholder-slate-400 font-medium"
                      value={customer.address1 || ''}
                      onChange={e => handleCustomerChange('address1', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Address Line 2 {isEwayEnabled && total > ewayThreshold && includeEwayBill && <span className="text-red-500">*</span>}</label>
                    <input 
                      type="text" 
                      placeholder="Area, Locality, etc."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 placeholder-slate-400 font-medium"
                      value={customer.address2 || ''}
                      onChange={e => handleCustomerChange('address2', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">City {isEwayEnabled && total > ewayThreshold && includeEwayBill && <span className="text-red-500">*</span>}</label>
                    <input 
                      type="text" 
                      placeholder="City"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 placeholder-slate-400 font-medium"
                      value={customer.city || ''}
                      onChange={e => handleCustomerChange('city', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pincode {isEwayEnabled && total > ewayThreshold && includeEwayBill && <span className="text-red-500">*</span>}</label>
                      <input 
                        type="text" 
                        placeholder="Pincode"
                        maxLength={6}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 placeholder-slate-400 font-medium"
                        value={customer.pincode || ''}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          handleCustomerChange('pincode', val);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">State Code {isEwayEnabled && total > ewayThreshold && includeEwayBill && <span className="text-red-500">*</span>}</label>
                      <select
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 font-medium"
                        value={customer.stateCode || ''}
                        onChange={e => handleCustomerChange('stateCode', e.target.value)}
                      >
                        <option value="">Select State</option>
                        {Object.entries(STATE_CODES).map(([code, name]) => (
                          <option key={code} value={code}>{code} - {name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Package size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Line Items</h3>
                      <p className="text-[11px] font-medium text-slate-500">Products and services</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={() => setQuickAdd({ isOpen: true, type: 'product' })}
                      className="text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center"
                    >
                      <Plus size={14} className="mr-1" /> New Product
                    </button>
                    <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                      {items.length} Items Added
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Item Input Row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    {/* First Row */}
                    <div className="md:col-span-8 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product / Service</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 font-medium"
                        value={newItem.productId || ''}
                        onChange={e => updateNewItem('productId', e.target.value)}
                      >
                        <option value="">Select Item</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-4 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product/HSN Code</label>
                      <input 
                        type="text" 
                        placeholder="SKU"
                        readOnly
                        className="w-full px-4 py-2.5 bg-slate-200/50 border border-slate-200 rounded-xl outline-none text-sm transition-all text-slate-600 font-bold"
                        value={newItem.sku || ''}
                      />
                    </div>

                    {/* Second Row */}
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quantity</label>
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 font-medium"
                        value={newItem.quantity === '' ? '' : newItem.quantity}
                        onChange={e => updateNewItem('quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="md:col-span-4 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rate</label>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 font-medium"
                        value={newItem.rate === '' ? '' : newItem.rate}
                        onChange={e => updateNewItem('rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Disc %</label>
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 font-medium"
                        value={newItem.discount === '' || newItem.discount === undefined ? '' : newItem.discount}
                        onChange={e => updateNewItem('discount', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GST %</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 font-medium"
                        value={newItem.gstRate === '' ? '' : newItem.gstRate}
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
                        className="w-full py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        <Plus size={16} className="mr-1" /> Add
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 font-bold">Item Description</th>
                          <th className="px-4 py-3 font-bold">Product/HSN Code</th>
                          <th className="px-4 py-3 font-bold text-center">Qty</th>
                          <th className="px-4 py-3 font-bold text-right">Price</th>
                          <th className="px-4 py-3 font-bold text-center">Disc.</th>
                          <th className="px-4 py-3 font-bold text-center">GST</th>
                          <th className="px-4 py-3 font-bold text-right">Total</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                              <div className="flex flex-col items-center">
                                <div className="p-4 bg-slate-50 rounded-full mb-3">
                                  <Package size={24} className="text-slate-300" />
                                </div>
                                <p className="text-sm font-medium text-slate-500">No items added yet</p>
                                <p className="text-xs text-slate-400 mt-1">Start by adding products above</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          items.map((item, index) => (
                            <motion.tr 
                              key={item.id}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="group hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-4 py-4">
                                <div className="font-bold text-slate-900">{item.name}</div>
                                <div className="text-[10px] text-slate-400 font-medium">Item #{index + 1}</div>
                              </td>
                              <td className="px-4 py-4 text-slate-600 font-medium">{item.sku || '-'}</td>
                              <td className="px-4 py-4 text-center font-medium text-slate-700">{item.quantity}</td>
                              <td className="px-4 py-4 text-right font-medium text-slate-700">{formatCurrency(Number(item.rate) || 0)}</td>
                              <td className="px-4 py-4 text-center">
                                {item.discount ? (
                                  <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold">
                                    {item.discount}%
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
                                  {item.gstRate}%
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right font-bold text-slate-900">
                                {formatCurrency(Number(item.amount) || 0)}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <button 
                                  onClick={() => removeItem(item.id)} 
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </motion.tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* E-way Bill Section */}
                {isEwayEnabled && total > ewayThreshold && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <div className="flex items-center space-x-2 mb-4">
                      <Package size={18} className="text-indigo-600" />
                      <h3 className="text-sm font-bold text-slate-900">E-way Bill Details</h3>
                    </div>
                    
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-amber-900">Invoice value exceeds ₹{formatCurrency(ewayThreshold)}.</h4>
                          <p className="text-xs text-amber-700 mt-1">E-way bill is mandatory for movement of goods. Is this an over-the-counter sale or are goods being transported?</p>
                        </div>
                        <div className="flex items-center bg-white p-1 rounded-lg border border-amber-200 shadow-sm shrink-0">
                          <button
                            type="button"
                            onClick={() => setIncludeEwayBill(false)}
                            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${!includeEwayBill ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            Over-the-counter / Services
                          </button>
                          <button
                            type="button"
                            onClick={() => setIncludeEwayBill(true)}
                            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${includeEwayBill ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            Goods are Transported
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {includeEwayBill && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">E-way Bill Number</label>
                          <input 
                            type="text" 
                            placeholder="12-digit E-way Bill No."
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.ewayBillNo}
                            onChange={e => setEwayData({...ewayData, ewayBillNo: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Transaction Type</label>
                          <select 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.transactionType}
                            onChange={e => setEwayData({...ewayData, transactionType: parseInt(e.target.value) || 1})}
                          >
                            <option value={1}>1 - Regular</option>
                            <option value={2}>2 - Bill To - Ship To</option>
                            <option value={3}>3 - Bill From - Dispatch From</option>
                            <option value={4}>4 - Combination of 2 and 3</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Supply Type</label>
                          <select 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.supplyType}
                            onChange={e => setEwayData({...ewayData, supplyType: e.target.value})}
                          >
                            <option value="O">O - Outward</option>
                            <option value="I">I - Inward</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sub Supply Type</label>
                          <select 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.subSupplyType}
                            onChange={e => setEwayData({...ewayData, subSupplyType: e.target.value})}
                          >
                            <option value="1">1 - Supply</option>
                            <option value="2">2 - Import</option>
                            <option value="3">3 - Export</option>
                            <option value="4">4 - Job Work</option>
                            <option value="5">5 - For Own Use</option>
                            <option value="6">6 - SKD/CKD</option>
                            <option value="7">7 - Recipient Not Known</option>
                            <option value="8">8 - Exhibition or Fairs</option>
                            <option value="9">9 - Line Sales</option>
                            <option value="10">10 - Others</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trans Mode</label>
                          <select 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.transMode}
                            onChange={e => setEwayData({...ewayData, transMode: e.target.value})}
                          >
                            <option value="1">1 - Road</option>
                            <option value="2">2 - Rail</option>
                            <option value="3">3 - Air</option>
                            <option value="4">4 - Ship</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Distance (in km)</label>
                          <input 
                            type="number" 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.transDistance}
                            onChange={e => setEwayData({...ewayData, transDistance: parseInt(e.target.value) || 0})}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Transporter</label>
                          <select 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            onChange={e => {
                              const trans = transporters.find(t => t.id === e.target.value);
                              if (trans) {
                                setEwayData({
                                  ...ewayData,
                                  transporterId: trans.transporter_id || '',
                                  transporterName: trans.name || ''
                                });
                              }
                            }}
                          >
                            <option value="">-- Select Transporter --</option>
                            {transporters.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Transporter ID</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.transporterId}
                            onChange={e => setEwayData({...ewayData, transporterId: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Transporter Name</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.transporterName}
                            onChange={e => setEwayData({...ewayData, transporterName: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trans Doc No</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.transDocNo}
                            onChange={e => setEwayData({...ewayData, transDocNo: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trans Doc Date</label>
                          <input 
                            type="date" 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.transDocDate}
                            onChange={e => setEwayData({...ewayData, transDocDate: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vehicle Number</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.vehicleNo}
                            onChange={e => setEwayData({...ewayData, vehicleNo: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vehicle Type</label>
                          <select 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.vehicleType}
                            onChange={e => setEwayData({...ewayData, vehicleType: e.target.value})}
                          >
                            <option value="R">R - Regular</option>
                            <option value="O">O - ODC</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TotNonAdvolVal</label>
                          <input 
                            type="number" 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.TotNonAdvolVal}
                            onChange={e => setEwayData({...ewayData, TotNonAdvolVal: parseFloat(e.target.value) || 0})}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Other Value</label>
                          <input 
                            type="number" 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm transition-all"
                            value={ewayData.OthValue}
                            onChange={e => setEwayData({...ewayData, OthValue: parseFloat(e.target.value) || 0})}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* Sidebar Summary */}
            <div className="space-y-6 xl:col-span-1">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 sticky top-6">
                <h3 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider">Invoice Summary</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Subtotal</span>
                    <span className="font-bold text-slate-900">{formatCurrency(rawSubtotal)}</span>
                  </div>
                  {itemDiscountTotal > 0 && (
                    <div className="flex justify-between items-center text-sm text-emerald-600 font-bold">
                      <span>Item Discounts</span>
                      <span>-{formatCurrency(itemDiscountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm border-t border-slate-50 pt-2 mt-2">
                    <span className="text-slate-500 font-medium">Taxable Amount</span>
                    <span className="font-bold text-slate-900">{formatCurrency(taxableAmount)}</span>
                  </div>
                  
                  {!isInterState ? (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">CGST {isSingleRate ? `(${totalGstRate / 2}%)` : 'Variable%'}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">SGST {isSingleRate ? `(${totalGstRate / 2}%)` : 'Variable%'}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(sgstAmount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">IGST {isSingleRate ? `(${totalGstRate}%)` : 'Variable%'}</span>
                      <span className="font-bold text-slate-900">{formatCurrency(igstAmount)}</span>
                    </div>
                  )}
                  
                  {/* Discount Section */}
                  {/* Discount Section removed as requested */}


                  {/* Payment Details */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Status</label>
                      <div className="relative">
                        <AlertCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select 
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm text-slate-900 font-medium transition-all appearance-none"
                          value={paymentStatus}
                          onChange={e => setPaymentStatus(e.target.value)}
                        >
                          <option value="paid">Paid</option>
                          <option value="unpaid">Unpaid</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Mode</label>
                      <div className="relative">
                        <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select 
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm text-slate-900 font-medium transition-all appearance-none disabled:opacity-50"
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
                    {paymentStatus === 'unpaid' && (
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Due Date</label>
                        <div className="relative">
                          <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="date" 
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all text-slate-900 font-medium"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-base font-bold text-slate-900">Total Amount</span>
                      <span className="text-2xl font-black text-primary">{formatCurrency(total)}</span>
                    </div>
                    
                    <div className="flex flex-col gap-3 mb-4">
                      <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full py-3.5 bg-primary text-white rounded-2xl font-bold flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-all shadow-xl shadow-primary/20 group active:scale-95 text-sm"
                      >
                        {isSaving ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                          <>
                            <Save size={18} className="mr-2 group-hover:scale-110 transition-transform" />
                            Save Invoice
                          </>
                        )}
                      </button>
                      <button
                        onClick={handlePreview}
                        className="w-full py-3.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center justify-center hover:bg-slate-100 transition-all active:scale-95 text-sm"
                      >
                        <Eye size={18} className="mr-2" />
                        Preview Invoice
                      </button>
                    </div>
                    
                    <p className="text-[11px] text-center text-slate-400 mt-4 font-medium">
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
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 min-h-[800px] flex flex-col relative overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-lg font-bold text-slate-900">Invoice Preview</h2>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => setViewMode('edit')}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                  >
                    Back to Edit
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold flex items-center hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                    Save & Download
                  </button>
                </div>
              </div>
              
              <div className="flex-1 w-full h-full min-h-[600px] bg-slate-100 p-4 md:p-8">
                {previewPdfUrl ? (
                  <object 
                    data={previewPdfUrl} 
                    type="application/pdf"
                    className="w-full h-full min-h-[600px] rounded-xl shadow-lg border-0"
                  >
                    <p className="p-4 text-center text-slate-500">
                      PDF preview not supported. 
                      <a href={previewPdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary font-bold ml-1">Download PDF</a>
                    </p>
                  </object>
                ) : (
                  <div className="w-full h-full min-h-[600px] flex items-center justify-center flex-col space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-slate-500 font-medium">Generating preview...</p>
                  </div>
                )}
              </div>
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
