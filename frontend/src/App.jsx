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
        {currentPage === "repairs" && <RepairsPage repairs={repairs} loading={loading} />}
        {currentPage === "invoices" && <InvoicesPage />}
      </main>
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

function RepairsPage({ repairs, loading }) {
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
                <td>{repair.id}</td>
                <td>{repair.customer_name || "N/A"}</td>
                <td>{repair.instrument_name || "N/A"}</td>
                <td><span className="status-badge">{repair.status}</span></td>
                <td>{new Date(repair.intake_date).toLocaleDateString()}</td>
                <td><button className="btn-small">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function InvoicesPage() {
  return (
    <section className="page">
      <h2>Invoices</h2>
      <p>Invoice management coming soon.</p>
    </section>
  );
}
