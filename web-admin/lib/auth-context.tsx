"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type UserRole = 'user' | 'customer' | 'shop_admin' | 'general_admin' | 'admin' | 'staff' | 'delivery_agent';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  shop_id?: string;
  account_status?: 'active' | 'suspended' | 'deactivated';
  phone?: string | null;
  address?: string | null;
  loyalty_points?: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  signOut: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signInWithPhone: (phone: string) => Promise<{ error?: string }>;
  verifyPhoneOTP: (phone: string, token: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildFallbackProfile(user: User): UserProfile {
  return {
    id: user.id,
    name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'User',
    role: 'user',
    created_at: user.created_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Fetch user profile from database with retry logic for newly created users
  const fetchProfile = useCallback(async (userId: string, retries = 3, delayMs = 500): Promise<UserProfile | null> => {
    try {
      if (!userId) {
        console.error('fetchProfile: Missing userId');
        return null;
      }

      // Check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('fetchProfile: Session error:', sessionError);
        return null;
      }
      if (!session?.user) {
        console.error('fetchProfile: No authenticated user session');
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Unable to load profile:', error.message || error.code || error);

        if (error.code === 'PGRST205' || error.message?.includes("Could not find the table 'public.profiles'")) {
          setProfileError('The Supabase database tables have not been created yet. Run the setup SQL in supabase/setup_remote_schema.sql.');
          return buildFallbackProfile(session.user);
        }

        setProfileError(error.message || 'Unable to load your profile.');
        return null;
      }

      if (!data) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return fetchProfile(userId, retries - 1, delayMs);
        }

        try {
          const fallbackName =
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email?.split('@')[0] ||
            'User';

          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              name: fallbackName,
              role: 'user'
            })
            .select()
            .single();

          if (createError) {
            console.error('Failed to create profile:', createError.message || createError.code || createError);
            setProfileError(createError.message || 'Unable to create your profile.');
            return null;
          }

          setProfileError(null);
          return newProfile as UserProfile;
        } catch (createErr) {
          console.error('Error creating profile:', createErr);
          setProfileError('Unable to create your profile.');
          return null;
        }
      }

      // Validate profile has required fields
      if (!data.id || !data.name || !data.role) {
        console.error('fetchProfile: Invalid profile data - missing required fields:', data);
        setProfileError('Your profile data is incomplete.');
        return null;
      }

      setProfileError(null);
      return data as UserProfile;
    } catch (err) {
      console.error('fetchProfile exception:', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        userId
      });
      setProfileError(err instanceof Error ? err.message : 'Unable to load your profile.');
      return null;
    }
  }, []);

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      setProfileLoading(true);
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
      setProfileLoading(false);
    }
  }, [fetchProfile, user?.id]);

  useEffect(() => {
    // Check current session on mount
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user || null);

        if (session?.user) {
          setProfileLoading(true);
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
          setProfileLoading(false);
        } else {
          setProfile(null);
          setProfileError(null);
        }
      } catch (err) {
        console.error("Failed to check session:", err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);

      if (session?.user) {
        setProfileLoading(true);
        void (async () => {
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
          setProfileLoading(false);
        })();
      } else {
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
      }
    });

    return () => subscription?.unsubscribe();
  }, [fetchProfile]);

  // Email sign in
  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message || 'Unable to sign in with email and password' };
      }

      if (!data?.session) {
        return { error: 'Login failed: no session returned. Please check your credentials and Supabase configuration.' };
      }

      return {};
    } catch (err) {
      console.error('Sign-in error:', err);
      return { error: err instanceof Error ? err.message : 'An unexpected error occurred' };
    }
  };

  // Email sign up
  const signUpWithEmail = async (email: string, password: string, name: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch {
      return { error: 'An unexpected error occurred' };
    }
  };

  // Phone sign in (send OTP)
  const signInWithPhone = async (phone: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch {
      return { error: 'An unexpected error occurred' };
    }
  };

  // Verify phone OTP
  const verifyPhoneOTP = async (phone: string, token: string) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      }
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    profileLoading,
    profileError,
    signOut,
    signInWithEmail,
    signUpWithEmail,
    signInWithPhone,
    verifyPhoneOTP,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
