# Session Handover

**Date:** 2026-11-26
**Branch:** `finance-module`
**Working tree:** dirty — everything below is **uncommitted**
**Verification state:** typecheck + production build pass. **Nothing is browser-verified. No migration or edge function has been deployed.**

> **Read `CLAUDE.md` in the project root before doing anything.** It contains the
> standing working agreement the user explicitly asked for, most importantly
> **RULE 1: ask clarifying questions before proceeding to anything.** That rule
> was added because this session repeatedly acted without asking and had to be
> stopped. Honour it.

---

## 1. Project architecture and technology stack

A construction ERP for **Reve Construct Limited** (brand string in emails:
`DREAM CONSTRUCT SYSTEM`).

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite (dev server on port **8080**) |
| Styling | Tailwind + shadcn/ui, framer-motion, glass-morphism |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions (Deno) |
| Mail | Gmail SMTP (`smtp.gmail.com:465`) via denomailer in edge functions |
| Project ref | `luukzxauvfifrjsmmnxw` (`dream_construct`, production) |

### Theme tokens (`src/index.css`)
- Background `220 25% 10%` (dark navy), primary/accent `42 88% 65%` (gold/amber)
- `--radius: 0.75rem`, font **Inter**, `.glass` / `.glass-strong` utility classes
- Always use theme tokens, never raw colours.

### Roles
Global system roles live in the `app_role` enum and the `roles` lookup table:
`admin`, `manager`, `project_manager`, `client`, `finance`, `quantity_surveyor`.

`src/lib/auth.ts` holds `RoleName` and `ROLE_PRIORITY`. **`ROLE_PRIORITY` is
ordered least → most privileged and `getPrimaryRole()` returns the FIRST match**
— a user holding several roles is treated as their *least* privileged one.

### RLS model
Helper functions in the `security` schema (`20260930101000_security_helpers.sql`):
- `is_manager_or_up()` — admin + manager
- `is_finance()`, `is_client()`
- `owns_project(pid)` — `projects.client_id`
- `manages_project(pid)` — `projects.manager_id`
- `surveys_project(pid)` — `project_surveyors` junction
- `has_project_access(pid)` = manager_or_up OR finance OR owns OR manages OR surveys
- `can_write_project(pid)` = manager_or_up OR manages_project

Policies are **PERMISSIVE and OR'd**. All are `SECURITY DEFINER` with pinned
`search_path`. **`CREATE OR REPLACE FUNCTION` resets both `SECURITY DEFINER`
and `search_path`** — use `ALTER FUNCTION` when patching.

### Critical gotcha discovered this session
`projects_update` is `USING (security.can_write_project(id))`. **A `USING`
failure is NOT an error — Postgres matches zero rows and reports success.** Any
`.update()` without `.select()` can silently do nothing and look like it worked.
This is a repo-wide hazard, not just in the code touched here.

---

## 2. What we were trying to achieve

Requests in order, all from this session:

1. Make every "coming soon" icon in admin / project_manager functional, inheriting
   from whichever role already had it working.
2. Implement them all at once.
3. Centralise project-manager assignment — *"in a centralized place not how it is
   currently in the admin side dashboard"*.
4. Self-service account deletion that "takes out everything".
5. Build the admin **Pages** content editor professionally, consistent with the
   existing content service, respecting theme/typography/styling.
6. Redesign the public media page as a **corporate** media centre showing project
   media and other company-wide content/pages.
7. Fix: assigning "THE HALE HOSPITAL AND COMMERCIAL RESIDENTIAL CENTRE" to PM
   Martin "is not allocating".
8. Fix: creating a user on the admin dashboard returns 400.
9. Put a permanent rule in the config file to **always ask before proceeding**.

---

## 3. Changes already implemented

### 3.1 Inherited "coming soon" features
- **6 tabs added** to the shared admin/client detail page (`src/pages/projects/ProjectDetailPage.tsx`),
  copied from the PM page: Workers, Daily Logs, Stages, Inspections, Material
  Tracking, Problems & Issues. `clientTabs` deliberately unchanged.
