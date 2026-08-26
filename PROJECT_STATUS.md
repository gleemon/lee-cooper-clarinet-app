# Lee Cooper Clarinet — Repair Shop App: Project Status

Last updated: 2026-08-26

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
  method). Confirmed live and up to date as of commit `f96658c` (this was
  redeployed from the other workstation without a PROJECT_STATUS.md
  update, so don't trust this file's deployment status at face value --
  cross-check Portainer's `ConfigHash` via the API described below).
  **Not yet deployed**: just `320d62f` onward (Print Ticket rename,
  `.action-bar`, Estimated Cost defaults) as of this writing.
- Both pending migrations have been confirmed **already run** against
  the live DB (checked via the live API's JSON typing -- `INT` columns
  come back as bare numbers, `DECIMAL` columns as quoted strings --
  and by confirming no repair is left with the old `'Parts Ordered'`
  status): `migrate-parts-integer-columns.sql` and
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

11 tables, mirroring the real Notion structure (not a guess — pulled
directly from the Notion workspace via its API):

`customers`, `technicians`, `parts_vendors`, `instruments`,
`parts_inventory`, `repairs`, `invoices`, `work_log`, `parts_used`,
`repair_tags`, `receipts`.

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
- `docker/init-db/migrate-parts-integer-columns.sql` — converts
  `quantity_in_stock`/`reorder_level`/`reorder_unit` from
  `DECIMAL(10,2)` to `INT`. **Confirmed already run against the live
  DB** (verified via the API's JSON typing, 2026-08-26) -- still sitting
  in `docker/init-db/` rather than `applied patches/`; move it next time
  this file gets tidied up.
- `docker/init-db/migrate-parts-ordered-status.sql` — renames the old
  `'Parts Ordered'` repair status to `'Hold - Parts'`. **Confirmed
  already run against the live DB** (verified 2026-08-26, no repair
  left with the old status) -- same note as above about archiving it.

## Backend API (backend/server.js)

- `GET /api/health`
- `GET /api/customers`, `POST /api/customers`, `GET /api/customers/:id`, `PUT /api/customers/:id`
- `GET /api/repairs`, `POST /api/repairs`, `GET /api/repairs/:id`
- `PUT /api/repairs/:id/status` — validates against the schema's status list; auto-stamps `completion_date` the first time a repair is set to "Complete"
- `GET /api/technicians` — used by the work log form's technician picker
- `POST /api/repairs/:id/work-log`, `PUT /api/work-log/:id` — log/edit hours (billable defaults to true; only billable entries count toward laborCost)
- `POST /api/repairs/:id/parts-used`, `PUT /api/parts-used/:id` — log/edit a part used; keeps the part's quantity_in_stock reconciled on every write, including edits that change the quantity or swap which part was used (allowed to go negative)
- `GET /api/repairs/:id/receipt.pdf` — "Repair Estimate & Receipt" PDF
- `GET /api/invoices`, `POST /api/invoices`, `GET /api/invoices/:id`
- `GET /api/invoices/:id/pdf` — itemized invoice PDF (labor + parts + tax)
- `GET /api/instruments` (shop-wide, joined with owner name), `GET /api/instruments/:id`, `PUT /api/instruments/:id` (owner is settable/unsettable via `ownerCustomerId`)
- `GET /api/vendors`, `GET /api/parts`, `GET /api/parts/:id` — parts inventory, joined with vendor name
- `POST /api/parts` — create a part (and its vendor too, if new)
- `PUT /api/parts/:id` — update every field on an existing part (replaces quantity_in_stock, unlike /receive)
- `POST /api/parts/:id/receive` — add received quantity to an existing part's stock

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

Nav: Dashboard, Repairs, Invoices, Inventory, Customers, Instruments.
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
customer/instrument/billing; action buttons (Print Ticket, Create
Invoice, and anything added later) live in a `.action-bar` flex-row
container so they always line up in one row instead of needing manual
spacing per button; has Work Log / Parts Used sections with their own
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
customer/repair; links to each invoice's PDF), Inventory (sortable
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
reassigning the owner, via `GET`/`PUT /api/instruments/:id`).

`fmtDate()` parses the `YYYY-MM-DD` prefix of a date string directly
rather than going through `new Date(...).toLocaleDateString()` -- the
latter treats a date-only string as UTC midnight and rolls it back a day
for anyone west of UTC. Affects every date shown in the app; worth
remembering if a new date-formatting helper ever gets added elsewhere.

The footer shows the running build's version + short git commit hash.
Version comes from `frontend/package.json`'s `"version"` field
(`__APP_VERSION__`, convention: `1.<total commit count as of that
commit>.0`, bumped by hand as part of every commit) rather than computed
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

## Immediate next steps (in order)

1. **Email customers when a repair is done.** A "Notify Customer" button
   in Repair Detail's `.action-bar` (next to Print Ticket / Create Invoice),
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
`'Hold - Customer'` (migration: `migrate-parts-ordered-status.sql`, not
yet run against live); footer version now reflects real commit count via
`frontend/package.json` instead of a static `"1.0.0"`; New Repair
Intake's Estimated Cost field defaults to $125, steps by $25, floors at
$50; renamed "Print Receipt" to "Print Ticket" (button label and the
Intake submit button text) and moved Repair Detail's action buttons into
a `.action-bar` flex row so future buttons automatically line up
alongside Print Ticket / Create Invoice instead of needing manual
spacing per button.

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
