import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
    const { name, email, phone, address } = req.body;
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      "INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)",
      [name, email, phone, address]
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
    const { customer_id, instrument_id, issue_description, estimated_cost } = req.body;
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      "INSERT INTO repairs (customer_id, instrument_id, issue_description, estimated_cost, status, intake_date) VALUES (?, ?, ?, ?, ?, NOW())",
      [customer_id, instrument_id, issue_description, estimated_cost, "Received"]
    );
    conn.release();
    res.json({ id: result.insertId, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invoices
app.get("/api/invoices/:repair_id", async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT * FROM invoices WHERE repair_id = ?",
      [req.params.repair_id]
    );
    conn.release();
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 API docs at http://localhost:${PORT}/api/health`);
});
