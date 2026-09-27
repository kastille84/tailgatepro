## Database Schema (Supabase / PostgreSQL)

**Important Note for Offline Sync:** All primary keys (`id`) use the `UUID` type. These must be generated on the client-side (e.g., using `crypto.randomUUID()` in JS) before saving to IndexedDB to prevent ID collisions when syncing offline data back to Supabase.

### 1. Companies & Users

| Table: `companies` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Client-generated UUID |
| `name` | Text | Not Null | Company name |
| `company_type` | Enum | Not Null | `gc` or `subcontractor` |
| `tier` | Enum | Not Null | `basic`, `premium`, `enterprise` |
| `logo_path` | Text | Nullable | Storage path of the uploaded company logo (`company-logos` bucket); embedded in generated PDFs and removes the free-tier watermark for Trade Pro+ tiers |
| `join_code` | Text | Unique (Nullable) | GC-only (Phase 6): the 8-character code a subcontractor enters to link a project to this GC. Generated server-side on the GC's first `GET /api/companies/join-code`; always `NULL` for a subcontractor (**CHECK** `check_join_code_gc_only`: `join_code IS NULL OR company_type = 'gc'`). See `docs/gc-dashboard-design.md` |

| Table: `users` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Matches Supabase Auth UID |
| `company_id` | UUID | FK -> `companies.id` | The company they belong to |
| `role` | Enum | Not Null | `admin`, `safety_manager`, `foreman` |
| `name` | Text | Not Null | User's full name |

> RLS: enabled with no policies (server-brokered, deny-all) on `companies` and `users` — see `docs/data-access.md`.

### 2. Projects & Access

| Table: `projects` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Client-generated UUID |
| `owner_company_id` | UUID | Not Null, FK -> `companies.id` (ON DELETE CASCADE) | The company that created the project (the subcontractor in the sub-led flow) |
| `name` | Text | Not Null | E.g., "Downtown Highrise" |
| `gc_company_id` | UUID | Nullable, FK -> `companies.id` (ON DELETE SET NULL) | The GC as a registered company, once one is linked |
| `gc_name_custom` | Text | Nullable | Free-text GC name, used before a GC company is linked |
| `gc_contact_email` | Text | Nullable | Manual contact email for PDF delivery (Phase 5). Since Phase 8b, only a fallback: PDF delivery prefers the linked `gc_company_id`'s admin (a real account) when one resolves, and only reads this field when unlinked or the linked company has no admin yet (see `docs/tasks.md` Phase 8 epic) |
| `jobsite_id` | UUID | Nullable, FK -> `jobsites.id` (ON DELETE SET NULL) | Phase 8d: set once this sub's row is attached to a GC-owned jobsite (via an accepted invite or a join-code link), else `NULL`. `gc_company_id` stays the authorization column regardless — see `docs/jobsite-design.md` |
| `status` | Enum | Default `active` | `active`, `completed` |
| `archived_at` | Timestamptz | Nullable | `NULL` = live; a timestamp = archived (hidden from the default list, still restorable). Orthogonal to `status`. |
| `created_at` | Timestamptz | Default `now()` | |
| **CHECK** `check_gc_info` | | `gc_company_id IS NOT NULL OR gc_name_custom IS NOT NULL` | At least one GC identifier must be present |

> The Phase 6 `project_subcontractors` junction table was dropped in Phase 8d-h; its role is played by `jobsite_subcontractors` (below).

> RLS: enabled with no policies (server-brokered, deny-all) on `projects` — see `docs/data-access.md`.

### 3. Content Library

