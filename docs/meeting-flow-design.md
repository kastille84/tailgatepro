# Meeting Flow Design (Phase 4)

Status: decided (Phase 4 design spike, see `docs/tasks.md`). Covers the schema additions, Storage
bucket/upload design, quiz-scoring rule, immutability rule, and the offline-queue extensions needed
before the meeting wizard, signature capture, or crew-photo capture can be built. Full plan and
sequencing: `~/.claude/plans/check-if-there-s-anything-spicy-yao.md`.

It also records the Phase 5 PDF-generation and GC email-delivery design decisions — see "Phase 5
hook point" below.

## Why this doc exists

`docs/offline-sync-design.md` explicitly deferred `meeting_logs`/`signatures` to Phase 4: "no
server routes exist for either table today... wiring them in now would mean guessing at a contract
Phase 4 hasn't designed — including the photo-upload and PDF-generation flow." This doc is that
contract. It follows the same "design first, riskiest change last" shape Phase 3 used, and reuses
Phase 3's queue/replay infrastructure rather than inventing a second write path — `docs/data-access.md`'s
single-write-path rule applies here exactly as it did to Projects and Talks.

## Schema additions

Applied as an `ADD COLUMN IF NOT EXISTS` block in `Supabase_SQL.sql` (same convention used for every
prior phase's schema change), plus the equivalent update to `Supabase_Schema.md`:

```sql
ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE toolbox_talks ADD COLUMN IF NOT EXISTS quiz JSONB;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS quiz_score SMALLINT;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS quiz_answers JSONB;
ALTER TABLE meeting_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
UPDATE meeting_logs SET company_id = (SELECT owner_company_id FROM projects WHERE projects.id = meeting_logs.project_id) WHERE company_id IS NULL;
```

**`meeting_logs.company_id`** is a deliberate denormalization. `meeting_logs` only has `project_id`
today, which would mean scoping every query through a join to `projects.owner_company_id` — the
codebase's first join-based authorization check, where every other service (`projects.js`,
`talks.js`, `favorites.js`) filters company access on a single column on the table itself. Adding
`company_id` keeps `meetingLogs.js`'s service-layer checks the same shape as everything else, at the
cost of one denormalized column kept in sync at `create` time (never updated after — a meeting log's
project, and therefore its owning company, doesn't change once created).

**`meeting_logs.completed_at`** (nullable) distinguishes "wizard in progress" from "done." It is the
trigger point for the immutability rule below and the future Phase 5 PDF-generation hook — see
"Immutability" and "Phase 5 hook point."

**`toolbox_talks.quiz`** holds exactly 3 questions, same shape-of-solution as the existing
`structured`/`attribution` JSONB columns (no query pattern here needs relational access to
individual questions, so a normalized table would only add joins for no benefit):

```jsonc
[
  { "question": "...", "choices": ["...", "...", "..."], "correctIndex": 0 },
  { "question": "...", "choices": ["...", "...", "..."], "correctIndex": 1 },
  { "question": "...", "choices": ["...", "...", "..."], "correctIndex": 2 }
]
```

Harvested talks get this column populated by a content-pipeline follow-up (out of scope for this
doc — the harvest/structure/audit agents are a separate workflow, see `CLAUDE.md`'s "Constructing
and Gathering Content Library" section); custom talks get an authoring UI added to `TalkForm.tsx`
alongside the existing talking-points/hazards/discussion-questions editors.

**`signatures.quiz_score` / `quiz_answers`** record what the worker actually answered
(`quiz_answers: [{ questionIndex, selectedIndex, correct }]`), not just pass/fail — useful if a GC
or auditor ever needs to see which question tripped someone up. `quiz_passed` (existing column)
becomes server-computed as `quiz_score === 3`, never client-supplied — see "Never trust a
client-reported quiz result" below.

**RLS**: both tables get `ENABLE ROW LEVEL SECURITY` with zero policies at creation, matching the
`user_favorites` precedent from Phase 2d rather than adding two more tables to the pre-existing RLS
gap tracked in `docs/data-access.md`.

## Never trust a client-reported quiz result

The quiz's pass/fail gate is meaningful only if the record it produces is authoritative. The client
computes pass/fail immediately for UX feedback (no round trip needed to tell a worker they got a
question wrong), but `POST /api/meetings/:meetingId/signatures` always recomputes `quiz_score` and
`quiz_passed` itself from `toolbox_talks.quiz` and the submitted `quiz_answers` — a client that sends
a fabricated `quiz_passed: true` is ignored. This is the same trust boundary `docs/data-access.md`
already draws ("the server never trusts client-supplied ids/state") applied to a new field.

## Storage buckets and upload transport

Per `docs/data-access.md`'s existing line — "Storage buckets (Phase 4) follow the same idea: private
buckets, the server issues signed URLs" — the client never calls the Supabase Storage SDK directly,
matching the no-client-direct-Supabase-access rule already in force for table data.

**Buckets**: `signatures` and `crew-photos`, both created `public: false` via a one-time idempotent
script, `scripts/setup-storage-buckets.js` (same shape as `scripts/seed-talks.js`: uses the
service-role client, safe to re-run, no-op if the bucket already exists).

**Path convention**: within the `signatures` bucket, `{meetingLogId}/{signatureId}.png`; within the
`crew-photos` bucket, `{meetingLogId}/photo.jpg`. Paths are always relative to their bucket — the
bucket name is never repeated inside the path itself, since `.from(bucket)` already selects it.
Scoping every object under its `meetingLogId` is what lets the signed-URL endpoint authorize a read
by checking the caller's company owns that meeting's project — no separate object-ownership table
needed. A meeting has at most one crew photo (`crew_photo_url` is a single column, not a gallery),
so there's no separate photo id in its path — a retake overwrites the same object (uploads always
`upsert: true`, so a re-upload to either bucket's deterministic path is idempotent rather than
erroring on a duplicate object, matching the offline-sync design's "a retry resolves to the same
end state" principle).

**Write path**: two raw-body PUT endpoints, deliberately kept JSON-free rather than adding `multer`
as a new dependency (`express.raw()` is sufficient for a single-file body):
- `PUT /api/signatures/:id/blob` — `express.raw({ type: "image/png", limit: "1mb" })`.
- `PUT /api/meetings/:id/crew-photo` — `express.raw({ type: "image/*", limit: "10mb" })`.

Both go through a new `server/services/storage.js` (`uploadBlob(bucket, path, buffer, contentType)`),
called from `meetingLogs.js`/`signatures.js` rather than a standalone storage route, since
authorization ("does this caller's company own this meeting") already lives in those services.

**Read path**: `GET /api/meetings/:id/crew-photo-url` and `GET /api/signatures/:id/url` return a
5-minute signed URL (`supabase.storage.from(bucket).createSignedUrl(path, 300)`), only after
confirming the caller's company owns the parent meeting's project. This is the concrete form
`docs/data-access.md`'s "the server issues signed URLs" line takes.

## Offline queue extension

Phase 3 already anticipated this moment: `client/src/interfaces/sync.ts`'s `SyncEntity` comment
says it's "extended in Phase 4 to add `"meeting_log" | "signature"` once their server API exists,"
and `docs/offline-sync-design.md` explicitly left `meeting_logs`/`signatures` out of the Dexie
schema for the same reason. This section is that extension.

```ts
export type SyncEntity =
  | "project" | "talk" | "meeting_log" | "signature" | "crew_photo" | "meeting_completion";
```

**New problem Projects/Talks never had: cross-entity dependency.** A signature or crew-photo row's
queued write only makes sense once its parent `meeting_log` has actually synced (the server FK would
reject it otherwise). Today's `outbox.flush()` only prevents a row from being attempted after an
earlier failure **for the same `entityId`** (`poisonedEntityIds`) — a `meeting_log` create and its
child `signature` creates have different `entityId`s, so if the `meeting_log` row fails, `flush`
would still attempt the `signature` rows in the same pass. The FK constraint stops this from
corrupting data, but it's a wasted round trip and a confusing error for no reason. Fixed by adding an
optional field to `OutboxRow`:

```ts
export interface OutboxRow {
  // ...existing fields unchanged...
  /** If set, this row is skipped (left `pending`, not attempted) whenever ANY
   *  row with one of these ids is still in the outbox — i.e. at least one
   *  dependency hasn't synced yet. Undefined for every existing Projects/Talks
   *  row and for any row with no cross-entity dependency. */
  dependsOnEntityIds?: string[];
}
```

`flush()` treats a row with an unresolved `dependsOnEntityIds` entry the same way it treats a
poisoned entity: skip, don't attempt, leave it for the next pass. This is strictly additive — a row
that never sets `dependsOnEntityIds` (every Projects/Talks row, and any future entity that doesn't
need it) behaves exactly as before. Regression tests must prove this explicitly, since `outbox.ts` is
shared, already-shipped infrastructure that Projects and Talks depend on today.

This started as a single `dependsOnEntityId: string` (one signature depends on its one parent
meeting log) and was later widened to an array when Phase 4h wired up meeting completion: a
`meeting_completion` row must wait for *every* signature collected in that meeting, not just one, so
`dependsOnEntityIds` blocks on any outstanding row across the whole list. The completion row itself
reuses its meeting log's own `entityId` (like `crew_photo` does) rather than needing a dependency for
the meeting log — that ordering is already free via the outbox's same-entityId FIFO/poison mechanism.
A retried `PATCH .../complete` against a meeting that already completed 409s with "already been
completed"; `outbox.ts`'s `isAlreadyCompletedError` treats that the same way `isAlreadyExistsError`
treats a duplicate create — a successful sync, not a failure. See `MeetingWizard.tsx`'s `handleSave`
for the call site: it enqueues completion last, checkpointed (`completionEnqueued`) so a resumed
draft never enqueues it twice, but does **not** wait for it to actually sync before clearing the
draft and navigating away — a permanently-failed dependency (e.g. a discarded signature row) means
that meeting's completion retries forever with no per-meeting visibility beyond the app's generic
pending-sync badge. Accepted as a known limitation rather than new scope; see `docs/tasks.md` Phase
4h.

**Same pass, closing a Phase 3 loose end.** The Phase 3 audit (see the plan file) found that
`docs/offline-sync-design.md`'s own "retried create idempotency" design was only half built: the
server already answers a duplicate-id retry with `409` (`23505` → `AppError(..., 409)` in both
`projects.js` and `talks.js`), but `flush()` has no branch that treats a 409 as "already synced" —
it just retries forever. Since this sub-phase is already touching `outbox.ts`'s failure handling for
the dependency-skip logic above, it also adds: a row whose replay throws a recognizable "409 /
already exists" error is deleted (treated as a successful sync), not marked `failed`. Regression
tests must confirm Projects/Talks behavior is otherwise unchanged.

**New Dexie tables** (`client/src/utils/db/tailgateDb.ts`):
- **`meetingDraftCache`** — the in-progress wizard's state (`id, projectId, talkId, status,
  updatedAt`, plus whatever step data hasn't been submitted yet), written incrementally as the
  wizard advances. See "Draft resume" below.
- **`mediaBlobs`** — `{ id, blob: Blob, mimeType, createdAt }`. Dexie/IndexedDB natively
  structured-clones `Blob` values, so this is a real table, not a workaround. A queued
  signature/photo upload row's JSON `payload` carries the `mediaBlobs` id, not the bytes themselves;
  the replay handler reads the blob out of this table at flush time and PUTs it raw.

**Replay handlers**: `client/src/services/meetingLogReplayHandler.ts` and
`signatureReplayHandler.ts`, registered via `registerReplayHandler` exactly like
`talkReplayHandler.ts`. The blob-upload case is the one place a replay handler's request body isn't
JSON — every existing handler assumes a JSON payload; this is a deliberate, documented deviation,
not an oversight.

## Draft resume

A foreman collecting several workers' signatures on a job site is exactly the user most likely to
get interrupted mid-flow — a locked screen, a backgrounded tab, a low-battery reboot. Per-step
progress is written into `meetingDraftCache` as the wizard advances (not just held in React state),
so reopening the app resumes the in-progress meeting instead of losing already-collected signatures.
The final "Save" step is what actually calls the create/upload mutations and clears the draft row —
everything before that is local-only until then.

## Immutability

Once `meeting_logs.completed_at` is set, the meeting log and its signatures are done — no further
`signatures` may be created against it, and the `meeting_log` row itself can't be edited. This
mirrors `server/services/talks.js`'s existing `assertNotLoggedAnywhere` pattern (a 409 with an
explanatory message) via a new shared `assertNotCompleted(meetingId)` helper in
`server/services/meetingLogs.js`. There is intentionally no server-side "edit a past meeting" path —
a meeting log is either an in-progress client-side draft (never sent to the server until the wizard
finishes) or a completed OSHA record.

`complete()` requires at least one signature to exist before stamping `completed_at` — a meeting log
with zero attendees isn't a valid completed record.

## Phase 5 hook point

`meetingLogs.js`'s `complete()` is where Phase 5's PDF generation eventually attaches. Rather than an
inline `// TODO`, `complete()` gets an explicit, named call site now (e.g.
`await pdfGenerationQueue.enqueue(meetingLogId)`, backed by a no-op stub today) so Phase 5 has one
obvious function to implement instead of a code path to rediscover.

Full sub-phase breakdown (5a–5g) lives in `docs/tasks.md`; this section records the design decisions
made ahead of that work, so 5b onward don't re-litigate them.

**Synchronous, not a real queue.** Despite its name, `pdfGenerationQueue.enqueue` stays a plain
`await`ed call inside `complete()`'s own request — there's no job-queue infrastructure (Redis, Bull,
etc.) anywhere in this repo, and introducing one just for this would be new architecture the PRD
never asked for. Blocking that HTTP request on PDF render + Storage upload + email is safe because
nothing in the client actually waits on it: `MeetingWizard.tsx`'s `handleSave` enqueues the
`meeting_completion` row into the offline outbox and returns immediately (see "Offline queue
extension" above), so the real `PATCH .../complete` call happens later, on a background flush, with
no user staring at a spinner for it.

**Soft-fail, like every other secondary side effect in this codebase.** A failure at any step — PDF
render, Storage upload, or email send — is caught and logged, never unwinds `completed_at` or fails
the completion request itself. This mirrors Phase 7's per-language translation failures ("a single
language's failure is caught and simply omitted, never blocks the talk save"): a completed meeting
log is the durable OSHA record; the PDF and its email are a delivery mechanism layered on top; one
failing must not un-complete the other.

**GC recipient: a manual `projects.gc_contact_email` field.** No email address for a GC exists
anywhere in the schema today — `companies` and `users` have no email column, and
`projects.gc_company_id`/`gc_name_custom` don't resolve to one — because the invite/join-company flow
that would produce a real GC user account isn't built yet (see `docs/tasks.md`'s Cross-cutting epic).
Rather than block PDF delivery on that epic, Phase 5 adds a nullable `projects.gc_contact_email TEXT`
that the foreman fills in manually alongside `gc_name_custom`. This is explicitly a stopgap: the
Cross-cutting epic's checklist carries a standing item to supersede it with a real GC account's email
once invite/join-company ships, so this doesn't quietly become permanent. (Phase 8b partly resolved
this sooner than expected, without needing the full invite/join-company flow: once a project is linked
to a registered GC company — `gc_company_id`, from the Phase 6 join-code link — the Auth Admin API can
resolve that company's admin's email directly from `auth.users`, no new email column required. This
field now only backstops an unlinked project or a linked company with no admin yet.)

