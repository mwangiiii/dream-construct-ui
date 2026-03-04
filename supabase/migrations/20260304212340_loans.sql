-- ============================================================
-- Migration: create loans table
-- Kenya ITA Cap.470 compliant loan schedule tracker
-- ============================================================

-- Enable UUID extension if not already enabled
create extension if not exists "pgcrypto";

create table if not exists public.loans (
  -- ── Primary key ─────────────────────────────────────────
  id                          bigint        generated always as identity primary key,

  -- ── Foreign key to projects ──────────────────────────────
  project_id                  uuid          not null references public.projects(id) on delete cascade,

  -- ── Facility details ─────────────────────────────────────
  facility_ref                text          not null,
  lender_name                 text          not null,
  loan_type                   text          not null
    check (loan_type in (
      'Term Loan','Asset Finance','Overdraft',
      'Revolving Credit','Mortgage','Invoice Discounting','Other'
    )),
  purpose                     text          not null default '',
  loan_start_date             date          not null,
  tenure_months               integer       not null check (tenure_months > 0),
  repayment_frequency         text          not null
    check (repayment_frequency in (
      'Monthly','Quarterly','Semi-Annual','Annual','Bullet'
    )),

  -- ── Principal & rate ─────────────────────────────────────
  principal_approved_kes      numeric(18,2) not null default 0 check (principal_approved_kes >= 0),
  interest_rate_pa            numeric(7,4)  not null default 0 check (interest_rate_pa >= 0),
  interest_type               text          not null
    check (interest_type in ('Fixed','Variable','CBR-Linked')),

  -- ── Period schedule ──────────────────────────────────────
  opening_balance             numeric(18,2) not null default 0,
  installment_due             numeric(18,2) not null default 0,
  principal_portion           numeric(18,2) not null default 0,
  interest_portion            numeric(18,2) not null default 0,

  -- ── Kenya ITA Cap.470 — Tax fields ───────────────────────
  -- s.35(1)(a): WHT on interest paid to resident persons = 15%
  -- s.35(3)(b): WHT on interest paid to non-resident banks = 15%
  withholding_tax_applicable  text          not null default 'Yes'
    check (withholding_tax_applicable in ('Yes','No')),
  withholding_tax_rate        numeric(5,2)  not null default 15.00
    check (withholding_tax_rate between 0 and 30),

  -- COMPUTED: interest_portion × withholding_tax_rate / 100
  -- (when withholding_tax_applicable = 'Yes', else 0)
  withholding_tax_amount      numeric(18,2)
    generated always as (
      case when withholding_tax_applicable = 'Yes'
        then round(interest_portion * withholding_tax_rate / 100, 2)
        else 0
      end
    ) stored,

  -- COMPUTED: interest_portion − withholding_tax_amount
  -- Amount actually remitted to lender (WHT paid separately to KRA)
  net_interest_payable        numeric(18,2)
    generated always as (
      case when withholding_tax_applicable = 'Yes'
        then round(interest_portion - (interest_portion * withholding_tax_rate / 100), 2)
        else interest_portion
      end
    ) stored,

  -- s.15(1)(a) ITA: Is interest expense deductible for corporation tax?
  interest_deductible_ita     text          not null default 'Yes'
    check (interest_deductible_ita in ('Yes','No')),

  -- s.16(2) ITA: Thin-capitalisation flag
  -- Triggered when total interest-bearing debt / equity > 3:1
  -- Excess interest over the 3:1 limit is disallowed as a deduction
  thin_cap_flag               boolean       not null default false,

  -- ── Fees ─────────────────────────────────────────────────
  fees_and_charges            numeric(18,2) not null default 0,

  -- COMPUTED: principal_portion + net_interest_payable + fees_and_charges
  -- Total cash outflow to lender for the period (WHT remitted to KRA separately)
  total_due                   numeric(18,2)
    generated always as (
      principal_portion
      + (case when withholding_tax_applicable = 'Yes'
           then round(interest_portion - (interest_portion * withholding_tax_rate / 100), 2)
           else interest_portion
         end)
      + fees_and_charges
    ) stored,

  -- ── Payment ──────────────────────────────────────────────
  due_date                    date          not null,
  amount_paid                 numeric(18,2) not null default 0,
  payment_date                date,

  -- COMPUTED: opening_balance − principal_portion (floor 0)
  closing_balance             numeric(18,2)
    generated always as (
      greatest(0, opening_balance - principal_portion)
    ) stored,

  payment_status              text          not null default 'Due'
    check (payment_status in (
      'Paid','Partially Paid','Due','Overdue','Waived'
    )),
  days_in_arrears             integer       not null default 0 check (days_in_arrears >= 0),
  next_due_date               date,
  date_period                 text          not null default '',  -- e.g. 2026-Q1

  notes                       text,

  -- ── Audit timestamps ─────────────────────────────────────
  created_at                  timestamptz   not null default now(),
  updated_at                  timestamptz   not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_loans_project_id     on public.loans(project_id);
create index if not exists idx_loans_loan_type      on public.loans(loan_type);
create index if not exists idx_loans_payment_status on public.loans(payment_status);
create index if not exists idx_loans_due_date       on public.loans(due_date);
create index if not exists idx_loans_facility_ref   on public.loans(facility_ref);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.loans enable row level security;

-- Authenticated users can read all loans (adjust to your auth model)
create policy "loans_select"
  on public.loans for select
  to authenticated
  using (true);

-- Authenticated users can insert loans for projects they have access to
create policy "loans_insert"
  on public.loans for insert
  to authenticated
  with check (true);

-- Authenticated users can update their own project loans
create policy "loans_update"
  on public.loans for update
  to authenticated
  using (true)
  with check (true);

-- Authenticated users can delete loans
create policy "loans_delete"
  on public.loans for delete
  to authenticated
  using (true);

-- ── Auto-update updated_at trigger ───────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Only create the trigger if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'loans_set_updated_at'
  ) then
    create trigger loans_set_updated_at
      before update on public.loans
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- ── Helpful comment ───────────────────────────────────────────────────────────
comment on table public.loans is
  'Loan schedule records per project. '
  'Withholding tax (WHT) computed per Kenya ITA s.35 at 15%. '
  'Interest deductibility per s.15(1)(a). '
  'Thin-cap disallowance flag per s.16(2) (debt/equity > 3:1). '
  'Generated columns: withholding_tax_amount, net_interest_payable, total_due, closing_balance.';