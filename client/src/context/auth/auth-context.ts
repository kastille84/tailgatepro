// src/context/auth/auth-context.ts
import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

import type { CompanyType } from "../../interfaces/company";

export interface AuthState {
  user: User | null;
  /** The current Supabase session, if any — exposes `session.access_token`
   *  for calling protected server API routes (see docs/auth.md §4). */
  session: Session | null;
  loading: boolean;
}

/** The profile details collected on the signup form. Carried into Supabase as
 *  `user_metadata` at sign-up so the server can create the `companies` /
 *  `users` rows on first login when "Confirm email" defers the session. */
export interface SignupProfile {
  name: string;
  companyName: string;
  companyType: CompanyType;
}

export interface AuthContextType extends AuthState {
  loginWithGoogle: () => Promise<void>;
  /** Returns the session directly (like `signUpWithEmail`) so a first-login
   *  caller can synchronously create its profile with `session.access_token`
   *  before navigating. */
  loginWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ session: Session | null }>;
  /** Returns the session directly (rather than requiring the caller to read
   *  it back off state) because whether Supabase returns one immediately
   *  depends on the project's "Confirm email" setting, and callers need to
   *  branch on that synchronously. `profile` is stored as `user_metadata`. */
  signUpWithEmail: (
    email: string,
    password: string,
    profile: SignupProfile,
  ) => Promise<{ session: Session | null }>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Keep the core object hidden inside the module layer
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
