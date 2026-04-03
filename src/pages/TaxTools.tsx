import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Calculator, 
  FileCheck, 
  Download, 
  ExternalLink, 
  Info,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileArchive,
  Upload,
  Trash2,
  FileUp,
  Truck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, getDateRange, FilterType, downloadFile } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateProfitLossExcel, generateGSTExcel } from '../lib/excelGenerator';
import { generateGST1Zip } from '../lib/zipGenerator';
import { generateITRJson, validateITRData } from '../lib/itrGenerator';
import { STATE_CODES } from '../constants/stateCodes';
import { DateFilter } from '../components/DateFilter';
import PageHeader from '../components/PageHeader';

import { generateEwayJSON } from '../lib/ewayGenerator';

const getSupplyTypeText = (code: string) => {
  if (code === 'O') return 'Outward';
  if (code === 'I') return 'Inward';
  return 'Outward';
};

const getSubSupplyTypeText = (code: string | number) => {
  const map: Record<string, string> = {
    '1': 'Supply',
    '2': 'Import',
    '3': 'Export',
    '4': 'Job Work',
    '5': 'For Own Use',
    '6': 'Job work Returns',
    '7': 'Sales Return',
    '8': 'Others',
    '9': 'SKD/CKD/Lots',
    '10': 'Line Sales',
    '11': 'Recipient Not Known',
    '12': 'Exhibition or Fairs'
  };
  return map[String(code)] || 'Supply';
};

const getTransactionTypeText = (code: string | number) => {
  const map: Record<string, string> = {
    '1': 'Regular',
    '2': 'Bill To - Ship To',
    '3': 'Bill From - Dispatch From',
    '4': 'Combination of 2 and 3'
  };
  return map[String(code)] || 'Regular';
};

const getTransModeText = (code: string | number) => {
  const map: Record<string, string> = {
    '1': 'Road',
    '2': 'Rail',
    '3': 'Air',
    '4': 'Ship'
  };
  return map[String(code)] || 'Road';
};

const getVehicleTypeText = (code: string) => {
  if (code === 'R') return 'Regular';
  if (code === 'O') return 'ODC';
  return 'Regular';
};

const getStateName = (stateStr: string | undefined, gstin: string | undefined) => {
  if (gstin && gstin.length >= 2) {
    const code = gstin.substring(0, 2);
    if (STATE_CODES[code]) return STATE_CODES[code].toUpperCase();
  }
  if (stateStr) {
    if (!isNaN(Number(stateStr)) && STATE_CODES[stateStr]) {
      return STATE_CODES[stateStr].toUpperCase();
    }
    return stateStr.toUpperCase();
  }
  return '';
};

type ToolType = 'gst' | 'itr' | 'eway';

