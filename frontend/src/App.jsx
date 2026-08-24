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
        <button
          className={`nav-btn ${currentPage === "inventory" ? "active" : ""}`}
          onClick={() => setCurrentPage("inventory")}
        >
          Inventory
        </button>
      </nav>

      <main className="main-content">
        {currentPage === "home" && <HomePage />}
        {currentPage === "intake" && <IntakePage onCreated={viewRepair} />}
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
        {currentPage === "inventory" && <InventoryPage />}
      </main>

      <footer className="footer">
        <p>v{__APP_VERSION__} ({__COMMIT_HASH__})</p>
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

function IntakePage({ onCreated }) {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(""); // "" = new customer
  const [instruments, setInstruments] = useState([]);
  const [instrumentId, setInstrumentId] = useState(""); // "" = new instrument

  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    instrumentType: "",
    instrumentMake: "",
    instrumentModel: "",
    instrumentSerial: "",
    instrumentPurchaseDate: "",
    instrumentPurchaseCost: "",
    instrumentValuation: "",
    issueDescription: "",
    estimatedCost: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Customers and instruments are both shop-wide lists -- a repair's
  // customer and instrument don't have to match the same owner (shop-owned
  // instruments, loaners, drop-offs by a family member), so instrument
  // lookup isn't scoped to whichever customer is selected.
  useEffect(() => {
    axios
      .get(`${API_URL}/api/customers`)
      .then((res) => setCustomers(res.data))
      .catch((err) => console.error("Error fetching customers:", err));
    axios
      .get(`${API_URL}/api/instruments`)
      .then((res) => setInstruments(res.data))
      .catch((err) => console.error("Error fetching instruments:", err));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        issueDescription: formData.issueDescription,
        estimatedCost: formData.estimatedCost,
        ...(customerId
          ? { customerId }
          : {
              customerName: formData.customerName,
              customerEmail: formData.customerEmail,
              customerPhone: formData.customerPhone
            }),
        ...(instrumentId
          ? { instrumentId }
          : {
              instrumentType: formData.instrumentType,
              instrumentMake: formData.instrumentMake,
              instrumentModel: formData.instrumentModel,
              instrumentSerial: formData.instrumentSerial,
              instrumentPurchaseDate: formData.instrumentPurchaseDate,
              instrumentPurchaseCost: formData.instrumentPurchaseCost,
              instrumentValuation: formData.instrumentValuation
            })
      };
      const res = await axios.post(`${API_URL}/api/repairs/intake`, payload);
      setFormData({
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        instrumentType: "",
        instrumentMake: "",
        instrumentModel: "",
        instrumentSerial: "",
        instrumentPurchaseDate: "",
        instrumentPurchaseCost: "",
        instrumentValuation: "",
        issueDescription: "",
        estimatedCost: ""
      });
      setCustomerId("");
      setInstrumentId("");
      onCreated(res.data.id);
    } catch (err) {
      console.error("Error creating repair intake:", err);
      setError(err.response?.data?.error || "Could not create repair. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <section className="page">
      <h2>New Repair Intake</h2>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Customer</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">+ New Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {!customerId && (
          <>
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
          </>
        )}

        <div className="form-group">
          <label>Instrument</label>
          <select value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}>
            <option value="">+ New Instrument</option>
            {instruments.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}{i.type ? ` (${i.type})` : ""} — {i.owner_name || "No owner"}
              </option>
            ))}
          </select>
        </div>

        {!instrumentId && (
          <>
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
              <label>Make</label>
              <input
                type="text"
                name="instrumentMake"
                value={formData.instrumentMake}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input
                type="text"
                name="instrumentModel"
                value={formData.instrumentModel}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Serial Number</label>
              <input
                type="text"
                name="instrumentSerial"
                value={formData.instrumentSerial}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Purchase Date</label>
              <input
                type="date"
                name="instrumentPurchaseDate"
                value={formData.instrumentPurchaseDate}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Purchase Cost</label>
              <input
                type="number"
                name="instrumentPurchaseCost"
                value={formData.instrumentPurchaseCost}
                onChange={handleChange}
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label>Valuation</label>
              <input
                type="number"
                name="instrumentValuation"
                value={formData.instrumentValuation}
                onChange={handleChange}
                step="0.01"
              />
            </div>
          </>
        )}

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
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Creating..." : "Create Repair & Print Receipt"}
        </button>
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

