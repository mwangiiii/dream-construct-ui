
create table if not exists public.bank_reconciliation (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  bank_code         text not null,
  date              date not null,
  description       text not null,
  transaction_code  text not null,
  book_amount       numeric(15,2) not null default 0,
  bank_amount       numeric(15,2) not null default 0,
  difference        numeric(15,2) generated always as (book_amount - bank_amount) stored,
  reconciled        boolean not null default false,
  last_update       date not null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Auto-update updated_at (reuse trigger function from prior migrations)
create trigger bank_reconciliation_updated_at
  before update on public.bank_reconciliation
  for each row execute procedure public.set_updated_at();

-- -- RLS
-- alter table public.bank_reconciliation enable row level security;

-- create policy "Project members can view bank_reconciliation"
--   on public.bank_reconciliation for select using (true);

-- create policy "Project members can insert bank_reconciliation"
--   on public.bank_reconciliation for insert with check (true);

-- create policy "Project members can update bank_reconciliation"
--   on public.bank_reconciliation for update using (true);

-- create policy "Project members can delete bank_reconciliation"
--   on public.bank_reconciliation for delete using (true);

-- Indexes
create index if not exists idx_br_project_id  on public.bank_reconciliation(project_id);
create index if not exists idx_br_date        on public.bank_reconciliation(date);
create index if not exists idx_br_reconciled  on public.bank_reconciliation(reconciled);
create index if not exists idx_br_bank_code   on public.bank_reconciliation(bank_code);