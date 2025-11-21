-- Create projects table (without subquery in DEFAULT)
CREATE TABLE IF NOT EXISTS public.projects (
    project_id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    manager_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    project_name VARCHAR(200) NOT NULL,
    project_description TEXT,
    start_date DATE,
    end_date DATE,
    status_id INTEGER NOT NULL REFERENCES public.user_statuses(status_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Fixed policy: Cast auth.uid() to TEXT and compare with user_id::TEXT
CREATE POLICY "Managers view own projects" ON public.projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.user_id = projects.manager_id 
            AND u.user_id::TEXT = auth.uid()::TEXT
        )
    );

-- Additional policy for clients to view their projects
CREATE POLICY "Clients view own projects" ON public.projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.user_id = projects.client_id 
            AND u.user_id::TEXT = auth.uid()::TEXT
        )
    );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON public.projects (manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_status_id ON public.projects (status_id);

-- Helper function to set default project status
CREATE OR REPLACE FUNCTION set_default_project_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_id IS NULL THEN
    SELECT status_id INTO NEW.status_id
    FROM public.user_statuses
    WHERE status_name = 'active'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-set default status on insert
CREATE TRIGGER projects_set_default_status
    BEFORE INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION set_default_project_status();

-- Create project_milestones table
CREATE TABLE IF NOT EXISTS public.project_milestones (
    milestone_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    milestone_name VARCHAR(200) NOT NULL,
    phase VARCHAR(100),
    description TEXT,
    target_date DATE,
    completion_date DATE,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    status_id INTEGER NOT NULL REFERENCES public.user_statuses(status_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view milestones of accessible projects" ON public.project_milestones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            INNER JOIN public.users u ON (u.user_id = p.manager_id OR u.user_id = p.client_id)
            WHERE p.project_id = project_milestones.project_id 
            AND u.user_id::TEXT = auth.uid()::TEXT
        )
    );

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON public.project_milestones (project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status_id ON public.project_milestones (status_id);

-- Trigger to auto-set default status for milestones
CREATE TRIGGER milestones_set_default_status
    BEFORE INSERT ON public.project_milestones
    FOR EACH ROW
    EXECUTE FUNCTION set_default_project_status();

-- Create project_updates table
CREATE TABLE IF NOT EXISTS public.project_updates (
    update_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    update_title VARCHAR(200) NOT NULL,
    update_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view updates of accessible projects" ON public.project_updates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            INNER JOIN public.users u ON (u.user_id = p.manager_id OR u.user_id = p.client_id)
            WHERE p.project_id = project_updates.project_id 
            AND u.user_id::TEXT = auth.uid()::TEXT
        )
    );

CREATE INDEX IF NOT EXISTS idx_updates_project_id ON public.project_updates (project_id);
CREATE INDEX IF NOT EXISTS idx_updates_user_id ON public.project_updates (user_id);

-- Create project_approvals table
CREATE TABLE IF NOT EXISTS public.project_approvals (
    approval_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    requested_by INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    approval_type VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER REFERENCES public.users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.project_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view approvals of accessible projects" ON public.project_approvals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            INNER JOIN public.users u ON (u.user_id = p.manager_id OR u.user_id = p.client_id)
            WHERE p.project_id = project_approvals.project_id 
            AND u.user_id::TEXT = auth.uid()::TEXT
        )
    );

CREATE INDEX IF NOT EXISTS idx_approvals_project_id ON public.project_approvals (project_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.project_approvals (status);