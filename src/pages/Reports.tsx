import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Download, 
  Calculator,
  ArrowRight,
  Info,
  Package, 
  Users, 
  Zap,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getDateRange, FilterType, cn, downloadFile } from '../lib/utils';
import PageHeader from '../components/PageHeader';
import { DateFilter } from '../components/DateFilter';
import { generateGenericExcel } from '../lib/excelGenerator';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function Reports() {
  const { profile } = useAuth();
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  
  const [filterType, setFilterType] = useState<FilterType>('allTime');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [day, setDay] = useState<string>(getLocalToday());
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const businessId = profile?.business_id;

  const handleDownloadAdvancedReport = async (reportId: string, reportName: string) => {
    if (!businessId) return;
    setDownloadingReport(reportId);
    const { startDate, endDate } = getDateRange(filterType, day, year, customRange);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    try {
      let data: any[] = [];
      
      switch (reportId) {
        case 'invoice-report':
          const { data: invData } = await supabase
            .from('invoices')
            .select('invoice_number, date, customer_name, total, tax_amount, status')
            .eq('business_id', businessId)
            .gte('date', startStr)
            .lte('date', endStr);
          data = invData || [];
          break;
        
        case 'inventory-report':
          const { data: prodData } = await supabase
            .from('products')
            .select('name, sku, hsn_code, current_stock, sale_price, purchase_price, category')
            .eq('business_id', businessId);
          data = prodData || [];
          break;

        case 'expense-report':
          const { data: expData } = await supabase
            .from('expenses')
            .select('date, category, amount, description, payment_mode')
            .eq('business_id', businessId)
            .gte('date', startStr)
            .lte('date', endStr);
          data = expData || [];
          break;

        case 'sales-report':
          const { data: salesItems } = await supabase
            .from('invoice_items')
            .select('product_name, quantity, unit_price, total_price, invoices!inner(date, invoice_number)')
            .eq('invoices.business_id', businessId)
            .gte('invoices.date', startStr)
            .lte('invoices.date', endStr);
          data = (salesItems as any[])?.map(item => ({
            Date: item.invoices?.date,
            Invoice: item.invoices?.invoice_number,
            Product: item.product_name,
            Qty: item.quantity,
            Price: item.unit_price,
            Total: item.total_price
          })) || [];
          break;

        case 'customer-report':
          const { data: custData } = await supabase
            .from('customers')
            .select('name, email, phone, gstin, city, balance')
            .eq('business_id', businessId);
          data = custData || [];
          break;

        case 'supplier-report':
          const { data: suppData } = await supabase
            .from('suppliers')
            .select('name, email, phone, gstin, city, balance')
            .eq('business_id', businessId);
          data = suppData || [];
          break;

        case 'hsn-report':
          const { data: hsnItems } = await supabase
            .from('invoice_items')
            .select('product_name, hsn_code, quantity, total_price, tax_amount')
            .eq('invoices.business_id', businessId)
            .gte('invoices.date', startStr)
            .lte('invoices.date', endStr);
          
          const hsnMap: Record<string, any> = {};
          hsnItems?.forEach((item: any) => {
            const key = item.hsn_code || 'N/A';
            if (!hsnMap[key]) {
              hsnMap[key] = { HSN: key, Qty: 0, TaxableValue: 0, TaxAmount: 0 };
            }
            hsnMap[key].Qty += item.quantity;
            hsnMap[key].TaxableValue += (item.total_price - item.tax_amount);
            hsnMap[key].TaxAmount += item.tax_amount;
          });
          data = Object.values(hsnMap);
          break;

        case 'payment-summary':
          const { data: payData } = await supabase
            .from('payments')
            .select('amount, payment_mode, date, type')
            .eq('business_id', businessId)
            .gte('date', startStr)
            .lte('date', endStr);
          
          const payMap: Record<string, any> = {};
          payData?.forEach((p: any) => {
            const key = p.payment_mode || 'Other';
            if (!payMap[key]) {
              payMap[key] = { Mode: key, Inflow: 0, Outflow: 0 };
            }
            if (p.type === 'received') payMap[key].Inflow += p.amount;
            else payMap[key].Outflow += p.amount;
          });
          data = Object.values(payMap);
          break;

        case 'tax-liability':
          const { data: taxSales } = await supabase
            .from('invoices')
            .select('invoice_number, date, total, tax_amount')
            .eq('business_id', businessId)
            .gte('date', startStr)
            .lte('date', endStr);
          const { data: taxPurchases } = await supabase
            .from('purchases')
            .select('bill_number, date, total_amount, tax_amount')
            .eq('business_id', businessId)
            .gte('date', startStr)
            .lte('date', endStr);
          
          data = [
            ... (taxSales?.map(s => ({ Type: 'Output (Sales)', Ref: s.invoice_number, Date: s.date, Amount: s.total, Tax: s.tax_amount })) || []),
            ... (taxPurchases?.map(p => ({ Type: 'Input (Purchase)', Ref: p.bill_number, Date: p.date, Amount: p.total_amount, Tax: p.tax_amount })) || [])
          ];
          break;

        case 'profitability-report':
          const { data: profItems } = await supabase
            .from('invoice_items')
            .select('product_name, total_price, quantity, products(purchase_price)')
            .eq('invoices.business_id', businessId)
            .gte('invoices.date', startStr)
            .lte('invoices.date', endStr);
          
          const profMap: Record<string, any> = {};
          profItems?.forEach((item: any) => {
            const cost = (item.products?.purchase_price || 0) * item.quantity;
            const profit = item.total_price - cost;
            if (!profMap[item.product_name]) {
              profMap[item.product_name] = { Product: item.product_name, Sales: 0, Cost: 0, Profit: 0 };
            }
            profMap[item.product_name].Sales += item.total_price;
            profMap[item.product_name].Cost += cost;
            profMap[item.product_name].Profit += profit;
          });
          data = Object.values(profMap);
          break;

        case 'outstanding-receivables':
          const { data: unpaid } = await supabase
            .from('invoices')
            .select('invoice_number, date, customer_name, total, balance')
            .eq('business_id', businessId)
            .gt('balance', 0);
          data = unpaid || [];
          break;

        case 'cash-flow':
          const { data: cfInvoices } = await supabase
            .from('invoices')
            .select('date, total')
            .eq('business_id', businessId)
            .gte('date', startStr)
            .lte('date', endStr);
          const { data: cfPurchases } = await supabase
            .from('purchases')
            .select('date, total_amount')
            .eq('business_id', businessId)
            .gte('date', startStr)
            .lte('date', endStr);
          const { data: cfExpenses } = await supabase
            .from('expenses')
            .select('date, amount')
            .eq('business_id', businessId)
            .gte('date', startStr)
            .lte('date', endStr);
          
          const cfMap: Record<string, any> = {};
          cfInvoices?.forEach(i => {
            if (!cfMap[i.date]) cfMap[i.date] = { Date: i.date, Inflow: 0, Outflow: 0 };
            cfMap[i.date].Inflow += i.total;
          });
          cfPurchases?.forEach(p => {
            if (!cfMap[p.date]) cfMap[p.date] = { Date: p.date, Inflow: 0, Outflow: 0 };
            cfMap[p.date].Outflow += p.total_amount;
          });
          cfExpenses?.forEach(e => {
            if (!cfMap[e.date]) cfMap[e.date] = { Date: e.date, Inflow: 0, Outflow: 0 };
            cfMap[e.date].Outflow += e.amount;
          });
          data = Object.values(cfMap).sort((a, b) => a.Date.localeCompare(b.Date)).map(item => ({
            ...item,
            Net: item.Inflow - item.Outflow
          }));
          break;

        case 'audit-log':
          const { data: auditData } = await supabase
            .from('notifications')
            .select('created_at, title, message, type')
            .eq('created_by', profile?.id)
            .order('created_at', { ascending: false });
          data = auditData?.map(a => ({
            Timestamp: a.created_at,
            Event: a.title,
            Details: a.message,
            Type: a.type
          })) || [];
          break;

        default:
          toast.error("Report type not implemented yet");
          return;
      }

      let headers: string[] | undefined;
      switch (reportId) {
        case 'inventory-report': headers = ['name', 'sku', 'hsn_code', 'current_stock', 'sale_price', 'purchase_price', 'category']; break;
        case 'expense-report': headers = ['date', 'category', 'amount', 'description', 'payment_mode']; break;
        case 'sales-report': headers = ['Date', 'Invoice', 'Product', 'Qty', 'Price', 'Total']; break;
        case 'customer-report': headers = ['name', 'email', 'phone', 'gstin', 'city', 'balance']; break;
        case 'supplier-report': headers = ['name', 'email', 'phone', 'gstin', 'city', 'balance']; break;
        case 'hsn-report': headers = ['HSN', 'Qty', 'TaxableValue', 'TaxAmount']; break;
        case 'payment-summary': headers = ['Mode', 'Inflow', 'Outflow']; break;
        case 'tax-liability': headers = ['Type', 'Ref', 'Date', 'Amount', 'Tax']; break;
        case 'profitability-report': headers = ['Product', 'Sales', 'Cost', 'Profit']; break;
        case 'outstanding-receivables': headers = ['invoice_number', 'date', 'customer_name', 'total', 'balance']; break;
        case 'cash-flow': headers = ['Date', 'Inflow', 'Outflow', 'Net']; break;
        case 'audit-log': headers = ['Timestamp', 'Event', 'Details', 'Type']; break;
        case 'invoice-report': headers = ['invoice_number', 'date', 'customer_name', 'total', 'tax_amount', 'status']; break;
      }

      await generateGenericExcel(data, reportName, 'Report', headers);
      toast.success(`${reportName} downloaded successfully`);
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setDownloadingReport(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!businessId) return;
    setDownloadingReport('all');
    const { startDate, endDate } = getDateRange(filterType, day, year, customRange);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    try {
      const [
        { data: invoices },
        { data: products },
        { data: expenses },
        { data: customers },
        { data: suppliers },
        { data: purchases },
        { data: payments },
        { data: invoiceItems },
        { data: auditLogs }
      ] = await Promise.all([
        supabase.from('invoices').select('*').eq('business_id', businessId).gte('date', startStr).lte('date', endStr),
        supabase.from('products').select('*').eq('business_id', businessId),
        supabase.from('expenses').select('*').eq('business_id', businessId).gte('date', startStr).lte('date', endStr),
        supabase.from('customers').select('*').eq('business_id', businessId),
        supabase.from('suppliers').select('*').eq('business_id', businessId),
        supabase.from('purchases').select('*').eq('business_id', businessId).gte('date', startStr).lte('date', endStr),
        supabase.from('payments').select('*').eq('business_id', businessId).gte('date', startStr).lte('date', endStr),
        supabase.from('invoice_items').select('*, invoices!inner(business_id, date)').eq('invoices.business_id', businessId).gte('invoices.date', startStr).lte('invoices.date', endStr),
        supabase.from('notifications').select('*').eq('created_by', profile?.id)
      ]);

      const workbook = XLSX.utils.book_new();
      
      const appendSheet = (data: any[], sheetName: string, headers: string[]) => {
        const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      };

      appendSheet(invoices || [], 'Invoices', ['invoice_number', 'date', 'customer_name', 'total', 'tax_amount', 'status']);
      appendSheet(products || [], 'Products', ['name', 'sku', 'hsn_code', 'current_stock', 'sale_price', 'purchase_price', 'category']);
      appendSheet(expenses || [], 'Expenses', ['date', 'category', 'amount', 'description', 'payment_mode']);
      appendSheet(customers || [], 'Customers', ['name', 'email', 'phone', 'gstin', 'city', 'balance']);
      appendSheet(suppliers || [], 'Suppliers', ['name', 'email', 'phone', 'gstin', 'city', 'balance']);
      appendSheet(purchases || [], 'Purchases', ['bill_number', 'date', 'total_amount', 'tax_amount', 'status']);
      appendSheet(payments || [], 'Payments', ['amount', 'payment_mode', 'date', 'type']);
      appendSheet(invoiceItems || [], 'Invoice_Items', ['invoice_id', 'product_name', 'quantity', 'unit_price', 'total_price']);
      appendSheet(auditLogs || [], 'Audit_Trail', ['created_at', 'title', 'message', 'type']);

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await downloadFile(blob, `Consolidated_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Consolidated report downloaded successfully");
    } catch (error) {
      console.error("Error downloading all reports:", error);
      toast.error("Failed to download consolidated report");
    } finally {
      setDownloadingReport(null);
    }
  };

  const reportCategories = [
    {
      title: "Financial Reports",
      icon: <Calculator size={20} className="text-indigo-600" />,
      reports: [
        { id: 'invoice-report', name: 'Invoice Detailed Report', desc: 'Complete list of invoices with tax breakdown' },
        { id: 'sales-report', name: 'Sales Item-wise Report', desc: 'Detailed breakdown of items sold' },
        { id: 'expense-report', name: 'Expense Summary', desc: 'Categorized business expenses' },
        { id: 'tax-liability', name: 'Tax Liability Report', desc: 'GST Output vs Input tax summary' },
        { id: 'hsn-report', name: 'HSN-wise Summary', desc: 'GST HSN-wise sales aggregation' },
      ]
    },
    {
      title: "Inventory & Operations",
      icon: <Package size={20} className="text-emerald-600" />,
      reports: [
        { id: 'inventory-report', name: 'Inventory Valuation', desc: 'Current stock levels and asset value' },
        { id: 'profitability-report', name: 'Product Profitability', desc: 'Profit margin analysis by product' },
      ]
    },
    {
      title: "Party & Ledgers",
      icon: <Users size={20} className="text-blue-600" />,
      reports: [
        { id: 'customer-report', name: 'Customer Directory', desc: 'List of all customers and their balances' },
        { id: 'supplier-report', name: 'Supplier Directory', desc: 'List of all suppliers and their balances' },
        { id: 'outstanding-receivables', name: 'Outstanding Receivables', desc: 'Aging report for unpaid invoices' },
        { id: 'ledger-report', name: 'General Ledger', desc: 'Consolidated account statements', link: '/ledger' },
      ]
    },
    {
      title: "Advanced Analytics",
      icon: <Zap size={20} className="text-amber-600" />,
      reports: [
        { id: 'payment-summary', name: 'Payment Mode Analysis', desc: 'Summary of cash, online, and credit inflows' },
        { id: 'cash-flow', name: 'Cash Flow Forecast', desc: 'Projected cash movements based on invoices and expenses' },
        { id: 'audit-log', name: 'Audit Trail', desc: 'History of business notifications and events' },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet size={24} />
            </div>
            <span>Business Reports</span>
          </div>
        }
        description="Download comprehensive business reports for accounting, inventory, and tax compliance."
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
          />
        }
      >
        <button 
          onClick={handleDownloadAll}
          disabled={downloadingReport === 'all'}
          className="btn-primary h-10 sm:h-9"
        >
          {downloadingReport === 'all' ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <Download size={14} className="mr-1.5" />
              Download All Data
            </>
          )}
        </button>
      </PageHeader>

      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Report Repository</h2>
            <p className="text-xs text-slate-500 mt-1">Select a report to download in Excel format</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportCategories.map((category, idx) => (
            <div key={idx} className="glass-card overflow-hidden border-slate-200/60">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                  {category.icon}
                </div>
                <h3 className="font-bold text-slate-900">{category.title}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {category.reports.map((report) => (
                  <div key={report.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{report.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{report.desc}</p>
                    </div>
                    {report.link ? (
                      <Link 
                        to={report.link}
                        className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary transition-all shadow-sm"
                      >
                        <ArrowRight size={16} />
                      </Link>
                    ) : (
                      <button 
                        onClick={() => handleDownloadAdvancedReport(report.id, report.name)}
                        disabled={downloadingReport === report.id}
                        className={cn(
                          "w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center transition-all shadow-sm text-slate-400 hover:text-primary hover:border-primary"
                        )}
                      >
                        {downloadingReport === report.id ? (
                          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it Works Section */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
          <Info size={24} className="mr-2 text-primary" />
          How Business Reporting Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 border-slate-100 hover:border-primary/20 transition-all">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
              <span className="font-bold">01</span>
            </div>
            <h4 className="font-bold text-slate-900 mb-2">Data Aggregation</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              We automatically pull data from your invoices, purchases, and expenses to build a complete picture.
            </p>
          </div>
          <div className="glass-card p-6 border-slate-100 hover:border-primary/20 transition-all">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4">
              <span className="font-bold">02</span>
            </div>
            <h4 className="font-bold text-slate-900 mb-2">Visual Analysis</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              Charts and summaries help you visualize trends and identify areas for growth or cost-cutting.
            </p>
          </div>
          <div className="glass-card p-6 border-slate-100 hover:border-primary/20 transition-all">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
              <span className="font-bold">03</span>
            </div>
            <h4 className="font-bold text-slate-900 mb-2">Export & Share</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              Export your financial summaries to PDF or Excel to share with stakeholders or for your records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
