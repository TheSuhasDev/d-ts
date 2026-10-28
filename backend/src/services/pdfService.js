import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { calculateInvoiceGst } from "../utils/gst.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converts a number to Indian currency in words
 */
const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function numToWordsUnderThousand(n) {
  let str = "";
  if (n >= 100) {
    str += ones[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    str += tens[Math.floor(n / 10)] + " ";
    n %= 10;
  }
  if (n > 0) {
    str += ones[n] + " ";
  }
  return str.trim();
}

export function numberToWordsINR(amount) {
  const num = Math.floor(Math.abs(Number(amount) || 0));
  const paise = Math.round((Math.abs(Number(amount) || 0) - num) * 100);

  if (num === 0 && paise === 0) return "Rupees Zero Only";

  let words = "";
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = num % 1000;

  if (crore > 0) words += `${numToWordsUnderThousand(crore)} Crore `;
  if (lakh > 0) words += `${numToWordsUnderThousand(lakh)} Lakh `;
  if (thousand > 0) words += `${numToWordsUnderThousand(thousand)} Thousand `;
  if (hundred > 0) words += `${numToWordsUnderThousand(hundred)} `;

  words = `Rupees ${words.trim()}`;
  if (paise > 0) {
    words += ` and ${numToWordsUnderThousand(paise)} Paise`;
  }
  words += " Only";
  return words;
}

/**
 * Formats currency in Indian format
 */
export function formatCurrencyINR(val) {
  const num = Number(val) || 0;
  return `Rs. ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Generates an A4 GST Tax Invoice PDF matching the exact on-screen Denika & Team Solutions design
 */
export async function generateInvoicePDF(order) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 36,
        info: {
          Title: `Tax Invoice - ${order.invoiceNumber || order.orderNumber}`,
          Author: "Denika and Team Solutions",
          Subject: "Official Tax Invoice",
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const companyName = process.env.COMPANY_NAME || "DENIKA AND TEAM SOLUTIONS";
      const companyAddress = process.env.COMPANY_ADDRESS || "Plot 42, Peenya Industrial Area, Phase II, Bengaluru, Karnataka 560058";
      const companyGstin = process.env.COMPANY_GSTIN || "29AABCU9603R1ZM";
      const companyPhone = process.env.COMPANY_PHONE || "+91 98765 43210";
      const companyEmail = process.env.COMPANY_EMAIL || "billing@denikasolutions.com";
      const upiId = process.env.UPI_VPA || process.env.UPI_ID || "denikasolutions@upi";

      const gstInfo = calculateInvoiceGst(order, companyGstin);

      const invoiceNumber = order.invoiceNumber || (order.orderNumber ? `#${order.orderNumber}` : "#INV");
      const displayInvoiceNo = invoiceNumber.startsWith("#") ? invoiceNumber : `#${invoiceNumber}`;
      const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
      const formattedDate = orderDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const client = order.client || {};
      const logoPath = path.join(__dirname, "../assets/logo2.png");
      const hasLogo = fs.existsSync(logoPath);

      const pageWidth = 595.28;
      const leftMargin = 36;
      const contentWidth = pageWidth - leftMargin * 2; // 523.28 pt

      let y = 36;

      // ─── 1. Header (Logo + Brand + Meta Block) ───────────────────
      let headerTextX = leftMargin;
      if (hasLogo) {
        doc.image(logoPath, leftMargin, y, { width: 44, height: 44 });
        headerTextX = leftMargin + 52;
      }

      // Title & Subtitle
      doc.fillColor("#090d16").font("Helvetica-Bold").fontSize(15).text("DENIKA AND TEAM SOLUTIONS", headerTextX, y + 4);
      doc.fillColor("#475569").font("Helvetica-Bold").fontSize(8).text(gstInfo.documentTitle.toUpperCase(), headerTextX, y + 24);

      // Top Right: Invoice Number, Date, GST Badge
      const rightColX = 360;
      const rightColW = leftMargin + contentWidth - rightColX;
      doc.fillColor("#1e1b4b").font("Helvetica-Bold").fontSize(12).text(displayInvoiceNo, rightColX, y + 2, {
        width: rightColW,
        align: "right",
      });
      doc.fillColor("#475569").font("Helvetica").fontSize(8.5).text(`Date: ${formattedDate}`, rightColX, y + 17, {
        width: rightColW,
        align: "right",
      });

      // Status Badge (GST REGISTERED or BILL OF SUPPLY)
      const badgeW = 95;
      const badgeH = 14;
      const badgeX = leftMargin + contentWidth - badgeW;
      const badgeY = y + 30;
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5).fillAndStroke(gstInfo.isTaxInvoice ? "#f1f5f9" : "#fff7ed", gstInfo.isTaxInvoice ? "#cbd5e1" : "#fed7aa");
      doc.fillColor(gstInfo.isTaxInvoice ? "#1e293b" : "#9a3412").font("Helvetica-Bold").fontSize(7).text(gstInfo.badgeText, badgeX, badgeY + 3.5, {
        width: badgeW,
        align: "center",
      });

      y += 50;

      // Header Bottom Divider
      doc.rect(leftMargin, y, contentWidth, 1.5).fill("#090d16");
      y += 10;

      // ─── 2. Seller & Buyer Cards (Side-by-Side) ──────────────────
      const cardGap = 12;
      const cardW = (contentWidth - cardGap) / 2;
      const cardH = 96;

      // Left: SELLER / CONSIGNOR
      doc.roundedRect(leftMargin, y, cardW, cardH, 6).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7).text("SELLER / CONSIGNOR", leftMargin + 10, y + 7);
      doc.fillColor("#090d16").font("Helvetica-Bold").fontSize(9).text(companyName, leftMargin + 10, y + 18);
      doc.font("Helvetica").fontSize(7.5).fillColor("#475569");
      doc.text(companyAddress, leftMargin + 10, y + 30, { width: cardW - 20 });
      doc.text(`Phone: ${companyPhone} | Email: ${companyEmail}`, leftMargin + 10, y + 54);
      doc.font("Helvetica-Bold").fillColor("#1e293b").text(`GSTIN: ${gstInfo.sellerGstin}`, leftMargin + 10, y + 68);
      doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(`State: 29 - Karnataka`, leftMargin + 10, y + 80);

      // Right: BILL TO / CONSIGNEE
      const rightCardX = leftMargin + cardW + cardGap;
      doc.roundedRect(rightCardX, y, cardW, cardH, 6).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7).text("BILL TO / CONSIGNEE", rightCardX + 10, y + 7);
      doc.fillColor("#090d16").font("Helvetica-Bold").fontSize(9).text(client.name || "Valued Customer", rightCardX + 10, y + 18);
      doc.font("Helvetica").fontSize(7.5).fillColor("#475569");
      doc.text(`Phone: ${client.phone || "—"}`, rightCardX + 10, y + 30);
      doc.text(client.address || "Karnataka, India", rightCardX + 10, y + 42, { width: cardW - 20 });
      doc.font("Helvetica-Bold").fillColor("#1e293b").text(`GSTIN: ${client.gstin || "Consumer (Unregistered)"}`, rightCardX + 10, y + 68);
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#4338ca").text(`Place of Supply: ${gstInfo.placeOfSupply}`, rightCardX + 10, y + 80);

      y += cardH + 12;

      // ─── 3. Line Items Table (with HSN & GST Rate) ───────────────
      const colW = {
        sr: 24,
        desc: 170,
        hsn: 55,
        qty: 36,
        rate: 74,
        gst: 46,
        amount: 88.28,
      };

      // Header row
      doc.rect(leftMargin, y, contentWidth, 20).fillAndStroke("#f1f5f9", "#cbd5e1");
      doc.fillColor("#334155").font("Helvetica-Bold").fontSize(7.5);

      let curX = leftMargin;
      doc.text("#", curX, y + 6, { width: colW.sr, align: "center" });
      curX += colW.sr;
      doc.text("PRODUCT DESCRIPTION", curX + 4, y + 6, { width: colW.desc - 4 });
      curX += colW.desc;
      doc.text("HSN", curX, y + 6, { width: colW.hsn, align: "center" });
      curX += colW.hsn;
      doc.text("QTY", curX, y + 6, { width: colW.qty, align: "center" });
      curX += colW.qty;
      doc.text("UNIT PRICE", curX, y + 6, { width: colW.rate - 6, align: "right" });
      curX += colW.rate;
      doc.text("GST %", curX, y + 6, { width: colW.gst, align: "center" });
      curX += colW.gst;
      doc.text("AMOUNT", curX, y + 6, { width: colW.amount - 6, align: "right" });

      y += 20;

      gstInfo.items.forEach((item, index) => {
        const rowBg = index % 2 === 0 ? "#ffffff" : "#fafafa";
        doc.rect(leftMargin, y, contentWidth, 22).fillAndStroke(rowBg, "#f1f5f9");

        curX = leftMargin;
        doc.fillColor("#64748b").font("Helvetica").fontSize(7.5).text(String(index + 1), curX, y + 6, {
          width: colW.sr,
          align: "center",
        });
        curX += colW.sr;

        doc.fillColor("#090d16").font("Helvetica-Bold").fontSize(8).text(item.name, curX + 4, y + 6, {
          width: colW.desc - 4,
          lineBreak: false,
        });
        curX += colW.desc;

        doc.fillColor("#475569").font("Helvetica").fontSize(7.5).text(item.hsn, curX, y + 6, {
          width: colW.hsn,
          align: "center",
        });
        curX += colW.hsn;

        doc.fillColor("#090d16").font("Helvetica-Bold").fontSize(8).text(String(item.quantity), curX, y + 6, {
          width: colW.qty,
          align: "center",
        });
        curX += colW.qty;

        doc.fillColor("#334155").font("Helvetica").fontSize(7.5).text(formatCurrencyINR(item.unitPrice), curX, y + 6, {
          width: colW.rate - 6,
          align: "right",
        });
        curX += colW.rate;

        doc.fillColor("#64748b").font("Helvetica").fontSize(7.5).text(gstInfo.isTaxInvoice ? `${item.gstPercent}%` : "0%", curX, y + 6, {
          width: colW.gst,
          align: "center",
        });
        curX += colW.gst;

        doc.fillColor("#090d16").font("Helvetica-Bold").fontSize(8).text(formatCurrencyINR(item.taxableAmount), curX, y + 6, {
          width: colW.amount - 6,
          align: "right",
        });

        y += 22;
      });

      // Pad empty rows if fewer than 3 items
      if (gstInfo.items.length < 3) {
        for (let r = gstInfo.items.length; r < 3; r++) {
          const rowBg = r % 2 === 0 ? "#ffffff" : "#fafafa";
          doc.rect(leftMargin, y, contentWidth, 20).fillAndStroke(rowBg, "#f1f5f9");
          y += 20;
        }
      }

      y += 8;

      // ─── 4. Amount in Words & Totals Summary ──────────────────────
      const grandTotal = gstInfo.grandTotal;
      const totalPaid = Number(order.totalPaid) || 0;
      const balanceAmount = Number(order.balanceAmount || Math.max(0, grandTotal - totalPaid));
      const advancePercentage = Number(order.advancePercentage || 30);
      const advanceRequired = Number(order.advanceRequired || Math.round(grandTotal * (advancePercentage / 100)));
      const paymentStatus = order.paymentStatus || (balanceAmount === 0 ? "FULLY_PAID" : "ADVANCE_PENDING");

      const summaryLeftW = 270;
      const summaryRightW = contentWidth - summaryLeftW - 14;
      const summaryH = 100;

      // Left Box: AMOUNT IN WORDS + UPI QR Code
      doc.roundedRect(leftMargin, y, summaryLeftW, summaryH, 6).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7).text("AMOUNT IN WORDS", leftMargin + 10, y + 8);
      doc.fillColor("#090d16").font("Helvetica-Bold").fontSize(8.5).text(numberToWordsINR(grandTotal), leftMargin + 10, y + 20, {
        width: summaryLeftW - (balanceAmount > 0 ? 80 : 20),
      });

      // Payment terms note
      doc.fillColor("#475569").font("Helvetica").fontSize(7).text(
        `Terms: Advance ${advancePercentage}% required. Settlement due on order dispatch.`,
        leftMargin + 10,
        y + 64,
        { width: summaryLeftW - 85 }
      );

      if (balanceAmount > 0) {
        const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent("Denika and Team Solutions")}&am=${balanceAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoiceNumber)}`;
        const qrBuffer = await QRCode.toBuffer(upiLink, { width: 56, margin: 0 });
        doc.image(qrBuffer, leftMargin + summaryLeftW - 66, y + 16, { width: 56, height: 56 });
        doc.fillColor("#475569").font("Helvetica-Bold").fontSize(6).text("SCAN TO PAY UPI", leftMargin + summaryLeftW - 66, y + 78, {
          width: 56,
          align: "center",
        });
      }

      // Right Box: Totals breakdown
      const rightTotalsX = leftMargin + summaryLeftW + 14;
      const printRow = (label, val, rowY, isBold = false) => {
        doc.fillColor(isBold ? "#090d16" : "#475569").font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(isBold ? 9 : 8);
        doc.text(label, rightTotalsX, rowY);
        doc.text(val, rightTotalsX, rowY, { width: summaryRightW, align: "right" });
      };

      let rowY = y + 4;
      printRow("Taxable Amount:", formatCurrencyINR(gstInfo.subtotal), rowY);
      rowY += 13;

      if (gstInfo.isTaxInvoice) {
        if (gstInfo.isIntraState) {
          printRow("CGST (Intra-State):", formatCurrencyINR(gstInfo.totalCgst), rowY);
          rowY += 13;
          printRow("SGST (Intra-State):", formatCurrencyINR(gstInfo.totalSgst), rowY);
          rowY += 13;
        } else {
          printRow("IGST (Inter-State):", formatCurrencyINR(gstInfo.totalIgst), rowY);
          rowY += 13;
        }
      } else {
        printRow("Tax (Bill of Supply):", formatCurrencyINR(0), rowY);
        rowY += 13;
      }

      doc.rect(rightTotalsX, rowY + 4, summaryRightW, 1.5).fill("#090d16");
      doc.fillColor("#090d16").font("Helvetica-Bold").fontSize(11).text("GRAND TOTAL:", rightTotalsX, rowY + 11);
      doc.font("Helvetica-Bold").fontSize(11).text(formatCurrencyINR(grandTotal), rightTotalsX, rowY + 11, {
        width: summaryRightW,
        align: "right",
      });

      y += summaryH + 10;

      // ─── 5. Advance & Payment Status Bar (4 Columns) ─────────────
      const barH = 38;
      doc.roundedRect(leftMargin, y, contentWidth, barH, 6).fillAndStroke("#f8fafc", "#e2e8f0");
      const barColW = contentWidth / 4;

      // Column 1: ADVANCE
      doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7).text("ADVANCE", leftMargin + 10, y + 7);
      doc.fillColor("#090d16").font("Helvetica-Bold").fontSize(8.5).text(`${advancePercentage}% · ${formatCurrencyINR(advanceRequired)}`, leftMargin + 10, y + 19);

      // Column 2: PAYMENT STATUS
      doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7).text("PAYMENT STATUS", leftMargin + barColW + 6, y + 7);
      const statusFormatted = paymentStatus.replace(/_/g, " ");
      doc.fillColor("#312e81").font("Helvetica-Bold").fontSize(8.5).text(statusFormatted, leftMargin + barColW + 6, y + 19);

      // Column 3: TOTAL PAID
      doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7).text("TOTAL PAID", leftMargin + barColW * 2 + 6, y + 7);
      doc.fillColor("#065f46").font("Helvetica-Bold").fontSize(8.5).text(formatCurrencyINR(totalPaid), leftMargin + barColW * 2 + 6, y + 19);

      // Column 4: BALANCE DUE
      doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7).text("BALANCE DUE", leftMargin + barColW * 3 + 6, y + 7);
      doc.fillColor(balanceAmount > 0 ? "#9f1239" : "#065f46").font("Helvetica-Bold").fontSize(8.5).text(formatCurrencyINR(balanceAmount), leftMargin + barColW * 3 + 6, y + 19);

      y += barH + 16;

      // ─── 6. Footer (Thanks & Signatures) ─────────────────────────
      doc.rect(leftMargin, y, contentWidth, 0.5).fill("#cbd5e1");
      y += 8;

      // Left: Thank you note & Place of Supply
      doc.fillColor("#475569").font("Helvetica-Oblique").fontSize(8.5).text("Thank you for your business.", leftMargin, y + 2);
      doc.fillColor("#94a3b8").font("Helvetica").fontSize(7).text(
        gstInfo.isTaxInvoice ? "Subject to Bengaluru jurisdiction · Computer-generated tax invoice." : "Bill of Supply issued under Section 31(3)(c) of the CGST Act.",
        leftMargin,
        y + 15
      );

      // Right: Signatory
      const signX = 350;
      const signW = leftMargin + contentWidth - signX;
      doc.fillColor("#090d16").font("Helvetica-Bold").fontSize(7.5).text("For Denika and Team Solutions", signX, y + 2, {
        width: signW,
        align: "right",
      });
      doc.fillColor("#1e293b").font("Times-Italic").fontSize(13).text("Denika and Team Solutions", signX, y + 13, {
        width: signW,
        align: "right",
      });
      doc.fillColor("#64748b").font("Helvetica").fontSize(7).text("Authorized Signatory", signX, y + 30, {
        width: signW,
        align: "right",
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
