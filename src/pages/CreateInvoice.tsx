import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import ScanOptionsModal from '../components/ScanOptionsModal';
import Drawer from '../components/Drawer';
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
  Phone,
  CreditCard,
  Percent,
  ChevronRight,
  ChevronDown,
  Eye,
  Edit3,
  X,
  Share2
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, getDateRange, FilterType, formatSeriesNumber, resizeImage } from '../lib/utils';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateInvoicePDF, generateEwayBillPDF } from '../lib/pdfGenerator';
import MessageModal from '../components/MessageModal';
import QuickAddModal from '../components/QuickAddModal';
import { UNIT_TYPES } from '../constants/unitTypes';
import { getApiUrl } from '../lib/api';
import { DateFilter } from '../components/DateFilter';

// ... (rest of the component)

import { STATE_CODES } from '../constants/stateCodes';

interface LineItem {
  id: string;
  productId: string;
  name: string;
  hsnCode?: string;
  unitType?: string;
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
  unit_type?: string;
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
  const { id } = useParams();
  const { user, profile, refreshProfile } = useAuth();
  const businessId = profile?.business_id;
  const businessProfile = profile?.business_profiles;
  const [items, setItems] = useState<LineItem[]>([]);
  const [customer, setCustomer] = useState({ id: '', name: '', phone: '', gst: '', address1: '', address2: '', city: '', pincode: '', stateCode: '' });
  const [newItem, setNewItem] = useState<LineItem>({ id: '', productId: '', name: '', hsnCode: '', unitType: 'NUMBERS', quantity: '', rate: '', gstRate: '', discount: '', amount: '' });
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
  const [scannedData, setScannedData] = useState<{
    customer: any;
    items: any[];
    invoiceNumber?: string;
    date?: string;
  } | null>(null);
  const [showScannedReview, setShowScannedReview] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [showSeriesList, setShowSeriesList] = useState(false);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [isScannedInvoiceNumberFound, setIsScannedInvoiceNumberFound] = useState(false);
  const [includeEwayBill, setIncludeEwayBill] = useState(false);
  const [hasManuallyToggledEway, setHasManuallyToggledEway] = useState(false);

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
    subSupplyDesc: '',
    documentType: 'INV',
    fromPincode: '',
    toPincode: '',
    fromStateCode: '',
    toStateCode: '',
    actualFromStateCode: '',
    actualToStateCode: '',
    totalValue: 0,
    cgstValue: 0,
    sgstValue: 0,
    igstValue: 0,
    cessValue: 0,
    taxableValue: 0,
    TotNonAdvolVal: 0,
    OthValue: 0
  });

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [originalInvoiceItems, setOriginalInvoiceItems] = useState<any[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seriesListRef = useRef<HTMLDivElement>(null);
  const customerListRef = useRef<HTMLDivElement>(null);

  // Fetch invoice data for editing
  useEffect(() => {
    const fetchInvoiceData = async () => {
      if (!id || !businessId) return;

      try {
        const { data: invoice, error: invError } = await supabase
          .from('invoices')
          .select(`
            *,
            customers (*),
            invoice_items (*, products (*)),
            eway_bills (*)
          `)
          .eq('id', id)
          .single();

        if (invError) throw invError;

        if (invoice) {
          setCustomer({
            id: invoice.customer_id,
            name: invoice.customers?.name || '',
            phone: invoice.customers?.phone || '',
            gst: invoice.customers?.gstin || '',
            address1: invoice.customers?.address1 || '',
            address2: invoice.customers?.address2 || '',
            city: invoice.customers?.city || '',
            pincode: invoice.customers?.pincode || '',
            stateCode: invoice.customer_state || ''
          });

          setInvoiceNumber(invoice.invoice_number);
          setDate(invoice.date);
          setPaymentStatus(invoice.status);
          setPaymentMode(invoice.payment_mode || 'Cash');
          setNotes(invoice.notes || '');
          setTerms(invoice.terms || '');
          setDiscount(invoice.discount_percentage || invoice.discount || 0);
          setDiscountType(invoice.discount_percentage > 0 ? 'percentage' : 'fixed');
          setSelectedSeriesId(invoice.invoice_series_id || '');

          const mappedItems = invoice.invoice_items.map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            name: item.products?.name || 'Custom Item',
            hsnCode: item.hsn_code || '',
            unitType: item.unit_type || 'NOS',
            quantity: item.quantity,
            rate: item.unit_price,
            gstRate: item.gst_rate,
            discount: item.discount,
            amount: item.amount
          }));
          setItems(mappedItems);
          setOriginalInvoiceItems(invoice.invoice_items);

          if (invoice.eway_bills && invoice.eway_bills.length > 0) {
            const eway = invoice.eway_bills[0];
            setIncludeEwayBill(true);
            setEwayData({
              ...ewayData,
              ewayBillNo: eway.eway_bill_no || '',
              transporterId: eway.transporter_id || '',
              transporterName: eway.transporter_name || '',
              transDocNo: eway.trans_doc_no || '',
              transMode: eway.trans_mode || '1',
              transDistance: eway.trans_distance || 100,
              transDocDate: eway.trans_doc_date || '',
              vehicleNo: eway.vehicle_no || '',
              vehicleType: eway.vehicle_type || 'R',
              transactionType: eway.transaction_type || 1,
              supplyType: eway.supply_type || 'O',
              subSupplyType: eway.sub_supply_type || '1',
            });
          }
        }
      } catch (error) {
        console.error('Error fetching invoice:', error);
        setModal({ isOpen: true, title: 'Error', message: 'Failed to load invoice data.', type: 'error' });
      }
    };

    fetchInvoiceData();
  }, [id, businessId]);

  // Click outside handler for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (seriesListRef.current && !seriesListRef.current.contains(event.target as Node)) {
        setShowSeriesList(false);
      }
      if (customerListRef.current && !customerListRef.current.contains(event.target as Node)) {
        setShowCustomerList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (invoiceSeries.length > 0 && !invoiceNumber && !isScannedInvoiceNumberFound) {
      // Prefer INV- series as default
      const invSeries = invoiceSeries.find(s => s.prefix === 'INV-');
      const series = invSeries || invoiceSeries[0];
      setInvoiceNumber(formatSeriesNumber(series.current_number, series.prefix, series.name));
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
        currentInvoiceNumber = formatSeriesNumber(selectedSeries.current_number, selectedSeries.prefix, selectedSeries.name);
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
        hsnCode: item.hsnCode,
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
      eway_data: includeEwayBill ? {
        ...ewayData,
        generatedDate: new Date().toLocaleString('en-GB'),
        generatedBy: businessProfile?.gst_number || '',
        validUpto: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')
      } : undefined,
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

  const handleDownloadEway = async () => {
    if (!savedInvoiceData && !includeEwayBill) return;
    
    const invoiceData = {
      invoice_number: invoiceNumber,
      date: date,
      customer_name: customer.name,
      customer_gstin: customer.gst,
      customer_address: [customer.address1, customer.address2, [customer.city, customer.pincode].filter(Boolean).join(', ')].filter(Boolean).join('\n'),
      customer_state: Object.entries(STATE_CODES).find(([code]) => code === customer.stateCode)?.[1] || '',
      items: items.map(item => ({
        name: item.name,
        hsnCode: item.hsnCode,
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
      eway_data: {
        ...ewayData,
        generatedDate: new Date().toLocaleString('en-GB'),
        generatedBy: businessProfile?.gst_number || '',
        validUpto: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')
      },
      total
    };

    await generateEwayBillPDF(invoiceData, {
      name: businessProfile?.name || '',
      address1: businessProfile?.address1,
      address2: businessProfile?.address2,
      city: businessProfile?.city,
      state: businessProfile?.state,
      pincode: businessProfile?.pincode,
      gst_number: businessProfile?.gst_number
    });
  };

  const handleScanClick = () => {
    setShowScanOptions(true);
  };

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
    if (businessId && businessProfile) {
      fetchInitialData();
    }
  }, [businessId, businessProfile]);

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
      if (businessId && businessProfile) {
        const parsed = {
          ewayBillEnabled: businessProfile.eway_bill_enabled ?? false,
          interStateEnabled: businessProfile.inter_state_enabled ?? true,
          intraStateEnabled: businessProfile.intra_state_enabled ?? true,
          ewayThreshold: businessProfile.eway_threshold ?? 50000,
          intraStateThreshold: businessProfile.intra_state_threshold ?? 100000,
          ewayDefaultTransporterId: businessProfile.eway_default_transporter_id || '',
          ewayDefaultTransporterName: businessProfile.eway_default_transporter_name || '',
          defaultHsnCode: businessProfile.default_hsn_code || ''
        };
        setEwaySettings(parsed);
        if (parsed.ewayBillEnabled) {
          setEwayData(prev => ({
            ...prev,
            transporterId: parsed.ewayDefaultTransporterId || '',
            transporterName: parsed.ewayDefaultTransporterName || ''
          }));
          
          // Auto-enable E-way bill if threshold is met
          if (total > (isInterState ? parsed.ewayThreshold : parsed.intraStateThreshold)) {
            setIncludeEwayBill(true);
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
              name: 'Default Series',
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
          // Prefer INV- series or Default Series as default
          const defaultSeries = finalSeries.find(s => s.prefix === 'INV-' || s.name === 'Default Series' || s.name === 'INV-0000000001') || finalSeries[0];
          if (defaultSeries) {
            setSelectedSeriesId(defaultSeries.id);
            setInvoiceNumber(formatSeriesNumber(defaultSeries.current_number, defaultSeries.prefix, defaultSeries.name));
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
      // Resize image for faster processing, skip for PDF
      let optimizedBase64 = base64Data;
      if (mimeType.startsWith('image/')) {
        optimizedBase64 = await resizeImage(`data:${mimeType};base64,${base64Data}`, 600, 600).then(res => res.split(',')[1]);
      }
      
      const apiKey = profile?.business_profiles?.gemini_api_key || import.meta.env.VITE_GEMINI_API_KEY;
      console.log('Using API Key for scan:', apiKey ? 'Provided' : 'None');
      
      const prompt = "This is a SALES INVOICE. The business name on the invoice is the SUPPLIER. Extract the CUSTOMER details: invoice number, customer name, customer phone, customer email, customer gst, customer address line 1, customer address line 2, customer city, customer pincode, supplier name, supplier gst, items (name, quantity, price, gst, hsn code). Return as JSON format: { invoiceNumber: string, customerName: string, customerPhone: string, customerEmail: string, customerGst: string, customerAddress1: string, customerAddress2: string, customerCity: string, customerPincode: string, supplierName: string, supplierGst: string, items: [{ name: string, quantity: number, rate: number, gstRate: number, hsnCode: string }] }";

      let extractedText = '';

      try {
        // Try backend scanning first (more robust for Electron/CORS)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for backend

        const response = await fetch(getApiUrl('/api/scan'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data: optimizedBase64, mimeType, prompt, apiKey }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

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

        console.warn("Backend scan failed or timed out, falling back to client-side scan:", backendError);
        
        // Fallback to client-side scanning
        if (!apiKey) {
          throw new Error("Gemini API key is missing. Please update it in Settings.");
        }
        const ai = new GoogleGenAI({ apiKey });

        const retry = async (fn: () => Promise<any>, retries = 1, delay = 1000): Promise<any> => {
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
                { inlineData: { mimeType: mimeType, data: optimizedBase64 } }
              ]
            }
          ],
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
          }
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
            
            // 1. Extract the numeric part from the scanned number
            const numericMatch = data.invoiceNumber.match(/\d+/);
            const scannedNumericPart = numericMatch ? numericMatch[0] : '';
            
            // 2. Ensure it starts with "INV-" (take number and starting INV- only)
            let finalScannedInvoiceNumber = '';
            if (scannedNumericPart) {
              finalScannedInvoiceNumber = `INV-${scannedNumericPart}`;
            } else {
              finalScannedInvoiceNumber = data.invoiceNumber.startsWith('INV-') 
                ? data.invoiceNumber 
                : `INV-${data.invoiceNumber}`;
            }

            // 3. Check if invoice number already exists
            const { data: existingInvoice } = await supabase
              .from('invoices')
              .select('id')
              .eq('business_id', profile?.business_id)
              .eq('invoice_number', finalScannedInvoiceNumber)
              .maybeSingle();

            if (existingInvoice) {
              // 4. If it exists, use the next number from current series
              // User said "INV- only not any other", so let's prefer INV- series
              const invSeries = invoiceSeries.find(s => s.prefix === 'INV-');
              const series = invSeries || currentSeries || invoiceSeries[0];
              if (series) {
                finalScannedInvoiceNumber = formatSeriesNumber(series.current_number, series.prefix, series.name);
                setSelectedSeriesId(series.id);
              }
            }
            
            setInvoiceNumber(finalScannedInvoiceNumber);
            setIsScannedInvoiceNumberFound(true);
            
            // Extract prefix and number for series management
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
            
            if (matchingSeries) {
              // We link to the matching series but DO NOT update its current number
              // because scanned invoices are usually external and shouldn't jump the user's own series
              setSelectedSeriesId(matchingSeries.id);
            } else {
              // If no matching series found, fallback to INV- or first available
              // but DO NOT add to database as per user request
              const invSeries = invoiceSeries.find(s => s.prefix === 'INV-');
              const fallbackSeries = invSeries || invoiceSeries[0];
              if (fallbackSeries) {
                setSelectedSeriesId(fallbackSeries.id);
                // If we forced INV- prefix earlier, we should ensure the number is consistent with the fallback series
                // if the number was already used. This is handled by the existingInvoice check above.
              }
            }
          } else {
            setIsScannedInvoiceNumberFound(false);
            const series = invoiceSeries.find(s => s.id === selectedSeriesId) || invoiceSeries[0];
            if (series) {
              setInvoiceNumber(formatSeriesNumber(series.current_number, series.prefix, series.name));
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

          // Check if scanned customer is the same as current business
          const isScannedCustomerMe = (
            (data.customerGst && businessProfile?.gst_number && data.customerGst.trim().toUpperCase() === businessProfile.gst_number.trim().toUpperCase()) ||
            (data.customerName && businessProfile?.name && data.customerName.trim().toLowerCase() === businessProfile.name.trim().toLowerCase())
          );

          const isScannedSupplierMe = (
            (data.supplierGst && businessProfile?.gst_number && data.supplierGst.trim().toUpperCase() === businessProfile.gst_number.trim().toUpperCase()) ||
            (data.supplierName && businessProfile?.name && data.supplierName.trim().toLowerCase() === businessProfile.name.trim().toLowerCase())
          );

          const scannedItems = (data.items || []).map((item: any) => {
            const itemName = item.name || 'Custom Item';
            const itemHsnCode = item.hsnCode || item.productCode || '';
            let product = products.find(p => p.name.trim().toLowerCase() === itemName.trim().toLowerCase() || (itemHsnCode && p.hsn_code === itemHsnCode));
            
            return {
              id: Math.random().toString(36).substr(2, 9),
              productId: product?.id || '',
              name: itemName,
              sku: product?.sku || '',
              hsnCode: itemHsnCode || product?.hsn_code || '',
              quantity: item.quantity || 1,
              rate: item.rate || 0,
              gstRate: item.gstRate || 18,
              amount: (item.quantity || 1) * (item.rate || 0) * (1 + (item.gstRate || 18) / 100)
            };
          });

          setScannedData({
            customer: customerData,
            items: scannedItems,
            invoiceNumber: data.invoiceNumber,
            date: data.date
          });
          setShowScannedReview(true);
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
    setNewItem({ id: '', productId: '', name: '', hsnCode: '', quantity: '', rate: '', gstRate: '', amount: '' });
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
        updated.hsnCode = product.hsn_code;
        updated.unitType = product.unit_type || 'NUMBERS';
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

  // Auto-enable E-way bill if threshold is met
  useEffect(() => {
    if (ewaySettings?.ewayBillEnabled && !includeEwayBill && !hasManuallyToggledEway) {
      const threshold = isInterState ? ewaySettings.ewayThreshold : ewaySettings.intraStateThreshold;
      if (total > threshold) {
        setIncludeEwayBill(true);
      }
    }
  }, [total, isInterState, ewaySettings, includeEwayBill, hasManuallyToggledEway]);

  // Auto-populate E-way bill data
  useEffect(() => {
    if (includeEwayBill) {
      setEwayData(prev => ({
        ...prev,
        fromPincode: businessProfile?.pincode || prev.fromPincode,
        toPincode: customer.pincode || prev.toPincode,
        fromStateCode: businessProfile?.gst_number?.substring(0, 2) || prev.fromStateCode,
        toStateCode: customer.stateCode || prev.toStateCode,
        actualFromStateCode: businessProfile?.gst_number?.substring(0, 2) || prev.actualFromStateCode,
        actualToStateCode: customer.stateCode || prev.actualToStateCode,
        totalValue: total,
        cgstValue: cgstAmount,
        sgstValue: sgstAmount,
        igstValue: igstAmount,
        taxableValue: taxableAmount,
        transDocNo: prev.transDocNo || invoiceNumber,
        transDocDate: prev.transDocDate || (date ? date.split('-').reverse().join('/') : '')
      }));
    }
  }, [includeEwayBill, customer.pincode, customer.stateCode, total, taxableAmount, cgstAmount, sgstAmount, igstAmount, businessProfile, invoiceNumber, date]);

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

    if (!date || !date.includes('-') || date.length !== 10) {
      setModal({ isOpen: true, title: 'Error', message: 'Please enter a valid invoice date (DD/MM/YYYY).', type: 'error' });
      return;
    }

    if (paymentStatus === 'unpaid' && dueDate && (!dueDate.includes('-') || dueDate.length !== 10)) {
      setModal({ isOpen: true, title: 'Error', message: 'Please enter a valid due date (DD/MM/YYYY).', type: 'error' });
      return;
    }

    if (isEwayEnabled && includeEwayBill) {
      if (!customer.address1 || !customer.address2 || !customer.city || !customer.pincode || !customer.stateCode) {
        setModal({ isOpen: true, title: 'E-way Bill Error', message: 'Address Line 1, Address Line 2, City, Pincode, and State Code are mandatory for E-way bills.', type: 'error' });
        return;
      }
      
      const isRoad = ewayData.transMode === '1';
      const hasVehicle = !!ewayData.vehicleNo;
      const hasTransDoc = !!ewayData.transDocNo && !!ewayData.transDocDate;

      // Basic mandatory fields
      if (!ewayData.documentType || !ewayData.transactionType || !ewayData.supplyType || !ewayData.subSupplyType || !ewayData.transMode || !ewayData.transDistance || !ewayData.vehicleType) {
        setModal({ isOpen: true, title: 'E-way Bill Error', message: 'Basic Supply Information, Mode, Distance and Vehicle Type are mandatory.', type: 'error' });
        return;
      }

      // Mode specific validation
      if (isRoad && !hasVehicle) {
        setModal({ isOpen: true, title: 'E-way Bill Error', message: 'Vehicle Number is mandatory for Road transport.', type: 'error' });
        return;
      }

      if (!isRoad && !hasTransDoc) {
        setModal({ isOpen: true, title: 'E-way Bill Error', message: 'Transport Document Number and Date are mandatory for Rail/Air/Ship transport.', type: 'error' });
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
          c.name.trim().toLowerCase() === customer.name.trim().toLowerCase() && 
          (c.phone === customer.phone || (!c.phone && !customer.phone))
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
              created_by: profile?.id || user?.id
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
          finalInvoiceNumber = formatSeriesNumber(selectedSeries.current_number, selectedSeries.prefix, selectedSeries.name);
        } else {
          const prefix = businessProfile?.invoice_prefix || 'INV';
          finalInvoiceNumber = `${prefix}-${Date.now().toString().slice(-6)}`;
        }
      }

      // Check if invoice number already exists (only for new invoices)
      if (!id) {
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
      }
      
      const finalPaymentMode = paymentStatus === 'unpaid' ? 'Unpaid' : paymentMode;
      
      let invoice;
      if (id) {
        // Update existing invoice
        const { data: updatedInvoice, error: invError } = await supabase
          .from('invoices')
          .update({
            customer_id: customerId,
            invoice_number: finalInvoiceNumber,
            date: date,
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
            supply_type: ewayData.supplyType,
            sub_supply_type: ewayData.subSupplyType
          })
          .eq('id', id)
          .select()
          .single();
        
        if (invError) throw invError;
        invoice = updatedInvoice;

        // Revert stock for original items
        for (const item of originalInvoiceItems) {
          if (item.product_id) {
            const product = products.find(p => p.id === item.product_id);
            if (product) {
              await supabase
                .from('products')
                .update({ stock: product.stock + (Number(item.quantity) || 0) })
                .eq('id', item.product_id);
            }
          }
        }

        // Delete old items
        await supabase.from('invoice_items').delete().eq('invoice_id', id);
        // Delete old e-way bills
        await supabase.from('eway_bills').delete().eq('invoice_id', id);
      } else {
        // Create new invoice
        const { data: newInvoice, error: invError } = await supabase
          .from('invoices')
          .insert([{
            business_id: businessId,
            customer_id: customerId,
            invoice_series_id: selectedSeriesId || null,
            invoice_number: finalInvoiceNumber,
            date: date,
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
            created_by: profile?.id || user?.id,
            supply_type: ewayData.supplyType,
            sub_supply_type: ewayData.subSupplyType
          }])
          .select()
          .single();
        
        if (invError) throw invError;
        invoice = newInvoice;
      }
      
      // Update current_number in invoice_series (only for new invoices)
      if (!id && selectedSeries && !isScannedInvoiceNumberFound) {
        const expectedNext = formatSeriesNumber(selectedSeries.current_number, selectedSeries.prefix, selectedSeries.name);
        
        // Only update the series if the invoice number matches the expected next number
        // This prevents "jumping" the series when scanning or manually entering external numbers
        if (finalInvoiceNumber === expectedNext) {
          await supabase
            .from('invoice_series')
            .update({ 
              current_number: selectedSeries.current_number + 1
            })
            .eq('id', selectedSeries.id);
        }
      }

      // 3. Create missing products and prepare Invoice Items
      const invoiceItems = [];
      let currentProducts = [...products];
      
      for (const item of items) {
        let productId = item.productId;
        
        if (!productId) {
          // Check if product with same name exists
          const itemName = item.name || 'Custom Item';
          const existingProduct = currentProducts.find(p => p.name.trim().toLowerCase() === itemName.trim().toLowerCase());
          
          if (existingProduct) {
            productId = existingProduct.id;
          } else {
            // Create new product
            const { data: newProd, error: prodError } = await supabase
              .from('products')
              .insert([{
                business_id: businessId,
                created_by: profile?.id || user?.id,
                name: itemName,
                hsn_code: item.hsnCode || '',
                unit_type: item.unitType || 'NOS',
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
            
            // Update local products array so we don't create it again if there are duplicates
            currentProducts.push(newProd);
            setProducts(currentProducts);
          }
        }

        invoiceItems.push({
          invoice_id: invoice.id,
          product_id: productId,
          hsn_code: item.hsnCode || '',
          unit_type: item.unitType || 'NOS',
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
      if (isEwayEnabled && includeEwayBill) {
        const fromState = parseInt(businessProfile?.gst_number?.substring(0, 2)) || 0;
        const toState = parseInt(customer.stateCode) || 0;
        
        const finalTransDocNo = ewayData.transDocNo || finalInvoiceNumber.replace(/^[0/\-]+/, '') || finalInvoiceNumber;
        const finalTransDocDate = ewayData.transDocDate || (date ? date.split('-').reverse().join('/') : '');
        const dbTransDocDate = finalTransDocDate.includes('/') 
          ? finalTransDocDate.split('/').reverse().join('-') 
          : finalTransDocDate;

        const { error: ewayError } = await supabase
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
            trans_doc_no: finalTransDocNo,
            trans_doc_date: dbTransDocDate,
            vehicle_no: ewayData.vehicleNo,
            vehicle_type: ewayData.vehicleType,
            total_value: taxableAmount,
            cgst_value: cgstAmount,
            sgst_value: sgstAmount,
            igst_amount: igstAmount,
            cess_value: 0,
            tot_non_advol_val: ewayData.TotNonAdvolVal || 0,
            oth_value: ewayData.OthValue || 0,
            tot_inv_value: total,
            to_addr1: customer.address1 || '',
            to_addr2: customer.address2 || '',
            to_place: customer.city || '',
            to_pincode: parseInt(customer.pincode) || 0,
            to_state_code: toState,
            from_state_code: fromState
          }]);

        if (ewayError) {
          console.error("Error inserting eway bill:", ewayError);
          throw ewayError;
        }
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
          hsnCode: item.hsnCode,
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
        eway_data: includeEwayBill ? {
          ...ewayData,
          transDocNo: ewayData.transDocNo || finalInvoiceNumber.replace(/^[0/\-]+/, '') || finalInvoiceNumber,
          transDocDate: ewayData.transDocDate || (date ? date.split('-').reverse().join('/') : ''),
          generatedDate: new Date().toLocaleString('en-GB'),
          generatedBy: businessProfile?.gst_number || '',
          validUpto: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')
        } : undefined,
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
      await refreshProfile();
      await generateInvoicePDF(invoiceDataForPdf, profile?.business_profiles);
      
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
    <>
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 pt-2 pb-32 xl:pb-8 relative w-full"
    >
      {/* Header */}
      <PageHeader 
        title="Create New Invoice" 
        description="Fill in the details below to generate a new invoice."
      >
        <div className="flex items-center space-x-4">
          
          {isAutosaving && <span className="text-[11px] font-bold text-slate-400 animate-pulse bg-slate-100 px-2 py-1 rounded-md">Saving draft...</span>}
          
          <button 
            onClick={handleScanClick}
            className="px-5 py-2 w-48 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95"
          >
            <Scan size={18} className="mr-2" strokeWidth={2.5} />
            AI Scan Invoice
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
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          accept="image/*,application/pdf" 
          className="hidden" 
        />
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
                  created_by: profile?.id || user?.id,
                  name: data.name,
                  phone: data.phone,
                  gstin: data.gst_number,
                  address1: data.address1,
                  address2: data.address2,
                  city: data.city,
                  state: data.state,
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
                stateCode: newCustomer.state ? (Object.entries(STATE_CODES).find(([code, name]) => name.toLowerCase() === newCustomer.state.toLowerCase() || code === newCustomer.state)?.[0] || '') : ''
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
                  created_by: profile?.id || user?.id,
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
            className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start w-full"
          >
            <div className="xl:col-span-2 space-y-6 xl:h-[calc(100vh-60px)] xl:overflow-y-auto min-w-0">
              {/* Customer & Details Section */}
              <div className="bg-gradient-to-br from-white to-slate-50/50 p-5 rounded-2xl shadow-sm border border-slate-100/60 relative z-[60]">
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                </div>
                <div className="flex items-center justify-between mb-5 relative z-[50]">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-blue-50 to-blue-100/50 text-blue-600 rounded-xl shadow-sm border border-blue-100/50">
                      <UserPlus size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 tracking-tight">Customer Details</h3>
                      <p className="text-[10px] font-medium text-slate-500">Billing information and dates</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setQuickAdd({ isOpen: true, type: 'customer' })}
                    className="text-[10px] font-bold text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100/50 hover:from-blue-100 hover:to-blue-200/50 px-3 py-1.5 rounded-lg transition-all flex items-center shadow-sm border border-blue-200/50 active:scale-95"
                  >
                    <Plus size={14} className="mr-1.5" strokeWidth={2.5} /> New Customer
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-6 space-y-0.5">
                    <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Customer Name</label>
                    <div className={cn("relative", showCustomerList ? "z-[1000]" : "z-[100]")} ref={customerListRef}>
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search or enter name"
                        className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 placeholder-slate-400 font-medium placeholder:text-[11px]"
                        value={customer.name || ''}
                        onFocus={() => setShowCustomerList(true)}
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
                      />
                      
                      {/* Custom Customer Dropdown */}
                      {showCustomerList && customers.length > 0 && (
                        <div className="absolute z-[9999] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 md:max-h-64 overflow-y-auto">
                          <div className="p-1 bg-white">
                            <div className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                              Select Customer
                            </div>
                            {customers
                              .filter(c => c.name.toLowerCase().includes((customer.name || '').toLowerCase()))
                              .map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between group bg-white"
                                  onClick={() => {
                                    setCustomer({
                                      id: c.id,
                                      name: c.name,
                                      phone: c.phone || '',
                                      gst: c.gstin || '',
                                      address1: c.address1 || c.address || '',
                                      address2: c.address2 || '',
                                      city: c.city || '',
                                      pincode: c.pincode || '',
                                      stateCode: c.state ? (Object.entries(STATE_CODES).find(([code, name]) => name.toLowerCase() === c.state.toLowerCase() || code === c.state)?.[0] || '') : ''
                                    });
                                    setShowCustomerList(false);
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-[12px] font-bold text-slate-900 group-hover:text-primary transition-colors">{c.name}</span>
                                    {c.phone && <span className="text-[10px] text-slate-500 font-medium">{c.phone}</span>}
                                  </div>
                                  {c.gstin && (
                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                                      {c.gstin}
                                    </span>
                                  )}
                                </button>
                              ))}
                            {customers.filter(c => c.name.toLowerCase().includes((customer.name || '').toLowerCase())).length === 0 && (
                              <div className="px-3 py-6 text-center bg-white">
                                <p className="text-[11px] text-slate-400 font-medium italic">No matching customers found</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-3 space-y-0.5">
                    <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Invoice Number</label>
                    <div className={cn("relative", showSeriesList ? "z-[1000]" : "z-[100]")} ref={seriesListRef}>
                      <div className="relative">
                        <input 
                          type="text"
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 font-medium placeholder:text-[11px] pr-8"
                          value={invoiceNumber}
                          onChange={e => {
                            setInvoiceNumber(e.target.value);
                            setIsScannedInvoiceNumberFound(false);
                          }}
                          placeholder="Invoice number"
                        />
                        <div 
                          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer p-1 hover:bg-slate-100 rounded-md transition-colors"
                          onClick={() => setShowSeriesList(!showSeriesList)}
                        >
                          <ChevronDown size={12} className={cn("text-slate-400 transition-transform", showSeriesList ? "rotate-180" : "rotate-0")} />
                        </div>
                      </div>
                      
                      {/* Custom Dropdown List */}
                      {showSeriesList && invoiceSeries.length > 0 && (
                        <div className="absolute z-[9999] left-0 right-0 mt-1 !bg-white border border-slate-300 rounded-lg shadow-2xl transition-all max-h-40 overflow-y-auto opacity-100">
                          <div className="p-1 !bg-white">
                            <div className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 !bg-white sticky top-0">
                              Select Series
                            </div>
                            {invoiceSeries.map(series => (
                              <button
                                key={series.id}
                                type="button"
                                className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded-md transition-colors flex items-center justify-between !bg-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInvoiceNumber(formatSeriesNumber(series.current_number, series.prefix, series.name));
                                  setSelectedSeriesId(series.id);
                                  setIsScannedInvoiceNumberFound(false);
                                  setShowSeriesList(false);
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold text-slate-900">{series.name}</span>
                                  <span className="text-[8px] text-slate-500 font-medium">Next: {formatSeriesNumber(series.current_number, series.prefix, series.name)}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-3 space-y-0.5">
                    <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Invoice Date</label>
                    <div className="relative flex items-center">
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 z-10 overflow-hidden">
                        <Calendar size={12} className="absolute inset-0 text-slate-400 pointer-events-none" />
                        <input 
                          type="date" 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          value={date.includes('-') ? date : ''}
                          onChange={e => setDate(e.target.value)}
                        />
                      </div>
                      <input 
                        type="text" 
                        placeholder="DD/MM/YYYY"
                        maxLength={10}
                        className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 font-medium"
                        value={date.includes('-') ? date.split('-').reverse().join('/') : date}
                        onChange={e => {
                          let val = e.target.value.replace(/[^\d/]/g, '');
                          if (val.length === 2 && !val.includes('/')) val += '/';
                          if (val.length === 5 && val.split('/').length === 2) val += '/';
                          
                          if (val.length === 10) {
                            const [d, m, y] = val.split('/');
                            if (d && m && y && d.length === 2 && m.length === 2 && y.length === 4) {
                              setDate(`${y}-${m}-${d}`);
                              return;
                            }
                          }
                          setDate(val);
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 relative z-10">
                  <div className="md:col-span-6 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                    <div className="relative">
                      <Phone size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Contact"
                        maxLength={10}
                        className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 placeholder-slate-400 font-medium placeholder:text-[11px]"
                        value={customer.phone || ''}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          handleCustomerChange('phone', val);
                        }}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-6 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GSTIN</label>
                    <input 
                      type="text" 
                      placeholder="GSTIN"
                      maxLength={15}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] uppercase text-slate-900 placeholder-slate-400 font-medium placeholder:text-[11px]"
                      value={customer.gst || ''}
                      onChange={e => handleCustomerChange('gst', e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
                
                {/* Customer Address Fields */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-6 pt-6 border-t border-slate-100 relative z-10">
                  <div className="md:col-span-8 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Address Line 1 {isEwayEnabled && includeEwayBill && <span className="text-red-500">*</span>}</label>
                    <input 
                      type="text" 
                      placeholder="Building, Street, etc."
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 placeholder-slate-400 font-medium placeholder:text-[11px]"
                      value={customer.address1 || ''}
                      onChange={e => handleCustomerChange('address1', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Address Line 2 {isEwayEnabled && includeEwayBill && <span className="text-red-500">*</span>}</label>
                    <input 
                      type="text" 
                      placeholder="Area, Locality, etc."
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 placeholder-slate-400 font-medium placeholder:text-[11px]"
                      value={customer.address2 || ''}
                      onChange={e => handleCustomerChange('address2', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">City {isEwayEnabled && includeEwayBill && <span className="text-red-500">*</span>}</label>
                    <input 
                      type="text" 
                      placeholder="City"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 placeholder-slate-400 font-medium placeholder:text-[11px]"
                      value={customer.city || ''}
                      onChange={e => handleCustomerChange('city', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pincode {isEwayEnabled && includeEwayBill && <span className="text-red-500">*</span>}</label>
                    <input 
                      type="text" 
                      placeholder="Pincode"
                      maxLength={6}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 placeholder-slate-400 font-medium placeholder:text-[11px]"
                      value={customer.pincode || ''}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        handleCustomerChange('pincode', val);
                      }}
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">State Code {isEwayEnabled && includeEwayBill && <span className="text-red-500">*</span>}</label>
                    <select
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 font-medium"
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

              {/* Items Section */}
              <div className="bg-gradient-to-br from-white to-slate-50/50 p-5 rounded-2xl shadow-sm border border-slate-100/60 relative overflow-hidden z-10 min-h-[600px]">
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                </div>
                <div className="flex items-center justify-between mb-5 relative z-20">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 rounded-xl shadow-sm border border-emerald-100/50">
                      <Package size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 tracking-tight">Line Items</h3>
                      <p className="text-[10px] font-medium text-slate-500">Products and services</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={() => setQuickAdd({ isOpen: true, type: 'product' })}
                      className="text-[11px] font-bold text-emerald-700 bg-gradient-to-r from-emerald-50 to-emerald-100/50 hover:from-emerald-100 hover:to-emerald-200/50 px-3 py-1.5 rounded-lg transition-all flex items-center shadow-sm border border-emerald-200/50 active:scale-95"
                    >
                      <Plus size={14} className="mr-1.5" strokeWidth={2.5} /> New Product
                    </button>
                    <div className="text-[11px] font-bold text-slate-500 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                      {items.length} Items Added
                    </div>
                  </div>
                </div>

                <div className="space-y-3 relative z-10">
                  {/* Item Input Row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    {/* First Row */}
                    <div className="md:col-span-8 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product / Service</label>
                      <select 
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 font-medium"
                        value={newItem.productId || ''}
                        onChange={e => updateNewItem('productId', e.target.value)}
                      >
                        <option value="">Select Item</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">HSN Code</label>
                      <input 
                        type="text" 
                        placeholder="HSN Code"
                        readOnly
                        className="w-full px-2 py-1.5 bg-slate-200/50 border border-slate-300 rounded-lg outline-none text-[11px] transition-all text-slate-600 font-bold placeholder:text-[11px]"
                        value={newItem.hsnCode || ''}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Unit Type</label>
                      <select 
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 font-medium"
                        value={newItem.unitType || 'NUMBERS'}
                        onChange={e => updateNewItem('unitType', e.target.value)}
                      >
                        {UNIT_TYPES.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>

                    {/* Second Row */}
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty</label>
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 font-medium placeholder:text-[11px]"
                        value={newItem.quantity === '' ? '' : newItem.quantity}
                        onChange={e => updateNewItem('quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="md:col-span-4 space-y-0.5">
                      <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Rate</label>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 font-medium placeholder:text-[11px]"
                        value={newItem.rate === '' ? '' : newItem.rate}
                        onChange={e => updateNewItem('rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-0.5">
                      <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Disc %</label>
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 font-medium placeholder:text-[11px]"
                        value={newItem.discount === '' || newItem.discount === undefined ? '' : newItem.discount}
                        onChange={e => updateNewItem('discount', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-0.5">
                      <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">GST %</label>
                      <select 
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-[11px] transition-all text-slate-900 font-medium"
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
                        className="w-full h-10 sm:h-9 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95"
                      >
                        <Plus size={16} className="mr-1.5" strokeWidth={2.5} /> Add Item
                      </button>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
                    <table className="w-full text-[11px] text-left min-w-[800px]">
                      <thead className="text-[10px] text-slate-500 uppercase tracking-wider bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2.5 font-bold">Item Description</th>
                          <th className="px-3 py-2.5 font-bold">HSN Code</th>
                          <th className="px-3 py-2.5 font-bold">Unit</th>
                          <th className="px-3 py-2.5 font-bold text-center">Qty</th>
                          <th className="px-3 py-2.5 font-bold text-right">Price</th>
                          <th className="px-3 py-2.5 font-bold text-center">Disc.</th>
                          <th className="px-3 py-2.5 font-bold text-center">GST</th>
                          <th className="px-3 py-2.5 font-bold text-right">Total</th>
                          <th className="px-3 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-32 text-center text-slate-400">
                              <div className="flex flex-col items-center">
                                <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-full mb-3 shadow-sm border border-slate-100">
                                  <Package size={24} className="text-slate-300" strokeWidth={1.5} />
                                </div>
                                <p className="text-xs font-bold text-slate-500">No items added yet</p>
                                <p className="text-[10px] text-slate-400 mt-1 font-medium">Start by adding products above</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          items.map((item, index) => (
                            <motion.tr 
                              key={item.id}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="group hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="px-3 py-2">
                                <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">Item #{index + 1}</div>
                              </td>
                              <td className="px-3 py-2 text-slate-600 font-medium">{item.hsnCode || '-'}</td>
                              <td className="px-3 py-2 text-slate-600 font-medium">{item.unitType || 'NUMBERS'}</td>
                              <td className="px-3 py-2 text-center font-bold text-slate-700 bg-slate-50/50">{item.quantity}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-700">{formatCurrency(Number(item.rate) || 0)}</td>
                              <td className="px-3 py-2 text-center">
                                {item.discount ? (
                                  <span className="px-2 py-1 bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 border border-emerald-200/50 rounded-md text-[10px] font-bold shadow-sm">
                                    {item.discount}%
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-2 py-1 bg-gradient-to-r from-slate-100 to-slate-200/50 text-slate-700 border border-slate-200/50 rounded-md text-[10px] font-bold shadow-sm">
                                  {item.gstRate}%
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-black text-slate-900 text-xs">
                                {formatCurrency(Number(item.amount) || 0)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button 
                                  onClick={() => removeItem(item.id)} 
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 size={16} strokeWidth={2.5} />
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
                  <div className="mt-8 pt-6 border-t border-slate-200/60 relative z-10">
                    <div className="flex items-center space-x-2 mb-5">
                      <div className="p-1.5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 rounded-lg shadow-sm border border-indigo-100/50">
                        <Package size={16} strokeWidth={2.5} />
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 tracking-tight">E-way Bill Details</h3>
                    </div>
                    
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100/30 border border-amber-200/60 rounded-2xl p-5 mb-6 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-[13px] font-bold text-amber-900">Invoice value exceeds ₹{formatCurrency(ewayThreshold)}.</h4>
                          <p className="text-[11px] font-medium text-amber-700 mt-1">E-way bill is mandatory for movement of goods. Is this an over-the-counter sale or are goods being transported?</p>
                        </div>
                          <div className="flex items-center bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-amber-200/60 shadow-sm shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setIncludeEwayBill(false);
                              setHasManuallyToggledEway(true);
                            }}
                            className={`px-4 py-2 text-[11px] font-bold rounded-lg transition-all ${!includeEwayBill ? 'bg-gradient-to-r from-amber-100 to-amber-200/50 text-amber-900 shadow-sm border border-amber-200/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                          >
                            Over-the-counter / Services
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIncludeEwayBill(true);
                              setHasManuallyToggledEway(true);
                            }}
                            className={`px-4 py-2 text-[11px] font-bold rounded-lg transition-all ${includeEwayBill ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                          >
                            Goods are Transported
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {includeEwayBill && (
                      <div className="space-y-6">
                        {/* Basic & Supply Info */}
                        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <div className="flex items-center space-x-2 pb-2 border-bottom border-slate-100">
                            <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Basic & Supply Information</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">E-way Bill Number</label>
                              <input 
                                type="text" 
                                placeholder="12-digit E-way Bill No."
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all placeholder:text-slate-400"
                                value={ewayData.ewayBillNo}
                                onChange={e => setEwayData({...ewayData, ewayBillNo: e.target.value})}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                Document Type <span className="text-red-500 ml-1">*</span>
                              </label>
                              <select 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all cursor-pointer"
                                value={ewayData.documentType}
                                onChange={e => setEwayData({...ewayData, documentType: e.target.value})}
                              >
                                <option value="INV">Tax Invoice</option>
                                <option value="BIL">Bill of Supply</option>
                                <option value="BOE">Bill of Entry</option>
                                <option value="OTH">Others</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                Transaction Type <span className="text-red-500 ml-1">*</span>
                              </label>
                              <select 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all cursor-pointer"
                                value={ewayData.transactionType}
                                onChange={e => setEwayData({...ewayData, transactionType: parseInt(e.target.value) || 1})}
                              >
                                <option value={1}>Regular</option>
                                <option value={2}>Bill To - Ship To</option>
                                <option value={3}>Bill From - Dispatch From</option>
                                <option value={4}>Combination of 2 and 3</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                Supply Type <span className="text-red-500 ml-1">*</span>
                              </label>
                              <select 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all cursor-pointer"
                                value={ewayData.supplyType}
                                onChange={e => setEwayData({...ewayData, supplyType: e.target.value})}
                              >
                                <option value="O">Outward</option>
                                <option value="I">Inward</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                Sub Type <span className="text-red-500 ml-1">*</span>
                              </label>
                              <select 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all cursor-pointer"
                                value={ewayData.subSupplyType}
                                onChange={e => setEwayData({...ewayData, subSupplyType: e.target.value})}
                              >
                                <option value="1">Supply</option>
                                <option value="2">Export</option>
                                <option value="3">Job Work</option>
                                <option value="4">SKD/CKD/Lots</option>
                                <option value="5">Recipient Not Known</option>
                                <option value="6">For Own Use</option>
                                <option value="7">Exhibition or Fairs</option>
                                <option value="8">Line Sales</option>
                                <option value="9">Others</option>
                              </select>
                            </div>
                            {(ewayData.subSupplyType === '8' || ewayData.subSupplyType === '9') && (
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                  Sub Supply Desc <span className="text-red-500 ml-1">*</span>
                                </label>
                                <input
                                  type="text"
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all"
                                  placeholder="Description"
                                  value={ewayData.subSupplyDesc}
                                  onChange={e => setEwayData({...ewayData, subSupplyDesc: e.target.value})}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Transporter Details */}
                        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <div className="flex items-center space-x-2 pb-2 border-bottom border-slate-100">
                            <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Transporter Details</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Transporter</label>
                              <select 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all cursor-pointer"
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
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Transporter ID</label>
                              <input 
                                type="text" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all"
                                value={ewayData.transporterId}
                                onChange={e => setEwayData({...ewayData, transporterId: e.target.value})}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Transporter Name</label>
                              <input 
                                type="text" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all"
                                value={ewayData.transporterName}
                                onChange={e => setEwayData({...ewayData, transporterName: e.target.value})}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                Mode <span className="text-red-500 ml-1">*</span>
                              </label>
                              <select 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all cursor-pointer"
                                value={ewayData.transMode}
                                onChange={e => setEwayData({...ewayData, transMode: e.target.value})}
                              >
                                <option value="1">Road</option>
                                <option value="2">Rail</option>
                                <option value="3">Air</option>
                                <option value="4">Ship or Ship Cum Road/Rail</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                Approx Distance (in KM) <span className="text-red-500 ml-1">*</span>
                              </label>
                              <input 
                                type="number" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all"
                                value={ewayData.transDistance}
                                onChange={e => setEwayData({...ewayData, transDistance: parseInt(e.target.value) || 0})}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trans Doc No</label>
                              <input 
                                type="text" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all"
                                value={ewayData.transDocNo}
                                onChange={e => setEwayData({...ewayData, transDocNo: e.target.value})}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trans Doc Date</label>
                              <input 
                                type="text" 
                                placeholder="DD/MM/YYYY"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all"
                                value={ewayData.transDocDate}
                                onChange={e => setEwayData({...ewayData, transDocDate: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Vehicle Details */}
                        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <div className="flex items-center space-x-2 pb-2 border-bottom border-slate-100">
                            <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Vehicle Details</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                Vehicle Number {ewayData.transMode === '1' && <span className="text-red-500 ml-1">*</span>}
                              </label>
                              <input 
                                type="text" 
                                placeholder="e.g. GJ01AA1234"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all placeholder:text-slate-400"
                                value={ewayData.vehicleNo}
                                onChange={e => setEwayData({...ewayData, vehicleNo: e.target.value})}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                Vehicle Type <span className="text-red-500 ml-1">*</span>
                              </label>
                              <select 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all cursor-pointer"
                                value={ewayData.vehicleType}
                                onChange={e => setEwayData({...ewayData, vehicleType: e.target.value})}
                              >
                                <option value="R">Regular</option>
                                <option value="O">Over Dimensional Cargo</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Additional Values */}
                        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <div className="flex items-center space-x-2 pb-2 border-bottom border-slate-100">
                            <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Additional Values</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TotNonAdvolVal</label>
                              <input 
                                type="number" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all"
                                value={ewayData.TotNonAdvolVal}
                                onChange={e => setEwayData({...ewayData, TotNonAdvolVal: parseFloat(e.target.value) || 0})}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Other Value</label>
                              <input 
                                type="number" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-[12px] font-medium transition-all"
                                value={ewayData.OthValue}
                                onChange={e => setEwayData({...ewayData, OthValue: parseFloat(e.target.value) || 0})}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* Sidebar Summary */}
            <div className="space-y-4 xl:col-span-1 min-w-0">
              <div className="bg-gradient-to-b from-white to-slate-50/50 p-5 rounded-2xl shadow-sm border border-slate-100/60 sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-24 -mt-24"></div>
                </div>
                <h3 className="text-[10px] font-black text-slate-400 mb-5 uppercase tracking-widest relative z-10">Invoice Summary</h3>
                
                <div className="space-y-3 relative z-10">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Subtotal</span>
                    <span className="font-bold text-slate-900">{formatCurrency(rawSubtotal)}</span>
                  </div>
                  {itemDiscountTotal > 0 && (
                    <div className="flex justify-between items-center text-xs text-emerald-600 font-bold bg-emerald-50/50 p-1.5 -mx-1.5 rounded-lg">
                      <span>Item Discounts</span>
                      <span>-{formatCurrency(itemDiscountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[10px] border-t border-slate-200/60 pt-2 mt-2">
                    <span className="text-slate-500 font-medium">Taxable Amount</span>
                    <span className="font-bold text-slate-900">{formatCurrency(taxableAmount)}</span>
                  </div>
                  
                  {!isInterState ? (
                    <>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">CGST {isSingleRate ? `(${totalGstRate / 2}%)` : 'Var%'}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">SGST {isSingleRate ? `(${totalGstRate / 2}%)` : 'Var%'}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(sgstAmount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">IGST {isSingleRate ? `(${totalGstRate}%)` : 'Var%'}</span>
                      <span className="font-bold text-slate-900">{formatCurrency(igstAmount)}</span>
                    </div>
                  )}
                  
                  {/* Discount Section */}
                  {/* Discount Section removed as requested */}


                  {/* Payment Details */}
                  <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-slate-200/60">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                      <div className="relative">
                        <AlertCircle size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select 
                          className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-xs text-slate-900 font-bold transition-all appearance-none shadow-sm"
                          value={paymentStatus}
                          onChange={e => setPaymentStatus(e.target.value)}
                        >
                          <option value="paid">Paid</option>
                          <option value="unpaid">Unpaid</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Mode</label>
                      <div className="relative">
                        <CreditCard size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select 
                          className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-xs text-slate-900 font-bold transition-all appearance-none shadow-sm disabled:opacity-50 disabled:bg-slate-50"
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
                    <div className="space-y-1 mt-2 col-span-2">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Due Date</label>
                      <div className="relative flex items-center">
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 z-10 overflow-hidden">
                          <Calendar size={12} className="absolute inset-0 text-slate-400 pointer-events-none" />
                          <input 
                            type="date" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            value={dueDate.includes('-') ? dueDate : ''}
                            onChange={e => setDueDate(e.target.value)}
                          />
                        </div>
                        <input 
                          type="text" 
                          placeholder="DD/MM/YYYY"
                          maxLength={10}
                          className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-xs transition-all text-slate-900 font-bold shadow-sm"
                          value={dueDate.includes('-') ? dueDate.split('-').reverse().join('/') : dueDate}
                          onChange={e => {
                            let val = e.target.value.replace(/[^\d/]/g, '');
                            if (val.length === 2 && !val.includes('/')) val += '/';
                            if (val.length === 5 && val.split('/').length === 2) val += '/';
                            
                            if (val.length === 10) {
                              const [d, m, y] = val.split('/');
                              if (d && m && y && d.length === 2 && m.length === 2 && y.length === 4) {
                                setDueDate(`${y}-${m}-${d}`);
                                return;
                              }
                            }
                            setDueDate(val);
                          }}
                        />
                      </div>
                    </div>
                  )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-200/60">
                    <div className="flex justify-between items-center mb-4 bg-gradient-to-r from-primary/5 to-transparent p-3 -mx-3 rounded-xl border border-primary/10">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">Total Amount</span>
                      <span className="text-2xl font-black text-primary tracking-tight">{formatCurrency(total)}</span>
                    </div>
                    
                    <div className="flex flex-col gap-2.5 mb-2">
                      <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full h-10 sm:h-9 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl font-bold flex items-center justify-center hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 transition-all group active:scale-95 text-xs"
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <>
                            <Save size={14} className="mr-2 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                            Save Invoice
                          </>
                        )}
                      </button>
                      <button
                        onClick={handlePreview}
                        className="w-full h-10 sm:h-9 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 text-xs shadow-sm"
                      >
                        <Eye size={14} className="mr-2" strokeWidth={2.5} />
                        Preview Invoice
                      </button>
                    </div>
                    
                    <p className="text-[10px] text-center text-slate-400 mt-5 font-medium px-2">
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
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 min-h-[800px] flex flex-col relative overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-lg font-bold text-slate-900">Invoice Preview</h2>
                <div className="flex space-x-3">
                  {includeEwayBill && (
                    <button 
                      onClick={handleDownloadEway}
                      className="px-4 h-10 sm:h-9 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-all shadow-sm active:scale-95 flex items-center"
                    >
                      <Download size={14} className="mr-2" />
                      E-way Bill
                    </button>
                  )}
                  <button 
                    onClick={() => setViewMode('edit')}
                    className="px-4 h-10 sm:h-9 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
                  >
                    Back to Edit
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 h-10 sm:h-9 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl text-xs font-bold flex items-center hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50 active:scale-95"
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
                    <p className="text-xs text-slate-500 font-medium">Generating preview...</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      </motion.div>

    <MessageModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      <ScannedReviewModal 
        isOpen={showScannedReview}
        onClose={() => setShowScannedReview(false)}
        data={scannedData}
        onConfirm={(finalData) => {
          // Update customer details
          const customerData = finalData.customer;
          let customerRecord = customers.find(c => c.name.trim().toLowerCase() === customerData.name.trim().toLowerCase());
          
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

          setItems(finalData.items);
          if (finalData.invoiceNumber) {
            const scannedInvoiceNumber = finalData.invoiceNumber;
            
            // Logic: if scanned number already has a prefix, use it. 
            // Otherwise, prepend "INV-" as requested.
            if (scannedInvoiceNumber.includes('-')) {
              setInvoiceNumber(scannedInvoiceNumber);
              const matchingSeries = invoiceSeries.find(s => s.prefix && scannedInvoiceNumber.startsWith(s.prefix));
              if (matchingSeries) {
                setSelectedSeriesId(matchingSeries.id);
              }
            } else {
              setInvoiceNumber(`INV-${scannedInvoiceNumber}`);
              // Try to find the INV- series to link it
              const invSeries = invoiceSeries.find(s => s.prefix === 'INV-');
              if (invSeries) {
                setSelectedSeriesId(invSeries.id);
              }
            }
            setIsScannedInvoiceNumberFound(true);
          }
          setShowScannedReview(false);
          setModal({ isOpen: true, title: 'Success', message: 'Invoice details added to your draft!', type: 'success' });
        }}
      />
      
      {/* Scanning Overlay */}
      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100001]"
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
              <p className="text-slate-500 text-center text-xs leading-relaxed">
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

              <button
                onClick={() => setIsScanning(false)}
                className="mt-8 px-6 py-2 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors"
              >
                Cancel Scan
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saving Overlay */}
      <AnimatePresence>
        {isSaving && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100001]"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-xs w-full mx-4"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Saving Invoice</h3>
              <p className="text-slate-500 text-center text-[11px] font-medium">
                Please wait while we secure your data...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

interface ScannedReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    customer: any;
    items: any[];
    invoiceNumber?: string;
    date?: string;
  } | null;
  onConfirm: (finalData: any) => void;
}

const ScannedReviewModal = ({ isOpen, onClose, data, onConfirm }: ScannedReviewModalProps) => {
  const [editedData, setEditedData] = useState<any>(null);

  useEffect(() => {
    if (data) {
      setEditedData(JSON.parse(JSON.stringify(data)));
    }
  }, [data]);

  return (
    <Drawer
      isOpen={isOpen && !!editedData}
      onClose={onClose}
      title="Review Scanned Data"
      icon={<Scan size={18} />}
      fullScreen={true}
      footer={
        <>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
          >
            Discard
          </button>
          <button 
            onClick={() => onConfirm(editedData)}
            className="px-5 py-2 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95 flex items-center"
          >
            <Plus size={16} className="mr-1.5" strokeWidth={2.5} />
            Add to Invoice
          </button>
        </>
      }
    >
      {editedData && (
        <div className="space-y-6">
          {/* Customer Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-primary bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
                <UserPlus size={16} strokeWidth={2.5} />
                <h4 className="text-xs font-black uppercase tracking-widest">Customer Information</h4>
              </div>
              {!editedData.customer.id && (
                <span className="px-3 py-1 bg-gradient-to-r from-amber-100 to-amber-200/50 text-amber-800 text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm border border-amber-200/50">New Customer</span>
              )}
            </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Name</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
                value={editedData.customer.name}
                onChange={e => setEditedData({ ...editedData, customer: { ...editedData.customer, name: e.target.value } })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Phone</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
                value={editedData.customer.phone}
                onChange={e => setEditedData({ ...editedData, customer: { ...editedData.customer, phone: e.target.value } })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">GSTIN</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
                value={editedData.customer.gst}
                onChange={e => setEditedData({ ...editedData, customer: { ...editedData.customer, gst: e.target.value } })}
              />
            </div>
            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Address</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
                value={editedData.customer.address1}
                onChange={e => setEditedData({ ...editedData, customer: { ...editedData.customer, address1: e.target.value } })}
              />
            </div>
          </div>
        </section>

        {/* Items Section */}
        <section className="space-y-3">
          <div className="flex items-center space-x-2 text-primary bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 w-fit">
            <Package size={16} strokeWidth={2.5} />
            <h4 className="text-xs font-black uppercase tracking-widest">Scanned Items</h4>
          </div>
          <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-sm bg-white">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200">
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-1/3">Particular</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-20 text-center">HSN</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-20 text-center">Unit</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16 text-center">Qty</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">Rate</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {editedData.items.map((item: any, idx: number) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-3 py-2 w-1/3">
                      <input 
                        type="text" 
                        className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 transition-all outline-none"
                        value={item.name}
                        onChange={e => {
                          const newItems = [...editedData.items];
                          newItems[idx].name = e.target.value;
                          setEditedData({ ...editedData, items: newItems });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 w-20">
                      <input 
                        type="text" 
                        className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 transition-all outline-none text-center"
                        value={item.hsnCode || ''}
                        onChange={e => {
                          const newItems = [...editedData.items];
                          newItems[idx].hsnCode = e.target.value;
                          setEditedData({ ...editedData, items: newItems });
                        }}
                        placeholder="HSN"
                      />
                    </td>
                    <td className="px-3 py-2 w-20">
                      <select 
                        className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 transition-all outline-none text-center"
                        value={item.unitType || 'NUMBERS'}
                        onChange={e => {
                          const newItems = [...editedData.items];
                          newItems[idx].unitType = e.target.value;
                          setEditedData({ ...editedData, items: newItems });
                        }}
                      >
                        {UNIT_TYPES.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 w-16">
                      <input 
                        type="number" 
                        className="w-full bg-slate-50 border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 transition-all outline-none text-center"
                        value={item.quantity}
                        onChange={e => {
                          const newItems = [...editedData.items];
                          newItems[idx].quantity = Number(e.target.value);
                          newItems[idx].amount = newItems[idx].quantity * newItems[idx].rate * (1 + (newItems[idx].gstRate || 18) / 100);
                          setEditedData({ ...editedData, items: newItems });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 w-24">
                      <input 
                        type="number" 
                        className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 transition-all outline-none"
                        value={item.rate}
                        onChange={e => {
                          const newItems = [...editedData.items];
                          newItems[idx].rate = Number(e.target.value);
                          newItems[idx].amount = newItems[idx].quantity * newItems[idx].rate * (1 + (newItems[idx].gstRate || 18) / 100);
                          setEditedData({ ...editedData, items: newItems });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 w-24 text-right text-xs font-black text-slate-900 bg-slate-50/50 group-hover:bg-slate-100/50 transition-colors">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      )}
    </Drawer>
  );
};
