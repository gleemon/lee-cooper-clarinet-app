# Lee Cooper Clarinet — Repair Shop App

A repair-shop management app for Lee Cooper Clarinet: track customers,
instruments, and repair tickets, and generate printable PDF receipts and
invoices.

## Features

- Customer, instrument, and repair ticket tracking
- Repair detail view with labor/parts billing breakdown
- PDF repair receipts and itemized invoices (labor + parts + tax)
- Invoice list with per-invoice PDF download

## Tech stack

- **Backend**: Node.js / Express (ES modules)
- **Frontend**: React + Vite, served statically by the Express app
- **Database**: MariaDB 11
- **PDF generation**: [pdfkit](https://pdfkit.org/)
- **Deployment**: Docker Compose, managed via Portainer as a Git-repository
  stack

## Getting started (local development)

Requires Node.js and a running MariaDB instance (or use the Docker Compose
setup below to provide one).

```bash
npm install
cp .env.example backend/.env   # fill in real DB credentials
npm run dev                    # runs backend + frontend concurrently
```

- Backend: http://localhost:5000
- Frontend (Vite dev server): http://localhost:3000, proxies `/api` to the
  backend

## Running with Docker Compose

```bash
docker compose up -d --build
```

This starts two services:
- `mariadb` — MariaDB 11, seeded on first run from `docker/init-db/`
- `app` — backend + built frontend, served on port 5000

Set `REPAIR_DB_ROOT_PASSWORD` and `REPAIR_DB_PASSWORD` in your environment
(or a Portainer stack env file) before starting — see `docker-compose.yml`.
Never commit real credentials to this repo.

## Database schema

11 tables — `customers`, `technicians`, `parts_vendors`, `instruments`,
`parts_inventory`, `repairs`, `invoices`, `work_log`, `parts_used`,
`repair_tags`, `receipts`. Schema and seed data live in
`docker/init-db/01-schema.sql` and `docker/init-db/02-seed-data.sql`, which
run automatically the first time the `mariadb` container starts against an
empty data volume.

`docker/init-db/migrate-auto-increment.sql` is a one-off script for bringing
an already-deployed database (with existing data) up to date with the
`AUTO_INCREMENT` schema — see the comments in that file for usage.

## Backend API

- `GET /api/health`
- `GET /api/customers`, `POST /api/customers`
- `GET /api/repairs`, `POST /api/repairs`, `GET /api/repairs/:id`
- `GET /api/repairs/:id/receipt.pdf`
- `GET /api/invoices`, `POST /api/invoices`, `GET /api/invoices/:id`
- `GET /api/invoices/:id/pdf`

## Project structure

```
backend/    Express API, billing logic, PDF generation
frontend/   React + Vite frontend
docker/     Dockerfile and database init/migration scripts
```

## License

MIT — see [LICENSE](LICENSE).
