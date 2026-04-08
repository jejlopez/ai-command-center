import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, supabaseConfigError } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabaseConfigError) {
      setLoading(false);
      return undefined;
    }

    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    if (supabaseConfigError) throw new Error(supabaseConfigError);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password) {
    if (supabaseConfigError) throw new Error(supabaseConfigError);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (supabaseConfigError) throw new Error(supabaseConfigError);

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function signOutAll() {
    if (supabaseConfigError) throw new Error(supabaseConfigError);

    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) throw error;
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signOutAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
