import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

// Same-origin by default: the frontend is served by the same Express app
// that serves the API, so relative paths always hit the right host:port
// regardless of whether you access it as dockernuc.local, an IP, etc.
// Set VITE_API_URL only if the frontend is ever served from a different
// origin than the backend.
const API_URL = import.meta.env.VITE_API_URL || "";

// Shared sortable-table pattern: a column config ({key, label, type}) plus
// this hook/helper/header combo is the standard for any new list page --
// see InventoryPage and RepairsPage. Clicking a column header sorts by it
// (asc, then desc on a second click); clicking a row's primary link opens
// its detail/edit view instead of a separate Actions column.
function useSort(initialField, initialDirection = "asc") {
  const [sortField, setSortField] = useState(initialField);
  const [sortDirection, setSortDirection] = useState(initialDirection);

  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return { sortField, sortDirection, handleSort };
}

function sortRows(rows, columns, sortField, sortDirection) {
  const col = columns.find((c) => c.key === sortField);
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    let av = a[sortField];
    let bv = b[sortField];
    if (col.type === "number") {
      av = av == null || av === "" ? -Infinity : parseFloat(av);
      bv = bv == null || bv === "" ? -Infinity : parseFloat(bv);
    } else if (col.type === "date") {
      av = av ? new Date(av).getTime() : -Infinity;
      bv = bv ? new Date(bv).getTime() : -Infinity;
    } else {
      av = (av || "").toString().toLowerCase();
      bv = (bv || "").toString().toLowerCase();
    }
    if (av < bv) return sortDirection === "asc" ? -1 : 1;
    if (av > bv) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
}

