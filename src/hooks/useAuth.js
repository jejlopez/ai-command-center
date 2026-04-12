import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    if (!supabase) throw new Error("Supabase not configured");
    if (password) {
      // Password login
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { authenticated: true };
    }
    // Magic link fallback
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
    return { sent: true };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error("Supabase not configured");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return {
    user,
    session,
    loading,
    authenticated: !!user,
    supabaseConfigured: !!supabase,
    signInWithEmail,
    signInWithGoogle,
    signOut,
  };
}
