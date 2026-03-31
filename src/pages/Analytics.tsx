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
import { cn, formatCurrency, getDateRange, FilterType } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import { DateFilter } from '../components/DateFilter';

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
            AI Business Analytics
          </>
        }
        description="Leverage AI-driven insights to understand your sales trends, customer behavior, and growth opportunities."
      >
        <div className="flex items-center space-x-2">
          
          <div className="flex items-center space-x-1.5 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
            <Sparkles className="text-primary" size={14} />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">AI Powered</span>
          </div>
        </div>
      </PageHeader>

      {/* Prediction Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Sales Forecasting</h3>
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

        <div className="space-y-4">
          <div className="glass-card p-4 bg-gradient-to-br from-primary to-blue-900 text-white">
            <div className="flex items-center justify-between mb-3">
              <Lightbulb size={18} className="text-yellow-400" />
              <span className="text-[8px] font-bold uppercase bg-white/10 px-1.5 py-0.5 rounded">Insight of the Day</span>
            </div>
            <h4 className="font-bold text-base mb-1.5">Inventory Optimization</h4>
            <p className="text-xs text-blue-100 leading-relaxed">
              AI suggests reducing stock for "Wireless Mouse" by 15% and increasing "4K Monitors" by 20% based on seasonal demand trends.
            </p>
            <button className="mt-3 flex items-center text-xs font-bold hover:underline h-10 sm:h-9">
              Apply Suggestion <ArrowRight size={14} className="ml-1.5" />
            </button>
          </div>

          <div className="glass-card p-4">
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
    </div>
  );
}
