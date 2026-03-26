import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ScanOptionsModal from '../components/ScanOptionsModal';
import { DateFilter } from '../components/DateFilter';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search,
  MessageSquare,
  Play,
  History,
  Lightbulb,
  TrendingUp, 
  Users, 
  Package, 
  IndianRupee, 
  ArrowUpRight, 
  ArrowDownRight,
  Calendar,
  Loader2,
  FileText,
  Plus,
  Scan,
  X,
  Camera,
  Upload,
  Zap,
  Target,
  Activity,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  ArrowRight,
  BarChart3,
  ArrowDownLeft,
  Truck,
  ShoppingCart
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { cn, formatCurrency, formatCompactCurrency, getDateRange, FilterType } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeInvoices: 0,
    totalCustomers: 0,
    lowStockItems: 0,
    paidInvoicesCount: 0,
    unpaidInvoicesCount: 0,
    paidAmount: 0,
    unpaidAmount: 0
  });
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<any[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [businessSummary, setBusinessSummary] = useState<any>(null);
  const [simulationInput, setSimulationInput] = useState({ priceChange: 0, volumeChange: 0 });
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [proactiveActions, setProactiveActions] = useState<any[]>([]);
  const [showSimulator, setShowSimulator] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('thisMonth');
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({start: '', end: ''});
  
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  
  const [day, setDay] = useState<string>(getLocalToday());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rawData, setRawData] = useState<{invoices: any[], purchases: any[], customers: any[], suppliers: any[], products: any[]}>({invoices: [], purchases: [], customers: [], suppliers: [], products: []});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const businessId = profile?.business_id;
  console.log('Dashboard businessId:', businessId, 'Profile:', profile);

  const healthScore = businessSummary?.businessHealth.score || 0;
  const gaugeData = [
    { name: 'Score', value: healthScore, fill: healthScore > 70 ? '#10b981' : healthScore > 40 ? '#f59e0b' : '#ef4444' },
    { name: 'Remaining', value: 100 - healthScore, fill: '#e2e8f0' }
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Data = reader.result as string;
        navigate('/invoices/new', { state: { scannedFile: base64Data, fileType: file.type } });
      };
    }
    setShowScanOptions(false);
  };

  useEffect(() => {
    if (businessId) {
      fetchDashboardData();
    }
  }, [businessId, profile?.business_profiles?.gemini_api_key, filterType, customRange, day, year]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (!businessId) {
        setLoading(false);
        return;
      }

      // 1. Fetch Raw Data
      const [
        { data: invoices, error: invError },
        { count: customerCount, error: custError },
        { data: products, error: stockError },
        { data: purchases, error: purError },
        { data: suppliers, error: supError },
        { data: expensesData, error: expError }
      ] = await Promise.all([
        supabase.from('invoices').select('*, customers(name)').eq('business_id', businessId),
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('products').select('id, stock, min_stock').eq('business_id', businessId),
        supabase.from('purchases').select('*, suppliers(name)').eq('business_id', businessId).order('date', { ascending: false }),
        supabase.from('suppliers').select('*').eq('business_id', businessId),
        supabase.from('expenses').select('*').eq('business_id', businessId)
      ]);

      // Fallback logic
      let invoicesData = invoices || [];
      if (invError) invoicesData = JSON.parse(localStorage.getItem(`invoices_${businessId}`) || '[]');
      
      let purchasesData = purchases || [];
      if (purError) purchasesData = JSON.parse(localStorage.getItem(`purchases_${businessId}`) || '[]');

      let productsData = products || [];
      if (stockError) productsData = JSON.parse(localStorage.getItem(`products_${businessId}`) || '[]');

      let suppliersData = suppliers || [];
      if (supError) suppliersData = JSON.parse(localStorage.getItem(`suppliers_${businessId}`) || '[]');

      setRawData({
        invoices: invoicesData,
        purchases: purchasesData,
        customers: [], // Not fully fetched here, just count
        suppliers: suppliersData,
        products: productsData
      });

      // 2. Apply Filters
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);

      const filteredInvoices = invoicesData.filter(inv => {
        const date = new Date(inv.created_at);
        return date >= startDate && date <= endDate;
      });

      const filteredPurchases = purchasesData.filter(p => {
        const pDate = new Date(p.date);
        // Reset times for date-only comparison
        const d = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
        const s = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const e = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        return d >= s && d <= e;
      });

      const filteredExpenses = (expensesData || []).filter(exp => {
        const eDate = new Date(exp.date);
        const d = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate());
        const s = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        return d >= s && d <= end;
      });

      // 3. Calculate Stats
      const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total), 0) || 0;
      
      const paidInvoices = filteredInvoices.filter(inv => inv.status === 'paid') || [];
      const unpaidInvoices = filteredInvoices.filter(inv => inv.status !== 'paid') || [];
      
      const paidAmount = paidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
      const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);

      // Calculate Total Expenses (Purchases + Direct Expenses)
      const totalPurchasesAmount = filteredPurchases.reduce((sum, p) => sum + Number(p.total_amount), 0) || 0;
      const totalDirectExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const totalExpenses = totalPurchasesAmount + totalDirectExpenses;

      setStats({
        totalRevenue,
        activeInvoices: filteredInvoices.length || 0,
        totalCustomers: customerCount || 0, // Should this be filtered too?
        lowStockItems: productsData.filter((p: any) => p.stock <= p.min_stock).length || 0,
        paidInvoicesCount: paidInvoices.length,
        unpaidInvoicesCount: unpaidInvoices.length,
        paidAmount,
        unpaidAmount
      });

      // Calculate Business Summary
      const revenue = paidAmount;
      const expenses = totalExpenses;
      
      const netProfit = revenue - expenses;
      
      // Customer growth (mocked as we don't have historical customer count easily without more queries)
      const newCustomers = filteredInvoices.length > 0 ? Math.floor(filteredInvoices.length * 0.2) : 0;
      const customerGrowth = 12.5; // Mocked
      
      // Health Score Calculation
      let healthScore = 0;
      if (revenue > 0) healthScore += 30;
      if (netProfit > 0) healthScore += 20;
      if (unpaidAmount < revenue * 0.3) healthScore += 20;
      if (productsData.filter((p: any) => p.stock <= p.min_stock).length === 0) healthScore += 15;
      if (customerCount && customerCount > 10) healthScore += 15;

      const healthStatus = healthScore > 80 ? 'Excellent' : healthScore > 60 ? 'Good' : healthScore > 40 ? 'Fair' : 'Critical';

      // Radar Data
      const radarData = [
        { subject: 'Revenue', A: Math.min(100, (revenue / 500000) * 100), fullMark: 100 },
        { subject: 'Profit', A: Math.min(100, (netProfit / 100000) * 100), fullMark: 100 },
        { subject: 'Customers', A: Math.min(100, (customerCount || 1) / 50 * 100), fullMark: 100 },
        { subject: 'Cash Flow', A: Math.min(100, ((revenue - expenses) / 50000) * 100), fullMark: 100 },
        { subject: 'Inventory', A: (productsData.filter((p: any) => p.stock <= p.min_stock).length === 0) ? 100 : 60, fullMark: 100 },
        { subject: 'Efficiency', A: healthScore, fullMark: 100 },
      ];

      const summary = {
        profitAndLoss: { 
          revenue, 
          expenses, 
          netProfit, 
          change: 0, // Need historical data for change
          sparkline: [], // Need historical data for sparkline
          grossMargin: revenue * 0.42,
          grossMarginPercent: 42,
          ebitda: netProfit * 1.15,
          operatingMargin: revenue > 0 ? (netProfit / revenue * 100) : 0
        },
        cashFlow: { 
          inflow: revenue, 
          outflow: expenses, 
          netCashFlow: revenue - expenses,
          change: 0, // Need historical data
          sparkline: [], // Need historical data
          dso: 32, // Days Sales Outstanding
          dpo: 28, // Days Payable Outstanding
          fcf: (revenue - expenses) * 0.85 // Free Cash Flow
        },
        customerFlow: { 
          total: customerCount || 0, 
          newThisMonth: newCustomers, 
          growth: customerGrowth,
          change: 0, // Need historical data
          sparkline: [], // Need historical data
          ltv: revenue > 0 ? (revenue / (customerCount || 1) * 4.5) : 0,
          cac: newCustomers > 0 ? (expenses * 0.15 / newCustomers) : 0,
          churnRate: 2.1
        },
        businessHealth: { 
          score: healthScore, 
          status: healthStatus,
          radarData,
          factors: [
            { label: "Revenue Stream", value: revenue > 0 ? 100 : 0, status: revenue > 0 ? 'positive' : 'negative' },
            { label: "Profitability", value: netProfit > 0 ? 100 : 0, status: netProfit > 0 ? 'positive' : 'negative' },
            { label: "Receivables", value: unpaidAmount < revenue * 0.3 ? 100 : 40, status: unpaidAmount < revenue * 0.3 ? 'positive' : 'warning' },
            { label: "Inventory", value: (productsData.filter((p: any) => p.stock <= p.min_stock).length === 0) ? 100 : 60, status: (productsData.filter((p: any) => p.stock <= p.min_stock).length === 0) ? 'positive' : 'warning' }
          ]
        },
        breakEven: {
          fixedCosts: expenses * 0.65,
          variableCosts: expenses * 0.35,
          variableCostRatio: 0.35,
          breakEvenPoint: (expenses * 0.65) / (1 - 0.35),
          currentProgress: revenue > 0 ? (revenue / ((expenses * 0.65) / (1 - 0.35)) * 100) : 0,
          daysToBreakEven: 14
        },
        runway: {
          burnRate: expenses,
          cashOnHand: (revenue - expenses) + 500000, // Mocked base cash
          monthsRemaining: ((revenue - expenses) + 500000) / (expenses || 1),
          burnTrend: 'decreasing'
        },
        inventory: {
          lowStockCount: productsData.filter((p: any) => p.stock <= p.min_stock).length,
          totalStockValue: (revenue * 0.35) + 125000,
          turnoverRate: 4.2,
          stockHealth: (productsData.filter((p: any) => p.stock <= p.min_stock).length > 5) ? 'Warning' : 'Healthy'
        },
        supplyChain: {
          activeSuppliers: suppliersData.length,
          reliabilityScore: suppliersData.length > 0 ? 94 : 0,
          pendingPurchases: filteredPurchases.filter(p => p.status === 'pending').length,
          avgLeadTime: suppliersData.length > 0 ? 5.2 : 0 // Days
        },
        ownerVisibility: {
          estimatedTax: netProfit > 0 ? netProfit * 0.22 : 0,
          dividendCapacity: (revenue - expenses) > 0 ? (revenue - expenses) * 0.45 : 0,
          ownerEquity: ((revenue - expenses) + 500000) * 1.5 + 250000
        }
      };

      setBusinessSummary(summary);

      // Generate Proactive Actions
      const actions = [];
      
      // 1. Receivables Management
      if (unpaidAmount > paidAmount * 0.25) {
        actions.push({
          title: 'Optimize Receivables',
          description: `Outstanding invoices total ${formatCurrency(unpaidAmount)}. Implementing automated reminders could improve cash flow by 15%.`,
          impact: 'High',
          actionType: 'Finance',
          effort: 'Low',
          icon: CreditCard
        });
      }

      // 2. Inventory Optimization
      if (productsData.filter((p: any) => p.stock <= p.min_stock).length > 0) {
        actions.push({
          title: 'Inventory Restock',
          description: `${productsData.filter((p: any) => p.stock <= p.min_stock).length} critical items are below safety stock. Restock now to avoid ${formatCurrency(revenue * 0.05)} in potential lost sales.`,
          impact: 'Medium',
          actionType: 'Operations',
          effort: 'Medium',
          icon: Package
        });
      }

      // 3. Profit Margin Analysis
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
      if (profitMargin < 20 && revenue > 0) {
        actions.push({
          title: 'Margin Compression',
          description: `Current net margin is ${profitMargin.toFixed(1)}%. Target is 25%. Review supplier costs or consider a 5% price adjustment.`,
          impact: 'High',
          actionType: 'Strategy',
          effort: 'High',
          icon: TrendingDown
        });
      }

      // 4. Customer Retention
      if (customerCount && customerCount > 0 && newCustomers === 0) {
        actions.push({
          title: 'Retention Campaign',
          description: 'No new customers this month. Launch a re-engagement campaign for existing clients to stabilize revenue.',
          impact: 'Medium',
          actionType: 'Marketing',
          effort: 'Medium',
          icon: Users
        });
      }

      // 5. Break-even Alert
      if (summary.breakEven.currentProgress < 100 && revenue > 0) {
        actions.push({
          title: 'Break-even Target',
          description: `You are at ${Math.round(summary.breakEven.currentProgress)}% of your monthly break-even point. Need ${formatCurrency(summary.breakEven.breakEvenPoint - revenue)} more in sales.`,
          impact: 'Medium',
          actionType: 'Finance',
          effort: 'Medium',
          icon: Target
        });
      }

      setProactiveActions(actions);

      // 3. Fetch Recent Invoices, Top Customers
      const [
        { data: recentInvoicesData },
        { data: invoicesForCustomers }
      ] = await Promise.all([
        supabase
          .from('invoices')
          .select(`
            *,
            customers (name)
          `)
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('invoices')
          .select(`
            total,
            customer_id,
            customers (name)
          `)
          .eq('business_id', businessId)
      ]);
      
      if (recentInvoicesData) setRecentInvoices(recentInvoicesData);
      setRecentPurchases(filteredPurchases.slice(0, 5));

      if (invoicesForCustomers) {
        const customerTotals: Record<string, { name: string, total: number }> = {};
        (invoicesForCustomers as any[]).forEach(inv => {
          const cid = inv.customer_id;
          if (!cid) return;
          const customerName = Array.isArray(inv.customers) 
            ? inv.customers[0]?.name 
            : inv.customers?.name;
            
          if (!customerTotals[cid]) {
            customerTotals[cid] = { name: customerName || 'Unknown', total: 0 };
          }
          customerTotals[cid].total += Number(inv.total);
        });
        const sortedCustomers = Object.entries(customerTotals)
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        setTopCustomers(sortedCustomers);
      }

      const supplierTotals: Record<string, { name: string, total: number }> = {};
      filteredPurchases.forEach(p => {
        const sid = p.supplier_id;
        if (!sid) return;
        
        let supplierName = Array.isArray(p.suppliers) 
          ? p.suppliers[0]?.name 
          : p.suppliers?.name;
          
        // Fallback to suppliersData if join is missing
        if (!supplierName) {
          const supplier = suppliersData.find((s: any) => s.id === sid);
          supplierName = supplier?.name;
        }
          
        if (!supplierTotals[sid]) {
          supplierTotals[sid] = { name: supplierName || 'Unknown', total: 0 };
        }
        supplierTotals[sid].total += Number(p.total_amount || p.total || 0);
      });
      const sortedSuppliers = Object.entries(supplierTotals)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      setTopSuppliers(sortedSuppliers);

      // 4. Prepare Chart Data (Mocking monthly aggregation for now)
      const baseChartData = [
        { name: 'Jan', revenue: totalRevenue * 0.1 },
        { name: 'Feb', revenue: totalRevenue * 0.15 },
        { name: 'Mar', revenue: totalRevenue * 0.25 },
        { name: 'Apr', revenue: totalRevenue * 0.2 },
        { name: 'May', revenue: totalRevenue * 0.1 },
        { name: 'Jun', revenue: totalRevenue * 0.2 },
      ];
      setChartData(baseChartData);
      setLoading(false);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      setLoading(false);
    }
  };

  const handleSimulate = () => {
    if (!businessSummary) return;
    const currentRevenue = businessSummary.profitAndLoss.revenue;
    const currentExpenses = businessSummary.profitAndLoss.expenses;
    
    const priceFactor = 1 + (simulationInput.priceChange / 100);
    const volumeFactor = 1 + (simulationInput.volumeChange / 100);
    
    const newRevenue = currentRevenue * priceFactor * volumeFactor;
    // Assuming variable costs are 40% of revenue and fixed costs are 60% of current expenses
    const variableCosts = (currentExpenses * 0.4) * volumeFactor;
    const fixedCosts = currentExpenses * 0.6;
    const newExpenses = variableCosts + fixedCosts;
    const newProfit = newRevenue - newExpenses;
    const currentProfit = currentRevenue - currentExpenses;
    const profitChangePercent = currentProfit !== 0 ? (((newProfit / currentProfit) - 1) * 100).toFixed(1) : '0';
    
    setSimulationResult({
      projectedRevenue: newRevenue,
      projectedProfit: newProfit,
      revenueChange: newRevenue - currentRevenue,
      profitChange: newProfit - currentProfit,
      impact: `A ${simulationInput.priceChange}% price change and ${simulationInput.volumeChange}% volume change would result in a ${profitChangePercent}% change in net profit.`
    });
  };
  const statCards = [
    { 
      label: 'Total Revenue', 
      value: stats.totalRevenue, 
      icon: IndianRupee, 
      change: '+12.5%', 
      trend: 'up',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      isCurrency: true
    },
    { 
      label: 'Net Profit', 
      value: businessSummary?.profitAndLoss.netProfit || 0, 
      icon: TrendingUp, 
      change: `${businessSummary?.profitAndLoss.change.toFixed(1)}%`, 
      trend: (businessSummary?.profitAndLoss.change || 0) >= 0 ? 'up' : 'down',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      isCurrency: true
    },
    { 
      label: 'Total Customers', 
      value: stats.totalCustomers, 
      icon: Users, 
      change: '+5.4%', 
      trend: 'up',
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    { 
      label: 'Low Stock Items', 
      value: stats.lowStockItems, 
      icon: Package, 
      change: '-2.1%', 
      trend: 'down',
      color: 'text-orange-600',
      bg: 'bg-orange-50'
    },
    { 
      label: 'Paid Invoices', 
      value: stats.paidAmount, 
      subValue: `${stats.paidInvoicesCount} Invoices`,
      icon: CheckCircle2, 
      change: '85%', 
      trend: 'up',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      isCurrency: true
    },
    { 
      label: 'Unpaid Invoices', 
      value: stats.unpaidAmount, 
      subValue: `${stats.unpaidInvoicesCount} Invoices`,
      icon: Clock, 
      change: '15%', 
      trend: 'down',
      color: 'text-red-600',
      bg: 'bg-red-50',
      isCurrency: true
    }
  ];

  if (loading && !businessSummary) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!businessSummary || chartData.length === 0) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-500 font-medium">No business data available for this period.</p>
        <button 
          onClick={fetchDashboardData} 
          className="bg-primary text-white py-2 px-6 rounded-xl font-bold hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 relative"
    >

      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative">
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/5 to-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        </div>
        <div className="relative z-10">
          <h1 className="text-xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">Business Performance Dashboard</h1>
          <p className="text-xs font-medium text-slate-500 mt-1">Real-time financial metrics and business health monitoring.</p>
        </div>
        <div className="flex items-center space-x-2 justify-end relative z-20">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
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
            onClick={() => navigate('/invoices/new')}
            className="bg-gradient-to-r from-primary to-blue-600 text-white hover:shadow-lg hover:shadow-primary/30 flex items-center text-[11px] font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95"
          >
            <Plus size={16} className="mr-1.5" strokeWidth={2.5} />
            Create Invoice
          </button>
          <button 
            onClick={() => setShowScanOptions(true)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 flex items-center shadow-sm text-[11px] transition-all active:scale-95"
          >
            <Scan size={16} className="mr-1.5 text-primary" strokeWidth={2.5} />
            Scan Invoice
          </button>
        </div>
      </div>

      {/* Core Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden h-full"
          >
            <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 blur-2xl opacity-50 transition-opacity group-hover:opacity-100", stat.bg)} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className={cn("p-2.5 rounded-2xl shadow-sm", stat.bg)}>
                  <stat.icon size={18} className={stat.color} strokeWidth={2.5} />
                </div>
                <div className={cn(
                  "text-[10px] font-bold px-2 py-1 rounded-xl flex items-center shadow-sm",
                  stat.trend === 'up' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
                )}>
                  {stat.trend === 'up' ? <ArrowUpRight size={12} className="mr-1" strokeWidth={3} /> : <ArrowDownRight size={12} className="mr-1" strokeWidth={3} />}
                  {stat.change}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {stat.isCurrency
                    ? formatCurrency(stat.value as number) 
                    : stat.value}
                </h3>
                {stat.subValue && (
                  <p className="text-[10px] font-bold text-slate-500">{stat.subValue}</p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions (Vyapar-like) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-white pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Quick Actions</h2>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {[
              { icon: Plus, label: 'Sale', color: 'bg-blue-50 text-blue-600 border-blue-100', path: '/invoices/new' },
              { icon: ShoppingCart, label: 'Purchase', color: 'bg-purple-50 text-purple-600 border-purple-100', path: '/purchases' },
              { icon: Users, label: 'Add Party', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', path: '/customers' },
              { icon: Package, label: 'Add Item', color: 'bg-orange-50 text-orange-600 border-orange-100', path: '/inventory' },
              { icon: FileText, label: 'Estimate', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', path: '/invoices/new' },
              { icon: CreditCard, label: 'Payment In', color: 'bg-teal-50 text-teal-600 border-teal-100', path: '/invoices' },
              { icon: Clock, label: 'Payment Out', color: 'bg-rose-50 text-rose-600 border-rose-100', path: '/purchases' },
              { icon: BarChart3, label: 'Reports', color: 'bg-slate-50 text-slate-600 border-slate-200', path: '/reports' },
            ].map((action, i) => (
              <button
                key={i}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl hover:bg-white hover:shadow-md hover:-translate-y-1 transition-all duration-200 group border border-transparent"
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border", action.color)}>
                  <action.icon size={22} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold text-slate-700 text-center">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scan Invoice Options Modal */}
      {showScanOptions && (
        <ScanOptionsModal 
          onClose={() => setShowScanOptions(false)} 
          onFileSelect={handleFileSelect} 
        />
      )}

      {/* Business Summary & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Performance Summary */}
        <div className="lg:col-span-2 glass-card p-6 relative overflow-hidden group h-full">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />
            
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-900 rounded-xl shadow-lg shadow-slate-200">
                  <BarChart3 size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Performance Summary</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Advanced Business Analytics</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className={cn(
                  "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm",
                  businessSummary?.businessHealth.status === 'Excellent' ? "bg-emerald-500 text-white" : 
                  businessSummary?.businessHealth.status === 'Good' ? "bg-blue-500 text-white" : 
                  "bg-orange-500 text-white"
                )}>
                  {businessSummary?.businessHealth.status || '...'}
                </span>
                <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Health Status</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Profit & Loss */}
              <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group/card">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-emerald-50 rounded-lg">
                        <TrendingUp size={14} className="text-emerald-600" />
                      </div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Profit & Loss
                      </h3>
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-2">{formatCurrency(businessSummary?.profitAndLoss.netProfit || 0)}</div>
                    <div className={cn(
                      "text-[10px] font-bold flex items-center mt-1",
                      (businessSummary?.profitAndLoss.change || 0) >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      <div className={cn(
                        "p-0.5 rounded-full mr-1.5",
                        (businessSummary?.profitAndLoss.change || 0) >= 0 ? "bg-emerald-100" : "bg-red-100"
                      )}>
                        {(businessSummary?.profitAndLoss.change || 0) >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      </div>
                      {Math.abs(businessSummary?.profitAndLoss.change || 0).toFixed(1)}% vs last month
                    </div>
                  </div>
                  <div className="h-14 w-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={businessSummary?.profitAndLoss.sparkline || []}>
                        <defs>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Gross Revenue</p>
                    <p className="text-[11px] font-black text-slate-800">{formatCurrency(businessSummary?.profitAndLoss.revenue || 0)}</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">Margin:</span>
                      <span className="text-[9px] font-black text-emerald-600">{businessSummary?.profitAndLoss.grossMarginPercent}%</span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Total Expenses</p>
                    <p className="text-[11px] font-black text-red-500">-{formatCurrency(businessSummary?.profitAndLoss.expenses || 0)}</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">EBITDA:</span>
                      <span className="text-[9px] font-black text-slate-700">{formatCompactCurrency(businessSummary?.profitAndLoss.ebitda || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cash Flow */}
              <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group/card">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-blue-50 rounded-lg">
                        <ArrowDownLeft size={14} className="text-blue-600" />
                      </div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Cash Flow
                      </h3>
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-2">{formatCurrency(businessSummary?.cashFlow.netCashFlow || 0)}</div>
                    <div className={cn(
                      "text-[10px] font-bold flex items-center mt-1",
                      (businessSummary?.cashFlow.change || 0) >= 0 ? "text-blue-600" : "text-red-600"
                    )}>
                      <div className={cn(
                        "p-0.5 rounded-full mr-1.5",
                        (businessSummary?.cashFlow.change || 0) >= 0 ? "bg-blue-100" : "bg-red-100"
                      )}>
                        {(businessSummary?.cashFlow.change || 0) >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      </div>
                      {Math.abs(businessSummary?.cashFlow.change || 0).toFixed(1)}% efficiency
                    </div>
                  </div>
                  <div className="h-14 w-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={businessSummary?.cashFlow.sparkline || []}>
                        <defs>
                          <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCash)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Inflow (Paid)</p>
                    <p className="text-[11px] font-black text-emerald-600">+{formatCurrency(businessSummary?.cashFlow.inflow || 0)}</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">DSO:</span>
                      <span className="text-[9px] font-black text-blue-600">{businessSummary?.cashFlow.dso} Days</span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Outflow (Purchases)</p>
                    <p className="text-[11px] font-black text-red-400">-{formatCurrency(businessSummary?.cashFlow.outflow || 0)}</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">DPO:</span>
                      <span className="text-[9px] font-black text-slate-700">{businessSummary?.cashFlow.dpo} Days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Flow */}
              <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all group/card">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-purple-50 rounded-lg">
                        <Users size={14} className="text-purple-600" />
                      </div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Customer Flow
                      </h3>
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-2">{businessSummary?.customerFlow.total}</div>
                    <div className="text-[10px] font-bold text-purple-600 flex items-center mt-1">
                      <div className="p-0.5 bg-purple-100 rounded-full mr-1.5">
                        <ArrowUpRight size={10} />
                      </div>
                      {businessSummary?.customerFlow.growth}% growth rate
                    </div>
                  </div>
                  <div className="h-14 w-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={businessSummary?.customerFlow.sparkline || []}>
                        <defs>
                          <linearGradient id="colorCust" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorCust)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">New MTD</p>
                    <p className="text-[11px] font-black text-emerald-600">+{businessSummary?.customerFlow.newThisMonth}</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">CAC:</span>
                      <span className="text-[9px] font-black text-purple-600">{formatCurrency(businessSummary?.customerFlow.cac || 0)}</span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Retention</p>
                    <p className="text-[11px] font-black text-slate-700">94.2%</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">LTV:</span>
                      <span className="text-[9px] font-black text-slate-700">{formatCurrency(businessSummary?.customerFlow.ltv || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Health Index */}
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl shadow-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg">
                      <Activity size={14} className="text-orange-500" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Health Radar
                    </h3>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-xl font-black text-white">{businessSummary?.businessHealth.score || 0}</span>
                    <span className="text-[10px] font-bold text-slate-500">/100</span>
                  </div>
                </div>
                
                <div className="h-[120px] w-full mb-4 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gaugeData}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius="60%"
                        outerRadius="90%"
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                      >
                        {gaugeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                    <span className="text-xl font-black text-white leading-none">{healthScore}</span>
                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-1">Score</span>
                  </div>
                </div>
                
                <div className="h-[120px] w-full mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={businessSummary?.businessHealth.radarData}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 7, fontWeight: 700 }} />
                      <Radar
                        name="Business Health"
                        dataKey="A"
                        stroke="#4F46E5"
                        fill="#4F46E5"
                        fillOpacity={0.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {businessSummary?.businessHealth.factors.slice(0, 3).map((factor: any, i: number) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{factor.label}</span>
                        <span className={cn(
                          "text-[7px] font-black uppercase px-1 py-0.5 rounded",
                          factor.status === 'positive' ? "bg-emerald-500/10 text-emerald-400" : 
                          factor.status === 'warning' ? "bg-orange-500/10 text-orange-400" : "bg-red-500/10 text-red-400"
                        )}>
                          {factor.status}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${factor.value}%` }}
                          transition={{ duration: 1, delay: i * 0.1 }}
                          className={cn(
                            "h-full rounded-full",
                            factor.status === 'positive' ? "bg-emerald-500" : 
                            factor.status === 'warning' ? "bg-orange-500" : "bg-red-500"
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cash Runway Card */}
              <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-500" />
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-blue-50 rounded-lg">
                        <Clock size={14} className="text-blue-600" />
                      </div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Cash Runway
                      </h3>
                    </div>
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">
                      {businessSummary?.runway.monthsRemaining.toFixed(1)} Months
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Burn Rate</p>
                        <div className="flex items-center space-x-2">
                          <p className="text-base font-black text-slate-900">{formatCurrency(businessSummary?.runway.burnRate || 0)}</p>
                          <span className={cn(
                            "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                            businessSummary?.runway.burnTrend === 'decreasing' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                          )}>
                            {businessSummary?.runway.burnTrend}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cash on Hand</p>
                        <p className="text-xs font-black text-slate-600">{formatCurrency(businessSummary?.runway.cashOnHand || 0)}</p>
                      </div>
                    </div>
                    
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (businessSummary?.runway.monthsRemaining || 0) * 10)}%` }}
                        className={cn(
                          "h-full rounded-full",
                          (businessSummary?.runway.monthsRemaining || 0) > 6 ? "bg-emerald-500" : 
                          (businessSummary?.runway.monthsRemaining || 0) > 3 ? "bg-orange-500" : "bg-red-500"
                        )}
                      />
                    </div>

                    {/* Burn Rate vs Revenue Chart */}
                    <div className="mt-6 pt-6 border-t border-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Burn vs Revenue</p>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            <span className="text-[7px] font-bold text-slate-400 uppercase">Burn</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[7px] font-bold text-slate-400 uppercase">Rev</span>
                          </div>
                        </div>
                      </div>
                      <div className="h-16 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { name: 'Burn', value: businessSummary?.runway.burnRate || 0, fill: '#f87171' },
                            { name: 'Rev', value: (businessSummary?.profitAndLoss.revenue || 0) / 30, fill: '#34d399' }
                          ]}>
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                            <Tooltip 
                              cursor={{fill: 'transparent'}}
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '8px' }}
                              formatter={(value: number) => [formatCurrency(value), '']}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Break-even Progress */}
              <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-slate-50 rounded-lg">
                      <Target size={14} className="text-slate-600" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Break-even Progress
                    </h3>
                  </div>
                  <span className="text-[10px] font-black text-slate-900">{Math.min(100, Math.round(businessSummary?.breakEven.currentProgress || 0))}%</span>
                </div>
                <div className="space-y-4">
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, businessSummary?.breakEven.currentProgress || 0)}%` }}
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Fixed Costs</p>
                      <p className="text-[11px] font-black text-slate-700">{formatCurrency(businessSummary?.breakEven.fixedCosts || 0)}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Variable Costs</p>
                      <p className="text-[11px] font-black text-slate-700">{formatCurrency(businessSummary?.breakEven.variableCosts || 0)}</p>
                    </div>
                  </div>

                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-tighter pt-2 border-t border-slate-50">
                    <span className="text-slate-400">Target: {formatCurrency(businessSummary?.breakEven.breakEvenPoint || 0)}</span>
                    <span className={cn(
                      businessSummary?.breakEven.currentProgress >= 100 ? "text-emerald-600" : "text-orange-600"
                    )}>
                      {businessSummary?.breakEven.currentProgress >= 100 ? "Profitable" : `${businessSummary?.breakEven.daysToBreakEven} Days to Goal`}
                    </span>
                  </div>
                </div>
              </div>
          </div>
        </div>

        {/* Proactive Actions */}
        <div className="lg:col-span-1 glass-card p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-orange-50 rounded-lg">
                <Zap size={16} className="text-orange-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Proactive Actions</h2>
            </div>
            {proactiveActions.length > 0 && (
              <span className="text-[9px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full uppercase">
                {proactiveActions.length} Alerts
              </span>
            )}
          </div>
          
          <div className="flex-1 space-y-4">
            {proactiveActions.length > 0 ? (
              proactiveActions.map((action, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 opacity-50 group-hover:bg-primary/5 transition-colors" />
                  
                  <div className="flex items-start justify-between mb-3 relative z-10">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "p-2 rounded-xl shadow-sm",
                        action.impact === 'High' ? "bg-red-50 text-red-600" : 
                        action.impact === 'Medium' ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {action.icon ? <action.icon size={16} /> : <Zap size={16} />}
                      </div>
                      <h3 className="text-[12px] font-black text-slate-900 group-hover:text-primary transition-colors uppercase tracking-tight">{action.title}</h3>
                    </div>
                    <span className={cn(
                      "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                      action.impact === 'High' ? "bg-red-100 text-red-700" : 
                      action.impact === 'Medium' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {action.impact} Impact
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-4 relative z-10 font-medium">{action.description}</p>
                  
                  <div className="flex items-center justify-between mt-auto relative z-10">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{action.actionType}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{action.effort} Effort</span>
                      </div>
                    </div>
                    <div className="flex items-center text-primary font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                      Take Action
                      <ArrowRight size={12} className="ml-1.5" />
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                  <CheckCircle2 className="text-emerald-500" size={24} />
                </div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-1">All Clear</h3>
                <p className="text-[10px] text-slate-400 font-medium">No urgent actions required for your business right now.</p>
              </div>
            )}
          </div>
          
          <button className="w-full mt-6 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors">
            View All Actions
          </button>
        </div>

        {/* Scenario Simulator Card (Inline) */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col h-full">
          <div className="flex items-center space-x-2 mb-4">
            <div className="p-1.5 bg-purple-50 rounded-lg">
              <TrendingUp size={16} className="text-purple-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Scenario Simulator</h2>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Price Change (%)</label>
                <input 
                  type="number"
                  value={simulationInput.priceChange}
                  onChange={(e) => setSimulationInput(prev => ({ ...prev, priceChange: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Volume Change (%)</label>
                <input 
                  type="number"
                  value={simulationInput.volumeChange}
                  onChange={(e) => setSimulationInput(prev => ({ ...prev, volumeChange: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            
            <button 
              onClick={handleSimulate}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors"
            >
              Run Simulation
            </button>

            {simulationResult && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-4 border-t border-slate-100 space-y-3"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="text-[8px] font-bold text-emerald-600 uppercase mb-1">Projected Revenue</div>
                    <div className="text-[12px] font-black text-emerald-700">{formatCurrency(simulationResult.projectedRevenue)}</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                    <div className="text-[8px] font-bold text-blue-600 uppercase mb-1">Projected Profit</div>
                    <div className="text-[12px] font-black text-blue-700">{formatCurrency(simulationResult.projectedProfit)}</div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed italic">
                  {simulationResult.impact}
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Inventory & Supply Chain - Moved to Right Side */}
        <div className="lg:col-span-1 glass-card p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-indigo-50 rounded-lg">
                <Package size={16} className="text-indigo-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Inventory & Supply</h2>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[8px] font-bold text-slate-500 uppercase">{businessSummary?.inventory.stockHealth}</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Inventory Turnover</p>
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-black text-slate-900">{businessSummary?.inventory.turnoverRate}x</p>
                <span className="text-[9px] font-bold text-emerald-600">Healthy</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-3">
                <div className="h-full bg-emerald-500 w-[65%]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Value</p>
                <p className="text-[11px] font-black text-slate-900">{formatCompactCurrency(businessSummary?.inventory.totalStockValue || 0)}</p>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Lead Time</p>
                <p className="text-[11px] font-black text-slate-900">{businessSummary?.supplyChain.avgLeadTime} Days</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Supplier Reliability</p>
                <span className="text-[10px] font-black text-indigo-700">{businessSummary?.supplyChain.reliabilityScore}%</span>
              </div>
              <div className="h-1.5 w-full bg-indigo-200/50 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600" style={{ width: `${businessSummary?.supplyChain.reliabilityScore}%` }} />
              </div>
              <p className="text-[9px] text-indigo-600/70 mt-2 font-medium italic text-center">
                Managing {businessSummary?.supplyChain.activeSuppliers} active partners
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue & Cash Flow Forecast Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Performance */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center">
                <TrendingUp size={16} className="mr-2 text-primary" />
                Revenue & Cash Flow Forecast
              </h3>
              <p className="text-[10px] text-slate-500">Projected trends based on historical performance</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[9px] font-bold text-slate-500 uppercase">Actual</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-200 border border-dashed border-slate-400" />
                <span className="text-[9px] font-bold text-slate-500 uppercase">Forecast</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                ...chartData,
                { name: 'Jul', revenue: chartData[chartData.length-1].revenue * 1.1, forecast: true },
                { name: 'Aug', revenue: chartData[chartData.length-1].revenue * 1.25, forecast: true },
                { name: 'Sep', revenue: chartData[chartData.length-1].revenue * 1.4, forecast: true },
              ]}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                  tickFormatter={(value) => formatCompactCurrency(value)}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#4F46E5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-6 grid grid-cols-3 gap-4 pt-6 border-t border-slate-50">
            <div className="text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg. Daily Revenue</p>
              <p className="text-xs font-black text-slate-900">{formatCurrency((businessSummary?.profitAndLoss.revenue || 0) / 30)}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Projected Q3 Growth</p>
              <p className="text-xs font-black text-emerald-600">+18.4%</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Est. Tax Liability</p>
              <p className="text-xs font-black text-red-600">{formatCurrency((businessSummary?.profitAndLoss.revenue || 0) * 0.18)}</p>
            </div>
          </div>
        </div>

        {/* Owner's Strategic Insights - Moved to Right Side */}
        <div className="lg:col-span-1 p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl flex flex-col h-full">
          <div className="flex items-center space-x-2 mb-6">
            <div className="p-1.5 bg-primary/20 rounded-lg">
              <ShieldCheck size={16} className="text-primary" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-widest">Strategic Insights</h2>
          </div>
          
          <div className="space-y-4 flex-1">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Dividend Capacity</p>
              <p className="text-lg font-black text-emerald-400">{formatCurrency(businessSummary?.ownerVisibility.dividendCapacity || 0)}</p>
              <p className="text-[9px] text-slate-500 mt-1 italic">Safe withdrawal (45% FCF)</p>
            </div>
            
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Owner Equity Est.</p>
              <p className="text-lg font-black text-white">{formatCurrency(businessSummary?.ownerVisibility.ownerEquity || 0)}</p>
              <p className="text-[9px] text-slate-500 mt-1 italic">1.5x Cash + Assets</p>
            </div>

            <div className="mt-auto pt-6 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Tax Reserve Status</span>
                <span className="text-[9px] font-bold text-orange-400">Action Required</span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-base font-black text-white">{formatCurrency(businessSummary?.ownerVisibility.estimatedTax || 0)}</span>
                <span className="text-[8px] font-bold text-slate-500 uppercase">Liability</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customers & Invoices Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Customers */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6 flex items-center">
            <Users size={16} className="mr-2 text-primary" />
            Top Customers
          </h3>
          <div className="space-y-4">
            {topCustomers.map((customer, i) => (
              <div key={customer.id} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 group-hover:bg-primary group-hover:text-white transition-colors">
                    {customer.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-900">{customer.name}</div>
                    <div className="text-[8px] text-slate-500">Premium Tier</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-900">{formatCurrency(customer.total)}</div>
                  <div className="text-[9px] text-emerald-600 font-bold flex items-center justify-end">
                    <ArrowUpRight size={10} className="mr-0.5" />
                    12%
                  </div>
                </div>
              </div>
            ))}
            {topCustomers.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Users size={24} className="mx-auto mb-2 opacity-20" />
                <p className="text-[10px]">No customer data yet</p>
              </div>
            )}
          </div>
          <button className="w-full mt-6 py-2.5 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-colors">
            View All Customers
          </button>
        </div>

        {/* Recent Invoices */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center">
              <FileText size={16} className="mr-2 text-primary" />
              Recent Invoices
            </h3>
            <button 
              onClick={() => navigate('/invoices')}
              className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
            >
              View All
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-50">
                  <th className="pb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Invoice</th>
                  <th className="pb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                  <th className="pb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="pb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="pb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-1.5">
                      <div className="text-[10px] font-bold text-slate-900">#{invoice.invoice_number || invoice.id.slice(0, 8)}</div>
                    </td>
                    <td className="py-1.5">
                      <div className="text-[10px] font-medium text-slate-600">
                        {Array.isArray(invoice.customers) ? invoice.customers[0]?.name : invoice.customers?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="py-1.5 text-[9px] text-slate-500">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-1.5">
                      <div className="text-[10px] font-black text-slate-900">{formatCurrency(invoice.total)}</div>
                    </td>
                    <td className="py-1.5">
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter",
                        invoice.status === 'paid' ? "bg-emerald-50 text-emerald-600" : 
                        invoice.status === 'overdue' ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"
                      )}>
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentInvoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      <p className="text-[10px]">No invoices found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Segments */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6 flex items-center">
            <Target size={16} className="mr-2 text-primary" />
            Customer Segments
          </h3>
          <div className="h-[200px] w-full mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                { subject: 'Loyalty', A: 120, fullMark: 150 },
                { subject: 'Frequency', A: 98, fullMark: 150 },
                { subject: 'Value', A: 86, fullMark: 150 },
                { subject: 'Recency', A: 99, fullMark: 150 },
                { subject: 'Growth', A: 85, fullMark: 150 },
              ]}>
                <PolarGrid stroke="#f1f5f9" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fontWeight: 600, fill: '#94a3b8' }} />
                <Radar name="Segments" dataKey="A" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-700">High Value</span>
              <span className="text-[10px] font-black text-emerald-700">42%</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-[10px] font-bold text-blue-700">At Risk</span>
              <span className="text-[10px] font-black text-blue-700">12%</span>
            </div>
          </div>
        </div>

        {/* Business Tip Card */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl relative overflow-hidden group h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/30 transition-colors" />
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <Lightbulb size={16} className="text-primary" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest">Business Tip</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              "Focus on your high-value customer segment. They contribute to 42% of your revenue but only represent 15% of your base. Personalized outreach could increase their lifetime value by 20%."
            </p>
            <button className="text-[10px] font-bold text-primary hover:text-primary/80 uppercase tracking-widest flex items-center">
              Learn More <ArrowRight size={12} className="ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Purchases & Suppliers Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Top Suppliers */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6 flex items-center">
            <Truck size={16} className="mr-2 text-primary" />
            Top Suppliers
          </h3>
          <div className="space-y-4">
            {topSuppliers.map((supplier, i) => (
              <div key={supplier.id} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 group-hover:bg-primary group-hover:text-white transition-colors">
                    {supplier.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-900">{supplier.name}</div>
                    <div className="text-[8px] text-slate-500">Reliability: 98%</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-900">{formatCurrency(supplier.total)}</div>
                  <div className="text-[9px] text-emerald-600 font-bold">Active</div>
                </div>
              </div>
            ))}
            {topSuppliers.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Truck size={24} className="mx-auto mb-2 opacity-20" />
                <p className="text-[10px]">No supplier data yet</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => navigate('/suppliers')}
            className="w-full mt-6 py-2.5 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-colors"
          >
            View All Suppliers
          </button>
        </div>

        {/* Recent Purchases */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center">
              <ShoppingCart size={16} className="mr-2 text-primary" />
              Recent Purchases
            </h3>
            <button 
              onClick={() => navigate('/purchases')}
              className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
            >
              View All
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-50">
                  <th className="pb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Purchase #</th>
                  <th className="pb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Supplier</th>
                  <th className="pb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="pb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="pb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentPurchases.map((purchase) => (
                  <tr key={purchase.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-1.5">
                      <div className="text-[10px] font-bold text-slate-900">#{purchase.invoice_number || purchase.id.slice(0, 8)}</div>
                    </td>
                    <td className="py-1.5">
                      <div className="text-[10px] font-medium text-slate-600">
                        {(() => {
                          let name = Array.isArray(purchase.suppliers) ? purchase.suppliers[0]?.name : purchase.suppliers?.name;
                          if (!name && purchase.supplier_id) {
                            const s = rawData.suppliers.find((s: any) => s.id === purchase.supplier_id);
                            name = s?.name;
                          }
                          return name || 'Unknown';
                        })()}
                      </div>
                    </td>
                    <td className="py-1.5 text-[9px] text-slate-500">
                      {new Date(purchase.date).toLocaleDateString()}
                    </td>
                    <td className="py-1.5">
                      <div className="text-[10px] font-black text-slate-900">{formatCurrency(purchase.total_amount)}</div>
                    </td>
                    <td className="py-1.5">
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter",
                        purchase.status === 'paid' ? "bg-emerald-50 text-emerald-600" : 
                        purchase.status === 'pending' ? "bg-orange-50 text-orange-600" : "bg-red-50 text-red-600"
                      )}>
                        {purchase.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentPurchases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      <p className="text-[10px]">No purchases found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>

  );
}
