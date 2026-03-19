import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  async function getProfile(userId: string) {
    try {
      console.log('Fetching profile for user:', userId);
      
      // 1. Fetch the user record first
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      console.log('User data from DB:', userData);
      
      if (userError) {
        console.error('Error fetching user:', userError);
        return;
      }

      let finalProfile = userData;

      if (!userData) {
        // If user record doesn't exist, try to create it
        const { data: { session } } = await supabase.auth.getSession();
        const authUser = session?.user;
        
        if (authUser && authUser.id === userId) {
          console.log('Creating missing user record for:', authUser.email);
          // Use upsert to handle race conditions with the database trigger
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
            // If it's a duplicate key error, it means the trigger just created it
            // Let's try to fetch it one more time
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

      // 2. Fetch the business profile separately to avoid join errors (PGRST200)
      if (finalProfile) {
        const { data: businessData, error: businessError } = await supabase
          .from('business_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (businessError) {
          console.error('Error fetching business profile:', businessError);
        } else if (businessData) {
          // Attach business data to profile
          finalProfile = {
            ...finalProfile,
            business_profiles: businessData,
            business_id: businessData.id // Ensure business_id is set
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

      // 4. Check if account is disabled
      if (finalProfile && finalProfile.is_active === false) {
        console.warn('User account is disabled:', userId);
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        userIdRef.current = null;
        alert('Your account has been disabled. Please contact your administrator.');
        return;
      }

      console.log('Final profile state:', finalProfile);
      setProfile(finalProfile);
    } catch (err) {
      console.error('Unexpected error in getProfile:', err);
    }
  }

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
        await getProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
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
    userIdRef.current = null;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
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
