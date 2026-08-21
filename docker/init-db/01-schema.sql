-- Schema for the Lee Cooper Clarinet repair shop app.
--
-- NOTE: This wasn't in the repo anywhere, so it's reconstructed from the
-- exact columns backend/server.js queries and inserts. It's a reasonable
-- starting point, not a design decision I'm making for you -- review the
-- column types/lengths and add anything server.js doesn't touch yet
-- (e.g. real invoice line items) before you rely on it.
--
-- Runs automatically the first time the mariadb container starts against
-- an EMPTY data volume (docker-entrypoint-initdb.d behavior). If you've
-- already started the stack once, this won't re-run -- drop the
-- lcc_mariadb_data volume first, or apply it manually with:
--   docker exec -i lcc-mariadb mysql -u root -p repair_shop < 01-schema.sql

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS instruments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  serial_number VARCHAR(100),
  customer_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS repairs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT,
  instrument_id INT,
  issue_description TEXT,
  estimated_cost DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'Received',
  intake_date DATETIME,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repair_id INT,
  amount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);
