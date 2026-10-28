/**
 * Frontend GST Calculation Utility for Invoice Modal
 */

export const KARNATAKA_STATE_CODE = "29";

export const PLACEHOLDER_GSTINS = new Set([
  "",
  "PLACEHOLDER",
  "29ABCDE1234F1Z5",
  "N/A",
  "NONE",
]);

export function isPlaceholderGstin(gstin?: string | null): boolean {
  if (!gstin) return true;
  const clean = String(gstin).trim().toUpperCase();
  if (PLACEHOLDER_GSTINS.has(clean)) return true;
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return !gstRegex.test(clean);
}

export function extractStateCode(gstin?: string | null, address: string = ""): string {
  if (gstin && typeof gstin === "string" && gstin.trim().length >= 2) {
    const code = gstin.trim().slice(0, 2);
    if (/^\d{2}$/.test(code)) return code;
  }

  const addr = String(address).toLowerCase();
  if (addr.includes("karnataka") || addr.includes("bengaluru") || addr.includes("bangalore") || addr.includes("peenya")) {
    return KARNATAKA_STATE_CODE;
  }
  if (addr.includes("maharashtra") || addr.includes("mumbai")) return "27";
  if (addr.includes("tamil nadu") || addr.includes("chennai")) return "33";
  if (addr.includes("delhi")) return "07";
  return KARNATAKA_STATE_CODE;
}

export interface CalculatedGstItem {
  name: string;
  sku: string;
  hsn: string;
  quantity: number;
  unitPrice: number;
  taxableAmount: number;
  gstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface InvoiceGstDetails {
  isTaxInvoice: boolean;
  isBillOfSupply: boolean;
  documentTitle: string;
  docTitle: string;
  badgeText: string;
  badgeLabel: string;
  isIntraState: boolean;
  placeOfSupply: string;
  sellerGstin: string;
  subtotal: number;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  grandTotal: number;
  items: CalculatedGstItem[];
}

export function computeInvoiceGst(
  order: any,
  sellerStateOrGstin: string = "Karnataka",
  explicitSellerGstin?: string,
): InvoiceGstDetails {
  // Allow computeInvoiceGst(order, sellerGstin) or computeInvoiceGst(order, sellerState, sellerGstin)
  let effectiveSellerGstin = explicitSellerGstin;
  if (!effectiveSellerGstin) {
    if (sellerStateOrGstin && sellerStateOrGstin.length > 10) {
      effectiveSellerGstin = sellerStateOrGstin;
    } else {
      effectiveSellerGstin = import.meta.env.VITE_COMPANY_GSTIN || "29AABCU9603R1ZM";
    }
  }

  const isPlaceholderSeller = isPlaceholderGstin(effectiveSellerGstin);
  const sellerState = extractStateCode(effectiveSellerGstin, "Karnataka");

  const client = order.client || {};
  const buyerGstin = client.gstin || "";
  const buyerState = extractStateCode(buyerGstin, client.address || "");
  const isIntraState = sellerState === buyerState;

  const rawItems = Array.isArray(order.items) ? order.items : [];
  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const items: CalculatedGstItem[] = rawItems.map((item: any) => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.sellingPrice ?? item.unitPrice) || 0;
    const taxableAmount = Math.round(qty * unitPrice * 100) / 100;
    subtotal += taxableAmount;

    const hsn = item.hsn || "8205";
    const gstPercent = isPlaceholderSeller ? 0 : Number(item.gstPercent ?? 18);

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (!isPlaceholderSeller && gstPercent > 0) {
      if (isIntraState) {
        cgstAmount = Math.round(taxableAmount * (gstPercent / 2 / 100) * 100) / 100;
        sgstAmount = Math.round(taxableAmount * (gstPercent / 2 / 100) * 100) / 100;
        totalCgst += cgstAmount;
        totalSgst += sgstAmount;
      } else {
        igstAmount = Math.round(taxableAmount * (gstPercent / 100) * 100) / 100;
        totalIgst += igstAmount;
      }
    }

    const totalAmount = Math.round((taxableAmount + cgstAmount + sgstAmount + igstAmount) * 100) / 100;

    return {
      name: item.name || "Tool Supply",
      sku: item.sku || "—",
      hsn,
      quantity: qty,
      unitPrice,
      taxableAmount,
      gstPercent,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
    };
  });

  const totalTax = Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100;
  const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;
  const isTaxInvoice = !isPlaceholderSeller;
  const isBillOfSupply = !isTaxInvoice;
  const docTitle = isTaxInvoice ? "OFFICIAL TAX INVOICE" : "BILL OF SUPPLY / ESTIMATE";
  const badgeLabel = isTaxInvoice ? "GST REGISTERED (KARNATAKA - 29)" : "BILL OF SUPPLY / ESTIMATE";

  return {
    isTaxInvoice,
    isBillOfSupply,
    documentTitle: docTitle,
    docTitle,
    badgeText: badgeLabel,
    badgeLabel,
    isIntraState,
    placeOfSupply: isIntraState ? "Karnataka (29)" : `${buyerState} - Inter-State`,
    sellerGstin: isPlaceholderSeller ? "" : effectiveSellerGstin,
    subtotal: Math.round(subtotal * 100) / 100,
    taxableAmount: Math.round(subtotal * 100) / 100,
    totalCgst: Math.round(totalCgst * 100) / 100,
    totalSgst: Math.round(totalSgst * 100) / 100,
    totalIgst: Math.round(totalIgst * 100) / 100,
    totalTax,
    grandTotal,
    items,
  };
}
