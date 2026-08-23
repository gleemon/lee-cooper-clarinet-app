import { SHOP_INFO } from "./shopInfo.js";

function fmtDate(d) {
  if (!d) return "--";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtMoney(n) {
  const v = parseFloat(n);
  return `$${(isNaN(v) ? 0 : v).toFixed(2)}`;
}

// Renders a proper line-itemized invoice: shop letterhead, customer/repair
// info, labor line items (hours x technician rate), parts line items, then
// subtotal / tax / total / payment status.
export function renderInvoicePdf(doc, { invoice, repair, workLogRows, partsRows, laborCost, partsCost, subtotal, tax, total }) {
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text(SHOP_INFO.name, { align: "center" })
    .fontSize(10)
    .font("Helvetica")
    .text(SHOP_INFO.addressLine1, { align: "center" })
    .text(SHOP_INFO.cityStateZip, { align: "center" })
    .text(`${SHOP_INFO.phone}  |  ${SHOP_INFO.email}`, { align: "center" });

  doc.moveDown(1.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  doc.fontSize(16).font("Helvetica-Bold").text("Invoice", { align: "center" });
  doc.moveDown(1);

  const leftX = 50;
  const rightX = 320;
  const topY = doc.y;

  doc.font("Helvetica-Bold").fontSize(11).text("Bill To", leftX, topY);
  doc.font("Helvetica").fontSize(10);
  doc.text(repair.customer_name || "--", leftX, doc.y);
  if (repair.address_line1) doc.text(repair.address_line1, leftX);
  const cityLine = [repair.city, repair.state, repair.zip].filter(Boolean).join(", ");
  if (cityLine) doc.text(cityLine, leftX);
  if (repair.customer_phone) doc.text(repair.customer_phone, leftX);
  if (repair.customer_email) doc.text(repair.customer_email, leftX);

  doc.font("Helvetica-Bold").fontSize(11).text("Invoice Details", rightX, topY);
  doc.font("Helvetica").fontSize(10);
  doc.text(`Invoice #: ${invoice.notion_invoice_number ?? invoice.id}`, rightX);
  doc.text(`Invoice Date: ${fmtDate(invoice.invoice_date)}`, rightX);
  doc.text(`Due Date: ${fmtDate(invoice.due_date)}`, rightX);
  doc.text(`Payment Status: ${invoice.payment_status || "Unpaid"}`, rightX);
  doc.text(`Repair Ticket #: ${repair.notion_repair_number ?? repair.id}`, rightX);
  if (repair.instrument_name) doc.text(`Instrument: ${repair.instrument_name}`, rightX);

  doc.moveDown(2);
  doc.y = Math.max(doc.y, topY + 90);

  // -- Labor table --
  doc.font("Helvetica-Bold").fontSize(12).text("Labor", leftX, doc.y);
  doc.moveDown(0.3);
  const billableLabor = workLogRows.filter((w) => w.billable);
  if (billableLabor.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#777").text("No billable labor recorded.").fillColor("black");
  } else {
    tableHeader(doc, ["Description", "Hours", "Rate", "Amount"], [230, 70, 90, 90]);
    billableLabor.forEach((w) => {
      const rate = parseFloat(w.hourly_rate) || 0;
      const hours = parseFloat(w.time_on_repair) || 0;
      tableRow(
        doc,
        [w.label || "Labor", hours.toFixed(1), fmtMoney(rate) + "/hr", fmtMoney(rate * hours)],
        [230, 70, 90, 90]
      );
    });
  }

  doc.moveDown(1);

  // -- Parts table --
  doc.font("Helvetica-Bold").fontSize(12).text("Parts", leftX, doc.y);
  doc.moveDown(0.3);
  if (partsRows.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#777").text("No parts recorded.").fillColor("black");
  } else {
    tableHeader(doc, ["Description", "Qty", "", "Amount"], [230, 70, 90, 90]);
    partsRows.forEach((p) => {
      tableRow(
        doc,
        [p.part_name || p.label || "Part", String(p.quantity_used ?? "1"), "", fmtMoney(p.customer_cost)],
        [230, 70, 90, 90]
      );
    });
  }

  doc.moveDown(1.5);
  doc.moveTo(320, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  totalsRow(doc, "Labor Subtotal", laborCost);
  totalsRow(doc, "Parts Subtotal", partsCost);
  totalsRow(doc, "Subtotal", subtotal);
  totalsRow(doc, `Tax${invoice.tax_rate ? ` (${(parseFloat(invoice.tax_rate) * 100).toFixed(1)}%)` : ""}`, tax);
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(13);
  totalsRow(doc, "Total Due", total, true);

  doc.moveDown(2);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#777")
    .text("Thank you for your business!", 50, doc.y, { align: "center" })
    .fillColor("black");
}

function tableHeader(doc, cols, widths) {
  const x0 = 50;
  let x = x0;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#555");
  cols.forEach((c, i) => {
    doc.text(c, x, doc.y, { width: widths[i], continued: i < cols.length - 1 });
    x += widths[i];
  });
  doc.fillColor("black");
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ccc").stroke().strokeColor("black");
  doc.moveDown(0.3);
}

function tableRow(doc, cols, widths) {
  const x0 = 50;
  let x = x0;
  const y = doc.y;
  doc.font("Helvetica").fontSize(10);
  cols.forEach((c, i) => {
    doc.text(c, x, y, { width: widths[i] });
    x += widths[i];
  });
  doc.moveDown(0.5);
}

function totalsRow(doc, label, amount, bold = false) {
  const y = doc.y;
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 13 : 10);
  doc.text(label, 320, y, { width: 130 });
  doc.text(`$${(parseFloat(amount) || 0).toFixed(2)}`, 450, y, { width: 95, align: "right" });
  doc.moveDown(0.4);
}
