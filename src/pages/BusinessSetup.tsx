import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Building2, User, MapPin, Phone, Mail, FileText, Hash, Image as ImageIcon, AlertCircle, Loader2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function BusinessSetup() {
  const navigate = useNavigate();
  const { user, refreshProfile, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const fileName = `${businessId}/logo.${fileExt}`;
    const filePath = `business-logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, logoFile, { upsert: true });

    if (uploadError) {
      if (uploadError.message.includes('bucket not found')) {
        throw new Error('Storage bucket "logos" not found. Please create a public bucket named "logos" in your Supabase Storage dashboard.');
      }
      if (uploadError.message.includes('row-level security policy')) {
        throw new Error('Permission denied: Storage policies are not set up. Please run the Storage Policies SQL from supabase_schema.sql in your Supabase SQL Editor.');
      }
      console.error('Error uploading logo:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // 0. Pre-flight check: Ensure user record exists in public.users
      // This prevents foreign key constraint violations if the trigger or AuthContext failed
      const { data: existingUser, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (userCheckError) throw userCheckError;

      if (!existingUser) {
        console.log('User record missing in public.users, creating it now...');
        
        // Retry logic for profile creation to handle potential Auth propagation delays
        let retryCount = 0;
        const maxRetries = 3;
        let success = false;
        let lastError = null;

        while (retryCount < maxRetries && !success) {
          const { error: userCreateError } = await supabase
            .from('users')
            .upsert([{
              id: user.id,
              email: user.email!,
              name: user.user_metadata?.name || user.email?.split('@')[0],
              role: user.email === 'phbktgroup@gmail.com' ? 'Super Admin' : 'Admin'
            }], { onConflict: 'id' });

          if (!userCreateError) {
            success = true;
          } else {
            lastError = userCreateError;
            // If it's a unique constraint on email, it's likely the trigger finished
            if (userCreateError.code === '23505') {
              success = true;
              console.log('Email conflict, user likely created by trigger. Proceeding...');
            } else {
              retryCount++;
              if (retryCount < maxRetries) {
                console.log(`Retry ${retryCount} for user profile creation...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
        }
        
        if (!success && lastError) {
          console.error('Failed to create user record after retries:', lastError);
          throw new Error(`Could not initialize your user profile: ${lastError.message}`);
        }
      }

      // 1. Create business profile
      const { data: business, error: saveError } = await supabase
        .from('business_profiles')
        .insert([{
          user_id: user.id,
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
        }])
        .select()
        .single();

      if (saveError) throw saveError;

      // 2. Manually link business to user (Fallback for trigger)
      if (business) {
        await supabase
          .from('users')
          .update({ business_id: business.id })
          .eq('id', user.id);
      }

      // 3. Upload logo if exists
      if (logoFile && business) {
        setIsUploading(true);
        try {
          const logoUrl = await uploadLogo(business.id);
          if (logoUrl) {
            await supabase
              .from('business_profiles')
              .update({ logo_url: logoUrl })
              .eq('id', business.id);
          }
        } catch (uploadErr: any) {
          console.error('Logo upload failed:', uploadErr);
          // Show a non-blocking error but allow the user to proceed
          setError(`Business saved, but logo upload failed: ${uploadErr.message}`);
          // Wait a few seconds so they can read the error before redirecting
          await new Promise(resolve => setTimeout(resolve, 3000));
        } finally {
          setIsUploading(false);
        }
      }

      // 3. Refresh profile in context to update business_id
      if (refreshProfile) {
        // Small delay to allow database trigger to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        await refreshProfile();
      }

      // Final check: if profile still doesn't have business_id, something is wrong
      // but we navigate anyway and let ProtectedRoute handle it.
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to save business profile. Please check your connection and try again.');
    } finally {
      // We only set isLoading to false if we haven't navigated away
      // or if we want to allow the user to try again.
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-soft py-6 px-4 relative">
      <div className="absolute top-4 right-4">
        <button
          onClick={() => signOut()}
          className="flex items-center space-x-1.5 text-slate-500 hover:text-red-600 transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 text-xs"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Setup Your Business</h1>
          <p className="text-xs text-slate-500 mt-1">Complete your profile to start managing your business.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 shadow-lg"
        >
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start space-x-2 text-red-600 text-xs">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Business Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    required
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
                    placeholder="PHBKT Group Ltd"
                    value={formData.businessName}
                    onChange={e => setFormData({...formData, businessName: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Owner Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    required
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
                    placeholder="John Doe"
                    value={formData.ownerName}
                    onChange={e => setFormData({...formData, ownerName: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Business Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <textarea 
                  required
                  rows={2}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all resize-none"
                  placeholder="123 Business Park, Sector 5..."
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="tel" 
                    required
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
                    placeholder="+91 98765 43210"
                    value={formData.mobile}
                    onChange={e => setFormData({...formData, mobile: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Business Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="email" 
                    required
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
                    placeholder="contact@phbkt.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Tax Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">GST Number</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    required
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all uppercase"
                    placeholder="27AAAAA0000A1Z5"
                    value={formData.gstNumber}
                    onChange={e => setFormData({...formData, gstNumber: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">PAN Number</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    required
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all uppercase"
                    placeholder="ABCDE1234F"
                    value={formData.panNumber}
                    onChange={e => setFormData({...formData, panNumber: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Bank Info */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Bank Details (For Invoices)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Bank Name</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-xs transition-all"
                    placeholder="HDFC Bank"
                    value={formData.bankName}
                    onChange={e => setFormData({...formData, bankName: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Account Number</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-xs transition-all"
                    placeholder="50200026615791"
                    value={formData.bankAccountNo}
                    onChange={e => setFormData({...formData, bankAccountNo: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">IFSC Code</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-xs transition-all uppercase"
                    placeholder="HDFC0003800"
                    value={formData.bankIfsc}
                    onChange={e => setFormData({...formData, bankIfsc: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Branch Name</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-xs transition-all"
                    placeholder="Bahu Jamalpur, Rohtak"
                    value={formData.bankBranch}
                    onChange={e => setFormData({...formData, bankBranch: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Invoice Settings */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Invoice Customization</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Invoice Prefix</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-xs transition-all"
                    placeholder="INV"
                    value={formData.invoicePrefix}
                    onChange={e => setFormData({...formData, invoicePrefix: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Number Format</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:border-primary outline-none text-xs transition-all"
                    placeholder="YYYY-MM-0001"
                    value={formData.invoiceFormat}
                    onChange={e => setFormData({...formData, invoiceFormat: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Business Logo</label>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-primary transition-colors cursor-pointer group relative overflow-hidden"
              >
                {logoPreview ? (
                  <div className="relative group">
                    <img src={logoPreview} alt="Logo preview" className="h-24 mx-auto object-contain rounded-lg" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      <p className="text-white text-[10px] font-bold">Change Logo</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-2 text-slate-400 group-hover:text-primary group-hover:bg-primary/10 transition-all">
                      <ImageIcon size={20} />
                    </div>
                    <p className="text-xs font-medium text-slate-600">Click to upload or drag and drop</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG up to 5MB</p>
                  </>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading || isUploading}
              className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-bold flex items-center justify-center transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading || isUploading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  {isUploading ? "Uploading Logo..." : "Saving Profile..."}
                </>
              ) : "Complete Setup"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
