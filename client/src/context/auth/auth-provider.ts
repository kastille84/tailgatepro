// src/context/auth/auth-provider.tsx
import React, { useState, useEffect, type ReactNode } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { keysBasedOnEnv } from "../../utils/EnvUtils";

import {
  AuthContext,
  type AuthState,
  type SignupProfile,
} from "./auth-context";

const supabase: SupabaseClient = createClient(
  keysBasedOnEnv().supabase.url,
  keysBasedOnEnv().supabase.apiKey,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Immediate handshake check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session: session ?? null, loading: false });
    });

    // Event binding
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, session: session ?? null, loading: false });
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  // Unlike loginWithGoogle/logout above (fire-and-forget redirects/no-ops),
  // every method below throws on a Supabase error so page-level onSubmit
  // handlers can try/catch and drive their own error UI.
  const loginWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return { session: data.session };
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    profile: SignupProfile,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Stored on the auth user as `user_metadata`; the server reads these
      // back (token-verified) to create the profile on first login when
      // "Confirm email" means no session is returned here.
      options: {
        data: {
          name: profile.name,
          companyName: profile.companyName,
          companyType: profile.companyType,
        },
      },
    });
    if (error) throw error;
    return { session: data.session };
  };

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        ...state,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        updatePassword,
        logout,
      },
    },
    children,
  );
}
