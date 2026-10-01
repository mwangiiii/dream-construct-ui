-- =============================================================================
--  Extend the AP → job_postings mirror trigger to include the commodity name.
--
--  When an AP invoice is linked to a PM commodity row via
--  accounts_payable.project_financial_id, the Job Costing mirror shows:
--
--      AP: Vendor Name → Commodity Name — Inv 12345
--
--  When the FK is NULL (ad-hoc AP with no PM counterpart) the description
--  falls back to the previous format: "AP: Vendor Name — Inv 12345".
--
--  Everything else about the trigger (upsert on ap_invoice_id, source='ap',
--  cost_category='vendor', delete via cascade) is unchanged.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mirror_ap_to_job_postings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  desc_text      text;
  commodity_name text;
BEGIN
  -- Look up the linked commodity, if any.
  IF NEW.project_financial_id IS NOT NULL THEN
    SELECT material_name INTO commodity_name
      FROM public.project_financials
      WHERE id = NEW.project_financial_id;
  END IF;

  desc_text := 'AP: ' || COALESCE(NEW.vendor_name, '')
             || CASE WHEN commodity_name IS NOT NULL AND commodity_name <> ''
                     THEN ' → ' || commodity_name ELSE '' END
             || CASE WHEN COALESCE(NEW.invoice_number, '') <> ''
                     THEN ' — Inv ' || NEW.invoice_number ELSE '' END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.job_postings (
      project_id, phase, stage, description,
      account_code, etims_code,
      budgeted_amount_paid, actual_amount_used, profit_loss, amount,
      source, cost_category, ap_invoice_id
    ) VALUES (
      NEW.project_id, NULL, 'Accounts Payable', desc_text,
      COALESCE(NEW.receiving_account_code, ''), COALESCE(NEW.etims_code, ''),
      0, NEW.total_amount, 0, NEW.total_amount,
      'ap', 'vendor', NEW.id
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.job_postings (
      project_id, phase, stage, description,
      account_code, etims_code,
      budgeted_amount_paid, actual_amount_used, profit_loss, amount,
      source, cost_category, ap_invoice_id
    ) VALUES (
      NEW.project_id, NULL, 'Accounts Payable', desc_text,
      COALESCE(NEW.receiving_account_code, ''), COALESCE(NEW.etims_code, ''),
      0, NEW.total_amount, 0, NEW.total_amount,
      'ap', 'vendor', NEW.id
    )
    ON CONFLICT (ap_invoice_id) WHERE ap_invoice_id IS NOT NULL
    DO UPDATE SET
      project_id         = EXCLUDED.project_id,
      description        = EXCLUDED.description,
      account_code       = EXCLUDED.account_code,
      etims_code         = EXCLUDED.etims_code,
      actual_amount_used = EXCLUDED.actual_amount_used,
      amount             = EXCLUDED.amount,
      updated_at         = NOW();
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- ── Refresh backfilled descriptions for any AP rows that gained a commodity
-- link before this migration ran (safe no-op when none).
UPDATE public.job_postings jp
SET description = 'AP: ' || COALESCE(ap.vendor_name, '')
               || CASE WHEN pf.material_name IS NOT NULL AND pf.material_name <> ''
                       THEN ' → ' || pf.material_name ELSE '' END
               || CASE WHEN COALESCE(ap.invoice_number, '') <> ''
                       THEN ' — Inv ' || ap.invoice_number ELSE '' END
FROM public.accounts_payable ap
LEFT JOIN public.project_financials pf ON pf.id = ap.project_financial_id
WHERE jp.ap_invoice_id = ap.id
  AND jp.source = 'ap';
