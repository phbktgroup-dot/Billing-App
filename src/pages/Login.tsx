import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getApiUrl } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'email' | 'otp' | 'password'>('email');
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { user, loading, appSettings, settingsLoading } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(true);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Redirect if already logged in
  React.useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      let result;
      
      const loginPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timed out. This might be due to a slow connection. Please try again.')), 30000)
      );
      result = await Promise.race([loginPromise, timeoutPromise]) as any;
      
      if (result.error) throw result.error;

      if (result.data?.user) {
        console.log('Login successful, waiting for redirect...');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      if (mounted) setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (forgotPasswordStep === 'email') {
        // 1. Check if email exists
        const apiUrl = getApiUrl('/api/auth/check-email');
        console.log(`Checking email existence at: ${apiUrl}`);
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotPasswordEmail.toLowerCase() }),
        });

        console.log(`Email check response status: ${response.status}`);
        const checkData = await response.json();
        console.log(`Email check response data:`, checkData);
        
        if (!response.ok) throw new Error(checkData.error || 'Failed to check email.');
        
        if (!checkData.exists) {
          setError('Email ID not found in database.');
          setIsLoading(false);
          return;
        }

        // 2. Request OTP
        const otpApiUrl = getApiUrl('/api/auth/request-otp');
        console.log(`Requesting OTP at: ${otpApiUrl}`);
        const otpResponse = await fetch(otpApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotPasswordEmail.toLowerCase() }),
        });

        console.log(`OTP request response status: ${otpResponse.status}`);
        const otpData = await otpResponse.json();
        console.log(`OTP request response data:`, otpData);
        
        if (!otpResponse.ok) throw new Error(otpData.error || 'Failed to request OTP.');
        
        setSuccessMsg('OTP sent to your email.');
        setForgotPasswordStep('otp');
      } else if (forgotPasswordStep === 'otp') {
        // 3. Verify OTP
        const verifyResponse = await fetch(getApiUrl('/api/auth/verify-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotPasswordEmail.toLowerCase(), otp: otp.join('').trim() }),
        });

        const data = await verifyResponse.json();
        if (!verifyResponse.ok) throw new Error(data.error || 'Invalid or expired OTP.');
        
        setForgotPasswordStep('password');
      } else if (forgotPasswordStep === 'password') {
        // 4. Reset Password
        if (newPassword !== confirmPassword) {
          setError('Passwords do not match.');
          setIsLoading(false);
          return;
        }

        const resetResponse = await fetch(getApiUrl('/api/auth/reset-password-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotPasswordEmail.toLowerCase(), otp: otp.join('').trim(), password: newPassword }),
        });

        const data = await resetResponse.json();
        if (!resetResponse.ok) throw new Error(data.error || 'Failed to reset password.');
        
        setSuccessMsg('Password reset successfully.');
        setIsForgotPassword(false);
        setForgotPasswordStep('email');
      }
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setError(err.message || 'An error occurred.');
    } finally {
      if (mounted) setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-soft flex items-center justify-center p-3 sm:p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-5 sm:p-8 shadow-2xl shadow-slate-200/50">
          <div className="text-center mb-6">
            {settingsLoading ? (
              <div className="w-16 h-16 bg-slate-100 rounded-xl animate-pulse mx-auto mb-3" />
            ) : appSettings?.logo_url ? (
              <img 
                src={appSettings.logo_url} 
                alt="Logo" 
                className="w-16 h-16 object-contain mx-auto mb-3"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3 shadow-xl shadow-primary/20">
                P
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-900">{appSettings?.app_name || 'PHBKT Group'}</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Enterprise Business Management Suite</p>
          </div>

          <div className="flex items-center space-x-2 mb-3">
            <ShieldCheck className="text-primary" size={20} />
            <h2 className="text-lg font-bold text-slate-900">
              {isForgotPassword ? 'Reset Password' : 'Secure Login'}
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3 text-red-600 text-xs animate-shake">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
          
          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start space-x-3 text-emerald-600 text-xs">
              <ShieldCheck size={16} className="shrink-0 mt-0.5" />
              <p>{successMsg}</p>
            </div>
          )}

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-3">
              {forgotPasswordStep === 'email' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                    <input 
                      type="email" 
                      required
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="admin@phbkt.com"
                      className="input-field pl-10 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              {forgotPasswordStep === 'otp' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 ml-1">Enter OTP</label>
                  <div className="flex gap-1.5">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          const newOtp = [...otp];
                          newOtp[index] = value;
                          setOtp(newOtp);
                          if (value && index < 5) {
                            (document.getElementById(`otp-${index + 1}`) as HTMLInputElement)?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !otp[index] && index > 0) {
                            (document.getElementById(`otp-${index - 1}`) as HTMLInputElement)?.focus();
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasteData = e.clipboardData.getData('text').slice(0, 6).replace(/[^0-9]/g, '');
                          const newOtp = [...otp];
                          pasteData.split('').forEach((char, i) => {
                            if (i < 6) newOtp[i] = char;
                          });
                          setOtp(newOtp);
                        }}
                        id={`otp-${index}`}
                        placeholder="0"
                        className="w-9 h-9 text-center text-sm font-bold border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    ))}
                  </div>
                </div>
              )}

              {forgotPasswordStep === 'password' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 ml-1">New Password</label>
                    <input 
                      type="password" 
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-field py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 ml-1">Confirm New Password</label>
                    <input 
                      type="password" 
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-field py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="btn-primary w-full py-2 text-sm flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span>
                    {forgotPasswordStep === 'email' ? 'Send OTP' : 
                     forgotPasswordStep === 'otp' ? 'Verify OTP' : 'Reset Password'}
                  </span>
                )}
              </button>
              <button 
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setForgotPasswordStep('email');
                }}
                className="w-full text-xs text-slate-500 hover:text-slate-900"
              >
                Back to Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@phbkt.com"
                    className="input-field pl-10 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pl-10 pr-10 py-2 text-sm"
                    minLength={6}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary" />
                  <span className="text-xs text-slate-600">Remember me</span>
                </label>
                <button 
                  type="button" 
                  onClick={() => setIsForgotPassword(true)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="btn-primary w-full py-2 text-sm flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span>Login to Dashboard</span>
                )}
              </button>
            </form>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Only authorized personnel can access this system.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          © 2026 PHBKT Group Limited. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
