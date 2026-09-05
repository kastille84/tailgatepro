// src/context/auth/auth-context.ts
import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthState {
  user: User | null;
  /** The current Supabase session, if any — exposes `session.access_token`
   *  for calling protected server API routes (see docs/auth.md §4). */
  session: Session | null;
  loading: boolean;
}

export interface AuthContextType extends AuthState {
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  /** Returns the session directly (rather than requiring the caller to read
   *  it back off state) because whether Supabase returns one immediately
   *  depends on the project's "Confirm email" setting, and callers need to
   *  branch on that synchronously. */
  signUpWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ session: Session | null }>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Keep the core object hidden inside the module layer
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
