import nodemailer from "nodemailer";
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  ADMIN_EMAIL,
  FRONTEND_URL,
  BACKEND_PUBLIC_URL,
  NODE_ENV,
  EMAILJS_PUBLIC_KEY,
  EMAILJS_RESET_SERVICE_ID,
  EMAILJS_RESET_TEMPLATE_ID,
  EMAILJS_PRIVATE_KEY,
} from "../config/env.js";
import logger from "./logger.js";

const COMPANY_NAME = "DEETECH COMPUTERS";
const SUPPORT_EMAIL = ADMIN_EMAIL || SMTP_USER || "support@deetech.local";
const SUPPORT_PHONE = "+233 59 175 5964";
const CURRENCY_SYMBOL = "GHâ‚µ";

let transporter = null;

function escapeHtml(input = "") {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value) {
  const amount = Number(value || 0);
  return `${CURRENCY_SYMBOL}${amount.toFixed(2)}`;
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  return {
    date: date.toLocaleDateString("en-GB"),
    time: date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function paymentMethodLabel(method) {
  const map = {
    mtn: "MTN Mobile Money",
    vodafone: "Telecel (Vodafone) Cash",
    bank: "Bank Transfer",
    hubtel: "Hubtel",
  };
  return map[String(method || "").toLowerCase()] || (method || "N/A");
}

function trimTrailingSlash(value = "") {
  return String(value || "").replace(/\/$/, "");
}

function resolvePublicMediaUrl(rawUrl = "") {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const backendBaseUrl = trimTrailingSlash(BACKEND_PUBLIC_URL);
  const frontendBaseUrl = trimTrailingSlash(FRONTEND_URL);
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;

  if (backendBaseUrl) {
    return `${backendBaseUrl}${normalizedPath}`;
  }

  if (frontendBaseUrl) {
    return `${frontendBaseUrl}${normalizedPath}`;
  }

  return value;
}

function orderItemsForEmail(items = []) {
  return items.map((item) => ({
    qty: Number(item.qty || item.quantity || 0),
    name: item.name || item.product?.name || String(item.product || "Product"),
    price: Number(item.price || 0),
  }));
}

function initTransporter() {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const smtpPort = Number(SMTP_PORT) || 587;
    const isSecure = smtpPort === 465;

    const t = nodemailer.createTransport({
      host: SMTP_HOST,
      port: smtpPort,
      secure: isSecure,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      requireTLS: !isSecure,
      tls: {
        minVersion: "TLSv1.2",
      },
    });

    t.verify((err) => {
      if (err) {
        logger.warn(`Email transporter verification failed: ${err.message}`);
      } else {
        logger.info("Email service initialized with SMTP");
      }
    });
    return t;
  }

  if (NODE_ENV !== "production") {
    logger.warn("SMTP not fully configured. Falling back to console email logging.");
  }
  return null;
}

transporter = initTransporter();

async function sendEmail({ to, subject, html, text }) {
  if (!to) return false;

  if (!transporter) {
    logger.info(`Email preview -> To: ${to} | Subject: ${subject}`);
    if (text) logger.info(text);
    return true;
  }

  await transporter.sendMail({
    from: `"${COMPANY_NAME}" <${SUPPORT_EMAIL}>`,
    to,
    subject,
    html,
    text,
  });
  return true;
}

export async function sendWelcomeEmail(to, name = "") {
  const safeName = escapeHtml(name || "there");
  const html = `
    <div style="font-family:Arial,sans-serif;background:#f7f7f7;padding:24px;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#0b75c9 0%,#0a5ea8 100%);padding:28px;color:#ffffff;text-align:center;">
          <h1 style="margin:0;font-size:28px;letter-spacing:1px;">Welcome to ${COMPANY_NAME}</h1>
          <p style="margin:10px 0 0;font-size:15px;opacity:0.95;">Tech Excellence Delivered.</p>
        </div>
        <div style="padding:28px;color:#1f2937;line-height:1.6;">
          <p style="margin-top:0;">Hi <strong>${safeName}</strong>,</p>
          <p>Thank you for creating an account with <strong>${COMPANY_NAME}</strong>.</p>
          <p>You can now shop premium tech products, track orders, manage your account, and access exclusive offers.</p>
          <p style="margin-bottom:0;">If you ever need assistance, reply to this email or contact us on <strong>${escapeHtml(SUPPORT_PHONE)}</strong>.</p>
        </div>
        <div style="background:#f3f4f6;padding:16px;text-align:center;font-size:13px;color:#6b7280;">
          ${COMPANY_NAME} • ${escapeHtml(SUPPORT_EMAIL)} • ${escapeHtml(SUPPORT_PHONE)}
        </div>
      </div>
    </div>
  `;

  const text = `Welcome to ${COMPANY_NAME}, ${name || "there"}! Your account has been created successfully.`;
  return sendEmail({
    to,
    subject: `Welcome to ${COMPANY_NAME}`,
    html,
    text,
  });
}

export async function sendOrderNotification(to, orderDetails = {}) {
  const items = orderItemsForEmail(orderDetails.orderItems || []);
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const created = formatDateTime(orderDetails.createdAt);
  const frontendBaseUrl = trimTrailingSlash(FRONTEND_URL);
  const adminOrderUrl = frontendBaseUrl ? `${frontendBaseUrl}/Admin/orders.html` : "#";
  const paymentProofUrl = resolvePublicMediaUrl(orderDetails.paymentScreenshotUrl);

  const orderItemsHtml = items
    .map(
      (item) => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #ddd;">
          <span>${escapeHtml(item.name)} (x${item.qty})</span>
          <strong>${money(item.price * item.qty)}</strong>
        </div>
      `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>New Order</title></head>
    <body style="margin:0;padding:20px 0;background:#f5f5f5;font-family:Arial,sans-serif;color:#333;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#d9534f 0%,#c9302c 100%);color:#fff;padding:24px 28px;text-align:center;">
          <h1 style="margin:0;font-size:24px;">NEW ORDER RECEIVED</h1>
          <div style="margin-top:6px;font-size:14px;">Order #${escapeHtml(orderDetails.id || "N/A")}</div>
        </div>
        <div style="padding:20px 28px;">
          <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 14px;border-radius:4px;margin-bottom:16px;">
            <strong>Action Required:</strong> Please review and process this order.
          </div>

          <h3 style="margin:0 0 10px;padding-bottom:8px;border-bottom:2px solid #007bff;">Customer Details</h3>
          <p style="margin:6px 0;"><strong>Name:</strong> ${escapeHtml(orderDetails.customerName || "N/A")}</p>
          <p style="margin:6px 0;"><strong>Email:</strong> ${escapeHtml(orderDetails.customerEmail || "N/A")}</p>
          <p style="margin:6px 0;"><strong>Phone:</strong> ${escapeHtml(orderDetails.mobileNumber || "N/A")}</p>
          <p style="margin:6px 0;"><strong>Date/Time:</strong> ${created.date} ${created.time}</p>

          <h3 style="margin:18px 0 10px;padding-bottom:8px;border-bottom:2px solid #007bff;">Order Details</h3>
          <p style="margin:6px 0;"><strong>Payment:</strong> ${escapeHtml(paymentMethodLabel(orderDetails.paymentMethod))}</p>
          <p style="margin:6px 0;"><strong>Address:</strong> ${escapeHtml(orderDetails.deliveryAddress || orderDetails.deliveryRegion || "N/A")}</p>
          <p style="margin:6px 0;"><strong>Status:</strong> ${escapeHtml(orderDetails.orderStatus || "pending")} | ${escapeHtml(orderDetails.paymentStatus || "pending")}</p>
          <p style="margin:6px 0;"><strong>Notes:</strong> ${escapeHtml(orderDetails.guestNotes || "None")}</p>
          ${
            paymentProofUrl
              ? `<p style="margin:6px 0;"><strong>Payment Proof:</strong> <a href="${escapeHtml(paymentProofUrl)}">View Uploaded Proof</a></p>`
              : ""
          }

          <h3 style="margin:18px 0 10px;padding-bottom:8px;border-bottom:2px solid #007bff;">Items (${items.length} items, ${totalQty} units)</h3>
          <div style="background:#f8f9fa;border-radius:6px;padding:10px 12px;">${orderItemsHtml || "<em>No items</em>"}</div>
          <div style="background:#e9ecef;padding:12px;border-radius:5px;margin-top:12px;font-size:18px;font-weight:bold;color:#d9534f;">
            Total: ${money(orderDetails.totalPrice)}
          </div>

          <div style="text-align:center;margin-top:18px;">
            <a href="${escapeHtml(adminOrderUrl)}" style="display:inline-block;background:#007bff;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:700;">
              View Full Order
            </a>
          </div>
        </div>
        <div style="background:#343a40;color:#fff;padding:16px 24px;text-align:center;font-size:12px;">
          <div>${new Date().getFullYear()} ${COMPANY_NAME} Admin Dashboard</div>
          <div style="margin-top:4px;">${escapeHtml(SUPPORT_EMAIL)} | ${escapeHtml(SUPPORT_PHONE)}</div>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to,
    subject: `NEW ORDER #${orderDetails.id || "N/A"} - ACTION REQUIRED`,
    html,
  });
}

