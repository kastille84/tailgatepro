-- Create Enums
CREATE TYPE company_type AS ENUM ('gc', 'subcontractor');
CREATE TYPE subscription_tier AS ENUM ('basic', 'premium', 'enterprise');
CREATE TYPE user_role AS ENUM ('admin', 'safety_manager', 'foreman');
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
  -- Ensure either a registered GC ID or a custom GC name is provided
  CONSTRAINT check_gc_info CHECK (
    gc_company_id IS NOT NULL OR gc_name_custom IS NOT NULL
  )
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- If the table already exists from an earlier run, add the new column(s) instead:
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS gc_contact_email TEXT;
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 4. Project Subcontractors (Many-to-Many)
CREATE TABLE project_subcontractors (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  sub_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, sub_id)
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
-- If the table already exists from an earlier run:
-- ALTER TABLE project_subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_subcontractors ENABLE ROW LEVEL SECURITY;

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
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server-only table: enable RLS with NO policies so the public anon key is
-- denied all access. The server's service-role key bypasses RLS and still works.
ALTER TABLE meeting_logs ENABLE ROW LEVEL SECURITY;

-- If the table already exists from an earlier run, add the new columns instead:
-- ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
-- ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
-- ALTER TABLE meeting_logs ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ;
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