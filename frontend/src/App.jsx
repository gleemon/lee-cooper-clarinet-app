import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

// Same-origin by default: the frontend is served by the same Express app
// that serves the API, so relative paths always hit the right host:port
// regardless of whether you access it as dockernuc.local, an IP, etc.
// Set VITE_API_URL only if the frontend is ever served from a different
// origin than the backend.
const API_URL = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [repairs, setRepairs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRepairId, setSelectedRepairId] = useState(null);

  // Fetch repairs
  useEffect(() => {
    if (currentPage === "repairs") {
      fetchRepairs();
    }
  }, [currentPage]);

  const fetchRepairs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/repairs`);
      setRepairs(res.data);
    } catch (err) {
      console.error("Error fetching repairs:", err);
    }
    setLoading(false);
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/customers`);
      setCustomers(res.data);
    } catch (err) {
      console.error("Error fetching customers:", err);
    }
    setLoading(false);
  };

  const viewRepair = (id) => {
    setSelectedRepairId(id);
    setCurrentPage("repairDetail");
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🎵 Lee Cooper Clarinet</h1>
          <p className="tagline">Repair Management System</p>
        </div>
      </header>

      <nav className="navbar">
        <button 
          className={`nav-btn ${currentPage === "home" ? "active" : ""}`}
          onClick={() => setCurrentPage("home")}
        >
          Dashboard
        </button>
        <button 
          className={`nav-btn ${currentPage === "intake" ? "active" : ""}`}
          onClick={() => setCurrentPage("intake")}
        >
          New Repair
        </button>
        <button 
          className={`nav-btn ${currentPage === "repairs" ? "active" : ""}`}
          onClick={() => { setCurrentPage("repairs"); fetchRepairs(); }}
        >
          Active Repairs
        </button>
        <button 
          className={`nav-btn ${currentPage === "invoices" ? "active" : ""}`}
          onClick={() => setCurrentPage("invoices")}
        >
          Invoices
        </button>
      </nav>

      <main className="main-content">
        {currentPage === "home" && <HomePage />}
        {currentPage === "intake" && <IntakePage />}
        {currentPage === "repairs" && (
          <RepairsPage repairs={repairs} loading={loading} onView={viewRepair} />
        )}
        {currentPage === "repairDetail" && (
          <RepairDetailPage
            repairId={selectedRepairId}
            onBack={() => setCurrentPage("repairs")}
          />
        )}
        {currentPage === "invoices" && <InvoicesPage />}
      </main>

      <footer className="footer">
        <p>v{__APP_VERSION__}</p>
      </footer>
    </div>
  );
}

function HomePage() {
  return (
    <section className="page">
      <h2>Dashboard</h2>
      <div className="dashboard-grid">
        <div className="card">
          <h3>Quick Actions</h3>
          <button className="btn-primary">+ New Repair Intake</button>
        </div>
        <div className="card">
          <h3>Recent Repairs</h3>
          <p>View your active repairs in the "Active Repairs" tab.</p>
        </div>
      </div>
    </section>
  );
}

function IntakePage() {
  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    instrumentType: "",
    issueDescription: "",
    estimatedCost: ""
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Intake form submitted:", formData);
    alert("Repair intake created! (Backend integration coming)");
    setFormData({
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      instrumentType: "",
      issueDescription: "",
      estimatedCost: ""
    });
  };

  return (
    <section className="page">
      <h2>New Repair Intake</h2>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Customer Name *</label>
          <input 
            type="text" 
            name="customerName" 
            value={formData.customerName}
            onChange={handleChange}
            required 
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input 
            type="email" 
            name="customerEmail" 
            value={formData.customerEmail}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input 
            type="tel" 
            name="customerPhone" 
            value={formData.customerPhone}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <label>Instrument Type *</label>
          <select 
            name="instrumentType" 
            value={formData.instrumentType}
            onChange={handleChange}
            required
          >
            <option value="">Select...</option>
            <option value="Bb Clarinet">Bb Clarinet</option>
            <option value="A Clarinet">A Clarinet</option>
            <option value="Bass Clarinet">Bass Clarinet</option>
            <option value="Alto Clarinet">Alto Clarinet</option>
          </select>
        </div>
        <div className="form-group">
          <label>Issue Description *</label>
          <textarea 
            name="issueDescription" 
            value={formData.issueDescription}
            onChange={handleChange}
            rows="4"
            required
          ></textarea>
        </div>
        <div className="form-group">
          <label>Estimated Cost</label>
          <input 
            type="number" 
            name="estimatedCost" 
            value={formData.estimatedCost}
            onChange={handleChange}
            step="0.01"
          />
        </div>
        <button type="submit" className="btn-primary">Create Repair & Print Receipt</button>
      </form>
    </section>
  );
}

