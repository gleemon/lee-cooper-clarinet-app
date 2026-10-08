-- v2.0: private lessons. One-off migration for an ALREADY-DEPLOYED database.
--
-- Lives in docker/migrations/ -- NOT docker/init-db/ -- on purpose: every
-- .sql file in init-db/ runs on a fresh volume, and 01-schema.sql already
-- creates all of this there. (See "Code review findings" item 1 in
-- PROJECT_STATUS.md for what happens when a migration is left in init-db/.)
-- It's also written to be idempotent, so running it twice is harmless.
--
-- Run it against the live database, e.g.:
--   docker exec -it lcc-mariadb mariadb -u root -p repair_shop
--   source /tmp/lessons-migration.sql;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_student BOOLEAN NOT NULL DEFAULT FALSE AFTER notes;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lesson_rate DECIMAL(10,2) AFTER is_student;

CREATE TABLE IF NOT EXISTS lessons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT,
  lesson_date DATE NOT NULL,
  duration_minutes INT,
  amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_date DATE,
  transaction_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);
