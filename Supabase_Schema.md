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
| `gc_id` | UUID | FK -> `companies.id` | The GC who owns the site |
| `name` | Text | Not Null | E.g., "Downtown Highrise" |
| `status` | Enum | Default 'active' | `active`, `completed` |

| Table: `project_subcontractors` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `project_id` | UUID | FK -> `projects.id` | |
| `sub_id` | UUID | FK -> `companies.id` | Subcontractor assigned to site |
| **PK** | | **Composite** | `(project_id, sub_id)` |

### 3. Content Library

| Table: `toolbox_talks` | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Client-generated UUID |
| `title` | Text | Not Null | E.g., "Fall Protection Basics" |
| `trade_tag` | Text | Indexed | E.g., `Roofing`, `Electrical` |
| `content` | Text | Not Null | Markdown or HTML payload |
| `is_global` | Boolean | Default `true` | True if public domain library |
| `company_id` | UUID | FK (Nullable) | Populated if a sub writes a custom talk |

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
| `created_at` | Timestamptz | Default `now()` | Signup time |