
create table if not exists public.accounts_receivable (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  client            text not null,
  billing           text not null,
  etims_code        text not null,
  purpose           text not null,
  date              date not null,
  due_date          date not null,
  amount_billed     numeric(15,2) not null default 0,
  amount_received   numeric(15,2) not null default 0,
  balance           numeric(15,2) generated always as (amount_billed - amount_received) stored,
  aging             integer not null default 0,
  status            text not null default 'outstanding'
                    check (status in ('outstanding','paid','overdue','partial')),
  retainings        numeric(5,2) not null default 0,
  account_received  text not null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Auto-update updated_at (reuse trigger function if already created for accounts_payable)
create trigger accounts_receivable_updated_at
  before update on public.accounts_receivable
  for each row execute procedure public.set_updated_at();


-- Indexes
create index if not exists idx_ar_project_id on public.accounts_receivable(project_id);
create index if not exists idx_ar_status     on public.accounts_receivable(status);
create index if not exists idx_ar_due_date   on public.accounts_receivable(due_date);