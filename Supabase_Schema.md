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
| `gc_contact_email` | Text | Nullable | Manual contact email for PDF delivery (Phase 5); stopgap until the invite/join-company flow provides a real GC account (see `docs/tasks.md` Cross-cutting epic) |
| `status` | Enum | Default `active` | `active`, `completed` |
| `archived_at` | Timestamptz | Nullable | `NULL` = live; a timestamp = archived (hidden from the default list, still restorable). Orthogonal to `status`. |
| `created_at` | Timestamptz | Default `now()` | |
| **CHECK** `check_gc_info` | | `gc_company_id IS NOT NULL OR gc_name_custom IS NOT NULL` | At least one GC identifier must be present |

| Table: `project_subcontractors` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `project_id` | UUID | FK -> `projects.id` (ON DELETE CASCADE) | |
| `sub_id` | UUID | FK -> `companies.id` (ON DELETE CASCADE) | Subcontractor assigned to site |
| **PK** | | **Composite** | `(project_id, sub_id)` |

> RLS: enabled with no policies (server-brokered, deny-all) on `projects` and `project_subcontractors` — see `docs/data-access.md`.

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