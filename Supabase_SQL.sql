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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  owner_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gc_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  gc_name_custom TEXT,
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
-- If the table already exists from an earlier run, add the new column instead:
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
-- 4. Project Subcontractors (Many-to-Many)
CREATE TABLE project_subcontractors (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  sub_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, sub_id)
);

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
-- CREATE INDEX IF NOT EXISTS idx_toolbox_talks_trades ON toolbox_talks USING GIN (trade_tags);
-- ALTER TABLE toolbox_talks ENABLE ROW LEVEL SECURITY;

-- 6. Meeting Logs
CREATE TABLE meeting_logs (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  talk_id UUID REFERENCES toolbox_talks(id) ON DELETE SET NULL,
  foreman_id UUID REFERENCES users(id) ON DELETE SET NULL,
  crew_photo_url TEXT,
  final_pdf_url TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Signatures
CREATE TABLE signatures (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meeting_logs(id) ON DELETE CASCADE,
  worker_name TEXT NOT NULL,
  signature_path TEXT NOT NULL,
  quiz_passed BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Waitlist (landing-page early-access signups)
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