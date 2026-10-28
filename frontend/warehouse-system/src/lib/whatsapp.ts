import { formatINR } from "./format";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/**
 * Normalizes and validates Indian phone numbers for WhatsApp:
 * - Keeps digits only
 * - Strips leading 0 or +
 * - Verifies 10-digit Indian mobile number starts with 6, 7, 8, or 9
 * - Returns 12-digit string starting with 91 (e.g., '919876543210')
 * - Returns null when the number is invalid
 */
export function normalizePhone(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  let digits = String(rawPhone).replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
    return digits;
  }
  return null;
}

/**
 * Checks whether an Indian phone number is valid
 */
export function isValidIndianPhone(rawPhone?: string | null): boolean {
  return normalizePhone(rawPhone) !== null;
}

/**
 * Builds a clean, professional invoice summary message
 */
export function buildInvoiceMessage(order: any, pdfPublicUrl?: string): string {
  const sellerName = "DENIKA AND TEAM SOLUTIONS";
  const clientName = order.client?.name || order.clientName || "Valued Customer";
  const orderNumber = order.invoiceNumber || order.orderNumber || order.number || "—";

  const rawDate = order.date || order.createdAt;
  const dateObj = rawDate ? new Date(rawDate) : new Date();
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN");

  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const itemsText = items.length > 0
    ? items
        .map((item: any) => {
          const name = item.name || "Item";
          const qty = item.quantity || 1;
          const unitPrice = item.sellingPrice ?? item.unitPrice ?? 0;
          const amount = qty * unitPrice;
          return `• ${name} x ${qty} - ${formatINR(amount)}`;
        })
        .join("\n")
    : "• Standard warehouse supply items";

  const total = order.totalAmount ?? order.total ?? 0;
  const totalPaid = order.totalPaid ?? 0;
  const balanceDue = order.balanceAmount ?? Math.max(0, total - totalPaid);
  const paymentStatus = (order.paymentStatus || "PENDING").replaceAll("_", " ");

  const pdfSection = pdfPublicUrl
    ? `\n📄 *Download Tax Invoice PDF:*\n${pdfPublicUrl}\n`
    : "";

  return `*${sellerName}*
*Tax Invoice Summary*

Hello ${clientName},

Here are the official tax invoice details for your order:
*Invoice / Order:* #${orderNumber}
*Date:* ${formattedDate}

*Items:*
${itemsText}

*Total Amount:* ${formatINR(total)}
*Amount Paid:* ${formatINR(totalPaid)}
*Balance Due:* ${formatINR(balanceDue)}
*Payment Status:* ${paymentStatus}
${pdfSection}
Thank you for your business!`;
}

/**
 * Builds a clean payment reminder message (supports both object and individual arg signatures)
 */
export function buildPaymentReminderMessage(
  orderOrClientName: any,
  orderNumberOrPdf?: string,
  balanceDueOrUndefined?: number | string
): string {
  const sellerName = "DENIKA AND TEAM SOLUTIONS";
  let clientName = "Valued Customer";
  let orderNumber = "—";
  let total = 0;
  let balanceDue = 0;
  let pdfSection = "";

  if (orderOrClientName && typeof orderOrClientName === "object") {
    const order = orderOrClientName;
    clientName = order.client?.name || order.clientName || "Valued Customer";
    orderNumber = order.invoiceNumber || order.orderNumber || "—";
    total = order.totalAmount ?? 0;
    balanceDue = order.balanceAmount ?? Math.max(0, total - (order.totalPaid ?? 0));
    if (typeof orderNumberOrPdf === "string" && orderNumberOrPdf.startsWith("http")) {
      pdfSection = `\n📄 *Tax Invoice PDF:*\n${orderNumberOrPdf}\n`;
    }
  } else {
    clientName = String(orderOrClientName || "Valued Customer");
    orderNumber = String(orderNumberOrPdf || "—");
    balanceDue = Number(balanceDueOrUndefined) || 0;
    total = balanceDue;
  }

  return `*${sellerName} - Payment Reminder*

Hello ${clientName},

This is a reminder regarding the outstanding balance for Order/Invoice *#${orderNumber}*.

*Balance Payable:* ${formatINR(balanceDue)}
${pdfSection}
Please find the official Tax Invoice attached with UPI QR code. Kindly complete the payment to ensure seamless delivery and processing.

Thank you!`;
}

/**
 * Opens WhatsApp directly to the customer's phone number without showing a contact picker.
 * Uses api.whatsapp.com deep-linking which works for both WhatsApp Web and WhatsApp Desktop.
 */
export function openWhatsApp(phone: string, message: string, targetName: string = "whatsapp_wms_tab"): void {
  const cleanPhone = phone.replace(/\D/g, "");
  const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  window.open(url, targetName, "noopener,noreferrer");
}

/**
 * Fetches the authenticated Invoice PDF as a Blob
 */
export async function fetchInvoicePdfBlob(orderId: string): Promise<Blob> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/orders/${orderId}/invoice.pdf`, {
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to download invoice PDF (Status: ${response.status})`);
  }

  return response.blob();
}

/**
 * Downloads a Blob directly in the browser
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Opens the authenticated Invoice PDF in a new preview tab
 */
