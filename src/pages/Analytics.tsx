import React, { useState } from 'react';
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
  PieChart as PieChartIcon
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
  Area
} from 'recharts';
import { GoogleGenAI } from '@google/genai';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

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

  const businessName = profile?.business_profiles?.name || 'PHBKT Group';

  const askAI = async () => {
    if (!query.trim()) return;
    setIsThinking(true);
    setAiResponse(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `As a business advisor for ${businessName}, answer this query based on current business trends: ${query}`
      });
      setAiResponse(response.text);
    } catch (error) {
      setAiResponse("I'm sorry, I couldn't process that right now. Please try again.");
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <BrainCircuit className="mr-3 text-primary" size={28} />
            AI Business Analytics
          </h1>
          <p className="text-slate-500">Next-generation insights powered by Google Gemini AI.</p>
        </div>
        <div className="flex items-center space-x-2 bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
          <Sparkles className="text-primary" size={18} />
          <span className="text-sm font-bold text-primary uppercase tracking-wider">AI Powered</span>
        </div>
      </div>

      {/* Prediction Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900">Sales Forecasting</h3>
              <p className="text-xs text-slate-500">AI-predicted revenue for the next 3 months</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-xs">
                <div className="w-3 h-3 bg-primary rounded-full mr-2"></div>
                Actual
              </div>
              <div className="flex items-center text-xs">
                <div className="w-3 h-3 bg-primary/30 rounded-full mr-2"></div>
                Predicted
              </div>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={predictionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="actual" stroke="#1e3a8a" strokeWidth={3} fill="#1e3a8a" fillOpacity={0.1} />
                <Area type="monotone" dataKey="predicted" stroke="#1e3a8a" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 bg-gradient-to-br from-primary to-blue-900 text-white">
            <div className="flex items-center justify-between mb-4">
              <Lightbulb size={24} className="text-yellow-400" />
              <span className="text-[10px] font-bold uppercase bg-white/10 px-2 py-1 rounded">Insight of the Day</span>
            </div>
            <h4 className="font-bold text-lg mb-2">Inventory Optimization</h4>
            <p className="text-sm text-blue-100 leading-relaxed">
              AI suggests reducing stock for "Wireless Mouse" by 15% and increasing "4K Monitors" by 20% based on seasonal demand trends.
            </p>
            <button className="mt-4 flex items-center text-sm font-bold hover:underline">
              Apply Suggestion <ArrowRight size={16} className="ml-2" />
            </button>
          </div>

          <div className="glass-card p-6">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center">
              <Target size={18} className="mr-2 text-emerald-500" />
              Growth Targets
            </h4>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Revenue Goal</span>
                  <span className="font-bold text-slate-900">75%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-3/4 rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Customer Acquisition</span>
                  <span className="font-bold text-slate-900">42%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[42%] rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Advisor Chat */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">AI Business Advisor</h3>
            <p className="text-xs text-slate-500">Ask anything about your business performance</p>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="min-h-[200px] bg-slate-50 rounded-2xl p-6 relative">
            {isThinking ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-slate-500">Consulting Gemini AI...</p>
              </div>
            ) : aiResponse ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="prose prose-slate max-w-none text-sm text-slate-700 leading-relaxed"
              >
                {aiResponse}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                <Sparkles className="text-slate-300" size={48} />
                <p className="text-slate-400 text-sm">Try asking: "How can I improve my profit margin this month?"</p>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <input 
              type="text" 
              placeholder="Type your business query here..."
              className="flex-1 input-field"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askAI()}
            />
            <button 
              onClick={askAI}
              disabled={isThinking || !query.trim()}
              className="btn-primary px-8 py-3 flex items-center"
            >
              Analyze
              <ArrowRight size={18} className="ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
