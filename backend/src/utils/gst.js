/**
 * GST Calculation Utility for Indian Tax Invoices & Bills of Supply
 * Karnataka State Code: 29
 */

export const KARNATAKA_STATE_CODE = "29";

export const PLACEHOLDER_GSTINS = new Set([
  "",
  "PLACEHOLDER",
  "29ABCDE1234F1Z5",
  "N/A",
  "NONE",
]);

/**
 * Checks if a GSTIN is empty, invalid, or a known demo/placeholder value
 */
export function isPlaceholderGstin(gstin) {
  if (!gstin) return true;
  const clean = String(gstin).trim().toUpperCase();
  if (PLACEHOLDER_GSTINS.has(clean)) return true;
  // Standard 15-digit alphanumeric Indian GSTIN regex
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return !gstRegex.test(clean);
}

/**
 * Extracts state code from GSTIN or falls back based on address keywords
 */
export function extractStateCode(gstin, address = "") {
  if (gstin && typeof gstin === "string" && gstin.trim().length >= 2) {
    const code = gstin.trim().slice(0, 2);
    if (/^\d{2}$/.test(code)) return code;
  }

  const addr = String(address).toLowerCase();
  if (addr.includes("karnataka") || addr.includes("bengaluru") || addr.includes("bangalore") || addr.includes("mysore") || addr.includes("peenya")) {
    return KARNATAKA_STATE_CODE;
  }
  if (addr.includes("maharashtra") || addr.includes("mumbai") || addr.includes("pune")) return "27";
  if (addr.includes("tamil nadu") || addr.includes("chennai")) return "33";
  if (addr.includes("delhi")) return "07";
  if (addr.includes("telangana") || addr.includes("hyderabad")) return "36";
  if (addr.includes("gujarat") || addr.includes("ahmedabad")) return "24";

  return KARNATAKA_STATE_CODE;
}

/**
 * Computes full line-item & invoice GST breakdown (Intra-State CGST+SGST vs Inter-State IGST)
 */
export function calculateInvoiceGst(order, sellerGstin = process.env.COMPANY_GSTIN) {
  const isPlaceholderSeller = isPlaceholderGstin(sellerGstin);
  const sellerState = extractStateCode(sellerGstin, process.env.COMPANY_ADDRESS || "Karnataka");
  
  const client = order.client || {};
  const buyerGstin = client.gstin || "";
  const buyerState = extractStateCode(buyerGstin, client.address || "");
  const isIntraState = sellerState === buyerState;

  const rawItems = Array.isArray(order.items) ? order.items : [];
  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const calculatedItems = rawItems.map((item, idx) => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice ?? item.sellingPrice) || 0;
    const taxableAmount = Math.round(qty * unitPrice * 100) / 100;
    subtotal += taxableAmount;

    const hsn = item.hsn || (item.product && typeof item.product === "object" ? item.product.hsn : null) || "8205";
    const gstPercent = isPlaceholderSeller
      ? 0
      : Number(item.gstPercent ?? (item.product && typeof item.product === "object" ? item.product.gstPercent : 18));

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (!isPlaceholderSeller && gstPercent > 0) {
      if (isIntraState) {
        cgstRate = gstPercent / 2;
        sgstRate = gstPercent / 2;
        cgstAmount = Math.round(taxableAmount * (cgstRate / 100) * 100) / 100;
        sgstAmount = Math.round(taxableAmount * (sgstRate / 100) * 100) / 100;
        totalCgst += cgstAmount;
        totalSgst += sgstAmount;
      } else {
        igstRate = gstPercent;
        igstAmount = Math.round(taxableAmount * (igstRate / 100) * 100) / 100;
        totalIgst += igstAmount;
      }
    }

    const itemTax = cgstAmount + sgstAmount + igstAmount;
    const totalWithTax = Math.round((taxableAmount + itemTax) * 100) / 100;

    return {
      index: idx + 1,
      productId: item.product?._id || item.product,
      name: item.name || "Tool Supply",
      sku: item.sku || "—",
      hsn,
      quantity: qty,
      unitPrice,
      taxableAmount,
      gstPercent,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      taxAmount: itemTax,
      totalAmount: totalWithTax,
    };
  });

  const totalTax = Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100;
  // If order.totalAmount is already set and higher or equal, respect it or use calculated grandTotal
  const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;

  const isTaxInvoice = !isPlaceholderSeller;
  const documentTitle = isTaxInvoice ? "TAX INVOICE" : "Bill of Supply / Estimate";
  const badgeText = isTaxInvoice ? "GST REGISTERED" : "BILL OF SUPPLY";
  const placeOfSupply = isIntraState ? `${sellerState} - Karnataka (Intra-State)` : `${buyerState} - Inter-State`;

  return {
    isTaxInvoice,
    documentTitle,
    badgeText,
    isIntraState,
    sellerGstin: sellerGstin || "N/A",
    buyerGstin: buyerGstin || "Unregistered Consumer",
    placeOfSupply,
    subtotal: Math.round(subtotal * 100) / 100,
    totalCgst: Math.round(totalCgst * 100) / 100,
    totalSgst: Math.round(totalSgst * 100) / 100,
    totalIgst: Math.round(totalIgst * 100) / 100,
    totalTax,
    grandTotal,
    items: calculatedItems,
  };
}
