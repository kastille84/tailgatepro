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
  import.meta.env.VITE_SUPABASE_API_KEY,
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

### 3. Email/Password, Signup, and Password Reset

`AuthContextType` also carries email/password auth and the current `session` (needed to read `session.access_token` for calling protected API routes — see §4 below). Every method here throws on a Supabase error, unlike `loginWithGoogle`/`logout` above, so page-level `onSubmit` handlers can `try/catch` and drive their own error UI:

```ts
interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

interface SignupProfile {
  name: string;
  companyName: string;
  companyType: CompanyType; // "gc" | "subcontractor"
}

interface AuthContextType extends AuthState {
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ session: Session | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    profile: SignupProfile,
  ) => Promise<{ session: Session | null }>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

Both `signUpWithEmail` and `loginWithEmail` return `{ session }` directly (rather than requiring the caller to read it off `useAuth()` afterward). For signup, whether Supabase returned a session immediately depends on the project's "Confirm email" setting; for login, the first login after email confirmation needs the token synchronously to create the profile (below).

**Deferred profile creation.** "Confirm email" is ON for this project, so `signUpWithEmail` returns `session: null` and `client/src/pages/Signup/Signup.tsx` (and `client/src/pages/AcceptInvite/AcceptInvite.tsx` for an invited teammate — see Phase 8c in `docs/tasks.md`) shows a "check your email" screen without creating the `companies`/`users` rows. The signup fields (or, for an invite, `inviteToken`) are instead passed as `options.data` to `supabase.auth.signUp`, which stores them on the auth user as `user_metadata`.

`createProfile({ accessToken })` (`apiUsers.ts`) is idempotent — a repeat call 409s ("profile already exists"), which `apiUsers.createProfile` swallows by resolving `null` — so it's safe to call from more than one place. It's called explicitly from `Signup.tsx`/`AcceptInvite.tsx`'s immediate-session branch and from `Login.tsx`'s submit handler on the user's first successful `loginWithEmail`, matching the intent that the Supabase **Confirm signup** email template redirects to `/login` (external configuration) so a not-yet-authenticated confirmer lands there and logs in normally.

**That assumption doesn't always hold.** Supabase can auto-establish a session right on `/login` when the confirmation link is opened in the *same browser* that ran `signUp()` (a stored PKCE code-verifier / URL session-detection completing automatically) — before the user ever submits the login form. Since `Login.tsx` has `if (user) return <Navigate to="/dashboard" replace />`, that auto-established session bounces straight past the submit handler, and `createProfile()` never fires that way. To close this gap, `client/src/context/auth/auth-provider.ts`'s `AuthProvider` also calls `createProfile()` itself — from both the initial `getSession()` check and every `onAuthStateChange` event — as a background safety net whenever a session is freshly seen for a not-yet-ensured user id (deduped via a ref, so a token refresh doesn't re-POST). This call is fire-and-forget and never surfaces an error to the UI (it's not a user-initiated action); the 409-idempotency above is what makes firing it from multiple places safe.

`sendPasswordReset` must pass a `redirectTo` pointing at `/reset-password` (`supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })`). That route must also be added to the Supabase project's redirect allow-list (Dashboard → Authentication → URL Configuration) for every origin the app runs on (dev and prod) — this is external configuration, not something any code change here can do.

**Branded email templates.** The Confirm-signup and Reset-password emails above are sent by Supabase's own mailer — not `server/services/email.js`'s Mailgun integration, which has no hook into a Supabase Auth event — so they can't share `server/constants/templates.js`'s `MAILGUN_TEMPLATES`. Branded HTML for both lives in `docs/supabase-email-templates/` (`confirm-signup.html`, `reset-password.html`); paste each into Supabase Dashboard → Authentication → Email Templates (matching name), for **both** the dev and prod projects (`SUPABASE_URL`/`SUPABASE_URL_PROD`) independently — external configuration, same as the redirect settings above.

### 4. Server-Side Route Protection (`requireAuth` middleware)

Client-side route guarding (`RequireAuth` in `client/src/features/authentication/`) only protects the UI — an Express API route needs its own server-side check, since the client can't be trusted to enforce anything. `server/middlewares/requireAuth.js` verifies a Supabase access token sent by the client and attaches the verified user id to the request:

```js
// server/middlewares/requireAuth.js
const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return next(new AppError("Authentication required", 401));

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return next(new AppError("Invalid or expired session", 401));
  }

  req.userId = data.user.id;
  // Non-authorization display fields only (name, company). user_metadata is
  // client-set and user-editable — never trust it for access control.
  req.userMetadata = data.user.user_metadata ?? {};
  return next();
};
```

Client side, send the token from `useAuth().session?.access_token` as `Authorization: Bearer <token>` on the fetch call (see `client/src/services/apiUsers.ts`). Server side, `router.post("/profile", requireAuth, requireProfileMetadata, controller)`: `requireProfileMetadata` (`server/middlewares/requireProfileMetadata.js`) normalizes `name` / `companyName` / `companyType` out of `req.userMetadata` into `req.profile`, or fails with a `422` if any are missing/invalid — it replaces an `express-validator` body chain because the deferred first-login request carries an empty body. **The controller must always use the server-verified `req.userId` and `req.profile`, never anything from `req.body`** — otherwise a client could write to another user's row.
