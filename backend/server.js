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

// Repair intake: creates the customer, instrument, and repair together in a
// single transaction. Used by the "New Repair Intake" form, which only
// collects a new walk-in customer's info -- it has no customer/instrument
// picker, so it always creates fresh records rather than matching existing
// ones.
app.post("/api/repairs/intake", async (req, res) => {
  const {
    customerName,
    customerEmail,
    customerPhone,
    instrumentType,
    issueDescription,
    estimatedCost
  } = req.body;

  if (!customerName || !instrumentType || !issueDescription) {
    return res.status(400).json({ error: "customerName, instrumentType, and issueDescription are required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [customerResult] = await conn.query(
      "INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)",
      [customerName, customerEmail || null, customerPhone || null]
    );
    const customerId = customerResult.insertId;

    const [instrumentResult] = await conn.query(
      "INSERT INTO instruments (name, type, owner_customer_id) VALUES (?, ?, ?)",
      [instrumentType, instrumentType, customerId]
    );
    const instrumentId = instrumentResult.insertId;

    const [repairResult] = await conn.query(
      "INSERT INTO repairs (customer_id, instrument_id, title, notes, estimated_repair_cost, status, intake_date) VALUES (?, ?, ?, ?, ?, ?, CURDATE())",
      [customerId, instrumentId, `${instrumentType} Repair`, issueDescription, estimatedCost || null, "Received"]
    );

    await conn.commit();
    res.json({ id: repairResult.insertId, customer_id: customerId, instrument_id: instrumentId });
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
// optional -- payment_status defaults to Unpaid.
app.post("/api/invoices", async (req, res) => {
  try {
    const { repair_id, name, due_date, tax_rate, payment_status } = req.body;
    if (!repair_id) return res.status(400).json({ error: "repair_id is required" });
    const conn = await pool.getConnection();
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

// Hand any other GET request back to the React app (client-side routing fallback)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 API docs at http://localhost:${PORT}/api/health`);
});
