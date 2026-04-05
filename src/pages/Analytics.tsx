import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  BrainCircuit, 
  TrendingUp, 
  Target, 
  Lightbulb, 
  MessageSquare, 
  Sparkles,
  ArrowRight,
  BarChart2,
  PieChart as PieChartIcon,
  TrendingDown,
  AlertCircle,
  Calculator,
  Receipt,
  FileCheck,
  Download,
  BarChart as BarChartIcon,
  Zap
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { GoogleGenAI } from '@google/genai';
import { cn, formatCurrency, getDateRange, FilterType } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import { DateFilter } from '../components/DateFilter';
import { generateProfitLossPDF } from '../lib/pdfGenerator';
import { generateProfitLossExcel } from '../lib/excelGenerator';

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

const predictionData = [
  { name: 'Mar', actual: 45000, predicted: 45000 },
  { name: 'Apr', actual: 52000, predicted: 51000 },
  { name: 'May', actual: 48000, predicted: 53000 },
  { name: 'Jun', actual: null, predicted: 58000 },
  { name: 'Jul', actual: null, predicted: 62000 },
  { name: 'Aug', actual: null, predicted: 65000 },
];

export default function Analytics() {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('thisMonth');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
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
  const businessName = profile?.business_profiles?.name || 'PHBKT Group';

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

      const currentMonth = new Date().getMonth();
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const monthIndex = (currentMonth - i + 12) % 12;
        last6Months.push(monthlyData[monthIndex]);
      }

      setSalesData(last6Months);
      
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

  const askAI = async () => {
    if (!query.trim()) return;
    setIsThinking(true);
    setAiResponse(null);

    try {
      const apiKey = profile?.business_profiles?.gemini_api_key || import.meta.env.VITE_GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      
      const retry = async (fn: () => Promise<any>, retries = 3, delay = 2000): Promise<any> => {
        try {
          return await fn();
        } catch (error: any) {
          const errorMsg = error.message || "";
          const isRateLimit = error.status === 429 || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429');
          if (retries <= 0 || !isRateLimit) throw error;
          console.warn(`AI Analytics rate limit exceeded, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return retry(fn, retries - 1, delay * 2);
        }
      };

      const response = await retry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `As a business advisor for ${businessName}, answer this query based on current business trends: ${query}`
      }));
      setAiResponse(response.text);
    } catch (error: any) {
      console.error("AI Analytics Error:", error);
      const errorMsg = error.message || "";
      if (error.status === 429 || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429')) {
        setAiResponse("The AI advisor is currently busy due to high demand. Please try again in a minute.");
      } else {
        setAiResponse("I'm sorry, I couldn't process that right now. Please try again.");
      }
    } finally {
      setIsThinking(false);
    }
  };

  const [scenario, setScenario] = useState({
    salesGrowth: 10,
    expenseChange: 5,
    priceAdjustment: 0
  });

  const projectedProfit = summary.totalSales * (1 + scenario.salesGrowth / 100) * (1 + scenario.priceAdjustment / 100) - (summary.totalPurchases + summary.totalExpenses) * (1 + scenario.expenseChange / 100);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-2 pt-2 relative"
    >
      <PageHeader 
        title={
          <>
            <BrainCircuit className="mr-2 text-primary" size={24} />
            Business Analytics & Insights
          </>
        }
        description="Leverage AI-driven insights and real-time data to understand your sales trends, customer behavior, and growth opportunities."
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
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
            <Sparkles className="text-primary" size={14} />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">AI Powered</span>
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-slate-50/30 border border-blue-200 border-l-[6px] border-l-blue-600 rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <TrendingUp size={14} />
                </div>
                <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">+12.5%</span>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Total Sales</p>
              <h3 className="text-base font-bold text-slate-900">{formatCurrency(summary.totalSales)}</h3>
            </div>
            
            <div className="bg-slate-50/30 border border-blue-200 border-l-[6px] border-l-orange-600 rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                  <BarChartIcon size={14} />
                </div>
                <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">+5.2%</span>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Total Purchases</p>
              <h3 className="text-base font-bold text-slate-900">{formatCurrency(summary.totalPurchases)}</h3>
            </div>

            <div className="bg-slate-50/30 border border-blue-200 border-l-[6px] border-l-red-600 rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                  <Receipt size={14} />
                </div>
                <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">+2.1%</span>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Total Expenses</p>
              <h3 className="text-base font-bold text-slate-900">{formatCurrency(summary.totalExpenses)}</h3>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-4">
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
                  <div key={index} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="text-slate-600 truncate max-w-[120px]">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-900">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Forecasting Section */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sales Forecasting (AI)</h3>
                <p className="text-[10px] text-slate-500">AI-predicted revenue for the next 3 months</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center text-[10px]">
                  <div className="w-2 h-2 bg-primary rounded-full mr-1.5"></div>
                  Actual
                </div>
                <div className="flex items-center text-[10px]">
                  <div className="w-2 h-2 bg-primary/30 rounded-full mr-1.5"></div>
                  Predicted
                </div>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={predictionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                  />
                  <Area type="monotone" dataKey="actual" stroke="#1e3a8a" strokeWidth={2} fill="#1e3a8a" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="predicted" stroke="#1e3a8a" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Advanced Feature: What-If Scenario Simulator */}
          <div className="glass-card p-6 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center">
                  <Zap className="mr-2 text-primary" size={20} />
                  What-If Scenario Simulator
                </h3>
                <p className="text-xs text-slate-500">Simulate business outcomes based on market changes</p>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-primary/10">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Projected Net Profit</p>
                <p className={cn("text-lg font-black", projectedProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {formatCurrency(projectedProfit)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">Sales Growth</label>
                  <span className="text-xs font-black text-primary">{scenario.salesGrowth}%</span>
                </div>
                <input 
                  type="range" 
                  min="-50" 
                  max="100" 
                  value={scenario.salesGrowth} 
                  onChange={(e) => setScenario({...scenario, salesGrowth: parseInt(e.target.value)})}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-[10px] text-slate-500">Projected increase in total sales volume</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">Expense Change</label>
                  <span className="text-xs font-black text-red-500">{scenario.expenseChange}%</span>
                </div>
                <input 
                  type="range" 
                  min="-20" 
                  max="50" 
                  value={scenario.expenseChange} 
                  onChange={(e) => setScenario({...scenario, expenseChange: parseInt(e.target.value)})}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <p className="text-[10px] text-slate-500">Change in operational and purchase costs</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">Price Adjustment</label>
                  <span className="text-xs font-black text-emerald-500">{scenario.priceAdjustment}%</span>
                </div>
                <input 
                  type="range" 
                  min="-10" 
                  max="30" 
                  value={scenario.priceAdjustment} 
                  onChange={(e) => setScenario({...scenario, priceAdjustment: parseInt(e.target.value)})}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <p className="text-[10px] text-slate-500">Average change in product selling prices</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-white/50 rounded-xl border border-primary/5 flex items-start space-x-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
                <BrainCircuit size={16} />
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                <span className="font-bold text-primary">AI Recommendation:</span> Based on your current overhead, a <span className="font-bold">5% price increase</span> combined with a <span className="font-bold">10% reduction in expenses</span> would yield a <span className="font-bold text-emerald-600">22% higher net profit</span> without significantly impacting sales volume.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass-card p-6 border-primary/20 bg-primary/5">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center">
              <Calculator size={18} className="mr-2 text-primary" />
              Financial Summary
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Gross Sales</span>
                <span className="font-bold text-slate-900">{formatCurrency(summary.totalSales)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Net Profit</span>
                <span className={cn("font-bold", summary.netProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {formatCurrency(summary.netProfit)}
                </span>
              </div>
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                <span className="font-bold text-slate-900">Profit Margin</span>
                <span className="text-xl font-bold text-primary">
                  {summary.totalSales > 0 ? ((summary.netProfit / summary.totalSales) * 100).toFixed(1) : '0'}%
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 bg-gradient-to-br from-primary to-blue-900 text-white">
            <div className="flex items-center justify-between mb-3">
              <Lightbulb size={18} className="text-yellow-400" />
              <span className="text-[8px] font-bold uppercase bg-white/10 px-1.5 py-0.5 rounded">AI Insight</span>
            </div>
            <h4 className="font-bold text-base mb-1.5">Inventory Optimization</h4>
            <p className="text-xs text-blue-100 leading-relaxed">
              AI suggests reducing stock for "Wireless Mouse" by 15% and increasing "4K Monitors" by 20% based on seasonal demand trends.
            </p>
            <button className="mt-3 flex items-center text-xs font-bold hover:underline h-10 sm:h-9">
              Apply Suggestion <ArrowRight size={14} className="ml-1.5" />
            </button>
          </div>

          <div className="glass-card p-6">
            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center">
              <Target size={16} className="mr-1.5 text-emerald-500" />
              Growth Targets
            </h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-500">Revenue Goal</span>
                  <span className="font-bold text-slate-900">75%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-3/4 rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-500">Customer Acquisition</span>
                  <span className="font-bold text-slate-900">42%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[42%] rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center">
              <TrendingUp size={18} className="mr-2 text-primary" />
              Growth Insights
            </h4>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Sales are up</p>
                  <p className="text-[10px] text-slate-500">12% increase from last month</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-600 flex-shrink-0">
                  <TrendingDown size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Expenses rising</p>
                  <p className="text-[10px] text-slate-500">2% increase in operational costs</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center">
              <AlertCircle size={18} className="mr-2 text-primary" />
              Quick Actions
            </h4>
            <div className="space-y-2">
              <Link to="/reports" className="w-full text-left px-4 h-10 sm:h-9 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center justify-between group">
                Download Reports
                <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
              </Link>
              <Link to="/ledger" className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center justify-between group">
                Download Ledger
                <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* AI Advisor Chat */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
            <MessageSquare size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">AI Business Advisor</h3>
            <p className="text-[10px] text-slate-500">Ask anything about your business performance</p>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="min-h-[160px] bg-slate-50 rounded-xl p-4 relative">
            {isThinking ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-xs font-medium text-slate-500">Consulting Gemini AI...</p>
              </div>
            ) : aiResponse ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="prose prose-slate max-w-none text-xs text-slate-700 leading-relaxed"
              >
                {aiResponse}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                <Sparkles className="text-slate-300" size={32} />
                <p className="text-slate-400 text-xs">Try asking: "How can I improve my profit margin this month?"</p>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <input 
              type="text" 
              placeholder="Type your business query here..."
              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askAI()}
            />
            <button 
              onClick={askAI}
              disabled={isThinking || !query.trim()}
              className="px-4 h-10 sm:h-9 bg-primary text-white rounded-lg text-xs font-bold flex items-center hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              Analyze
              <ArrowRight size={14} className="ml-1.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