function InventoryPage() {
  const [parts, setParts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingPartId, setViewingPartId] = useState(null);

  const fetchParts = () => {
    setLoading(true);
    axios
      .get(`${API_URL}/api/parts`)
      .then((res) => setParts(res.data))
      .catch((err) => console.error("Error fetching parts:", err))
      .finally(() => setLoading(false));
  };

  const fetchVendors = () => {
    axios
      .get(`${API_URL}/api/vendors`)
      .then((res) => setVendors(res.data))
      .catch((err) => console.error("Error fetching vendors:", err));
  };

  useEffect(() => {
    fetchParts();
    fetchVendors();
  }, []);

  if (viewingPartId) {
    return (
      <PartEditPage
        partId={viewingPartId}
        vendors={vendors}
        onBack={() => setViewingPartId(null)}
        onSaved={() => {
          setViewingPartId(null);
          fetchParts();
          fetchVendors();
        }}
      />
    );
  }

  return (
    <section className="page">
      <h2>Parts Inventory</h2>
      <button className="btn-primary" style={{ marginBottom: "1.5rem" }} onClick={() => setShowForm((s) => !s)}>
        {showForm ? "Cancel" : "+ Receive Parts"}
      </button>

      {showForm && (
        <ReceivePartsForm
          parts={parts}
          vendors={vendors}
          onSaved={() => {
            setShowForm(false);
            fetchParts();
            fetchVendors();
          }}
        />
      )}

      {loading ? (
        <p>Loading...</p>
      ) : parts.length === 0 ? (
        <p>No parts in inventory yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Part</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>In Stock</th>
              <th>Reorder Level</th>
              <th>Reorder Cost</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p) => {
              const inStock = parseFloat(p.quantity_in_stock ?? 0);
              const low = p.reorder_level != null && inStock <= parseFloat(p.reorder_level);
              return (
                <tr key={p.id}>
                  <td>
                    <button className="link-btn" onClick={() => setViewingPartId(p.id)}>
                      {p.part_name}
                    </button>
                  </td>
                  <td>{p.category || "--"}</td>
                  <td>{p.vendor_name || "--"}</td>
                  <td>
                    {p.quantity_in_stock ?? "--"}
                    {low && <span className="status-badge" style={{ marginLeft: "0.5rem" }}>Low Stock</span>}
                  </td>
                  <td>{p.reorder_level ?? "--"}</td>
                  <td>{fmtMoney(p.reorder_cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ReceivePartsForm({ parts, vendors, onSaved }) {
  const [partId, setPartId] = useState(""); // "" = new part
  const [vendorId, setVendorId] = useState(""); // "" = new vendor
  const [formData, setFormData] = useState({
    partName: "",
    category: "",
    description: "",
    vendorName: "",
    reorderLevel: "",
    reorderCost: "",
    reorderUnit: "",
    reorderUrl: "",
    markup: "",
    quantity: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (partId) {
        await axios.post(`${API_URL}/api/parts/${partId}/receive`, {
          quantityReceived: formData.quantity
        });
      } else {
        await axios.post(`${API_URL}/api/parts`, {
          partName: formData.partName,
          category: formData.category,
          description: formData.description,
          quantityInStock: formData.quantity,
          reorderLevel: formData.reorderLevel,
          reorderCost: formData.reorderCost,
          reorderUnit: formData.reorderUnit,
          reorderUrl: formData.reorderUrl,
          markup: formData.markup,
          ...(vendorId ? { vendorId } : { vendorName: formData.vendorName })
        });
      }
      onSaved();
    } catch (err) {
      console.error("Error receiving parts:", err);
      setError(err.response?.data?.error || "Could not save. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="form" style={{ marginBottom: "2rem" }}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-group">
        <label>Part</label>
        <select value={partId} onChange={(e) => setPartId(e.target.value)}>
          <option value="">+ New Part</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.part_name}{p.category ? ` (${p.category})` : ""} -- {p.quantity_in_stock ?? 0} in stock
            </option>
          ))}
        </select>
      </div>

      {!partId && (
        <>
          <div className="form-group">
            <label>Part Name *</label>
            <input type="text" name="partName" value={formData.partName} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Category</label>
            <input type="text" name="category" value={formData.category} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows="2"></textarea>
          </div>
          <div className="form-group">
            <label>Vendor</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">+ New Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          {!vendorId && (
            <div className="form-group">
              <label>New Vendor Name</label>
              <input type="text" name="vendorName" value={formData.vendorName} onChange={handleChange} />
            </div>
          )}
          <div className="form-group">
            <label>Reorder Level</label>
            <input type="number" name="reorderLevel" value={formData.reorderLevel} onChange={handleChange} step="1" />
          </div>
          <div className="form-group">
            <label>Reorder Cost</label>
            <input type="number" name="reorderCost" value={formData.reorderCost} onChange={handleChange} step="0.01" />
          </div>
          <div className="form-group">
            <label>Reorder Unit (qty per order)</label>
            <input type="number" name="reorderUnit" value={formData.reorderUnit} onChange={handleChange} step="1" />
          </div>
          <div className="form-group">
            <label>Reorder URL</label>
            <input type="text" name="reorderUrl" value={formData.reorderUrl} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Markup (multiplier)</label>
            <input type="number" name="markup" value={formData.markup} onChange={handleChange} step="0.01" />
          </div>
        </>
      )}

      <div className="form-group">
        <label>Quantity Received *</label>
        <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} step="1" required />
      </div>

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Saving..." : "Add to Inventory"}
      </button>
    </form>
  );
}

function PartEditPage({ partId, vendors, onBack, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [vendorId, setVendorId] = useState("");
  const [formData, setFormData] = useState({
    partName: "",
    category: "",
    description: "",
    vendorName: "",
    quantityInStock: "",
    reorderLevel: "",
    reorderCost: "",
    reorderUnit: "",
    reorderUrl: "",
    markup: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    axios
      .get(`${API_URL}/api/parts/${partId}`)
      .then((res) => {
        if (cancelled) return;
        const p = res.data;
        setVendorId(p.vendor_id ? String(p.vendor_id) : "");
        setFormData({
          partName: p.part_name || "",
          category: p.category || "",
          description: p.description || "",
          vendorName: "",
          quantityInStock: p.quantity_in_stock ?? "",
          reorderLevel: p.reorder_level ?? "",
          reorderCost: p.reorder_cost ?? "",
          reorderUnit: p.reorder_unit ?? "",
          reorderUrl: p.reorder_url || "",
          markup: p.markup ?? ""
        });
      })
      .catch((err) => {
        console.error("Error fetching part:", err);
        if (!cancelled) setLoadError("Could not load this part.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await axios.put(`${API_URL}/api/parts/${partId}`, {
        partName: formData.partName,
        category: formData.category,
        description: formData.description,
        quantityInStock: formData.quantityInStock,
        reorderLevel: formData.reorderLevel,
        reorderCost: formData.reorderCost,
        reorderUnit: formData.reorderUnit,
        reorderUrl: formData.reorderUrl,
        markup: formData.markup,
        ...(vendorId ? { vendorId } : { vendorName: formData.vendorName })
      });
      onSaved();
    } catch (err) {
      console.error("Error saving part:", err);
      setError(err.response?.data?.error || "Could not save. Please try again.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <section className="page">
        <button className="btn-small" onClick={onBack}>&larr; Back to Inventory</button>
        <p>Loading...</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page">
        <button className="btn-small" onClick={onBack}>&larr; Back to Inventory</button>
        <p>{loadError}</p>
      </section>
    );
  }

  return (
    <section className="page">
      <button className="btn-small" onClick={onBack} style={{ marginBottom: "1.5rem" }}>&larr; Back to Inventory</button>
      <h2>Edit Part</h2>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Part Name *</label>
          <input type="text" name="partName" value={formData.partName} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Category</label>
          <input type="text" name="category" value={formData.category} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} rows="2"></textarea>
        </div>
        <div className="form-group">
          <label>Vendor</label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">+ New Vendor</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        {!vendorId && (
          <div className="form-group">
            <label>New Vendor Name</label>
            <input type="text" name="vendorName" value={formData.vendorName} onChange={handleChange} />
          </div>
        )}
        <div className="form-group">
          <label>Quantity In Stock</label>
          <input type="number" name="quantityInStock" value={formData.quantityInStock} onChange={handleChange} step="1" />
        </div>
        <div className="form-group">
          <label>Reorder Level</label>
          <input type="number" name="reorderLevel" value={formData.reorderLevel} onChange={handleChange} step="1" />
        </div>
        <div className="form-group">
          <label>Reorder Cost</label>
          <input type="number" name="reorderCost" value={formData.reorderCost} onChange={handleChange} step="0.01" />
        </div>
        <div className="form-group">
          <label>Reorder Unit (qty per order)</label>
          <input type="number" name="reorderUnit" value={formData.reorderUnit} onChange={handleChange} step="1" />
        </div>
        <div className="form-group">
          <label>Reorder URL</label>
          <input type="text" name="reorderUrl" value={formData.reorderUrl} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Markup (multiplier)</label>
          <input type="number" name="markup" value={formData.markup} onChange={handleChange} step="0.01" />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </section>
  );
}
