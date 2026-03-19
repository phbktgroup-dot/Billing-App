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
  const { user, loading } = useAuth();
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
        const response = await fetch(getApiUrl('/api/auth/check-email'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotPasswordEmail.toLowerCase() }),
        });

        if (!response.ok) throw new Error('Failed to check email.');
        const { exists } = await response.json();

        if (!exists) {
          setError('Email ID not found in database.');
          setIsLoading(false);
          return;
        }

        // 2. Request OTP
        const otpResponse = await fetch(getApiUrl('/api/auth/request-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotPasswordEmail.toLowerCase() }),
        });

        if (!otpResponse.ok) throw new Error('Failed to request OTP.');
        
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
    <div className="min-h-screen bg-background-soft flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4 shadow-xl shadow-primary/20">
            P
          </div>
          <h1 className="text-3xl font-bold text-slate-900">PHBKT Group</h1>
          <p className="text-slate-500 mt-2">Enterprise Business Management Suite</p>
        </div>

        <div className="glass-card p-8 shadow-2xl shadow-slate-200/50">
          <div className="flex items-center space-x-2 mb-8">
            <ShieldCheck className="text-primary" size={24} />
            <h2 className="text-xl font-bold text-slate-900">
              {isForgotPassword ? 'Reset Password' : 'Secure Login'}
            </h2>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3 text-red-600 text-sm animate-shake">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
          
          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start space-x-3 text-emerald-600 text-sm">
              <ShieldCheck size={18} className="shrink-0 mt-0.5" />
              <p>{successMsg}</p>
            </div>
          )}

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              {forgotPasswordStep === 'email' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input 
                      type="email" 
                      required
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="admin@phbkt.com"
                      className="input-field pl-12"
                    />
                  </div>
                </div>
              )}

              {forgotPasswordStep === 'otp' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Enter OTP</label>
                  <div className="flex gap-2">
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
                        className="w-12 h-12 text-center text-xl font-bold border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    ))}
                  </div>
                </div>
              )}

              {forgotPasswordStep === 'password' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">New Password</label>
                    <input 
                      type="password" 
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-field"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Confirm New Password</label>
                    <input 
                      type="password" 
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="btn-primary w-full py-3 text-lg flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
                className="w-full text-sm text-slate-500 hover:text-slate-900"
              >
                Back to Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@phbkt.com"
                    className="input-field pl-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pl-12 pr-12"
                    minLength={6}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                  <span className="text-sm text-slate-600">Remember me</span>
                </label>
                <button 
                  type="button" 
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="btn-primary w-full py-3 text-lg flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span>Login to Dashboard</span>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Only authorized personnel can access this system.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          © 2026 PHBKT Group Limited. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
