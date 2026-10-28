import { generateInvoicePDF } from "./pdfService.js";

/**
 * Validates and normalizes Indian phone numbers (+91, 10 digits starting 6-9)
 */
export function normalizeIndianPhone(rawPhone) {
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
 * Checks if WhatsApp Cloud API credentials are configured
 */
export function isWhatsAppCloudConfigured() {
  return Boolean(
    process.env.WHATSAPP_CLOUD_API_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  );
}

/**
 * Sends order invoice PDF via WhatsApp Cloud API
 */
export async function sendInvoiceViaWhatsAppCloud(order, user) {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_INVOICE_TEMPLATE;

  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp Cloud API credentials (WHATSAPP_CLOUD_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID) are not configured");
  }

  const rawPhone = order.client?.phone;
  const recipientPhone = normalizeIndianPhone(rawPhone);
  if (!recipientPhone) {
    throw new Error(`Invalid Indian phone number: "${rawPhone}". Must be a valid 10-digit number starting with 6-9.`);
  }

  // Generate the PDF Buffer
  const pdfBuffer = await generateInvoicePDF(order);
  const invoiceNumber = order.invoiceNumber || order.orderNumber;
  const filename = `Invoice-${invoiceNumber.replace(/[\/\\]/g, "-")}.pdf`;

  // Step 1: Upload media to WhatsApp Cloud API
  const formData = new FormData();
  const pdfFile = new File([pdfBuffer], filename, { type: "application/pdf" });
  formData.append("file", pdfFile);
  formData.append("type", "application/pdf");
  formData.append("messaging_product", "whatsapp");

  const mediaUploadRes = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const mediaData = await mediaUploadRes.json();
  if (!mediaUploadRes.ok || !mediaData.id) {
    const errorDetail = mediaData.error?.message || JSON.stringify(mediaData);
    throw new Error(`WhatsApp media upload failed: ${errorDetail}`);
  }

  const mediaId = mediaData.id;

  // Step 2: Send message with document
  let payload;
  if (templateName) {
    // Template message for business-initiated notification
    payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en_US" },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "document",
                document: {
                  id: mediaId,
                  filename,
                },
              },
            ],
          },
          {
            type: "body",
            parameters: [
              { type: "text", text: order.client?.name || "Customer" },
              { type: "text", text: invoiceNumber },
            ],
          },
        ],
      },
    };
  } else {
    // Standard document message (e.g. inside customer service window)
    payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "document",
      document: {
        id: mediaId,
        caption: `Tax Invoice ${invoiceNumber} from Denika & Team Solutions. Total: Rs. ${order.totalAmount}, Balance: Rs. ${order.balanceAmount}`,
        filename,
      },
    };
  }

  const sendMessageRes = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const sendData = await sendMessageRes.json();
  if (!sendMessageRes.ok || !sendData.messages?.[0]?.id) {
    const errorDetail = sendData.error?.message || JSON.stringify(sendData);
    throw new Error(`WhatsApp message delivery failed: ${errorDetail}`);
  }

  const messageId = sendData.messages[0].id;
  return {
    success: true,
    messageId,
    recipient: recipientPhone,
    filename,
  };
}
