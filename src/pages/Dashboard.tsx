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
  SimulationResult,
  getProactiveActions,
  ProactiveAction
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
  const [proactiveActions, setProactiveActions] = useState<ProactiveAction[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [simulationScenario, setSimulationScenario] = useState('');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const businessId = profile?.business_id;
  console.log('Dashboard businessId:', businessId, 'Profile:', profile);

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
  }, [businessId, profile?.business_profiles?.gemini_api_key]);

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
      
      // Call AI insights after basic data is loaded
      fetchAIInsights(
        {
          totalRevenue,
          activeInvoices: invoices?.length || 0,
          totalCustomers: customerCount || 0,
          lowStockItems: lowStockProducts?.length || 0
        },
        invoices,
        businessId
      );
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      setLoading(false);
    }
  };

  const fetchAIInsights = async (statsData: any, invoicesData: any, businessId: string) => {
    setIsAnalyzing(true);
    setAiError(null);
    // Clear previous insights to show loading state
    setAiInsights(null);
    setProactiveActions([]);
    
    const apiKey = profile?.business_profiles?.gemini_api_key;
    console.log('Fetching AI insights...', 'Using API Key:', apiKey ? `Provided (${apiKey.substring(0, 4)}...)` : 'Default');
    
    try {
      // We use Promise.allSettled to handle partial failures gracefully
      const results = await Promise.allSettled([
        generateBusinessInsights({
          stats: statsData,
          recentInvoices: invoicesData?.slice(0, 20).map((inv: any) => ({ total: inv.total, status: inv.status, date: inv.date }))
        }, businessId, apiKey),
        getProactiveActions({
          stats: statsData,
          recentInvoices: invoicesData?.slice(0, 20).map((inv: any) => ({ total: inv.total, status: inv.status, date: inv.date }))
        }, businessId, apiKey)
      ]);

      const insightsResult = results[0];
      const actionsResult = results[1];

      if (insightsResult.status === 'fulfilled') {
        setAiInsights(insightsResult.value);
        // Update chart with forecast
        if (insightsResult.value.forecast && insightsResult.value.forecast.length > 0) {
          const baseChartData = chartData.filter(d => d.revenue !== null);
          const lastActual = baseChartData[baseChartData.length - 1];
          const forecastData = insightsResult.value.forecast.map((f: any) => ({
            name: f.month,
            revenue: null,
            forecast: f.revenue
          }));
          
          // Connect the actual to the forecast
          const connectionPoint = { ...lastActual, forecast: lastActual.revenue };
          setChartData([...baseChartData.slice(0, -1), connectionPoint, ...forecastData]);
        }
      } else {
        console.error("AI Insights failed:", insightsResult.reason);
        if (insightsResult.reason.message?.includes('quota')) {
          setAiError(insightsResult.reason.message);
        }
      }

      if (actionsResult.status === 'fulfilled') {
        setProactiveActions(actionsResult.value);
      } else {
        console.error("AI Proactive Actions failed:", actionsResult.reason);
        if (actionsResult.reason.message?.includes('quota') && !aiError) {
          setAiError(actionsResult.reason.message);
        }
      }

    } catch (unexpectedError: any) {
      console.error("Unexpected AI error:", unexpectedError);
      setAiError("An unexpected error occurred while generating AI insights.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    
    setIsAsking(true);
    setAiAnswer(null);
    const apiKey = profile?.business_profiles?.gemini_api_key;
    console.log('AI Command Center: Asking question...', aiQuestion, 'Using API Key:', apiKey ? 'Provided' : 'Default');
    try {
      const answer = await askBusinessQuestion(aiQuestion, { stats, recentInvoices, aiInsights }, apiKey);
      setAiAnswer(answer);
    } catch (error: any) {
      console.error("Ask AI Error:", error);
      if (error.message?.includes('quota')) {
        setAiError(error.message);
      } else {
        setAiAnswer("The AI consultant is currently unavailable. Please try again later.");
      }
    } finally {
      setIsAsking(false);
    }
  };

  const handleSimulate = async (scenario: string) => {
    setIsSimulating(true);
    setSimulationResult(null);
    const apiKey = profile?.business_profiles?.gemini_api_key;
    console.log('AI Simulator: Running scenario...', scenario, 'Using API Key:', apiKey ? 'Provided' : 'Default');
    try {
      const result = await simulateScenario(scenario, { stats, aiInsights }, apiKey);
      setSimulationResult(result);
    } catch (error: any) {
      console.error("Simulation Error:", error);
      if (error.message?.includes('quota')) {
        setAiError(error.message);
        setShowSimulator(false);
      }
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

      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800 p-6 rounded-2xl text-white shadow-xl border border-slate-700">
        <div>
          <h1 className="text-lg font-bold text-white">Business Co-pilot Dashboard</h1>
          <p className="text-[11px] text-slate-400">AI-powered insights and predictive analytics for your enterprise.</p>
        </div>
        <div className="flex items-center space-x-2 justify-end">
          <div className="bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-600 flex items-center text-[10px] font-medium text-slate-300 shadow-sm hidden sm:flex">
            <Calendar size={14} className="mr-2 text-primary" />
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <button 
            onClick={() => navigate('/invoices/new')}
            className="bg-white text-slate-900 hover:bg-slate-50 flex items-center text-[10px] font-bold px-3 py-2.5 rounded-lg shadow-sm transition-all"
          >
            <Plus size={16} className="mr-1.5 text-primary" />
            Create Invoice
          </button>
          <button 
            onClick={() => setShowScanOptions(true)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 hover:bg-slate-50 flex items-center shadow-sm text-[10px] transition-colors"
          >
            <Scan size={16} className="mr-1.5 text-primary" />
            Scan Invoice
          </button>
        </div>
      </div>

      {/* Scenario Simulator Modal */}

      {/* Scenario Simulator Modal */}
      {showSimulator && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-800/60 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-slate-800 text-white flex items-center justify-between">
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

                    <button className="w-full py-2 bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors mt-auto">
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

      {/* AI Command Center & Ask AI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-4 bg-slate-800 text-white border-none shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <Sparkles size={120} />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <MessageSquare size={16} className="text-primary-foreground" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-widest">AI Command Center</h2>
              {isAnalyzing && (
                <div className="flex items-center space-x-2 ml-auto">
                  <Loader2 size={12} className="animate-spin text-primary" />
                  <span className="text-[9px] font-bold text-slate-400 animate-pulse uppercase tracking-widest">Analyzing...</span>
                </div>
              )}
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

            {aiError && (
              <div className="mt-4 p-3 bg-red-900/20 rounded-xl border border-red-900/30 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <AlertCircle size={14} className="text-red-400" />
                    <p className="text-[10px] text-red-200">{aiError}</p>
                  </div>
                  <button 
                    onClick={() => fetchDashboardData()}
                    className="text-[9px] font-bold text-white bg-red-600 hover:bg-red-500 px-2 py-1 rounded transition-colors"
                  >
                    Retry
                  </button>
                </div>
                {aiError.toLowerCase().includes('quota') && (
                  <div className="pt-2 border-t border-red-900/20">
                    <p className="text-[9px] text-red-300">
                      {profile?.business_profiles?.gemini_api_key 
                        ? "Tip: Your personal key has reached its limit. Check your Google AI Studio billing or try again later."
                        : <>Tip: You can add your own Gemini API key in <button onClick={() => navigate('/settings?tab=security')} className="underline font-bold hover:text-white">Settings</button> to avoid shared quota limits.</>}
                    </p>
                  </div>
                )}
              </div>
            )}

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
            
            {/* AI Insights Summary */}
            {aiInsights && (
              <div className="mt-6 pt-6 border-t border-slate-700/50 animate-in fade-in duration-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Business Health</h3>
                      <span className={cn(
                        "text-[10px] font-black",
                        aiInsights.healthScore > 80 ? "text-emerald-400" : aiInsights.healthScore > 60 ? "text-orange-400" : "text-red-400"
                      )}>
                        {aiInsights.healthScore}/100
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${aiInsights.healthScore}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={cn(
                          "h-full rounded-full",
                          aiInsights.healthScore > 80 ? "bg-emerald-500" : aiInsights.healthScore > 60 ? "bg-orange-500" : "bg-red-500"
                        )}
                      />
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-medium italic">
                      "{aiInsights.summary}"
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Key Recommendations</h3>
                    <div className="space-y-1.5">
                      {aiInsights.recommendations.slice(0, 2).map((rec, i) => (
                        <div key={i} className="flex items-start space-x-2">
                          <div className="mt-1 w-1 h-1 rounded-full bg-primary shrink-0" />
                          <p className="text-[10px] text-slate-400 leading-snug">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Proactive Actions */}
        <div className="glass-card p-4 bg-white border border-slate-100 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-orange-50 rounded-lg">
                <Zap size={16} className="text-orange-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Proactive Actions</h2>
            </div>
            {proactiveActions.length > 0 && (
              <span className="text-[9px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full uppercase">
                {proactiveActions.length} New
              </span>
            )}
          </div>
          
          <div className="flex-1 space-y-3">
            {isAnalyzing && proactiveActions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Loader2 size={24} className="animate-spin opacity-20" />
                <p className="text-[9px] font-bold uppercase tracking-widest">Identifying opportunities...</p>
              </div>
            ) : proactiveActions.length > 0 ? (
              proactiveActions.map((action, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary/30 transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-[11px] font-bold text-slate-900 group-hover:text-primary transition-colors">{action.title}</h3>
                    <span className={cn(
                      "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                      action.impact === 'High' ? "bg-red-50 text-red-600" : 
                      action.impact === 'Medium' ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {action.impact}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug mb-2">{action.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{action.actionType}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{action.effort} Effort</span>
                    </div>
                    <ArrowRight size={12} className="text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </motion.div>
              ))
            ) : aiError?.toLowerCase().includes('quota') ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-4 space-y-3">
                <AlertCircle size={32} className="text-orange-400 opacity-50" />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-600 uppercase">
                    {profile?.business_profiles?.gemini_api_key ? 'Personal Quota Reached' : 'Quota Limit Reached'}
                  </p>
                  <p className="text-[9px] leading-relaxed">
                    {profile?.business_profiles?.gemini_api_key 
                      ? 'Your personal Gemini API key has reached its quota limit. Please check your Google AI Studio billing.'
                      : 'AI features are temporarily limited. Add your own API key in settings to avoid shared limits.'}
                  </p>
                </div>
                <button 
                  onClick={() => navigate('/settings?tab=security')}
                  className="text-[9px] font-bold text-primary hover:underline uppercase tracking-widest"
                >
                  {profile?.business_profiles?.gemini_api_key ? 'Manage API Key' : 'Go to Settings'}
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-4">
                <Target size={32} className="opacity-10 mb-2" />
                <p className="text-[10px]">No proactive actions identified yet.</p>
              </div>
            )}
          </div>
          
          <button className="w-full mt-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors">
            View All Actions
          </button>
        </div>

        {/* Scenario Simulator Trigger */}
        <div 
          onClick={() => setShowSimulator(true)}
          className="glass-card p-4 bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-none shadow-xl cursor-pointer hover:scale-[1.02] transition-all group relative overflow-hidden flex flex-col"
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

      {/* Core Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={cn("p-2 rounded-xl", stat.bg)}>
                <stat.icon size={16} className={stat.color} />
              </div>
              <div className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-lg flex items-center",
                stat.trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {stat.trend === 'up' ? <ArrowUpRight size={10} className="mr-1" /> : <ArrowDownRight size={10} className="mr-1" />}
                {stat.change}
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-lg font-black text-slate-900">
                {typeof stat.value === 'number' && stat.label.includes('Revenue') || stat.label.includes('Amount') 
                  ? formatCurrency(stat.value) 
                  : stat.value}
              </h3>
              {stat.subValue && (
                <p className="text-[9px] font-bold text-slate-400">{stat.subValue}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & AI Forecast */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center">
                <TrendingUp size={16} className="mr-2 text-primary" />
                Revenue & AI Forecast
              </h3>
              <p className="text-[10px] text-slate-500">Actual revenue vs AI-predicted growth</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[9px] font-bold text-slate-500 uppercase">Actual</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-200" />
                <span className="text-[9px] font-bold text-slate-500 uppercase">Forecast</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
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
                  tickFormatter={(value) => `₹${value/1000}k`}
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
                />
                <Area 
                  type="monotone" 
                  dataKey="forecast" 
                  stroke="#cbd5e1" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="transparent" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
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
                    <div className="text-[11px] font-bold text-slate-900">{customer.name}</div>
                    <div className="text-[9px] text-slate-500">Premium Tier</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-black text-slate-900">{formatCurrency(customer.total)}</div>
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
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
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
                  <th className="pb-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Invoice</th>
                  <th className="pb-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                  <th className="pb-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="pb-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="pb-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-3">
                      <div className="text-[11px] font-bold text-slate-900">#{invoice.invoice_number || invoice.id.slice(0, 8)}</div>
                    </td>
                    <td className="py-3">
                      <div className="text-[11px] font-medium text-slate-600">
                        {Array.isArray(invoice.customers) ? invoice.customers[0]?.name : invoice.customers?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="py-3 text-[10px] text-slate-500">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div className="text-[11px] font-black text-slate-900">{formatCurrency(invoice.total)}</div>
                    </td>
                    <td className="py-3">
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
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
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
      </div>
    </motion.div>

  );
}
