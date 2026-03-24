import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Building2, 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  Hash, 
  Image as ImageIcon, 
  AlertCircle, 
  Loader2, 
  Save,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Smartphone,
  History
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn, formatSeriesNumber } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

import { testGeminiConnection } from '../services/aiService';

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    mobile: '',
    email: '',
    gstNumber: '',
    panNumber: '',
    invoicePrefix: 'INV',
    invoiceFormat: 'YYYY-MM-0001',
    bankName: '',
    bankAccountNo: '',
    bankIfsc: '',
    bankBranch: '',
    geminiApiKey: '',
    defaultNotes: '',
    defaultTerms: '',
    ewayBillEnabled: false,
    ewayDefaultTransporterId: '',
    ewayDefaultTransporterName: ''
  });

  const handleTestKey = async () => {
    if (!formData.geminiApiKey) {
      setError('Please enter an API key first');
      return;
    }
    setIsTestingKey(true);
    setError(null);
    setSuccess(null);
    try {
      await testGeminiConnection(formData.geminiApiKey);
      setSuccess('Gemini API Key is valid and working!');
    } catch (err: any) {
      setError(`Gemini API Key Test Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsTestingKey(false);
    }
  };

  const [invoiceSeries, setInvoiceSeries] = useState<any[]>([]);
  const [newSeriesName, setNewSeriesName] = useState('');

  useEffect(() => {
    console.log('Settings profile data:', profile);
    
    const fetchBusinessProfile = async () => {
      if (profile?.business_id) {
        if (!profile?.business_profiles) {
          const { data, error } = await supabase
            .from('business_profiles')
            .select('*')
            .eq('id', profile.business_id)
            .maybeSingle();
          
          if (data) {
            populateForm(data);
          }
        } else {
          populateForm(profile.business_profiles);
        }

        // Fetch invoice series
        const { data: series, error: seriesError } = await supabase
          .from('invoice_series')
          .select('*')
          .eq('business_id', profile.business_id);
        
        if (series) {
          setInvoiceSeries(series);
        }
      }
    };

    const populateForm = (bp: any) => {
      let ewaySettings = {
        ewayBillEnabled: false,
        ewayDefaultTransporterId: '',
        ewayDefaultTransporterName: ''
      };
      if (profile?.business_id) {
        const savedEway = localStorage.getItem(`eway_settings_${profile.business_id}`);
        if (savedEway) {
          try {
            ewaySettings = JSON.parse(savedEway);
          } catch (e) {
            console.error("Failed to parse eway settings");
          }
        }
      }

      setFormData({
        businessName: bp.name || '',
        ownerName: bp.owner_name || '',
        address: bp.address || '',
        city: bp.city || '',
        state: bp.state || '',
        pincode: bp.pincode || '',
        mobile: bp.mobile || '',
        email: bp.email || '',
        gstNumber: bp.gst_number || '',
        panNumber: bp.pan_number || '',
        invoicePrefix: bp.invoice_prefix || 'INV',
        invoiceFormat: bp.invoice_number_format || 'YYYY-MM-0001',
        bankName: bp.bank_name || '',
        bankAccountNo: bp.bank_account_no || '',
        bankIfsc: bp.bank_ifsc || '',
        bankBranch: bp.bank_branch || '',
        geminiApiKey: bp.gemini_api_key || '',
        defaultNotes: bp.default_notes || '',
        defaultTerms: bp.default_terms || '',
        ...ewaySettings
      });
      if (bp.logo_url) {
        setLogoPreview(bp.logo_url);
      }
    };

    fetchBusinessProfile();
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo size must be less than 5MB');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (businessId: string): Promise<string | null> => {
    if (!logoFile) return null;
    
    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${businessId}/logo-${Date.now()}.${fileExt}`;
    const filePath = `business-logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, logoFile, { upsert: true });

    if (uploadError) {
      console.error('Error uploading logo:', uploadError);
      throw new Error(`Logo upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.business_id) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // 1. Update business profile
          const { error: updateError } = await supabase
        .from('business_profiles')
        .update({
          name: formData.businessName,
          owner_name: formData.ownerName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          mobile: formData.mobile,
          email: formData.email,
          gst_number: formData.gstNumber,
          pan_number: formData.panNumber,
          bank_name: formData.bankName,
          bank_account_no: formData.bankAccountNo,
          bank_ifsc: formData.bankIfsc,
          bank_branch: formData.bankBranch,
          invoice_prefix: formData.invoicePrefix,
          invoice_number_format: formData.invoiceFormat,
          gemini_api_key: formData.geminiApiKey,
          default_notes: formData.defaultNotes,
          default_terms: formData.defaultTerms
        })
        .eq('id', profile.business_id);

      if (updateError) {
        throw updateError;
      }

      // Save eway settings to localStorage
      localStorage.setItem(`eway_settings_${profile.business_id}`, JSON.stringify({
        ewayBillEnabled: formData.ewayBillEnabled,
        ewayDefaultTransporterId: formData.ewayDefaultTransporterId,
        ewayDefaultTransporterName: formData.ewayDefaultTransporterName
      }));

      // 2. Upload logo if exists
      if (logoFile) {
        setIsUploading(true);
        const logoUrl = await uploadLogo(profile.business_id);
        if (logoUrl) {
          await supabase
            .from('business_profiles')
            .update({ logo_url: logoUrl })
            .eq('id', profile.business_id);
        }
        setIsUploading(false);
      }

      // 3. Refresh profile
      if (refreshProfile) {
        await refreshProfile();
      }

      setSuccess('Business profile updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.message || 'Failed to update business profile.');
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  const activeTab = (searchParams.get('tab') as 'profile' | 'security' | 'invoice') || 'profile';
  
  const setActiveTab = (tab: 'profile' | 'security' | 'invoice') => {
    setSearchParams({ tab });
  };
  
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // 1. Re-authenticate user to verify old password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: passwordData.oldPassword
      });
      
      if (signInError) {
        throw new Error('Incorrect old password');
      }

      // 2. Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      if (updateError) throw updateError;
      
      setSuccess('Password updated successfully!');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <PageHeader 
        title="Settings" 
        description="Manage your business profile and account preferences."
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3 text-red-600 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start space-x-3 text-emerald-600 text-sm">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <p>{success}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Sidebar Navigation */}
        <div className="col-span-1 space-y-1.5">
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn("w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-2.5 transition-colors", activeTab === 'profile' ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <Building2 size={16} />
            <span>Business Profile</span>
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={cn("w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-2.5 transition-colors", activeTab === 'security' ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <Lock size={16} />
            <span>Security</span>
          </button>
          <button 
            onClick={() => setActiveTab('invoice')}
            className={cn("w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-2.5 transition-colors", activeTab === 'invoice' ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <FileText size={16} />
            <span>Invoice Settings</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="col-span-2 p-5 bg-white rounded-xl shadow-sm">
          {activeTab === 'profile' && (
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Logo Upload Section */}
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors group relative overflow-hidden">
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {logoPreview ? (
                    <div className="relative group/logo">
                      <img 
                        src={logoPreview} 
                        alt="Business Logo" 
                        className="w-32 h-32 object-contain rounded-lg bg-white shadow-sm border border-slate-200"
                      />
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity rounded-lg"
                      >
                        <ImageIcon className="text-white" size={24} />
                      </button>
                      <button 
                        type="button"
                        onClick={async () => {
                          if (!profile?.business_id) return;
                          setIsLoading(true);
                          try {
                            await supabase
                              .from('business_profiles')
                              .update({ logo_url: null })
                              .eq('id', profile.business_id);
                            setLogoPreview(null);
                            setLogoFile(null);
                            if (refreshProfile) await refreshProfile();
                            setSuccess('Logo removed successfully!');
                          } catch (err: any) {
                            setError(err.message || 'Failed to remove logo');
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-colors z-20"
                        title="Remove Logo"
                      >
                        <AlertCircle size={14} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center space-y-2 text-slate-500 hover:text-primary transition-colors"
                    >
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <ImageIcon size={24} />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold">Upload Company Logo</p>
                        <p className="text-[10px] opacity-70">PNG, JPG up to 5MB</p>
                      </div>
                    </button>
                  )}
                  
                  {isUploading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center z-10">
                      <div className="flex flex-col items-center space-y-2">
                        <Loader2 className="animate-spin text-primary" size={24} />
                        <p className="text-[10px] font-bold text-slate-600">Uploading logo...</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Business Name</label>
                    <input type="text" className="input-field text-xs py-2 border border-slate-300" value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Owner Name</label>
                    <input type="text" className="input-field text-xs py-2" value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Address</label>
                    <textarea className="input-field text-xs py-2" rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:col-span-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">City</label>
                      <input type="text" className="input-field text-xs py-2" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">State</label>
                      <input type="text" className="input-field text-xs py-2" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pincode</label>
                      <input 
                        type="text" 
                        maxLength={6}
                        className="input-field text-xs py-2" 
                        value={formData.pincode} 
                        onChange={e => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '')})} 
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mobile</label>
                    <input 
                      type="text" 
                      maxLength={10}
                      className="input-field text-xs py-2" 
                      value={formData.mobile} 
                      onChange={e => setFormData({...formData, mobile: e.target.value.replace(/\D/g, '')})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email</label>
                    <input type="email" className="input-field text-xs py-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">GST Number</label>
                    <input 
                      type="text" 
                      maxLength={15}
                      className="input-field text-xs py-2 uppercase" 
                      value={formData.gstNumber} 
                      onChange={e => setFormData({...formData, gstNumber: e.target.value.toUpperCase()})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">PAN Number</label>
                    <input 
                      type="text" 
                      maxLength={10}
                      className="input-field text-xs py-2 uppercase" 
                      value={formData.panNumber} 
                      onChange={e => setFormData({...formData, panNumber: e.target.value.toUpperCase()})} 
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Bank Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bank Name</label>
                      <input type="text" className="input-field text-xs py-2" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Account Number</label>
                      <input type="text" className="input-field text-xs py-2" value={formData.bankAccountNo} onChange={e => setFormData({...formData, bankAccountNo: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">IFSC Code</label>
                      <input type="text" className="input-field text-xs py-2" value={formData.bankIfsc} onChange={e => setFormData({...formData, bankIfsc: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Branch</label>
                      <input type="text" className="input-field text-xs py-2" value={formData.bankBranch} onChange={e => setFormData({...formData, bankBranch: e.target.value})} />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="btn-primary px-6 py-2 text-sm">
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
          )}
          {activeTab === 'invoice' && (
            <div className="space-y-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-slate-900">Invoice Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Default Notes</label>
                      <textarea 
                        className="input-field text-xs py-2 h-24 resize-none" 
                        placeholder="Default notes for all invoices..."
                        value={formData.defaultNotes} 
                        onChange={e => setFormData({...formData, defaultNotes: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Default Terms & Conditions</label>
                      <textarea 
                        className="input-field text-xs py-2 h-32 resize-none" 
                        placeholder="Default terms and conditions for all invoices..."
                        value={formData.defaultTerms} 
                        onChange={e => setFormData({...formData, defaultTerms: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">E-way Bill Settings</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Enable E-way Bill Generation</p>
                        <p className="text-xs text-slate-500 mt-1">Automatically prompt for E-way bill details when invoice value exceeds ₹50,000</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={formData.ewayBillEnabled}
                          onChange={(e) => setFormData({...formData, ewayBillEnabled: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    {formData.ewayBillEnabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Default Transporter ID</label>
                          <input 
                            type="text" 
                            className="input-field text-xs py-2 bg-white" 
                            placeholder="e.g., 29AABCU9603R1ZN"
                            value={formData.ewayDefaultTransporterId} 
                            onChange={e => setFormData({...formData, ewayDefaultTransporterId: e.target.value})} 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Default Transporter Name</label>
                          <input 
                            type="text" 
                            className="input-field text-xs py-2 bg-white" 
                            placeholder="e.g., Fast Logistics"
                            value={formData.ewayDefaultTransporterName} 
                            onChange={e => setFormData({...formData, ewayDefaultTransporterName: e.target.value})} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="btn-primary px-6 py-2 text-sm">
                  {isLoading ? 'Saving...' : 'Save Invoice Settings'}
                </button>
              </form>

              <div className="pt-6 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Invoice Number Series</h3>
                <div className="space-y-4">
                  {invoiceSeries.map((series) => (
                    <div key={series.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{series.name}</p>
                        <p className="text-[10px] text-slate-500">Prefix: {series.prefix} | Next: {formatSeriesNumber(series)}</p>
                      </div>
                      <button 
                        onClick={async () => {
                          setIsLoading(true);
                          await supabase.from('invoice_series').delete().eq('id', series.id);
                          setInvoiceSeries(invoiceSeries.filter(s => s.id !== series.id));
                          setIsLoading(false);
                        }}
                        className="text-[10px] text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Series Name / Prefix" 
                      className="input-field text-xs py-2 flex-grow" 
                      value={newSeriesName} 
                      onChange={e => setNewSeriesName(e.target.value)} 
                    />
                    <button 
                      onClick={async () => {
                        if (!newSeriesName || !profile?.business_id) return;
                        setIsLoading(true);
                        
                        const match = newSeriesName.match(/^(.*?)([0-9]+)$/);
                        let prefix = newSeriesName;
                        let startNumber = 1;
                        
                        if (match) {
                          prefix = match[1];
                          startNumber = parseInt(match[2], 10);
                        }
                        
                        const { data, error } = await supabase
                          .from('invoice_series')
                          .insert({ 
                            business_id: profile.business_id, 
                            name: newSeriesName, 
                            prefix: prefix,
                            current_number: startNumber
                          })
                          .select();
                        
                        if (data) {
                          // Check if default series exists and remove it
                          const defaultSeries = invoiceSeries.find(s => s.name === 'INV-000001' && s.current_number === 1);
                          if (defaultSeries) {
                            await supabase.from('invoice_series').delete().eq('id', defaultSeries.id);
                            setInvoiceSeries([...invoiceSeries.filter(s => s.id !== defaultSeries.id), data[0]]);
                          } else {
                            setInvoiceSeries([...invoiceSeries, data[0]]);
                          }
                          setNewSeriesName('');
                        }
                        setIsLoading(false);
                      }}
                      className="btn-primary px-4 py-2 text-xs"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'security' && (
              <div className="space-y-8">
                {/* Change Password */}
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Old Password</label>
                    <input type="password" required className="input-field text-xs py-2" value={passwordData.oldPassword} onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">New Password</label>
                    <input type="password" required className="input-field text-xs py-2" value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Confirm New Password</label>
                    <input type="password" required className="input-field text-xs py-2" value={passwordData.confirmPassword} onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} />
                  </div>
                  <button type="submit" disabled={isLoading} className="btn-primary px-6 py-2 text-sm">{isLoading ? 'Updating...' : 'Update Password'}</button>
                </form>

                {/* Advanced Security */}
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Advanced Security</h3>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Two-Factor Authentication (2FA)</p>
                      <p className="text-[10px] text-slate-500">Add an extra layer of security to your account.</p>
                    </div>
                    <button className="px-3 py-1 bg-slate-200 rounded-full text-[10px] font-bold text-slate-600 cursor-not-allowed">Coming Soon</button>
                  </div>
                  
                  {/* API Keys */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900">API Integration Key</p>
                      {profile?.role === 'Super Admin' && (
                        <a 
                          href="https://aistudio.google.com/app/apikey" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-primary hover:underline"
                        >
                          Get API Key
                        </a>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input 
                        type="password" 
                        placeholder="Paste your API Key here"
                        className={cn(
                          "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none",
                          profile?.role === 'Super Admin' ? "focus:border-primary" : "cursor-not-allowed opacity-70"
                        )}
                        value={formData.geminiApiKey}
                        onChange={e => setFormData({...formData, geminiApiKey: e.target.value})}
                        readOnly={profile?.role !== 'Super Admin'}
                      />
                      <div className="flex space-x-2">
                        {profile?.role === 'Super Admin' && (
                          <button 
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="btn-primary px-4 py-1.5 text-[10px]"
                          >
                            {isLoading ? 'Saving...' : 'Save API Key'}
                          </button>
                        )}
                        <button 
                          onClick={handleTestKey}
                          disabled={isTestingKey || !formData.geminiApiKey}
                          className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold hover:bg-slate-200 disabled:opacity-50 transition-colors flex items-center"
                        >
                          {isTestingKey ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <ShieldCheck size={12} className="mr-1.5" />}
                          Test Connection
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Device Management */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-900">Device Management</p>
                    <div className="text-[10px] text-slate-500 p-2 bg-slate-50 rounded-lg flex items-center justify-between">
                      <p>Current session: {navigator.userAgent.split(' ').slice(-2).join(' ')}</p>
                      <button 
                        onClick={async () => {
                          await supabase.auth.signOut();
                          window.location.reload();
                        }}
                        className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}
