// src/context/auth/auth-provider.tsx
import React, { useState, useEffect, useRef, type ReactNode } from "react";
import {
  createClient,
  SupabaseClient,
  type Session,
} from "@supabase/supabase-js";
import { keysBasedOnEnv } from "../../utils/EnvUtils";
import { createProfile } from "../../services/apiUsers";

import {
  AuthContext,
  type AuthState,
  type SignupProfile,
  type InviteAcceptProfile,
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

  // Safety net for Supabase auto-establishing a session when the confirm-
  // email link is opened in the same browser that signed up -- before the
  // user ever reaches Login.tsx's submit handler, the only other place
  // createProfile() is called for the deferred (confirm-email) signup path.
  // Idempotent (apiUsers.createProfile already swallows a 409 "already
  // exists" into null) and deduped per user id so a token refresh doesn't
  // re-POST. Failures (e.g. a Google sign-in with no companyName/companyType
  // yet -- a separate, pre-existing gap) are swallowed silently: this is a
  // background safety net, not a user-facing action, so it must never toast
  // or throw.
  const ensuredProfileUserIdRef = useRef<string | null>(null);
  const ensureProfile = (session: Session | null) => {
    if (!session || ensuredProfileUserIdRef.current === session.user.id) {
      return;
    }
    ensuredProfileUserIdRef.current = session.user.id;
    createProfile({ accessToken: session.access_token }).catch(() => {});
  };

  useEffect(() => {
    // Immediate handshake check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session: session ?? null, loading: false });
      ensureProfile(session);
    });

    // Event binding
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, session: session ?? null, loading: false });
      ensureProfile(session);
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
    profile: SignupProfile | InviteAcceptProfile,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Stored on the auth user as `user_metadata`; the server reads these
      // back (token-verified) to create the profile on first login when
      // "Confirm email" means no session is returned here. Spread generically
      // so either shape (a brand-new-company signup or an invited-teammate
      // signup carrying `inviteToken`) passes through unchanged.
      options: { data: { ...profile } },
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
