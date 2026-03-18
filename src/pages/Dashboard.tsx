import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
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
  Upload
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
  Area
} from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
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
    lowStockItems: 0
  });
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [showScanOptions, setShowScanOptions] = useState(false);

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
      if (!businessId) return;

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
      
      setStats({
        totalRevenue,
        activeInvoices: invoices?.length || 0,
        totalCustomers: customerCount || 0,
        lowStockItems: lowStockProducts?.length || 0
      });

      // 3. Fetch Recent Invoices
      const { data: recent } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (name)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recent) setRecentInvoices(recent);

      // 4. Prepare Chart Data (Mocking monthly aggregation for now)
      setChartData([
        { name: 'Jan', revenue: totalRevenue * 0.1 },
        { name: 'Feb', revenue: totalRevenue * 0.15 },
        { name: 'Mar', revenue: totalRevenue * 0.25 },
        { name: 'Apr', revenue: totalRevenue * 0.2 },
        { name: 'May', revenue: totalRevenue * 0.1 },
        { name: 'Jun', revenue: totalRevenue * 0.2 },
      ]);

    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Revenue', value: stats.totalRevenue, change: '+12.5%', trend: 'up', icon: IndianRupee, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Invoices', value: stats.activeInvoices, change: '+8.2%', trend: 'up', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Total Customers', value: stats.totalCustomers, change: '+4.1%', trend: 'up', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Low Stock Items', value: stats.lowStockItems, change: '-2.4%', trend: 'down', icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Business Overview</h1>
          <p className="text-slate-500">Welcome back, here's what's happening today.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 flex items-center text-sm font-medium text-slate-600 shadow-sm hidden sm:flex">
            <Calendar size={16} className="mr-2" />
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <button 
            onClick={() => navigate('/invoices/new')}
            className="btn-primary flex items-center"
          >
            <Plus size={18} className="mr-2" />
            Create Invoice
          </button>
          <button 
            onClick={() => setShowScanOptions(true)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 flex items-center shadow-sm"
          >
            <Scan size={18} className="mr-2 text-primary" />
            Scan Invoice
          </button>
        </div>
      </div>

      {/* Hidden File Inputs for Scanning */}
      <input 
        type="file" 
        accept="image/*,.pdf" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
      />
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        ref={cameraInputRef} 
        onChange={handleFileSelect} 
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="glass-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-xl", stat.bg, stat.color)}>
                <stat.icon size={24} />
              </div>
              <div className={cn(
                "flex items-center text-xs font-bold px-2 py-1 rounded-lg",
                stat.trend === 'up' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              )}>
                {stat.trend === 'up' ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownRight size={14} className="mr-1" />}
                {stat.change}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {stat.label.includes('Revenue') ? formatCurrency(stat.value) : stat.value}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Revenue Trends</h3>
            <select className="bg-slate-50 border-none text-xs font-medium rounded-lg px-2 py-1 outline-none">
              <option>Last 6 Months</option>
              <option>Last Year</option>
            </select>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="revenue" stroke="#1e3a8a" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">Sales Distribution</h3>
            <button className="text-xs font-bold text-primary hover:underline">View Details</button>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => formatCurrency(value)}
                />
                <Bar dataKey="revenue" fill="#7c3aed" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity / Invoices */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Recent Invoices</h3>
          <button className="text-sm font-bold text-primary">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No invoices found. Start by creating one!
                  </td>
                </tr>
              ) : (
                recentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{invoice.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{invoice.customers?.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{new Date(invoice.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(invoice.total)}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        invoice.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-slate-400 hover:text-primary transition-colors">
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scan Invoice Options Modal */}
      {showScanOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">
                <Scan className="mr-2 text-primary" />
                Scan Invoice
              </h2>
              <button onClick={() => setShowScanOptions(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-500 text-sm text-center mb-6">Choose how you want to scan your invoice.</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary mb-3 transition-colors">
                    <Camera size={24} />
                  </div>
                  <span className="font-bold text-slate-700 group-hover:text-primary">Camera</span>
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary mb-3 transition-colors">
                    <Upload size={24} />
                  </div>
                  <span className="font-bold text-slate-700 group-hover:text-primary">Upload File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
