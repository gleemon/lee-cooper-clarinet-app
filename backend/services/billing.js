// Repairs shop billing math -- mirrors the formulas that used to live in the
// Notion "Repairs" and "Invoices" databases:
//   Labor Cost  = sum(work_log.time_on_repair * technician.hourly_rate) for billable entries
//   Parts Cost  = sum(parts_used.customer_cost)
//   Subtotal    = Labor Cost + Parts Cost
//   Total       = Subtotal + (Subtotal * tax_rate)

export async function getRepairBillingDetails(pool, repairId) {
  const conn = await pool.getConnection();
  try {
    const [repairRows] = await conn.query(
      `SELECT r.*,
              c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
              c.address_line1, c.address_line2, c.city, c.state, c.zip,
              i.name AS instrument_name, i.type AS instrument_type, i.make AS instrument_make,
              i.model AS instrument_model, i.serial AS instrument_serial,
              t.name AS technician_name
       FROM repairs r
       LEFT JOIN customers c ON r.customer_id = c.id
       LEFT JOIN instruments i ON r.instrument_id = i.id
       LEFT JOIN technicians t ON r.technician_id = t.id
       WHERE r.id = ?`,
      [repairId]
    );
    const repair = repairRows[0];
    if (!repair) return null;

    const [workLogRows] = await conn.query(
      `SELECT w.id, w.label, w.time_on_repair, w.billable, w.start_work, t.hourly_rate, t.name AS technician_name
       FROM work_log w
       LEFT JOIN technicians t ON w.technician_id = t.id
       WHERE w.repair_id = ?
       ORDER BY w.start_work ASC`,
      [repairId]
    );

    const [partsRows] = await conn.query(
      `SELECT pu.id, pu.label, pu.quantity_used, pu.customer_cost, pu.date_used, p.part_name
       FROM parts_used pu
       LEFT JOIN parts_inventory p ON pu.part_id = p.id
       WHERE pu.repair_id = ?`,
      [repairId]
    );

    const laborCost = workLogRows.reduce((sum, w) => {
      if (!w.billable) return sum;
      const rate = parseFloat(w.hourly_rate) || 0;
      const hours = parseFloat(w.time_on_repair) || 0;
      return sum + rate * hours;
    }, 0);

    const partsCost = partsRows.reduce((sum, p) => sum + (parseFloat(p.customer_cost) || 0), 0);
    const subtotal = laborCost + partsCost;

    return { repair, workLogRows, partsRows, laborCost, partsCost, subtotal };
  } finally {
    conn.release();
  }
}
