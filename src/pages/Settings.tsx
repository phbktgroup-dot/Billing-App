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
  Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    address: '',
    mobile: '',
    email: '',
    gstNumber: '',
    panNumber: '',
    invoicePrefix: 'INV',
    invoiceFormat: 'YYYY-MM-0001',
    bankName: '',
    bankAccountNo: '',
    bankIfsc: '',
    bankBranch: ''
  });

  useEffect(() => {
    if (profile?.business_profiles) {
      const bp = profile.business_profiles;
      setFormData({
        businessName: bp.name || '',
        ownerName: bp.owner_name || '',
        address: bp.address || '',
        mobile: bp.mobile || '',
        email: bp.email || '',
        gstNumber: bp.gst_number || '',
        panNumber: bp.pan_number || '',
        invoicePrefix: bp.invoice_prefix || 'INV',
        invoiceFormat: bp.invoice_number_format || 'YYYY-MM-0001',
        bankName: bp.bank_name || '',
        bankAccountNo: bp.bank_account_no || '',
        bankIfsc: bp.bank_ifsc || '',
        bankBranch: bp.bank_branch || ''
      });
      if (bp.logo_url) {
        setLogoPreview(bp.logo_url);
      }
    }
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
          mobile: formData.mobile,
          email: formData.email,
          gst_number: formData.gstNumber,
          pan_number: formData.panNumber,
          bank_name: formData.bankName,
          bank_account_no: formData.bankAccountNo,
          bank_ifsc: formData.bankIfsc,
          bank_branch: formData.bankBranch,
          invoice_prefix: formData.invoicePrefix,
          invoice_number_format: formData.invoiceFormat
        })
        .eq('id', profile.business_id);

      if (updateError) {
        throw updateError;
      }

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

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Settings</h1>
          <p className="text-xs text-slate-500">Manage your business profile and account preferences.</p>
        </div>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-1.5">
          <button className="w-full text-left px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium flex items-center space-x-2.5">
            <Building2 size={16} />
            <span>Business Profile</span>
          </button>
          <button className="w-full text-left px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-medium flex items-center space-x-2.5 transition-colors">
            <Lock size={16} />
            <span>Security</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Logo Section */}
              <div className="flex flex-col items-center sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 pb-6 border-b border-slate-100">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-slate-200 group-hover:border-primary transition-colors">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Business logo" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon size={28} className="text-slate-400" />
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-white rounded-lg shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-primary transition-colors"
                  >
                    <ImageIcon size={14} />
                  </button>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-sm font-bold text-slate-900">Business Logo</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Update your business logo. Recommended size: 512x512px.</p>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Business Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      required
                      className="input-field pl-10 text-xs py-2"
                      value={formData.businessName}
                      onChange={e => setFormData({...formData, businessName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Owner Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      required
                      className="input-field pl-10 text-xs py-2"
                      value={formData.ownerName}
                      onChange={e => setFormData({...formData, ownerName: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Business Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <textarea 
                    required
                    rows={2}
                    className="input-field pl-10 pt-2 text-xs"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mobile Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="tel" 
                      required
                      className="input-field pl-10 text-xs py-2"
                      value={formData.mobile}
                      onChange={e => setFormData({...formData, mobile: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Business Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="email" 
                      required
                      className="input-field pl-10 text-xs py-2"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Tax Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">GST Number</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      required
                      className="input-field pl-10 uppercase text-xs py-2"
                      value={formData.gstNumber}
                      onChange={e => setFormData({...formData, gstNumber: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">PAN Number</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      required
                      className="input-field pl-10 uppercase text-xs py-2"
                      value={formData.panNumber}
                      onChange={e => setFormData({...formData, panNumber: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Bank Info */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Bank Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bank Name</label>
                    <input 
                      type="text" 
                      className="input-field text-xs py-2"
                      value={formData.bankName}
                      onChange={e => setFormData({...formData, bankName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Account Number</label>
                    <input 
                      type="text" 
                      className="input-field text-xs py-2"
                      value={formData.bankAccountNo}
                      onChange={e => setFormData({...formData, bankAccountNo: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">IFSC Code</label>
                    <input 
                      type="text" 
                      className="input-field uppercase text-xs py-2"
                      value={formData.bankIfsc}
                      onChange={e => setFormData({...formData, bankIfsc: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Branch Name</label>
                    <input 
                      type="text" 
                      className="input-field text-xs py-2"
                      value={formData.bankBranch}
                      onChange={e => setFormData({...formData, bankBranch: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Invoice Settings */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Invoice Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Invoice Prefix</label>
                    <input 
                      type="text" 
                      className="input-field text-xs py-2"
                      value={formData.invoicePrefix}
                      onChange={e => setFormData({...formData, invoicePrefix: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Number Format</label>
                    <input 
                      type="text" 
                      className="input-field text-xs py-2"
                      value={formData.invoiceFormat}
                      onChange={e => setFormData({...formData, invoiceFormat: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  type="submit" 
                  disabled={isLoading || isUploading}
                  className="btn-primary px-6 py-2 flex items-center space-x-2 text-sm"
                >
                  {isLoading || isUploading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
