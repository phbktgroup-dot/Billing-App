import React, { useState, useEffect, useMemo } from 'react';
import { Download, FileText, PieChart, Table as TableIcon, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import PageHeader from '../components/PageHeader';
import { DateFilter } from '../components/DateFilter';
import { FilterType, cn, formatCurrency, getDateRange } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type GSTReportType = 'GSTR-1' | 'GSTR-3B' | 'GSTR-2A';

export default function GSTReports() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<GSTReportType>('GSTR-1');
  const [filterType, setFilterType] = useState<FilterType>('thisMonth');
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [day, setDay] = useState<string>(getLocalToday());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);

  const businessId = profile?.business_id;

  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId, filterType, customRange, day, year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);

      // Fetch Invoices with items and customer details
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (*),
          invoice_items (
            *,
            products (*)
          )
        `)
        .eq('business_id', businessId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (invError) throw invError;
      setInvoices(invData || []);

      // Fetch Purchases (Expenses/Purchases)
      const { data: purData, error: purError } = await supabase
        .from('purchases')
        .select(`
          *,
          suppliers (*),
          purchase_items (
            *,
            products (*)
          )
        `)
        .eq('business_id', businessId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (purError) throw purError;
      setPurchases(purData || []);

    } catch (error: any) {
      console.error('Error fetching GST data:', error);
    } finally {
      setLoading(false);
    }
  };

  const gstr1Data = useMemo(() => {
    const b2b = invoices.filter(inv => inv.customers?.gstin);
    const b2c = invoices.filter(inv => !inv.customers?.gstin);
    
    // B2CL: Inter-state, value > 2,50,000
    const b2cl = b2c.filter(inv => {
      const isInterState = inv.customers?.state && inv.customers?.state !== profile?.state;
      return isInterState && inv.total > 250000;
    });

    // B2CS: All other B2C
    const b2cs = b2c.filter(inv => !b2cl.includes(inv));

    // HSN Summary
    const hsnMap = new Map();
    invoices.forEach(inv => {
      inv.invoice_items?.forEach((item: any) => {
        const hsn = item.products?.hsn_code || 'NA';
        const rate = item.gst_rate || 0;
        const key = `${hsn}-${rate}`;
        
        if (!hsnMap.has(key)) {
          hsnMap.set(key, {
            hsn,
            description: item.products?.name || '',
            uqc: 'NOS-Numbers',
            totalQuantity: 0,
            totalValue: 0,
            rate,
            taxableValue: 0,
            integratedTax: 0,
            centralTax: 0,
            stateTax: 0,
            cess: 0
          });
        }
        
        const entry = hsnMap.get(key);
        entry.totalQuantity += item.quantity || 0;
        entry.totalValue += item.amount || 0;
        entry.taxableValue += (item.unit_price * item.quantity) || 0;
        
        const tax = (item.unit_price * item.quantity * rate) / 100;
        const isInterState = inv.customers?.state && inv.customers?.state !== profile?.state;
        
        if (isInterState) {
          entry.integratedTax += tax;
        } else {
          entry.centralTax += tax / 2;
          entry.stateTax += tax / 2;
        }
      });
    });

    return {
      b2b,
      b2cl,
      b2cs,
      hsn: Array.from(hsnMap.values())
    };
  }, [invoices, profile]);

  const getGSTR1Workbook = () => {
    const workbook = XLSX.utils.book_new();

    // B2B Sheet
    const b2bRows = gstr1Data.b2b.map(inv => ({
      'GSTIN/UIN of Recipient': inv.customers?.gstin,
      'Receiver Name': inv.customers?.name,
      'Invoice Number': inv.invoice_number,
      'Invoice date': inv.date,
      'Invoice Value': inv.total,
      'Place Of Supply': inv.customers?.state || '27-Maharashtra',
      'Reverse Charge': 'N',
      'Applicable % of Tax Rate': 0,
      'Invoice Type': 'Regular B2B',
      'E-Commerce GSTIN': '',
      'Rate': inv.invoice_items?.[0]?.gst_rate || 0,
      'Taxable Value': inv.subtotal,
      'Cess Amount': 0
    }));
    const b2bWS = XLSX.utils.json_to_sheet(b2bRows);
    XLSX.utils.book_append_sheet(workbook, b2bWS, 'B2B');

    // B2CL Sheet
    const b2clRows = gstr1Data.b2cl.map(inv => ({
      'Invoice Number': inv.invoice_number,
      'Invoice date': inv.date,
      'Invoice Value': inv.total,
      'Place Of Supply': inv.customers?.state || '27-Maharashtra',
      'Applicable % of Tax Rate': 0,
      'Rate': inv.invoice_items?.[0]?.gst_rate || 0,
      'Taxable Value': inv.subtotal,
      'Cess Amount': 0,
      'E-Commerce GSTIN': ''
    }));
    const b2clWS = XLSX.utils.json_to_sheet(b2clRows);
    XLSX.utils.book_append_sheet(workbook, b2clWS, 'B2CL');

    // B2CS Sheet
    const b2csRows = gstr1Data.b2cs.map(inv => ({
      'Type': 'OE',
      'Place Of Supply': inv.customers?.state || '27-Maharashtra',
      'Applicable % of Tax Rate': 0,
      'Rate': inv.invoice_items?.[0]?.gst_rate || 0,
      'Taxable Value': inv.subtotal,
      'Cess Amount': 0,
      'E-Commerce GSTIN': ''
    }));
    const b2csWS = XLSX.utils.json_to_sheet(b2csRows);
    XLSX.utils.book_append_sheet(workbook, b2csWS, 'B2CS');

    // HSN Sheet
    const hsnRows = gstr1Data.hsn.map(item => ({
      'HSN': item.hsn,
      'Description': item.description,
      'UQC': item.uqc,
      'Total Quantity': item.totalQuantity,
      'Total Value': item.totalValue,
      'Rate': item.rate,
      'Taxable Value': item.taxableValue,
      'Integrated Tax Amount': item.integratedTax,
      'Central Tax Amount': item.centralTax,
      'State/UT Tax Amount': item.stateTax,
      'Cess Amount': item.cess
    }));
    const hsnWS = XLSX.utils.json_to_sheet(hsnRows);
    XLSX.utils.book_append_sheet(workbook, hsnWS, 'HSN');

    // Doc Summary Sheet
    const docRows = [
      { 
        'Nature of Document': 'Invoices for outward supply', 
        'Sr. No. From': invoices.length > 0 ? invoices[invoices.length - 1].invoice_number : 'NA', 
        'Sr. No. To': invoices.length > 0 ? invoices[0].invoice_number : 'NA', 
        'Total Number': invoices.length, 
        'Cancelled': 0 
      }
    ];
    const docWS = XLSX.utils.json_to_sheet(docRows);
    XLSX.utils.book_append_sheet(workbook, docWS, 'Docs');

    return workbook;
  };

  const exportGSTR1 = () => {
    const workbook = getGSTR1Workbook();
    XLSX.writeFile(workbook, `GSTR1_${filterType}_${day}.xlsx`);
  };

  const getGSTR3BWorkbook = () => {
    const workbook = XLSX.utils.book_new();
    const outwardTaxable = invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const outwardTax = invoices.reduce((sum, inv) => sum + (inv.tax_amount || 0), 0);
    const inwardTaxable = purchases.reduce((sum, pur) => sum + (pur.subtotal || 0), 0);
    const inwardTax = purchases.reduce((sum, pur) => sum + (pur.tax_amount || 0), 0);

    const summaryRows = [
      { 'Section': '3.1 Outward Supplies', 'Taxable Value': outwardTaxable, 'Integrated Tax': 0, 'Central Tax': outwardTax/2, 'State Tax': outwardTax/2, 'Cess': 0 },
      { 'Section': '4. Eligible ITC', 'Taxable Value': inwardTaxable, 'Integrated Tax': 0, 'Central Tax': inwardTax/2, 'State Tax': inwardTax/2, 'Cess': 0 },
      { 'Section': 'Net Payable', 'Taxable Value': '', 'Integrated Tax': 0, 'Central Tax': (outwardTax - inwardTax)/2, 'State Tax': (outwardTax - inwardTax)/2, 'Cess': 0 }
    ];

    const ws = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, ws, 'GSTR-3B Summary');
    return workbook;
  };

  const exportGSTR3B = () => {
    const workbook = getGSTR3BWorkbook();
    XLSX.writeFile(workbook, `GSTR3B_${filterType}_${day}.xlsx`);
  };

  const getGSTR2AWorkbook = () => {
    const workbook = XLSX.utils.book_new();
    const b2bRows = purchases.map(pur => ({
      'GSTIN of Supplier': pur.suppliers?.gstin,
      'Supplier Name': pur.suppliers?.name,
      'Invoice Number': pur.invoice_number,
      'Invoice Date': pur.date,
      'Invoice Value': pur.total,
      'Taxable Value': pur.subtotal,
      'Integrated Tax': 0,
      'Central Tax': pur.tax_amount / 2,
      'State Tax': pur.tax_amount / 2,
      'Cess': 0,
      'ITC Available': 'Y'
    }));

    const ws = XLSX.utils.json_to_sheet(b2bRows);
    XLSX.utils.book_append_sheet(workbook, ws, 'B2B Purchases');
    return workbook;
  };

  const exportGSTR2A = () => {
    const workbook = getGSTR2AWorkbook();
    XLSX.writeFile(workbook, `GSTR2A_${filterType}_${day}.xlsx`);
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    
    // GSTR-1
    const wb1 = getGSTR1Workbook();
    const out1 = XLSX.write(wb1, { type: 'array', bookType: 'xlsx' });
    zip.file(`GSTR1_${filterType}_${day}.xlsx`, out1);

    // GSTR-3B
    const wb3 = getGSTR3BWorkbook();
    const out3 = XLSX.write(wb3, { type: 'array', bookType: 'xlsx' });
    zip.file(`GSTR3B_${filterType}_${day}.xlsx`, out3);

    // GSTR-2A
    const wb2 = getGSTR2AWorkbook();
    const out2 = XLSX.write(wb2, { type: 'array', bookType: 'xlsx' });
    zip.file(`GSTR2A_${filterType}_${day}.xlsx`, out2);

    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GST_Reports_${filterType}_${day}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const renderGSTR1Analysis = () => {
    const totalTaxable = invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const totalTax = invoices.reduce((sum, inv) => sum + (inv.tax_amount || 0), 0);
    const b2bCount = gstr1Data.b2b.length;
    const b2cCount = (gstr1Data.b2cl?.length || 0) + (gstr1Data.b2cs?.length || 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Taxable Value</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(totalTaxable)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Tax (Output)</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(totalTax)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">B2B Invoices</p>
            <p className="text-lg font-bold text-slate-900">{b2bCount}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">B2C Invoices</p>
            <p className="text-lg font-bold text-slate-900">{b2cCount}</p>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">B2B Invoices Summary</h3>
            <button 
              onClick={exportGSTR1}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-bold flex items-center hover:bg-primary/90 transition-all"
            >
              <Download size={12} className="mr-1.5" />
              Download GSTR-1 Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Taxable Value</th>
                  <th className="px-4 py-3">Tax Amount</th>
                  <th className="px-4 py-3">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gstr1Data.b2b.map((inv, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium">{inv.customers?.gstin}</td>
                    <td className="px-4 py-3">{inv.invoice_number}</td>
                    <td className="px-4 py-3">{new Date(inv.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{formatCurrency(inv.subtotal)}</td>
                    <td className="px-4 py-3">{formatCurrency(inv.tax_amount)}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(inv.total)}</td>
                  </tr>
                ))}
                {gstr1Data.b2b.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                      No B2B invoices found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderGSTR3B = () => {
    const outwardTaxable = invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const outwardTax = invoices.reduce((sum, inv) => sum + (inv.tax_amount || 0), 0);
    const inwardTaxable = purchases.reduce((sum, pur) => sum + (pur.subtotal || 0), 0);
    const inwardTax = purchases.reduce((sum, pur) => sum + (pur.tax_amount || 0), 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-6">
            <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center">
              <FileText size={14} className="mr-2 text-primary" />
              3.1 Details of Outward Supplies
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Total Taxable Value</span>
                <span className="font-bold">{formatCurrency(outwardTaxable)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Total Output Tax</span>
                <span className="font-bold text-red-600">{formatCurrency(outwardTax)}</span>
              </div>
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center">
              <CheckCircle2 size={14} className="mr-2 text-emerald-500" />
              4. Eligible ITC
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Total Inward Taxable Value</span>
                <span className="font-bold">{formatCurrency(inwardTaxable)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Total Input Tax Credit (ITC)</span>
                <span className="font-bold text-emerald-600">{formatCurrency(inwardTax)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 bg-slate-900 text-white">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Net GST Payable / (Credit)</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(outwardTax - inwardTax)}
              </p>
            </div>
            <button 
              onClick={exportGSTR3B}
              className="px-4 py-2 bg-white text-slate-900 rounded-xl text-[11px] font-bold hover:bg-slate-100 transition-all flex items-center"
            >
              <Download size={14} className="mr-2" />
              Download GSTR-3B Summary
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGSTR2A = () => {
    return (
      <div className="space-y-6">
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">GSTR-2A Auto-populated Data (Purchases)</h3>
            <button 
              onClick={exportGSTR2A}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-bold flex items-center hover:bg-primary/90 transition-all"
            >
              <Download size={12} className="mr-1.5" />
              Download GSTR-2A Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">Supplier GSTIN</th>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Taxable Value</th>
                  <th className="px-4 py-3">ITC Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((pur, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium">{pur.suppliers?.gstin}</td>
                    <td className="px-4 py-3">{pur.suppliers?.name}</td>
                    <td className="px-4 py-3">{pur.invoice_number}</td>
                    <td className="px-4 py-3">{new Date(pur.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{formatCurrency(pur.subtotal)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{formatCurrency(pur.tax_amount)}</td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                      No purchase records found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="GST Compliance Reports" 
        description="Generate and download GSTR-1, GSTR-3B, and GSTR-2A reports for filing."
      >
        <div className="flex items-center space-x-3">
          <button 
            onClick={downloadAllAsZip}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-slate-800 transition-all flex items-center shadow-lg shadow-slate-200"
          >
            <Download size={14} className="mr-2" />
            Download All Reports (ZIP)
          </button>
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
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['GSTR-1', 'GSTR-3B', 'GSTR-2A'] as GSTReportType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-lg text-[11px] font-bold transition-all",
              activeTab === tab 
                ? "bg-white text-primary shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-slate-500 text-xs font-medium">Generating report data...</p>
        </div>
      ) : (
        <>
          {activeTab === 'GSTR-1' && renderGSTR1Analysis()}
          {activeTab === 'GSTR-3B' && renderGSTR3B()}
          {activeTab === 'GSTR-2A' && renderGSTR2A()}
        </>
      )}
    </div>
  );
}
