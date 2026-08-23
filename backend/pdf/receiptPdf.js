import { SHOP_INFO } from "./shopInfo.js";

function fmtDate(d) {
  if (!d) return "TBD";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtMoney(n) {
  if (n === null || n === undefined || n === "") return "TBD";
  return `$${parseFloat(n).toFixed(2)}`;
}

// Renders the "Repair Estimate & Receipt" -- the intake-time document
// (customer's copy for drop-off), matching the shop's original Notion template
// but pulling real data instead of "see properties above".
export function renderReceiptPdf(doc, repair) {
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

  doc.fontSize(16).font("Helvetica-Bold").text("Repair Estimate & Receipt", { align: "center" });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#555")
    .text(
      "Thank you for bringing your instrument in for service. Please keep this receipt -- it may be required for instrument pickup.",
      { align: "center" }
    )
    .fillColor("black");

  doc.moveDown(1.5);

  const row = (label, value) => {
    doc.font("Helvetica-Bold").fontSize(11).text(label, { continued: true });
    doc.font("Helvetica").text(`  ${value ?? "--"}`);
    doc.moveDown(0.4);
  };

  row("Repair Ticket #:", repair.notion_repair_number ?? repair.id);
  row("Status:", repair.status);
  row("Customer:", repair.customer_name);
  row(
    "Instrument:",
    [repair.instrument_name, repair.instrument_type].filter(Boolean).join(" -- ") || "--"
  );
  if (repair.instrument_serial) row("Serial #:", repair.instrument_serial);
  row("Intake Date:", fmtDate(repair.intake_date));
  row("Estimated Completion:", fmtDate(repair.estimated_completion));
  row("Estimated Repair Cost:", fmtMoney(repair.estimated_repair_cost));

  if (repair.title) {
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(11).text("Issue / Notes:");
    doc.font("Helvetica").fontSize(11).text(repair.title);
  }

  doc.moveDown(1.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(12).text("Terms");
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(10)
    .list(
      [
        "This is an estimate only; final cost may vary if additional issues are found during diagnosis.",
        "We will contact you before performing any work beyond the estimated cost.",
        "Please retain this receipt -- it may be required for instrument pickup.",
      ],
      { bulletRadius: 2 }
    );

  doc.moveDown(2);
  doc.font("Helvetica").fontSize(11).text("Customer signature (estimate approval): _______________________________");
}
