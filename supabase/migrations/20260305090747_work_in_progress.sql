-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create work_in_progress table
-- Depends on: projects table (must exist)
-- ─────────────────────────────────────────────────────────────────────────────

create type wip_billed_status as enum ('overbilled', 'underbilled', 'on_budget');

create table if not exists public.work_in_progress (
  id                 bigserial primary key,
  project_id         uuid        not null references public.projects(id) on delete cascade,

  -- Contract & progress
  total_contract     numeric(18,2) not null default 0 check (total_contract >= 0),
  cost_incurred      numeric(18,2) not null default 0 check (cost_incurred >= 0),
  percent_complete   numeric(5,2)  not null default 0
                       check (percent_complete >= 0 and percent_complete <= 100),

  -- Revenue & billing
  earned_revenue     numeric(18,2) not null default 0,
  billed_to_date     numeric(18,2) not null default 0 check (billed_to_date >= 0),
  billed_status      wip_billed_status not null default 'on_budget',
  amount             numeric(18,2) not null default 0,  -- |billed_to_date - earned_revenue|

  -- References
  account            text,
  code_receivable    text,
  notes              text,

  -- Timestamps
  last_update        date         not null default current_date,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists wip_project_id_idx        on public.work_in_progress(project_id);
create index if not exists wip_last_update_idx       on public.work_in_progress(last_update desc);
create index if not exists wip_billed_status_idx     on public.work_in_progress(billed_status);

-- ── Auto-update updated_at ───────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wip_set_updated_at on public.work_in_progress;
create trigger wip_set_updated_at
  before update on public.work_in_progress
  for each row execute function public.set_updated_at();

-- ── Auto-derive billed_status and amount from earned vs billed ───────────────
create or replace function public.wip_derive_billing()
returns trigger language plpgsql as $$
declare
  diff numeric;
begin
  -- Clamp percent_complete
  new.percent_complete := greatest(0, least(100, new.percent_complete));

  -- Auto-compute earned_revenue if not explicitly overridden
  -- (only when both total_contract and percent_complete are set)
  if new.total_contract > 0 and new.percent_complete > 0 then
    new.earned_revenue := round(new.total_contract * new.percent_complete / 100.0, 2);
  end if;

  -- Derive billing variance amount and status
  diff := new.billed_to_date - new.earned_revenue;
  new.amount := round(abs(diff), 2);

  if diff > 0.01 then
    new.billed_status := 'overbilled';
  elsif diff < -0.01 then
    new.billed_status := 'underbilled';
  else
    new.billed_status := 'on_budget';
  end if;

  return new;
end;
$$;

drop trigger if exists wip_billing_derive on public.work_in_progress;
create trigger wip_billing_derive
  before insert or update on public.work_in_progress
  for each row execute function public.wip_derive_billing();

-- ── Row-Level Security ────────────────────────────────────────────────────────
alter table public.work_in_progress enable row level security;

-- Authenticated users can read all WIP entries
create policy "wip_select_authenticated"
  on public.work_in_progress for select
  to authenticated
  using (true);

-- Authenticated users can insert
create policy "wip_insert_authenticated"
  on public.work_in_progress for insert
  to authenticated
  with check (true);

-- Authenticated users can update
create policy "wip_update_authenticated"
  on public.work_in_progress for update
  to authenticated
  using (true)
  with check (true);

-- Authenticated users can delete
create policy "wip_delete_authenticated"
  on public.work_in_progress for delete
  to authenticated
  using (true);

-- ── Seed data (mirrors the original static data — safe to remove) ─────────────
-- Replace the project_id values with real UUIDs from your projects table.
-- insert into public.work_in_progress
--   (project_id, total_contract, cost_incurred, percent_complete, earned_revenue,
--    billed_to_date, account, code_receivable, last_update)
-- values
--   ('<project-uuid-1>', 500000, 200000, 40, 180000, 150000, '1002', 'CR-001', '2026-02-20'),
--   ('<project-uuid-2>', 800000, 600000, 75, 600000, 620000, '1001', 'CR-002', '2026-02-22'),
--   ('<project-uuid-3>', 300000, 100000, 33, 99000,  95000,  '1002', 'CR-003', '2026-02-25');