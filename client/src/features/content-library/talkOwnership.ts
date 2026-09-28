import type { Talk } from "../../interfaces/talk";

/** Whether a non-global talk belongs to the caller's own company, as opposed to
 *  a GC's company talk shared with the caller's subcontractor company
 *  (docs/company-talks-design.md). Only own talks are editable in the UI.
 *
 *  Permissive when ownership can't be known, because the server is the
 *  authority (update/remove are scoped to the caller's company, so a foreign
 *  talk 404s): `ownCompanyId` is `null` while the profile loads or when it's
 *  unavailable offline (the query cache doesn't persist), and an optimistic
 *  just-created talk carries `companyId: ""` until it syncs (`useCreateTalk`).
 *  Hiding Edit in those cases would break editing your own talks offline. */
export const isOwnTalk = (talk: Talk, ownCompanyId: string | null): boolean =>
  !talk.isGlobal &&
  (ownCompanyId === null ||
    talk.companyId === "" ||
    talk.companyId === ownCompanyId);

/** The badge for a non-global talk: "Custom" for the caller's own,
 *  "From your GC" for one a GC shared. `null` for a global library talk. */
export const talkOriginLabel = (
  talk: Talk,
  ownCompanyId: string | null,
): string | null => {
  if (talk.isGlobal) return null;
  return isOwnTalk(talk, ownCompanyId) ? "Custom" : "From your GC";
};
