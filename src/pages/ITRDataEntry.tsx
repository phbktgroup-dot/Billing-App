import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Building2, User, FileText, CheckCircle2, TrendingUp, TrendingDown, Receipt, ShoppingBag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';

export default function ITRDataEntry() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const businessId = profile?.business_id;

  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [financialSummary, setFinancialSummary] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    netProfit: 0
  });

  const [formData, setFormData] = useState({
    // Personal / Entity Details
    firstName: '',
    middleName: '',
    lastName: '',
    dobOrFormationDate: '',
    
    // Additional Address Details
    flatDoorBlock: '',
    premisesBuilding: '',
    roadStreet: '',
    areaLocality: '',
    
    // Business Specifics
    tradeName: '',
    natureOfBusinessCode: '',
    cinNumber: '', // For ITR-6
    registrationDetails: '', // For ITR-7
    
    // Filing & Status
    residentialStatus: 'RES',
    filingStatus: '11', // 139(1)
    aadharNumber: '',
    gender: 'M',
    fatherName: '',
    
    // Audit Information
    liableForAudit: 'No',
    auditorName: '',
    auditorMembershipNo: '',
    dateOfAuditReport: '',
    
    // Bank Details
    bankAccountNo: '',
    ifscCode: '',
    bankName: ''
  });

  useEffect(() => {
    if (businessId) {
      const savedData = localStorage.getItem(`itr_data_${businessId}`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setFormData(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error("Failed to parse saved ITR data");
        }
      }
      fetchFinancialData();
    }
  }, [businessId]);

  const fetchFinancialData = async () => {
    if (!businessId) return;

    try {
      const [invoicesRes, purchasesRes, expensesRes] = await Promise.all([
        supabase.from('invoices').select('total').eq('business_id', businessId),
        supabase.from('purchases').select('total_amount').eq('business_id', businessId),
        supabase.from('expenses').select('amount').eq('business_id', businessId)
      ]);

      const totalSales = invoicesRes.data?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const totalPurchases = purchasesRes.data?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
      const totalExpenses = expensesRes.data?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const netProfit = totalSales - totalPurchases - totalExpenses;

      setFinancialSummary({
        totalSales,
        totalPurchases,
        totalExpenses,
        netProfit
      });
    } catch (error) {
      console.error("Error fetching financial data:", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;

    // Basic Validation
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const aadharRegex = /^[0-9]{12}$/;
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

    if (formData.aadharNumber && !aadharRegex.test(formData.aadharNumber)) {
      alert("Invalid Aadhar Number. Must be 12 digits.");
      return;
    }

    if (formData.ifscCode && !ifscRegex.test(formData.ifscCode.toUpperCase())) {
      alert("Invalid IFSC Code format.");
      return;
    }

    setIsSaving(true);
    try {
      localStorage.setItem(`itr_data_${businessId}`, JSON.stringify(formData));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-4">
        <button 
          onClick={() => navigate('/tax-tools')}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-500" />
        </button>
        <PageHeader 
          title="Complete ITR Profile" 
          description="Fill in the required fields for ITR-3, ITR-4, ITR-5, ITR-6, and ITR-7 compliance."
        />
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Financial Summary (Read-only) */}
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                <TrendingUp size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Financial Summary</h2>
                <p className="text-xs text-slate-500">Automatically pulled from your invoices, purchases, and expenses.</p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${financialSummary.netProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
              {financialSummary.netProfit >= 0 ? 'Profit' : 'Loss'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Sales</span>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-slate-900">₹{financialSummary.totalSales.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Purchases</span>
                <ShoppingBag size={14} className="text-blue-500" />
              </div>
              <div className="text-lg font-bold text-slate-900">₹{financialSummary.totalPurchases.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Expenses</span>
                <Receipt size={14} className="text-amber-500" />
              </div>
              <div className="text-lg font-bold text-slate-900">₹{financialSummary.totalExpenses.toLocaleString()}</div>
            </div>
            <div className={`p-4 rounded-2xl border ${financialSummary.netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${financialSummary.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Net {financialSummary.netProfit >= 0 ? 'Profit' : 'Loss'}</span>
                {financialSummary.netProfit >= 0 ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-rose-500" />}
              </div>
              <div className={`text-lg font-bold ${financialSummary.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>₹{Math.abs(financialSummary.netProfit).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Personal / Entity Details */}
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <User size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Personal / Entity Details</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
              <input type="text" name="firstName" value={formData.firstName || ''} onChange={handleChange} className="input-field text-sm" placeholder="First Name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Middle Name</label>
              <input type="text" name="middleName" value={formData.middleName || ''} onChange={handleChange} className="input-field text-sm" placeholder="Middle Name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
              <input type="text" name="lastName" value={formData.lastName || ''} onChange={handleChange} className="input-field text-sm" placeholder="Last Name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">DOB / Date of Formation</label>
              <input type="date" name="dobOrFormationDate" value={formData.dobOrFormationDate || ''} onChange={handleChange} className="input-field text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Gender</label>
              <select name="gender" value={formData.gender || 'M'} onChange={handleChange} className="input-field text-sm">
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Father's Name</label>
              <input type="text" name="fatherName" value={formData.fatherName || ''} onChange={handleChange} className="input-field text-sm" placeholder="Father's Name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Aadhar Number (12 digits)</label>
              <input 
                type="text" 
                name="aadharNumber" 
                value={formData.aadharNumber || ''} 
                onChange={e => setFormData({...formData, aadharNumber: e.target.value.replace(/\D/g, '')})} 
                className="input-field text-sm" 
                placeholder="1234 5678 9012" 
                maxLength={12} 
              />
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-700 pt-4">Detailed Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Flat/Door/Block No.</label>
              <input type="text" name="flatDoorBlock" value={formData.flatDoorBlock || ''} onChange={handleChange} className="input-field text-sm" placeholder="e.g. Flat 101" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Name of Premises/Building</label>
              <input type="text" name="premisesBuilding" value={formData.premisesBuilding || ''} onChange={handleChange} className="input-field text-sm" placeholder="e.g. Tech Park" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Road/Street/Post Office</label>
              <input type="text" name="roadStreet" value={formData.roadStreet || ''} onChange={handleChange} className="input-field text-sm" placeholder="e.g. Main Street" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Area/Locality</label>
              <input type="text" name="areaLocality" value={formData.areaLocality || ''} onChange={handleChange} className="input-field text-sm" placeholder="e.g. Downtown" />
            </div>
          </div>
        </div>

        {/* Filing & Status */}
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
              <FileText size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Filing & Residential Status</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Residential Status</label>
              <select name="residentialStatus" value={formData.residentialStatus || 'RES'} onChange={handleChange} className="input-field text-sm">
                <option value="RES">Resident</option>
                <option value="NRI">Non-Resident (NRI)</option>
                <option value="RNOR">Resident but Not Ordinarily Resident</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filing Status (Section)</label>
              <select name="filingStatus" value={formData.filingStatus || '11'} onChange={handleChange} className="input-field text-sm">
                <option value="11">On or before due date u/s 139(1)</option>
                <option value="12">After due date u/s 139(4)</option>
                <option value="13">Revised Return u/s 139(5)</option>
                <option value="14">After condonation of delay u/s 119(2)(b)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Business Specifics */}
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Building2 size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Business Specifics</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trade Name</label>
              <input type="text" name="tradeName" value={formData.tradeName || ''} onChange={handleChange} className="input-field text-sm" placeholder="Trade Name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nature of Business Code</label>
              <input type="text" name="natureOfBusinessCode" value={formData.natureOfBusinessCode || ''} onChange={handleChange} className="input-field text-sm" placeholder="e.g. 01001" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CIN Number (For ITR-6)</label>
              <input type="text" name="cinNumber" value={formData.cinNumber || ''} onChange={handleChange} className="input-field text-sm" placeholder="e.g. U12345MH2020PTC123456" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Registration Details (For ITR-7)</label>
              <input type="text" name="registrationDetails" value={formData.registrationDetails || ''} onChange={handleChange} className="input-field text-sm" placeholder="e.g. 12A Reg No." />
            </div>
          </div>
        </div>

        {/* Audit & Bank Information */}
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <FileText size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Audit & Bank Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Liable for Audit u/s 44AB?</label>
              <select name="liableForAudit" value={formData.liableForAudit || 'No'} onChange={handleChange} className="input-field text-sm">
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date of Audit Report</label>
              <input type="date" name="dateOfAuditReport" value={formData.dateOfAuditReport || ''} onChange={handleChange} className="input-field text-sm" disabled={formData.liableForAudit === 'No'} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Auditor Name</label>
              <input type="text" name="auditorName" value={formData.auditorName || ''} onChange={handleChange} className="input-field text-sm" placeholder="Auditor Name" disabled={formData.liableForAudit === 'No'} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Auditor Membership No.</label>
              <input type="text" name="auditorMembershipNo" value={formData.auditorMembershipNo || ''} onChange={handleChange} className="input-field text-sm" placeholder="Membership No." disabled={formData.liableForAudit === 'No'} />
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-700 pt-4">Bank Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bank Account No.</label>
              <input type="text" name="bankAccountNo" value={formData.bankAccountNo || ''} onChange={handleChange} className="input-field text-sm" placeholder="Account Number" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">IFSC Code</label>
              <input type="text" name="ifscCode" value={formData.ifscCode || ''} onChange={handleChange} className="input-field text-sm" placeholder="IFSC Code" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bank Name</label>
              <input type="text" name="bankName" value={formData.bankName || ''} onChange={handleChange} className="input-field text-sm" placeholder="Bank Name" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-4">
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center text-emerald-600 text-sm font-bold"
            >
              <CheckCircle2 size={16} className="mr-1.5" />
              Saved successfully!
            </motion.div>
          )}
          <button 
            type="submit" 
            disabled={isSaving}
            className="btn-primary flex items-center px-6"
          >
            <Save size={18} className="mr-2" />
            {isSaving ? 'Saving...' : 'Save ITR Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