export async function viewInvoicePdfInTab(orderId: string): Promise<void> {
  try {
    const blob = await fetchInvoicePdfBlob(orderId);
    const pdfUrl = URL.createObjectURL(blob);
    window.open(pdfUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  } catch (error: any) {
    alert(`Could not open tax invoice PDF: ${error.message}`);
  }
}

export interface SendWhatsAppOptions {
  order: any;
  isReminder?: boolean;
  onToast?: (message: string, type?: "info" | "success" | "error") => void;
  targetTabName?: string;
  forceShare?: boolean;
}

/**
 * Resolves the public API base URL for WhatsApp links.
 * WhatsApp requires a valid domain or dotted IPv4 address (e.g. 192.168.1.X or domain.com).
 * "localhost" is explicitly ignored by WhatsApp's link detector and cannot be reached by mobile devices.
 */
let cachedLanBase: string | null = null;

export async function resolvePublicBaseUrl(): Promise<string> {
  const publicOverride = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim();
  if (publicOverride) {
    return publicOverride.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }

  let base = API_URL.replace(/\/api\/?$/, "");
  if (!base.includes("localhost")) {
    return base;
  }

  if (cachedLanBase) {
    return cachedLanBase;
  }

  if (typeof window !== "undefined" && window.location.hostname && window.location.hostname !== "localhost") {
    cachedLanBase = base.replace("localhost", window.location.hostname);
    return cachedLanBase;
  }

  try {
    const res = await fetch(`${API_URL}/health`);
    if (res.ok) {
      const data = await res.json();
      if (data.publicUrl) {
        cachedLanBase = data.publicUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
        return cachedLanBase;
      }
      if (data.lanIp && data.lanIp !== "127.0.0.1") {
        cachedLanBase = base.replace("localhost", `${data.lanIp}.sslip.io`);
        return cachedLanBase;
      }
    }
  } catch {
    // ignore
  }

  cachedLanBase = base.replace("localhost", "192.168.1.6.sslip.io");
  return cachedLanBase;
}

/**
 * Builds the clickable public URL for a given order's PDF invoice
 */
export async function getPublicInvoiceUrl(order: any): Promise<string> {
  const apiBase = await resolvePublicBaseUrl();
  const invoiceNum = (order.invoiceNumber || order.orderNumber || order._id || order.id || "INV").replace(/[\/\\]/g, "-");
  return `${apiBase}/api/orders/public/${encodeURIComponent(invoiceNum)}/invoice.pdf`;
}

/**
 * Automated WhatsApp Customer Delivery Strategy:
 * 1. Backend WhatsApp Cloud API: If configured on backend, sends invoice PDF headless in background.
 * 2. Direct Customer WhatsApp Delivery:
 *    - Automatically downloads the official invoice PDF locally.
 *    - Generates a direct clickable public invoice PDF link in the pre-filled message.
 *    - Opens WhatsApp directly targeted to the customer's mobile number (+91...).
 *    - NEVER invokes OS Web Share API with generic file when customer phone is known.
 */
export async function sendInvoiceWhatsAppTiered({
  order,
  isReminder = false,
  onToast = (msg) => console.log(msg),
  targetTabName = "whatsapp_wms_invoice_tab",
  forceShare = false,
}: SendWhatsAppOptions): Promise<{ success: boolean; tier: "cloud" | "direct" | "share"; message?: string }> {
  const rawPhone = order.client?.phone || order.phone;
  const normalizedPhone = normalizePhone(rawPhone);

  if (!normalizedPhone) {
    throw new Error(`Invalid Indian phone number: "${rawPhone || "empty"}". Must be 10 digits starting with 6-9.`);
  }

  const orderId = order._id || order.id;
  const invoiceNumber = (order.invoiceNumber || order.orderNumber || "INV").replace(/[\/\\]/g, "-");
  const filename = `Invoice-${invoiceNumber}.pdf`;

  // Public clickable direct PDF link using dotted IP or domain so WhatsApp recognizes it as a clickable URL
  const publicPdfUrl = await getPublicInvoiceUrl(order);

  const messageText = isReminder
    ? buildPaymentReminderMessage(order, publicPdfUrl)
    : buildInvoiceMessage(order, publicPdfUrl);

  // ─── TIER A: WhatsApp Cloud API on Backend (Headless Automated Delivery) ──
  try {
    const token = localStorage.getItem("token");
    const cloudRes = await fetch(`${API_URL}/orders/${orderId}/send-invoice-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ isReminder }),
    });

    const cloudData = await cloudRes.json().catch(() => ({}));
    if (cloudRes.ok && cloudData.success) {
      onToast(`Invoice PDF dispatched automatically to +${normalizedPhone} via WhatsApp Cloud API!`, "success");
      return { success: true, tier: "cloud", message: "Sent via WhatsApp Cloud API" };
    } else if (cloudData.message && !cloudData.message.includes("not configured")) {
      console.warn("WhatsApp Cloud API error:", cloudData.message);
      onToast(`WhatsApp Cloud API: ${cloudData.message}`, "error");
    }
  } catch (err: any) {
    // Cloud API not configured or network error; smoothly fall through to direct customer number chat
    console.debug("WhatsApp Cloud API bypass:", err?.message);
  }

  // ─── TIER B: Direct Customer WhatsApp Deep Link ─────────────────────────
  // Directly targets the customer's phone number entered during billing.
  // Bypasses the generic "Send message to: Select contact" popup.
  openWhatsApp(normalizedPhone, messageText, targetTabName);
  onToast(`Opening WhatsApp chat for +${normalizedPhone} with invoice PDF link`, "success");

  return {
    success: true,
    tier: "direct",
    message: `Direct chat opened for +${normalizedPhone}`,
  };
}
