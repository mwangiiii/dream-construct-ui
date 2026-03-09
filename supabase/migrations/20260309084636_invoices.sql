-- =============================================================================
-- Migration: invoices
-- Description : Creates the invoices table with full schema, indexes,
--               auto-updated timestamps, and RLS policies.
--               Also ensures audit_logs table exists.
-- Run order   : After projects table and audit_logs table exist.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper: updated_at trigger function (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. audit_logs table (create if not already present)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          BIGSERIAL     NOT NULL,
  table_name  TEXT          NOT NULL,
  record_id   UUID,
  action      TEXT          NOT NULL
                CHECK (action = ANY (ARRAY['INSERT','UPDATE','DELETE'])),
  old_data    JSONB,
  new_data    JSONB,
  changed_by  UUID          REFERENCES auth.users (id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT  audit_logs_pkey PRIMARY KEY (id)
);

-- Indexes on audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_table
  ON public.audit_logs USING btree (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by
  ON public.audit_logs USING btree (changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at
  ON public.audit_logs USING btree (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_record_id
  ON public.audit_logs USING btree (record_id);

-- RLS for audit_logs (authenticated read-only)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read audit_logs" ON public.audit_logs;
CREATE POLICY "Auth read audit_logs"
  ON public.audit_logs FOR SELECT
  USING (auth.role() = 'authenticated');
-- Inserts are performed by the Edge Function via service_role key, not by users.

-- ---------------------------------------------------------------------------
-- 2. invoices table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  -- ── Identity ──────────────────────────────────────────────────────────────
  id                     UUID          NOT NULL DEFAULT gen_random_uuid(),

  -- ── Project link (nullable = standalone / firm-wide invoice) ──────────────
  project_id             UUID          REFERENCES public.projects (id)
                                         ON DELETE SET NULL,

  -- ── Invoice meta ──────────────────────────────────────────────────────────
  invoice_number         TEXT          NOT NULL,
  status                 TEXT          NOT NULL DEFAULT 'draft'
                           CHECK (status = ANY (ARRAY[
                             'draft','sent','paid','partial','overdue','cancelled'
                           ])),
  invoice_date           DATE          NOT NULL,
  due_date               DATE          NOT NULL,

  -- ── Your company details ──────────────────────────────────────────────────
  company_name           TEXT          NOT NULL,
  company_address        TEXT,
  company_city_state_zip TEXT,
  company_phone          TEXT,
  company_email          TEXT,

  -- ── Bill-to (client) ──────────────────────────────────────────────────────
  client_company_name    TEXT          NOT NULL,
  client_contact_name    TEXT,
  client_address         TEXT,
  client_phone           TEXT,
  client_email           TEXT,

  -- ── Project info block ────────────────────────────────────────────────────
  project_start_date     DATE,
  project_end_date       DATE,
  project_location       TEXT,
  project_client_ref     TEXT,

  -- ── Line items (stored as JSONB arrays) ───────────────────────────────────
  -- Schema per item: { id, description, hours/qty, unit_price, amount }
  labor_items            JSONB         NOT NULL DEFAULT '[]'::jsonb,
  material_items         JSONB         NOT NULL DEFAULT '[]'::jsonb,
  other_items            JSONB         NOT NULL DEFAULT '[]'::jsonb,

  -- ── Financials (server-computed by Edge Function) ─────────────────────────
  subtotal               NUMERIC(15,4) NOT NULL DEFAULT 0
                           CHECK (subtotal >= 0),
  discount_amount        NUMERIC(15,4) NOT NULL DEFAULT 0
                           CHECK (discount_amount >= 0),
  tax_rate               NUMERIC(8,4)  NOT NULL DEFAULT 0
                           CHECK (tax_rate >= 0 AND tax_rate <= 100),
  total_tax              NUMERIC(15,4) NOT NULL DEFAULT 0
                           CHECK (total_tax >= 0),
  total                  NUMERIC(15,4) NOT NULL DEFAULT 0
                           CHECK (total >= 0),

  -- ── Payment info ──────────────────────────────────────────────────────────
  payment_terms          TEXT,
  bank_name              TEXT,
  account_number         TEXT,
  notes                  TEXT,

  -- ── Audit timestamps ──────────────────────────────────────────────────────
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT invoices_pkey PRIMARY KEY (id),

  -- Invoice numbers must be unique per project (or per firm if standalone)
  CONSTRAINT invoices_number_project_unique
    UNIQUE (invoice_number, project_id)
);

-- ---------------------------------------------------------------------------
-- 3. Constraints: due_date >= invoice_date
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_due_after_invoice;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_due_after_invoice
  CHECK (due_date >= invoice_date);

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_project_id
  ON public.invoices USING btree (project_id);

CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON public.invoices USING btree (status);

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date
  ON public.invoices USING btree (invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON public.invoices USING btree (due_date);

CREATE INDEX IF NOT EXISTS idx_invoices_client
  ON public.invoices USING btree (client_company_name);

CREATE INDEX IF NOT EXISTS idx_invoices_created_at
  ON public.invoices USING btree (created_at DESC);

-- GIN index for full-text search on invoice_number and client name
CREATE INDEX IF NOT EXISTS idx_invoices_search
  ON public.invoices USING gin (
    to_tsvector('english',
      COALESCE(invoice_number, '') || ' ' ||
      COALESCE(client_company_name, '') || ' ' ||
      COALESCE(company_name, '')
    )
  );

-- GIN index on line-items JSONB for future server-side querying
CREATE INDEX IF NOT EXISTS idx_invoices_labor_items
  ON public.invoices USING gin (labor_items);

-- ---------------------------------------------------------------------------
-- 5. Auto-update updated_at trigger
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
--    All writes go through the Edge Function (service_role),
--    so only SELECT policies are needed for authenticated users.
--    The Edge Function enforces all write-access rules.
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all invoices
DROP POLICY IF EXISTS "Auth read invoices" ON public.invoices;
CREATE POLICY "Auth read invoices"
  ON public.invoices FOR SELECT
  USING (auth.role() = 'authenticated');

-- Explicitly deny direct client writes (all mutations via Edge Function only)
-- Note: Without INSERT/UPDATE/DELETE policies, those operations are denied
-- for authenticated users by default (deny-by-default RLS).
-- The Edge Function uses service_role which bypasses RLS.

-- ---------------------------------------------------------------------------
-- 7. Add project_id nullable (in case invoices table already existed)
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices
  ALTER COLUMN project_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 8. Comments for documentation
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.invoices IS
  'Invoices for projects or standalone firm-wide billing. '
  'All mutations are performed by the invoices Edge Function. '
  'project_id is nullable — NULL means a standalone / firm-wide invoice.';

COMMENT ON COLUMN public.invoices.labor_items IS
  'JSONB array of labor line items: [{id, description, hours, unit_price, amount}]';
COMMENT ON COLUMN public.invoices.material_items IS
  'JSONB array of material line items: [{id, description, qty, unit_price, amount}]';
COMMENT ON COLUMN public.invoices.other_items IS
  'JSONB array of other line items: [{id, description, qty, unit_price, amount}]';
COMMENT ON COLUMN public.invoices.subtotal IS
  'Sum of all line item amounts — recomputed server-side by Edge Function';
COMMENT ON COLUMN public.invoices.total IS
  'subtotal - discount_amount + total_tax — recomputed server-side';

-- ---------------------------------------------------------------------------
-- 9. Backfill updated_at for any existing rows
-- ---------------------------------------------------------------------------
UPDATE public.invoices
SET updated_at = created_at
WHERE updated_at IS NULL;