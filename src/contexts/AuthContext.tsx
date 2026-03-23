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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedUser, setImpersonatedUser] = useState<any | null>(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState<any | null>(null);
  const [originalProfile, setOriginalProfile] = useState<any | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const userIdRef = useRef<string | null>(null);

  async function getProfile(userId: string, isImpersonation = false) {
    try {
      console.log(`Fetching profile for ${isImpersonation ? 'impersonated ' : ''}user:`, userId);
      
      // 1. Fetch the user record first
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userError) {
        console.error('Error fetching user:', userError);
        return null;
      }

      let finalProfile = userData;

      if (!userData && !isImpersonation) {
        // If user record doesn't exist, try to create it (only for the logged-in user)
        const { data: { session } } = await supabase.auth.getSession();
        const authUser = session?.user;
        
        if (authUser && authUser.id === userId) {
          console.log('Creating missing user record for:', authUser.email);
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .upsert([{
              id: authUser.id,
              email: authUser.email!,
              name: authUser.user_metadata?.name || authUser.email?.split('@')[0],
              role: authUser.email === 'phbktgroup@gmail.com' ? 'Super Admin' : 'Admin'
            }], { onConflict: 'id' })
            .select('*')
            .maybeSingle();
          
          if (insertError) {
            console.error('Error creating/upserting user record:', insertError);
            const { data: retryData } = await supabase
              .from('users')
              .select('*')
              .eq('id', userId)
              .maybeSingle();
            if (retryData) finalProfile = retryData;
          } else if (newUser) {
            finalProfile = newUser;
          }
        }
      }

      // 2. Fetch the business profile separately
      if (finalProfile) {
        const { data: businessData, error: businessError } = await supabase
          .from('business_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (businessError) {
          console.error('Error fetching business profile:', businessError);
        } else if (businessData) {
          finalProfile = {
            ...finalProfile,
            business_profiles: businessData,
            business_id: businessData.id
          };
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
          alert('Your account has been disabled. Please contact your administrator.');
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

  const impersonate = async (targetUser: any) => {
    setLoading(true);
    try {
      const targetProfile = await getProfile(targetUser.id, true);
      if (targetProfile) {
        setImpersonatedUser(targetUser);
        setImpersonatedProfile(targetProfile);
        setProfile(targetProfile);
        sessionStorage.setItem('impersonatedUserId', targetUser.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const stopImpersonating = () => {
    setImpersonatedUser(null);
    setImpersonatedProfile(null);
    setProfile(originalProfile);
    sessionStorage.removeItem('impersonatedUserId');
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
      
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      userIdRef.current = currentUser?.id ?? null;
      
      if (currentUser) {
        const userProfile = await getProfile(currentUser.id);
        
        // Check for persisted impersonation
        const impersonatedId = sessionStorage.getItem('impersonatedUserId');
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
    await supabase.auth.signOut();
    setProfile(null);
    setImpersonatedUser(null);
    setImpersonatedProfile(null);
    setOriginalProfile(null);
    userIdRef.current = null;
    sessionStorage.removeItem('impersonatedUserId');
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
      originalProfile
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
