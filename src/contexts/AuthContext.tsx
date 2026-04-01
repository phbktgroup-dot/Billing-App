import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  impersonate: (user: any) => Promise<void>;
  stopImpersonating: () => void;
  isImpersonating: boolean;
  originalProfile: any | null;
  appSettings: any | null;
  settingsLoading: boolean;
  refreshAppSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedUser, setImpersonatedUser] = useState<any | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<any | null>(null);
  const [originalProfile, setOriginalProfile] = useState<any | null>(null);
  const [appSettings, setAppSettings] = useState<any | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const userIdRef = useRef<string | null>(null);

  async function getProfile(userId: string, isImpersonation = false) {
    try {
      console.log(`[AuthContext] Fetching profile for ${isImpersonation ? 'impersonated ' : ''}user:`, userId);
      
      // 1. Fetch the user record and business profile in parallel
      const [userResponse, businessResponse] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).maybeSingle(),
        supabase.from('business_profiles').select('*').eq('user_id', userId).maybeSingle()
      ]);

      const { data: userData, error: userError } = userResponse;
      const { data: businessData, error: businessError } = businessResponse;
 
      if (userError) {
        console.error('[AuthContext] Error fetching user from public.users:', userError);
        return null;
      }
 
      let finalProfile = userData;
 
      if (!userData && !isImpersonation) {
        console.log('[AuthContext] User record missing in public.users, attempting creation...');
        // If user record doesn't exist, try to create it (only for the logged-in user)
        const { data: { session } } = await supabase.auth.getSession();
        const authUser = session?.user;
        
        if (authUser && authUser.id === userId) {
          console.log('[AuthContext] Creating missing user record for:', authUser.email);
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .upsert([{
              id: authUser.id,
              email: authUser.email!,
              name: authUser.user_metadata?.name || authUser.email?.split('@')[0],
              role: authUser.email === 'phbktgroup@gmail.com' ? 'Super Admin' : 'Business User'
            }], { onConflict: 'id' })
            .select('*')
            .maybeSingle();
          
          if (insertError) {
            console.error('[AuthContext] Error creating/upserting user record:', insertError);
            // Try one more fetch in case it was a race condition with a trigger
            const { data: retryData } = await supabase
              .from('users')
              .select('*')
              .eq('id', userId)
              .maybeSingle();
            if (retryData) {
              console.log('[AuthContext] Retry fetch successful after upsert error');
              finalProfile = retryData;
            }
          } else if (newUser) {
            console.log('[AuthContext] User record created successfully');
            finalProfile = newUser;
          }
        }
      }

      if (!finalProfile) {
        console.warn('[AuthContext] No profile found or created for user:', userId);
      }

      // 2. Attach business profile
      if (finalProfile) {
        if (businessError) {
          console.error('[AuthContext] Error fetching business profile:', businessError);
        } else if (businessData) {
          console.log('[AuthContext] Business profile found:', businessData.id);
          finalProfile = {
            ...finalProfile,
            business_profiles: businessData,
            business_id: businessData.id
          };
        } else {
          console.log('[AuthContext] No business profile found for user');
        }
      }

      // 3. Add Super Admin check
      if (finalProfile && (finalProfile.email === 'phbktgroup@gmail.com' || finalProfile.role === 'Super Admin')) {
        finalProfile = {
          ...finalProfile,
          is_super_admin: true
        };
      }

      if (!isImpersonation) {
        // 4. Check if account is disabled (only for real user)
        if (finalProfile && finalProfile.is_active === false) {
          console.warn('User account is disabled:', userId);
          await supabase.auth.signOut();
          setProfile(null);
          setUser(null);
          userIdRef.current = null;
          return null;
        }
        setProfile(finalProfile);
        setOriginalProfile(finalProfile);
      }

      return finalProfile;
    } catch (err) {
      console.error('Unexpected error in getProfile:', err);
      return null;
    }
  }

  const refreshAppSettings = async () => {
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'global')
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching app settings:', error);
      } else if (data) {
        setAppSettings(data);
      }
    } catch (err) {
      console.error('Unexpected error in refreshAppSettings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const impersonate = async (targetUser: any) => {
    setLoading(true);
    try {
      const targetProfile = await getProfile(targetUser.id, true);
      if (targetProfile) {
        setImpersonatedUser(targetUser);
        setImpersonatedProfile(targetProfile);
        setProfile(targetProfile);
        localStorage.setItem('impersonatedUserId', targetUser.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const stopImpersonating = () => {
    setImpersonatedUser(null);
    setImpersonatedProfile(null);
    setProfile(originalProfile);
    localStorage.removeItem('impersonatedUserId');
  };

  const refreshProfile = async () => {
    if (user) {
      await getProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check active sessions and sets the user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      
      // Fetch app settings first (needed for login page)
      await refreshAppSettings();
      
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      userIdRef.current = currentUser?.id ?? null;
      
      if (currentUser) {
        const userProfile = await getProfile(currentUser.id);
        
        // Check for persisted impersonation
        const impersonatedId = localStorage.getItem('impersonatedUserId');
        if (impersonatedId && userProfile && (userProfile.role === 'Admin' || userProfile.role === 'Super Admin')) {
          const targetProfile = await getProfile(impersonatedId, true);
          if (targetProfile) {
            setImpersonatedUser({ id: impersonatedId, name: targetProfile.name, email: targetProfile.email });
            setImpersonatedProfile(targetProfile);
            setProfile(targetProfile);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      const newUser = session?.user ?? null;
      setUser(newUser);
      
      if (newUser) {
        if (event === 'SIGNED_IN') {
          // Only show loading screen if we are transitioning from a logged-out state
          // This prevents unmounting the app if SIGNED_IN fires when the app comes to foreground
          if (userIdRef.current !== newUser.id) {
            setLoading(true);
          }
          userIdRef.current = newUser.id;
          getProfile(newUser.id).finally(() => {
            if (mounted) setLoading(false);
          });
        } else if (event === 'TOKEN_REFRESHED') {
          // Do not set loading to true on token refresh, as it causes the entire app to unmount and remount (refresh)
          // Just fetch the profile in the background
          userIdRef.current = newUser.id;
          getProfile(newUser.id);
        } else {
          userIdRef.current = newUser.id;
          getProfile(newUser.id);
        }
      } else {
        setProfile(null);
        userIdRef.current = null;
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Clear state immediately for fast UI response
    setUser(null);
    setProfile(null);
    setImpersonatedUser(null);
    setImpersonatedProfile(null);
    setOriginalProfile(null);
    userIdRef.current = null;
    localStorage.removeItem('impersonatedUserId');
    
    // Clear any potential stale auth data from localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase.auth.token') || key.includes('sb-'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signOut, 
      refreshProfile,
      impersonate,
      stopImpersonating,
      isImpersonating: !!impersonatedUser,
      originalProfile,
      appSettings,
      settingsLoading,
      refreshAppSettings
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
