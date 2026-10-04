/** `GET /api/projects/:id/required-topic` response body — the sub-facing read
 *  of a linked GC's current top-down policy push (Phase 9e,
 *  docs/policy-push-design.md). All fields are `null` when the project is
 *  unlinked, its jobsite is inactive/archived, or the GC has nothing
 *  currently pushed. */
export interface RequiredTopic {
  talkId: string | null;
  talkTitle: string | null;
  pushedAt: string | null;
}
