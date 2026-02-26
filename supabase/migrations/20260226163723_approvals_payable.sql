
create table if not exists public.accounts_payable (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  vendor_name             text not null,
  invoice_number          text not null,
  etims_code              text not null,
  date                    date not null,
  due_date                date not null,
  total_amount            numeric(15,2) not null default 0,
  paid_amount             numeric(15,2) not null default 0,
  balance                 numeric(15,2) generated always as (total_amount - paid_amount) stored,
  status                  text not null default 'open'
                          check (status in ('open','paid','overdue','partial')),
  retaining_percent       numeric(5,2) not null default 0,
  date_of_payment         date,
  receiving_account_code  text not null,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger accounts_payable_updated_at
  before update on public.accounts_payable
  for each row execute procedure public.set_updated_at();