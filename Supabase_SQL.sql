-- Create Enums
CREATE TYPE company_type AS ENUM ('gc', 'subcontractor');
CREATE TYPE subscription_tier AS ENUM ('basic', 'premium', 'enterprise');
CREATE TYPE user_role AS ENUM ('admin', 'safety_manager', 'foreman', 'superintendent');
-- Existing database (Phase 9d-2): run on its own, NOT inside a transaction block:
-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superintendent';
CREATE TYPE project_status AS ENUM ('active', 'completed');

-- 1. Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  company_type company_type NOT NULL,
  tier subscription_tier NOT NULL,
  -- Storage path (company-logos bucket) of the uploaded company logo, not a
  -- URL — the client always gets a signed URL from the server. NULL = no
  -- logo uploaded yet (a normal state even for a Trade Pro+ company). Set
  -- via PUT /api/companies/logo, gated to premium/enterprise tier (see
  -- server/utility/entitlements.js).
  logo_path TEXT,
  -- GC-only (Phase 6): the code a subcontractor enters to link one of its
  -- projects to this GC (sets projects.gc_company_id). 8 characters from an
  -- unambiguous uppercase alphabet, generated server-side on the GC's first
  -- GET /api/companies/join-code. NULL = not generated yet (and always NULL
  -- for a subcontractor). See docs/gc-dashboard-design.md.
  join_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_join_code_gc_only CHECK (
    join_code IS NULL OR company_type = 'gc'
  )
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- If the table already exists from an earlier run, add the new column(s) instead:
-- ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_path TEXT;
-- ALTER TABLE companies ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;
-- ALTER TABLE companies ADD CONSTRAINT check_join_code_gc_only CHECK (join_code IS NULL OR company_type = 'gc');
-- ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 2. Users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
-- If the table already exists from an earlier run:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 3. Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  owner_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gc_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  gc_name_custom TEXT,
  -- Manual GC contact email for Phase 5 PDF delivery. Since Phase 8b, only a
  -- fallback: PDF delivery prefers the linked gc_company_id's admin (a real
  -- account) when one resolves, and only reads this field when unlinked or
  -- the linked company has no admin yet — see docs/tasks.md's Phase 8 epic.
  gc_contact_email TEXT,
  status project_status DEFAULT 'active',
  -- Soft-delete / visibility state, orthogonal to `status`: NULL = live,
  -- a timestamp = archived (hidden from the default list, still restorable).
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure either a registered GC ID or a non-blank custom GC name is provided.
  -- NULLIF(TRIM(...), '') closes the '' / whitespace-only loophole a plain
  -- IS NOT NULL check leaves open (Postgres treats '' as NOT NULL).
  CONSTRAINT check_gc_info CHECK (
    gc_company_id IS NOT NULL OR NULLIF(TRIM(gc_name_custom), '') IS NOT NULL
  )
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- If the table already exists from an earlier run, add the new column(s) instead:
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS gc_contact_email TEXT;
-- Phase 11b: tighten an existing check_gc_info to also reject blank/whitespace gc_name_custom:
-- ALTER TABLE projects DROP CONSTRAINT check_gc_info;
-- ALTER TABLE projects ADD CONSTRAINT check_gc_info CHECK (
--   gc_company_id IS NOT NULL OR NULLIF(TRIM(gc_name_custom), '') IS NOT NULL
-- );
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 4. (Retired) project_subcontractors
-- The Phase 6 junction table was superseded by jobsite_subcontractors (below)
-- and dropped in Phase 8d-h. Fresh databases never create it. For an existing
-- database, run this ONCE, only after `node scripts/backfill-jobsites.js --apply`
-- has been run and GET /api/gc/overview was checked against the jobsites data
-- (IRREVERSIBLE):
-- DROP TABLE IF EXISTS project_subcontractors;

