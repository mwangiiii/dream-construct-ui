# Dream Construct System

A construction ERP: projects, milestones and tasks on one side, a full finance
suite on the other, with role-scoped access throughout.

React 18 · TypeScript · Vite · Tailwind + shadcn/ui · framer-motion · Supabase
(Postgres, Auth, Storage, Edge Functions).

---

## Getting started

```sh
npm install
npm run dev          # http://localhost:8080
```

`.env` needs two values — both are client-safe:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Everything else (SMTP credentials, service-role key) lives server-side as
Supabase Edge Function secrets and must never reach the client bundle.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server on **8080** (not Vite's default 5173) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run tunnel` | ngrok tunnel to 8080, for sharing a local build |

### Typecheck baseline

`npx tsc --noEmit -p tsconfig.app.json` currently reports **64 pre-existing
errors**, concentrated in `src/components/projects/tabs/*` and the duplicated
`settings.tsx` pages. They are not caused by your change. Compare the *count*
before and after your work rather than expecting zero.

---

## How the app is organised

```
src/
  pages/              one file per route
    finance/          the largest module — see below
    admin/ client/ project_manager/ quantity_surveyor/
  components/
    layout/           one layout per role; each owns its own sidebar
    projects/tabs/    the project detail tabs
    finance/          shared finance inputs (COAAccountSelect, VendorSelect)
    ui/               shadcn primitives
  lib/
    auth.ts           role resolution
    supabaseClient.ts
    projectProgress.ts
    markdown.ts
supabase/
  migrations/         ordered SQL — the schema's source of truth
  functions/          Deno Edge Functions
```

Routing lives entirely in `src/App.tsx`. Each route wraps its page in the
layout for that role and a `ProtectedRoute` / `FinanceGuard` carrying the roles
allowed to see it.

### Roles

`admin`, `manager`, `finance`, `project_manager`, `quantity_surveyor`,
`client` — stored in `user_roles`, **not** on `profiles`.

A user may hold several. `ROLE_PRIORITY` in `src/lib/auth.ts` resolves the
primary one by **least privilege**: someone who is both `admin` and `client`
is treated as a client. This is deliberate — widen access by removing the
narrower role, never by special-casing.

---

## The finance module

Fifteen pages behind `FinanceLayout`, all following the same shape: a project
picker of cards, then a per-project register, plus a firm-wide consolidated
view. Accounts Payable, Accounts Receivable, Invoices, Job Costing, Payroll,
Taxes, Loans, Inventory, WIP, Balance Sheet, Cash Flow, Income Statement,
Bank Reconciliation, Statement of Account, Chart of Accounts.

### Two invariants worth understanding before editing

**1. One real cost counts once.** `job_postings` carries a `source` column
(`manual | payroll | ap | loan | tax`) and a nullable FK per source. Writing to
`payroll_checklist`, `accounts_payable`, `loans` or `tax_transactions` fires a
trigger that mirrors a display-only row into `job_postings`.

`vw_project_cost_incurred` then sums **source-of-truth tables only** —
`job_postings` filtered to `source='manual'`, plus each source table directly.
Removing that filter silently double-counts every cost. Labour cannot be
entered manually at all; it flows only through payroll.

Mirror trigger functions **must** be `SECURITY DEFINER` with a pinned
`search_path`. The `job_postings_write` RLS policy requires `source='manual'`,
so a `SECURITY INVOKER` trigger is rejected and takes the source module's write
down with it. Note that `CREATE OR REPLACE FUNCTION` *resets* both properties —
restate them whenever you replace one of these functions.

**2. Project progress is derived, never stored.** `projects.progress_percent`
exists but nothing writes it. Use `src/lib/projectProgress.ts`:

```
milestone = round(done tasks / total tasks × 100)   (0 with no tasks)
project   = round(mean of milestone progresses)     (0 with no milestones)
```

`useDerivedProgress(projectId, fallback)` coalesces requests, so a list of
cards issues one query rather than one per card. This figure feeds WIP earned
revenue, so changing the formula changes financial output.

---

## Database

Migrations in `supabase/migrations/` are the schema's source of truth, applied
in filename order.

```sh
$env:SUPABASE_DB_PASSWORD="<db password>"
npx supabase@latest db push --remote --dry-run   # always dry-run first
npx supabase@latest db push --remote
```

Three things that reliably cost time:

- **CLI v3 defaults to the local Docker stack.** Without `--remote` it tries
  `127.0.0.1:54322` and tells you to run `supabase start`.
- **`db push` needs `SUPABASE_DB_PASSWORD`.** Without it the command hangs at
  "Initialising login role…" with no error.
- **Applying SQL by hand leaves the ledger stale.** The next push tries to
  replay everything and fails on "already exists". Fix with
  `npx supabase migration repair --status applied <version> …`.

### Row-level security

RLS is enforced in the database, not just the UI. Policies call helpers in the
`security` schema — `is_finance_or_up()`, `is_manager_or_up()`,
`manages_project(id)`, `surveys_project(id)`, `is_client()`.

Use those helpers. Do not write `profiles.role` — that column does not exist,
and policies referencing it are dead.

Remember policies are **permissive and OR'd together**. A leftover
`USING (true)` alongside a strict policy grants everything; such policies were
removed in `20261124120000`. Adding a new one re-opens the hole.

To debug "I can't see X":

```sql
SELECT * FROM security.diagnose_access('<project-uuid>', '<user-uuid>');
```

---

## Edge Functions

```sh
npx supabase functions deploy <name>
```

| Function | Role |
| --- | --- |
| `invoices` | Invoice CRUD + email (nodemailer) |
| `send-financial-email` | PM procurement emails (denomailer) |
| `send-payroll-register` | Payroll register and payslip emails |
| `manage-user` | Admin user administration |
| `project-lifecycle` | Archive / restore / delete projects |
| `worker_attendance` | Attendance writes |

Mail goes over Gmail SMTP on `smtp.gmail.com:465`, authenticating with the
`EMAIL_USERNAME` / `EMAIL_PASSWORD` secrets. **`EMAIL_PASSWORD` must be a
Google App Password** — ordinary account passwords have been rejected since
May 2022 and fail with `535`.

Writing an email template? Email HTML is not web HTML. Gmail strips `<style>`
blocks, `@import` and CSS grid, so use nested tables with inline styles only.
Collapse whitespace between tags before sending, or quoted-printable encoding
escapes trailing spaces and `=20` appears throughout the message.
`send-payroll-register/index.ts` has a working shell to copy.

---

## Conventions

- **The navbar is `fixed`.** `MainLayout` does not reserve space for it, so
  every public page needs its own top padding (`pt-32`). Forget it and the
  header covers your heading.
- **Mirror a sibling module** rather than inventing a new mechanism. If AR
  already solves the shape of problem you have, copy its approach — including
  prop names and wording.
- **Money is `numeric`, never float.** Generated columns like
  `accounts_payable.balance` are computed by the database; never write them.
- **Coerce `""` to `null`** before sending optional values. An empty string
  fails UUID and date columns with `22P02`, and breaks FK columns such as
  `receiving_account_code`.
- **No `console.*` in frontend code.**

---

## Contributing

1. Branch, then make the change.
2. `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json` — compare the
   error count against the 64 baseline.
3. If you touched the schema, include the migration and say so in the PR.
4. Call out anything that changes financial output explicitly. Several figures
   feed revenue recognition, and a reviewer cannot infer that from a diff.

## License

MIT
