## Database Schema (Supabase / PostgreSQL)

**Important Note for Offline Sync:** All primary keys (`id`) use the `UUID` type. These must be generated on the client-side (e.g., using `crypto.randomUUID()` in JS) before saving to IndexedDB to prevent ID collisions when syncing offline data back to Supabase.

### 1. Companies & Users

| Table: `companies` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Client-generated UUID |
| `name` | Text | Not Null | Company name |
| `company_type` | Enum | Not Null | `gc` or `subcontractor` |
| `tier` | Enum | Not Null | `basic`, `premium`, `enterprise` |

| Table: `users` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Matches Supabase Auth UID |
| `company_id` | UUID | FK -> `companies.id` | The company they belong to |
| `role` | Enum | Not Null | `admin`, `safety_manager`, `foreman` |
| `name` | Text | Not Null | User's full name |

### 2. Projects & Access

| Table: `projects` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Client-generated UUID |
| `owner_company_id` | UUID | Not Null, FK -> `companies.id` (ON DELETE CASCADE) | The company that created the project (the subcontractor in the sub-led flow) |
| `name` | Text | Not Null | E.g., "Downtown Highrise" |
| `gc_company_id` | UUID | Nullable, FK -> `companies.id` (ON DELETE SET NULL) | The GC as a registered company, once one is linked |
| `gc_name_custom` | Text | Nullable | Free-text GC name, used before a GC company is linked |
| `status` | Enum | Default `active` | `active`, `completed` |
| `archived_at` | Timestamptz | Nullable | `NULL` = live; a timestamp = archived (hidden from the default list, still restorable). Orthogonal to `status`. |
| `created_at` | Timestamptz | Default `now()` | |
| **CHECK** `check_gc_info` | | `gc_company_id IS NOT NULL OR gc_name_custom IS NOT NULL` | At least one GC identifier must be present |

| Table: `project_subcontractors` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `project_id` | UUID | FK -> `projects.id` (ON DELETE CASCADE) | |
| `sub_id` | UUID | FK -> `companies.id` (ON DELETE CASCADE) | Subcontractor assigned to site |
| **PK** | | **Composite** | `(project_id, sub_id)` |

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
| `is_global` | Boolean | Default `true` | True if public domain library |
| `company_id` | UUID | FK (Nullable) | Populated if a sub writes a custom talk |

> RLS: enabled with no policies (server-brokered, deny-all) — see `docs/data-access.md`.

### 4. Meeting & Attendance Logs

| Table: `meeting_logs` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Client-generated UUID |
| `project_id` | UUID | FK -> `projects.id` | Where it happened |
| `talk_id` | UUID | FK -> `toolbox_talks.id` | What was discussed |
| `foreman_id` | UUID | FK -> `users.id` | Who gave the talk |
| `crew_photo_url`| Text | Nullable | Supabase Storage path |
| `final_pdf_url` | Text | Nullable | Supabase Storage path for GC |
| `synced_at` | Timestamptz| Nullable | Used for offline-sync tracking |

| Table: `signatures` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Client-generated UUID |
| `meeting_id` | UUID | FK -> `meeting_logs.id`| |
| `worker_name` | Text | Not Null | Name typed by worker |
| `signature_path`| Text | Not Null | Path to signature image blob in Storage |
| `quiz_passed` | Boolean | Nullable | Verification of comprehension |

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