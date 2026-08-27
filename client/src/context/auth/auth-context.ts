// src/context/auth/auth-context.ts
import { createContext } from "react";
import type { User } from "@supabase/supabase-js";

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export interface AuthContextType extends AuthState {
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

// Keep the core object hidden inside the module layer
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
