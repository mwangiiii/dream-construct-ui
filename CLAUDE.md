# Dream Construct — working agreement

## RULE 1 — ASK BEFORE PROCEEDING. ALWAYS.

**Ask clarifying questions before doing anything non-trivial. Do not assume.**

This is the standing instruction and it overrides any default bias toward
acting. If there is a choice to be made, present the options and let me pick.

Ask **before**:
- creating, altering or dropping any database table, column, constraint, enum
  or policy — and **always before a backfill or any INSERT/UPDATE to existing
  data**
- adding a new table because frontend code references one (a 404 can mean the
  *query* is wrong, not that the table is missing)
- deleting or rewriting a file, component, page or route
- changing an edge function's validation or auth logic
- introducing a new concept, table or abstraction when an existing one may
  already cover it

Required order of work:
1. **Read the existing schema and code first.** Grep `supabase/migrations/`
   and the relevant pages. Say what you found.
2. **State what you intend to change**, precisely.
3. **Ask**, using options, and wait.
4. Only then implement.

Past failures this rule exists to prevent: inventing a `project_team` table
(with a backfill into every project) when `workers` + `worker_assignments`
already covered it; building a duplicate policy editor when `PoliciesPage`
already had full CRUD; centralising assignment code while leaving two
assignment UIs in place.

## RULE 2 — Users and Workers are different things. Do not conflate them.

**Users** — created in Admin → User Management. They hold a **global system
role** from the `app_role` enum (`admin`, `manager`, `project_manager`,
`client`, `finance`, `quantity_surveyor`). A user is **NOT scoped to a
project**. There is no per-project user membership: `projects.manager_id` and
`projects.client_id` are the only links, and `security.has_project_access()`
keys off those plus `project_surveyors`.

Chain on creation: `auth.users` → `profiles` → `user_roles` → status via
`profiles.status_id` → `user_statuses`.

**Workers** — `public.workers` + `public.worker_assignments`. These are the
individual tradespeople **on a specific project**: contractor, painter,
plumber, mason and so on. Each project has its own workers. They are not system
users and do not log in. Project staffing, attendance and task assignment all
live here.

Never model project staffing as users, and never model system access as
workers.

## RULE 3 — The live database has drifted from the migration history.

Migration files are **not** a reliable picture of production. Verified
out-of-band changes:

- `user_roles` uses **`role_name`** (FK → `roles.role_name`), though
  `20251127170502_user_roles.sql` declares `role_id smallint`
- `profiles.status_id` exists, but no migration adds it
- `roles` rows 5 and 6 (`finance`, `surveyor`) were inserted out-of-band
- the `app_role` enum has `finance`, `surveyor` **and** `quantity_surveyor`,
  but `roles` has **no `quantity_surveyor` row**

Confirm against the real database with SQL before relying on a migration file.

### Known live inconsistency

The app uses `quantity_surveyor` everywhere (`RoleName` and `ROLE_PRIORITY` in
`src/lib/auth.ts`, `security.is_quantity_surveyor()`, the `/qs/*` guards), but
the database has `surveyor` and `manage-user`'s `ALLOWED_ROLES` also says
`surveyor`. These must be changed in lockstep — the migration and the edge
function deploy together, or role assignment breaks.

## Edge functions

Many deployed functions have **no source in this repo**: `create-user`,
`add-team-member`, `remove-team-member`, `get-workers`,
`update-project-manager`, `get-dashboard-stats`, and others. Do not infer what
they do. Read a sibling that is present (`manage-user` is the fullest example)
or ask for a download. `supabase functions download` needs Docker.

## Conventions

- No `console.*` calls or debug UI in frontend code.
- Default to no comments; add one only when the *why* is non-obvious.
- Mirror the sibling module's approach rather than inventing a new pattern
  (e.g. AP should follow AR).
- Prefer one shared implementation over per-role copies. Role differences
  belong in props or the surrounding layout.
- Theme: dark navy background, gold/amber primary (`42 88% 65%`), Inter,
  glass-morphism cards, `--radius: 0.75rem`. Use theme tokens, not raw colours.
- Vite dev server runs on port **8080**.
- Verify with `npx tsc --noEmit -p tsconfig.app.json` — bare `tsc --noEmit`
  checks nothing, because the root `tsconfig.json` has `"files": []`.
