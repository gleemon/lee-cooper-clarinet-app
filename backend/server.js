import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import { getRepairBillingDetails } from "./services/billing.js";
import { renderReceiptPdf } from "./pdf/receiptPdf.js";
import { renderInvoicePdf } from "./pdf/invoicePdf.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve the built React frontend (copied into backend/public by the Docker build)
app.use(express.static(path.join(__dirname, "public")));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "repair_shop",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
pool.getConnection().then(conn => {
  console.log("✅ Database connected");
  conn.release();
}).catch(err => {
  console.error("❌ Database connection error:", err);
});

// Routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Customers
app.get("/api/customers", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query("SELECT * FROM customers ORDER BY name ASC");
    conn.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const { name, email, phone, address_line1, address_line2, city, state, zip, notes } = req.body;
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      "INSERT INTO customers (name, email, phone, address_line1, address_line2, city, state, zip, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [name, email, phone, address_line1, address_line2, city, state, zip, notes]
    );
    conn.release();
    res.json({ id: result.insertId, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single customer -- used by the customer edit page.
app.get("/api/customers/:id", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query("SELECT * FROM customers WHERE id = ?", [req.params.id]);
    conn.release();
    if (!rows[0]) return res.status(404).json({ error: "Customer not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an existing customer's record. Used by the customer edit page.
app.put("/api/customers/:id", async (req, res) => {
  try {
    const { name, email, phone, address_line1, address_line2, city, state, zip, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      `UPDATE customers SET
         name = ?, email = ?, phone = ?, address_line1 = ?, address_line2 = ?,
         city = ?, state = ?, zip = ?, notes = ?
       WHERE id = ?`,
      [name, email || null, phone || null, address_line1 || null, address_line2 || null, city || null, state || null, zip || null, notes || null, req.params.id]
    );
    if (result.affectedRows === 0) {
      conn.release();
      return res.status(404).json({ error: "Customer not found" });
    }
    const [rows] = await conn.query("SELECT * FROM customers WHERE id = ?", [req.params.id]);
    conn.release();
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Technicians -- used by the work log form's technician picker.
app.get("/api/technicians", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query("SELECT * FROM technicians ORDER BY name ASC");
    conn.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All instruments in the shop's records, regardless of owner -- used by the
// intake form's instrument picker. A repair's customer and instrument don't
// have to match the same person (shop-owned instruments, loaners, repairs
// dropped off by a family member), so this isn't scoped to one customer.
app.get("/api/instruments", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT i.*, c.name AS owner_name FROM instruments i LEFT JOIN customers c ON i.owner_customer_id = c.id ORDER BY i.name ASC"
    );
    conn.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single instrument, joined with owner name -- used by the instrument edit page.
app.get("/api/instruments/:id", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT i.*, c.name AS owner_name FROM instruments i LEFT JOIN customers c ON i.owner_customer_id = c.id WHERE i.id = ?",
      [req.params.id]
    );
    conn.release();
    if (!rows[0]) return res.status(404).json({ error: "Instrument not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an existing instrument's record. Used by the instrument edit page.
// ownerCustomerId may be omitted/empty to unset the owner (e.g. shop-use
// instruments).
app.put("/api/instruments/:id", async (req, res) => {
  try {
    const { name, type, make, model, serial, purchaseDate, purchaseCost, valuation, ownerCustomerId } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      `UPDATE instruments SET
         name = ?, type = ?, make = ?, model = ?, serial = ?,
         purchase_date = ?, purchase_cost = ?, valuation = ?, owner_customer_id = ?
       WHERE id = ?`,
      [
        name,
        type || null,
        make || null,
        model || null,
        serial || null,
        purchaseDate || null,
        purchaseCost || null,
        valuation || null,
        ownerCustomerId || null,
        req.params.id
      ]
    );
    if (result.affectedRows === 0) {
      conn.release();
      return res.status(404).json({ error: "Instrument not found" });
    }
    const [rows] = await conn.query(
      "SELECT i.*, c.name AS owner_name FROM instruments i LEFT JOIN customers c ON i.owner_customer_id = c.id WHERE i.id = ?",
      [req.params.id]
    );
    conn.release();
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Repairs (main endpoint)
app.get("/api/repairs", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT r.*, c.name as customer_name, i.name as instrument_name FROM repairs r LEFT JOIN customers c ON r.customer_id = c.id LEFT JOIN instruments i ON r.instrument_id = i.id ORDER BY r.intake_date DESC"
    );
    conn.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/repairs", async (req, res) => {
  try {
    const { customer_id, instrument_id, technician_id, title, estimated_repair_cost, estimated_completion } = req.body;
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      "INSERT INTO repairs (customer_id, instrument_id, technician_id, title, estimated_repair_cost, estimated_completion, status, intake_date) VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())",
      [customer_id, instrument_id, technician_id || null, title, estimated_repair_cost || null, estimated_completion || null, "Received"]
    );
    conn.release();
    res.json({ id: result.insertId, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Repair intake: creates the repair, and the customer and/or instrument too
// if they don't already exist, all in a single transaction. Used by the
// "New Repair Intake" form, which lets the front desk either pick an
// existing customer/instrument (repeat visits) or fall back to creating
// new records (first-time walk-ins).
app.post("/api/repairs/intake", async (req, res) => {
  const {
    customerId,
    customerName,
    customerEmail,
    customerPhone,
    instrumentId,
    instrumentType,
    instrumentMake,
    instrumentModel,
    instrumentSerial,
    instrumentPurchaseDate,
    instrumentPurchaseCost,
    instrumentValuation,
    issueDescription,
    estimatedCost
  } = req.body;

  if (!customerId && !customerName) {
    return res.status(400).json({ error: "customerId or customerName is required" });
  }
  if (!instrumentId && !instrumentType) {
    return res.status(400).json({ error: "instrumentId or instrumentType is required" });
  }
  if (!issueDescription) {
    return res.status(400).json({ error: "issueDescription is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId) {
      const [customerResult] = await conn.query(
        "INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)",
        [customerName, customerEmail || null, customerPhone || null]
      );
      resolvedCustomerId = customerResult.insertId;
    }

    let resolvedInstrumentId = instrumentId;
    if (!resolvedInstrumentId) {
      const instrumentName = instrumentMake || instrumentModel
        ? [instrumentMake, instrumentModel].filter(Boolean).join(" ")
        : instrumentType;
      const [instrumentResult] = await conn.query(
        "INSERT INTO instruments (name, type, make, model, serial, purchase_date, purchase_cost, valuation, owner_customer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          instrumentName,
          instrumentType,
          instrumentMake || null,
          instrumentModel || null,
          instrumentSerial || null,
          instrumentPurchaseDate || null,
          instrumentPurchaseCost || null,
          instrumentValuation || null,
          resolvedCustomerId
        ]
      );
      resolvedInstrumentId = instrumentResult.insertId;
    }

    const [instrumentRows] = await conn.query(
      "SELECT name FROM instruments WHERE id = ?",
      [resolvedInstrumentId]
    );
    const instrumentName = instrumentRows[0]?.name || "Instrument";

    const [repairResult] = await conn.query(
      "INSERT INTO repairs (customer_id, instrument_id, title, notes, estimated_repair_cost, status, intake_date) VALUES (?, ?, ?, ?, ?, ?, CURDATE())",
      [resolvedCustomerId, resolvedInstrumentId, `${instrumentName} Repair`, issueDescription, estimatedCost || null, "Received"]
    );

    await conn.commit();
    res.json({ id: repairResult.insertId, customer_id: resolvedCustomerId, instrument_id: resolvedInstrumentId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Single repair, with customer/instrument/technician joined in -- used by the
// repair detail view and as the basis for the receipt PDF.
app.get("/api/repairs/:id", async (req, res) => {
  try {
    const details = await getRepairBillingDetails(pool, req.params.id);
    if (!details) return res.status(404).json({ error: "Repair not found" });
    res.json({
      ...details.repair,
      laborCost: details.laborCost,
      partsCost: details.partsCost,
      subtotal: details.subtotal,
      workLog: details.workLogRows,
      partsUsed: details.partsRows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The full set of statuses a repair can have (see docker/init-db/01-schema.sql).
const REPAIR_STATUSES = [
  "Received",
  "Diagnosis",
  "In Progress",
  "Hold - Parts",
  "Hold - Customer",
  "Ready for Pickup",
  "Complete",
  "Archive"
];

// Update a repair's status. Setting it to "Complete" also stamps
// completion_date with today's date if it isn't already set -- the column
// existed in the schema but nothing in the app ever populated it before.
app.put("/api/repairs/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!REPAIR_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${REPAIR_STATUSES.join(", ")}` });
    }
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      `UPDATE repairs SET status = ?, completion_date = CASE
         WHEN ? = 'Complete' AND completion_date IS NULL THEN CURDATE()
         ELSE completion_date
       END WHERE id = ?`,
      [status, status, req.params.id]
    );
    if (result.affectedRows === 0) {
      conn.release();
      return res.status(404).json({ error: "Repair not found" });
    }
    const [rows] = await conn.query("SELECT * FROM repairs WHERE id = ?", [req.params.id]);
    conn.release();
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log work (hours) against a repair. billable defaults to true -- only
// billable entries count toward laborCost (see billing.js). technicianId
// is optional (some historical entries have none), but billing can't
// compute a rate without one.
app.post("/api/repairs/:id/work-log", async (req, res) => {
  try {
    const { technicianId, label, hours, billable, date } = req.body;
    const hoursNum = parseFloat(hours);
    if (!hoursNum || hoursNum <= 0) {
      return res.status(400).json({ error: "hours must be a positive number" });
    }
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      "INSERT INTO work_log (repair_id, technician_id, label, start_work, time_on_repair, billable) VALUES (?, ?, ?, ?, ?, ?)",
      [req.params.id, technicianId || null, label || null, date || null, hoursNum, billable === false ? 0 : 1]
    );
    conn.release();
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log a part used on a repair, and decrement its quantity_in_stock
// accordingly. quantity_in_stock is deliberately allowed to go negative
// (see docker/init-db/01-schema.sql) -- using more of a part than is on
// hand just shows up as a shortfall rather than being blocked.
app.post("/api/repairs/:id/parts-used", async (req, res) => {
  const { partId, label, quantityUsed, customerCost, date } = req.body;
  const qtyNum = parseFloat(quantityUsed);
  if (!qtyNum || qtyNum <= 0) {
    return res.status(400).json({ error: "quantityUsed must be a positive number" });
  }
  if (isNegative(customerCost)) {
    return res.status(400).json({ error: "customerCost must be positive" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      "INSERT INTO parts_used (repair_id, part_id, label, quantity_used, customer_cost, date_used) VALUES (?, ?, ?, ?, ?, ?)",
      [req.params.id, partId || null, label || null, qtyNum, customerCost || null, date || null]
    );

    if (partId) {
      await conn.query(
        "UPDATE parts_inventory SET quantity_in_stock = COALESCE(quantity_in_stock, 0) - ? WHERE id = ?",
        [Math.round(qtyNum), partId]
      );
    }

    await conn.commit();
    res.json({ id: result.insertId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Update an existing work log entry.
app.put("/api/work-log/:id", async (req, res) => {
  try {
    const { technicianId, label, hours, billable, date } = req.body;
    const hoursNum = parseFloat(hours);
    if (!hoursNum || hoursNum <= 0) {
      return res.status(400).json({ error: "hours must be a positive number" });
    }
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      "UPDATE work_log SET technician_id = ?, label = ?, start_work = ?, time_on_repair = ?, billable = ? WHERE id = ?",
      [technicianId || null, label || null, date || null, hoursNum, billable === false ? 0 : 1, req.params.id]
    );
    conn.release();
    if (result.affectedRows === 0) return res.status(404).json({ error: "Work log entry not found" });
    res.json({ id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an existing parts-used entry. Reconciles quantity_in_stock for
// both the old and new part -- restores whatever the old entry consumed,
// then decrements whatever the updated entry consumes, so edits (changing
// quantity, or even swapping which part was used) keep inventory accurate
// rather than double-counting.
app.put("/api/parts-used/:id", async (req, res) => {
  const { partId, label, quantityUsed, customerCost, date } = req.body;
  const qtyNum = parseFloat(quantityUsed);
  if (!qtyNum || qtyNum <= 0) {
    return res.status(400).json({ error: "quantityUsed must be a positive number" });
  }
  if (isNegative(customerCost)) {
    return res.status(400).json({ error: "customerCost must be positive" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existingRows] = await conn.query(
      "SELECT part_id, quantity_used FROM parts_used WHERE id = ?",
      [req.params.id]
    );
    if (!existingRows[0]) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: "Parts-used entry not found" });
    }
    const existing = existingRows[0];

    if (existing.part_id) {
      await conn.query(
        "UPDATE parts_inventory SET quantity_in_stock = COALESCE(quantity_in_stock, 0) + ? WHERE id = ?",
        [Math.round(parseFloat(existing.quantity_used)), existing.part_id]
      );
    }

    await conn.query(
      "UPDATE parts_used SET part_id = ?, label = ?, quantity_used = ?, customer_cost = ?, date_used = ? WHERE id = ?",
      [partId || null, label || null, qtyNum, customerCost || null, date || null, req.params.id]
    );

    if (partId) {
      await conn.query(
        "UPDATE parts_inventory SET quantity_in_stock = COALESCE(quantity_in_stock, 0) - ? WHERE id = ?",
        [Math.round(qtyNum), partId]
      );
    }

    await conn.commit();
    res.json({ id: req.params.id });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// "Repair Estimate & Receipt" PDF -- the intake-time document.
app.get("/api/repairs/:id/receipt.pdf", async (req, res) => {
  try {
    const details = await getRepairBillingDetails(pool, req.params.id);
    if (!details) return res.status(404).json({ error: "Repair not found" });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="receipt-${details.repair.notion_repair_number ?? details.repair.id}.pdf"`
    );
    doc.pipe(res);
    renderReceiptPdf(doc, details.repair);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invoices
app.get("/api/invoices", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT inv.*, r.title AS repair_title, r.notion_repair_number, r.status AS repair_status,
              c.name AS customer_name
       FROM invoices inv
       LEFT JOIN repairs r ON inv.repair_id = r.id
       LEFT JOIN customers c ON r.customer_id = c.id
       ORDER BY inv.invoice_date DESC, inv.id DESC`
    );
    conn.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/invoices/:id", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query("SELECT * FROM invoices WHERE id = ?", [req.params.id]);
    conn.release();
    if (!rows[0]) return res.status(404).json({ error: "Invoice not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create an invoice for a repair. due_date/tax_rate/payment_status are
// optional -- payment_status defaults to Unpaid. Idempotent: a repair
// can only have one invoice, so if one already exists for repair_id,
// it's returned as-is instead of creating a duplicate (previously,
// clicking "Create Invoice" more than once created a separate invoice
// row each time).
app.post("/api/invoices", async (req, res) => {
  try {
    const { repair_id, name, due_date, tax_rate, payment_status } = req.body;
    if (!repair_id) return res.status(400).json({ error: "repair_id is required" });
    const conn = await pool.getConnection();

    const [existingRows] = await conn.query("SELECT * FROM invoices WHERE repair_id = ?", [repair_id]);
    if (existingRows[0]) {
      conn.release();
      return res.json(existingRows[0]);
    }

    const [result] = await conn.query(
      "INSERT INTO invoices (name, repair_id, invoice_date, due_date, payment_status, tax_rate) VALUES (?, ?, CURDATE(), ?, ?, ?)",
      [name || null, repair_id, due_date || null, payment_status || "Unpaid", tax_rate || null]
    );
    conn.release();
    res.json({ id: result.insertId, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an existing invoice's editable fields.
app.put("/api/invoices/:id", async (req, res) => {
  try {
    const { name, due_date, tax_rate, payment_status } = req.body;
    if (isNegative(tax_rate)) {
      return res.status(400).json({ error: "tax_rate must be positive" });
    }
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      "UPDATE invoices SET name = ?, due_date = ?, tax_rate = ?, payment_status = ? WHERE id = ?",
      [name || null, due_date || null, tax_rate || null, payment_status || "Unpaid", req.params.id]
    );
    if (result.affectedRows === 0) {
      conn.release();
      return res.status(404).json({ error: "Invoice not found" });
    }
    const [rows] = await conn.query("SELECT * FROM invoices WHERE id = ?", [req.params.id]);
    conn.release();
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Itemized invoice PDF.
app.get("/api/invoices/:id/pdf", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [invRows] = await conn.query("SELECT * FROM invoices WHERE id = ?", [req.params.id]);
    conn.release();
    const invoice = invRows[0];
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const details = await getRepairBillingDetails(pool, invoice.repair_id);
    if (!details) return res.status(404).json({ error: "Repair for this invoice not found" });

    const taxRate = parseFloat(invoice.tax_rate) || 0;
    const tax = details.subtotal * taxRate;
    const total = details.subtotal + tax;

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="invoice-${invoice.notion_invoice_number ?? invoice.id}.pdf"`
    );
    doc.pipe(res);
    renderInvoicePdf(doc, {
      invoice,
      repair: details.repair,
      workLogRows: details.workLogRows,
      partsRows: details.partsRows,
      laborCost: details.laborCost,
      partsCost: details.partsCost,
      subtotal: details.subtotal,
      tax,
      total,
    });
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Parts are counted in whole units -- quantity_in_stock, reorder_level, and
// reorder_unit are all INT columns, so round anything the client sends
// rather than trusting it to already be a whole number.
function toIntOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Math.round(Number(value));
  return Number.isNaN(n) ? null : n;
}

// reorder_level, reorder_cost, and reorder_unit must be positive --
// unlike quantity_in_stock, which is allowed to go negative (backorders).
function isNegative(value) {
  if (value === "" || value === null || value === undefined) return false;
  const n = Number(value);
  return !Number.isNaN(n) && n < 0;
}

// Parts vendors -- used by the "Receive Parts" form's vendor picker.
app.get("/api/vendors", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query("SELECT * FROM parts_vendors ORDER BY name ASC");
    conn.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Parts inventory, joined with vendor name.
app.get("/api/parts", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT p.*, v.name AS vendor_name FROM parts_inventory p LEFT JOIN parts_vendors v ON p.vendor_id = v.id ORDER BY p.part_name ASC"
    );
    conn.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single part, joined with vendor name -- used by the part edit page.
app.get("/api/parts/:id", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT p.*, v.name AS vendor_name FROM parts_inventory p LEFT JOIN parts_vendors v ON p.vendor_id = v.id WHERE p.id = ?",
      [req.params.id]
    );
    conn.release();
    if (!rows[0]) return res.status(404).json({ error: "Part not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an existing part's record (and its vendor too, if it doesn't
// already exist). Used by the part edit page -- unlike POST /receive,
// this replaces quantity_in_stock rather than adding to it.
app.put("/api/parts/:id", async (req, res) => {
  const {
    partName,
    description,
    category,
    quantityInStock,
    reorderLevel,
    reorderCost,
    reorderUnit,
    reorderUrl,
    markup,
    vendorId,
    vendorName
  } = req.body;

  if (!partName) {
    return res.status(400).json({ error: "partName is required" });
  }
  if (isNegative(reorderLevel) || isNegative(reorderCost) || isNegative(reorderUnit)) {
    return res.status(400).json({ error: "reorderLevel, reorderCost, and reorderUnit must be positive" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let resolvedVendorId = vendorId || null;
    if (!resolvedVendorId && vendorName) {
      const [vendorResult] = await conn.query(
        "INSERT INTO parts_vendors (name) VALUES (?)",
        [vendorName]
      );
      resolvedVendorId = vendorResult.insertId;
    }

    const [result] = await conn.query(
      `UPDATE parts_inventory SET
         part_name = ?, description = ?, category = ?, quantity_in_stock = ?,
         reorder_level = ?, reorder_cost = ?, reorder_unit = ?, reorder_url = ?,
         markup = ?, vendor_id = ?
       WHERE id = ?`,
      [
        partName,
        description || null,
        category || null,
        toIntOrNull(quantityInStock),
        toIntOrNull(reorderLevel),
        reorderCost || null,
        toIntOrNull(reorderUnit),
        reorderUrl || null,
        markup || null,
        resolvedVendorId,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Part not found" });
    }

    await conn.commit();
    const [rows] = await conn.query(
      "SELECT p.*, v.name AS vendor_name FROM parts_inventory p LEFT JOIN parts_vendors v ON p.vendor_id = v.id WHERE p.id = ?",
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Create a new part record (and its vendor too, if it doesn't already
// exist). Used by the "Receive Parts" form when the part being received
// isn't in inventory yet.
app.post("/api/parts", async (req, res) => {
  const {
    partName,
    description,
    category,
    quantityInStock,
    reorderLevel,
    reorderCost,
    reorderUnit,
    reorderUrl,
    markup,
    vendorId,
    vendorName
  } = req.body;

  if (!partName) {
    return res.status(400).json({ error: "partName is required" });
  }
  if (isNegative(reorderLevel) || isNegative(reorderCost) || isNegative(reorderUnit)) {
    return res.status(400).json({ error: "reorderLevel, reorderCost, and reorderUnit must be positive" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let resolvedVendorId = vendorId || null;
    if (!resolvedVendorId && vendorName) {
      const [vendorResult] = await conn.query(
        "INSERT INTO parts_vendors (name) VALUES (?)",
        [vendorName]
      );
      resolvedVendorId = vendorResult.insertId;
    }

    const [result] = await conn.query(
      "INSERT INTO parts_inventory (part_name, description, category, quantity_in_stock, reorder_level, reorder_cost, reorder_unit, reorder_url, markup, vendor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        partName,
        description || null,
        category || null,
        toIntOrNull(quantityInStock) ?? 0,
        toIntOrNull(reorderLevel),
        reorderCost || null,
        toIntOrNull(reorderUnit),
        reorderUrl || null,
        markup || null,
        resolvedVendorId
      ]
    );

    await conn.commit();
    const [rows] = await conn.query(
      "SELECT p.*, v.name AS vendor_name FROM parts_inventory p LEFT JOIN parts_vendors v ON p.vendor_id = v.id WHERE p.id = ?",
      [result.insertId]
    );
    res.json(rows[0]);
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Record a shipment of an existing part arriving -- adds to
// quantity_in_stock rather than replacing it, so repeated receipts
// accumulate correctly.
app.post("/api/parts/:id/receive", async (req, res) => {
  try {
    const qty = Math.round(Number(req.body.quantityReceived));
    if (!qty || qty <= 0) {
      return res.status(400).json({ error: "quantityReceived must be a positive number" });
    }
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      "UPDATE parts_inventory SET quantity_in_stock = COALESCE(quantity_in_stock, 0) + ? WHERE id = ?",
      [qty, req.params.id]
    );
    if (result.affectedRows === 0) {
      conn.release();
      return res.status(404).json({ error: "Part not found" });
    }
    const [rows] = await conn.query(
      "SELECT p.*, v.name AS vendor_name FROM parts_inventory p LEFT JOIN parts_vendors v ON p.vendor_id = v.id WHERE p.id = ?",
      [req.params.id]
    );
    conn.release();
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hand any other GET request back to the React app (client-side routing fallback)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 API docs at http://localhost:${PORT}/api/health`);
});
