-- Drop old tables and recreate with proper Supabase Auth integration

-- Drop existing tables in correct order (foreign keys first)
DROP TABLE IF EXISTS public.project_approvals CASCADE;
DROP TABLE IF EXISTS public.project_updates CASCADE;
DROP TABLE IF EXISTS public.project_milestones CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create app_role enum for role-based access control
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'project_manager', 'client');

-- Create profiles table linked to Supabase Auth
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User roles RLS policies
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Security definer function to check roles (avoids recursive RLS issues)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Recreate projects table with UUID references
CREATE TABLE public.projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    project_name VARCHAR(200) NOT NULL,
    project_description TEXT,
    start_date DATE,
    end_date DATE,
    status_id INTEGER NOT NULL REFERENCES public.user_statuses(status_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Set default status for projects
CREATE OR REPLACE FUNCTION public.set_default_project_status()
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

CREATE TRIGGER set_default_project_status_trigger
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_default_project_status();

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Projects RLS policies
CREATE POLICY "Managers view own projects" ON public.projects
    FOR SELECT USING (
        auth.uid() = manager_id OR 
        public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Clients view own projects" ON public.projects
    FOR SELECT USING (
        auth.uid() = client_id OR 
        public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Managers and admins can insert projects" ON public.projects
    FOR INSERT WITH CHECK (
        public.has_role(auth.uid(), 'manager') OR 
        public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Managers and admins can update projects" ON public.projects
    FOR UPDATE USING (
        auth.uid() = manager_id OR 
        public.has_role(auth.uid(), 'admin')
    );

-- Create project_milestones table
CREATE TABLE public.project_milestones (
    milestone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    milestone_name VARCHAR(200) NOT NULL,
    description TEXT,
    phase VARCHAR(100),
    target_date DATE,
    completion_date DATE,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    status_id INTEGER NOT NULL REFERENCES public.user_statuses(status_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_default_milestone_status_trigger
BEFORE INSERT ON public.project_milestones
FOR EACH ROW
EXECUTE FUNCTION public.set_default_project_status();

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view milestones of accessible projects" ON public.project_milestones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.project_id = project_milestones.project_id
            AND (p.manager_id = auth.uid() OR p.client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
        )
    );

-- Create project_updates table
CREATE TABLE public.project_updates (
    update_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    update_title VARCHAR(200) NOT NULL,
    update_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view updates of accessible projects" ON public.project_updates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.project_id = project_updates.project_id
            AND (p.manager_id = auth.uid() OR p.client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
        )
    );

-- Create project_approvals table
CREATE TABLE public.project_approvals (
    approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approval_type VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.project_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view approvals of accessible projects" ON public.project_approvals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.project_id = project_approvals.project_id
            AND (p.manager_id = auth.uid() OR p.client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
        )
    );

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone'
  );
  
  -- Assign default role (client) to new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_profiles_created_at ON public.profiles(created_at);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_projects_client_id ON public.projects(client_id);
CREATE INDEX idx_projects_manager_id ON public.projects(manager_id);
CREATE INDEX idx_projects_status_id ON public.projects(status_id);
CREATE INDEX idx_project_milestones_project_id ON public.project_milestones(project_id);
CREATE INDEX idx_project_updates_project_id ON public.project_updates(project_id);
CREATE INDEX idx_project_approvals_project_id ON public.project_approvals(project_id);