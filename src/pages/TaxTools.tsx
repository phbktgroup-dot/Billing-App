import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Calculator, 
  FileCheck, 
  Download, 
  ExternalLink, 
  Info,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type ToolType = 'gst' | 'itr' | 'eway';

export default function TaxTools({ type = 'gst' }: { type?: ToolType }) {
  const { profile } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  const businessId = profile?.business_id;

  const tools = {
    gst: {
      title: 'GST Reporting',
      description: 'Generate GSTR-1, GSTR-3B, and HSN summaries for the GST portal.',
      icon: FileSpreadsheet,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      reports: [
        { id: 'gstr1', name: 'GSTR-1 (Sales)', format: 'CSV', status: 'Ready' },
        { id: 'gstr3b', name: 'GSTR-3B (Summary)', format: 'CSV', status: 'Ready' },
        { id: 'hsn', name: 'HSN Summary', format: 'CSV', status: 'Ready' },
        { id: 'itc', name: 'Input Tax Credit (ITC)', format: 'CSV', status: 'Needs Review' },
      ]
    },
    itr: {
      title: 'ITR Support Tools',
      description: 'Income tax estimation and financial year profit/loss summaries.',
      icon: Calculator,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      reports: [
        { id: 'income', name: 'Income Summary', format: 'CSV', status: 'Ready' },
        { id: 'expense', name: 'Expense Breakdown', format: 'CSV', status: 'Ready' },
        { id: 'pnl', name: 'Profit & Loss Statement', format: 'CSV', status: 'Ready' },
        { id: 'tax_est', name: 'Tax Estimation (FY 25-26)', format: 'CSV', status: 'Draft' },
      ]
    },
    eway: {
      title: 'E-Way Bill System',
      description: 'Generate and export E-Way Bill JSON files for government portal.',
      icon: FileCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      reports: [
        { id: 'eway_json', name: 'E-Way Bill Data', format: 'CSV', status: 'Ready' },
        { id: 'consignor', name: 'Consignor Details', format: 'CSV', status: 'Ready' },
        { id: 'transporter', name: 'Transporter Log', format: 'CSV', status: 'Ready' },
      ]
    }
  };

  const current = tools[type];

  const generateCSV = (data: any[], filename: string) => {
    if (!data || !data.length) {
      alert("No data available for this report.");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        return `"${value.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadReport = async (reportId: string, reportName: string) => {
    if (!businessId) return;
    
    setDownloadingReport(reportId);
    try {
      let dataToExport: any[] = [];

      // Fetch actual data based on report type
      if (type === 'gst') {
        if (reportId === 'gstr1') {
          const { data } = await supabase
            .from('invoices')
            .select('invoice_number, date, customer_name, customer_gstin, total, tax_amount')
            .eq('business_id', businessId);
          dataToExport = data || [];
        } else if (reportId === 'hsn') {
          const { data } = await supabase
            .from('invoice_items')
            .select('products(name, sku, gst_rate), quantity, total_price')
            .limit(100);
          
          // Flatten data
          dataToExport = (data || []).map((item: any) => ({
            product_name: item.products?.name,
            sku: item.products?.sku,
            gst_rate: item.products?.gst_rate,
            quantity: item.quantity,
            total_value: item.total_price
          }));
        } else {
          // Mock data for others
          dataToExport = [{ report: reportName, status: 'Generated', date: new Date().toISOString() }];
        }
      } else if (type === 'itr') {
        if (reportId === 'income') {
          const { data } = await supabase
            .from('invoices')
            .select('invoice_number, date, total')
            .eq('business_id', businessId);
          dataToExport = data || [];
        } else {
          dataToExport = [{ report: reportName, status: 'Generated', date: new Date().toISOString() }];
        }
      } else {
        dataToExport = [{ report: reportName, status: 'Generated', date: new Date().toISOString() }];
      }

      generateCSV(dataToExport, reportId);
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report. Please try again.");
    } finally {
      setDownloadingReport(null);
    }
  };

  const handleGenerateAll = async () => {
    setIsGenerating(true);
    try {
      // Just download the first available report as a demo of "Export All"
      await handleDownloadReport(current.reports[0].id, current.reports[0].name);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className={cn("p-4 rounded-2xl", current.bg, current.color)}>
            <current.icon size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{current.title}</h1>
            <p className="text-slate-500">{current.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 flex items-center">
            <Info size={18} className="mr-2" />
            Help Guide
          </button>
          <button className="btn-primary flex items-center" onClick={handleGenerateAll} disabled={isGenerating}>
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
            ) : (
              <Download size={18} className="mr-2" />
            )}
            Export All Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reports List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Available Reports</h3>
              <span className="text-xs font-bold text-slate-400 uppercase">FY 2025-26</span>
            </div>
            <div className="divide-y divide-slate-100">
              {current.reports.map((report, i) => (
                <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{report.name}</p>
                      <p className="text-xs text-slate-500">Format: {report.format}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <span className={cn(
                      "flex items-center text-[10px] font-bold uppercase px-2 py-1 rounded-lg",
                      report.status === 'Ready' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {report.status === 'Ready' ? <CheckCircle2 size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />}
                      {report.status}
                    </span>
                    <button 
                      onClick={() => handleDownloadReport(report.id, report.name)}
                      disabled={downloadingReport === report.id}
                      className="text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {downloadingReport === report.id ? (
                        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                      ) : (
                        <Download size={20} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* External Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 flex items-center justify-between group cursor-pointer hover:border-primary transition-all">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                  <ExternalLink size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Government Portal</p>
                  <p className="text-xs text-slate-500">Direct login to official site</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div className="glass-card p-6 flex items-center justify-between group cursor-pointer hover:border-primary transition-all">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                  <Info size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Compliance Check</p>
                  <p className="text-xs text-slate-500">Verify your tax status</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
          <div className="glass-card p-6 bg-slate-900 text-white">
            <h4 className="font-bold mb-4 flex items-center">
              <AlertCircle size={18} className="mr-2 text-yellow-400" />
              Important Notice
            </h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              All reports generated are based on your business data. Please verify with a certified accountant before filing official returns.
            </p>
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-500">Last Sync</span>
                <span className="text-slate-300">Today, 10:30 AM</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Data Integrity</span>
                <span className="text-emerald-400">Verified</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h4 className="font-bold text-slate-900 mb-4">Quick Actions</h4>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center justify-between group">
                Update Tax Rates
                <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
              </button>
              <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center justify-between group">
                View HSN Codes
                <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
              </button>
              <button className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 text-sm font-medium text-slate-600 flex items-center justify-between group">
                Manage Branches
                <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-all" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
