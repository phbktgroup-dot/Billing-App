import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ScanOptionsModal from '../components/ScanOptionsModal';
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
  Sparkles,
  Zap,
  Target,
  Activity,
  ShieldAlert,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  ArrowRight
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
  Cell
} from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  generateBusinessInsights, 
  BusinessInsights, 
  askBusinessQuestion, 
  simulateScenario, 
  SimulationResult 
} from '../services/aiService';

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
  const [chartData, setChartData] = useState<any[]>([]);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [aiInsights, setAiInsights] = useState<BusinessInsights | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [simulationScenario, setSimulationScenario] = useState('');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'strategy' | 'products'>('overview');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const businessId = profile?.business_id;

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
  }, [businessId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (!businessId) {
        setLoading(false);
        return;
      }

      // 2. Fetch Stats
      const [
        { data: invoices },
        { count: customerCount },
        { data: lowStockProducts }
      ] = await Promise.all([
        supabase.from('invoices').select('total, created_at, status').eq('business_id', businessId),
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('products').select('id').eq('business_id', businessId).lte('stock', 'min_stock')
      ]);

      const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0;
      
      const paidInvoices = invoices?.filter(inv => inv.status === 'paid') || [];
      const unpaidInvoices = invoices?.filter(inv => inv.status !== 'paid') || [];
      
      const paidAmount = paidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
      const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);

      setStats({
        totalRevenue,
        activeInvoices: invoices?.length || 0,
        totalCustomers: customerCount || 0,
        lowStockItems: lowStockProducts?.length || 0,
        paidInvoicesCount: paidInvoices.length,
        unpaidInvoicesCount: unpaidInvoices.length,
        paidAmount,
        unpaidAmount
      });

      // 3. Fetch Recent Invoices & Top Customers
      const [
        { data: recent },
        { data: customersData }
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
      
      if (recent) setRecentInvoices(recent);

      // Fetch AI insights after dashboard data is loaded
      await fetchAIInsights({
        totalRevenue,
        activeInvoices: invoices?.length || 0,
        totalCustomers: customerCount || 0,
        lowStockItems: lowStockProducts?.length || 0,
        paidInvoicesCount: paidInvoices.length,
        unpaidInvoicesCount: unpaidInvoices.length,
        paidAmount,
        unpaidAmount
      }, recent || []);

      if (customersData) {
        const customerTotals: Record<string, { name: string, total: number }> = {};
        (customersData as any[]).forEach(inv => {
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

      // 4. Prepare Chart Data (Mocking monthly aggregation for now)
      const baseChartData = [
        { name: 'Jan', revenue: totalRevenue * 0.1, forecast: null },
        { name: 'Feb', revenue: totalRevenue * 0.15, forecast: null },
        { name: 'Mar', revenue: totalRevenue * 0.25, forecast: null },
        { name: 'Apr', revenue: totalRevenue * 0.2, forecast: null },
        { name: 'May', revenue: totalRevenue * 0.1, forecast: null },
        { name: 'Jun', revenue: totalRevenue * 0.2, forecast: null },
      ];
      setChartData(baseChartData);
      setLoading(false);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      setLoading(false);
    }
  };

  const fetchAIInsights = async (statsData: any, invoicesData: any) => {
    setIsAnalyzing(true);
    console.log('Fetching AI insights...', statsData, invoicesData);
    try {
      const insights = await generateBusinessInsights({
        stats: statsData,
        recentInvoices: invoicesData?.slice(0, 20).map((inv: any) => ({ total: inv.total, status: inv.status, date: inv.date }))
      }, businessId!);
      console.log('AI insights received:', insights);
      setAiInsights(insights);
      
      // Update chart with forecast
      if (insights.forecast && insights.forecast.length > 0) {
        const baseChartData = chartData.filter(d => d.revenue !== null);
        const lastActual = baseChartData[baseChartData.length - 1];
        const forecastData = insights.forecast.map((f: any) => ({
          name: f.month,
          revenue: null,
          forecast: f.revenue
        }));
        
        // Connect the actual to the forecast
        const connectionPoint = { ...lastActual, forecast: lastActual.revenue };
        setChartData([...baseChartData.slice(0, -1), connectionPoint, ...forecastData]);
      }
    } catch (aiError) {
      console.error("AI Insights generation failed:", aiError);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    
    setIsAsking(true);
    setAiAnswer(null);
    try {
      const answer = await askBusinessQuestion(aiQuestion, { stats, recentInvoices, aiInsights });
      setAiAnswer(answer);
    } catch (error) {
      console.error("Ask AI Error:", error);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSimulate = async (scenario: string) => {
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const result = await simulateScenario(scenario, { stats, aiInsights });
      setSimulationResult(result);
    } catch (error) {
      console.error("Simulation Error:", error);
    } finally {
      setIsSimulating(false);
    }
  };
  const statCards = [
    { 
      label: 'Total Revenue', 
      value: stats.totalRevenue, 
      icon: IndianRupee, 
      change: '+12.5%', 
      trend: 'up',
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    { 
      label: 'Active Invoices', 
      value: stats.activeInvoices, 
      icon: FileText, 
      change: '+3.2%', 
      trend: 'up',
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    { 
      label: 'Total Customers', 
      value: stats.totalCustomers, 
      icon: Users, 
      change: '+5.4%', 
      trend: 'up',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
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
      bg: 'bg-emerald-50'
    },
    { 
      label: 'Unpaid Invoices', 
      value: stats.unpaidAmount, 
      subValue: `${stats.unpaidInvoicesCount} Invoices`,
      icon: Clock, 
      change: '15%', 
      trend: 'down',
      color: 'text-red-600',
      bg: 'bg-red-50'
    }
  ];

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 relative"
    >
      {/* AI Command Center & Ask AI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-4 bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <Sparkles size={120} />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <MessageSquare size={16} className="text-primary-foreground" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest">AI Command Center</h2>
            </div>
            
            <form onSubmit={handleAskAI} className="relative">
              <input 
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Ask anything about your business... (e.g., 'How can I reduce expenses?')"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-slate-500"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <button 
                type="submit"
                disabled={isAsking || !aiQuestion.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {isAsking ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
              </button>
            </form>

            {aiAnswer && (
              <div className="mt-4 p-3 bg-slate-800/80 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start space-x-3">
                  <div className="mt-1 p-1 bg-primary/20 rounded text-primary">
                    <Sparkles size={12} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] leading-relaxed text-slate-300 italic">"{aiAnswer}"</p>
                    <div className="mt-2 flex items-center space-x-2">
                      <button className="text-[9px] text-primary hover:underline font-bold uppercase tracking-tighter">Save Insight</button>
                      <button className="text-[9px] text-slate-500 hover:underline font-bold uppercase tracking-tighter" onClick={() => setAiAnswer(null)}>Clear</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!aiAnswer && !isAsking && (
              <div className="mt-4 flex flex-wrap gap-2">
                {['Growth strategy?', 'Top products?', 'Cash flow help?'].map((q) => (
                  <button 
                    key={q}
                    onClick={() => { setAiQuestion(q); }}
                    className="text-[9px] px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-700 text-slate-400 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scenario Simulator Trigger */}
        <div 
          onClick={() => setShowSimulator(true)}
          className="glass-card p-4 bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-none shadow-xl cursor-pointer hover:scale-[1.02] transition-all group relative overflow-hidden"
        >
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp size={100} />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Play size={16} className="text-white fill-white" />
                <h2 className="text-sm font-bold uppercase tracking-widest">Scenario Simulator</h2>
              </div>
              <p className="text-[10px] text-purple-100 opacity-80 leading-relaxed">
                Predict the future of your business by simulating market changes, price adjustments, and expansion plans.
              </p>
            </div>
            <div className="flex items-center text-[10px] font-bold mt-4 group-hover:translate-x-1 transition-transform">
              Launch Simulator <ArrowUpRight size={14} className="ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Business Co-pilot Dashboard</h1>
          <p className="text-[11px] text-slate-500">AI-powered insights and predictive analytics for your enterprise.</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex items-center text-[10px] font-medium text-slate-600 shadow-sm hidden sm:flex">
            <Calendar size={14} className="mr-2" />
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <button 
            onClick={() => navigate('/invoices/new')}
            className="btn-primary flex items-center text-[10px] px-3 py-1.5 rounded-lg"
          >
            <Plus size={16} className="mr-1.5" />
            Create Invoice
          </button>
          <button 
            onClick={() => setShowScanOptions(true)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50 flex items-center shadow-sm text-[10px]"
          >
            <Scan size={16} className="mr-1.5 text-primary" />
            Scan Invoice
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'strategy', label: 'Strategic Roadmap', icon: Target },
          { id: 'products', label: 'Product Matrix', icon: Package },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center space-x-2 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all",
              activeTab === tab.id 
                ? "bg-white text-primary shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            <tab.icon size={14} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* AI Insights Bar */}
          {aiInsights && (
            <div className="glass-card p-3 bg-gradient-to-r from-primary/5 to-purple-500/5 border-l-4 border-primary animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Sparkles className="text-primary" size={14} />
                    <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">AI Business Insights</h3>
                    <button 
                      onClick={fetchDashboardData}
                      disabled={isAnalyzing}
                      className="p-1 hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50"
                      title="Refresh Insights"
                    >
                      <Loader2 size={12} className={cn("text-primary", isAnalyzing && "animate-spin")} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                    {aiInsights.summary}
                  </p>
                </div>
                <div className="hidden md:flex flex-col items-center justify-center px-4 border-l border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Health Score</div>
                  <div className={cn(
                    "text-lg font-black",
                    aiInsights.healthScore > 80 ? "text-emerald-600" : aiInsights.healthScore > 60 ? "text-orange-600" : "text-red-600"
                  )}>
                    {aiInsights.healthScore}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Features Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Business Health Radar */}
            <div className="glass-card p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5">
                  <Activity size={14} className="text-primary" />
                  <h3 className="text-[11px] font-bold text-slate-900 uppercase">Business Balance</h3>
                </div>
                <div className="text-[9px] text-slate-400">Real-time Analysis</div>
              </div>
              <div className="h-48 w-full">
                {console.log('Rendering radar chart with aiInsights:', aiInsights)}
                {aiInsights ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={Array.isArray(aiInsights.radarData) ? aiInsights.radarData : []}>
                      <PolarGrid stroke="#f1f5f9" />
                      <PolarAngleAxis dataKey="subject" tick={{fontSize: 8, fill: '#64748b'}} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="Business"
                        dataKey="A"
                        stroke="#1e3a8a"
                        fill="#1e3a8a"
                        fillOpacity={0.6}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-[10px]">
                    {isAnalyzing ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <div className="text-center">
                        <p>No data available</p>
                        <button onClick={fetchDashboardData} className="text-primary underline mt-1">Retry</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Smart Recommendations */}
            <div className="glass-card p-3 flex flex-col">
              <div className="flex items-center space-x-1.5 mb-3">
                <Zap size={14} className="text-orange-500" />
                <h3 className="text-[11px] font-bold text-slate-900 uppercase">AI Recommendations</h3>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto max-h-48 pr-1 custom-scrollbar">
                {aiInsights?.recommendations?.map((rec, i) => (
                  <div key={i} className="flex items-start space-x-2 p-2 bg-slate-50 rounded-lg border border-slate-100 hover:border-primary/20 transition-all cursor-default group">
                    <div className="mt-0.5 p-1 bg-white rounded-md shadow-sm text-primary group-hover:scale-110 transition-transform">
                      <Target size={10} />
                    </div>
                    <p className="text-[10px] text-slate-600 leading-tight">{rec}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Anomaly Detection Feed */}
            <div className="glass-card p-3 flex flex-col">
              <div className="flex items-center space-x-1.5 mb-3">
                <ShieldAlert size={14} className="text-red-500" />
                <h3 className="text-[11px] font-bold text-slate-900 uppercase">Smart Alerts & Anomalies</h3>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto max-h-48 pr-1 custom-scrollbar">
                {aiInsights?.anomalies?.map((anomaly, i) => (
                  <div key={i} className="flex items-center space-x-2 p-2 bg-red-50/50 rounded-lg border border-red-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-[10px] text-red-700 font-medium">{anomaly}</p>
                  </div>
                ))}
                {(!aiInsights?.anomalies || aiInsights.anomalies?.length === 0) && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-8">
                    <ShieldAlert size={24} className="opacity-20 mb-2" />
                    <p className="text-[10px]">No anomalies detected</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {statCards.map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-4 flex flex-col justify-between hover:shadow-lg transition-all cursor-default group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("p-1.5 rounded-lg group-hover:scale-110 transition-transform", stat.bg, stat.color)}>
                    <stat.icon size={16} />
                  </div>
                  <div className={cn(
                    "flex items-center text-[8px] font-bold px-1 py-0.5 rounded-md",
                    stat.trend === 'up' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  )}>
                    {stat.trend === 'up' ? <ArrowUpRight size={10} className="mr-1" /> : <ArrowDownRight size={10} className="mr-1" />}
                    {stat.change}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-500">{stat.label}</p>
                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                    {formatCurrency(stat.value)}
                  </h3>
                  {stat.subValue && (
                    <p className="text-[9px] text-slate-400 mt-0.5">{stat.subValue}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* New Section: Cash Flow, Top Customers, and Tax */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-4 lg:col-span-2"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <TrendingUp size={16} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Cash Flow Summary</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[9px] text-slate-500">Inflow</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[9px] text-slate-500">Outflow</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Total Inflow</p>
                  <div className="text-lg font-black text-emerald-600">{formatCurrency(stats.paidAmount)}</div>
                  <p className="text-[8px] text-slate-500 mt-1">From {stats.paidInvoicesCount} paid invoices</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Pending Inflow</p>
                  <div className="text-lg font-black text-orange-600">{formatCurrency(stats.unpaidAmount)}</div>
                  <p className="text-[8px] text-slate-500 mt-1">From {stats.unpaidInvoicesCount} unpaid invoices</p>
                </div>
                <div className="p-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                  <p className="text-[9px] font-bold text-white/60 uppercase mb-1">Net Position</p>
                  <div className="text-lg font-black">{formatCurrency(stats.paidAmount - stats.unpaidAmount)}</div>
                  <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white transition-all duration-1000" 
                      style={{ width: `${(stats.paidAmount / (stats.paidAmount + stats.unpaidAmount || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                    <Users size={16} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top Customers</h3>
                </div>
                <button className="text-[9px] font-bold text-primary hover:underline">View All</button>
              </div>
              
              <div className="space-y-3">
                {topCustomers.length > 0 ? topCustomers.map((customer, i) => (
                  <div key={customer.id} className="flex items-center justify-between group">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-900">{customer.name}</p>
                        <p className="text-[8px] text-slate-400">Premium Client</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-900">{formatCurrency(customer.total)}</p>
                      <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-1000" 
                          style={{ width: `${(customer.total / (topCustomers[0]?.total || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Users size={24} className="opacity-20 mb-2" />
                    <p className="text-[10px]">No customer data yet</p>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
                    <IndianRupee size={16} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Tax Estimates</h3>
                </div>
                <div className="p-1 bg-orange-100 text-orange-700 rounded text-[8px] font-bold uppercase">AI Forecast</div>
              </div>
              
              <div className="space-y-3">
                {aiInsights?.taxEstimate?.map((tax, i) => (
                  <div key={i} className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">{tax.category}</span>
                      <span className="text-[9px] font-medium text-slate-400">{new Date(tax.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">{formatCurrency(tax.amount)}</div>
                  </div>
                ))}
                {!aiInsights?.taxEstimate && (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Activity size={24} className="opacity-20 mb-2" />
                    <p className="text-[10px]">Calculating tax...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-3 lg:col-span-2"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <TrendingUp size={16} />
                  </div>
                  <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">Revenue & AI Forecast</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-[9px] text-slate-500">Actual</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-[9px] text-slate-500">Forecast</span>
                  </div>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} tickFormatter={(val) => `₹${val/1000}k`} />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px'}}
                      formatter={(val: number) => [formatCurrency(val), 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#1e3a8a" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="forecast" stroke="#7c3aed" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                    <Users size={16} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Customer Segments</h3>
                </div>
                <div className="p-1 bg-purple-100 text-purple-700 rounded text-[8px] font-bold uppercase">AI Analysis</div>
              </div>
              
              <div className="space-y-4">
                {aiInsights?.clvInsights?.map((clv, i) => (
                  <div key={i} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          i === 0 ? "bg-emerald-500" : i === 1 ? "bg-blue-500" : "bg-slate-400"
                        )} />
                        <span className="text-[10px] font-bold text-slate-700">{clv.segment}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-900">{formatCurrency(clv.value)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(clv.value / (aiInsights.clvInsights[0]?.value || 1)) * 100}%` }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className={cn(
                          "h-full transition-all",
                          i === 0 ? "bg-emerald-500" : i === 1 ? "bg-blue-500" : "bg-slate-400"
                        )}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[8px] text-slate-400">{clv.count} Customers</span>
                      <span className="text-[8px] font-bold text-slate-500">Avg. {formatCurrency(clv.value / clv.count)}</span>
                    </div>
                  </div>
                ))}
                {!aiInsights?.clvInsights && (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Users size={24} className="opacity-20 mb-2" />
                    <p className="text-[10px]">Analyzing segments...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Recent Activity / Invoices */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">Recent Invoices</h3>
              <button className="text-[10px] font-bold text-primary hover:underline">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-[9px] font-bold uppercase tracking-wider">
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500 text-[10px]">
                        No invoices found. Start by creating one!
                      </td>
                    </tr>
                  ) : (
                    recentInvoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-[10px] font-medium text-slate-900">{invoice.invoice_number}</td>
                        <td className="px-4 py-3 text-[10px] text-slate-600">{invoice.customers?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-[10px] text-slate-500">{new Date(invoice.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-[10px] font-bold text-slate-900">{formatCurrency(invoice.total)}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                            invoice.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                          )}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-slate-400 hover:text-primary transition-colors">
                            <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'strategy' && (
        <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">AI Strategic Roadmap</h2>
                <p className="text-xs text-slate-500">Long-term business planning and milestone tracking.</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Target size={24} />
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100" />
              <div className="space-y-8">
                {aiInsights?.strategyRoadmap?.map((item, i) => (
                  <div key={i} className="relative pl-10">
                    <div className={cn(
                      "absolute left-0 w-8 h-8 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10",
                      item.priority === 'High' ? "bg-red-500" : item.priority === 'Medium' ? "bg-orange-500" : "bg-emerald-500"
                    )}>
                      <span className="text-[10px] font-bold text-white">{i + 1}</span>
                    </div>
                    <div className="glass-card p-4 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{item.phase}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase",
                          item.priority === 'High' ? "bg-red-100 text-red-700" : item.priority === 'Medium' ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {item.priority} Priority
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">{item.goal}</h4>
                      <div className="flex items-center text-[10px] text-slate-500">
                        <Calendar size={12} className="mr-1.5" />
                        {item.timeline}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Product Performance Matrix</h2>
                <p className="text-xs text-slate-500">BCG Matrix analysis of your product portfolio.</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-xl text-purple-600">
                <Package size={24} />
              </div>
            </div>

            <div className="h-80 w-full relative">
              {/* Matrix Background Labels */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none border border-slate-100">
                <div className="flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase">Question Marks</div>
                <div className="flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase">Stars</div>
                <div className="flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase">Dogs</div>
                <div className="flex items-center justify-center text-[10px] font-bold text-slate-300 uppercase">Cash Cows</div>
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    type="number" 
                    dataKey="growth" 
                    name="Growth" 
                    unit="%" 
                    label={{ value: 'Market Growth', position: 'bottom', fontSize: 10 }}
                    tick={{fontSize: 10}}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="sales" 
                    name="Sales" 
                    unit="$" 
                    label={{ value: 'Relative Market Share', angle: -90, position: 'left', fontSize: 10 }}
                    tick={{fontSize: 10}}
                  />
                  <ZAxis type="number" dataKey="sales" range={[100, 1000]} name="Volume" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{fontSize: 10, borderRadius: 12}} />
                  <Scatter name="Products" data={aiInsights?.productMatrix || []}>
                    {aiInsights?.productMatrix?.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.category === 'Star' ? '#10b981' : 
                          entry.category === 'Cash Cow' ? '#1e3a8a' : 
                          entry.category === 'Question Mark' ? '#f59e0b' : '#ef4444'
                        } 
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Portfolio Breakdown</h3>
            <div className="space-y-4">
              {aiInsights?.productMatrix?.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      item.category === 'Star' ? "bg-emerald-500" : 
                      item.category === 'Cash Cow' ? "bg-blue-500" : 
                      item.category === 'Question Mark' ? "bg-orange-500" : "bg-red-500"
                    )} />
                    <div>
                      <div className="text-[11px] font-bold text-slate-900">{item.name}</div>
                      <div className="text-[9px] text-slate-500">{item.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-bold text-slate-900">{formatCurrency(item.sales)}</div>
                    <div className={cn(
                      "text-[9px] font-bold",
                      item.growth > 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {item.growth > 0 ? '+' : ''}{item.growth}% Growth
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scenario Simulator Modal */}
      {showSimulator && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/20 rounded-xl">
                  <TrendingUp size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">What-If Scenario Simulator</h2>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">AI-Powered Predictive Modeling</p>
                </div>
              </div>
              <button onClick={() => setShowSimulator(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase">Select a Scenario</h3>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'price', label: '10% Price Increase', icon: IndianRupee, desc: 'Simulate impact of raising prices across all products.' },
                    { id: 'expansion', label: 'New Market Expansion', icon: Target, desc: 'Predict revenue from entering a new geographic region.' },
                    { id: 'marketing', label: 'Double Marketing Budget', icon: Zap, desc: 'Analyze ROI of increased advertising spend.' },
                    { id: 'efficiency', label: '20% Operational Efficiency', icon: Activity, desc: 'Impact of streamlining logistics and overhead.' }
                  ].map((s) => (
                    <button 
                      key={s.id}
                      onClick={() => { setSimulationScenario(s.label); handleSimulate(s.label); }}
                      className="flex items-start space-x-3 p-3 bg-slate-50 hover:bg-primary/5 border border-slate-100 hover:border-primary/30 rounded-2xl transition-all text-left group"
                    >
                      <div className="mt-1 p-1.5 bg-white rounded-lg shadow-sm group-hover:text-primary transition-colors">
                        <s.icon size={14} />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-900">{s.label}</div>
                        <div className="text-[9px] text-slate-500">{s.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
                
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900 uppercase mb-2">Custom Scenario</h3>
                  <div className="flex space-x-2">
                    <input 
                      type="text"
                      value={simulationScenario}
                      onChange={(e) => setSimulationScenario(e.target.value)}
                      placeholder="e.g., 'What if I hire 2 more sales reps?'"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button 
                      onClick={() => handleSimulate(simulationScenario)}
                      disabled={isSimulating || !simulationScenario.trim()}
                      className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isSimulating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100 flex flex-col">
                <h3 className="text-xs font-bold text-slate-900 uppercase mb-4 flex items-center">
                  <Lightbulb size={14} className="mr-2 text-orange-500" />
                  Simulation Results
                </h3>
                
                {isSimulating ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 size={32} className="animate-spin mb-3 text-primary" />
                    <p className="text-[10px] font-medium animate-pulse">Running AI models...</p>
                  </div>
                ) : simulationResult ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Projected Revenue Impact</div>
                      <div className="text-2xl font-black text-primary">
                        {formatCurrency(simulationResult.projectedRevenue)}
                      </div>
                      <div className="flex items-center mt-1">
                        <div className="text-[10px] font-bold text-emerald-600 flex items-center">
                          <TrendingUp size={12} className="mr-1" />
                          Confidence: {simulationResult.confidence}%
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-slate-900 uppercase mb-2">AI Analysis</h4>
                      <p className="text-[10px] text-slate-600 leading-relaxed italic">
                        "{simulationResult.impact}"
                      </p>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-slate-900 uppercase mb-2">Potential Risks</h4>
                      <div className="space-y-1">
                        {simulationResult?.risks?.map((risk, i) => (
                          <div key={i} className="flex items-center space-x-2 text-[9px] text-red-600 font-medium">
                            <ShieldAlert size={10} />
                            <span>{risk}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button className="w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors mt-auto">
                      Generate Detailed Report
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                    <History size={32} className="opacity-20 mb-3" />
                    <p className="text-[10px]">Select or type a scenario to see AI-powered predictions.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scan Invoice Options Modal */}
      {showScanOptions && (
        <ScanOptionsModal 
          onClose={() => setShowScanOptions(false)} 
          onFileSelect={handleFileSelect} 
        />
      )}
    </motion.div>
  );
}
