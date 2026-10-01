-- =============================================================================
--  Allow job_postings.account_code to be NULL.
--
--  Production has an FK job_postings.account_code → chart_of_accounts(account_code)
--  (added outside migrations). Mirror rows for payroll / loan / tax don't
--  have a natural COA account to point at — the source-of-truth module tracks
--  its own account. Empty string '' violates the FK; NULL is accepted (FKs
--  skip NULL by default). Making the column nullable + dropping the ''
--  default lets mirror triggers pass NULL cleanly.
--
--  Manual rows and AP mirror rows still carry a valid account_code — the UI
--  form requires one, and AP's receiving_account_code is NOT NULL.
-- =============================================================================

ALTER TABLE public.job_postings ALTER COLUMN account_code DROP DEFAULT;
ALTER TABLE public.job_postings ALTER COLUMN account_code DROP NOT NULL;
