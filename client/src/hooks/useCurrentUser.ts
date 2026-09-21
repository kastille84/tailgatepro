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
  const companyType = query.data?.companyType ?? null;

  return {
    role: query.data?.role ?? null,
    companyId: query.data?.companyId ?? null,
    companyType,
    // Both false until the profile loads, so GC-only / subcontractor-only UI
    // stays hidden rather than flashing. UI hints only — the server enforces
    // these with `requireGcCompany` / `requireSubcontractorCompany`.
    isGc: companyType === "gc",
    isSubcontractor: companyType === "subcontractor",
    tier,
    hasTranslationAccess: tier !== null && TRANSLATION_TIERS.includes(tier),
    // Custom PDF branding (upload logo, remove watermark) is the same
    // Trade Pro/Enterprise paywall as translation — reuses the identical
    // tier list, same reasoning as server/utility/entitlements.js's
    // hasBrandingAccess.
    hasBrandingAccess: tier !== null && TRANSLATION_TIERS.includes(tier),
    isLoading: query.isLoading,
  };
};
