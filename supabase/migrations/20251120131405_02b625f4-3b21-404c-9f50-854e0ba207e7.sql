-- Create UUID extension
create extension if not exists "uuid-ossp";

-- Create roles table
create table if not exists public.roles (
  role_id serial primary key,
  role_name varchar(50) not null unique
);

alter table public.roles enable row level security;

create policy "public read roles" on public.roles
  for select using (true);

insert into public.roles (role_name) values
  ('client'),
  ('manager'),
  ('project Manager'),
  ('admin')
on conflict (role_name) do nothing;

-- Create user_statuses table
CREATE TABLE IF NOT EXISTS public.user_statuses (
    status_id SERIAL PRIMARY KEY,
    status_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.user_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read user statuses" ON public.user_statuses
    FOR SELECT USING (true);

INSERT INTO public.user_statuses (status_name, description, is_active) VALUES 
    ('active', 'User is fully active and can access all features', true),
    ('inactive', 'User account is inactive but can be reactivated', false),
    ('banned', 'User is permanently banned due to violations', false),
    ('suspended', 'User is temporarily suspended (e.g., for review)', false),
    ('pending', 'User account is pending verification or approval', false),
    ('archived', 'User account is archived and hidden from active lists', false)
ON CONFLICT (status_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_user_statuses_name ON public.user_statuses (status_name);
CREATE INDEX IF NOT EXISTS idx_user_statuses_active ON public.user_statuses (is_active);

-- Create users table
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE IF NOT EXISTS public.users (
    user_id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES public.roles(role_id) ON DELETE RESTRICT,
    status_id INTEGER NOT NULL REFERENCES public.user_statuses(status_id) ON DELETE RESTRICT,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Active users can update own profile" ON public.users
    FOR UPDATE USING (
        auth.uid()::text = user_id::text 
        AND status_id = (SELECT status_id FROM public.user_statuses WHERE status_name = 'active')
    );

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON public.users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_status_id ON public.users (status_id);

CREATE OR REPLACE FUNCTION set_default_user_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_id IS NULL THEN
    SELECT status_id INTO NEW.status_id
    FROM public.user_statuses
    WHERE status_name = 'active'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_default_status
    BEFORE INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION set_default_user_status();