-- ============================================================
-- Migration: Create policies system
-- ============================================================

-- Policy categories (tabs)
CREATE TABLE IF NOT EXISTS policy_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT DEFAULT 'FileText',
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Individual policies within a category
CREATE TABLE IF NOT EXISTS policies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES policy_categories(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_policies_category_id ON policies(category_id);
CREATE INDEX IF NOT EXISTS idx_policy_categories_slug ON policy_categories(slug);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE policy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- Policy Categories RLS
-- Anyone authenticated (except client role) can read
CREATE POLICY "Authenticated users can read policy_categories"
  ON policy_categories FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/managers can write
CREATE POLICY "Admins can manage policy_categories"
  ON policy_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager')
    )
  );

-- Policies RLS
-- Authenticated non-client users can read active policies
CREATE POLICY "Authenticated non-clients can read policies"
  ON policies FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role NOT IN ('client')
    )
  );

-- Admins can read ALL policies (including inactive)
CREATE POLICY "Admins can read all policies"
  ON policies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager')
    )
  );

-- Only admins can write
CREATE POLICY "Admins can manage policies"
  ON policies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager')
    )
  );

-- ============================================================
-- Updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_policy_categories_updated_at
  BEFORE UPDATE ON policy_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Seed default categories
-- ============================================================

INSERT INTO policy_categories (title, slug, description, icon, sort_order) VALUES
  ('Company Policies',    'company',    'General company-wide policies and guidelines',    'Building2',   1),
  ('HR & Conduct',        'hr-conduct', 'Human resources and workplace conduct policies',  'Users',       2),
  ('Health & Safety',     'safety',     'Site safety, PPE, and emergency procedures',      'ShieldCheck', 3),
  ('Data & Privacy',      'privacy',    'Data handling and privacy policies',              'Lock',        4)
ON CONFLICT (slug) DO NOTHING;