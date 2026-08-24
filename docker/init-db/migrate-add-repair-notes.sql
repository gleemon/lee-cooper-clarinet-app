-- One-off migration for the ALREADY-DEPLOYED live database.
--
-- docker-entrypoint-initdb.d scripts (01-schema.sql, 02-seed-data.sql) only
-- run automatically the first time a mariadb container starts against an
-- EMPTY data volume. The live NUC deployment already has data in its volume,
-- so it never re-ran 01-schema.sql and is missing the new `repairs.notes`
-- column added for the Repair Intake form.
--
-- Run it once against the live database, e.g.:
--   docker exec -it lcc-mariadb mariadb -u root -p repair_shop
--   source /tmp/migrate-add-repair-notes.sql;
--
-- Safe to run only once; running it again will error with "duplicate column
-- name" (harmless -- it just means it's already applied).

ALTER TABLE repairs ADD COLUMN notes TEXT AFTER estimated_repair_cost;
