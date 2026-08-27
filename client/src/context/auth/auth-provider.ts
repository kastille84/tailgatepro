// src/context/auth/auth-provider.tsx
import React, { useState, useEffect, type ReactNode } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { keysBasedOnEnv } from "../../utils/EnvUtils";

import { AuthContext, type AuthState } from "./auth-context";

const supabase: SupabaseClient = createClient(
  keysBasedOnEnv().supabase.url,
  keysBasedOnEnv().supabase.apiKey,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    // Immediate handshake check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, loading: false });
    });

    // Event binding
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false });
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return React.createElement(
    AuthContext.Provider,
    { value: { ...state, loginWithGoogle, logout } },
    children,
  );
}
