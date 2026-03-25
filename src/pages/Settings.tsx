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
  History,
  Camera,
  Trash2,
  Bell,
  Send,
  Edit2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn, formatSeriesNumber } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Drawer from '../components/Drawer';

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
    address1: '',
    address2: '',
    city: '',
    state: '',
    pincode: '',
    mobile: '',
    email: '',
    gstNumber: '',
    panNumber: '',
    aadharNumber: '',
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
    interStateEnabled: true,
    intraStateEnabled: true,
    ewayThreshold: 50000,
    intraStateThreshold: 100000,
    ewayDefaultTransporterId: '',
    ewayDefaultTransporterName: '',
    defaultHsnCode: ''
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
        interStateEnabled: true,
        intraStateEnabled: true,
        ewayThreshold: 50000,
        intraStateThreshold: 100000,
        ewayDefaultTransporterId: '',
        ewayDefaultTransporterName: '',
        defaultHsnCode: ''
      };
      if (profile?.business_id) {
        const savedEway = localStorage.getItem(`eway_settings_${profile.business_id}`);
        if (savedEway) {
          try {
            const parsed = JSON.parse(savedEway);
            ewaySettings = {
              ...ewaySettings,
              ...parsed
            };
          } catch (e) {
            console.error("Failed to parse eway settings");
          }
        }
      }

      setFormData({
        businessName: bp.name || '',
        ownerName: bp.owner_name || '',
        address1: bp.address1 || '',
        address2: bp.address2 || '',
        city: bp.city || '',
        state: bp.state || '',
        pincode: bp.pincode || '',
        mobile: bp.mobile || '',
        email: bp.email || '',
        gstNumber: bp.gst_number || '',
        panNumber: bp.pan_number || '',
        aadharNumber: bp.aadhar_number || '',
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
          address1: formData.address1,
          address2: formData.address2,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          mobile: formData.mobile,
          email: formData.email,
          gst_number: formData.gstNumber,
          pan_number: formData.panNumber,
          aadhar_number: formData.aadharNumber,
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
        interStateEnabled: formData.interStateEnabled,
        intraStateEnabled: formData.intraStateEnabled,
        ewayThreshold: formData.ewayThreshold,
        intraStateThreshold: formData.intraStateThreshold,
        ewayDefaultTransporterId: formData.ewayDefaultTransporterId,
        ewayDefaultTransporterName: formData.ewayDefaultTransporterName,
        defaultHsnCode: formData.defaultHsnCode
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

  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isSecurityDrawerOpen, setIsSecurityDrawerOpen] = useState(false);
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'profile') setIsProfileDrawerOpen(true);
    if (tab === 'security') setIsSecurityDrawerOpen(true);
    if (tab === 'invoice') setIsInvoiceDrawerOpen(true);
  }, [searchParams]);

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
    <div className="w-full space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button 
          onClick={() => setIsProfileDrawerOpen(true)}
          className="p-6 bg-white border border-slate-200 rounded-xl hover:border-primary hover:shadow-lg transition-all text-left group"
        >
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
            <Building2 size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Business Profile</h3>
          <p className="text-sm text-slate-500">Update your company details, logo, and contact information.</p>
        </button>

        <button 
          onClick={() => setIsSecurityDrawerOpen(true)}
          className="p-6 bg-white border border-slate-200 rounded-xl hover:border-primary hover:shadow-lg transition-all text-left group"
        >
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
            <ShieldCheck size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Security</h3>
          <p className="text-sm text-slate-500">Change your password and manage API integration keys.</p>
        </button>

        <button 
          onClick={() => setIsInvoiceDrawerOpen(true)}
          className="p-6 bg-white border border-slate-200 rounded-xl hover:border-primary hover:shadow-lg transition-all text-left group"
        >
          <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
            <FileText size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Invoice Settings</h3>
          <p className="text-sm text-slate-500">Configure invoice series, terms, and payment methods.</p>
        </button>
      </div>

      {/* Business Profile Drawer */}
      <Drawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        title="Business Profile"
        icon={<Building2 size={18} />}
        maxWidth="max-w-none"
        footer={
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
            <button 
              onClick={() => setIsProfileDrawerOpen(false)} 
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all text-[10px]"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-all flex items-center disabled:opacity-50 text-[10px]"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save Changes
            </button>
          </div>
        }
      >
        <div className="p-6">
          <div className="space-y-8">
            {/* Logo Upload */}
            <div className="flex items-center space-x-6">
              <div className="relative group">
                <div className="w-24 h-24 bg-slate-100 rounded-xl overflow-hidden border-2 border-slate-200 group-hover:border-primary transition-colors">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Building2 size={32} />
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 p-2 bg-white rounded-lg shadow-lg border border-slate-200 cursor-pointer hover:text-primary transition-colors">
                  <Camera size={16} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isUploading} />
                </label>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Business Logo</h3>
                <p className="text-[10px] text-slate-500">Upload your company logo for invoices.</p>
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Business Name</label>
                <input type="text" required className="input-field text-xs py-2" value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Owner Name</label>
                <input type="text" required className="input-field text-xs py-2" value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <input type="email" required className="input-field text-xs py-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phone Number</label>
                <input type="tel" required className="input-field text-xs py-2" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">GST Number</label>
                <input type="text" className="input-field text-xs py-2" value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value.toUpperCase()})} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">PAN Number</label>
                <input type="text" className="input-field text-xs py-2" value={formData.panNumber} onChange={e => setFormData({...formData, panNumber: e.target.value.toUpperCase()})} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Aadhar Number</label>
                <input type="text" className="input-field text-xs py-2" value={formData.aadharNumber} onChange={e => setFormData({...formData, aadharNumber: e.target.value})} placeholder="Optional" />
              </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Address Line 1</label>
                <input type="text" required className="input-field text-xs py-2" value={formData.address1} onChange={e => setFormData({...formData, address1: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Address Line 2</label>
                <input type="text" className="input-field text-xs py-2" value={formData.address2} onChange={e => setFormData({...formData, address2: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">City</label>
                <input type="text" required className="input-field text-xs py-2" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">State</label>
                <input type="text" required className="input-field text-xs py-2" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pincode</label>
                <input type="text" required className="input-field text-xs py-2" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} />
              </div>
            </div>

            {/* Bank Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pt-6 border-t border-slate-100">
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
                <input type="text" className="input-field text-xs py-2" value={formData.bankIfsc} onChange={e => setFormData({...formData, bankIfsc: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Branch Name</label>
                <input type="text" className="input-field text-xs py-2" value={formData.bankBranch} onChange={e => setFormData({...formData, bankBranch: e.target.value})} />
              </div>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Security Drawer */}
      <Drawer
        isOpen={isSecurityDrawerOpen}
        onClose={() => setIsSecurityDrawerOpen(false)}
        title="Security Settings"
        icon={<ShieldCheck size={18} />}
        maxWidth="max-w-none"
        footer={
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
            <button 
              onClick={() => setIsSecurityDrawerOpen(false)} 
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all text-[10px]"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="p-6">
          <div className="space-y-8">
            {/* Change Password */}
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary px-6 py-2 text-sm">{isLoading ? 'Updating...' : 'Update Password'}</button>
            </form>

            {/* Advanced Security */}
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Advanced Security</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      </Drawer>

      {/* Invoice Settings Drawer */}
      <Drawer
        isOpen={isInvoiceDrawerOpen}
        onClose={() => setIsInvoiceDrawerOpen(false)}
        title="Invoice Settings"
        icon={<FileText size={18} />}
        maxWidth="max-w-none"
        footer={
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
            <button 
              onClick={() => setIsInvoiceDrawerOpen(false)} 
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all text-[10px]"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-all flex items-center disabled:opacity-50 text-[10px]"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save Changes
            </button>
          </div>
        }
      >
        <div className="p-6">
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Terms and Conditions */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Terms & Conditions</h3>
                <textarea 
                  rows={6} 
                  className="input-field text-xs py-2 resize-none" 
                  placeholder="Enter your default terms and conditions..."
                  value={formData.termsAndConditions}
                  onChange={e => setFormData({...formData, termsAndConditions: e.target.value})}
                />
              </div>

              {/* Bank Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Bank Details</h3>
                <textarea 
                  rows={6} 
                  className="input-field text-xs py-2 resize-none" 
                  placeholder="Enter bank name, A/C number, IFSC, etc..."
                  value={formData.bankDetails}
                  onChange={e => setFormData({...formData, bankDetails: e.target.value})}
                />
              </div>
            </div>

            {/* Invoice Series */}
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Invoice Series</h3>
                <p className="text-[10px] text-slate-500">Manage multiple invoice number sequences.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {invoiceSeries.map(series => (
                  <div key={series.id} className={cn(
                    "p-3 rounded-lg border transition-all",
                    series.is_default ? "bg-primary/5 border-primary" : "bg-slate-50 border-slate-200"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-900">{series.name}</p>
                      {series.is_default && <span className="text-[8px] font-bold bg-primary text-white px-1.5 py-0.5 rounded uppercase">Default</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-500">Next: {series.prefix}{series.next_number}</p>
                      <div className="flex items-center space-x-2">
                        {!series.is_default && (
                          <button 
                            onClick={() => handleSetDefaultSeries(series.id)}
                            className="text-[10px] font-bold text-primary hover:underline"
                          >
                            Set Default
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteSeries(series.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Add New Series */}
                <div className="p-3 bg-white border border-dashed border-slate-300 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-700 mb-2 uppercase">New Series</p>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      placeholder="e.g. GST-2024-"
                      className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none focus:border-primary"
                      value={newSeriesName}
                      onChange={e => setNewSeriesName(e.target.value)}
                    />
                    <button 
                      onClick={async () => {
                        if (!newSeriesName) return;
                        setIsLoading(true);
                        const { data, error } = await supabase
                          .from('invoice_series')
                          .insert([{ 
                            name: newSeriesName, 
                            prefix: newSeriesName,
                            next_number: 1,
                            is_default: invoiceSeries.length === 0,
                            user_id: (await supabase.auth.getUser()).data.user?.id
                          }])
                          .select();
                        
                        if (!error && data) {
                          if (invoiceSeries.length === 0) {
                            const defaultSeries = invoiceSeries.find(s => s.is_default);
                            if (defaultSeries) await supabase.from('invoice_series').delete().eq('id', defaultSeries.id);
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
          </div>
        </div>
      </Drawer>
    </div>
  );
}