- Fixed a **double-render bug**: `financials` was in both a render branch and the
  Coming Soon list.
- **7 PM nav items** added to `ProjectManagerLayout.tsx` for pages already routed
  in `App.tsx` but unreachable.
- **Milestone creation** implemented in `MilestonesTab.tsx` (was a placeholder).
  Inserts into `project_milestones`; deliberately does **not** write
  `progress_percent` or `status` because both are derived.
- **Worker Performance tab** (`src/pages/project_manager/workers.tsx`) — derives
  assigned / completed / in-progress / overdue / completion-rate per worker from
  already-loaded assignments. Attendance excluded on purpose:
  `get-daily-attendance` returns a single day, so any rate from it would describe
  today rather than a trend.
- `TasksTab.tsx` — `workers?: Worker[]` made optional; a bogus `teamMembers={team}`
  prop was being passed that the component never had.

### 3.2 Settings pages de-duplicated
All four settings pages were **byte-identical** (verified with `git hash-object`).
- `src/pages/settings.tsx` is now the single implementation.
- `admin/settings.tsx`, `client/settings.tsx`, `project_manager/settings.tsx` are
  one-line re-exports: `export { default } from "@/pages/settings";`
- Removed ~2,660 duplicated lines and 7 duplicated typecheck errors.

### 3.3 Download My Data (implemented)
`handleDownloadData()` in `src/pages/settings.tsx` exports profile + roles +
projects where the user is `manager_id` or `client_id`, as a JSON download.
Scoped by user id and run under their own session, so RLS bounds it.

### 3.4 Self-service account deletion (code complete, NOT deployed)
- `supabase/functions/delete-my-account/index.ts` — identity from the **JWT only**
  (no user id in the body, so it cannot be aimed at another user). Requires the
  literal phrase `DELETE MY ACCOUNT` server-side as well as in the UI.
- Refuses with a reason list (HTTP 409 `{ blockers: [...] }`) when the caller is
  the **last active admin**, or is the **client on any project** (`client_id` is
  `NOT NULL` in the base schema, so there is nothing valid to set it to).
- Deletes the avatar from storage, then `auth.admin.deleteUser`.
- `supabase/migrations/20261125140000_account_deletion_fk_actions.sql` is what makes
  deletion possible at all — see §5.2.

### 3.5 Admin Pages content editor (code complete, NOT deployed)
- `supabase/migrations/20261125150000_site_page_sections.sql` — new table (see §5.3).
- `src/lib/sitePages.ts` — `SITE_PAGES` constant + `useSiteSections(pageSlug)` hook.
- `src/pages/admin/PagesContent.tsx` — full CRUD, markdown preview, inline
  publish/unpublish, delete confirmation.
