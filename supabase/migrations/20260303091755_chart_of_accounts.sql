-- =============================================================================
--  chart_of_accounts — full idempotent migration
--  Safe to run multiple times. Copy-paste the entire file into:
--  Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================


-- ── 1. ENUM TYPES (idempotent) ────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE account_type_enum AS ENUM ('Receivable', 'Payable', 'N/A');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_category_enum AS ENUM (
    'Asset', 'Liability', 'Equity', 'Income', 'Expense'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_subcategory_enum AS ENUM (
    'Current Asset',
    'Non-Current Asset',
    'Current Liability',
    'Non-Current Liability',
    'Owner''s Equity',
    'Retained Earnings',
    'Direct Income',
    'Indirect Income',
    'Cost of Goods Sold',
    'Operating Expense',
    'Non-Operating Expense'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 2. TABLE ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id            BIGSERIAL                 PRIMARY KEY,
  account_type  account_type_enum         NOT NULL DEFAULT 'N/A',
  category      account_category_enum     NOT NULL,
  subcategory   account_subcategory_enum  NOT NULL,
  account_code  VARCHAR(20)               NOT NULL,
  account_name  VARCHAR(255)              NOT NULL,
  description   TEXT,
  bank_name     VARCHAR(255)              NOT NULL DEFAULT 'N/A',
  active        BOOLEAN                   NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  created_by    UUID                      REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    UUID                      REFERENCES auth.users(id) ON DELETE SET NULL
);


-- ── 3. CONSTRAINTS (each wrapped so re-runs don't error) ──────────────────────

DO $$ BEGIN
  ALTER TABLE public.chart_of_accounts
    ADD CONSTRAINT uq_account_code UNIQUE (account_code);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.chart_of_accounts
    ADD CONSTRAINT uq_account_name UNIQUE (account_name);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.chart_of_accounts
    ADD CONSTRAINT chk_account_code_format
    CHECK (account_code ~ '^\d{4,10}$');
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL; END $$;


-- ── 4. INDEXES ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_coa_category     ON public.chart_of_accounts (category);
CREATE INDEX IF NOT EXISTS idx_coa_subcategory  ON public.chart_of_accounts (subcategory);
CREATE INDEX IF NOT EXISTS idx_coa_account_type ON public.chart_of_accounts (account_type);
CREATE INDEX IF NOT EXISTS idx_coa_active       ON public.chart_of_accounts (active);
CREATE INDEX IF NOT EXISTS idx_coa_account_code ON public.chart_of_accounts (account_code);

CREATE INDEX IF NOT EXISTS idx_coa_fts ON public.chart_of_accounts
  USING GIN (to_tsvector('english', account_name || ' ' || COALESCE(description, '')));


-- ── 5. updated_at TRIGGER ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_coa_updated_at ON public.chart_of_accounts;
CREATE TRIGGER trg_coa_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 6. ROW LEVEL SECURITY ─────────────────────────────────────────────────────
-- The browser uses the ANON key, so policies must allow the `anon` role.
-- Authenticated users (logged-in) also get access.

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies so this block is idempotent
DROP POLICY IF EXISTS "anon and authenticated can select"  ON public.chart_of_accounts;
DROP POLICY IF EXISTS "anon and authenticated can insert"  ON public.chart_of_accounts;
DROP POLICY IF EXISTS "anon and authenticated can update"  ON public.chart_of_accounts;
DROP POLICY IF EXISTS "anon and authenticated can delete"  ON public.chart_of_accounts;

-- SELECT — anon + authenticated
CREATE POLICY "anon and authenticated can select"
  ON public.chart_of_accounts
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT — anon + authenticated
CREATE POLICY "anon and authenticated can insert"
  ON public.chart_of_accounts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- UPDATE — anon + authenticated
CREATE POLICY "anon and authenticated can update"
  ON public.chart_of_accounts
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE — anon + authenticated
CREATE POLICY "anon and authenticated can delete"
  ON public.chart_of_accounts
  FOR DELETE
  TO anon, authenticated
  USING (true);


-- ── 7. SUMMARY VIEW ───────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_chart_of_accounts_summary AS
SELECT
  category,
  subcategory,
  COUNT(*)                                  AS total_accounts,
  COUNT(*) FILTER (WHERE active = TRUE)     AS active_count,
  COUNT(*) FILTER (WHERE active = FALSE)    AS inactive_count
FROM public.chart_of_accounts
GROUP BY category, subcategory
ORDER BY category, subcategory;


-- ── 8. SEED DATA ──────────────────────────────────────────────────────────────
-- ON CONFLICT DO NOTHING means safe to re-run; existing rows are untouched.

INSERT INTO public.chart_of_accounts
  (account_type, category, subcategory, account_code, account_name, description, bank_name, active)
VALUES
  -- Assets – Current
  ('Receivable','Asset','Current Asset','1010','Cash – Operating Account','Primary operating cash held in current account','First National Bank',TRUE),
  ('Receivable','Asset','Current Asset','1020','Cash – Petty Cash Fund','On-hand petty cash for minor day-to-day expenses','N/A',TRUE),
  ('Receivable','Asset','Current Asset','1030','Cash – Payroll Account','Dedicated account for salary and wage disbursements','First National Bank',TRUE),
  ('Receivable','Asset','Current Asset','1100','Accounts Receivable – Trade','Amounts owed by customers for goods/services delivered','N/A',TRUE),
  ('Receivable','Asset','Current Asset','1105','Allowance for Doubtful Accounts','Contra-asset: estimated uncollectable receivables','N/A',TRUE),
  ('Receivable','Asset','Current Asset','1110','Notes Receivable – Short-term','Formal promissory notes due within 12 months','N/A',TRUE),
  ('Receivable','Asset','Current Asset','1200','Inventory – Raw Materials','Cost of raw materials on hand for production','N/A',TRUE),
  ('Receivable','Asset','Current Asset','1210','Inventory – Work-in-Progress','Partially completed goods in the production process','N/A',TRUE),
  ('Receivable','Asset','Current Asset','1220','Inventory – Finished Goods','Completed goods ready for sale','N/A',TRUE),
  ('Receivable','Asset','Current Asset','1300','Prepaid Expenses','Expenses paid in advance (insurance, rent, subscriptions)','N/A',TRUE),
  ('Receivable','Asset','Current Asset','1350','VAT / GST Receivable','Input tax credit claimable from tax authority','N/A',TRUE),
  -- Assets – Non-Current
  ('Receivable','Asset','Non-Current Asset','1510','Land & Buildings','Freehold and leasehold property owned by the company','N/A',TRUE),
  ('Receivable','Asset','Non-Current Asset','1520','Plant & Machinery','Manufacturing equipment and heavy machinery','N/A',TRUE),
  ('Receivable','Asset','Non-Current Asset','1530','Office Furniture & Equipment','Desks, chairs, computers, and office devices','N/A',TRUE),
  ('Receivable','Asset','Non-Current Asset','1540','Motor Vehicles','Company-owned vehicles used for business operations','N/A',TRUE),
  ('Receivable','Asset','Non-Current Asset','1590','Accumulated Depreciation','Contra-asset: total depreciation charged to date','N/A',TRUE),
  ('Receivable','Asset','Non-Current Asset','1610','Intangible Assets – Goodwill','Premium paid over fair value in business acquisitions','N/A',TRUE),
  ('Receivable','Asset','Non-Current Asset','1620','Intangible Assets – Patents','Registered intellectual property owned by the company','N/A',TRUE),
  ('Receivable','Asset','Non-Current Asset','1700','Long-term Investments','Strategic equity investments and bonds held to maturity','N/A',FALSE),
  -- Liabilities – Current
  ('Payable','Liability','Current Liability','2010','Accounts Payable – Trade','Amounts owed to suppliers for goods/services received','N/A',TRUE),
  ('Payable','Liability','Current Liability','2020','Accrued Expenses','Expenses incurred but not yet invoiced or paid','N/A',TRUE),
  ('Payable','Liability','Current Liability','2030','Salaries & Wages Payable','Earned wages owed to employees at period end','N/A',TRUE),
  ('Payable','Liability','Current Liability','2040','Income Tax Payable','Corporate income tax liability due to tax authority','N/A',TRUE),
  ('Payable','Liability','Current Liability','2050','VAT / GST Payable','Output tax collected on behalf of tax authority','N/A',TRUE),
  ('Payable','Liability','Current Liability','2060','Short-term Bank Overdraft','Overdrawn balance on operating bank account','First National Bank',TRUE),
  ('Payable','Liability','Current Liability','2070','Deferred Revenue – Short-term','Customer payments received for services not yet rendered','N/A',TRUE),
  ('Payable','Liability','Current Liability','2080','Dividends Payable','Declared but unpaid dividends owed to shareholders','N/A',FALSE),
  -- Liabilities – Non-Current
  ('Payable','Liability','Non-Current Liability','2510','Long-term Bank Loan','Bank borrowings repayable beyond 12 months','Meridian Capital Bank',TRUE),
  ('Payable','Liability','Non-Current Liability','2520','Bonds Payable','Corporate bonds issued and outstanding','N/A',TRUE),
  ('Payable','Liability','Non-Current Liability','2530','Finance Lease Obligations','Liability for assets acquired under finance leases','N/A',TRUE),
  ('Payable','Liability','Non-Current Liability','2540','Deferred Tax Liability','Future tax obligations from temporary timing differences','N/A',TRUE),
  ('Payable','Liability','Non-Current Liability','2550','Pension & Retirement Obligations','Defined benefit pension liability to employees','N/A',FALSE),
  -- Equity
  ('N/A','Equity','Owner''s Equity','3010','Common Share Capital','Par value of ordinary shares issued and fully paid','N/A',TRUE),
  ('N/A','Equity','Owner''s Equity','3020','Preference Share Capital','Par value of preference shares with fixed dividend','N/A',TRUE),
  ('N/A','Equity','Owner''s Equity','3030','Share Premium Reserve','Proceeds above par value from share issuance','N/A',TRUE),
  ('N/A','Equity','Retained Earnings','3100','Retained Earnings','Cumulative net profit retained after dividend distributions','N/A',TRUE),
  ('N/A','Equity','Retained Earnings','3110','Current Year Profit / Loss','Net income or loss for the current financial year','N/A',TRUE),
  ('N/A','Equity','Owner''s Equity','3200','Revaluation Reserve','Surplus from upward revaluation of fixed assets','N/A',TRUE),
  ('N/A','Equity','Owner''s Equity','3300','Treasury Shares','Cost of own shares bought back and held by the company','N/A',FALSE),
  -- Income – Direct
  ('Receivable','Income','Direct Income','4010','Sales Revenue – Products','Revenue from sale of manufactured or purchased goods','N/A',TRUE),
  ('Receivable','Income','Direct Income','4020','Sales Revenue – Services','Revenue from professional and managed services rendered','N/A',TRUE),
  ('Receivable','Income','Direct Income','4030','Sales Returns & Allowances','Contra-revenue: credits for returned or damaged goods','N/A',TRUE),
  -- Income – Indirect
  ('Receivable','Income','Indirect Income','4510','Interest Income','Interest earned on deposits, loans, and investments','N/A',TRUE),
  ('Receivable','Income','Indirect Income','4520','Dividend Income','Dividends received from equity investments','N/A',TRUE),
  ('Receivable','Income','Indirect Income','4530','Gain on Disposal of Assets','Profit realised on sale of fixed or intangible assets','N/A',FALSE),
  ('Receivable','Income','Indirect Income','4540','Foreign Exchange Gain','Unrealised and realised gains on currency translation','N/A',TRUE),
  -- Cost of Goods Sold
  ('Payable','Expense','Cost of Goods Sold','5010','Direct Materials','Raw material costs directly attributable to production','N/A',TRUE),
  ('Payable','Expense','Cost of Goods Sold','5020','Direct Labour','Wages of production workers directly tied to output','N/A',TRUE),
  ('Payable','Expense','Cost of Goods Sold','5030','Manufacturing Overhead','Indirect factory costs (utilities, factory rent, etc.)','N/A',TRUE),
  ('Payable','Expense','Cost of Goods Sold','5040','Freight & Carriage Inward','Transport costs to bring goods to the production site','N/A',TRUE),
  -- Operating Expenses
  ('Payable','Expense','Operating Expense','6010','Salaries – Administrative','Salaries of management, HR, finance, and admin staff','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6020','Salaries – Sales & Marketing','Compensation for sales representatives and marketing team','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6030','Office Rent & Occupancy','Lease payments for head office and branch premises','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6040','Utilities – Electricity & Water','Electricity, water, and related utility bills','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6050','Depreciation Expense','Periodic allocation of fixed asset cost over useful life','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6060','Amortisation Expense','Periodic write-down of intangible asset values','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6070','Insurance Expense','Premiums for property, liability, and business insurance','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6080','Advertising & Marketing','Costs for campaigns, digital ads, and promotions','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6090','Travel & Entertainment','Business travel, client entertainment, and conferences','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6100','Professional & Legal Fees','Audit, legal counsel, consulting, and advisory fees','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6110','IT & Software Subscriptions','SaaS licences, cloud services, and IT maintenance','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6120','Bad Debt Expense','Write-off of uncollectable trade receivables','N/A',TRUE),
  ('Payable','Expense','Operating Expense','6130','Staff Training & Development','Training programmes, certifications, and L&D costs','N/A',FALSE),
  -- Non-Operating Expenses
  ('Payable','Expense','Non-Operating Expense','7010','Interest Expense – Bank Loans','Interest charged on term loans and revolving credit','N/A',TRUE),
  ('Payable','Expense','Non-Operating Expense','7020','Interest Expense – Bonds','Coupon interest payable on corporate bonds issued','N/A',TRUE),
  ('Payable','Expense','Non-Operating Expense','7030','Foreign Exchange Loss','Losses on adverse currency movements','N/A',TRUE),
  ('Payable','Expense','Non-Operating Expense','7040','Loss on Disposal of Assets','Loss realised when assets are sold below net book value','N/A',FALSE),
  ('Payable','Expense','Non-Operating Expense','7100','Corporate Income Tax Expense','Current and deferred income tax charge for the period','N/A',TRUE)

ON CONFLICT (account_code) DO NOTHING;


-- ── 9. COMMENTS ───────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.chart_of_accounts             IS 'General Ledger – Chart of Accounts master table';
COMMENT ON COLUMN public.chart_of_accounts.account_type IS 'Receivable | Payable | N/A';
COMMENT ON COLUMN public.chart_of_accounts.category     IS 'Asset | Liability | Equity | Income | Expense';
COMMENT ON COLUMN public.chart_of_accounts.subcategory  IS 'e.g. Current Asset, Operating Expense';
COMMENT ON COLUMN public.chart_of_accounts.account_code IS '1xxx=Assets 2xxx=Liabilities 3xxx=Equity 4xxx=Income 5-7xxx=Expenses';