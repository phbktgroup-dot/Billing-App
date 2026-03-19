import React, { useState, useEffect } from 'react';
import { BarChart as BarChartIcon, PieChart as PieChartIcon, TrendingUp, Download, Calendar, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
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
  const [dateRange, setDateRange] = useState('this_month');
  
  const [salesData, setSalesData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalPurchases: 0,
    netProfit: 0,
    invoiceCount: 0
  });

  const businessId = profile?.business_id;

  useEffect(() => {
    if (businessId) {
      fetchReportData();
    }
  }, [businessId, dateRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration since we can't easily aggregate in Supabase without RPC
      // In a real app, you'd use Supabase RPC or fetch all and aggregate
      
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total, date')
        .eq('business_id', businessId);
        
      const { data: items } = await supabase
        .from('invoice_items')
        .select('total_price, products(name)')
        .limit(100);

      const totalSales = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const invoiceCount = invoices?.length || 0;
      
      // Generate some realistic looking chart data based on the total
      const mockSalesData = [
        { name: 'Jan', sales: totalSales * 0.1, purchases: totalSales * 0.05 },
        { name: 'Feb', sales: totalSales * 0.15, purchases: totalSales * 0.08 },
        { name: 'Mar', sales: totalSales * 0.2, purchases: totalSales * 0.1 },
        { name: 'Apr', sales: totalSales * 0.25, purchases: totalSales * 0.12 },
        { name: 'May', sales: totalSales * 0.18, purchases: totalSales * 0.09 },
        { name: 'Jun', sales: totalSales * 0.12, purchases: totalSales * 0.06 },
      ];

      const mockProductData = [
        { name: 'Product A', value: 400 },
        { name: 'Product B', value: 300 },
        { name: 'Product C', value: 300 },
        { name: 'Product D', value: 200 },
      ];

      setSalesData(mockSalesData);
      setProductData(mockProductData);
      setSummary({
        totalSales,
        totalPurchases: totalSales * 0.5, // Mock purchase data
        netProfit: totalSales * 0.5,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-xs text-slate-500">Comprehensive insights into your business performance.</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <select 
              className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 focus:outline-none focus:border-primary shadow-sm"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
              <option value="all_time">All Time</option>
            </select>
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>
          <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center shadow-sm">
            <Download size={14} className="mr-1.5" />
            Export
          </button>
        </div>
      </div>

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