function RepairsPage({ repairs, loading, onView }) {
  if (loading) return <div className="page"><p>Loading...</p></div>;

  return (
    <section className="page">
      <h2>Active Repairs</h2>
      {repairs.length === 0 ? (
        <p>No repairs yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Instrument</th>
              <th>Status</th>
              <th>Intake Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {repairs.map(repair => (
              <tr key={repair.id}>
                <td>{repair.notion_repair_number ?? repair.id}</td>
                <td>{repair.customer_name || "N/A"}</td>
                <td>{repair.instrument_name || "N/A"}</td>
                <td><span className="status-badge">{repair.status}</span></td>
                <td>{repair.intake_date ? new Date(repair.intake_date).toLocaleDateString() : "--"}</td>
                <td><button className="btn-small" onClick={() => onView(repair.id)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function fmtDate(d) {
  if (!d) return "--";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleDateString();
}

function fmtMoney(n) {
  if (n === null || n === undefined || n === "") return "--";
  const v = parseFloat(n);
  return isNaN(v) ? "--" : `$${v.toFixed(2)}`;
}

function RepairDetailPage({ repairId, onBack }) {
  const [repair, setRepair] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get(`${API_URL}/api/repairs/${repairId}`)
      .then((res) => {
        if (!cancelled) setRepair(res.data);
      })
      .catch((err) => {
        console.error("Error fetching repair:", err);
        if (!cancelled) setError("Could not load this repair.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repairId]);

  const handleCreateInvoice = async () => {
    setCreatingInvoice(true);
    try {
      const res = await axios.post(`${API_URL}/api/invoices`, {
        repair_id: repairId,
        name: repair?.title ? `Invoice for ${repair.title}` : undefined,
      });
      window.open(`${API_URL}/api/invoices/${res.data.id}/pdf`, "_blank");
    } catch (err) {
      console.error("Error creating invoice:", err);
      alert("Could not create invoice.");
    }
    setCreatingInvoice(false);
  };

  if (loading) return <div className="page"><p>Loading...</p></div>;
  if (error || !repair) return (
    <section className="page">
      <button className="btn-small" onClick={onBack}>&larr; Back to Repairs</button>
      <p>{error || "Repair not found."}</p>
    </section>
  );

  return (
    <section className="page">
      <button className="btn-small" onClick={onBack}>&larr; Back to Repairs</button>
      <h2>Repair Ticket #{repair.notion_repair_number ?? repair.id}</h2>

      <div className="dashboard-grid">
        <div className="card">
          <h3>Details</h3>
          <p><strong>Status:</strong> {repair.status}</p>
          <p><strong>Customer:</strong> {repair.customer_name || "N/A"}</p>
          <p><strong>Instrument:</strong> {repair.instrument_name || "N/A"}</p>
          <p><strong>Technician:</strong> {repair.technician_name || "N/A"}</p>
          <p><strong>Intake Date:</strong> {fmtDate(repair.intake_date)}</p>
          <p><strong>Estimated Completion:</strong> {fmtDate(repair.estimated_completion)}</p>
          <p><strong>Estimated Cost:</strong> {fmtMoney(repair.estimated_repair_cost)}</p>
        </div>
        <div className="card">
          <h3>Billing</h3>
          <p><strong>Labor Cost:</strong> {fmtMoney(repair.laborCost)}</p>
          <p><strong>Parts Cost:</strong> {fmtMoney(repair.partsCost)}</p>
          <p><strong>Subtotal:</strong> {fmtMoney(repair.subtotal)}</p>
        </div>
      </div>

      <div className="form-group" style={{ marginTop: "1.5rem" }}>
        <a
          className="btn-primary"
          href={`${API_URL}/api/repairs/${repairId}/receipt.pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginRight: "0.75rem", display: "inline-block", textDecoration: "none" }}
        >
          Print Receipt
        </a>
        <button className="btn-primary" onClick={handleCreateInvoice} disabled={creatingInvoice}>
          {creatingInvoice ? "Creating..." : "Create Invoice"}
        </button>
      </div>
    </section>
  );
}

function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get(`${API_URL}/api/invoices`)
      .then((res) => {
        if (!cancelled) setInvoices(res.data);
      })
      .catch((err) => console.error("Error fetching invoices:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="page"><p>Loading...</p></div>;

  return (
    <section className="page">
      <h2>Invoices</h2>
      {invoices.length === 0 ? (
        <p>No invoices yet. Create one from a repair's detail page.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Repair</th>
              <th>Customer</th>
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.notion_invoice_number ?? inv.id}</td>
                <td>{inv.repair_title || `Repair #${inv.notion_repair_number ?? inv.repair_id}`}</td>
                <td>{inv.customer_name || "N/A"}</td>
                <td>{fmtDate(inv.invoice_date)}</td>
                <td>{fmtDate(inv.due_date)}</td>
                <td><span className="status-badge">{inv.payment_status || "Unpaid"}</span></td>
                <td>
                  <a
                    className="btn-small"
                    href={`${API_URL}/api/invoices/${inv.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