function SortableHeaderRow({ columns, sortField, sortDirection, onSort }) {
  return (
    <tr>
      {columns.map((col) => (
        <th key={col.key}>
          <button className="sort-header" onClick={() => onSort(col.key)}>
            {col.label}
            {sortField === col.key && (sortDirection === "asc" ? " ▲" : " ▼")}
          </button>
        </th>
      ))}
    </tr>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [repairs, setRepairs] = useState([]);
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
          All Repairs
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
        <button
          className={`nav-btn ${currentPage === "customers" ? "active" : ""}`}
          onClick={() => setCurrentPage("customers")}
        >
          Customers
        </button>
        <button
          className={`nav-btn ${currentPage === "instruments" ? "active" : ""}`}
          onClick={() => setCurrentPage("instruments")}
        >
          Instruments
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
        {currentPage === "invoices" && <InvoicesPage onViewRepair={viewRepair} />}
        {currentPage === "inventory" && <InventoryPage />}
        {currentPage === "customers" && <CustomersPage />}
        {currentPage === "instruments" && <InstrumentsPage />}
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
          <p>View and filter every repair in the "All Repairs" tab.</p>
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

// The full set of statuses a repair can have (see docker/init-db/01-schema.sql).
// Listed explicitly rather than derived from whatever's currently in the
// data, so the filter always offers every valid status.
const REPAIR_STATUSES = [
  "Received",
  "Diagnosis",
  "In Progress",
  "Ready for Pickup",
  "Parts Ordered",
  "Complete",
  "Archive"
];

const REPAIR_COLUMNS = [
  { key: "ticketNumber", label: "Ticket #", type: "number" },
  { key: "customer_name", label: "Customer", type: "string" },
  { key: "instrument_name", label: "Instrument", type: "string" },
  { key: "status", label: "Status", type: "string" },
  { key: "intake_date", label: "Intake Date", type: "date" }
];

function RepairsPage({ repairs, loading, onView }) {
  const { sortField, sortDirection, handleSort } = useSort("intake_date", "desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  if (loading) return <div className="page"><p>Loading...</p></div>;

  const withTicketNumber = repairs.map((r) => ({
    ...r,
    ticketNumber: r.notion_repair_number ?? r.id
  }));

  const filtered = withTicketNumber.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${r.customer_name || ""} ${r.instrument_name || ""} ${r.title || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sorted = sortRows(filtered, REPAIR_COLUMNS, sortField, sortDirection);

  return (
    <section className="page">
      <h2>All Repairs</h2>

      <div className="filter-bar">
        <div className="form-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {REPAIR_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Customer, instrument, or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {repairs.length === 0 ? (
        <p>No repairs yet.</p>
      ) : sorted.length === 0 ? (
        <p>No repairs match this filter.</p>
      ) : (
        <table className="table">
          <thead>
            <SortableHeaderRow
              columns={REPAIR_COLUMNS}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </thead>
          <tbody>
            {sorted.map((repair) => (
              <tr key={repair.id}>
                <td>
                  <button className="link-btn" onClick={() => onView(repair.id)}>
                    {repair.ticketNumber}
                  </button>
                </td>
                <td>{repair.customer_name || "N/A"}</td>
                <td>{repair.instrument_name || "N/A"}</td>
                <td><span className="status-badge">{repair.status}</span></td>
                <td>{fmtDate(repair.intake_date)}</td>
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

// markup is stored as a cost multiplier (1.10 = 10% markup) but shown to
// the user as a percentage.
function fmtMarkupPercent(multiplier) {
  if (multiplier === null || multiplier === undefined || multiplier === "") return "--";
  const v = parseFloat(multiplier);
  return isNaN(v) ? "--" : `${Math.round((v - 1) * 100)}%`;
}

function markupMultiplierToPercent(multiplier) {
  if (multiplier === null || multiplier === undefined || multiplier === "") return "";
  const v = Number(multiplier);
  return Number.isNaN(v) ? "" : String(Math.round((v - 1) * 100 * 100) / 100);
}

function markupPercentToMultiplier(percent) {
  if (percent === null || percent === undefined || percent === "") return "";
  const v = Number(percent);
  return Number.isNaN(v) ? "" : String(1 + v / 100);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function RepairDetailPage({ repairId, onBack }) {
  const [repair, setRepair] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [showWorkLogForm, setShowWorkLogForm] = useState(false);
  const [showPartUsedForm, setShowPartUsedForm] = useState(false);

  const fetchRepair = () => {
    setLoading(true);
    setError(null);
    return axios
      .get(`${API_URL}/api/repairs/${repairId}`)
      .then((res) => setRepair(res.data))
      .catch((err) => {
        console.error("Error fetching repair:", err);
        setError("Could not load this repair.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRepair();
    axios
      .get(`${API_URL}/api/technicians`)
      .then((res) => setTechnicians(res.data))
      .catch((err) => console.error("Error fetching technicians:", err));
    axios
      .get(`${API_URL}/api/parts`)
      .then((res) => setParts(res.data))
      .catch((err) => console.error("Error fetching parts:", err));
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

      <div style={{ marginTop: "2.5rem" }}>
        <h3>Work Log</h3>
        <button className="btn-small" style={{ margin: "0.75rem 0" }} onClick={() => setShowWorkLogForm((s) => !s)}>
          {showWorkLogForm ? "Cancel" : "+ Log Work"}
        </button>
        {showWorkLogForm && (
          <WorkLogForm
            repairId={repairId}
            technicians={technicians}
            onSaved={() => {
              setShowWorkLogForm(false);
              fetchRepair();
            }}
          />
        )}
        {repair.workLog.length === 0 ? (
          <p>No work logged yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Technician</th>
                <th>Description</th>
                <th>Hours</th>
                <th>Billable</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {repair.workLog.map((w) => (
                <tr key={w.id}>
                  <td>{fmtDate(w.start_work)}</td>
                  <td>{w.technician_name || "N/A"}</td>
                  <td>{w.label || "--"}</td>
                  <td>{w.time_on_repair ?? "--"}</td>
                  <td>{w.billable ? "Yes" : "No"}</td>
                  <td>{w.billable ? fmtMoney((parseFloat(w.hourly_rate) || 0) * (parseFloat(w.time_on_repair) || 0)) : "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: "2.5rem" }}>
        <h3>Parts Used</h3>
        <button className="btn-small" style={{ margin: "0.75rem 0" }} onClick={() => setShowPartUsedForm((s) => !s)}>
          {showPartUsedForm ? "Cancel" : "+ Add Part Used"}
        </button>
        {showPartUsedForm && (
          <PartUsedForm
            repairId={repairId}
            parts={parts}
            onSaved={() => {
              setShowPartUsedForm(false);
              fetchRepair();
            }}
          />
        )}
        {repair.partsUsed.length === 0 ? (
          <p>No parts logged yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Part</th>
                <th>Quantity</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {repair.partsUsed.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.date_used)}</td>
                  <td>{p.part_name || p.label || "N/A"}</td>
                  <td>{p.quantity_used ?? "--"}</td>
                  <td>{fmtMoney(p.customer_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function WorkLogForm({ repairId, technicians, onSaved }) {
  const [formData, setFormData] = useState({
    technicianId: "",
    label: "",
    hours: "",
    billable: true,
    date: todayIsoDate()
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/api/repairs/${repairId}/work-log`, formData);
      onSaved();
    } catch (err) {
      console.error("Error logging work:", err);
      setError(err.response?.data?.error || "Could not save. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="form" style={{ marginBottom: "1.5rem" }}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-group">
        <label>Technician</label>
        <select name="technicianId" value={formData.technicianId} onChange={handleChange}>
          <option value="">-- None --</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Description</label>
        <input type="text" name="label" value={formData.label} onChange={handleChange} placeholder="e.g. Repad - Upper" />
      </div>
      <div className="form-group">
        <label>Date</label>
        <input type="date" name="date" value={formData.date} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Hours *</label>
        <input type="number" name="hours" value={formData.hours} onChange={handleChange} step="0.25" min="0" required />
      </div>
      <div className="form-group">
        <label>
          <input type="checkbox" name="billable" checked={formData.billable} onChange={handleChange} style={{ marginRight: "0.5rem" }} />
          Billable
        </label>
      </div>
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Saving..." : "Log Work"}
      </button>
    </form>
  );
}

function PartUsedForm({ repairId, parts, onSaved }) {
  const [partId, setPartId] = useState("");
  const [formData, setFormData] = useState({
    label: "",
    quantityUsed: "1",
    customerCost: "",
    date: todayIsoDate()
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handlePartChange = (e) => {
    const id = e.target.value;
    setPartId(id);
    const part = parts.find((p) => String(p.id) === id);
    if (part) {
      const qty = parseFloat(formData.quantityUsed) || 1;
      const unitCost = (parseFloat(part.reorder_cost) || 0) * (parseFloat(part.markup) || 1);
      setFormData((prev) => ({
        ...prev,
        label: part.part_name,
        customerCost: unitCost ? (unitCost * qty).toFixed(2) : prev.customerCost
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/api/repairs/${repairId}/parts-used`, {
        partId: partId || null,
        ...formData
      });
      onSaved();
    } catch (err) {
      console.error("Error logging part used:", err);
      setError(err.response?.data?.error || "Could not save. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="form" style={{ marginBottom: "1.5rem" }}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-group">
        <label>Part</label>
        <select value={partId} onChange={handlePartChange}>
          <option value="">-- Not in inventory --</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.part_name} -- {p.quantity_in_stock ?? 0} in stock
            </option>
          ))}
        </select>
      </div>
      {!partId && (
        <div className="form-group">
          <label>Description</label>
          <input type="text" name="label" value={formData.label} onChange={handleChange} placeholder="e.g. Cork sheet" />
        </div>
      )}
      <div className="form-group">
        <label>Date</label>
        <input type="date" name="date" value={formData.date} onChange={handleChange} />
      </div>
      <div className="form-group">
        <label>Quantity Used *</label>
        <input type="number" name="quantityUsed" value={formData.quantityUsed} onChange={handleChange} step="1" min="0" required />
      </div>
      <div className="form-group">
        <label>Customer Cost</label>
        <input type="number" name="customerCost" value={formData.customerCost} onChange={handleChange} step="0.01" min="0" />
      </div>
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Saving..." : "Add Part Used"}
      </button>
    </form>
  );
}

const INVOICE_PAYMENT_STATUSES = ["Unpaid", "Paid", "Overdue"];

const INVOICE_COLUMNS = [
  { key: "invoiceNumber", label: "Invoice #", type: "number" },
  { key: "repair_title", label: "Repair", type: "string" },
  { key: "customer_name", label: "Customer", type: "string" },
  { key: "invoice_date", label: "Invoice Date", type: "date" },
  { key: "due_date", label: "Due Date", type: "date" },
  { key: "payment_status", label: "Status", type: "string" }
];

function InvoicesPage({ onViewRepair }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const { sortField, sortDirection, handleSort } = useSort("invoice_date", "desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

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

  const withInvoiceNumber = invoices.map((inv) => ({
    ...inv,
    invoiceNumber: inv.notion_invoice_number ?? inv.id
  }));

  const filtered = withInvoiceNumber.filter((inv) => {
    const status = inv.payment_status || "Unpaid";
    if (statusFilter && status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${inv.customer_name || ""} ${inv.repair_title || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sorted = sortRows(filtered, INVOICE_COLUMNS, sortField, sortDirection);

  return (
    <section className="page">
      <h2>Invoices</h2>

      <div className="filter-bar">
        <div className="form-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {INVOICE_PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Customer or repair..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {invoices.length === 0 ? (
        <p>No invoices yet. Create one from a repair's detail page.</p>
      ) : sorted.length === 0 ? (
        <p>No invoices match this filter.</p>
      ) : (
        <table className="table">
          <thead>
            <SortableHeaderRow
              columns={INVOICE_COLUMNS}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </thead>
          <tbody>
            {sorted.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoiceNumber}</td>
                <td>
                  <button className="link-btn" onClick={() => onViewRepair(inv.repair_id)}>
                    {inv.repair_title || `Repair #${inv.notion_repair_number ?? inv.repair_id}`}
                  </button>
                </td>
                <td>{inv.customer_name || "N/A"}</td>
                <td>{fmtDate(inv.invoice_date)}</td>
                <td>{fmtDate(inv.due_date)}</td>
                <td>
                  <span className="status-badge">{inv.payment_status || "Unpaid"}</span>
                  {" "}
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

const INVENTORY_COLUMNS = [
  { key: "part_name", label: "Part", type: "string" },
  { key: "category", label: "Category", type: "string" },
  { key: "vendor_name", label: "Vendor", type: "string" },
  { key: "quantity_in_stock", label: "In Stock", type: "number" },
  { key: "reorder_level", label: "Reorder Level", type: "number" },
  { key: "reorder_cost", label: "Reorder Cost", type: "number" },
  { key: "markup", label: "Markup", type: "number" }
];

function InventoryPage() {
  const [parts, setParts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingPartId, setViewingPartId] = useState(null);
  const { sortField, sortDirection, handleSort } = useSort("part_name");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [search, setSearch] = useState("");

  const categories = [...new Set(parts.map((p) => p.category).filter(Boolean))].sort();

  const filteredParts = parts.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (vendorFilter && String(p.vendor_id) !== vendorFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${p.part_name || ""} ${p.description || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sortedParts = sortRows(filteredParts, INVENTORY_COLUMNS, sortField, sortDirection);

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

      {parts.length > 0 && (
        <div className="filter-bar">
          <div className="form-group">
            <label>Category</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Vendor</label>
            <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Part name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : parts.length === 0 ? (
        <p>No parts in inventory yet.</p>
      ) : sortedParts.length === 0 ? (
        <p>No parts match this filter.</p>
      ) : (
        <table className="table">
          <thead>
            <SortableHeaderRow
              columns={INVENTORY_COLUMNS}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </thead>
          <tbody>
            {sortedParts.map((p) => {
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
                  <td>{fmtMarkupPercent(p.markup)}</td>
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
          markup: markupPercentToMultiplier(formData.markup),
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
            <input type="number" name="reorderLevel" value={formData.reorderLevel} onChange={handleChange} step="1" min="0" />
          </div>
          <div className="form-group">
            <label>Reorder Cost</label>
            <input type="number" name="reorderCost" value={formData.reorderCost} onChange={handleChange} step="0.01" min="0" />
          </div>
          <div className="form-group">
            <label>Reorder Unit (qty per order)</label>
            <input type="number" name="reorderUnit" value={formData.reorderUnit} onChange={handleChange} step="1" min="0" />
          </div>
          <div className="form-group">
            <label>Reorder URL</label>
            <input type="text" name="reorderUrl" value={formData.reorderUrl} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Markup (%)</label>
            <input type="number" name="markup" value={formData.markup} onChange={handleChange} step="0.01" placeholder="e.g. 20 for 20%" />
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
          markup: markupMultiplierToPercent(p.markup)
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
        markup: markupPercentToMultiplier(formData.markup),
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
          <input type="number" name="reorderLevel" value={formData.reorderLevel} onChange={handleChange} step="1" min="0" />
        </div>
        <div className="form-group">
          <label>Reorder Cost</label>
          <input type="number" name="reorderCost" value={formData.reorderCost} onChange={handleChange} step="0.01" min="0" />
        </div>
        <div className="form-group">
          <label>Reorder Unit (qty per order)</label>
          <input type="number" name="reorderUnit" value={formData.reorderUnit} onChange={handleChange} step="1" min="0" />
        </div>
        <div className="form-group">
          <label>Reorder URL</label>
          <input type="text" name="reorderUrl" value={formData.reorderUrl} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Markup (%)</label>
          <input type="number" name="markup" value={formData.markup} onChange={handleChange} step="0.01" placeholder="e.g. 20 for 20%" />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </section>
  );
}

const CUSTOMER_COLUMNS = [
  { key: "name", label: "Name", type: "string" },
  { key: "email", label: "Email", type: "string" },
  { key: "phone", label: "Phone", type: "string" },
  { key: "city", label: "City", type: "string" },
  { key: "state", label: "State", type: "string" }
];

function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingCustomerId, setViewingCustomerId] = useState(null);
  const { sortField, sortDirection, handleSort } = useSort("name");
  const [search, setSearch] = useState("");

  const fetchCustomers = () => {
    setLoading(true);
    axios
      .get(`${API_URL}/api/customers`)
      .then((res) => setCustomers(res.data))
      .catch((err) => console.error("Error fetching customers:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  if (viewingCustomerId) {
    return (
      <CustomerEditPage
        customerId={viewingCustomerId}
        onBack={() => setViewingCustomerId(null)}
        onSaved={() => {
          setViewingCustomerId(null);
          fetchCustomers();
        }}
      />
    );
  }

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const haystack = `${c.name || ""} ${c.email || ""} ${c.phone || ""}`.toLowerCase();
    return haystack.includes(q);
  });

  const sorted = sortRows(filtered, CUSTOMER_COLUMNS, sortField, sortDirection);

  return (
    <section className="page">
      <h2>Customers</h2>

      {customers.length > 0 && (
        <div className="filter-bar">
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : customers.length === 0 ? (
        <p>No customers yet.</p>
      ) : sorted.length === 0 ? (
        <p>No customers match this filter.</p>
      ) : (
        <table className="table">
          <thead>
            <SortableHeaderRow
              columns={CUSTOMER_COLUMNS}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id}>
                <td>
                  <button className="link-btn" onClick={() => setViewingCustomerId(c.id)}>
                    {c.name}
                  </button>
                </td>
                <td>{c.email || "--"}</td>
                <td>{c.phone || "--"}</td>
                <td>{c.city || "--"}</td>
                <td>{c.state || "--"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function CustomerEditPage({ customerId, onBack, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip: "",
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    axios
      .get(`${API_URL}/api/customers/${customerId}`)
      .then((res) => {
        if (cancelled) return;
        const c = res.data;
        setFormData({
          name: c.name || "",
          email: c.email || "",
          phone: c.phone || "",
          address_line1: c.address_line1 || "",
          address_line2: c.address_line2 || "",
          city: c.city || "",
          state: c.state || "",
          zip: c.zip || "",
          notes: c.notes || ""
        });
      })
      .catch((err) => {
        console.error("Error fetching customer:", err);
        if (!cancelled) setLoadError("Could not load this customer.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await axios.put(`${API_URL}/api/customers/${customerId}`, formData);
      onSaved();
    } catch (err) {
      console.error("Error saving customer:", err);
      setError(err.response?.data?.error || "Could not save. Please try again.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <section className="page">
        <button className="btn-small" onClick={onBack}>&larr; Back to Customers</button>
        <p>Loading...</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page">
        <button className="btn-small" onClick={onBack}>&larr; Back to Customers</button>
        <p>{loadError}</p>
      </section>
    );
  }

  return (
    <section className="page">
      <button className="btn-small" onClick={onBack} style={{ marginBottom: "1.5rem" }}>&larr; Back to Customers</button>
      <h2>Edit Customer</h2>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Address Line 1</label>
          <input type="text" name="address_line1" value={formData.address_line1} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Address Line 2</label>
          <input type="text" name="address_line2" value={formData.address_line2} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>City</label>
          <input type="text" name="city" value={formData.city} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>State</label>
          <input type="text" name="state" value={formData.state} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Zip</label>
          <input type="text" name="zip" value={formData.zip} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3"></textarea>
        </div>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </section>
  );
}

const INSTRUMENT_COLUMNS = [
  { key: "name", label: "Name", type: "string" },
  { key: "type", label: "Type", type: "string" },
  { key: "make", label: "Make", type: "string" },
  { key: "model", label: "Model", type: "string" },
  { key: "serial", label: "Serial", type: "string" },
  { key: "owner_name", label: "Owner", type: "string" }
];

function toDateInputValue(d) {
  if (!d) return "";
  return String(d).slice(0, 10);
}

function InstrumentsPage() {
  const [instruments, setInstruments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingInstrumentId, setViewingInstrumentId] = useState(null);
  const { sortField, sortDirection, handleSort } = useSort("name");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchInstruments = () => {
    setLoading(true);
    axios
      .get(`${API_URL}/api/instruments`)
      .then((res) => setInstruments(res.data))
      .catch((err) => console.error("Error fetching instruments:", err))
      .finally(() => setLoading(false));
  };

  const fetchCustomers = () => {
    axios
      .get(`${API_URL}/api/customers`)
      .then((res) => setCustomers(res.data))
      .catch((err) => console.error("Error fetching customers:", err));
  };

  useEffect(() => {
    fetchInstruments();
    fetchCustomers();
  }, []);

  if (viewingInstrumentId) {
    return (
      <InstrumentEditPage
        instrumentId={viewingInstrumentId}
        customers={customers}
        onBack={() => setViewingInstrumentId(null)}
        onSaved={() => {
          setViewingInstrumentId(null);
          fetchInstruments();
          fetchCustomers();
        }}
      />
    );
  }

  const filtered = instruments.filter((i) => {
    if (ownerFilter === "none" && i.owner_customer_id) return false;
    if (ownerFilter && ownerFilter !== "none" && String(i.owner_customer_id) !== ownerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${i.name || ""} ${i.type || ""} ${i.make || ""} ${i.model || ""} ${i.serial || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sorted = sortRows(filtered, INSTRUMENT_COLUMNS, sortField, sortDirection);

  return (
    <section className="page">
      <h2>Instruments</h2>

      {instruments.length > 0 && (
        <div className="filter-bar">
          <div className="form-group">
            <label>Owner</label>
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="">All Owners</option>
              <option value="none">No Owner</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Name, type, make, model, or serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : instruments.length === 0 ? (
        <p>No instruments yet.</p>
      ) : sorted.length === 0 ? (
        <p>No instruments match this filter.</p>
      ) : (
        <table className="table">
          <thead>
            <SortableHeaderRow
              columns={INSTRUMENT_COLUMNS}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </thead>
          <tbody>
            {sorted.map((i) => (
              <tr key={i.id}>
                <td>
                  <button className="link-btn" onClick={() => setViewingInstrumentId(i.id)}>
                    {i.name}
                  </button>
                </td>
                <td>{i.type || "--"}</td>
                <td>{i.make || "--"}</td>
                <td>{i.model || "--"}</td>
                <td>{i.serial || "--"}</td>
                <td>{i.owner_name || "--"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function InstrumentEditPage({ instrumentId, customers, onBack, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [ownerCustomerId, setOwnerCustomerId] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    make: "",
    model: "",
    serial: "",
    purchaseDate: "",
    purchaseCost: "",
    valuation: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    axios
      .get(`${API_URL}/api/instruments/${instrumentId}`)
      .then((res) => {
        if (cancelled) return;
        const i = res.data;
        setOwnerCustomerId(i.owner_customer_id ? String(i.owner_customer_id) : "");
        setFormData({
          name: i.name || "",
          type: i.type || "",
          make: i.make || "",
          model: i.model || "",
          serial: i.serial || "",
          purchaseDate: toDateInputValue(i.purchase_date),
          purchaseCost: i.purchase_cost ?? "",
          valuation: i.valuation ?? ""
        });
      })
      .catch((err) => {
        console.error("Error fetching instrument:", err);
        if (!cancelled) setLoadError("Could not load this instrument.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instrumentId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await axios.put(`${API_URL}/api/instruments/${instrumentId}`, {
        name: formData.name,
        type: formData.type,
        make: formData.make,
        model: formData.model,
        serial: formData.serial,
        purchaseDate: formData.purchaseDate,
        purchaseCost: formData.purchaseCost,
        valuation: formData.valuation,
        ownerCustomerId
      });
      onSaved();
    } catch (err) {
      console.error("Error saving instrument:", err);
      setError(err.response?.data?.error || "Could not save. Please try again.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <section className="page">
        <button className="btn-small" onClick={onBack}>&larr; Back to Instruments</button>
        <p>Loading...</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page">
        <button className="btn-small" onClick={onBack}>&larr; Back to Instruments</button>
        <p>{loadError}</p>
      </section>
    );
  }

  return (
    <section className="page">
      <button className="btn-small" onClick={onBack} style={{ marginBottom: "1.5rem" }}>&larr; Back to Instruments</button>
      <h2>Edit Instrument</h2>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Type</label>
          <input type="text" name="type" value={formData.type} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Make</label>
          <input type="text" name="make" value={formData.make} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Model</label>
          <input type="text" name="model" value={formData.model} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Serial Number</label>
          <input type="text" name="serial" value={formData.serial} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Owner</label>
          <select value={ownerCustomerId} onChange={(e) => setOwnerCustomerId(e.target.value)}>
            <option value="">No Owner</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Purchase Date</label>
          <input type="date" name="purchaseDate" value={formData.purchaseDate} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Purchase Cost</label>
          <input type="number" name="purchaseCost" value={formData.purchaseCost} onChange={handleChange} step="0.01" min="0" />
        </div>
        <div className="form-group">
          <label>Valuation</label>
          <input type="number" name="valuation" value={formData.valuation} onChange={handleChange} step="0.01" min="0" />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </section>
  );
}
