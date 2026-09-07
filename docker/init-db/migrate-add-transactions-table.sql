-- One-off migration for the ALREADY-DEPLOYED live database.
--
-- docker-entrypoint-initdb.d scripts (01-schema.sql, 02-seed-data.sql) only
-- run automatically the first time a mariadb container starts against an
-- EMPTY data volume, so an already-deployed database won't pick up the new
-- `transactions` table (V1 of the accounting system -- see PROJECT_STATUS.md
-- "Planned: Accounting system") on its own.
--
-- Run it once against the live database, e.g.:
--   docker exec -it lcc-mariadb mariadb -u root -p repair_shop
--   source /tmp/migrate-add-transactions-table.sql;
--
-- Safe to run more than once -- CREATE TABLE IF NOT EXISTS is a no-op if
-- already applied.

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payee VARCHAR(255),
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