- `App.tsx` — the `PagesContent` stub (previously "Page content editor coming
  soon…") is deleted and replaced with this import.
- `ContentOverview` in `App.tsx` rebuilt: its three cards had drifted into three
  different visual treatments; they now share one, driven by `CONTENT_SECTIONS`.

### 3.6 Public media page → corporate media centre
`src/pages/MediaGalleryPage.tsx`:
- Masonry (`columns-2 … columns-6`) replaced with a uniform `4/3` catalogue grid.
  A ragged column reads as a social feed; a grid reads as a company portfolio.
- Added: editorial hero, editable intro band, **Featured Work** band (`16/10`
  cards, max 4), sticky filter bar, "Explore more" company-links band, closing CTA.
- Hero / intro / CTA read from `site_page_sections` via `useSiteSections("media")`
  with hardcoded fallbacks, so the page is never blank.
- Portfolio figures are derived from loaded data — no hardcoded marketing numbers.
- **Fixed a latent layout bug**: the old `sticky top-0` header sat *underneath* the
  fixed Navbar. Hero now uses `pt-32`; filter bar sticks at `top-[72px]`.
- Pinned items beyond the featured limit are appended to the grid, so nothing is
  rendered nowhere.
- Preserved: lightbox, infinite scroll, view/click/share tracking, `?media=<id>`
  deep links.

### 3.7 PM assignment centralised into ONE place
- `src/pages/admin/ProjectAssignments.tsx` (**new**) at **`/admin/assignments`**,
  in the Admin sidebar as "Assignments". Table of project / status / current
  manager / assign-to, with counts, search, "unassigned only" filter, confirmation
  modal, and an **Archived** badge.
- `src/lib/projectManagerAssignment.ts` (**new**) — `fetchProjectManagers()`,
  `useProjectManagerOptions()`, `assignProjectManager()`.
- **Both other assignment UIs are now read-only** with a "Change" link here:
  the dashboard panel (`ProjectManagementDashboard.tsx`) and the project detail
  header (`projects/ProjectDetailPage.tsx`).
- `ProjectManagerSelect.tsx` was created mid-session then **deleted** once it
  became orphaned.
- `NewProjectModal.tsx` now uses the shared `fetchProjectManagers()` and notifies
  the PM after a create-with-manager.

### 3.8 PM assignment notification (code complete, NOT deployed)
`supabase/functions/notify-project-assignment/index.ts` — re-reads project,
manager and sender server-side (client supplies only two ids), rejects if
`project.manager_id !== managerId`, falls back to `auth.users` when
`profiles.email` is blank. Uses the corporate table-based email template that was
already signed off for payroll.

### 3.9 `project_team` fully removed
`/rest/v1/project_team` returns **404 — the table does not exist**, and
`20260930101100_rls_project_tree.sql` says so explicitly ("it isn't in migrations,
so we feature-detect and skip if absent"). A migration to create it was written
and then **deleted at the user's instruction**. Removed:
- `src/components/projects/tabs/TeamTab.tsx` (deleted)
- the Team tab from both detail pages (`Tab` union, `allTabs`, render branch, imports)
- the `project_team` query in `src/types/project.ts` (**this was firing a 404 on
  every project detail page load**)
- the `project_team` fallback in `projects/ProjectDetailPage.tsx`
- `project_team` from the settings data export and from the FK migration

### 3.10 Error surfacing in user creation
`src/pages/admin/UserCreate.tsx` — `supabase.functions.invoke` throws
`FunctionsHttpError` whose message is only the generic *"Edge Function returned a
non-2xx status code"*; the real reason is in the response body. It now reads
`error.context` and rethrows `body.error`.

### 3.11 QS role lockstep change
`supabase/functions/manage-user/index.ts` — `ALLOWED_ROLES`:
`"surveyor"` → `"quantity_surveyor"`. Verified by grep that this array was the
**only** role-*value* usage of bare `surveyor`; everything else is the
`project_surveyors` table name or prose.

### 3.12 Config and memory
- `CLAUDE.md` (**new**, project root) — the working agreement. RULE 1 always ask;
  RULE 2 users vs workers; RULE 3 the live DB has drifted from migrations.
- Persistent memory updated: `feedback_inspect_schema_before_changing.md`,
  `feedback_share_across_roles.md`.

---

## 4. Files, modules and components modified

### New (untracked)
```
CLAUDE.md
SESSION_HANDOVER.md                                  (this file)
src/lib/projectManagerAssignment.ts
src/lib/sitePages.ts
src/pages/admin/PagesContent.tsx
src/pages/admin/ProjectAssignments.tsx
supabase/functions/delete-my-account/index.ts
supabase/functions/notify-project-assignment/index.ts
supabase/migrations/20261125140000_account_deletion_fk_actions.sql
supabase/migrations/20261125150000_site_page_sections.sql
```

### Modified
```
src/App.tsx                                          PagesContent import, /admin/assignments route, ContentOverview rebuild
src/components/dashboard/ProjectManagementDashboard.tsx  manager select → read-only + link
src/components/layout/AdminLayout.tsx                "Assignments" nav item (UserCog)
src/components/layout/ProjectManagerLayout.tsx       7 nav items added
src/components/projects/NewProjectModal.tsx          shared manager fetch + notify on create
src/components/projects/tabs/MilestonesTab.tsx       milestone creation implemented
src/components/projects/tabs/TasksTab.tsx            workers prop made optional
src/pages/MediaGalleryPage.tsx                       corporate redesign
src/pages/admin/UserCreate.tsx                       surface real edge-function error
src/pages/admin/settings.tsx                         → re-export
src/pages/client/settings.tsx                        → re-export
src/pages/project_manager/settings.tsx               → re-export
src/pages/settings.tsx                               canonical; data export + account deletion
src/pages/project_manager/Projects/ProjectDetailPage.tsx  derived progress; team tab added then removed
src/pages/project_manager/projects.tsx               useProjectProgress
src/pages/project_manager/workers.tsx                Performance tab implemented
src/pages/projects/ProjectDetailPage.tsx             6 inherited tabs; manager select → read-only; project_team removed
src/types/project.ts                                 project_team query removed from fetchProjectDetails
supabase/functions/manage-user/index.ts              ALLOWED_ROLES surveyor → quantity_surveyor
```

### Deleted
```
src/components/projects/ProjectManagerSelect.tsx     (created then orphaned)
src/components/projects/tabs/TeamTab.tsx             (project_team abandoned)
supabase/migrations/20261126090000_project_team.sql  (never applied, deleted on instruction)
```

---

## 5. Database schema, migrations and configuration

### 5.1 ⚠️ The live database has DRIFTED from the migration history

**Migration files are not a reliable picture of production.** Confirmed by SQL
against the real DB this session:

| Thing | Migrations say | Production actually has |
|---|---|---|
| `user_roles` key | `role_id smallint → roles(role_id)`, PK `(user_id, role_id)` | **`role_name`** with FK → `roles(role_name)`, PK `(user_id, role_name)` |
| `profiles` status | no status column at all | **`profiles.status_id`** exists (no migration adds it) |
| `app_role` enum | 4 labels | 7: `admin, manager, project_manager, client, finance, surveyor, quantity_surveyor` |
| `roles` rows | 4 seeded | 6: rows 5 (`finance`) and 6 (`surveyor`) added out-of-band |
| `projects.client_id` | `NOT NULL` | observed **NULL** on at least one project |
| `project_team` | feature-detected, assumed maybe-present | **does not exist** (404) |

**Always confirm with SQL before relying on a migration file.**

Verified live `roles` table:
```
1 admin | 2 manager | 3 project_manager | 4 client | 5 finance | 6 surveyor
```
`quantity_surveyor` is in the **enum** but has **no `roles` row**.

### 5.2 `20261125140000_account_deletion_fk_actions.sql` (NEW, not applied)
Every authorship column was a plain `references auth.users`, i.e.
`ON DELETE NO ACTION`, making it impossible to delete anyone who had touched
anything. This converts:
- `ON DELETE CASCADE` — `user_roles.user_id` (rows that exist only to describe the person)
- `ON DELETE SET NULL` + `DROP NOT NULL` — `user_roles.assigned_by`,
  `projects.created_by`, `project_updates.posted_by`,
  `project_milestones.created_by`, `project_approvals.requested_by`/`approved_by`,
  `tasks.assigned_to`/`created_by`, `documents.uploaded_by`, `audit_logs.changed_by`,
  `contracts.created_by`, `workers.created_by`, `worker_attendance.created_by`,
  `worker_assignments.created_by`, `media_posts.uploaded_by`
- `storage.objects.owner` → `SET NULL` (guarded against `insufficient_privilege`)

Each entry is feature-detected and reads the referenced table off the existing
constraint, so it works on tables created outside the migration history.

**Deliberately NOT changed:** `projects.client_id`. A project without a client is
meaningless, so deletion is refused instead, naming the blocking projects.

**Design intent:** deleting a *person* must not delete the company's project
history they happened to author. Removing a QS cannot take six months of site
attendance with it.

### 5.3 `20261125150000_site_page_sections.sql` (NEW, not applied)
```sql
public.site_page_sections (
  id, page_slug, section_key, heading, subheading, body, image_url,
  cta_label, cta_href, is_published, sort_order,
  created_at, updated_at, updated_by
)
UNIQUE (page_slug, section_key)
CHECK page_slug ~ '^[a-z0-9][a-z0-9-]*$'
CHECK section_key ~ '^[a-z0-9][a-z0-9_-]*$'
CHECK (cta_label IS NULL) = (cta_href IS NULL)   -- no dead buttons
```
- RLS: `anon` + `authenticated` read `is_published`; `is_manager_or_up()` reads
  drafts and writes.
- `touch_site_page_section()` trigger maintains `updated_at` / `updated_by`.
- Seeds `media` page `hero`, `intro`, `cta` **published** (they replace copy that
  is already live; an unpublished seed would blank the page).
- **`page_slug` is validated against `SITE_PAGES` in `src/lib/sitePages.ts`, a code
  constant — content cannot create a route, so admin-invented pages would store
  rows that render nowhere.**

### 5.4 `20261125120000_fix_quantity_surveyor_role.sql` (committed, NOT applied)
Adds the `quantity_surveyor` row to `roles`, repoints the 2 existing `surveyor`
assignments, then deletes the `surveyor` row.

**Ordering is load-bearing** — `user_roles.role_name` is
`REFERENCES roles(role_name) ON DELETE CASCADE`, so deleting the `surveyor` row
before repointing would cascade-delete those users' roles and silently strip all
their access. Steps must stay in order: add → migrate → delete.

**Live security issue this fixes:** the 2 `surveyor` users have no role
`ROLE_PRIORITY` recognises, so `getPrimaryRole()` falls through to `client`, but
`security.is_client()` is also FALSE for them. They therefore **pass every policy
phrased `NOT security.is_client()`** — they are unscoped, not restricted.

### 5.5 Other session migrations (committed, application status unconfirmed)
```
20261124090000_tax_allow_firmwide
20261124100000_job_posting_payroll_links
20261124110000_linter_search_path_and_grants
20261124120000_drop_legacy_permissive_policies
20261124130000_linter_fk_indexes
20261124140000_storage_bucket_listing
20261124150000_ap_relax_required_fields
20261124160000_ap_drop_commodity_requirement
20261124170000_vendor_bank_account
20261125090000_public_legal_documents
```

### 5.6 Edge functions with NO source in this repo
Do **not** infer their behaviour. `manage-user` is the fullest example that *is*
present — read it for conventions.
```
create-user, add-team-member, remove-team-member, get-workers,
get-worker-assignments, get-daily-attendance, get-dashboard-stats, add-worker,
assign-task, quick-task, update-project-manager, update-project-status,
update-project-dates, update-project-client, archive-project, create-task,
update-task, delete-task, create-daily-update, upload-document,
create-change-order, respond-to-approval, generate-pdf-report, wip-summary, …
```
`npx supabase functions download <name> --remote=luukzxauvfifrjsmmnxw` **requires
Docker**, which was not available in this session.

### 5.7 Build / verification commands
```bash
# Typecheck — MUST use -p. Bare `tsc --noEmit` checks NOTHING because the root
# tsconfig.json has "files": [].
npx tsc --noEmit -p tsconfig.app.json --pretty false 2>&1 | grep -c "error TS"
# => 53  <-- the agreed baseline. All 53 are pre-existing. Do not let it rise.

npx vite build        # passes
npm run dev           # port 8080
```
`tsconfig.json` has `strictNullChecks: false`, `noImplicitAny: false`,
`noUnusedLocals: false` — so `any` and unused locals are consistent with the
codebase and will not be flagged.

---

## 6. Decisions made and why

| Decision | Rationale |
|---|---|
| **One** assignment UI at `/admin/assignments`; dashboard + detail header read-only | User asked twice. The dashboard's `Project` type has **no `manager_id`** — only an embedded `manager` object — so its dropdown could show "Unassigned" for a project that had a manager. The new page reads `manager_id` straight off `projects`. |
| `assignProjectManager` does `.update(...).select(...)` and throws on 0 rows | A `USING` failure is not an error. Without reading the row back, a rejected assignment is indistinguishable from a saved one. |
| **No** `project_team` table | User: *"we do not need te project team table at alll… we already ave a workers table, worker assignment"*. `worker_assignments` already has `project_id`, `assigned_role`, dates, status, `tasks_assigned`, `tasks_completed`, `quality_score`. |
| **No** `project_team` write on assignment | User explicitly declined. `security.manages_project()` reads `projects.manager_id` directly, so membership is not needed for access. |
| Account deletion keeps authored records, drops attribution | "Everything" = the person, not the company's history. Stated plainly in the dialog. |
| Deletion refuses for last admin / project client | Both would leave the system inconsistent in a way the user cannot see. |
| `SITE_PAGES` is a code constant, not a table | Content cannot create a route. |
| Settings collapsed to 1 + 3 re-exports | They were byte-identical; role differences come from the layout each route wraps the page in. |
| Media page: uniform grid, not masonry | Corporate portfolio vs social feed. |
| Attendance excluded from Performance tab | `get-daily-attendance` returns one day; any rate from it would describe today, not a trend. |
| Milestone creation does not write `progress_percent`/`status` | Both are derived (`src/lib/projectProgress.ts`). |
| Move the **DB** to `quantity_surveyor` (not the app to `surveyor`) | User's choice. The app has ~28 usages across 11 files; the DB is the smaller change. |

---

## 7. Issues, bugs and unresolved tasks

### 7.1 🔴 OPEN — `create-user` returns 400
**This is the live blocker.** Creating a user from the admin dashboard fails.

Ruled out:
- Not a missing `roles` row — the user selected **Project Manager**, and
  `project_manager` **is** `role_id 3`.
- Not a rejected role in the sibling function — `manage-user`'s `ALLOWED_ROLES`
  includes `project_manager`.

Note `src/pages/admin/UserCreate.tsx:13` declares
`type AppRole = 'admin' | 'manager' | 'client'` while `roleOptions` offers 6
values — a type lie, and a hint the function may predate the extra roles. **Not
verified. Do not assume it.**

**Next step (already agreed with the user):** retry the creation. The form now
displays the function's real error. Get that string, then fix the actual cause.
Alternatively read the Supabase dashboard logs (Edge Functions → create-user →
Logs), or download the source if Docker is available.

### 7.2 ✅ RESOLVED — "Hale Hospital not allocating"
Not a bug. Diagnosed from SQL:
```
id          733f9de8-172d-48f5-b91b-27c0e1397442
title       THE HALE HOSPITAL AND COMMERCIAL RESIDENTIAL CENTRE
status      completed
archived_at 2026-07-15 14:00:49+00
manager_id  5be4e8f6-6d53-47b2-b8d5-e7799c45ebd1   <-- martin, project_manager, active
client_id   null
```
The assignment **worked**. The project is **archived**, and
`src/pages/project_manager/projects.tsx:148-150` filters `archived_at IS NULL`
for every role except admin/manager — so Martin never sees it.
**To make it visible: restore the project** (Overview tab → Restore, which calls
the admin-only `restore_project` RPC). No reassignment needed.
Mitigation added: Archived badge in the table + a warning in the confirmation
modal before the write.

### 7.3 🟠 `worker_assignments.status` enum mismatch — NOT FIXED
`assignment_status` enum is `'assigned' | 'in_progress' | 'completed' | 'delayed'`.
But `src/pages/project_manager/workers.tsx`:
- the assign form defaults `status: 'pending'`
- the filter dropdown offers `pending | in_progress | completed`
- the Performance tab I added counts `status === 'pending'`

**`'pending'` is not a valid enum value.** Assigning a task with it should fail at
the DB, and `assigned` / `delayed` rows go uncounted in the Performance tab.
Needs a decision: fix the UI to the enum, or add `pending` to the enum. **Ask first.**

### 7.4 Two users named Martin
`martin` (project_manager) and `Martin Kamica` (admin). Only `martin` is
selectable as a PM, which is correct, but the near-identical names invite
mis-clicks. Consider renaming one.

### 7.5 `projects.client_id` is NULL on at least one project
Base schema declares it `NOT NULL`. The constraint has been dropped out-of-band.
Finance modules join on `client_id` — worth an audit.

### 7.6 Remaining "coming soon"
`src/components/SubServicePopup.tsx:278` — "Visual showcase coming soon". A
marketing-page placeholder, not role-gated. Out of scope so far.

### 7.7 Unreachable-by-design code (verified, left alone)
- `projects/ProjectDetailPage.tsx` "Edit project functionality coming soon" —
  inside a commented-out block.
- "Create change order modal coming soon" — lives in the `approvals` tab, which
  is commented out of `allTabs` (line ~537). The tab body is only a header with a
  dead button; enabling it would expose a half-built tab, and change orders
  already have a dedicated finance module.

### 7.8 Carried over from earlier in the session (unverified)
- 🔴 **The production DB password was pasted in plaintext in chat and still needs
  rotating** (Dashboard → Project Settings → Database → Reset database password).
- 3 roleless users need a decision: `laveta3624@lawior.com` (disposable domain),
  `dennisjay43@gmail.com`, `thembrand@gmail.com`.
- WIP earned revenue figures **will change** now that progress is derived rather
  than read from the stale `projects.progress_percent` column — needs verifying.
- 6 finance pages still read the stale `progress_percent`: BalanceSheet,
  BankReconciliation, CashFlow, Change_orders, Income_Statement, Loans,
  Statement_of_Account.
- 14 finance pages still need converting to `useProjectSelection` for browser-Back.
- `send-financial-email`'s template still uses `<style>` + `@import`, which Gmail
  strips; it should be ported onto the table-based shell in `send-payroll-register`.

---

## 8. Requirements, constraints and things that must NOT be changed

### Hard rules
1. **ASK BEFORE PROCEEDING — ALWAYS.** See `CLAUDE.md` RULE 1. Especially before
   any schema change, backfill, file deletion, or edge-function logic change.
2. **No self-signup.** *"no user gets to sign himself up at all."* The `/register`
   route is commented out in `App.tsx` and must stay that way. Accounts are
   admin-provisioned.
3. **Users ≠ Workers.** Users hold global system roles and are **not** scoped to a
   project. Workers (`workers` + `worker_assignments`) are per-project
   tradespeople — contractor, painter, plumber — who do not log in. Never model
   project staffing as users, or system access as workers.
4. **Do not create a `project_team` table** or any per-project user-membership
   concept.
5. **No `console.*`** calls or debug UI in frontend code.
6. **Typecheck baseline is 53.** Do not let it rise.
7. **Do not reintroduce a second PM-assignment UI.**

### Must not break
- `vite.config.ts` has `host: true`, `allowedHosts: true` and **no `hmr` override**.
  An `hmr: { clientPort: 443, protocol: "wss" }` block was added earlier in the
  session and broke local dev — do not re-add it.
- The **source-tagged mirror pattern**: `job_postings.source`
  (`manual|payroll|ap|loan|tax`) + a nullable FK per source.
  `vw_project_cost_incurred` filters `source='manual'` so mirrors never
  double-count. Mirror triggers must stay `SECURITY DEFINER` with pinned
  `search_path` — `job_postings_write` requires `source='manual'`, so an INVOKER
  trigger gets rejected and takes the source write down with it.
- The corporate email shell in `send-payroll-register` is signed off. `compact()`
  exists because denomailer emits quoted-printable and indented template literals
  produce literal `=20` markers. Keep `nl2br()` before `compact()`.
- Edge function imports must be **static with literal URLs** —
  `supabase functions deploy` bundles ahead of time, so a dynamic
  `import(someVariable)` is invisible to the bundler and fails at runtime.
- `ROLE_PRIORITY` ordering (least → most privileged) is intentional.

### Environment notes
- Shell is **PowerShell**; heredocs are unsupported. Use `git commit -F <file>`.
- `AlertDialogAction` does **not** accept a `variant` prop — use
  `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"`.
- `supabase-js` cannot infer row shape from a *built* column string (e.g.
  `SECTION_COLUMNS`); cast via `as unknown as T[]`.

---

## 9. Exact next steps

### Step 1 — Unblock user creation (highest priority)
Ask the user to retry creating the project_manager user and paste the error the
form now shows. Then fix that specific cause. Do not guess; two hypotheses have
already been wrong.

### Step 2 — Fix the `worker_assignments.status` mismatch (§7.3)
**Ask first:** align the UI to `'assigned'`, or add `'pending'` to the enum.
Then update `workers.tsx` — the assign form default, the filter dropdown, and
the Performance tab's counters.

### Step 3 — Deploy, in this order
```bash
cd "C:/Projects/construction website/dream-construct-ui"

# 1. Migrations
$env:SUPABASE_DB_PASSWORD="<rotated password>"
npx supabase db push --remote

# 2. manage-user MUST go with 20261125120000_fix_quantity_surveyor_role.
#    Whichever lands first, ALLOWED_ROLES and public.roles disagree in the gap
#    and QS role changes fail until both are in.
npx supabase functions deploy manage-user

# 3. New functions
npx supabase functions deploy notify-project-assignment
npx supabase functions deploy delete-my-account
```
Note: Supabase CLI v3 defaults to the **local** stack — `--remote` is required.
There is a known migration-repair gotcha; see the `reference_supabase_project`
memory note.

### Step 4 — Verify in a browser (nothing here is browser-verified)
- `/admin/assignments` — assign a PM, confirm the email arrives and the row updates.
- The archived-project warning in the confirmation modal.
- `/admin/content/pages` — create, edit, publish, delete a section.
- `/media` — **check the `top-[72px]` filter bar against the Navbar at different
  scroll positions**, plus the featured band, lightbox and infinite scroll.
- Settings → Download My Data, and the delete-account dialog's blocker list.
- PM project detail → Performance tab.

### Step 5 — Restore the Hale Hospital project if it should be live
Overview tab → Restore. Martin is already its manager.

### Step 6 — Security follow-ups
- **Rotate the DB password** (§7.8).
- Decide on the 3 roleless users.
- Confirm `20261125120000` applied cleanly — it `RAISE EXCEPTION`s rather than
  leaving `roles` half-aligned.

### Step 7 — Commit
Nothing is committed. Branch is `finance-module`. Suggested split:
1. inherited tabs + milestone creation + PM nav + Performance tab
2. settings de-duplication + data export + account deletion
3. PM assignment centralisation + notification
4. Pages content editor + media centre redesign
5. `project_team` removal + QS lockstep + `CLAUDE.md`

---

## 10. Honest status summary

| Item | State |
|---|---|
| Typecheck (53 baseline) | ✅ holds |
| `vite build` | ✅ passes |
| Browser verification | ❌ none — no browser tool was available |
| Edge functions type-checked | ❌ Deno not installed; `delete-my-account` and `notify-project-assignment` are **unverified** |
| Migrations applied | ❌ none from this session |
| Functions deployed | ❌ none |
| Committed | ❌ nothing |
| `create-user` 400 | 🔴 unresolved, cause unknown |
