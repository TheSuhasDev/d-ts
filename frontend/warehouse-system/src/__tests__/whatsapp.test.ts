import { describe, it, expect } from "vitest";
import { normalizePhone, isValidIndianPhone, buildInvoiceMessage, buildPaymentReminderMessage } from "../lib/whatsapp";

describe("WhatsApp Utilities & Message Generators", () => {
  it("normalizes phone numbers to standard 12-digit Indian format (91XXXXXXXXXX)", () => {
    expect(normalizePhone("9876543210")).toBe("919876543210");
    expect(normalizePhone("+91 98765 43210")).toBe("919876543210");
    expect(normalizePhone("09876543210")).toBe("919876543210");
    expect(normalizePhone("919876543210")).toBe("919876543210");
  });

  it("rejects invalid phone numbers", () => {
    expect(isValidIndianPhone("12345")).toBe(false);
    expect(isValidIndianPhone("5123456789")).toBe(false); // Does not start with 6-9
    expect(isValidIndianPhone("")).toBe(false);
    expect(isValidIndianPhone(null)).toBe(false);
  });

  it("builds a comprehensive, branded tax invoice message", () => {
    const mockOrder = {
      orderNumber: "ORD/26-27/0001",
      invoiceNumber: "INV/26-27/0001",
      client: { name: "Bangalore Fabricators" },
      items: [
        { name: "Drill", quantity: 2, unitPrice: 1500 },
        { name: "Hammer", quantity: 1, unitPrice: 420 },
      ],
      totalAmount: 3420,
      totalPaid: 1000,
      balanceAmount: 2420,
      paymentStatus: "ADVANCE_RECEIVED",
    };

    const message = buildInvoiceMessage(mockOrder);
    expect(message).toContain("DENIKA AND TEAM SOLUTIONS");
    expect(message).toContain("Bangalore Fabricators");
    expect(message).toContain("INV/26-27/0001");
    expect(message).toContain("Drill x 2");
    expect(message).toContain("ADVANCE RECEIVED");
  });

  it("builds an urgent payment reminder message with outstanding balance", () => {
    const mockOrder = {
      orderNumber: "ORD/26-27/0002",
      client: { name: "Kolar Metals" },
      totalAmount: 10000,
      totalPaid: 3000,
      balanceAmount: 7000,
    };

    const message = buildPaymentReminderMessage(mockOrder);
    expect(message).toContain("Payment Reminder");
    expect(message).toContain("Kolar Metals");
    expect(message).toContain("ORD/26-27/0002");
    expect(message).toMatch(/₹\s?7,000/);
  });

  it("includes clickable PDF invoice link in message when provided", () => {
    const mockOrder = {
      orderNumber: "ORD/26-27/0003",
      invoiceNumber: "INV/26-27/0003",
      client: { name: "Mysore Steel" },
      items: [{ name: "Safety Helmet", quantity: 5, unitPrice: 200 }],
      totalAmount: 1000,
      totalPaid: 1000,
      balanceAmount: 0,
      paymentStatus: "PAID",
    };
    const pdfUrl = "http://localhost:5000/api/orders/public/6ae1594fb2113a0fa8244095/invoice.pdf";
    const message = buildInvoiceMessage(mockOrder, pdfUrl);
    expect(message).toContain("Download Tax Invoice PDF:");
    expect(message).toContain(pdfUrl);
  });
});

