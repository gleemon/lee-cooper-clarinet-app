-- Schema for the Lee Cooper Clarinet repair shop app.
--
-- REPLACES the earlier 4-table draft schema. That draft was reconstructed
-- purely by guessing from backend/server.js's queries. This version instead
-- mirrors the actual Notion "Musical Instrument Repair" workspace structure
-- (Customers, Instruments, Technician, Parts Vendors, Parts Inventory,
-- Repairs, Invoices, Work Log, Parts Used, Repair Tags, Receipts), which is
-- the real source of truth for how the shop's data is organized. It's paired
-- with 02-seed-data.sql, which migrates the actual records out of Notion.
--
-- backend/server.js currently only reads/writes customers, repairs, and
-- invoices -- it doesn't yet know about instruments, technicians, parts, work
-- log, tags, or receipts as separate tables. Those routes/endpoints are a
-- follow-up, not part of this migration.
--
-- Runs automatically the first time the mariadb container starts against an
-- empty data volume (docker-entrypoint-initdb.d behavior), in filename order
-- (01-schema.sql, then 02-seed-data.sql).

CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notion_url VARCHAR(64) UNIQUE,          -- Notion page id, kept for traceability back to the source
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(10),
  zip VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE technicians (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notion_url VARCHAR(64) UNIQUE,
  name VARCHAR(255) NOT NULL,
  hourly_rate VARCHAR(50),                -- stored as text in Notion; consider NUMERIC once cleaned up
  specialty VARCHAR(255),
  availability VARCHAR(50)
);

CREATE TABLE parts_vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notion_url VARCHAR(64) UNIQUE,
  name VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  street VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(10),
  zip VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(255),
  account_number VARCHAR(100),
  notes TEXT
);

CREATE TABLE instruments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notion_url VARCHAR(64) UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),                      -- e.g. Bb Clarinet, A Clarinet, Bass Clarinet
  make VARCHAR(100),
  model VARCHAR(100),
  serial VARCHAR(100),
  purchase_date DATE,
  purchase_cost DECIMAL(10,2),
  valuation DECIMAL(10,2),
  owner_customer_id INT,
  FOREIGN KEY (owner_customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE parts_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notion_url VARCHAR(64) UNIQUE,
  part_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),                  -- Pads, Supplies, Cork, Mouthpiece Patch, ...
  quantity_in_stock DECIMAL(10,2),
  reorder_level DECIMAL(10,2),
  reorder_cost DECIMAL(10,2),
  reorder_unit DECIMAL(10,2),
  reorder_url VARCHAR(500),
  markup DECIMAL(6,2),
  vendor_id INT,
  FOREIGN KEY (vendor_id) REFERENCES parts_vendors(id) ON DELETE SET NULL
);

CREATE TABLE repairs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notion_url VARCHAR(64) UNIQUE,
  notion_repair_number INT,               -- the human-facing "Repair ID" ticket number from Notion
  title VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Received',  -- Received, Diagnosis, In Progress, Ready for Pickup, Parts Ordered, Complete, Archive
  customer_id INT,
  instrument_id INT,
  technician_id INT,
  intake_date DATE,
  estimated_completion DATE,
  completion_date DATE,
  estimated_repair_cost DECIMAL(10,2),
  notes TEXT,                             -- customer-reported issue description from intake
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE SET NULL,
  FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE SET NULL
);

CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notion_url VARCHAR(64) UNIQUE,
  notion_invoice_number INT,              -- the human-facing "Invoice ID" from Notion
  name VARCHAR(255),
  repair_id INT,
  invoice_date DATE,
  due_date DATE,
  payment_status VARCHAR(50),             -- Unpaid, Paid, Overdue
  tax_rate DECIMAL(6,4),
  FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE SET NULL
);

CREATE TABLE work_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notion_url VARCHAR(64) UNIQUE,
  label VARCHAR(255),                     -- Notion's "Work Log ID" title field, e.g. "Labor Cost", "Repad - Upper"
  repair_id INT,
  technician_id INT,
  start_work DATETIME,
  end_work DATE,
  time_on_repair DECIMAL(6,2),            -- hours
  billable BOOLEAN,
  FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE SET NULL,
  FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE SET NULL
);

CREATE TABLE parts_used (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notion_url VARCHAR(64) UNIQUE,
  label VARCHAR(255),
  part_id INT,
  repair_id INT,
  quantity_used DECIMAL(10,2),
  customer_cost DECIMAL(10,2),
  date_used DATE,
  FOREIGN KEY (part_id) REFERENCES parts_inventory(id) ON DELETE SET NULL,
  FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE SET NULL
);

CREATE TABLE repair_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notion_url VARCHAR(64) UNIQUE,
  tag_title VARCHAR(255),
  repair_id INT,
  FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE SET NULL
);

CREATE TABLE receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notion_url VARCHAR(64) UNIQUE,
  receipt_title VARCHAR(255),
  repair_id INT,
  FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE SET NULL
);
