/**
 * CSV Export Utility for Orders, Stock Movements, and Payments
 */

function downloadCsv(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportOrdersCsv(orders: any[], filename = "orders_export.csv") {
  const headers = [
    "Order Number",
    "Invoice Number",
    "Date",
    "Client Name",
    "Client Phone",
    "Client GSTIN",
    "Total Amount (INR)",
    "Total Paid (INR)",
    "Balance Amount (INR)",
    "Status",
    "Payment Status",
    "Items Count",
    "Items Details",
  ];

  const rows = orders.map((o) => {
    const itemsStr = (o.items || [])
      .map((i: any) => `${i.name} (Qty: ${i.quantity}, Price: ${i.unitPrice})`)
      .join("; ");

    return [
      escapeCsvCell(o.orderNumber),
      escapeCsvCell(o.invoiceNumber || ""),
      escapeCsvCell(new Date(o.createdAt).toLocaleDateString("en-IN")),
      escapeCsvCell(o.client?.name || ""),
      escapeCsvCell(o.client?.phone || ""),
      escapeCsvCell(o.client?.gstin || ""),
      escapeCsvCell(o.totalAmount || 0),
      escapeCsvCell(o.totalPaid || 0),
      escapeCsvCell(o.balanceAmount || 0),
      escapeCsvCell(o.status || ""),
      escapeCsvCell(o.paymentStatus || ""),
      escapeCsvCell(o.items?.length || 0),
      escapeCsvCell(itemsStr),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  downloadCsv(csv, filename);
}

export function exportMovementsCsv(movements: any[], filename = "stock_movements.csv") {
  const headers = [
    "Timestamp",
    "Type",
    "Product Name",
    "SKU",
    "Quantity",
    "Before Stock",
    "After Stock",
    "Handled By",
    "Reason",
    "Note",
  ];

  const rows = movements.map((m) => {
    const pName = typeof m.product === "object" ? m.product?.name : m.productName || "Unknown";
    const pSku = typeof m.product === "object" ? m.product?.sku : m.productSku || "";

    return [
      escapeCsvCell(new Date(m.createdAt).toLocaleString("en-IN")),
      escapeCsvCell(m.type),
      escapeCsvCell(pName),
      escapeCsvCell(pSku),
      escapeCsvCell(m.quantity),
      escapeCsvCell(m.beforeStock !== undefined ? m.beforeStock : ""),
      escapeCsvCell(m.afterStock !== undefined ? m.afterStock : ""),
      escapeCsvCell(m.userName || "System"),
      escapeCsvCell(m.reason || ""),
      escapeCsvCell(m.note || ""),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  downloadCsv(csv, filename);
}

export function exportPaymentsCsv(payments: any[], filename = "payments_ledger.csv") {
  const headers = [
    "Date",
    "Order Number",
    "Client Name",
    "Amount (INR)",
    "Payment Method",
    "Payment Type",
    "Status",
    "Recorded By",
    "Reference",
  ];

  const rows = payments.map((p) => {
    const oNum = typeof p.order === "object" ? p.order?.orderNumber : p.orderNumber || "";
    const cName = typeof p.order === "object" ? p.order?.client?.name : p.clientName || "";

    return [
      escapeCsvCell(new Date(p.createdAt || p.paymentDate).toLocaleString("en-IN")),
      escapeCsvCell(oNum),
      escapeCsvCell(cName),
      escapeCsvCell(p.amount || 0),
      escapeCsvCell(p.method || "UPI"),
      escapeCsvCell(p.type || "PARTIAL"),
      escapeCsvCell(p.status || "CONFIRMED"),
      escapeCsvCell(p.userName || "Admin"),
      escapeCsvCell(p.reference || p.transactionId || ""),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  downloadCsv(csv, filename);
}
