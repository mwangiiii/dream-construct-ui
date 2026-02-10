-- Migration for project_issues table for Problems & Issues CRUD
CREATE TABLE IF NOT EXISTS project_issues (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Open',
    reported_by TEXT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Trigger to update updated_at on row update
CREATE OR REPLACE FUNCTION update_project_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_issues_updated_at ON project_issues;
CREATE TRIGGER trg_project_issues_updated_at
BEFORE UPDATE ON project_issues
FOR EACH ROW EXECUTE PROCEDURE update_project_issues_updated_at();
