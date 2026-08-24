# Lee Cooper Clarinet — Repair Shop App: Project Status

Last updated: 2026-08-23

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
  method). Confirmed live and up to date as of commit `3a2614d`, which
  includes PDF receipts/invoices, the repeat-customer/shop-wide-instrument
  intake pickers, and the version/commit footer.
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

## Backend API (backend/server.js)

- `GET /api/health`
- `GET /api/customers`, `POST /api/customers`
- `GET /api/repairs`, `POST /api/repairs`, `GET /api/repairs/:id`
- `GET /api/repairs/:id/receipt.pdf` — "Repair Estimate & Receipt" PDF
- `GET /api/invoices`, `POST /api/invoices`, `GET /api/invoices/:id`
- `GET /api/invoices/:id/pdf` — itemized invoice PDF (labor + parts + tax)
- `GET /api/instruments` — shop-wide, joined with owner name
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

Pages: Dashboard (mostly a stub), New Repair Intake (wired to
`POST /api/repairs/intake`; has independent customer and instrument
pickers, both shop-wide via `GET /api/customers` and `GET /api/instruments`
— a repair's customer and instrument don't have to share an owner, so
instrument lookup isn't scoped to the selected customer. Each falls back to
"+ New Customer" / "+ New Instrument" fields; new-instrument creation now
captures make/model/serial/purchase date/purchase cost/valuation, not just
type), Active Repairs (real data,
"View" opens a repair detail page), Repair Detail (shows
status/customer/instrument/billing, links to Print Receipt and Create
Invoice), Invoices (real data, links to each invoice's PDF), Inventory
(parts list with a "Low Stock" flag when quantity_in_stock <= reorder_level,
plus a "Receive Parts" form -- pick an existing part to add received
quantity to its stock, or "+ New Part" to create one, with a "+ New Vendor"
fallback if the vendor isn't in the system yet either).

The footer also shows the running build's version + short git commit hash
(`__APP_VERSION__` / `__COMMIT_HASH__`, both Vite `define`s computed in
`frontend/vite.config.js`), so it's obvious from the live site which commit
is actually deployed.

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

1. **Add labor/parts entry to a repair.** Billing (`backend/services/billing.js`)
   sums `work_log` and `parts_used` rows, but nothing in the app can create
   either — there's no endpoint or UI. Every receipt/invoice will total $0
   until this exists. Needs `POST /api/repairs/:id/work-log`,
   `POST /api/repairs/:id/parts-used`, and a form on the Repair Detail page.
   (Now that Parts Inventory exists, "parts used on a repair" could
   optionally decrement `quantity_in_stock` too.)
2. **Repair status updates.** Status is set to "Received" at intake and
   never changes through the app (Diagnosis → In Progress → Ready for
   Pickup → Complete all require a direct DB edit today).
3. **Customer list/management page.** No way to browse, search, or edit
   existing customers outside of the intake picker;
   `fetchCustomers` in `App.jsx` exists but nothing calls it besides the
   intake form's picker.
4. Lower priority: editing/deleting existing parts or vendors (Inventory
   is currently add-only), a live dashboard (currently static), auth
   (currently none — fine for LAN-only use, worth a conscious decision
   before any external exposure).

Done: PDF receipts/invoices, AUTO_INCREMENT schema fix (applied to live
DB), New Repair Intake wired to the backend with repeat-customer and
shop-wide instrument pickers (full instrument fields on creation), footer
version + commit hash display, Parts Inventory (list + Receive Parts
form + click a part name to edit its full record via
`GET`/`PUT /api/parts/:id`), `quantity_in_stock`/`reorder_level`/
`reorder_unit` converted from `DECIMAL(10,2)` to `INT` (schema, migration,
backend rounding, frontend `step`) since parts are counted in whole units,
live NUC redeployed and confirmed current.

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
