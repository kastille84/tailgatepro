import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/auth";
import { getCurrentUser } from "../services/apiUsers";

/** Tiers that unlock multi-language talk translation (Trade Pro/Enterprise —
 *  client/src/data/plans.ts). A hand-kept mirror of the server's
 *  `server/utility/entitlements.js` for UI purposes only — the server is the
 *  actual authority, enforced on every gated endpoint regardless of what
 *  this hook renders. */
const TRANSLATION_TIERS = ["premium", "enterprise"];

/** Company-wide manager roles — a hand-kept mirror of the server's
 *  `MANAGER_ROLES` (server/constants/roles.js), same as
 *  features/jobsites/JobsiteManager.tsx's own copy. UI hints only. */
const MANAGER_ROLES = ["admin", "safety_manager"];

/** Plan ids with an AI Talk Builder allowance — mirrors the server's
 *  non-zero `aiGenerationsPerMonth` in `PLAN_LIMITS`
 *  (server/utility/entitlements.js). UI hint only; the server enforces it
 *  (and the cap) on `POST /api/talks/generate`. */
const AI_TALK_BUILDER_PLANS = ["trade-pro", "trade-enterprise", "gc-portfolio"];

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
    isManagerRole: MANAGER_ROLES.includes(query.data?.role ?? ""),
    companyId: query.data?.companyId ?? null,
    companyType,
    // Both false until the profile loads, so GC-only / subcontractor-only UI
    // stays hidden rather than flashing. UI hints only — the server enforces
    // these with `requireGcCompany` / `requireSubcontractorCompany`.
    isGc: companyType === "gc",
    isSubcontractor: companyType === "subcontractor",
    // A GC's in-house crew (Phase 13): billing is the parent GC's, so the
    // Settings Billing section is hidden. False until the profile loads.
    isInHouseCrew: !!query.data?.parentGcCompanyId,
    tier,
    // Server-resolved plan + limits (single source of truth, not mirrored).
    plan: query.data?.plan ?? null,
    limits: query.data?.limits ?? null,
    hasTranslationAccess: tier !== null && TRANSLATION_TIERS.includes(tier),
    // Keyed off the server-resolved `plan`, so false until the profile loads.
    hasAiTalkBuilderAccess: AI_TALK_BUILDER_PLANS.includes(
      query.data?.plan ?? "",
    ),
    // Server-resolved (like plan/limits above), not a tier mirror: a GC can
    // earn this from owning a Site Pro jobsite, which isn't knowable from
    // tier alone (server/services/branding.js's resolveBrandingAccess).
    // Defaults to false until the profile loads, same as hasTranslationAccess.
    hasBrandingAccess: query.data?.hasBrandingAccess ?? false,
    // Authoring company talks: every subcontractor plan, but a GC needs
    // Portfolio — mirrors server/utility/entitlements.js's
    // canAuthorCompanyTalks. Permissive while the profile is unknown (loading,
    // or unavailable offline) so a subcontractor never loses "Add a new talk";
    // the server is the authority and 403s a non-Portfolio GC regardless.
    canAuthorCompanyTalks:
      companyType !== "gc" || query.data?.plan === "gc-portfolio",
    isLoading: query.isLoading,
  };
};
