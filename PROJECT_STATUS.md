# Lee Cooper Clarinet — Repair Shop App: Project Status

Last updated: 2026-10-08

**This project is v2.0** (declared 2026-10-08, when private lessons were
built). The footer version is `2.<total commit count>.0`.

**Read this file first in any new chat about this project.** It exists so a
fresh conversation (with no memory of prior chats) can get productive in a
few minutes instead of needing the full history re-explained. Keep it
updated as work progresses — future-you (or a future Claude session) is the
audience.

## What this is and why

A custom repair-shop management app for Lee Cooper Clarinet, replacing the
"Musical Instrument Repair" Notion database. The specific gap that justified
building this: **Notion can't produce "pretty" printed receipts/invoices.**
PDF generation is the core value proposition — everything else (customer
records, repair tickets, parts inventory) is infrastructure in service of
that.

Stack: Node.js/Express backend (ES modules), React + Vite frontend served
statically by Express, MariaDB 11 database, all deployed as a Docker Compose
stack via Portainer on a self-hosted Intel NUC (reachable at
`dockernuc.local`).

Repo: `https://github.com/gleemon/lee-cooper-clarinet-app` — **this repo is
PUBLIC.** Never commit real passwords/secrets to it. Database credentials
are set manually as environment variables in Portainer's stack UI, not in
any committed file.

## Current deployment status

- Live on the NUC via Portainer (stack `instrument_repair`, id 6,
  endpoint id 3), deployed from the GitHub repo (Git repository stack
  method). Confirmed live and up to date as of commit `91c4a9c`
  (v2.0 -- redeployed via the Portainer API and verified 2026-10-09:
  Portainer's `ConfigHash` read `91c4a9c`, the live bundle serves
  `v2.51.0`, and the lessons API returns 200). Earlier, `2db3890`
  (2026-10-08) put the Ledger live -- this includes everything in the "Done" list at the
  bottom of this file plus the transactions ledger (V1 of the accounting
  system). `migrate-add-transactions-table.sql` was run against the live
  DB the same day (table exists, endpoints return 200, ledger empty --
  no test rows were written to live). Note that a Portainer redeploy
  recreates the `lcc-mariadb` container too (brief DB restart; data is
  safe in the named volume), and the PUT returns before the rebuild
  finishes -- wait ~30s before checking the live bundle, or you'll
  see the old version and wrongly conclude it didn't deploy. This file
  has been caught by surprise more than once now by
  redeploys/migrations done without a PROJECT_STATUS.md update -- treat
  this section as a claim to verify, not a fact, and cross-check
  Portainer's `ConfigHash` via the API before assuming what's live.
- Both migrations that used to be pending have been confirmed run
  against the live DB (checked via the live API's JSON typing -- `INT`
  columns come back as bare numbers, `DECIMAL` columns as quoted
  strings -- and by confirming no repair is left with the old
  `'Parts Ordered'` status): `migrate-parts-integer-columns.sql` and
  `migrate-parts-ordered-status.sql`. Don't re-run them.
- MariaDB running in its own container (`lcc-mariadb`) with a named volume
  (`lcc_mariadb_data`) for persistence. The AUTO_INCREMENT schema migration
  has been applied to the live database (see `applied patches/`).
- All data from the original Notion "Musical Instrument Repair" workspace
  has been migrated into MariaDB and verified against the live database
  (row counts confirmed matching for all 11 tables).
