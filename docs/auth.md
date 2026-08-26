## Authentication Standards (Supabase)

### Core Rules

- **Client Isolation:** Always initialize the Supabase client in a single utility file. Do not instantiate multiple clients across components.
- **Context over Calls:** Never call `supabase.auth.getUser()` inside standard UI components to check auth states. Use the global `AuthContext` to avoid unnecessary network waterfalls.
- **Session Lifecycle:** Always handle auth state reactively using `supabase.auth.onAuthStateChange`. Ensure you clean up the listener subscription on component unmount.
- **Protected Routes:** Enforce auth checks at the routing layer. Redirect unauthenticated users immediately to standard entry paths (e.g., `/login`).

### Core Global Authentication Setup

#### 1. Context and Provider Implementation

This pattern uses native React state to listen directly to Supabase lifecycle events:

```tsx
import { createContext, useEffect, useState, use } from "react";
import { createClient, User } from "@supabase/supabase-js";

// Initialize Client (Typically inside a config/supabase.ts file)
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check active session immediately on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Listen reactively to auth updates (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 3. Clean up subscription on unmount
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook utilizing React 19 'use' API instead of traditional useContext
export function useAuth() {
  const context = use(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

#### 2. Consuming Auth State in Protected UI Components

Components access the authenticated user object seamlessly using the `useAuth` hook:

```tsx
import { useAuth, supabase } from "./AuthProvider";

export function DashboardHeader() {
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return <div>Loading account...</div>;
  if (!user) return <div>Access Denied. Please log in.</div>;

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "1rem",
      }}
    >
      <div>
        <h3>Welcome back!</h3>
        <p>
          Logged in as: <strong>{user.email}</strong>
        </p>
      </div>
      <button onClick={handleLogout}>Log Out</button>
    </header>
  );
}
```
