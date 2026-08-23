-- One-off migration for the ALREADY-DEPLOYED live database.
--
-- docker-entrypoint-initdb.d scripts (01-schema.sql, 02-seed-data.sql) only
-- run automatically the first time a mariadb container starts against an
-- EMPTY data volume. The live NUC deployment already has data in its volume,
-- so it never re-ran those files and its `id` columns are still plain
-- `INT PRIMARY KEY` (no AUTO_INCREMENT). This script brings a live database
-- up to date without touching any existing rows.
--
-- Run it once against the live database, e.g.:
--   docker exec -i lcc-mariadb mariadb -u root -p'yourpassword' repair_shop < migrate-auto-increment.sql
--
-- Safe to run only once. Running it again is harmless (MODIFY/ALTER are
-- idempotent no-ops if already applied) but there's no need to repeat it.

ALTER TABLE customers MODIFY id INT AUTO_INCREMENT;
ALTER TABLE technicians MODIFY id INT AUTO_INCREMENT;
ALTER TABLE parts_vendors MODIFY id INT AUTO_INCREMENT;
ALTER TABLE instruments MODIFY id INT AUTO_INCREMENT;
ALTER TABLE parts_inventory MODIFY id INT AUTO_INCREMENT;
ALTER TABLE repairs MODIFY id INT AUTO_INCREMENT;
ALTER TABLE invoices MODIFY id INT AUTO_INCREMENT;

-- Set each counter to start past whatever the highest existing id is, so the
-- very next insert can't collide with migrated Notion rows. MariaDB's ALTER
-- TABLE ... AUTO_INCREMENT = N requires a literal, so this computes N with a
-- tiny bit of dynamic SQL rather than hardcoding it -- safe to run even if
-- you've added a few rows by hand since the migration.
SET @next_customers = (SELECT COALESCE(MAX(id), 0) + 1 FROM customers);
SET @next_technicians = (SELECT COALESCE(MAX(id), 0) + 1 FROM technicians);
SET @next_parts_vendors = (SELECT COALESCE(MAX(id), 0) + 1 FROM parts_vendors);
SET @next_instruments = (SELECT COALESCE(MAX(id), 0) + 1 FROM instruments);
SET @next_parts_inventory = (SELECT COALESCE(MAX(id), 0) + 1 FROM parts_inventory);
SET @next_repairs = (SELECT COALESCE(MAX(id), 0) + 1 FROM repairs);
SET @next_invoices = (SELECT COALESCE(MAX(id), 0) + 1 FROM invoices);

SET @sql = CONCAT('ALTER TABLE customers AUTO_INCREMENT = ', @next_customers);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('ALTER TABLE technicians AUTO_INCREMENT = ', @next_technicians);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('ALTER TABLE parts_vendors AUTO_INCREMENT = ', @next_parts_vendors);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('ALTER TABLE instruments AUTO_INCREMENT = ', @next_instruments);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('ALTER TABLE parts_inventory AUTO_INCREMENT = ', @next_parts_inventory);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('ALTER TABLE repairs AUTO_INCREMENT = ', @next_repairs);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = CONCAT('ALTER TABLE invoices AUTO_INCREMENT = ', @next_invoices);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