- **Redeploying the live stack**: `docker/.env` (gitignored, not committed)
  holds `PORTAINER_URL` and `PORTAINER_TOKEN` for the Portainer API. The
  API is at `http://dockernuc.local:9000` (plain HTTP -- the 9443 HTTPS
  port isn't listening). To trigger a git-pull redeploy:
  `PUT /api/stacks/6/git/redeploy?endpointId=3` with header
  `X-API-Key: <token>` and a JSON body of
  `{"env": [...same stack env...], "prune": false, "pullImage": true, "RepositoryReferenceName": "refs/heads/main"}`.
  A failed redeploy just leaves the previous version running -- it doesn't
  take the live site down.
- **Local Docker testing**: a root-level `.env` (gitignored) with
  `REPAIR_DB_ROOT_PASSWORD` / `REPAIR_DB_PASSWORD` (any values) lets
  `docker compose up -d --build` run the full stack locally at
  `localhost:5000` against a real MariaDB, separate from the live NUC data.

## Database schema

11 tables mirror the real Notion structure (not a guess — pulled directly
from the Notion workspace via its API), plus one new table not from Notion:

`customers`, `technicians`, `parts_vendors`, `instruments`,
`parts_inventory`, `repairs`, `invoices`, `work_log`, `parts_used`,
`repair_tags`, `receipts`, `transactions` (V1 of the accounting
system -- see "Planned: Accounting system"; not Notion-derived, added
2026-09-07), and `lessons` (v2.0 private lessons, added 2026-10-08).

`customers` also gained two columns in v2.0: `is_student` (boolean --
the Students page is customers filtered on this) and `lesson_rate` (the
student's usual per-lesson rate, which defaults the lesson form's
amount). A `lessons` row has `customer_id`, `lesson_date`,
`duration_minutes`, `amount`, `notes`, `paid`/`paid_date`, and
`transaction_id` -- the linked ledger row, present only while the lesson
is paid.

**Where migrations live now:** new migrations go in `docker/migrations/`,
NOT `docker/init-db/` (every `.sql` file in `init-db/` runs on a fresh
install and a non-idempotent one breaks it -- see "Code review findings"
item 1), and are written idempotent (`IF NOT EXISTS`). The v2.0 one is
`docker/migrations/2026-10-08-lessons.sql` -- **run against the live DB
2026-10-09** (verified: `customers.is_student`/`lesson_rate` exist, the
`lessons` table exists and was empty, all 6 customers intact).
`01-schema.sql` already contains everything for fresh installs.
Deployment order used, worth repeating for additive migrations: pipe the
file into the DB container over SSH (`cat file | ssh dockernuc.local
"docker exec -i lcc-mariadb sh -c 'cat > /tmp/x.sql'"` -- no sudo needed),
have the user `source` it at the MariaDB prompt (the only step needing the
DB password), THEN redeploy, so new code never meets the old schema.

Every table's `id` column is `AUTO_INCREMENT`. Tables migrated from Notion
(customers, technicians, parts_vendors, instruments, parts_inventory,
repairs, invoices) were seeded with **fixed ids** copied from a sequential
mapping of their Notion page ids, so foreign-key relationships from Notion
carry over exactly — but each table's AUTO_INCREMENT counter is set to
start past the highest migrated id, so new rows created by the app number
correctly going forward. (Tables with no Notion-native identity — work_log,
parts_used, repair_tags, receipts — just use plain surrogate keys.)

Source files:
- `docker/init-db/01-schema.sql` — schema, runs once on a fresh volume
- `docker/init-db/02-seed-data.sql` — the migrated Notion data, also runs
  once on a fresh volume (never re-run against a populated one — not
  idempotent)
- `applied patches/migrate-auto-increment.sql` — one-off script that
  converted the already-deployed live database to AUTO_INCREMENT ids
  without wiping data (init scripts only run against an empty volume, so
  this had to be run by hand once — already applied, archived here rather
  than left in `docker/init-db/` since it shouldn't run again)
- `docker/init-db/migrate-add-repair-notes.sql`,
  `migrate-parts-integer-columns.sql`, `migrate-parts-ordered-status.sql`
  — all three already applied to live and already baked into
  `01-schema.sql`/`02-seed-data.sql`. **They must be moved to
  `applied patches/`, not just for tidiness:** every `.sql` file in
  `docker/init-db/` runs on a fresh volume, and
  `migrate-add-repair-notes.sql` isn't idempotent -- tested 2026-09-23
  in a throwaway container, a from-scratch install fails with
  `Duplicate column name 'notes'` and MariaDB exits. See "Code review
  findings" below (item 1).
- `docker/init-db/migrate-add-transactions-table.sql` — creates the new
  `transactions` table. **Run against both local and live DBs**
  (live: 2026-10-08, verified via `DESCRIBE transactions` and the
  endpoints returning 200). Unlike the three above, this one is
  safe to leave in `docker/init-db/`: it uses `CREATE TABLE IF NOT
  EXISTS`, so on a fresh volume (where `01-schema.sql` has already
  created the table) it's a harmless no-op. It can move to
  `applied patches/` whenever convenient.

## Backend API (backend/server.js)

- `GET /api/health`
- `GET /api/customers`, `POST /api/customers`, `GET /api/customers/:id`, `PUT /api/customers/:id`
- `GET /api/repairs`, `POST /api/repairs`, `GET /api/repairs/:id`
- `PUT /api/repairs/:id/status` — validates against the schema's status list; auto-stamps `completion_date` the first time a repair is set to "Complete"
- `GET /api/technicians` — used by the work log form's technician picker
- `POST /api/repairs/:id/work-log`, `PUT /api/work-log/:id` — log/edit hours (billable defaults to true; only billable entries count toward laborCost)
- `POST /api/repairs/:id/parts-used`, `PUT /api/parts-used/:id` — log/edit a part used; keeps the part's quantity_in_stock reconciled on every write, including edits that change the quantity or swap which part was used (allowed to go negative)
- `GET /api/repairs/:id/receipt.pdf` — "Repair Estimate & Receipt" PDF
- `GET /api/invoices`, `GET /api/invoices/:id`
- `POST /api/invoices` — idempotent: a repair can only have one invoice, so if one already exists for `repair_id` it's returned as-is instead of inserting a duplicate
- `PUT /api/invoices/:id` — update name/due_date/payment_status/tax_rate
- `GET /api/invoices/:id/pdf` — itemized invoice PDF (labor + parts + tax)
- `GET /api/instruments` (shop-wide, joined with owner name), `GET /api/instruments/:id`, `PUT /api/instruments/:id` (owner is settable/unsettable via `ownerCustomerId`)
- `GET /api/vendors`, `GET /api/parts`, `GET /api/parts/:id` — parts inventory, joined with vendor name
- `POST /api/parts` — create a part (and its vendor too, if new)
- `PUT /api/parts/:id` — update every field on an existing part (replaces quantity_in_stock, unlike /receive)
- `POST /api/parts/:id/receive` — add received quantity to an existing part's stock
- `GET /api/lessons`, `GET /api/lessons/:id`, `POST /api/lessons`, `PUT /api/lessons/:id`, `PUT /api/lessons/:id/paid` — private lessons (v2.0). `amount` must be positive; `paid` + `paidDate` (defaults to the lesson date) control payment. **Paid lessons own a ledger row:** `syncLessonLedger()` runs inside the same DB transaction as every lesson write and (a) creates an income row (category `Lessons`, payee = the student, notes `Lesson on YYYY-MM-DD`) when a lesson becomes paid, (b) updates it if a paid lesson's amount/date/student changes, (c) **deletes it** when a lesson is marked unpaid. `PUT .../paid` is the list's quick "Mark paid" toggle (sends today's browser-local date).
- `POST /api/customers` / `PUT /api/customers/:id` now also take `is_student` and `lesson_rate` (PUT leaves them untouched if the request omits them, so an older client can't silently un-student someone)
- `GET /api/transactions`, `POST /api/transactions` — the accounting ledger (V1, see "Planned: Accounting system"); not yet linked to invoice payments
- `GET /api/transactions/categories`, `GET /api/transactions/payees` — distinct values already in use, for the entry form's `<datalist>` suggestions (category is paired with `type` so suggestions can be narrowed to income vs. expense)

Billing math lives in `backend/services/billing.js` and mirrors the
formulas that used to live in Notion's rollup/formula fields: Labor Cost =
sum(hours × technician hourly rate) for billable work_log entries; Parts
Cost = sum(parts_used.customer_cost); Subtotal = Labor + Parts.

PDF rendering lives in `backend/pdf/` (`shopInfo.js`, `receiptPdf.js`,
`invoicePdf.js`), using `pdfkit`. Shop letterhead info (name, address,
phone, email) is hardcoded in `shopInfo.js` from the shop's own Notion
receipt template.

## Frontend (frontend/src/App.jsx)

**Standard pattern for any new list page**: sortable column headers (click
to sort ascending, click again for descending, with a ▲/▼ indicator) and a
clickable primary field (styled as a link via the `.link-btn` CSS class)
that opens the row's detail/edit view, instead of a separate "Actions"
column with a "View"/"Edit" button. Shared implementation so this doesn't
get reimplemented per page: `useSort(initialField, initialDirection)` hook,
`sortRows(rows, columns, sortField, sortDirection)`, and the
`<SortableHeaderRow columns={...} .../>` component, all defined near the
top of `App.jsx`. A page just defines its own `{key, label, type}` column
config (`type` is `"string"`, `"number"`, or `"date"`) -- see
`INVENTORY_COLUMNS` / `REPAIR_COLUMNS` for examples. Filtering (a status
`<select>`, a free-text search `<input>`, both wrapped in a `.filter-bar`
div) is layered on top where it makes sense, applied before sorting.

Nav (two levels, restructured 2026-10-08): a top row of sections, plus a
second row of sub-pages that appears under whichever section you're in:

- Dashboard
- Repairs -- sub-pages: Invoices, Inventory
- Customers -- sub-pages: Instruments
- Lessons -- sub-pages: Students
- Ledger

**Lessons** (v2.0) is a quick-entry list: "+ Log Lesson" form (student
picker -- or "+ New Student" to create one on the spot -- date defaulting
to today, optional duration, amount defaulting to the student's usual
rate, notes, and a Paid checkbox with a paid-on date), a list sortable by
date/student/duration/amount/paid and filterable by student, paid/unpaid
and free-text search, summary cards (count / Paid / Unpaid that follow the
filters), a one-click "Mark paid" button per unpaid row, and click-the-date
to edit (unticking Paid there removes the linked ledger row). **Students**
is the Customers page filtered to `is_student` (`<CustomersPage
studentsOnly />`), with a "+ New Student" form and a Usual Rate column;
clicking a name opens the same customer edit form, which has the
"Student" checkbox + usual-rate field -- that's also how an existing
customer becomes a student. The Customers list shows a small "Student"
badge. Dashboard wasn't in the requested menu list; it was kept as the
home page because it's the only way into the intake form.

The menu is data-driven: edit `NAV_SECTIONS` near the top of `App.jsx`
(each section has its landing `page`, optional `children`, and the full
set of `pages` that count as "inside" it -- including pages with no
button of their own, like a repair's detail view, so the right section
stays highlighted).

There's no separate "New Repair" nav item -- the Dashboard's
"+ New Repair Intake" button navigates to the intake page directly (it
used to do nothing; fixed alongside dropping the redundant nav entry).

Pages: Dashboard (mostly a stub), New Repair Intake (wired to
`POST /api/repairs/intake`; has independent customer and instrument
pickers, both shop-wide via `GET /api/customers` and `GET /api/instruments`
— a repair's customer and instrument don't have to share an owner, so
instrument lookup isn't scoped to the selected customer. Each falls back to
"+ New Customer" / "+ New Instrument" fields; new-instrument creation now
captures make/model/serial/purchase date/purchase cost/valuation, not just
type; Estimated Cost defaults to $125, steps by $25, floors at $50), Repairs
(renamed twice now -- "Active Repairs" → "All Repairs" → "Repairs" -- shows
every status except Archive by default; the status filter is a multi-select
dropdown (`MultiSelectDropdown`, a shared component: closes on outside
click or Escape, trigger button summarizes the selection as "All
Statuses"/one name/"N selected") plus free-text search across
customer/instrument/title; sortable columns; each row is a single
clickable line -- ticket # — customer — instrument -- instead of three
separate columns), Repair Detail (status is a dropdown -- picking a value
saves immediately via `PUT /api/repairs/:id/status`; shows
customer/instrument/billing; action buttons live in a `.action-bar`
flex-row container so they always line up in one row instead of needing
manual spacing per button -- currently Print Repair Ticket (always) and
Create Invoice (only shown when status is "Ready for Pickup"; clicking
it when an invoice already exists for this repair just reopens that
same invoice's PDF rather than creating a duplicate, since
`POST /api/invoices` is idempotent per repair); has Work Log / Parts Used sections with their own
"+ Log Work" / "+ Add Part Used" forms -- logging work needs hours and
optionally a technician/description/billable flag; logging a part picks
from inventory (auto-suggests customer cost from reorder_cost × markup,
editable) or falls back to a free-text description for anything not in
inventory, and decrements the part's stock. Every row's date is clickable
(the same `.link-btn` pattern used elsewhere) to reopen that same form
pre-filled for editing -- editing a parts-used entry reconciles inventory
correctly even if the quantity or the part itself changes. All of this
refreshes the billing totals immediately on save), Invoices (sortable
columns; filterable by payment status and free-text search across
customer/repair; clicking the repair name opens that repair's detail
page, clicking the invoice number opens an edit page for
name/due_date/payment_status/tax_rate (tax rate shown/entered as a
percentage, e.g. "6" for 6%, stored as the fraction `0.06` -- same
percent-in-UI/fraction-in-DB spirit as markup, just without markup's
+1 multiplier math); links to each invoice's PDF), Inventory (sortable
columns; filterable by category, vendor, and free-text search; a "Low
Stock" flag when quantity_in_stock <= reorder_level; markup shown as a
percentage; a "Receive Parts" form -- pick an existing part to add
received quantity to its stock, or "+ New Part" to create one, with a
"+ New Vendor" fallback if the vendor isn't in the system yet either;
clicking a part name opens an edit page for its full record), Customers
(sortable columns; free-text search across name/email/phone; clicking a
name opens an edit page for the full record via
`GET`/`PUT /api/customers/:id`), Instruments (sortable columns; filterable
by owner (including "No Owner") and free-text search across
name/type/make/model/serial; clicking a name opens an edit page, including
reassigning the owner, via `GET`/`PUT /api/instruments/:id`), Ledger
(V1 of the accounting system's transactions table -- see "Planned:
Accounting system"; a plain income/expense list, not yet linked to
invoice payments. `category` and `payee` are free text with no lookup
table -- `<datalist>` suggests values already in use, via
`GET /api/transactions/categories`/`payees`, but typing a new one is
just as valid; category suggestions narrow to the currently-selected
income/expense side. Filterable by type and category, plus free-text
search across payee/notes; sortable columns; three summary cards
(Income/Expenses/Net) recompute from whatever's currently filtered, not
the full unfiltered set).

`fmtMoney()` puts the sign before the `$` for a negative amount
(`-$45.99`, not `$-45.99`) -- only surfaced once the ledger's Net figure
introduced the first negative amount it ever had to format.

`fmtDate()` parses the `YYYY-MM-DD` prefix of a date string directly
rather than going through `new Date(...).toLocaleDateString()` -- the
latter treats a date-only string as UTC midnight and rolls it back a day
for anyone west of UTC. Affects every date shown in the app; worth
remembering if a new date-formatting helper ever gets added elsewhere.

`todayIsoDate()` builds "today" from the browser's LOCAL date parts, not
`new Date().toISOString()` -- that's UTC, so after ~8pm US Eastern it
returned tomorrow, putting the wrong default date on every form that
uses it (fixed 2026-10-08, alongside the lessons work). Same family of
bug as the `fmtDate()` one above; use `todayIsoDate()`, never
`toISOString().slice(0, 10)`, for a "today" default. (Server-side
`CURDATE()` is also UTC-based inside the container, so the lessons list
sends the browser's date explicitly when marking paid.)

The footer shows the running build's version + short git commit hash.
Version comes from `frontend/package.json`'s `"version"` field
(`__APP_VERSION__`, convention: `2.<total commit count as of that
commit>.0` -- major bumped from 1 to 2 on 2026-10-08 -- bumped by hand as part of every commit) rather than computed
from git at build time, since the Docker build deliberately has no
`.git` available (see "Known issues" below) and a static `"1.0.0"` was
never useful. The commit hash (`__COMMIT_HASH__`) still comes from `git
rev-parse --short HEAD` where available, falling back to `"unknown"` in
the Docker image. Both are Vite `define`s computed in
`frontend/vite.config.js`, so it's obvious from the live site which
commit is actually deployed.

## Known issues, gotchas, and their fixes

- **Portainer bind-mount path bug**: when Portainer deploys a stack from a
  Git repo, it resolves relative bind-mount paths (e.g.
  `./docker/init-db`) using its own internal `/data` mount, which does not
  correspond 1:1 to the real host filesystem. Docker daemon then mounts an
  empty directory instead of the actual checked-out files, so
  `docker-entrypoint-initdb.d` scripts silently don't run. Root-caused but
  not fixed at the Portainer level (too risky — that container manages
  other unrelated stacks). **Workaround**: manually `scp` SQL files to the
  NUC and run them with `docker exec -i lcc-mariadb mariadb -u root -p'...'
  repair_shop < file.sql`.
- MariaDB 11.x images renamed the `mysql` CLI binary to `mariadb`.
- The frontend's `VITE_API_URL` must stay a relative path (empty string
  fallback) — hardcoding `localhost:5000` broke it for any client not
  running on the NUC itself, since the browser would try to reach its own
  localhost.
- Several early files had BOM encoding issues and `index.html` was in the
  wrong location for Vite (`frontend/public/index.html` instead of
  `frontend/index.html`) — both fixed.
- **Portainer's git-stack checkout doesn't include `.git`.** The Dockerfile
  briefly copied `.git` into the frontend build stage to compute the commit
  hash for the footer -- this works with a normal local git checkout but
  hard-fails Portainer's redeploy ("/.git": not found). Fixed by not
  requiring `.git`/`git` in the Docker build at all; `vite.config.js`
  already falls back to `"unknown"` when git isn't available, so the
  Docker image just shows "unknown" while local `npm run build` (outside
  Docker) still shows the real hash.

## Code review findings (2026-09-23, NOT STARTED)

From a full codebase review. Suggested order: 1-2 first (small, and both
can take the app down), then 3-4, then 7-9 as one cleanup commit; 12
before starting accounting V1; 10-11 whenever there's a quiet stretch.

**Fix soon (real bugs):**
1. **Fresh installs are broken.** `migrate-add-repair-notes.sql` in
   `docker/init-db/` re-adds a column `01-schema.sql` already creates;
   on an empty volume MariaDB exits with `Duplicate column name
   'notes'` (verified in a throwaway container). Live/local are fine
   only because their volumes already exist. Fix: move all three
   `migrate-*.sql` files to `applied patches/`.
2. **DB connection leak can hang the app.** ~35 handlers in
   `server.js` call `pool.getConnection()` and `release()` inside the
   `try`, so a query error never returns the connection. Pool is 10
   connections with an unlimited queue -- ten failed queries and every
   later request hangs until restart. Fix: `pool.query()` for
   single-statement handlers, `finally { conn.release() }` for the
   transactional ones (the 5 transactional handlers already do this).
3. **Invoice duplicates still possible under concurrency.** "One
   invoice per repair" is a check-then-insert in code only; add
   `UNIQUE (repair_id)` on `invoices` -- after checking live for
   existing duplicates first.

**Security (fine on the LAN, worth tightening):**
4. MariaDB is published on the NUC's LAN at port 3307
   (`docker-compose.yml`); the app doesn't need it. Remove, or bind to
   `127.0.0.1:3307:3306`.
5. 29 handlers return raw `err.message` to the browser -- log
   server-side, send a generic message.
6. No auth (fine while LAN-only). Note `scripts/dev-against-nuc.sh`
   points local dev at **live** data.

**Maintenance:**
7. `node:18-alpine` in the Dockerfile is end-of-life (April 2025) --
   move to `node:22-alpine` (build already warns a dependency needs
   Node 20+).
8. Dead code/deps: `POST /api/customers` and `POST /api/repairs` have no
   callers; `axios` unused in backend; `tailwindcss`/`postcss`/
   `autoprefixer` unused in frontend; root `npm run build` calls a
   backend `build` script that doesn't exist.
9. `.env.example` is stale (lists `REACT_APP_API_URL`/`NOTION_API_KEY`,
   omits the `REPAIR_DB_*` vars docker-compose needs, has a stray BOM).
10. `App.jsx` is ~2,350 lines -- split into `pages/`/`components/`
    (no behaviour change).
11. No automated tests -- start with `billing.js` math, parts-used
    inventory reconciliation, and invoice idempotency.
12. No migration system -- a numbered migrations folder plus a
    `schema_migrations` table would settle "has this run on live?"
    without inference. Do this before the accounting tables arrive.
    (Note: accounting V1 step 1 -- the `transactions` table -- was built
    2026-09-07, before this review landed, so it's already in; do this
    before steps 2-5 add more tables.)

## Planned: Accounting system (discussed 2026-08-27; step 1 built
## 2026-09-07 -- steps 2-5 below are still NOT STARTED, do not build
## any of that without explicit go-ahead)

The app currently only tracks repair-shop revenue, and even that is just
a `payment_status` flag on invoices, not a real payment record. The user
wants to record all business income (repairs, gigs, private lessons) and
expenses (inventory costs, etc.) well enough to hand an accountant a
Schedule C-style income/expense report. Decided during discussion:
cash-basis single-entry ledger, not full double-entry bookkeeping (a
`transactions` table with type/category/amount/date/payee, not a chart
of accounts) -- matches the actual need without the complexity of real
double-entry accounting.

Decisions locked in:
- Categories and payees (vendors for expenses, income sources like a gig
  venue): create-on-the-fly free text, not a managed lookup list --
  supersedes an earlier plan to use a strict managed list for gig
  payment sources. `<datalist>` suggests whatever's already in
  `transactions` (via `GET /api/transactions/categories`/`payees`), but
  typing a brand new value is just as valid; no separate
  categories/vendors table.
- Lesson students: reuse the existing `customers` table, no separate
  student list.
- Reporting: Schedule C-style income/expense report, categorized for
  handing to an accountant.
- Invoice payments: upgrade from the current status flag to a real
  payment system (amount, date, method; supports partial payments).

**V1 build order** (see conversation for full reasoning on the sequencing):
1. **DONE (2026-09-07).** Transactions ledger foundation -- `transactions`
   table (`transaction_date`, `type` income/expense, `category`, `amount`,
   `payee`, `notes`; no `payment_method` column -- wasn't requested for
   this basic pass and can be added later) plus a Ledger nav page: entry
   form (`POST /api/transactions`) and a sortable/filterable list
   (`GET /api/transactions`) with Income/Expenses/Net summary cards that
   recompute from whatever's currently filtered. **Deliberately excludes
   invoice payments** (step 2 below) per explicit instruction. Live on
   the NUC as of 2026-10-08 (code + `migrate-add-transactions-table.sql`
   both applied -- see "Current deployment status" above).
2. Real invoice payment system -- replaces `payment_status` with actual
   payment records; each recorded payment also writes a linked
   transaction, so repair-shop revenue flows into the same ledger
   instead of being a separate silo.
3. Gig income entry -- a `payment_sources` list for the autocomplete,
   plus a quick entry form. Highest-value item with the least
   dependency, since gig income currently has zero support.
4. Inventory cost logging -- add an optional "amount actually paid"
   field to the existing Receive Parts flow (defaults to
   `reorder_cost × quantity`, editable), logging an expense transaction.
   Lowest urgency of the four; benefits from categories already being
   settled by steps 1-3.
5. Schedule C-style income/expense report -- built last on purpose, once
   real data is flowing in from repairs/gigs/inventory so the category
   groupings are informed by actual usage instead of guessed up front.

**V2:**
- **Private lessons -- DONE 2026-10-08 (v2.0)**, built as described below, one decision made along the way: a student is a customer flagged `is_student` with a `lesson_rate` (not "anyone with a lesson"). Original plan: a quick-entry page to log a lesson taught (pick
  student from `customers`, date defaults today, rate defaults to that
  student's usual) and mark it paid (creates a linked ledger
  transaction, same pattern as invoice payments). Depends only on the
  V1 ledger, so it can slot in whenever without disrupting the order
  above.
- **Lending library**: track shop-owned/loaner instruments (the
  `instruments` rows with no `owner_customer_id`, e.g. "Shop Use Only")
  being loaned out to customers/students -- loan date, expected/actual
  return date, condition notes. Not yet scoped in detail; flagged here
  so it isn't lost.

## Immediate next steps (in order)

1. **Email customers when a repair is done.** A "Notify Customer" button
   in Repair Detail's `.action-bar` (next to Print Repair Ticket / Create Invoice),
   triggered manually rather than automatically on status change, so
   nothing gets emailed by accident while someone's just editing a
   ticket. Planned approach: `nodemailer` over SMTP using the shop's
   existing `leecooperclarinet@gmail.com` (already in seed data) via a
   Gmail "app password" -- no new service/account needed, fine at this
   shop's volume. (Tradeoff noted at decision time: a dedicated
   transactional service like Resend/SendGrid would be more reliable at
   scale, but Gmail SMTP is the pragmatic starting point here.) Natural
   trigger point now that status updates exist: offer to notify when a
   repair is set to "Complete".
2. **Mobile table scroll.** Confirmed via testing: none of the data
   tables (Inventory, All Repairs, Invoices, Customers, Instruments) are
   wrapped for horizontal scrolling, so a wide table (e.g. Inventory's 7
   columns) forces the whole page to widen past a phone's viewport
   instead of scrolling within its own box. Fix is small and contained:
   wrap each `<table>` in an `overflow-x: auto` container.
3. **Inline spreadsheet-style editing** for the Inventory table (editable
   cells + a `PATCH /api/parts/:id`-style save-per-field), discussed but
   not scoped in detail yet.
4. Lower priority: deleting parts/vendors/customers/instruments/repairs/
   work-log/parts-used entries (nothing in the app deletes anything
   today -- editing exists for parts/customers/instruments/repair
   status/work-log/parts-used, not yet for vendors/repairs/invoices), a
   live dashboard (currently static), a Technicians/Vendors management
   page (both have DB tables and are referenced elsewhere but have no
   page of their own yet), auth (currently none — fine for LAN-only use,
   worth a conscious decision before any external exposure).

Done: PDF receipts/invoices, AUTO_INCREMENT schema fix (applied to live
DB), New Repair Intake wired to the backend with repeat-customer and
shop-wide instrument pickers (full instrument fields on creation), footer
version + commit hash display, Parts Inventory (list + Receive Parts
form + click a part name to edit its full record via
`GET`/`PUT /api/parts/:id`), `quantity_in_stock`/`reorder_level`/
`reorder_unit` converted from `DECIMAL(10,2)` to `INT` (schema, migration,
backend rounding, frontend `step`) since parts are counted in whole units,
sortable Inventory table column headers, `reorder_level`/`reorder_cost`/
`reorder_unit` rejected if negative (`quantity_in_stock` is deliberately
allowed to go negative -- backorders), markup shown/entered as a
percentage in the UI while still stored as a cost multiplier in the DB
(`markupPercentToMultiplier`/`markupMultiplierToPercent` in `App.jsx`),
sortable-list pattern extracted into shared `useSort`/`sortRows`/
`SortableHeaderRow` helpers and applied to both Inventory and the
renamed/filterable All Repairs page -- this is now the standard for any
new list page (see "Frontend" section above), filters added to Invoices
(payment status + search) and Inventory (category + vendor + search),
two new pages built to the same standard: Customers (list + edit,
`GET`/`PUT /api/customers/:id`) and Instruments (list + edit including
reassigning the owner, `GET`/`PUT /api/instruments/:id`), labor/parts
logging on a repair -- `GET /api/technicians`,
`POST`/`PUT /api/repairs/:id/work-log`,
`POST`/`PUT /api/repairs/:id/parts-used` (both editable, not just
create-only; edits reconcile inventory correctly even across a quantity
or part change), plus Work Log / Parts Used sections and forms on the
Repair Detail page, closing the gap that meant every receipt/invoice
used to total $0, and repair status updates --
`PUT /api/repairs/:id/status`, a dropdown on Repair Detail, auto-stamps
`completion_date` the first time a repair is marked Complete.

Also done since: fixed the `fmtDate()` off-by-one bug (see "Frontend"
above); wired the dead Dashboard "+ New Repair Intake" button and
dropped the now-redundant "New Repair" nav item; Repairs' status filter
is now a multi-select dropdown (new shared `MultiSelectDropdown`
component) defaulting to hide Archive; Repairs' three separate
ticket#/customer/instrument columns merged into one clickable line;
replaced the `'Parts Ordered'` status with `'Hold - Parts'` and
`'Hold - Customer'` (migration: `migrate-parts-ordered-status.sql`, now
confirmed run against live too); footer version now reflects real commit
count via `frontend/package.json` instead of a static `"1.0.0"`; New
Repair Intake's Estimated Cost field defaults to $125, steps by $25,
floors at $50; renamed "Print Receipt" to "Print Ticket" then to "Print
Repair Ticket" (button label and the Intake submit button text still
says "...Print Ticket", not "...Print Repair Ticket" -- only the Repair
Detail link itself was asked to change) and moved Repair Detail's action
buttons into a `.action-bar` flex row so future buttons automatically
line up instead of needing manual spacing per button; Create Invoice is
now only shown when a repair's status is "Ready for Pickup", and
`POST /api/invoices` is idempotent per repair (previously, clicking
Create Invoice more than once created a separate duplicate invoice row
each time -- confirmed by testing, then fixed); invoices are now
editable (`PUT /api/invoices/:id`) via a click-the-invoice-number edit
page on the Invoices list, covering name/due_date/payment_status/tax_rate.

## Recommended way of working on this project going forward

This app has grown past the point where one long chat thread is a good
fit — long threads eventually hit a memory/context limit and get
auto-summarized, which is a lossy safety net, not a plan. Going forward:

- Start a new chat per feature or deployment session, and point it at this
  file first.
- Keep this file updated after each milestone — what's deployed, what
  schema decisions were made and why, what's pending.
- Paste long logs/errors as file attachments rather than inline when
  possible, to keep any given chat leaner.
- Treat the git repo (commits, this status file) as the source of truth,
  not conversation history.
