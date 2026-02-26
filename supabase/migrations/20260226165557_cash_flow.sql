
create table if not exists public.cash_flow (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  year            integer not null,
  quarter         text not null check (quarter in ('Q1','Q2','Q3','Q4')),
  month           text not null,
  inflows         numeric(15,2) not null default 0,
  outflows        numeric(15,2) not null default 0,
  net_cash_flow   numeric(15,2) generated always as (inflows - outflows) stored,
  account_codes   text not null,
  etims_codes     text not null,
  ending_balance  numeric(15,2) not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-update updated_at
create trigger cash_flow_updated_at
  before update on public.cash_flow
  for each row execute procedure public.set_updated_at();

create index if not exists idx_cf_project_id on public.cash_flow(project_id);
create index if not exists idx_cf_year       on public.cash_flow(year);
create index if not exists idx_cf_quarter    on public.cash_flow(quarter);