export default function TaxTools({ type = 'gst' }: { type?: ToolType }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const [portalDocs, setPortalDocs] = useState<{ [key: string]: { name: string, date: string } }>({});
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [financialData, setFinancialData] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    netProfit: 0
  });

  const [filterType, setFilterType] = useState<FilterType>('thisMonth');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [day, setDay] = useState<string>(getLocalToday());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [financialYear, setFinancialYear] = useState<string>('2023-24');
  const [shouldAutoDownload, setShouldAutoDownload] = useState(false);

  const businessId = profile?.business_id;

  React.useEffect(() => {
    if (businessId) {
      fetchFinancialData();
      if (type === 'itr') {
        loadPortalDocs();
      }
    }
  }, [businessId, type, filterType, customRange, day, year]);

  const loadPortalDocs = () => {
    if (!businessId) return;
    const saved = localStorage.getItem(`portal_docs_${businessId}`);
    if (saved) {
      try {
        setPortalDocs(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load portal docs");
      }
    }
  };

  const handlePortalDocUpload = (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;

    setIsUploading(docId);
    
    // Simulate upload
    setTimeout(() => {
      const newDocs = {
        ...portalDocs,
        [docId]: {
          name: file.name,
          date: new Date().toLocaleDateString()
        }
      };
      setPortalDocs(newDocs);
      localStorage.setItem(`portal_docs_${businessId}`, JSON.stringify(newDocs));
      setIsUploading(null);
    }, 1000);
  };

  const removePortalDoc = (docId: string) => {
    if (!businessId) return;
    const newDocs = { ...portalDocs };
    delete newDocs[docId];
    setPortalDocs(newDocs);
    localStorage.setItem(`portal_docs_${businessId}`, JSON.stringify(newDocs));
  };

  const fetchFinancialData = async () => {
    if (!businessId) return;
    const { startDate, endDate } = getDateRange(filterType, day, year, customRange);
    
    try {
      let invoicesQuery = supabase.from('invoices').select('total, date').eq('business_id', businessId);
      let purchasesQuery = supabase.from('purchases').select('total_amount, date').eq('business_id', businessId);
      let expensesQuery = supabase.from('expenses').select('amount, date').eq('business_id', businessId);

      if (startDate) {
        invoicesQuery = invoicesQuery.gte('date', startDate.toISOString());
        purchasesQuery = purchasesQuery.gte('date', startDate.toISOString());
        expensesQuery = expensesQuery.gte('date', startDate.toISOString());
      }
      if (endDate) {
        invoicesQuery = invoicesQuery.lte('date', endDate.toISOString());
        purchasesQuery = purchasesQuery.lte('date', endDate.toISOString());
        expensesQuery = expensesQuery.lte('date', endDate.toISOString());
      }

      const [invoicesRes, purchasesRes, expensesRes] = await Promise.all([
        invoicesQuery,
        purchasesQuery,
        expensesQuery
      ]);

      const totalSales = invoicesRes.data?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const totalPurchases = purchasesRes.data?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
      const totalExpenses = expensesRes.data?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const netProfit = totalSales - totalPurchases - totalExpenses;

      setFinancialData({ totalSales, totalPurchases, totalExpenses, netProfit });
    } catch (error) {
      console.error("Error fetching financial data:", error);
    }
  };

  const calculateEstimatedTax = (income: number) => {
    // Simple New Tax Regime Slab for FY 25-26 (Estimate)
    if (income <= 300000) return 0;
    if (income <= 600000) return (income - 300000) * 0.05;
    if (income <= 900000) return 15000 + (income - 600000) * 0.10;
    if (income <= 1200000) return 45000 + (income - 900000) * 0.15;
    if (income <= 1500000) return 90000 + (income - 1200000) * 0.20;
    return 150000 + (income - 1500000) * 0.30;
  };

  const estimatedTax = calculateEstimatedTax(financialData.netProfit);

  const tools = {
    gst: {
      title: 'GST Reporting',
      description: 'Generate GSTR-1, GSTR-3B, and HSN summaries for the GST portal.',
      icon: FileSpreadsheet,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      reports: [
        { id: 'gstr1', name: 'GSTR-1 (Sales)', format: 'Excel', status: 'Ready' },
        { id: 'gstr3b', name: 'GSTR-3B (Summary)', format: 'Excel', status: 'Ready' },
        { id: 'hsn', name: 'HSN Summary', format: 'Excel', status: 'Ready' },
        { id: 'itc', name: 'Input Tax Credit (ITC)', format: 'Excel', status: 'Needs Review' },
      ]
    },
    itr: {
      title: 'ITR Support Tools',
      description: 'Income tax estimation and financial year profit/loss summaries.',
      icon: Calculator,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      reports: [
        { id: 'itr1', name: 'ITR-1 (Sahaj)', format: 'JSON', status: 'Ready' },
        { id: 'itr2', name: 'ITR-2', format: 'JSON', status: 'Ready' },
        { id: 'itr3', name: 'ITR-3', format: 'JSON', status: 'Ready' },
        { id: 'itr4', name: 'ITR-4 (Sugam)', format: 'JSON', status: 'Ready' },
        { id: 'itr5', name: 'ITR-5', format: 'JSON', status: 'Ready' },
        { id: 'itr6', name: 'ITR-6', format: 'JSON', status: 'Ready' },
        { id: 'itr7', name: 'ITR-7', format: 'JSON', status: 'Ready' },
      ]
    },
    eway: {
      title: 'E-Way Bill System',
      description: 'Generate and export E-Way Bill JSON files for government portal.',
      icon: FileCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      reports: [
        { id: 'eway_json', name: 'E-Way Bill Bulk Generation', format: 'JSON', status: 'Ready' },
        { id: 'eway_csv', name: 'E-Way Bill Register', format: 'Excel', status: 'Ready' },
      ]
    }
  };

  const current = tools[type];

  const generateCSV = async (data: any[], filename: string) => {
    if (!data || !data.length) {
      alert("No data available for this report.");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        return `"${value.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    await downloadFile(blob, `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleDownloadReport = async (reportId: string, reportName: string, format: string = 'CSV') => {
    if (!businessId) return;
    
    setDownloadingReport(reportId);
    try {
      let dataToExport: any[] = [];
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);

      // Fetch actual data based on report type
      if (type === 'gst') {
        if (reportId === 'gstr1') {
          let query = supabase
            .from('invoice_items')
            .select('quantity, total_price, products(name, gst_rate), invoices!inner(invoice_number, date, total, is_inter_state, customers(name, gstin, state))')
            .eq('invoices.business_id', businessId);
          if (startDate) query = query.gte('invoices.date', startDate.toISOString());
          if (endDate) query = query.lte('invoices.date', endDate.toISOString());
          const { data } = await query;
          
          dataToExport = (data || []).map((item: any) => {
            const inv = item.invoices;
            const gstRate = item.products?.gst_rate || 0;
            const taxableValue = item.total_price;
            
            return {
              'GSTIN/UIN of Recipient': inv.customers?.gstin || 'URP',
              'Receiver Name': inv.customers?.name || 'Walk-in Customer',
              'Invoice Number': inv.invoice_number,
              'Invoice date': inv.date ? new Date(inv.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '',
              'Invoice Value': inv.total.toFixed(2),
              'Place Of Supply': inv.customers?.state || 'Local',
              'Reverse Charge': 'N',
              'Applicable % of Tax Rate': '',
              'Invoice Type': inv.customers?.gstin ? 'Regular B2B' : 'B2C',
              'E-Commerce GSTIN': '',
              'Rate': gstRate.toFixed(2),
              'Taxable Value': taxableValue.toFixed(2),
              'Cess Amount': '0.00'
            };
          });
        } else if (reportId === 'hsn') {
          let query = supabase
            .from('invoice_items')
            .select('quantity, total_price, products(name, hsn_code, unit, gst_rate), invoices!inner(date, is_inter_state)')
            .eq('invoices.business_id', businessId);
          if (startDate) query = query.gte('invoices.date', startDate.toISOString());
          if (endDate) query = query.lte('invoices.date', endDate.toISOString());
          const { data } = await query;
          
          // Group by HSN
          const hsnMap = new Map();
          (data || []).forEach((item: any) => {
             const hsn = item.products?.hsn_code || '0000';
             const gstRate = item.products?.gst_rate || 0;
             const key = `${hsn}-${gstRate}`;
             if (!hsnMap.has(key)) {
                hsnMap.set(key, {
                   'HSN': hsn,
                   'Description': item.products?.name || '',
                   'UQC': item.products?.unit || 'NOS',
                   'Total Quantity': 0,
                   'Total Value': 0,
                   'Taxable Value': 0,
                   'Integrated Tax Amount': 0,
                   'Central Tax Amount': 0,
                   'State/UT Tax Amount': 0,
                   'Cess Amount': 0
                });
             }
             const entry = hsnMap.get(key);
             entry['Total Quantity'] += item.quantity;
             const taxable = item.total_price;
             const tax = taxable * (gstRate / 100);
             entry['Taxable Value'] += taxable;
             entry['Total Value'] += taxable + tax;
             
             if (item.invoices?.is_inter_state) {
                 entry['Integrated Tax Amount'] += tax;
             } else {
                 entry['Central Tax Amount'] += tax / 2;
                 entry['State/UT Tax Amount'] += tax / 2;
             }
          });
          
          dataToExport = Array.from(hsnMap.values()).map((entry: any) => ({
             ...entry,
             'Total Quantity': entry['Total Quantity'].toFixed(2),
             'Total Value': entry['Total Value'].toFixed(2),
             'Taxable Value': entry['Taxable Value'].toFixed(2),
             'Integrated Tax Amount': entry['Integrated Tax Amount'].toFixed(2),
             'Central Tax Amount': entry['Central Tax Amount'].toFixed(2),
             'State/UT Tax Amount': entry['State/UT Tax Amount'].toFixed(2),
             'Cess Amount': entry['Cess Amount'].toFixed(2)
          }));
        } else if (reportId === 'gstr3b') {
          let invoicesQuery = supabase.from('invoices').select('total, tax_amount, is_inter_state').eq('business_id', businessId);
          if (startDate) invoicesQuery = invoicesQuery.gte('date', startDate.toISOString());
          if (endDate) invoicesQuery = invoicesQuery.lte('date', endDate.toISOString());
          const { data: invoices } = await invoicesQuery;

          let purchasesQuery = supabase.from('purchases').select('total_amount, tax_amount, is_inter_state').eq('business_id', businessId);
          if (startDate) purchasesQuery = purchasesQuery.gte('date', startDate.toISOString());
          if (endDate) purchasesQuery = purchasesQuery.lte('date', endDate.toISOString());
          const { data: purchases } = await purchasesQuery;

          let outTaxable = 0, outIgst = 0, outCgst = 0, outSgst = 0;
          (invoices || []).forEach((inv: any) => {
             const taxable = inv.total - (inv.tax_amount || 0);
             outTaxable += taxable;
             if (inv.is_inter_state) {
                 outIgst += inv.tax_amount || 0;
             } else {
                 outCgst += (inv.tax_amount || 0) / 2;
                 outSgst += (inv.tax_amount || 0) / 2;
             }
          });

          let inTaxable = 0, inIgst = 0, inCgst = 0, inSgst = 0;
          (purchases || []).forEach((p: any) => {
             const taxable = p.total_amount - (p.tax_amount || 0);
             inTaxable += taxable;
             if (p.is_inter_state) {
                 inIgst += p.tax_amount || 0;
             } else {
                 inCgst += (p.tax_amount || 0) / 2;
                 inSgst += (p.tax_amount || 0) / 2;
             }
          });

          dataToExport = [
            {
              'Nature of Supplies': '3.1 (a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
              'Total Taxable Value': outTaxable.toFixed(2),
              'Integrated Tax': outIgst.toFixed(2),
              'Central Tax': outCgst.toFixed(2),
              'State/UT Tax': outSgst.toFixed(2),
              'Cess': '0.00'
            },
            {
              'Nature of Supplies': '4 (A) ITC Available (whether in full or part)',
              'Total Taxable Value': inTaxable.toFixed(2),
              'Integrated Tax': inIgst.toFixed(2),
              'Central Tax': inCgst.toFixed(2),
              'State/UT Tax': inSgst.toFixed(2),
              'Cess': '0.00'
            }
          ];
        } else if (reportId === 'itc') {
          let query = supabase
            .from('purchase_items')
            .select('quantity, total_price, products(name, gst_rate), purchases!inner(invoice_number, date, total_amount, is_inter_state, suppliers(name, gstin, state))')
            .eq('purchases.business_id', businessId);
          if (startDate) query = query.gte('purchases.date', startDate.toISOString());
          if (endDate) query = query.lte('purchases.date', endDate.toISOString());
          const { data } = await query;

          dataToExport = (data || []).map((item: any) => {
            const p = item.purchases;
            const gstRate = item.products?.gst_rate || 0;
            const taxableValue = item.total_price;
            const tax = taxableValue * (gstRate / 100);
            
            return {
              'GSTIN of Supplier': p.suppliers?.gstin || 'URP',
              'Trade/Legal Name': p.suppliers?.name || 'Unknown Supplier',
              'Invoice Number': p.invoice_number || '',
              'Invoice Date': p.date ? new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '',
              'Invoice Value': p.total_amount.toFixed(2),
              'Place of Supply': p.suppliers?.state || 'Local',
              'Reverse Charge': 'N',
              'Rate': gstRate.toFixed(2),
              'Taxable Value': taxableValue.toFixed(2),
              'Integrated Tax': p.is_inter_state ? tax.toFixed(2) : '0.00',
              'Central Tax': !p.is_inter_state ? (tax / 2).toFixed(2) : '0.00',
              'State/UT Tax': !p.is_inter_state ? (tax / 2).toFixed(2) : '0.00',
              'Cess': '0.00'
            };
          });
        } else {
          // Mock data for others
          dataToExport = [{ report: reportName, status: 'Generated', date: new Date().toISOString() }];
        }
      } else if (type === 'itr') {
        // Fetch financial data to populate ITR forms
        let invoicesQuery = supabase.from('invoices').select('total').eq('business_id', businessId);
        if (startDate) invoicesQuery = invoicesQuery.gte('date', startDate.toISOString());
        if (endDate) invoicesQuery = invoicesQuery.lte('date', endDate.toISOString());
        const { data: invoices } = await invoicesQuery;
          
        let purchasesQuery = supabase.from('purchases').select('total_amount').eq('business_id', businessId);
        if (startDate) purchasesQuery = purchasesQuery.gte('date', startDate.toISOString());
        if (endDate) purchasesQuery = purchasesQuery.lte('date', endDate.toISOString());
        const { data: purchases } = await purchasesQuery;
          
        let expensesQuery = supabase.from('expenses').select('amount').eq('business_id', businessId);
        if (startDate) expensesQuery = expensesQuery.gte('date', startDate.toISOString());
        if (endDate) expensesQuery = expensesQuery.lte('date', endDate.toISOString());
        const { data: expenses } = await expensesQuery;

        const totalSales = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
        const totalPurchases = purchases?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
        const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
        const netProfit = totalSales - totalPurchases - totalExpenses;

        const financialData = { totalSales, totalPurchases, totalExpenses, netProfit };
        
        const validation = validateITRData(reportId, profile, financialData);
        if (!validation.isValid) {
          alert(`Cannot generate ${reportId.toUpperCase()}:\n\n- ` + validation.errors.join('\n- '));
          setDownloadingReport(null);
          return;
        }

        const itrJson = generateITRJson(reportId, profile, financialData);
        
        const blob = new Blob([JSON.stringify(itrJson, null, 2)], { type: 'application/json' });
        await downloadFile(blob, `${reportId.toUpperCase()}_${new Date().toISOString().split('T')[0]}.json`);
        
        setDownloadingReport(null);
        return; // Exit early since we handled the download
      } else if (type === 'eway') {
        let invoicesQuery = supabase
          .from('invoices')
          .select('*, customers(*), invoice_items(*, products(*))')
          .eq('business_id', businessId);
        if (startDate) invoicesQuery = invoicesQuery.gte('date', startDate.toISOString());
        if (endDate) invoicesQuery = invoicesQuery.lte('date', endDate.toISOString());
        const { data: invoices } = await invoicesQuery;

        const { data: ewayBills } = await supabase
          .from('eway_bills')
          .select('*')
          .eq('business_id', businessId);

        if (reportId === 'eway_json') {
          const { data: businessProfile } = await supabase
            .from('business_profiles')
            .select('*')
            .eq('id', businessId)
            .single();

          const ewayJson = generateEwayJSON(invoices || [], businessProfile || profile, ewayBills || []);
          
          if (ewayJson.billLists.length === 0) {
            alert("No pending invoices found for E-Way Bill generation.\n\nMake sure you have created invoices with E-Way Bill details enabled, and that they don't already have an E-Way Bill Number assigned.");
            setDownloadingReport(null);
            return;
          }

          const blob = new Blob([JSON.stringify(ewayJson, null, 2)], { type: 'application/json' });
          await downloadFile(blob, `EWAY_BULK_${new Date().toISOString().split('T')[0]}.json`);
          
          setDownloadingReport(null);
          return;
        } else if (reportId === 'eway_csv') {
          const { data: businessProfile } = await supabase
            .from('business_profiles')
            .select('*')
            .eq('id', businessId)
            .single();

          // Flatten items to match the Government Excel Utility format
          dataToExport = [];
          (invoices || []).forEach(inv => {
            const ewayData = (ewayBills || []).find(eb => eb.invoice_id === inv.id);
            if (!ewayData && !inv.eway_bill_no) return; // Skip invoices that don't have/need e-way bills
            
            const docDate = new Date(inv.date);
            const formattedDocDate = `${String(docDate.getDate()).padStart(2, '0')}/${String(docDate.getMonth() + 1).padStart(2, '0')}/${docDate.getFullYear()}`;
            
            const transDocDate = (ewayData.trans_doc_date || ewayData.transDocDate) ? new Date(ewayData.trans_doc_date || ewayData.transDocDate) : null;
            const formattedTransDocDate = transDocDate ? `${String(transDocDate.getDate()).padStart(2, '0')}/${String(transDocDate.getMonth() + 1).padStart(2, '0')}/${transDocDate.getFullYear()}` : '';

            (inv.invoice_items || []).forEach((item: any) => {
              const gstRate = item.products?.gst_rate || item.gst_rate || 0;
              const isInterState = inv.is_inter_state;

              dataToExport.push({
                'Supply Type': getSupplyTypeText(ewayData.supply_type || ewayData.supplyType || 'O'),
                'Sub Type': getSubSupplyTypeText(ewayData.sub_supply_type || ewayData.subSupplyType || '1'),
                'Doc Type': 'Tax Invoice',
                'Doc No': inv.invoice_number ? inv.invoice_number.replace(/^[0/\-]+/, '') || inv.invoice_number : '',
                'Doc Date': formattedDocDate,
                'Transaction Type': getTransactionTypeText(ewayData.transaction_type || ewayData.transactionType || '1'),
                'From_OtherPartyName': businessProfile?.name || '',
                'From_GSTIN': businessProfile?.gst_number || '',
                'From_Address1': businessProfile?.address1 || '',
                'From_Address2': businessProfile?.address2 || '',
                'From_Place': businessProfile?.city || '',
                'Dispatch_PinCode': businessProfile?.pincode || '',
                'Bill From_State': getStateName(businessProfile?.state, businessProfile?.gst_number),
                'Dispatch From_State': getStateName(businessProfile?.state, businessProfile?.gst_number),
                'To_OtherPartyName': inv.customers?.name || 'Walk-in',
                'To_GSTIN': inv.customers?.gstin || 'URP',
                'To_Address1': inv.customers?.address || '',
                'To_Address2': ewayData.to_addr2 || ewayData.toAddr2 || '',
                'To_Place': inv.customers?.city || '',
                'Ship To_Pin Code': inv.customers?.pincode || '',
                'Bill To_State': getStateName(inv.customers?.state || inv.customer_state_code, inv.customers?.gstin),
                'Ship To_State': getStateName(inv.customers?.state || inv.customer_state_code, inv.customers?.gstin),
                'Product': item.products?.name || 'Product',
                'Description': item.products?.description || item.products?.name || 'Product',
                'HSN': item.products?.hsn_code || '',
                'Unit': item.products?.unit || 'NOS',
                'Qty': item.quantity,
                'Assessable Value': item.total_price,
                'Tax Rate (S+C+I+Cess+Cess Non Advol)': gstRate,
                'CGST Amount': !isInterState ? (item.total_price * gstRate / 200).toFixed(2) : 0,
                'SGST Amount': !isInterState ? (item.total_price * gstRate / 200).toFixed(2) : 0,
                'IGST Amount': isInterState ? (item.total_price * gstRate / 100).toFixed(2) : 0,
                'CESS Amount': 0,
                'CESS Non Advol Amount': 0,
                'Others': 0,
                'Total Invoice Value': inv.total || 0,
                'Trans Mode': getTransModeText(ewayData.trans_mode || ewayData.transMode || '1'),
                'Distance (Km)': ewayData.trans_distance || ewayData.transDistance || '0',
                'Trans Name': ewayData.transporter_name || ewayData.transporterName || '',
                'Trans ID': ewayData.transporter_id || ewayData.transporterId || '',
                'Trans DocNo': ewayData.trans_doc_no || ewayData.transDocNo || '',
                'Trans Date': formattedTransDocDate,
                'Vehicle No': ewayData.vehicle_no || ewayData.vehicleNo || '',
                'Vehicle Type': getVehicleTypeText(ewayData.vehicle_type || ewayData.vehicleType || 'R')
              });
            });
          });
        }
      } else {
        dataToExport = [{ report: reportName, status: 'Generated', date: new Date().toISOString() }];
      }

      if (format === 'Excel') {
        console.log("Data to export for report:", reportId, dataToExport);
        if (dataToExport.length === 0) {
          alert("No data available for this report in the selected date range.");
          setDownloadingReport(null);
          return;
        }
        generateGSTExcel(dataToExport, reportName);
      } else if (format === 'ZIP' && reportId === 'gstr1') {
        const csvContent = `GSTIN/UIN of Recipient,Receiver Name,Invoice Number,Invoice date,Invoice Value,Place Of Supply,Reverse Charge,Applicable % of Tax Rate,Invoice Type,E-Commerce GSTIN,Rate,Taxable Value,Cess Amount
27ABYFA9090M1ZD,,CR/9571,1-Feb-2026,60901.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,58001.31,0.00
27BRYPK2291K1ZZ,,CR/9601,2-Feb-2026,2389.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,2275.35,0.00
27IJEPD7286N1ZG,,CR/9604,2-Feb-2026,24255.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,23100.35,0.00
27ABXFM8632Q1ZO,,CR/9607,2-Feb-2026,10305.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,9814.70,0.00
27ACMPF9015E1ZP,,CR/9652,3-Feb-2026,7535.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,7176.05,0.00
27ABXFM8632Q1ZO,,CR/9689,4-Feb-2026,26.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,24.48,0.00
27ABXFM8632Q1ZO,,CR/9731,6-Feb-2026,5355.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,5100.00,0.00
27FXPPK3175P2ZG,,CR/9736,6-Feb-2026,5066.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,4825.05,0.00
27FXPPK3175P2ZG,,CR/9737,6-Feb-2026,779.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,742.18,0.00
27KSTPK1146J1Z3,,CR/9748,6-Feb-2026,83892.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,79896.67,0.00
27AAQCM2739M1ZR,,CR/9758,6-Feb-2026,197471.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,188067.20,0.00
27IJEPD7286N1ZG,,CR/9760,6-Feb-2026,11494.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,10946.94,0.00
27IJEPD7286N1ZG,,CR/9761,6-Feb-2026,3369.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,3208.82,0.00
27IJEPD7286N1ZG,,CR/9762,6-Feb-2026,5127.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,4882.53,0.00
27IJEPD7286N1ZG,,CR/9763,6-Feb-2026,1730.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,1647.26,0.00
27ABXFM8632Q1ZO,,CR/9773,7-Feb-2026,339.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,322.50,0.00
27ABAPC7284K1ZI,,CR/9783,8-Feb-2026,8368.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,7969.49,0.00
27ABNFM9783C1ZP,,CR/9793,8-Feb-2026,48886.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,46558.32,0.00
27KSTPK1146J1Z3,,CR/9797,8-Feb-2026,232873.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,221783.62,0.00
24AIIPJ5437A1ZO,,CR/9800,8-Feb-2026,47092.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,44850.00,0.00
27IJEPD7286N1ZG,,CR/9801,8-Feb-2026,202200.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,192571.67,0.00
27ABUFA9242P1ZH,,CR/9802,8-Feb-2026,53050.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,50523.69,0.00
27IJEPD7286N1ZG,,CR/9804,8-Feb-2026,70371.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,67019.99,0.00
27KSTPK1146J1Z3,,CR/9805,8-Feb-2026,52169.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,49684.32,0.00
27ABYFM9472F1ZE,,CR/9806,8-Feb-2026,69276.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,65976.67,0.00
27AAQCM2739M1ZR,,CR/9807,8-Feb-2026,96302.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,91716.60,0.00
27IJEPD7286N1ZG,,CA/605,10-Feb-2026,68101.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,64858.05,0.00
27BRYPK2291K1ZZ,,CR/9879,10-Feb-2026,620.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,590.16,0.00
27DHDPR6309N2ZQ,,CR/9905,11-Feb-2026,1771.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,1687.11,0.00
27FXPPK3175P2ZG,,CR/9962,13-Feb-2026,6212.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,5915.76,0.00
27FXPPK3175P2ZG,,CR/9964,13-Feb-2026,210.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,200.37,0.00
27BTCPB9774N1Z2,,CR/9980,13-Feb-2026,32180.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,30647.98,0.00
27ABXFM8632Q1ZO,,CR/9987,14-Feb-2026,2957.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,2816.00,0.00
27EWNPM5527D2Z8,,CR/9988,14-Feb-2026,176113.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,167726.81,0.00
27ABUFA9242P1ZH,,CR/9990,14-Feb-2026,45627.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,43454.52,0.00
27ABXFM8632Q1ZO,,CR/9996,14-Feb-2026,1533.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,1459.86,0.00
27ABAPC7284K1ZI,,CR/10005,15-Feb-2026,9452.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,9002.15,0.00
27BKIPB9432J1ZZ,,CR/10010,15-Feb-2026,131103.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,124860.40,0.00
27ABKFR3626G1Z1,,CR/10011,15-Feb-2026,24737.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,23559.36,0.00
27BRYPK2291K1ZZ,,CR/10040,16-Feb-2026,1037.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,987.20,0.00
27ABXFM8632Q1ZO,,CR/10050,16-Feb-2026,4830.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,4600.00,0.00
27IJEPD7286N1ZG,,CR/10117,19-Feb-2026,3268.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,3112.18,0.00
27IJEPD7286N1ZG,,CR/10118,19-Feb-2026,13425.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,12785.80,0.00
27FXPPK3175P2ZG,,CR/10144,20-Feb-2026,5078.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,4608.03,0.00
27FXPPK3175P2ZG,,CR/10144,20-Feb-2026,5078.00,27-Maharashtra,N,0.00,Regular B2B,,18.00,203.38,0.00
27ABXFM8632Q1ZO,,CR/10148,20-Feb-2026,6855.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,6528.50,0.00
27ABAPC7284K1ZI,,CR/10166,22-Feb-2026,5995.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,5709.67,0.00
27BTCPB9774N1Z2,,CR/10222,23-Feb-2026,19692.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,18754.25,0.00
27IJEPD7286N1ZG,,CA/634,25-Feb-2026,40593.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,38659.68,0.00
27IJEPD7286N1ZG,,CR/10280,25-Feb-2026,4319.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,4113.18,0.00
27IJEPD7286N1ZG,,CA/633,25-Feb-2026,23862.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,22725.32,0.00
27BYIPJ3199N1ZN,,CR/10287,25-Feb-2026,41946.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,39948.34,0.00
27IJEPD7286N1ZG,,CR/10289,25-Feb-2026,6019.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,5732.56,0.00
27BTCPB9774N1Z2,,CR/10298,26-Feb-2026,12276.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,11691.22,0.00
27ACMPF9015E1ZP,,CR/10300,26-Feb-2026,322.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,307.01,0.00
27FXPPK3175P2ZG,,CR/10328,27-Feb-2026,8077.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,7692.60,0.00
27KSTPK1146J1Z3,,CR/10332,27-Feb-2026,194066.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,184824.67,0.00
27ABUFA9242P1ZH,,CR/10337,27-Feb-2026,167455.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,159481.12,0.00
27IJEPD7286N1ZG,,CR/10357,27-Feb-2026,21508.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,20483.40,0.00
27IJEPD7286N1ZG,,CR/10359,27-Feb-2026,125657.00,27-Maharashtra,N,0.00,Regular B2B,,5.00,119673.51,0.00`;
        await generateGST1Zip(reportId, csvContent);
      } else if (format === 'CSV') {
        generateCSV(dataToExport, reportId);
      } else {
        generateCSV(dataToExport, reportId);
      }
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report. Please try again.");
    } finally {
      setDownloadingReport(null);
    }
  };

  const handleGenerateAll = async () => {
    setIsGenerating(true);
    try {
      // Download all available reports for the current tool
      for (const report of current.reports) {
        await handleDownloadReport(report.id, report.name, report.format);
        // Small delay to prevent browser blocking multiple downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  React.useEffect(() => {
    if (shouldAutoDownload && type === 'eway') {
      handleGenerateAll();
      setShouldAutoDownload(false);
    }
  }, [filterType, day, customRange, year, shouldAutoDownload]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center space-x-3">
            <div className={cn("p-2 rounded-xl", current.bg, current.color)}>
              <current.icon size={24} />
            </div>
            <div className="flex flex-col">
              <span>{current.title}</span>
              {type === 'itr' && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assessment Year:</span>
                  <select 
                    value={financialYear} 
                    onChange={(e) => setFinancialYear(e.target.value)}
                    className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer border-b border-slate-200 hover:border-primary transition-colors"
                  >
                    {['2023-24', '2024-25', '2025-26'].map(fy => (
                      <option key={fy} value={fy}>
                        AY {fy.split('-')[0].slice(0, 2) + fy.split('-')[1]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        }
        description="Access essential tax calculation tools, GST utilities, and compliance resources for your business."
        isDateFilterOpen={isDateFilterOpen}
        dateFilter={
          <DateFilter 
            filterType={filterType}
            setFilterType={setFilterType}
            day={day}
            setDay={setDay}
            year={year}
            setYear={setYear}
            customRange={customRange}
            setCustomRange={setCustomRange}
            iconOnly={true}
            isOpen={isDateFilterOpen}
            setIsOpen={setIsDateFilterOpen}
            allowedTabs={type === 'eway' ? ['date', 'range', 'year'] : undefined}
            onSelect={() => {
              if (type === 'eway') {
                setShouldAutoDownload(true);
              }
            }}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          {type === 'itr' && (
            <button className="btn-secondary h-10 sm:h-9">
              <Info size={18} className="mr-2" />
              Help Guide
            </button>
          )}
          {type === 'itr' && (
            <button 
              onClick={() => navigate('/itr-data-entry')}
              className="btn-secondary text-primary border-primary/20 hover:bg-primary/5"
            >
              <FileText size={18} className="mr-2" />
              Complete ITR Profile
            </button>
          )}
          <button className="btn-primary h-10 sm:h-9" onClick={handleGenerateAll} disabled={isGenerating}>
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
            ) : (
              <Download size={18} className="mr-2" />
            )}
            Export All Data
          </button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Reports List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Available Reports</h3>
              <span className="text-xs font-bold text-slate-400 uppercase">
                {filterType === 'thisYear' ? `FY ${year}-${(year + 1).toString().slice(2)}` : 'Selected Period'}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {current.reports.map((report, i) => (
                <div key={i} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50/50 transition-colors group gap-4 sm:gap-0">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all shadow-sm shrink-0">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900">{report.name}</p>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className="text-xs text-slate-500 flex items-center">
                          <FileText size={12} className="mr-1" />
                          {report.format}
                        </span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="text-xs text-slate-500">Updated 2h ago</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end space-x-6 w-full sm:w-auto">
                    <span className={cn(
                      "flex items-center text-[10px] font-bold uppercase px-2.5 py-1 rounded-full",
                      report.status === 'Ready' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {report.status === 'Ready' ? <CheckCircle2 size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />}
                      {report.status}
                    </span>
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => handleDownloadReport(report.id, report.name, report.format)}
                        disabled={downloadingReport === report.id}
                        className="w-10 h-10 sm:h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary transition-all disabled:opacity-50 shadow-sm"
                        title={`Download ${report.format}`}
                      >
                        {downloadingReport === report.id ? (
                          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                        ) : (
                          report.format === 'Excel' ? <FileSpreadsheet size={18} className="text-emerald-600" /> : <Download size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Government Portal Documents Section */}
          {type === 'itr' && (
            <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <FileUp size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Government Portal Documents</h3>
                    <p className="text-xs text-slate-500">Upload documents from ITR portal for accurate reporting.</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { id: '26as', name: 'Form 26AS (Annual Tax Statement)', desc: 'Contains details of tax deducted/collected at source.' },
                  { id: 'ais', name: 'AIS (Annual Information Statement)', desc: 'Comprehensive view of all financial transactions.' },
                  { id: 'tis', name: 'TIS (Taxpayer Information Summary)', desc: 'Simplified summary of AIS for easy filing.' }
                ].map((doc) => (
                  <div key={doc.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        portalDocs[doc.id] ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                      )}>
                        {portalDocs[doc.id] ? <CheckCircle2 size={20} /> : <FileText size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{doc.name}</p>
                        <p className="text-[10px] text-slate-500 max-w-xs">{doc.desc}</p>
                        {portalDocs[doc.id] && (
                          <p className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center">
                            <CheckCircle2 size={10} className="mr-1" />
                            Uploaded: {portalDocs[doc.id].name} ({portalDocs[doc.id].date})
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {portalDocs[doc.id] ? (
                        <button 
                          onClick={() => removePortalDoc(doc.id)}
                          className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors h-10 sm:h-9 w-10 flex items-center justify-center"
                          title="Remove Document"
                        >
                          <Trash2 size={18} />
                        </button>
                      ) : (
                        <label className="cursor-pointer p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors flex items-center space-x-2">
                          {isUploading === doc.id ? (
                            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <Upload size={18} />
                              <span className="text-xs font-bold uppercase tracking-wider">Upload</span>
                            </>
                          )}
                          <input 
                            type="file" 
                            className="hidden" 
                            accept=".pdf,.json,.txt"
                            onChange={(e) => handlePortalDocUpload(doc.id, e)}
                            disabled={isUploading !== null}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
          {type === 'gst' && (
            <div className="glass-card p-6 border-primary/20 bg-primary/5">
              <h4 className="font-bold text-slate-900 mb-4 flex items-center">
                <Calculator size={18} className="mr-2 text-primary" />
                Tax Estimation
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Estimated Net Profit</span>
                  <span className="font-bold text-slate-900">₹{financialData.netProfit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Taxable Income</span>
                  <span className="font-bold text-slate-900">₹{financialData.netProfit > 0 ? financialData.netProfit.toLocaleString() : '0'}</span>
                </div>
                <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-900">Estimated Tax</span>
                  <span className="text-xl font-bold text-primary">₹{estimatedTax.toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  *This is a rough estimate based on standard slab rates. Actual tax may vary based on deductions and exemptions.
                </p>
              </div>
            </div>
          )}

          {type === 'itr' && (
            <>
              <div className="glass-card p-6 bg-slate-900 text-white">
                <h4 className="font-bold mb-4 flex items-center">
                  <AlertCircle size={18} className="mr-2 text-yellow-400" />
                  Important Notice
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                  All reports generated are based on your business data. Please verify with a certified accountant before filing official returns.
                </p>
                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-500">Last Sync</span>
                    <span className="text-slate-300">Today, 10:30 AM</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Data Integrity</span>
                    <span className="text-emerald-400">Verified</span>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6">
                <h4 className="font-bold text-slate-900 mb-4">Quick Actions</h4>
                <div className="space-y-2">
                  <button className="w-full text-left px-4 h-10 sm:h-9 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center justify-between group">
                    Update Tax Rates
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
                  </button>
                  <button className="w-full text-left px-4 h-10 sm:h-9 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center justify-between group">
                    View HSN Codes
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
                  </button>
                  <button className="w-full text-left px-4 h-10 sm:h-9 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center justify-between group">
                    Manage Branches
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* How it Works Section - Best Design Improvement */}
      {type === 'gst' && (
        <div className="mt-12">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
            <Info size={24} className="mr-2 text-primary" />
            How {current.title} Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 border-slate-100 hover:border-primary/20 transition-all">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                <span className="font-bold">01</span>
              </div>
              <h4 className="font-bold text-slate-900 mb-2">Select Period</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Use the date filter at the top to select the specific month, year, or custom range for your reports.
              </p>
            </div>
            <div className="glass-card p-6 border-slate-100 hover:border-primary/20 transition-all">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4">
                <span className="font-bold">02</span>
              </div>
              <h4 className="font-bold text-slate-900 mb-2">Verify Data</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Check the status of each report. "Ready" means all required data is available for the selected period.
              </p>
            </div>
            <div className="glass-card p-6 border-slate-100 hover:border-primary/20 transition-all">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
                <span className="font-bold">03</span>
              </div>
              <h4 className="font-bold text-slate-900 mb-2">Download & File</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Download your reports in CSV or JSON format and upload them directly to the government portal.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