-- 5. Toolbox Talks (Content Library)
CREATE TABLE toolbox_talks (
  id UUID PRIMARY KEY,
  -- Stable natural key carried from the content pipeline (data/processed/**).
  -- The seed loader upserts on this; later rounds expose it to the client.
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  -- Primary trade (kept for the existing single-trade index).
  trade_tag TEXT,
  -- Every applicable trade (primary + secondary), for multi-trade filtering.
  trade_tags TEXT[],
  content TEXT NOT NULL,
  -- Structured talk body from the content pipeline: { summary, talking_points,
  -- site_hazards_to_check, discussion_questions, osha_standards, estimated_minutes }.
  structured JSONB,
  -- Source credit from the content pipeline: { source, publisher, copyright,
  -- license, source_url, notice }. Shown in the app + generated PDF so the
  -- CPWR/NIOSH copyright markings and no-endorsement notice travel with the
  -- talk (a CPWR licensing condition). See docs/content-attribution.md.
  attribution JSONB,
  -- Phase 4: exactly 3 { question, choices: string[], correctIndex } objects,
  -- read aloud/quizzed post-TTS-playback before a worker can sign. See
  -- docs/meeting-flow-design.md.
  quiz JSONB,
  -- Per-language variants of the translatable prose fields only (title,
  -- summary, talking_points, site_hazards_to_check, discussion_questions),
  -- keyed by ISO 639-1 code (e.g. "es"). English stays implicit -- it's just
  -- this row's own top-level/structured fields, never a "en" entry here.
  -- Global (is_global=true) talks: populated only from an official
  -- agency-published translation via the content pipeline -- never machine
  -- translation. Custom (is_global=false) talks: populated by the Google
  -- Cloud Translation API at create/edit time, gated to premium/enterprise
  -- tier (see server/utility/entitlements.js). NULL = no translations yet.
  translations JSONB,
  is_global BOOLEAN DEFAULT true,
  -- Phase 9c: true for the ~30 core talks Trade Free can see; Pro/Enterprise/GC
  -- see every global talk. Set by the seed loader (scripts/lib/talkRow.js
  -- CORE_TALK_SLUGS).
  is_core BOOLEAN NOT NULL DEFAULT false,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_toolbox_talks_trade ON toolbox_talks(trade_tag);
CREATE INDEX IF NOT EXISTS idx_toolbox_talks_trades ON toolbox_talks USING GIN (trade_tags);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE toolbox_talks ENABLE ROW LEVEL SECURITY;

-- If the table already exists from an earlier run, add the new columns instead:
-- ALTER TABLE toolbox_talks ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
-- ALTER TABLE toolbox_talks ADD COLUMN IF NOT EXISTS trade_tags TEXT[];
-- ALTER TABLE toolbox_talks ADD COLUMN IF NOT EXISTS structured JSONB;
-- ALTER TABLE toolbox_talks ADD COLUMN IF NOT EXISTS attribution JSONB;
-- ALTER TABLE toolbox_talks ADD COLUMN IF NOT EXISTS quiz JSONB;
-- ALTER TABLE toolbox_talks ADD COLUMN IF NOT EXISTS translations JSONB;
-- ALTER TABLE toolbox_talks ADD COLUMN IF NOT EXISTS is_core BOOLEAN NOT NULL DEFAULT false;
-- CREATE INDEX IF NOT EXISTS idx_toolbox_talks_trades ON toolbox_talks USING GIN (trade_tags);
-- ALTER TABLE toolbox_talks ENABLE ROW LEVEL SECURITY;

-- 6. User Favorites (Phase 2d) — a foreman's bookmarked talks for two-tap
-- access (docs/PRD.md: "bookmark their 'Top 10' most-used topics"). Both FKs
-- cascade: deleting a user or a talk silently drops the bookmark.
CREATE TABLE user_favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  talk_id UUID NOT NULL REFERENCES toolbox_talks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, talk_id)
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still
-- works (docs/data-access.md). This is a new table, so it gets RLS enabled
-- at creation, same as every other table in this file.
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- 7. Meeting Logs
CREATE TABLE meeting_logs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  talk_id UUID REFERENCES toolbox_talks(id) ON DELETE SET NULL,
  foreman_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Denormalized from projects.owner_company_id (Phase 4) so the service layer
  -- can scope access with a single-column filter, same as every other table,
  -- instead of a join through projects. Set once at create, never updated.
  company_id UUID REFERENCES companies(id),
  crew_photo_url TEXT,
  final_pdf_url TEXT,
  -- Set once the meeting has >=1 signature; locks the meeting_log and its
  -- signatures against further changes (see docs/meeting-flow-design.md) and
  -- is the Phase 5 PDF-generation trigger point.
  completed_at TIMESTAMPTZ,
  -- Phase 6: when the meeting was actually held, as reported by the client at
  -- completion (the wizard's local time). completed_at is stamped at server
  -- RECEIPT, so an offline meeting synced after midnight would otherwise land
  -- on the wrong day. held_at drives GC compliance windows and the PDF's date;
  -- completed_at stays as the server-side audit stamp. NULL = still in
  -- progress. See docs/gc-dashboard-design.md.
  held_at TIMESTAMPTZ,
  -- Phase 11d: the foreman's Date#getTimezoneOffset() (minutes, UTC minus
  -- local; 420 = UTC-7) at completion, so held_at can be printed in local time
  -- on the PDF/email/filename instead of UTC. Display-only and NOT covered by
  -- content_seal. NULL (older meetings) = display in UTC.
  held_tz_offset SMALLINT,
  synced_at TIMESTAMPTZ,
  -- Phase 9e tamper-evidence (docs/tamper-evidence-design.md): an
  -- HMAC-SHA256 seal over this row's immutable-post-completion fields plus
  -- its signatures, keyed by a server-only secret (MEETING_LOG_SEAL_SECRET,
  -- never stored here or sent to the client) so a DB-only tamperer (a
  -- service-role write that bypasses the app entirely) can't forge a valid
  -- seal without also having the secret. Computed once, atomically, in the
  -- same UPDATE that stamps completed_at/held_at in complete() -- a
  -- completed meeting can never exist unsealed. NULL for a meeting still in
  -- progress, and for every meeting completed before this feature shipped
  -- (not backfilled).
  content_seal TEXT,
  sealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE meeting_logs ENABLE ROW LEVEL SECURITY;

-- If the table already exists from an earlier run, add the new columns instead:
-- ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
-- ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
-- ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ;
-- ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS held_tz_offset SMALLINT;  -- Phase 11d
-- ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS content_seal TEXT;  -- Phase 9e
-- ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ;  -- Phase 9e
-- ALTER TABLE meeting_logs ENABLE ROW LEVEL SECURITY;
-- UPDATE meeting_logs SET company_id = (SELECT owner_company_id FROM projects WHERE projects.id = meeting_logs.project_id) WHERE company_id IS NULL;
-- Backfill (Phase 6): existing completed meetings keep the date they have today.
-- UPDATE meeting_logs SET held_at = completed_at WHERE held_at IS NULL AND completed_at IS NOT NULL;

-- 8. Signatures
CREATE TABLE signatures (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meeting_logs(id) ON DELETE CASCADE,
  worker_name TEXT NOT NULL,
  signature_path TEXT NOT NULL,
  quiz_passed BOOLEAN,
  -- Server-computed only (quiz_score = 3 -> quiz_passed = true); never trust a
  -- client-supplied pass/fail. quiz_answers records what was actually
  -- answered: [{ questionIndex, selectedIndex, correct }].
  quiz_score SMALLINT,
  quiz_answers JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

-- If the table already exists from an earlier run, add the new columns instead:
-- ALTER TABLE signatures ADD COLUMN IF NOT EXISTS quiz_score SMALLINT;
-- ALTER TABLE signatures ADD COLUMN IF NOT EXISTS quiz_answers JSONB;
-- ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

-- 9. Waitlist (landing-page early-access signups)
CREATE TABLE waitlist (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  company TEXT,
  audience TEXT,        -- 'sub' | 'gc' when the signup came from the pricing page
  plan_interest TEXT,   -- plan id the visitor clicked through from, e.g. 'trade-pro'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_waitlist_email ON waitlist(email);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- If the table already exists from an earlier run, add the new columns instead:
-- ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS audience TEXT;
-- ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS plan_interest TEXT;

-- 10. Company Invites (Phase 8c) — an admin/safety_manager invites a teammate
-- by email to join their own company at a chosen role. `id` is server-
-- generated (uuidv4()), NOT client-generated — the same exception to the
-- offline-sync "id is always client-generated" rule that companies.join_code
-- already carries; this row is never written from an offline client. `token`
-- is a server-generated, URL-safe secret (crypto.randomBytes(32).toString
-- ("hex")) — a distinct mechanism from companies.join_code (GC-only,
-- company-level, human-typed, no expiry). UNIQUE(company_id, email) is what
-- makes "re-invite the same email" a clean upsert instead of duplicate rows.
CREATE TABLE company_invites (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT company_invites_company_email_unique UNIQUE (company_id, email)
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE company_invites ENABLE ROW LEVEL SECURITY;

-- If the table already exists from an earlier run, add the constraint/RLS instead:
-- ALTER TABLE company_invites ADD CONSTRAINT company_invites_company_email_unique UNIQUE (company_id, email);
-- ALTER TABLE company_invites ENABLE ROW LEVEL SECURITY;

-- 11. Jobsites (Phase 8d) — the GC-owned canonical job site a subcontractor's
-- project can attach to, via an accepted email invite (see table 12 below) or
-- the existing join-code link (rewritten in 8d-h to find-or-create one of
-- these instead of just setting projects.gc_company_id). See
-- docs/jobsite-design.md. `id` is server-generated (uuidv4()), the same
-- offline-sync exception companies.join_code and company_invites.id already
-- carry — creating a jobsite is always an online, authenticated GC action,
-- never an offline client write.
CREATE TABLE jobsites (
  id UUID PRIMARY KEY,
  gc_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status project_status NOT NULL DEFAULT 'active',
  archived_at TIMESTAMPTZ,
  -- Phase 9b: per-site GC plan; 'site_pro' = paid GC Site Pro site.
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'site_pro')),
  -- Who originated the row: 'gc' (POST /api/jobsites) or 'subcontractor'
  -- (join-code link find-or-create). NULL = legacy/unknown, never guessed.
  origin TEXT CHECK (origin IN ('gc', 'subcontractor')),
  -- Phase 9e (docs/jobsite-qr-join-design.md): this jobsite's own standing
  -- QR/join link, created lazily on first ask via GET /api/jobsites/:id/join-link.
  -- Unlike jobsite_subcontractors.token below, this one never expires and is
  -- meant to be publicly displayed — the same trust model companies.join_code
  -- already has, just scoped to one jobsite instead of the whole GC company.
  join_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE jobsites ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_jobsites_gc_company ON jobsites (gc_company_id);

-- If the table already exists from an earlier run:
-- ALTER TABLE jobsites ENABLE ROW LEVEL SECURITY;
-- CREATE INDEX IF NOT EXISTS idx_jobsites_gc_company ON jobsites (gc_company_id);
-- ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'site_pro'));  -- Phase 9b
-- ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS origin TEXT CHECK (origin IN ('gc', 'subcontractor'));  -- who created the jobsite; NULL = unknown
-- ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS join_token TEXT UNIQUE;  -- Phase 9e

-- 12. Jobsite Subcontractors (Phase 8d) — folds the GC's invite-by-email into
-- the jobsite roster instead of a separate invites table, so "invited, not
-- yet accepted" and "accepted member" read from one query (see
-- docs/jobsite-design.md "Company-to-company invite"). A row with
-- sub_company_id IS NULL and a live token is a pending invite; sub_company_id
-- set + accepted_at set is a member (token/expires_at nulled on accept, row
-- kept as the membership record). `id`/`token` follow the same
-- server-generated, offline-sync-exempt pattern as company_invites.
CREATE TABLE jobsite_subcontractors (
  id UUID PRIMARY KEY,
  jobsite_id UUID NOT NULL REFERENCES jobsites(id) ON DELETE CASCADE,
  sub_company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  -- Nullable (Phase 9e): NULL on a row created via jobsites.join_token
  -- (docs/jobsite-qr-join-design.md) — that admission path has no invited
  -- email at all, unlike the GC-sent email invite below. Standard SQL treats
  -- every NULL as distinct, so any number of such rows coexist per jobsite
  -- under jobsite_subs_email_unique with no constraint change.
  invited_email TEXT,
  token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT jobsite_subs_email_unique UNIQUE (jobsite_id, invited_email)
);

-- A company holds at most one membership per jobsite once accepted; a partial
-- index (rather than a plain UNIQUE) so any number of still-pending rows
-- (sub_company_id IS NULL, distinct invited_email each) are unaffected.
CREATE UNIQUE INDEX jobsite_subs_company_unique
  ON jobsite_subcontractors (jobsite_id, sub_company_id)
  WHERE sub_company_id IS NOT NULL;

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE jobsite_subcontractors ENABLE ROW LEVEL SECURITY;

-- If the table already exists from an earlier run:
-- ALTER TABLE jobsite_subcontractors ADD CONSTRAINT jobsite_subs_email_unique UNIQUE (jobsite_id, invited_email);
-- CREATE UNIQUE INDEX IF NOT EXISTS jobsite_subs_company_unique ON jobsite_subcontractors (jobsite_id, sub_company_id) WHERE sub_company_id IS NOT NULL;
-- ALTER TABLE jobsite_subcontractors ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE jobsite_subcontractors ALTER COLUMN invited_email DROP NOT NULL;  -- Phase 9e

-- 13. Projects: attach to a jobsite (Phase 8d) — nullable, so every existing
-- sub-owned project (and any new one with no GC, or only a free-text GC) is
-- unaffected. Set by an accepted jobsite invite or a rewritten join-code link
-- (8d-h); projects.gc_company_id stays the authorization column (denormalized
-- from jobsites.gc_company_id at the moment jobsite_id is set) — see
-- docs/jobsite-design.md "Why projects.gc_company_id is retained". Declared
-- here (after table 11) rather than in table 3's CREATE TABLE above because
-- it references jobsites, which doesn't exist yet at that point in this file.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS jobsite_id UUID REFERENCES jobsites(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_jobsite ON projects (jobsite_id);

-- 14. Jobsite Members (Phase 9d-2) — which jobsites a site-scoped user (role
-- 'superintendent', GC Portfolio only) may see. admin/safety_manager are
-- company-wide and need no rows. A permanent user-to-site link, distinct from
-- company_invites (a temporary, email-keyed "may join at this role" row). The
-- composite key needs no client-generated UUID: assignment is an online,
-- authenticated GC action, never an offline write. See docs/gc-roles-design.md.
CREATE TABLE IF NOT EXISTS jobsite_members (
  jobsite_id UUID NOT NULL REFERENCES jobsites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (jobsite_id, user_id)
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE jobsite_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_jobsite_members_user ON jobsite_members (user_id);

-- 15. Companies: top-down corporate policy push (Phase 9e, GC Portfolio only,
-- docs/policy-push-design.md) — the GC's current required safety topic, one
-- row's worth of "current state," not a history. Cleared/replaced by the GC,
-- never auto-expired; NULL required_talk_id means no push is currently
-- active. Declared here (after tables 5 and 2) rather than in table 1's
-- CREATE TABLE above because it references toolbox_talks and users, neither
-- of which exists yet at that point in this file (same reasoning as
-- projects.jobsite_id above).
ALTER TABLE companies ADD COLUMN IF NOT EXISTS required_talk_id UUID REFERENCES toolbox_talks(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS required_talk_pushed_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS required_talk_pushed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 16. Meeting Log Audit Events (Phase 9e, docs/tamper-evidence-design.md) — a
-- lifecycle trail scoped to meeting_logs only (not a general system-wide
-- audit log): created / completed / pdf_generated / seal_verified. `id` is
-- server-generated (uuidv4(), server/services/auditLog.js), the same
-- offline-sync exception jobsites.id/company_invites.id already carry --
-- every event here originates from an authenticated server-side step, never
-- an offline client write. `actor_id` is nullable: a pdf_generated event has
-- no human actor (the async PDF queue produced it), and any actor's account
-- could later be deleted without invalidating the historical event.
CREATE TABLE meeting_log_audit_events (
  id UUID PRIMARY KEY,
  meeting_log_id UUID NOT NULL REFERENCES meeting_logs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'completed', 'pdf_generated', 'seal_verified')),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE meeting_log_audit_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_meeting_log_audit_events_meeting_log_id ON meeting_log_audit_events (meeting_log_id);

-- If the table already exists from an earlier run:
-- CREATE INDEX IF NOT EXISTS idx_meeting_log_audit_events_meeting_log_id ON meeting_log_audit_events (meeting_log_id);
-- ALTER TABLE meeting_log_audit_events ENABLE ROW LEVEL SECURITY;