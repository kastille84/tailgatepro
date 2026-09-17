import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getCurrentUser } from "../services/apiUsers";

/** Tiers that unlock multi-language talk translation (Trade Pro/Enterprise —
 *  client/src/data/plans.ts). A hand-kept mirror of the server's
 *  `server/utility/entitlements.js` for UI purposes only — the server is the
 *  actual authority, enforced on every gated endpoint regardless of what
 *  this hook renders. */
const TRANSLATION_TIERS = ["premium", "enterprise"];

/**
 * The caller's own profile + subscription tier (`GET /api/users/me`), kept
 * as its own domain hook layered on top of `useAuth()` rather than merged
 * into `AuthProvider` — per CLAUDE.md, that hook stays Supabase-session-only.
 * Disabled until a session exists, same as `useTalks`.
 */
export const useCurrentUser = () => {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser(session!.access_token),
    enabled: !!session,
  });

  const tier = query.data?.tier ?? null;

  return {
    tier,
    hasTranslationAccess: tier !== null && TRANSLATION_TIERS.includes(tier),
    isLoading: query.isLoading,
  };
};
