
create table if not exists public.balance_sheet (
  id                            uuid primary key default gen_random_uuid(),
  project_id                    uuid not null references public.projects(id) on delete cascade,
  -- Assets
  type_asset                    text not null check (type_asset in ('current','fixed','other')),
  asset_name                    text not null,
  asset_amount                  numeric(15,2) not null default 0,
  current_fixed_others          text not null,
  -- Liabilities
  liabilities                   text not null,
  current_liabilities           text not null,
  current_liabilities_amount    numeric(15,2) not null default 0,
  long_term_liabilities         text not null,
  long_term_liabilities_amount  numeric(15,2) not null default 0,
  -- Equity
  owner_equity                  text not null,
  owner_equity_amount           numeric(15,2) not null default 0,
  -- Meta
  period_date                   date not null,
  notes                         text,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- Auto-update updated_at (reuse trigger function from accounts_payable migration)
create trigger balance_sheet_updated_at
  before update on public.balance_sheet
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.balance_sheet enable row level security;

create policy "Project members can view balance_sheet"
  on public.balance_sheet for select using (true);

create policy "Project members can insert balance_sheet"
  on public.balance_sheet for insert with check (true);

create policy "Project members can update balance_sheet"
  on public.balance_sheet for update using (true);

create policy "Project members can delete balance_sheet"
  on public.balance_sheet for delete using (true);

-- Indexes
create index if not exists idx_bs_project_id  on public.balance_sheet(project_id);
create index if not exists idx_bs_period_date on public.balance_sheet(period_date);
create index if not exists idx_bs_type_asset  on public.balance_sheet(type_asset);