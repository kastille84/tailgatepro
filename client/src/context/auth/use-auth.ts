// src/context/auth/use-auth.ts
import { use } from "react";
import { AuthContext } from "./auth-context";

export function useAuth() {
  const context = use(AuthContext);

  // Guard clause guarantees code safety if a developer misses a provider wrap
  if (context === undefined) {
    throw new Error(
      "useAuth must be used strictly within an <AuthProvider /> environment.",
    );
  }

  return context;
}
