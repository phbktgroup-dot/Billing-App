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
  FileUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateProfitLossExcel } from '../lib/excelGenerator';
import { generateGST1Zip } from '../lib/zipGenerator';
import { generateITRJson, validateITRData } from '../lib/itrGenerator';

import { generateEwayJSON } from '../lib/ewayGenerator';

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

  const businessId = profile?.business_id;

  React.useEffect(() => {
    if (businessId && type === 'itr') {
      fetchFinancialData();
      loadPortalDocs();
    }
  }, [businessId, type]);

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
    try {
      const [invoicesRes, purchasesRes, expensesRes] = await Promise.all([
        supabase.from('invoices').select('total').eq('business_id', businessId),
        supabase.from('purchases').select('total_amount').eq('business_id', businessId),
        supabase.from('expenses').select('amount').eq('business_id', businessId)
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
        { id: 'gstr1', name: 'GSTR-1 (Sales)', format: 'CSV', status: 'Ready' },
        { id: 'gstr3b', name: 'GSTR-3B (Summary)', format: 'CSV', status: 'Ready' },
        { id: 'hsn', name: 'HSN Summary', format: 'CSV', status: 'Ready' },
        { id: 'itc', name: 'Input Tax Credit (ITC)', format: 'CSV', status: 'Needs Review' },
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
        { id: 'eway_csv', name: 'E-Way Bill Register', format: 'CSV', status: 'Ready' },
      ]
    }
  };

  const current = tools[type];

  const generateCSV = (data: any[], filename: string) => {
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
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadReport = async (reportId: string, reportName: string, format: string = 'CSV') => {
    if (!businessId) return;
    
    setDownloadingReport(reportId);
    try {
      let dataToExport: any[] = [];

      // Fetch actual data based on report type
      if (type === 'gst') {
        if (reportId === 'gstr1') {
          const { data } = await supabase
            .from('invoices')
            .select('invoice_number, date, customer_name, customer_gstin, total, tax_amount')
            .eq('business_id', businessId);
          dataToExport = data || [];
        } else if (reportId === 'hsn') {
          const { data } = await supabase
            .from('invoice_items')
            .select('products(name, sku, gst_rate), quantity, total_price')
            .limit(100);
          
          // Flatten data
          dataToExport = (data || []).map((item: any) => ({
            product_name: item.products?.name,
            sku: item.products?.sku,
            gst_rate: item.products?.gst_rate,
            quantity: item.quantity,
            total_value: item.total_price
          }));
        } else {
          // Mock data for others
          dataToExport = [{ report: reportName, status: 'Generated', date: new Date().toISOString() }];
        }
      } else if (type === 'itr') {
        // Fetch financial data to populate ITR forms
        const { data: invoices } = await supabase
          .from('invoices')
          .select('total')
          .eq('business_id', businessId);
          
        const { data: purchases } = await supabase
          .from('purchases')
          .select('total_amount')
          .eq('business_id', businessId);
          
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('business_id', businessId);

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
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${reportId.toUpperCase()}_${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setDownloadingReport(null);
        return; // Exit early since we handled the download
      } else if (type === 'eway') {
        const { data: invoices } = await supabase
          .from('invoices')
          .select('*, customers(*), invoice_items(*, products(*))')
          .eq('business_id', businessId);

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
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', `EWAY_BULK_${new Date().toISOString().split('T')[0]}.json`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          setDownloadingReport(null);
          return;
        } else if (reportId === 'eway_csv') {
          // Flatten items to match the Government Excel Utility format
          dataToExport = [];
          (invoices || []).forEach(inv => {
            const ewayData = (ewayBills || []).find(eb => eb.invoice_id === inv.id);
            if (!ewayData && !inv.eway_bill_no) return; // Skip invoices that don't have/need e-way bills
            
            const docDate = new Date(inv.date);
            const formattedDocDate = `${String(docDate.getDate()).padStart(2, '0')}/${String(docDate.getMonth() + 1).padStart(2, '0')}/${docDate.getFullYear()}`;
            
            const transDocDate = ewayData.transDocDate ? new Date(ewayData.transDocDate) : null;
            const formattedTransDocDate = transDocDate ? `${String(transDocDate.getDate()).padStart(2, '0')}/${String(transDocDate.getMonth() + 1).padStart(2, '0')}/${transDocDate.getFullYear()}` : '';

            (inv.invoice_items || []).forEach((item: any) => {
              const gstRate = item.products?.gst_rate || 0;
              const isInterState = inv.is_inter_state;

              dataToExport.push({
                'Supply Type': ewayData.supplyType || 'O',
                'Sub Supply Type': ewayData.subSupplyType || '1',
                'Document Type': 'INV',
                'Document No': inv.invoice_number,
                'Document Date': formattedDocDate,
                'Other Party GSTIN': inv.customers?.gstin || 'URP',
                'Other Party Name': inv.customers?.name || 'Walk-in',
                'Dispatch From / Ship To - Address 1': inv.customers?.address || '',
                'Dispatch From / Ship To - Address 2': '',
                'Dispatch From / Ship To - Place': inv.customers?.city || '',
                'Dispatch From / Ship To - Pincode': inv.customers?.pincode || '',
                'Dispatch From / Ship To - State': inv.customers?.state || '',
                'Product Name': item.products?.name || 'Product',
                'Description': item.products?.description || '',
                'HSN': item.products?.hsn_code || '',
                'Quantity': item.quantity,
                'Unit': 'NOS',
                'Taxable Value': item.total_price,
                'CGST Rate': !isInterState ? gstRate / 2 : 0,
                'SGST Rate': !isInterState ? gstRate / 2 : 0,
                'IGST Rate': isInterState ? gstRate : 0,
                'CESS Rate': 0,
                'Total Taxable Value': inv.subtotal || 0,
                'CGST Amount': inv.cgst_amount || 0,
                'SGST Amount': inv.sgst_amount || 0,
                'IGST Amount': inv.igst_amount || 0,
                'CESS Amount': 0,
                'Transporter ID': ewayData.transporterId || '',
                'Transporter Name': ewayData.transporterName || '',
                'Transporter Doc No': ewayData.transDocNo || '',
                'Transporter Doc Date': formattedTransDocDate,
                'Vehicle No': ewayData.vehicleNo || '',
                'Vehicle Type': ewayData.vehicleType || 'R',
                'Trans Mode': ewayData.transMode || '1',
                'Distance': ewayData.transDistance || '0'
              });
            });
          });
        }
      } else {
        dataToExport = [{ report: reportName, status: 'Generated', date: new Date().toISOString() }];
      }

      if (format === 'Excel') {
        generateProfitLossExcel({ totalSales: dataToExport.length }, { name: reportName });
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
      // Just download the first available report as a demo of "Export All"
      await handleDownloadReport(current.reports[0].id, current.reports[0].name, current.reports[0].format);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className={cn("p-4 rounded-2xl", current.bg, current.color)}>
            <current.icon size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{current.title}</h1>
            <p className="text-slate-500">{current.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 flex items-center">
            <Info size={18} className="mr-2" />
            Help Guide
          </button>
          {type === 'itr' && (
            <button 
              onClick={() => navigate('/itr-data-entry')}
              className="px-4 py-2 bg-white border border-primary/20 text-primary rounded-xl font-medium hover:bg-primary/5 flex items-center transition-colors"
            >
              <FileText size={18} className="mr-2" />
              Complete ITR Profile
            </button>
          )}
          <button className="btn-primary flex items-center" onClick={handleGenerateAll} disabled={isGenerating}>
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
            ) : (
              <Download size={18} className="mr-2" />
            )}
            Export All Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reports List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Available Reports</h3>
              <span className="text-xs font-bold text-slate-400 uppercase">FY 2025-26</span>
            </div>
            <div className="divide-y divide-slate-100">
              {current.reports.map((report, i) => (
                <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{report.name}</p>
                      <p className="text-xs text-slate-500">Format: {report.format}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <span className={cn(
                      "flex items-center text-[10px] font-bold uppercase px-2 py-1 rounded-lg",
                      report.status === 'Ready' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {report.status === 'Ready' ? <CheckCircle2 size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />}
                      {report.status}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleDownloadReport(report.id, report.name, report.format)}
                        disabled={downloadingReport === report.id}
                        className="text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                        title={`Download ${report.format}`}
                      >
                        {downloadingReport === report.id ? (
                          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                        ) : (
                          <Download size={20} />
                        )}
                      </button>
                      {type !== 'itr' && (
                        <button 
                          onClick={() => handleDownloadReport(report.id, report.name, 'Excel')}
                          disabled={downloadingReport === report.id}
                          className="text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                          title="Download Excel"
                        >
                          {downloadingReport === report.id ? (
                            <div className="w-5 h-5 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin"></div>
                          ) : (
                            <FileText size={20} />
                          )}
                        </button>
                      )}
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
                          className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"
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

          {/* External Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 flex items-center justify-between group cursor-pointer hover:border-primary transition-all">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                  <ExternalLink size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Government Portal</p>
                  <p className="text-xs text-slate-500">Direct login to official site</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div className="glass-card p-6 flex items-center justify-between group cursor-pointer hover:border-primary transition-all">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                  <Info size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Compliance Check</p>
                  <p className="text-xs text-slate-500">Verify your tax status</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
          {type === 'itr' && (
            <div className="glass-card p-6 border-primary/20 bg-primary/5">
              <h4 className="font-bold text-slate-900 mb-4 flex items-center">
                <Calculator size={18} className="mr-2 text-primary" />
                Tax Estimation (FY 25-26)
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
              <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center justify-between group">
                Update Tax Rates
                <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
              </button>
              <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center justify-between group">
                View HSN Codes
                <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
              </button>
              <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center justify-between group">
                Manage Branches
                <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
