import { calculateInvoiceGst, isPlaceholderGstin, extractStateCode } from "../src/utils/gst.js";

describe("GST Calculations & Tax Invoice Logic", () => {
  const sellerGstin = "29AABCU9603R1ZM"; // Karnataka (29)

  const sampleItems = [
    {
      name: "Drill",
      sku: "DRL001",
      quantity: 2,
      unitPrice: 1650,
      hsn: "8467",
      gstPercent: 18,
    },
    {
      name: "Hammer",
      sku: "HAM001",
      quantity: 1,
      unitPrice: 420,
      hsn: "8205",
      gstPercent: 18,
    },
  ];

  test("correctly detects placeholder or invalid seller GSTINs", () => {
    expect(isPlaceholderGstin("")).toBe(true);
    expect(isPlaceholderGstin("PLACEHOLDER")).toBe(true);
    expect(isPlaceholderGstin("29ABCDE1234F1Z5")).toBe(true);
    expect(isPlaceholderGstin(null)).toBe(true);
    expect(isPlaceholderGstin("29AABCU9603R1ZM")).toBe(false);
  });

  test("extracts state code from GSTIN or address correctly", () => {
    expect(extractStateCode("29AABCU9603R1ZM")).toBe("29");
    expect(extractStateCode("27AABCU9603R1ZM")).toBe("27");
    expect(extractStateCode("", "Bangalore, Karnataka")).toBe("29");
    expect(extractStateCode("", "Mumbai, Maharashtra")).toBe("27");
  });

  test("calculates intra-state CGST (9%) and SGST (9%) for Karnataka buyer", () => {
    const order = {
      client: {
        name: "Local Customer",
        address: "Bengaluru, Karnataka",
        gstin: "29AABCU9999R1Z1",
      },
      items: sampleItems,
    };

    const res = calculateInvoiceGst(order, sellerGstin);

    // Total taxable = (2 * 1650) + (1 * 420) = 3300 + 420 = 3720
    expect(res.subtotal).toBe(3720);
    expect(res.isIntraState).toBe(true);
    expect(res.isTaxInvoice).toBe(true);
    expect(res.documentTitle).toBe("TAX INVOICE");
    expect(res.badgeText).toBe("GST REGISTERED");

    // 18% tax on 3720 = 669.60 -> CGST: 334.80, SGST: 334.80
    expect(res.totalCgst).toBe(334.8);
    expect(res.totalSgst).toBe(334.8);
    expect(res.totalIgst).toBe(0);
    expect(res.totalTax).toBe(669.6);
    expect(res.grandTotal).toBe(4389.6);
  });

  test("calculates inter-state IGST (18%) for outside Karnataka buyer", () => {
    const order = {
      client: {
        name: "Outstation Client",
        address: "Chennai, Tamil Nadu",
        gstin: "33AABCU9999R1Z2",
      },
      items: sampleItems,
    };

    const res = calculateInvoiceGst(order, sellerGstin);

    expect(res.subtotal).toBe(3720);
    expect(res.isIntraState).toBe(false);
    expect(res.totalCgst).toBe(0);
    expect(res.totalSgst).toBe(0);
    expect(res.totalIgst).toBe(669.6);
    expect(res.totalTax).toBe(669.6);
    expect(res.grandTotal).toBe(4389.6);
  });

  test("renders Bill of Supply / Estimate with zero tax if seller GSTIN is placeholder", () => {
    const order = {
      client: {
        name: "Test Client",
        address: "Bengaluru",
      },
      items: sampleItems,
    };

    const res = calculateInvoiceGst(order, "29ABCDE1234F1Z5"); // placeholder

    expect(res.isTaxInvoice).toBe(false);
    expect(res.documentTitle).toBe("Bill of Supply / Estimate");
    expect(res.badgeText).toBe("BILL OF SUPPLY");
    expect(res.totalTax).toBe(0);
    expect(res.grandTotal).toBe(3720);
  });
});