export async function sendOrderConfirmation(to, orderDetails = {}) {
  const items = orderItemsForEmail(orderDetails.orderItems || []);
  const created = formatDateTime(orderDetails.createdAt);
  const frontendBaseUrl = trimTrailingSlash(FRONTEND_URL);
  const trackingUrl = frontendBaseUrl ? `${frontendBaseUrl}/orders.html?tab=orders` : "#";
  const subtotal = Number(orderDetails.totalPrice || 0);
  const rows = items
    .map((item) => {
      const lineTotal = item.qty * item.price;
      return `
        <tr>
          <td width="50%" style="padding:8px 0 8px 5px;border-bottom:1px dashed #ddd;">${escapeHtml(item.name)}</td>
          <td width="20%" align="center" style="padding:8px 0;border-bottom:1px dashed #ddd;">${item.qty}</td>
          <td width="30%" align="right" style="padding:8px 5px 8px 0;border-bottom:1px dashed #ddd;">${money(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Order Confirmation</title></head>
    <body style="margin:0;padding:20px 0;background:#f5f5f5;font-family:Arial,sans-serif;color:#333;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#0f9d58 0%,#0b7a43 100%);color:#fff;padding:26px 30px;text-align:center;">
          <h1 style="margin:0;font-size:26px;">ORDER CONFIRMED</h1>
          <div style="margin-top:8px;font-size:15px;opacity:0.95;">Thank you for shopping with ${COMPANY_NAME}</div>
        </div>

        <div style="padding:26px 30px;">
          <p style="margin-top:0;">Hello <strong>${escapeHtml(orderDetails.customerName || "Customer")}</strong>,</p>
          <p>Your order has been received successfully and is now being processed.</p>

          <div style="background:#f8f9fa;border-left:4px solid #0f9d58;padding:12px 14px;border-radius:4px;margin:16px 0;">
            <div><strong>Order ID:</strong> ${escapeHtml(orderDetails.id || "N/A")}</div>
            <div><strong>Order Date:</strong> ${created.date} ${created.time}</div>
            <div><strong>Payment Method:</strong> ${escapeHtml(paymentMethodLabel(orderDetails.paymentMethod))}</div>
            <div><strong>Delivery Address:</strong> ${escapeHtml(orderDetails.deliveryAddress || orderDetails.deliveryRegion || "N/A")}</div>
          </div>

          <h3 style="margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #007bff;">Order Items</h3>
          <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">
            <thead>
              <tr>
                <th align="left" style="padding:0 0 8px 5px;color:#6b7280;">Item</th>
                <th align="center" style="padding:0 0 8px;color:#6b7280;">Qty</th>
                <th align="right" style="padding:0 5px 8px 0;color:#6b7280;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="3"><em>No items</em></td></tr>'}
            </tbody>
          </table>

          <div style="margin-top:18px;background:#e9ecef;padding:14px;border-radius:6px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span>Subtotal</span>
              <strong>${money(subtotal)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:18px;border-top:1px solid #cfd4da;padding-top:10px;">
              <span><strong>Total</strong></span>
              <strong style="color:#d9534f;">${money(subtotal)}</strong>
            </div>
          </div>

          <div style="text-align:center;margin-top:22px;">
            <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#007bff;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:700;">
              Track Your Order
            </a>
          </div>
        </div>

        <div style="background:#343a40;color:#fff;padding:18px 24px;text-align:center;font-size:12px;">
          <div>${COMPANY_NAME}</div>
          <div style="margin-top:4px;">${escapeHtml(SUPPORT_EMAIL)} | ${escapeHtml(SUPPORT_PHONE)}</div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Your order ${orderDetails.id || ""} has been confirmed. Total: ${money(subtotal)}.`;

  await sendEmail({
    to,
    subject: `Order Confirmation #${orderDetails.id || "N/A"}`,
    html,
    text,
  });
}

export async function sendPasswordResetEmail(to, resetUrl) {
  const emailJsConfigured = Boolean(
    EMAILJS_PUBLIC_KEY &&
      EMAILJS_RESET_SERVICE_ID &&
      EMAILJS_RESET_TEMPLATE_ID &&
      EMAILJS_PRIVATE_KEY
  );

  if (!emailJsConfigured) {
    throw new Error("Reset EmailJS is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: EMAILJS_RESET_SERVICE_ID,
        template_id: EMAILJS_RESET_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: {
          email: to,
          to_email: to,
          to_name: "Customer",
          reset_url: resetUrl,
          reset_link: resetUrl,
          company_name: COMPANY_NAME,
          support_email: SUPPORT_EMAIL,
          support_phone: SUPPORT_PHONE,
          subject: "Password Reset Request",
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `EmailJS reset send failed (${response.status}): ${errorText || "Unknown error"}`
      );
    }

    return true;
  } catch (err) {
    logger.error(`Reset EmailJS send failed: ${err.message}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export const sendOrderConfirmationEmail = sendOrderConfirmation;


function verifyTransporter(timeoutMs = 12000) {
  if (!transporter || typeof transporter.verify !== "function") {
    return Promise.resolve({ ok: false, message: "SMTP transporter is not configured" });
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, message: "SMTP verify timed out" });
    }, Math.max(2000, Number(timeoutMs) || 12000));

    transporter.verify((err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) {
        resolve({ ok: false, message: err.message || "SMTP verify failed" });
      } else {
        resolve({ ok: true, message: "SMTP transport verified" });
      }
    });
  });
}

export async function getEmailHealthStatus() {
  const provider = getEmailProviderInfo();
  const verify = await verifyTransporter(12000);

  return {
    status: (verify.ok || provider.resetEmailJsConfigured) ? "ok" : "degraded",
    provider,
    smtp: {
      configured: Boolean(provider.smtpHost && provider.smtpUser),
      hasTransporter: provider.hasTransporter,
      verified: verify.ok,
      message: verify.message,
    },
  };
}
export function getEmailProviderInfo() {
  const smtpPort = Number(SMTP_PORT) || 587;
  return {
    provider: "smtp_nodemailer",
    smtpHost: SMTP_HOST || "",
    smtpPort,
    smtpSecure: smtpPort === 465,
    smtpUser: SMTP_USER || "",
    smtpPassSet: Boolean(SMTP_PASS),
    hasTransporter: Boolean(transporter),
    frontendEmailJsActiveOnCheckout: true,
    resetEmailJsConfigured: Boolean(EMAILJS_PUBLIC_KEY && EMAILJS_RESET_SERVICE_ID && EMAILJS_RESET_TEMPLATE_ID && EMAILJS_PRIVATE_KEY),
    resetEmailJsPrivateKeySet: Boolean(EMAILJS_PRIVATE_KEY),
    environment: NODE_ENV,
  };
}


