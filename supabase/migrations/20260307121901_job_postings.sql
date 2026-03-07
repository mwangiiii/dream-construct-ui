create table public.job_postings (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  phase                text not null check (phase in (
                         'Mobilization','Excavation','Foundation',
                         'Superstructure','Roofing','Finishes','Handover'
                       )),
  stage                text not null default '',
  description          text not null default '',
  account_code         text not null default '',
  etims_code           text not null default '',
  budgeted_amount_paid numeric(15,2) not null default 0,
  actual_amount_used   numeric(15,2) not null default 0,
  profit_loss          numeric(15,2) not null default 0,
  amount               numeric(15,2) not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger job_postings_updated_at
  before update on public.job_postings
  for each row execute procedure public.set_updated_at();

-- Indexes
create index on public.job_postings(project_id);
create index on public.job_postings(phase);

-- RLS
alter table public.job_postings enable row level security;

create policy "Authenticated users can read job_postings"
  on public.job_postings for select
  to authenticated using (true);

create policy "Authenticated users can insert job_postings"
  on public.job_postings for insert
  to authenticated with check (true);

create policy "Authenticated users can update job_postings"
  on public.job_postings for update
  to authenticated using (true);

create policy "Authenticated users can delete job_postings"
  on public.job_postings for delete
  to authenticated using (true);