**Dev-vs-Mailgun transport, gated on env presence.** `server/utility/envUtils.js` already exposes
`MAILGUN_API_KEY`/`MAILGUN_DOMAIN` identically in both environment branches (no dedicated
dev/test pair). Phase 5's email service checks whether both are set: present → send via `mailgun.js`
(already an installed, unused dependency); unset → log the composed email (recipient, subject, PDF
link) to the console instead of sending. This is the same "unset degrades to unavailable, never a
hard error" shape `GOOGLE_TRANSLATE_API_KEY` uses in Phase 7, and satisfies `docs/tasks.md`'s "dev
transport until paid Mailgun" phrasing without inventing a separate test-mode flag.

**5f implementation note: Mailgun template, not inline HTML, and a longer link TTL.** When 5f was
actually built, the email body was authored as a Mailgun template (`docs/mailgun-templates/
meeting-log-report.html`, pasted into the Mailgun portal under the name
`server/constants/templates.js`'s `MAILGUN_TEMPLATES.MEETING_LOG_REPORT`) rather than inline HTML
strings in `email.js` — easier to restyle without a code change. The template's own subject is left
blank on purpose: `server/services/email.js` passes `subject` as a sibling of `template` in the
`messages.create` call, so it can reference the subcontractor company + project dynamically per
send, which a static template subject couldn't do. The signed PDF link also got a much longer TTL
than first sketched here — 30 days, not the 5-minute `PDF_URL_TTL_SECONDS` the on-demand
`GET .../pdf-url` endpoint uses — since a GC may not open the email for days, and it's built inline
via `storageService.getSignedUrl` inside `pdfGenerationQueue.enqueue()` rather than through
`meetingLogsService.getPdfUrl` (which hardcodes the 5-minute TTL with no override), avoiding a
redundant re-fetch of `project`/`company` that `enqueue()` already has in scope.

**PDF content scope.** The generated PDF covers: a project/meeting header (project name, talk title,
date); the talk's structured content (talking points, hazards, discussion questions); the CPWR/NIOSH
attribution block (`toolbox_talks.attribution`'s `copyright` + `notice`) per
`docs/content-attribution.md`'s "Phase 5 PDF service must print the same credit" requirement (implemented in `server/services/pdfGeneration.js`); the
signer list (`worker_name` plus quiz pass/fail where the talk has a quiz); the crew photo (embedded
if present, otherwise a "photo on file" note referencing the signed-URL endpoint); and two
timestamps: a **"Meeting held"** header line (`meeting_logs.held_at`, the client-reported time the
meeting actually happened) and the footer's **"Generated"** time. Because generation runs
synchronously inside `complete()`, "Generated" is also the server-receipt time (`completed_at`), so an
offline meeting synced the next day shows both — the held time is the meeting's date, the generated
time is the audit evidence of when the server received it. (Phase 6b2 replaced the earlier
"Completed: `completed_at`" header line; already-generated PDFs keep the old wording, since there is no
regeneration path.) The PDF's download filename and the GC email's date use `held_at` too. Nothing
beyond what's already captured by the meeting wizard — no new data collection is implied by the PDF
itself.

## Explicitly not resolved here

**Crew photo retention/deletion policy** — `docs/PRD.md` §7 flags this as an open question (GC audit
need vs. worker privacy). No TTL, no scheduled deletion job, no Storage lifecycle rule is set up as
part of Phase 4. This stays open and is re-surfaced in `docs/tasks.md`'s Phase 4 entry so it isn't
silently forgotten once the feature ships.

**TTS offline behavior on real devices** — the PRD's multi-lingual audio requirement assumes
`window.speechSynthesis` works fully offline. This is plausible (most platforms ship at least one
local voice) but unverified: some mobile OSes route "premium" voices through a network call even
when a local fallback exists. This needs a real-device check (Android/Chrome and iOS/Safari, radio
off) during the client capture-component work, not an assumption carried from the PRD text.

**BIPA-adjacent compliance copy for crew photos** — `docs/PRD.md` §4.3 requires the UI to make clear
that a crew photo is for attendance proof only, not biometric/facial-recognition analysis, and that
it's optional. This is a UX requirement, not a schema/architecture one, so it's tracked as part of
the capture-component's definition of done rather than solved in this design doc.

## Landing order

Mirrors Phase 3's "design first, riskiest shared-infra change before UI" shape:

1. This design doc.
2. Schema + Storage buckets (`Supabase_SQL.sql`, `Supabase_Schema.md`, `scripts/setup-storage-buckets.js`) — no consumers yet.
3. Server core API (`meetingLogs.js`/`signatures.js` JSON CRUD, no blobs) — manually smoke-tested with curl before anything queues against it, same as every prior phase's server-then-client ordering.
4. Server binary upload broker (`storage.js`, raw-body PUT/signed-URL GET routes).
5. Client offline-queue extension (`dependsOnEntityId`, the 409-as-success fix, new Dexie tables, replay handlers) — the riskiest change, since it touches `outbox.ts` that Projects and Talks already depend on, so it lands with its own regression tests before any UI consumes it.
6. Standalone capture components (signature pad, TTS hook, quiz, photo input) — built and unit-tested independently, same approach `BulletListEditor` used before `TalkForm` consumed it.
7. The meeting wizard — composes everything above. Lands last, once every dependency is proven in isolation.
8. Verification, hardening, docs, Phase 5 hook point.
