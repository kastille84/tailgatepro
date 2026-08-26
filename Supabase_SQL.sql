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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure either a registered GC ID or a custom GC name is provided
  CONSTRAINT check_gc_info CHECK (
    gc_company_id IS NOT NULL OR gc_name_custom IS NOT NULL
  )
);
-- 4. Project Subcontractors (Many-to-Many)
CREATE TABLE project_subcontractors (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  sub_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, sub_id)
);

-- 5. Toolbox Talks (Content Library)
CREATE TABLE toolbox_talks (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  trade_tag TEXT,
  content TEXT NOT NULL,
  is_global BOOLEAN DEFAULT true,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_toolbox_talks_trade ON toolbox_talks(trade_tag);

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