| Table: `toolbox_talks` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Client-generated UUID (seed loader derives it deterministically from `slug`) |
| `slug` | Text | Unique (Nullable) | Stable natural key from the content pipeline (`data/processed/**`); the loader's upsert target |
| `title` | Text | Not Null | E.g., "Fall Protection Basics" |
| `trade_tag` | Text | Indexed | Primary trade, e.g. `Roofing`, `Electrical` |
| `trade_tags` | Text[] | GIN Indexed (Nullable) | All applicable trades (primary + secondary) for multi-trade filtering |
| `content` | Text | Not Null | Markdown payload (loader composes it from the structured fields) |
| `structured` | JSONB | Nullable | `{ summary, talking_points, site_hazards_to_check, discussion_questions, osha_standards, estimated_minutes }` from the pipeline |
| `attribution` | JSONB | Nullable | `{ source, publisher, copyright, license, source_url, notice }` from the pipeline — CPWR/NIOSH source credit shown in the app + PDF (see `docs/content-attribution.md`) |
| `quiz` | JSONB | Nullable | Exactly 3 `{ question, choices, correctIndex }` objects — post-TTS comprehension check before signing (Phase 4, see `docs/meeting-flow-design.md`) |
| `translations` | JSONB | Nullable | Per-language `{ title, summary, talking_points, site_hazards_to_check, discussion_questions }`, keyed by ISO 639-1 code (e.g. `"es"`). English is implicit (the row's own fields). Global talks: official agency-published translations only, never machine-translated. Custom talks: Google Cloud Translation API at create/edit time, gated to `premium`/`enterprise` tier — see `server/utility/entitlements.js` |
| `is_global` | Boolean | Default `true` | True for the shared global library; false for a company's custom talk |
| `is_core` | Boolean | NOT NULL, default `false` | Phase 9c: true for the 30 core talks Trade Free can see (set by the seed from `CORE_TALK_SLUGS`); paid plans and GCs see every global talk |
| `company_id` | UUID | FK (Nullable) | Populated if a sub writes a custom talk |

> RLS: enabled with no policies (server-brokered, deny-all) — see `docs/data-access.md`.

| Table: `user_favorites` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `user_id` | UUID | Not Null, FK -> `users.id` (ON DELETE CASCADE) | The user who bookmarked the talk |
| `talk_id` | UUID | Not Null, FK -> `toolbox_talks.id` (ON DELETE CASCADE) | The bookmarked talk |
| `created_at` | Timestamptz | Default `now()` | When it was bookmarked |
| **PK** | | **Composite** | `(user_id, talk_id)` |

> RLS: enabled with no policies (server-brokered, deny-all) — see `docs/data-access.md`.

### 4. Meeting & Attendance Logs

| Table: `meeting_logs` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Client-generated UUID |
| `project_id` | UUID | FK -> `projects.id` | Where it happened |
| `talk_id` | UUID | FK -> `toolbox_talks.id` | What was discussed |
| `foreman_id` | UUID | FK -> `users.id` | Who gave the talk |
| `company_id` | UUID | FK -> `companies.id` (Nullable) | Denormalized from `projects.owner_company_id` at create, so the service layer can scope access with a single-column filter (Phase 4, see `docs/meeting-flow-design.md`) |
| `crew_photo_url`| Text | Nullable | Supabase Storage path |
| `final_pdf_url` | Text | Nullable | Supabase Storage path for GC |
| `completed_at` | Timestamptz| Nullable | Set once >=1 signature exists; locks the record and triggers Phase 5 PDF generation. Stamped at **server receipt** — an audit stamp, not the time the meeting happened |
| `held_at` | Timestamptz| Nullable | Phase 6: when the meeting was actually held, as reported by the client at completion (the wizard's local time). Drives GC compliance windows and the PDF's meeting date/filename; backfilled from `completed_at` for existing rows. See `docs/gc-dashboard-design.md` |
| `synced_at` | Timestamptz| Nullable | Used for offline-sync tracking |

> RLS: enabled with no policies (server-brokered, deny-all) — see `docs/data-access.md`.

| Table: `signatures` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Client-generated UUID |
| `meeting_id` | UUID | FK -> `meeting_logs.id`| |
| `worker_name` | Text | Not Null | Name typed by worker |
| `signature_path`| Text | Not Null | Path to signature image blob in Storage |
| `quiz_passed` | Boolean | Nullable | Server-computed (`quiz_score === 3`) — never trust a client-supplied result |
| `quiz_score` | SmallInt | Nullable | Number of the 3 questions answered correctly |
| `quiz_answers` | JSONB | Nullable | `[{ questionIndex, selectedIndex, correct }]` |

> RLS: enabled with no policies (server-brokered, deny-all) — see `docs/data-access.md`.

### Supabase Storage buckets (Phase 4)

Both private (`public: false`), created via `scripts/setup-storage-buckets.js`. The client never
calls the Storage SDK directly — the server issues 5-minute signed URLs after confirming the
caller's company owns the parent meeting's project (see `docs/data-access.md`).

| Bucket | Path (relative to the bucket) | Written by |
| :--- | :--- | :--- |
| `signatures` | `{meetingLogId}/{signatureId}.png` | `PUT /api/meetings/:meetingId/signatures/:id/blob` |
| `crew-photos` | `{meetingLogId}/photo.jpg` (one per meeting; a retake upserts the same object) | `PUT /api/meetings/:id/crew-photo` |

### 5. Marketing

| Table: `waitlist` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Server-generated UUID (landing-page signup, not an offline record) |
| `name` | Text | Not Null | Name entered on the landing page |
| `email` | Text | Not Null, Unique | Contact email; unique constraint drives idempotent re-submits |
| `company` | Text | Nullable | Optional company name |
| `audience` | Text | Nullable | `sub` or `gc` when the signup came via the pricing page |
| `plan_interest` | Text | Nullable | Plan id the visitor clicked through from, e.g. `trade-pro` |
| `created_at` | Timestamptz | Default `now()` | Signup time |

### 6. Team Invites

| Table: `company_invites` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Server-generated UUID (not an offline record) |
| `company_id` | UUID | Not Null, FK -> `companies.id` (ON DELETE CASCADE) | The company being joined |
| `email` | Text | Not Null | The invitee's email address |
| `role` | Enum | Not Null | `admin`, `safety_manager`, `foreman` — the role the inviting admin picked |
| `token` | Text | Unique, Not Null | `crypto.randomBytes(32).toString('hex')` — a distinct mechanism from `companies.join_code` (per-invite, per-email, expiring; not company-level/human-typed) |
| `expires_at` | Timestamptz | Not Null | 7 days from creation (`server/utility/inviteToken.js`) |
| `created_at` | Timestamptz | Default `now()` | |
| **UNIQUE** `company_invites_company_email_unique` | | `(company_id, email)` | Re-inviting the same email upserts this row (new token/role/expiry) instead of creating a duplicate |

> RLS: enabled with no policies (server-brokered, deny-all) — see `docs/data-access.md`.

### 7. Jobsites (Phase 8d)

Full design: `docs/jobsite-design.md`. `projects` is unchanged in kind — a sub's project row is
still its own row, now optionally pointed at one of these via `jobsite_id` (see table 2 above).

| Table: `jobsites` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Server-generated UUID (not an offline record — creating a jobsite is an online, authenticated GC action) |
| `gc_company_id` | UUID | Not Null, FK -> `companies.id` (ON DELETE CASCADE) | The GC that owns this jobsite. GC-only for v1 (enforced at the service layer, no CHECK — `jobsites` has no `company_type` of its own) |
| `name` | Text | Not Null | E.g., "Riverside Tower" |
| `status` | Enum | Default `active` | `active`, `completed` — reuses `project_status` |
| `archived_at` | Timestamptz | Nullable | `NULL` = live; a timestamp = archived |
| `plan` | Text | Not Null, Default `'free'`, CHECK in (`free`, `site_pro`) | Phase 9b: per-site GC plan. `site_pro` = a paid GC Site Pro site (see `server/utility/entitlements.js`). Not yet enforced or written (9d) |
| `origin` | Text | Nullable, CHECK in (`gc`, `subcontractor`) | Who created the jobsite: `gc` via `POST /api/jobsites`, `subcontractor` when a join-code link find-or-created it. `NULL` = created before this column existed (origin unknown, never guessed). Server-written only; drives the "Created by subcontractor" badge |
| `created_at` | Timestamptz | Default `now()` | |

> RLS: enabled with no policies (server-brokered, deny-all) — see `docs/data-access.md`.

| Table: `jobsite_subcontractors` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Server-generated UUID (not an offline record) |
| `jobsite_id` | UUID | Not Null, FK -> `jobsites.id` (ON DELETE CASCADE) | The jobsite being invited to / joined |
| `sub_company_id` | UUID | Nullable, FK -> `companies.id` (ON DELETE CASCADE) | `NULL` until accepted — the invite carries only an email until then |
| `invited_email` | Text | Not Null | The address the GC invited |
| `token` | Text | Unique (Nullable) | Server-generated 64-hex secret (`server/utility/inviteToken.js`, shared with `company_invites`); `NULL` once accepted |
| `expires_at` | Timestamptz | Nullable | 7-day TTL; `NULL` once accepted |
| `accepted_at` | Timestamptz | Nullable | `NULL` = still pending; set = this is now a live membership row |
| `created_at` | Timestamptz | Default `now()` | |
| **UNIQUE** `jobsite_subs_email_unique` | | `(jobsite_id, invited_email)` | Re-inviting the same email upserts this row while still pending; re-inviting an already-accepted sub is a `409` instead (service-layer rule — the accept guard means this constraint alone can't distinguish the two) |
| **UNIQUE (partial)** `jobsite_subs_company_unique` | | `(jobsite_id, sub_company_id) WHERE sub_company_id IS NOT NULL` | One membership per company per jobsite once accepted |

Folds the GC-to-sub invite and the jobsite roster into one table — a row is "pending" (no
`sub_company_id`/`accepted_at`) or "a member" (both set), so the GC dashboard reads one query for
both states instead of a union across an invites table and a roster table. Distinct from
`company_invites` (Phase 8c), which is a *person* joining an *existing* company at a *role* —
this table is a *company* joining another company's *jobsite*, with no role at all. Supersedes
the Phase 6 `project_subcontractors` table, dropped in 8d-h.

> RLS: enabled with no policies (server-brokered, deny-all) — see `docs/data-access.md`.