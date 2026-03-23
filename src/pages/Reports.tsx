import React, { useState, useEffect } from 'react';
import { BarChart as BarChartIcon, PieChart as PieChartIcon, TrendingUp, Download, Calendar, Filter, Receipt } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCurrency, getDateRange, FilterType } from '../lib/utils';
import PageHeader from '../components/PageHeader';
import { DateFilter } from '../components/DateFilter';
import { generateProfitLossPDF } from '../lib/pdfGenerator';
import { generateProfitLossExcel } from '../lib/excelGenerator';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

export default function Reports() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [filterType, setFilterType] = useState<FilterType>('thisMonth');
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [day, setDay] = useState<string>(getLocalToday());
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const [salesData, setSalesData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    netProfit: 0,
    invoiceCount: 0
  });

  const businessId = profile?.business_id;

  useEffect(() => {
    if (businessId) {
      fetchReportData();
    }
  }, [businessId, filterType, customRange, day, year]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);

      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, total, date')
        .eq('business_id', businessId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);
        
      const { data: purchases } = await supabase
        .from('purchases')
        .select('total_amount, date')
        .eq('business_id', businessId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, date')
        .eq('business_id', businessId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      const totalSales = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const totalPurchases = purchases?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const invoiceCount = invoices?.length || 0;
      
      // Aggregate real monthly data
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyData = months.map((month, index) => {
        const monthInvoices = invoices?.filter(inv => new Date(inv.date).getMonth() === index) || [];
        const monthPurchases = purchases?.filter(p => new Date(p.date).getMonth() === index) || [];
        const monthExpenses = expenses?.filter(e => new Date(e.date).getMonth() === index) || [];

        return {
          name: month,
          sales: monthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
          purchases: monthPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0),
          expenses: monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
        };
      });

      // Filter to show only months with data or the last 6 months
      const currentMonth = new Date().getMonth();
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const monthIndex = (currentMonth - i + 12) % 12;
        last6Months.push(monthlyData[monthIndex]);
      }

      setSalesData(last6Months);
      
      // Aggregate top products from invoices (this would require invoice_items)
      // For now, let's keep a more realistic mock or fetch items
      const { data: items } = await supabase
        .from('invoice_items')
        .select('product_name, total_price')
        .in('invoice_id', invoices?.map(inv => inv.id) || []);

      if (items && items.length > 0) {
        const productTotals: Record<string, number> = {};
        items.forEach(item => {
          productTotals[item.product_name] = (productTotals[item.product_name] || 0) + (item.total_price || 0);
        });
        const sortedProducts = Object.entries(productTotals)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        setProductData(sortedProducts);
      } else {
        setProductData([
          { name: 'No Data', value: 0 }
        ]);
      }

      setSummary({
        totalSales,
        totalPurchases,
        totalExpenses,
        netProfit: totalSales - totalPurchases - totalExpenses,
        invoiceCount
      });

    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Reports & Analytics" 
        description="Comprehensive insights into your business performance."
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
            onClick={() => generateProfitLossPDF(summary, profile?.business_profiles || { name: 'Business' })}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center shadow-sm"
          >
            <Download size={14} className="mr-1.5" />
            Export PDF
          </button>
          <button 
            onClick={() => generateProfitLossExcel(summary, profile?.business_profiles || { name: 'Business' })}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center shadow-sm"
          >
            <Download size={14} className="mr-1.5" />
            Export Excel
          </button>
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <TrendingUp size={16} />
            </div>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">+12.5%</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Total Sales</p>
          <h3 className="text-lg font-bold text-slate-900">{formatCurrency(summary.totalSales)}</h3>
        </div>
        
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <BarChartIcon size={16} />
            </div>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">+5.2%</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Total Purchases</p>
          <h3 className="text-lg font-bold text-slate-900">{formatCurrency(summary.totalPurchases)}</h3>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
              <Receipt size={16} />
            </div>
            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">+2.1%</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Total Expenses</p>
          <h3 className="text-lg font-bold text-slate-900">{formatCurrency(summary.totalExpenses)}</h3>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <PieChartIcon size={16} />
            </div>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">+18.1%</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Net Profit</p>
          <h3 className="text-lg font-bold text-slate-900">{formatCurrency(summary.netProfit)}</h3>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <BarChartIcon size={16} />
            </div>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">+2.4%</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Invoices Generated</p>
          <h3 className="text-lg font-bold text-slate-900">{summary.invoiceCount}</h3>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Sales vs Purchases</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                  formatter={(value: any) => formatCurrency(value)}
                />
                <Line type="monotone" dataKey="sales" stroke="#7c3aed" strokeWidth={2} dot={{r: 3, strokeWidth: 1.5}} activeDot={{r: 5}} />
                <Line type="monotone" dataKey="purchases" stroke="#f59e0b" strokeWidth={2} dot={{r: 3, strokeWidth: 1.5}} activeDot={{r: 5}} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={{r: 3, strokeWidth: 1.5}} activeDot={{r: 5}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Top Products</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {productData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {productData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
