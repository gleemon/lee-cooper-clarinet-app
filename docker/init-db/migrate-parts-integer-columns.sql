-- One-off migration for an ALREADY-DEPLOYED database.
--
-- docker-entrypoint-initdb.d scripts (01-schema.sql, 02-seed-data.sql) only
-- run automatically the first time a mariadb container starts against an
-- EMPTY data volume, so an already-deployed database won't pick up the
-- quantity_in_stock/reorder_level/reorder_unit type change in 01-schema.sql
-- on its own. This brings a live database up to date without touching any
-- other columns or rows -- all existing values in these columns are whole
-- numbers already (e.g. 100.00, 10.00), so converting DECIMAL(10,2) to INT
-- is a lossless, non-destructive type change.
--
-- Run it once against the database, e.g.:
--   docker exec -i lcc-mariadb mariadb -u root -p'yourpassword' repair_shop < migrate-parts-integer-columns.sql
--
-- Safe to run more than once -- MODIFY is idempotent if already applied.

ALTER TABLE parts_inventory MODIFY quantity_in_stock INT;
ALTER TABLE parts_inventory MODIFY reorder_level INT;
ALTER TABLE parts_inventory MODIFY reorder_unit INT;
