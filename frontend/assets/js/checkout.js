// assets/js/checkout.js
// Save order to backend (emails are sent by backend SMTP service)
(function () {

const {
  API_BASE_ORDERS,
  API_BASE_PRODUCTS,
  API_BASE_USERS,
  API_BASE,
  EMAILJS_SERVICE_ID,
  EMAILJS_PUBLIC_KEY,
  EMAILJS_ADMIN_ORDER_TEMPLATE_ID,
  EMAILJS_ORDER_TEMPLATE_ID,
  ADMIN_EMAIL,
  ADMIN_FIRST_NAME,
  ADMIN_LAST_NAME,
  ADMIN_PHONE,
  SUPPORT_WHATSAPP_NUMBER,
  SUPPORT_EMAIL,
  showToast,
} = window.CONFIG || {};
const { getToken, clearUser, clearToken } = window.auth || {};
const PENDING_ORDER_KEY = "checkout_pending_order";
const CHECKOUT_IN_PROGRESS_KEY = "checkout_in_progress";
const CHECKOUT_STEP_KEY = "checkout_step";
const CHECKOUT_DRAFT_KEY = "checkout_draft_v1";
const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

// ----------------------
// Utils
// ----------------------
function money(n) {
  return `GHC ${Number(n).toFixed(2)}`;
}

function resolveImage(src) {
  if (!src) return "assets/img/placeholder.png";
  if (/^(https?:|data:)/i.test(src)) return src;
  if (src.startsWith("/uploads") || src.startsWith("uploads/")) {
    return API_BASE + (src.startsWith("/") ? "" : "/") + src;
  }
  return src;
}

function showMsg(text, ok = true) {
  const el = document.getElementById("checkout-message");
  if (!el) {
    if (typeof showToast === "function") {
      showToast(text, ok ? "success" : "error");
    } else {
      console.log(text);
    }
    return;
  }
  el.textContent = text;
  el.className = `msg ${ok ? "success" : "error"}`;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {}
}

function hidePageLoader() {
  const body = document.body;
  if (!body) return;
  body.classList.remove("page-loading");
  const loader = document.getElementById("page-loader");
  if (loader) loader.style.display = "none";
}

function setProcessingOverlay(visible, text = "") {
  const overlay = document.getElementById("processing-overlay");
  const textEl = document.getElementById("processing-overlay-text");
  if (!overlay) return;
  if (textEl && text) textEl.textContent = text;
  overlay.classList.toggle("show", Boolean(visible));
  overlay.setAttribute("aria-hidden", visible ? "false" : "true");
}
function setupCheckoutMobileLayout() {
  const path = String(window.location.pathname || "").toLowerCase();
  if (!path.includes("checkout.html")) return;

  document.body.classList.add("checkout-mobile-flow");

  const existingMobileNav = document.getElementById("mobileBottomNav");
  if (existingMobileNav) existingMobileNav.remove();
  document.body.classList.remove("has-mobile-bottom-nav");

  const navContainer = document.querySelector(".site-header .nav-container");
  if (navContainer && !navContainer.querySelector(".checkout-mobile-back")) {
    const back = document.createElement("a");
    back.className = "checkout-mobile-back";
    back.href = "cart.html";
    back.textContent = "<Back to cart";
    back.setAttribute("aria-label", "Back to cart");
    back.setAttribute("title", "Back to cart");
    back.addEventListener("click", (ev) => {
      const targetStep = Number(back.dataset.backStep || 0);
      if (targetStep > 0 && typeof window.__checkoutShowStep === "function") {
        ev.preventDefault();
        window.__checkoutShowStep(targetStep);
      }
    });
    navContainer.prepend(back);
  }
}

function clearCheckoutMobileInlineStyles() {
  try {
    const html = document.documentElement;
    const body = document.body;
    if (html) html.style.overflowX = "";
    if (body) body.style.overflowX = "";

    const selectors = [
      "body.checkout-mobile-flow .site-header",
      "body.checkout-mobile-flow .site-header *",
      "body.checkout-mobile-flow .checkout-page",
      "body.checkout-mobile-flow .checkout-grid",
      "body.checkout-mobile-flow .checkout-grid *",
      "body.checkout-mobile-flow .checkout-stepper",
      "body.checkout-mobile-flow .checkout-step-wrap",
      "body.checkout-mobile-flow .checkout-step-panel",
      "body.checkout-mobile-flow .checkout-step-panel *",
      "body.checkout-mobile-flow .checkout-mobile-actionbar",
      "body.checkout-mobile-flow .checkout-mobile-actionbar *"
    ];

    document.querySelectorAll(selectors.join(",")).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.style.maxWidth = "";
      el.style.minWidth = "";
      el.style.boxSizing = "";
      el.style.overflowX = "";
    });

    const back = document.querySelector(".checkout-mobile-back");
    if (back instanceof HTMLElement) {
      back.style.display = "";
      back.style.maxWidth = "";
      back.style.whiteSpace = "";
      back.style.overflow = "";
      back.style.textOverflow = "";
    }
  } catch {}
}
function enforceCheckoutMobileNoXScroll() {
  try {
    if (!document.body?.classList.contains("checkout-mobile-flow")) return;
    if (window.innerWidth > 900) {
      clearCheckoutMobileInlineStyles();
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    html.style.overflowX = "hidden";
    body.style.overflowX = "hidden";

    const viewportWidth = html.clientWidth || window.innerWidth || 0;
    const selectors = [
      "body.checkout-mobile-flow .site-header",
      "body.checkout-mobile-flow .site-header *",
      "body.checkout-mobile-flow .checkout-page",
      "body.checkout-mobile-flow .checkout-grid",
      "body.checkout-mobile-flow .checkout-grid *",
      "body.checkout-mobile-flow .checkout-stepper",
      "body.checkout-mobile-flow .checkout-step-wrap",
      "body.checkout-mobile-flow .checkout-step-panel",
      "body.checkout-mobile-flow .checkout-step-panel *",
      "body.checkout-mobile-flow .checkout-mobile-actionbar",
      "body.checkout-mobile-flow .checkout-mobile-actionbar *"
    ];

    document.querySelectorAll(selectors.join(",")).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.style.maxWidth = "100%";
      el.style.minWidth = "0";
      el.style.boxSizing = "border-box";

      const rect = el.getBoundingClientRect();
      const exceeds = rect.left < -1 || rect.right > (viewportWidth + 1);
      if (exceeds) {
        el.style.overflowX = "hidden";
      }
    });

    const back = document.querySelector(".checkout-mobile-back");
    if (back instanceof HTMLElement) {
      back.style.display = "inline-flex";
      back.style.maxWidth = "100%";
      back.style.whiteSpace = "nowrap";
      back.style.overflow = "hidden";
      back.style.textOverflow = "ellipsis";
    }
  } catch {}
}

function updateCheckoutBackLink(step) {
  const back = document.querySelector(".checkout-mobile-back");
  if (!back) return;

  const currentStep = Math.min(2, Math.max(1, Number(step || 1)));
  if (currentStep === 1) {
    back.href = "cart.html";
    back.dataset.backStep = "";
    back.textContent = "<Back to cart";
    back.setAttribute("aria-label", "Back to cart");
    back.setAttribute("title", "Back to cart");
    return;
  }

  back.href = "#";
  back.dataset.backStep = "1";
  back.textContent = "<Back to Buyer Details";
  back.setAttribute("aria-label", "Back to Buyer Details");
  back.setAttribute("title", "Back to Buyer Details");
}

function updateMobileCheckoutBar(step) {
  const bar = document.getElementById("checkoutMobileBar");
  const totalEl = document.getElementById("checkoutMobileTotal");
  const statusEl = document.getElementById("checkoutMobileStatus");
  const btn = document.getElementById("checkoutMobilePrimaryBtn");
  const orderTotalEl = document.getElementById("order-total");
  const mobileSteps = Array.from(document.querySelectorAll("#checkoutMobileSteps .checkout-mobile-step"));
  if (!bar || !totalEl || !statusEl || !btn) return;

  const currentStep = Math.min(2, Math.max(1, Number(step || window.__checkoutCurrentStep || 1)));
  window.__checkoutCurrentStep = currentStep;
  updateCheckoutBackLink(currentStep);

  mobileSteps.forEach((item) => {
    const itemStep = Number(item.dataset.step || 0);
    item.classList.toggle("is-active", itemStep === currentStep);
    item.classList.toggle("is-complete", itemStep > 0 && itemStep < currentStep);
  });

  const totalText = String(orderTotalEl?.textContent || "GHC 0.00").trim() || "GHC 0.00";
  totalEl.textContent = totalText;

  if (currentStep === 1) {
    statusEl.textContent = "Ready for payment";
    btn.textContent = "Continue to Payment & Review";
    btn.dataset.checkoutAction = "step-2";
    return;
  }

  statusEl.textContent = "Ready to order";
  btn.textContent = `Review Order - ${totalText}`;
  btn.dataset.checkoutAction = "place-order";
}

function normalizeSavedOrderResponse(payload) {
  if (!payload) return null;
  if (payload._id || payload.id) return payload;
  // Prefer rich nested order payload first; avoid losing affiliate/discount fields.
  if (payload.order && (payload.order._id || payload.order.id)) return payload.order;
  if (payload.data?.order && (payload.data.order._id || payload.data.order.id)) return payload.data.order;
  if (payload.result?.order && (payload.result.order._id || payload.result.order.id)) return payload.result.order;
  if (payload.orderId) return { _id: payload.orderId };
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && (first._id || first.id) ? first : null;
  }
  const nestedCandidates = [
    payload.order,
    payload.data,
    payload.result,
    payload.savedOrder,
    payload.payload,
    payload.order?.data,
    payload.data?.order,
    payload.data?.data,
    payload.result?.order,
  ];
  for (const candidate of nestedCandidates) {
    if (!candidate) continue;
    if (candidate._id || candidate.id) return candidate;
    if (Array.isArray(candidate) && candidate[0] && (candidate[0]._id || candidate[0].id)) {
      return candidate[0];
    }
  }
  return null;
}

function extractOrdersList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.orders)) return payload.orders;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data?.orders)) return payload.data.orders;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.result?.orders)) return payload.result.orders;
  return [];
}

function normalizePhoneForCompare(v) {
  const raw = String(v || "").replace(/\D+/g, "");
  if (!raw) return "";
  if (raw.length >= 9) return raw.slice(-9);
  return raw;
}

function generateClientOrderRef() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `ord_${ts}_${rand}`;
}

function findRecentMatchingOrder(orders, criteria) {
  if (!Array.isArray(orders) || !orders.length) return null;
  const expectedClientOrderRef = String(criteria?.clientOrderRef || "").trim();
  if (expectedClientOrderRef) {
    const exact = orders.find(
      (o) => String(o?.clientOrderRef || "").trim() === expectedClientOrderRef
    );
    if (exact) return exact;
    return null;
  }

  const now = Date.now();
  const tenMinutesMs = 10 * 60 * 1000;
  const expectedItems = Number(criteria?.itemsCount || 0);
  const expectedMethod = String(criteria?.paymentMethod || "").toLowerCase();
  const expectedEmail = String(criteria?.shippingEmail || "").trim().toLowerCase();
  const expectedMobile = normalizePhoneForCompare(criteria?.mobileNumber);

  const candidates = orders
    .filter((o) => {
      const createdAt = o?.createdAt ? new Date(o.createdAt).getTime() : 0;
      if (!createdAt || now - createdAt > tenMinutesMs) return false;
      const methodOk = String(o?.paymentMethod || "").toLowerCase() === expectedMethod;
      const orderItemCount = Array.isArray(o?.orderItems) ? o.orderItems.length : 0;
      const itemsOk = orderItemCount === expectedItems || (expectedItems > 0 && orderItemCount > 0);
      const emailOk = String(o?.shippingEmail || "").trim().toLowerCase() === expectedEmail;
      const mobileOk = normalizePhoneForCompare(o?.mobileNumber) === expectedMobile;
      return methodOk && itemsOk && (emailOk || mobileOk);
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  if (candidates[0]) return candidates[0];

  // Relaxed fallback: newest order in recent window with same payment method.
  const relaxed = orders
    .filter((o) => {
      const createdAt = o?.createdAt ? new Date(o.createdAt).getTime() : 0;
      if (!createdAt || now - createdAt > tenMinutesMs) return false;
      return String(o?.paymentMethod || "").toLowerCase() === expectedMethod;
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return relaxed[0] || null;
}

function savePendingOrderMarker(data) {
  try {
    localStorage.setItem(
      PENDING_ORDER_KEY,
      JSON.stringify({
        ...data,
        createdAt: new Date().toISOString(),
      })
    );
  } catch {}
}

function clearPendingOrderMarker() {
  try {
    localStorage.removeItem(PENDING_ORDER_KEY);
  } catch {}
}

function readPendingOrderMarker() {
  try {
    const raw = localStorage.getItem(PENDING_ORDER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasPendingOrderMarker() {
  return Boolean(readPendingOrderMarker());
}

function setCheckoutInProgress(active) {
  try {
    if (active) sessionStorage.setItem(CHECKOUT_IN_PROGRESS_KEY, "1");
    else sessionStorage.removeItem(CHECKOUT_IN_PROGRESS_KEY);
  } catch {}
}

function isCheckoutInProgress() {
  try {
    return sessionStorage.getItem(CHECKOUT_IN_PROGRESS_KEY) === "1";
  } catch {
    return false;
  }
}

function saveCheckoutDraft() {
  const payload = {
    name: String(document.getElementById("name")?.value || ""),
    email: String(document.getElementById("email")?.value || ""),
    phone: String(document.getElementById("phone")?.value || ""),
    address: String(document.getElementById("address")?.value || ""),
    city: String(document.getElementById("city")?.value || ""),
    notes: String(document.getElementById("notes")?.value || ""),
    affiliateCode: String(document.getElementById("affiliate-code")?.value || ""),
    discountCode: String(document.getElementById("discount-code")?.value || ""),
    paymentMethod: String(document.getElementById("payment-method")?.value || ""),
  };
  try {
    sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(payload));
  } catch {}
}

function restoreCheckoutDraft() {
  let draft = null;
  try {
    draft = JSON.parse(sessionStorage.getItem(CHECKOUT_DRAFT_KEY) || "null");
  } catch {
    draft = null;
  }
  if (!draft || typeof draft !== "object") return;

  const setIf = (id, value) => {
    if (value == null) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(value);
  };

  setIf("name", draft.name);
  setIf("email", draft.email);
  setIf("phone", draft.phone);
  setIf("address", draft.address);
  setIf("city", draft.city);
  setIf("notes", draft.notes);
  setIf("affiliate-code", draft.affiliateCode);
  setIf("discount-code", draft.discountCode);

  const payment = String(draft.paymentMethod || "").toLowerCase();
  const methodEl = document.getElementById("payment-method");
  if (payment && methodEl) {
    methodEl.value = payment;
    setPaymentInstructions(payment);
  }
}
function canUseEmailJsOrders() {
  return Boolean(
    window.emailjs &&
      EMAILJS_SERVICE_ID &&
      EMAILJS_PUBLIC_KEY &&
      EMAILJS_ADMIN_ORDER_TEMPLATE_ID &&
      EMAILJS_ORDER_TEMPLATE_ID
  );
}

function buildOrderItemsForEmail(cart) {
  return (cart || [])
    .map((item) => {
      const qty = Number(item.qty || item.quantity || 1);
      const price = Number(item.price || 0);
      return {
        id: item.id || item.productId || item._id || "N/A",
        name: item.name || "Product",
        quantity: qty,
        price,
        subtotal: price * qty,
      };
    });
}

async function sendOrderEmailsViaEmailJs({
  savedOrder,
  cart,
  customerName,
  customerEmail,
  customerPhone,
  address,
  city,
  paymentMethod,
  notes,
}) {
  if (!canUseEmailJsOrders()) return { skipped: true };

  const orderId = savedOrder?._id || "N/A";
  const websiteUrl = window.location.origin || "https://deetechcomputers.com";
  const orderDate = new Date().toLocaleDateString("en-GB");
  const orderTime = new Date().toLocaleTimeString("en-GB");
  const orderItems = buildOrderItemsForEmail(cart);
  const totalItems = orderItems.length;
  const totalQuantity = orderItems.reduce((sum, i) => sum + i.quantity, 0);
  const orderTotal = Number(savedOrder?.totalPrice || 0);

  const orderItemsTableRows = orderItems
    .map(
      (item) => `<tr>
        <td width="50%" style="padding:8px 0 8px 5px; font-size:12px;">${item.name}</td>
        <td width="20%" align="center" style="padding:8px 0; font-size:12px;">${item.quantity}</td>
        <td width="30%" align="right" style="padding:8px 5px 8px 0; font-size:12px;">GHâ‚µ ${item.subtotal.toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const orderItemsBlocks = orderItems
    .map(
      (item) => `
        <div style="margin-bottom: 12px; padding: 12px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #007bff;">
          <strong style="color: #333;">${item.name}</strong>
          <div style="font-size: 13px; color: #666; margin: 4px 0;">ID: ${item.id}</div>
          <div style="font-size: 13px;">
            <span style="color: #333;">Quantity:</span> ${item.quantity} x
            <span style="color: #333;">GHâ‚µ ${item.price.toFixed(2)}</span> =
            <strong style="color: #d9534f;">GHâ‚µ ${item.subtotal.toFixed(2)}</strong>
          </div>
        </div>`
    )
    .join("");

  const customerParams = {
    email: String(customerEmail || "").trim(),
    to_email: String(customerEmail || "").trim(),
    to_name: customerName || "Valued Customer",
    customer_name: customerName || "Customer",
    customer_email: String(customerEmail || "").trim(),
    customer_phone: customerPhone || "",
    order_id: String(orderId),
    order_subtotal: orderTotal.toFixed(2),
    order_total: orderTotal.toFixed(2),
    currency_symbol: "GHâ‚µ ",
    order_items: orderItemsTableRows || "<tr><td colspan='3'>No items listed</td></tr>",
    order_date: orderDate,
    payment_method: paymentMethod || "Not specified",
    delivery_address: `${address || ""}, ${city || ""}`.replace(/^,\s*|\s*,\s*$/g, ""),
    company_name: "DEETECH COMPUTERS",
    support_email: SUPPORT_EMAIL || "deetechcomputers01@gmail.com",
    support_phone: ADMIN_PHONE || "+233591755964",
    current_year: new Date().getFullYear().toString(),
    website_url: websiteUrl,
    order_tracking_url: `${websiteUrl}/orders.html?tab=orders`,
    estimated_delivery: "24 hours Delivery",
    shipping_method: "Free Nationwide Delivery",
    subject: `Order Confirmation #${orderId} - DEETECH COMPUTERS`,
  };

  const adminParams = {
    email: ADMIN_EMAIL || "deetechcomputers01@gmail.com",
    to_email: ADMIN_EMAIL || "deetechcomputers01@gmail.com",
    to_name: `${ADMIN_FIRST_NAME || "Daniel"} ${ADMIN_LAST_NAME || "Adjei Mensah"}`.trim(),
    admin_name: `${ADMIN_FIRST_NAME || "Daniel"} ${ADMIN_LAST_NAME || "Adjei Mensah"}`.trim(),
    order_id: String(orderId),
    customer_name: customerName || "Customer",
    customer_email: String(customerEmail || "").trim(),
    customer_phone: customerPhone || "",
    order_total: `GHâ‚µ ${orderTotal.toFixed(2)}`,
    order_items: orderItemsBlocks || "<div>No items listed</div>",
    order_date: orderDate,
    order_time: orderTime,
    payment_method: paymentMethod || "Not specified",
    delivery_address: `${address || ""}, ${city || ""}`.replace(/^,\s*|\s*,\s*$/g, ""),
    shipping_method: "Free Nationwide Delivery",
    subject: `NEW ORDER #${orderId} - ACTION REQUIRED`,
    customer_notes: notes || "No special instructions",
    order_status: "NEW ORDER",
    view_order_url: `${websiteUrl}/Admin/orders.html`,
    total_items: totalItems,
    total_quantity: totalQuantity,
    platform: "Website",
    order_urgency: "HIGH PRIORITY",
    action_required: "Process & Confirm",
    estimated_delivery: "Within 3-5 days",
    payment_status: "Pending",
    customer_address: `${address || ""}, ${city || ""}`.replace(/^,\s*|\s*,\s*$/g, ""),
    support_email: SUPPORT_EMAIL || "deetechcomputers01@gmail.com",
    support_phone: ADMIN_PHONE || "+233591755964",
    support_whatsapp: SUPPORT_WHATSAPP_NUMBER || "233591755964",
    website_url: websiteUrl,
  };

  emailjs.init(EMAILJS_PUBLIC_KEY);

  const customerPromise = customerEmail
    ? emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_ORDER_TEMPLATE_ID, customerParams)
    : Promise.resolve(null);
  const adminPromise = emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_ADMIN_ORDER_TEMPLATE_ID,
    adminParams
  );

  await Promise.all([customerPromise, adminPromise]);
}

// ----------------------
// API Fetch Helper
// ----------------------
async function apiFetch(url, options = {}) {
  const token = typeof getToken === "function" ? getToken() : null;
  const headers = { ...(options.headers || {}) };
  const timeoutMs = Number(options.timeoutMs || 60000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });

    if (res.status === 401 || res.status === 403) {
      if (!isOffline()) {
        if (typeof clearUser === "function") clearUser();
        if (typeof clearToken === "function") clearToken();
      }
      showMsg(
        isOffline()
          ? "You're offline. Login can be completed when back online."
          : "Session expired. Please log in again when ready.",
        false
      );
      return null;
    }

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) throw new Error(data.message || data.raw || "Request failed");
    return data;
  } catch (err) {
    if (err?.name === "AbortError") {
      showMsg("Request timed out. Please try again with a smaller image.", false);
      return null;
    }
    console.error("API Error:", err.message || err);
    showMsg(err.message || "Server error. Try again.", false);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMyOrdersFresh() {
  const sep = API_BASE_ORDERS.includes("?") ? "&" : "?";
  const url = `${API_BASE_ORDERS}/myorders${sep}_=${Date.now()}`;
  return apiFetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function validateAffiliateCodeBeforeSubmit(rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { ok: true, code: "", ownerName: "", commissionRate: 0 };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${API_BASE}/affiliates/validate-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.valid) {
      return {
        ok: true,
        code,
        ownerName: String(data.ownerName || "").trim(),
        commissionRate: Number(data.commissionRate || 0),
      };
    }
    // Only mark definitely invalid when server says bad request/not found.
    if (res.status === 400 || res.status === 404) {
      return { ok: false, code: "", ownerName: "", commissionRate: 0, reason: "invalid" };
    }
    // For temporary server issues, keep code and let backend resolve.
    return { ok: true, code, ownerName: "", commissionRate: 0, uncertain: true };
  } catch {
    // Network timeout/error: do not drop affiliate code.
    return { ok: true, code, ownerName: "", commissionRate: 0, uncertain: true };
  } finally {
    clearTimeout(timer);
  }
}

async function validateDiscountCodeBeforeSubmit(rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { ok: true, code: "", percent: 0, amount: 0 };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${API_BASE}/discounts/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        ok: true,
        code: String(data.code || code).trim().toUpperCase(),
        percent: Number(data.percent || 0),
      };
    }
    if (res.status === 400 || res.status === 404) {
      return { ok: false, code: "", percent: 0, amount: 0, reason: "invalid" };
    }
    // Temporary server issue: keep typed code and let backend decide.
    return { ok: true, code, percent: Number(discountState.percent || 0), uncertain: true };
  } catch {
    return { ok: true, code, percent: Number(discountState.percent || 0), uncertain: true };
  } finally {
    clearTimeout(timer);
  }
}

function computeCheckoutTotals(cart, shipping = 0) {
  const subtotal = (cart || []).reduce(
    (sum, i) => sum + Number(i.price || 0) * Number(i.qty || i.quantity || 1),
    0
  );
  const discountAmount = Number(discountState.amount || 0);
  const total = Math.max(0, subtotal - discountAmount + Number(shipping || 0));
  return { subtotal, discountAmount, shipping: Number(shipping || 0), total };
}

function findOrderFromMarker(orders, marker) {
  if (!Array.isArray(orders) || !orders.length || !marker) return null;

  const byRef = findRecentMatchingOrder(orders, {
    clientOrderRef: marker.clientOrderRef || "",
  });
  if (byRef) return byRef;

  const createdMs = marker.createdAt ? new Date(marker.createdAt).getTime() : 0;
  const fallback = findRecentMatchingOrder(orders, {
    itemsCount: Number(marker.itemsCount || 0),
    paymentMethod: marker.paymentMethod || "",
    shippingEmail: marker.shippingEmail || "",
    mobileNumber: marker.mobileNumber || "",
  });
  if (!fallback) return null;

  if (!createdMs) return fallback;
  const orderCreatedMs = fallback.createdAt ? new Date(fallback.createdAt).getTime() : 0;
  // Accept only orders close to marker creation time to avoid old-order false matches.
  if (!orderCreatedMs) return null;
  return orderCreatedMs >= createdMs - 2 * 60 * 1000 ? fallback : null;
}

async function waitForOrderByMarker(marker, maxMs = 12000, intervalMs = 1500) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const myOrdersRaw = await fetchMyOrdersFresh();
    const myOrders = extractOrdersList(myOrdersRaw);
    const found = findOrderFromMarker(myOrders, marker);
    if (found) return found;
    await sleep(intervalMs);
  }
  return null;
}

async function uploadPaymentProofImage(file) {
  const fd = new FormData();
  fd.append("image", file);
  const result = await apiFetch(`${API_BASE}/upload/payment-proof`, {
    method: "POST",
    body: fd,
    timeoutMs: 60000,
  });
  return String(result?.imageUrl || result?.url || "").trim();
}

async function tryRecoverPendingOrderAndRedirect() {
  const token = typeof getToken === "function" ? getToken() : null;
  if (!token) {
    clearPendingOrderMarker();
    setCheckoutInProgress(false);
    return false;
  }

  const marker = readPendingOrderMarker();
  if (!marker?.createdAt) {
    setCheckoutInProgress(false);
    return false;
  }

  const createdMs = new Date(marker.createdAt).getTime();
  if (!createdMs || Date.now() - createdMs > 15 * 60 * 1000) {
    clearPendingOrderMarker();
    setCheckoutInProgress(false);
    return false;
  }

  const recovered = await waitForOrderByMarker(marker, 12000, 1200);

  if (!recovered) {
    clearPendingOrderMarker();
    setCheckoutInProgress(false);
    return false;
  }

  const summary = {
    reference: String(recovered._id || recovered.id || ""),
    name: recovered.shippingName || "",
    email: recovered.shippingEmail || "",
    phone: recovered.mobileNumber || "",
    address: recovered.shippingAddress || "",
    city: recovered.shippingCity || "",
    notes: "",
    paymentMethod: recovered.paymentMethod || "",
    date: recovered.createdAt || new Date().toISOString(),
    items: Array.isArray(recovered.orderItems)
      ? recovered.orderItems.map((it) => ({
          name: it?.product?.name || "Product",
          quantity: Number(it?.qty || 1),
          price: Number(it?.price || 0),
        }))
      : [],
    shipping: 0,
    subtotal: Number(recovered.itemsPrice || recovered.totalPrice || 0),
    discountCode: String(recovered.discountCode || "").trim(),
    discountPercent: Number(recovered.discountPercent || 0),
    discountAmount: Number(recovered.discountAmount || 0),
    total: Number(recovered.totalPrice || 0) + 35,
    affiliateCode: String(recovered.affiliateCode || "").trim(),
    affiliateName: "",
    affiliateCommissionRate: Number(recovered.affiliateCommissionRate || 0),
    affiliateCommissionAmount: Number(recovered.affiliateCommissionAmount || 0),
    screenshot_url: recovered.paymentScreenshotUrl || "",
  };
  localStorage.setItem("lastOrder", JSON.stringify(summary));
  localStorage.setItem("orderSent", "true");
  clearPendingOrderMarker();
  setCheckoutInProgress(false);
  window.location.replace("thankyou.html");
  return true;
}

// ----------------------
// Load Products
// ----------------------
async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE_PRODUCTS}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache",
      },
    });
    if (!res.ok) {
      if (res.status === 304) {
        return Array.isArray(window.__checkoutProductsCache)
          ? window.__checkoutProductsCache
          : [];
      }
      return [];
    }

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    const list = Array.isArray(data) ? data : Array.isArray(data.products) ? data.products : [];
    window.__checkoutProductsCache = list;
    return list;
  } catch {
    return Array.isArray(window.__checkoutProductsCache)
      ? window.__checkoutProductsCache
      : [];
  }
}

// ----------------------
// Render Order Summary
// ----------------------
let discountState = { code: null, percent: 0, amount: 0 };
let affiliateUiState = { code: "", name: "", commissionRate: 0, commissionAmount: 0, referralCount: 0, totalEarned: 0, valid: false };
function getCartSubtotal() {
  const cart = window.cart?.getLocalCart?.() || [];
  return cart.reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.qty || 1),
    0
  );
}
async function renderOrder(products) {
  const cart = window.cart?.getLocalCart?.() || [];
  const orderItemsEl = document.getElementById("order-items");
  const totalEl = document.getElementById("order-total");
  const shippingEl = document.getElementById("shipping");
  const discountEl = document.getElementById("discount-amount");

  if (!orderItemsEl || !totalEl || !shippingEl) return;

  orderItemsEl.innerHTML = "";

  if (!cart || cart.length === 0) {
    orderItemsEl.innerHTML = `<p>Your cart is empty.</p>`;
    shippingEl.textContent = money(0);
    totalEl.textContent = money(0);
    return;
  }

  let subtotal = 0;
  cart.forEach((item) => {
    const p = products.find((x) => String(x._id) === String(item.productId || item._id));
    if (!p) return;
    const line = Number(p.price) * Number(item.qty);
    subtotal += line;

    const imageSrc = resolveImage(p.images?.[0] || p.image || item.image || "assets/img/placeholder.png");
    const row = document.createElement("div");
    row.className = "order-item";
    row.innerHTML = `
      <a class="order-item-image" href="product.html?id=${encodeURIComponent(p._id)}">
        <img src="${imageSrc}" alt="${p.name}" width="120" height="120" loading="lazy" decoding="async">
        <span class="order-item-qty-badge">${item.qty}</span>
      </a>
      <div class="order-item-details">
        <a class="order-item-name" href="product.html?id=${encodeURIComponent(p._id)}">${p.name}</a>
        <div class="order-item-meta">Qty: ${item.qty}</div>
      </div>
      <div class="order-item-price">${money(line)}</div>
    `;
    orderItemsEl.appendChild(row);
  });

  const shipping = 0;
  const discountAmount = discountState.amount || 0;
  if (discountEl) discountEl.textContent = money(discountAmount);
  shippingEl.textContent = "FREE Nationwide Delivery";
  totalEl.textContent = money(subtotal - discountAmount + shipping);

  const affiliateRow = document.getElementById("checkoutAffiliateRow");
  const affiliateAmount = document.getElementById("checkoutAffiliateAmount");
  const affiliateLabel = document.getElementById("checkoutAffiliateLabel");
  const affiliateImpact = document.getElementById("checkoutAffiliateImpact");
  const affiliateSupportName = document.getElementById("checkoutAffiliateSupportName");
  const affiliateSupportAmount = document.getElementById("checkoutAffiliateSupportAmount");
  const affiliateReferrals = document.getElementById("checkoutAffiliateReferrals");
  const affiliateTotalEarned = document.getElementById("checkoutAffiliateTotalEarned");

  const validAffiliate = affiliateUiState?.valid && Number(affiliateUiState?.commissionAmount || 0) > 0;
  if (affiliateRow && affiliateAmount) {
    affiliateRow.style.display = validAffiliate ? "flex" : "none";
    if (validAffiliate) {
      affiliateAmount.textContent = money(affiliateUiState.commissionAmount);
      if (affiliateLabel) {
        affiliateLabel.textContent = affiliateUiState.name
          ? `Affiliate Earning (${affiliateUiState.name})`
          : "Affiliate Earning";
      }
    }
  }

  if (affiliateImpact) {
    affiliateImpact.style.display = validAffiliate ? "block" : "none";
    if (validAffiliate) {
      const referralCount = Math.max(Number(affiliateUiState.referralCount || 0), 0) + 1;
      const trackedTotal = Number(affiliateUiState.totalEarned || 0);
      const projectedTotal = trackedTotal > 0
        ? trackedTotal + Number(affiliateUiState.commissionAmount || 0)
        : Number(affiliateUiState.commissionAmount || 0);

      if (affiliateSupportName) {
        affiliateSupportName.textContent = affiliateUiState.name || "this affiliate";
      }
      if (affiliateSupportAmount) {
        affiliateSupportAmount.textContent = money(affiliateUiState.commissionAmount || 0);
      }
      if (affiliateReferrals) {
        affiliateReferrals.textContent = `This will be their ${referralCount} referral`;
      }
      if (affiliateTotalEarned) {
        affiliateTotalEarned.textContent = money(projectedTotal);
      }
    }
  }
  updateMobileCheckoutBar(window.__checkoutCurrentStep || 1);
}

// ----------------------
// Payment Instructions
// ----------------------
function syncPaymentOptionCards(methodRaw) {
  const method = (methodRaw || "").toLowerCase();
  document.querySelectorAll(".payment-option[data-method]").forEach((btn) => {
    const isActive = (btn.dataset.method || "").toLowerCase() === method && method !== "";
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function renderPaymentInfo(title, rows) {
  const list = rows
    .map((row) => `
      <div class="payment-info-row">
        <span class="payment-info-label">${row.label}</span>
        <strong class="payment-info-value">${row.value}</strong>
      </div>
    `)
    .join("");

  return `
    <div class="payment-info-wrap">
      <h4 class="payment-info-title">${title}</h4>
      <div class="payment-info-list">${list}</div>
    </div>
  `;
}

function setPaymentInstructions(methodRaw) {
  const method = (methodRaw || "").toLowerCase();
  syncPaymentOptionCards(method);
  const box = document.getElementById("payment-instructions");
  if (!box) return;

  let html = "";
  if (method === "mtn") {
    html = renderPaymentInfo("MTN Mobile Money", [
      { label: "Merchant Number(ID)", value: "694988" },
      { label: "Merchant Name", value: "Deetek 360 Enterprise (DEETECH COMPUTERS)" },
      { label: "MoMo Number", value: "0591755964" },
      { label: "Account Name", value: "Daniel Adjei Mensah (DEETECH COMPUTERS)" },
    ]);
  } else if (method === "vodafone") {
    html = renderPaymentInfo("Telecel (Vodafone) Cash", [
      { label: "Merchant ID", value: "451444" },
      { label: "Account Name", value: "DEETEK 360 Enterprise (DEETECH COMPUTERS)" },
    ]);
  } else if (method === "hubtel") {
    html = renderPaymentInfo("Hubtel", [
      { label: "Dial", value: "*713*5964#" },
      { label: "Account Name", value: "DEETEK 360 Enterprise (DEETECH COMPUTERS)" },
    ]);
  } else if (method === "bank") {
    html = renderPaymentInfo("Bank Transfer", [
      { label: "Bank", value: "Calbank" },
      { label: "Account Number", value: "1400009398769" },
      { label: "Account Name", value: "DEETEK 360 Enterprise (DEETECH COMPUTERS)" },
    ]);
  }

  box.innerHTML = html;
  box.style.display = method ? "block" : "none";
}

// ----------------------
// Screenshot Preview
// ----------------------
function wireScreenshotPreview() {
  const input = document.getElementById("payment-screenshot");
  const img = document.getElementById("screenshot-preview");
  if (!input || !img) return;

  let lastObjectUrl = "";
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (lastObjectUrl) {
      URL.revokeObjectURL(lastObjectUrl);
      lastObjectUrl = "";
    }
    if (!f) {
      img.style.display = "none";
      img.src = "";
      return;
    }
    lastObjectUrl = URL.createObjectURL(f);
    img.src = lastObjectUrl;
    img.style.display = "block";
  });
}

function toggleGuestUI(isLoggedIn) {
  const guestBox = document.getElementById("guest-payment-proof");
  if (!guestBox) return;
  guestBox.style.display = "block";
}

function initCheckoutStepFlow() {
  const form = document.getElementById("checkout-form");
  if (!form) return;

  const heading = form.querySelector("h3");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const phoneInput = document.getElementById("phone");
  const addressInput = document.getElementById("address");
  const cityInput = document.getElementById("city");
  const affiliateInput = document.getElementById("affiliate-code");
  const affiliateStatus = document.getElementById("affiliate-code-status");
  const paymentMethodSelect = document.getElementById("payment-method");
  const paymentOptions = document.getElementById("payment-options");
  const paymentInstructions = document.getElementById("payment-instructions");
  const paymentProof = document.getElementById("guest-payment-proof");
  const screenshotInput = document.getElementById("payment-screenshot");
  const placeOrderBtn = document.getElementById("place-order-btn");
  const checkoutMsg = document.getElementById("checkout-message");
  const discountInput = document.getElementById("discount-code");
  const applyDiscountBtn = document.getElementById("apply-discount");
  const discountStatus = document.getElementById("discount-code-status");

  if (!heading || !nameInput || !affiliateInput || !paymentMethodSelect || !placeOrderBtn) return;

  const formChildren = Array.from(form.children);
  const hiddenInputs = formChildren.filter((el) => el.tagName === "INPUT" && el.type === "hidden");
  hiddenInputs.forEach((el) => form.removeChild(el));

  const stepper = document.createElement("div");
  stepper.className = "checkout-stepper";
  stepper.innerHTML = `
    <div class="checkout-stepper-item is-active" data-stepper-index="1"><span>1</span><p>Buyer Details</p></div>
    <div class="checkout-stepper-item" data-stepper-index="2"><span>2</span><p>Payment & Review</p></div>
  `;

  const stepWrap = document.createElement("div");
  stepWrap.className = "checkout-step-wrap";

  const step1 = document.createElement("section");
  step1.className = "checkout-step-panel is-active";
  step1.dataset.step = "1";
  step1.innerHTML = `<h4>Buyer Details</h4><p class="checkout-step-note">Enter your delivery details and optional affiliate code.</p>`;

  const step2 = document.createElement("section");
  step2.className = "checkout-step-panel";
  step2.dataset.step = "2";
  step2.innerHTML = `<h4>Payment & Review</h4><p class="checkout-step-note">Choose payment method, upload proof, apply discount, then place your order.</p>`;

  const moveIf = (el, target) => {
    if (el && target && el.parentElement) target.appendChild(el);
  };
  const moveLabelAndField = (inputEl, target) => {
    if (!inputEl || !target) return;
    const label = form.querySelector(`label[for="${inputEl.id}"]`);
    moveIf(label, target);
    moveIf(inputEl, target);
  };

  moveLabelAndField(nameInput, step1);
  const contactRow = emailInput?.closest(".two-col");
  moveIf(contactRow, step1);
  moveLabelAndField(addressInput, step1);
  const cityNotesRow = cityInput?.closest(".two-col");
  moveIf(cityNotesRow, step1);
  moveLabelAndField(affiliateInput, step1);
  const affiliateHint = affiliateInput?.nextElementSibling;
  if (affiliateHint && affiliateHint.classList.contains("hint")) moveIf(affiliateHint, step1);
  moveIf(affiliateStatus, step1);

  const paymentLabel = form.querySelector('label[for="payment-method"]');
  moveIf(paymentLabel, step2);
  moveIf(paymentOptions, step2);
  moveIf(paymentMethodSelect, step2);
  moveIf(paymentInstructions, step2);
  moveIf(paymentProof, step2);

  const discountRow = discountInput?.closest(".discount-row") || null;
  if (discountInput && applyDiscountBtn) {
    const discountBlock = document.createElement("div");
    discountBlock.className = "checkout-discount-block";

    const discountLabel = document.createElement("label");
    discountLabel.setAttribute("for", "discount-code");
    discountLabel.textContent = "Discount Code (optional)";

    const discountActions = document.createElement("div");
    discountActions.className = "checkout-discount-actions";

    moveIf(discountInput, discountActions);
    moveIf(applyDiscountBtn, discountActions);

    discountBlock.appendChild(discountLabel);
    discountBlock.appendChild(discountActions);
    moveIf(discountStatus, discountBlock);
    step2.appendChild(discountBlock);

    if (discountRow && discountRow.parentElement && discountRow.children.length === 0) {
      discountRow.remove();
    }
  }

  moveIf(placeOrderBtn, step2);

  const actions1 = document.createElement("div");
  actions1.className = "checkout-step-actions";
  actions1.innerHTML = `<button type="button" class="checkout-step-next" data-next-step="2">Continue to Payment & Review</button>`;
  step1.appendChild(actions1);

  const actions2 = document.createElement("div");
  actions2.className = "checkout-step-actions";
  actions2.innerHTML = `<button type="button" class="checkout-step-back" data-prev-step="1">Back to Details</button>`;
  step2.prepend(actions2);

  stepWrap.appendChild(step1);
  stepWrap.appendChild(step2);

  heading.insertAdjacentElement("afterend", stepper);
  stepper.insertAdjacentElement("afterend", stepWrap);
  moveIf(checkoutMsg, form);

  hiddenInputs.forEach((el) => form.appendChild(el));

  let currentStep = 1;
  const panels = [step1, step2];
  const stepItems = Array.from(stepper.querySelectorAll(".checkout-stepper-item"));

  const showStep = (step, opts = {}) => {
    const skipScroll = Boolean(opts.skipScroll);
    currentStep = Math.min(2, Math.max(1, Number(step) || 1));
    if (heading) {
      heading.textContent = currentStep === 2 ? "Payment & Review" : "Billing Details";
    }
    panels.forEach((panel, idx) => {
      panel.classList.toggle("is-active", idx + 1 === currentStep);
    });
    stepItems.forEach((item, idx) => {
      const index = idx + 1;
      item.classList.toggle("is-active", index === currentStep);
      item.classList.toggle("is-complete", index < currentStep);
    });
    updateMobileCheckoutBar(currentStep);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
    try {
      sessionStorage.setItem(CHECKOUT_STEP_KEY, String(currentStep));
    } catch {}
    if (!skipScroll) {
      try {
        stepper.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {}
    }
  };
  window.__checkoutShowStep = showStep;

  const validateStep1 = () => {
    const email = String(emailInput?.value || "").trim();
    const phone = String(phoneInput?.value || "").replace(/\s+/g, "");
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const phoneValid = /^(?:0\d{9}|\+233\d{9})$/.test(phone);
    if (!String(nameInput?.value || "").trim() || !email || !String(addressInput?.value || "").trim() || !String(cityInput?.value || "").trim() || !phone) {
      showMsg("Please complete your buyer details to continue.", false);
      return false;
    }
    if (!emailValid || !phoneValid) {
      showMsg("Please enter a valid email and Ghana phone number.", false);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!String(paymentMethodSelect?.value || "").trim()) {
      showMsg("Please choose a payment method to continue.", false);
      return false;
    }
    if (!screenshotInput?.files?.[0]) {
      showMsg("Please upload payment screenshot to continue.", false);
      return false;
    }
    return true;
  };

  const mobilePrimaryBtn = document.getElementById("checkoutMobilePrimaryBtn");
  if (mobilePrimaryBtn && !mobilePrimaryBtn.dataset.wired) {
    mobilePrimaryBtn.dataset.wired = "1";
    mobilePrimaryBtn.addEventListener("click", () => {
      if (currentStep === 1) {
        if (!validateStep1()) return;
        showStep(2);
        return;
      }
      if (!validateStep2()) return;
      placeOrderBtn?.click();
    });
  }

  form.addEventListener("click", (ev) => {
    const nextBtn = ev.target.closest(".checkout-step-next");
    if (nextBtn) {
      const targetStep = Number(nextBtn.dataset.nextStep || 0);
      if (currentStep === 1 && !validateStep1()) return;
      showStep(targetStep);
      return;
    }
    const backBtn = ev.target.closest(".checkout-step-back");
    if (backBtn) {
      const targetStep = Number(backBtn.dataset.prevStep || 0);
      showStep(targetStep);
    }
  });

  let restoreStep = 1;
  try {
    const stored = Number(sessionStorage.getItem(CHECKOUT_STEP_KEY) || "1");
    if (Number.isFinite(stored)) {
      restoreStep = Math.min(2, Math.max(1, stored));
    }
  } catch {}
  showStep(restoreStep, { skipScroll: true });
}

// ----------------------
// Prefill Profile Data
// ----------------------
async function prefillCheckoutDetails() {
  const token = typeof getToken === "function" ? getToken() : null;
  if (!token || !API_BASE_USERS) return;

  const setIfEmpty = (el, value) => {
    if (!el || !value) return;
    if (String(el.value || "").trim()) return;
    el.value = value;
  };

  try {
    const profile = await apiFetch(`${API_BASE_USERS}/profile`, { method: "GET" });
    if (!profile) return;

    const first = profile.firstName || "";
    const last = profile.lastName || "";
    const fullName = (profile.name || `${first} ${last}`.trim()).trim();

    setIfEmpty(document.getElementById("name"), fullName);
    setIfEmpty(document.getElementById("email"), profile.email || "");
    setIfEmpty(document.getElementById("phone"), profile.phone || "");
    setIfEmpty(document.getElementById("address"), profile.address || "");
    setIfEmpty(document.getElementById("city"), profile.city || "");
  } catch (err) {
    console.warn("Failed to prefill checkout:", err);
  }
}

// ----------------------
// Checkout Submission
// ----------------------
function handleCheckout(products) {
  const form = document.getElementById("checkout-form");
  const methodEl = document.getElementById("payment-method");
  const screenshotEl = document.getElementById("payment-screenshot");
  const affiliateCodeEl = document.getElementById("affiliate-code");
  const affiliateStatusEl = document.getElementById("affiliate-code-status");
  const affiliateNote = document.getElementById("affiliate-note");
  const submitBtn = form ? (form.querySelector("#place-order-btn") || form.querySelector('button[type="submit"]') || form.querySelector('button[type="button"]')) : null;
  const btnText = submitBtn?.querySelector(".btn-text");
  const spinner = submitBtn?.querySelector(".spinner");

  if (!form) return;

  if (methodEl) {
    methodEl.addEventListener("change", (e) =>
      setPaymentInstructions(e.target.value)
    );
  }

  const paymentOptionButtons = document.querySelectorAll(".payment-option[data-method]");
  paymentOptionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = String(btn.dataset.method || "").toLowerCase();
      if (!methodEl || !value) return;
      methodEl.value = value;
      setPaymentInstructions(value);
    });
  });

  let affiliateValidateTimer = null;
  async function validateAffiliateCodeUi() {
    const code = (affiliateCodeEl?.value || "").trim().toUpperCase();
    if (!affiliateStatusEl) return;
    if (!code) {
      affiliateStatusEl.style.display = "none";
      affiliateStatusEl.textContent = "";
      affiliateStatusEl.style.color = "";
      if (affiliateNote) affiliateNote.style.display = "none";
      affiliateUiState = { code: "", name: "", commissionRate: 0, commissionAmount: 0, referralCount: 0, totalEarned: 0, valid: false };
      await renderOrder(products);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
      return;
    }

    affiliateStatusEl.style.display = "block";
    if (affiliateNote) affiliateNote.style.display = "block";
    affiliateStatusEl.textContent = "Checking affiliate code...";
    affiliateStatusEl.style.color = "#475569";

    try {
      const res = await fetch(`${API_BASE}/affiliates/validate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        affiliateStatusEl.textContent = `Affiliate code is valid (${data.ownerName || "registered affiliate"}).`;
        affiliateStatusEl.style.color = "#15803d";
        const rate = Number(data.commissionRate || 0);
        const subtotal = getCartSubtotal();
        affiliateUiState = {
          code,
          name: String(data.ownerName || "").trim(),
          commissionRate: rate,
          commissionAmount: rate > 0 ? (subtotal * rate) / 100 : 0,
          referralCount: Number(data.totalReferrals || data.referralCount || 0),
          totalEarned: Number(data.totalEarned || data.totalCommission || 0),
          valid: true,
        };
        await renderOrder(products);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
      } else {
        affiliateStatusEl.textContent = data.message || "Affiliate code not found.";
        affiliateStatusEl.style.color = "#b91c1c";
        affiliateUiState = { code: "", name: "", commissionRate: 0, commissionAmount: 0, referralCount: 0, totalEarned: 0, valid: false };
        await renderOrder(products);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
      }
    } catch {
      affiliateStatusEl.textContent = "Could not validate affiliate code right now.";
      affiliateStatusEl.style.color = "#b45309";
      affiliateUiState = { code: "", name: "", commissionRate: 0, commissionAmount: 0, referralCount: 0, totalEarned: 0, valid: false };
      await renderOrder(products);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
    }
  }

  affiliateCodeEl?.addEventListener("focus", () => {
    if (affiliateNote) affiliateNote.style.display = "block";
  });
  affiliateCodeEl?.addEventListener("input", () => {
    if (affiliateValidateTimer) clearTimeout(affiliateValidateTimer);
    affiliateValidateTimer = setTimeout(() => {
      validateAffiliateCodeUi();
    }, 350);
  });
  affiliateCodeEl?.addEventListener("blur", () => {
    validateAffiliateCodeUi();
    if (!(affiliateCodeEl?.value || "").trim()) {
      if (affiliateNote) affiliateNote.style.display = "none";
    }
  });

  const runCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

    if (form.dataset.submitting === "1") return;

    const token = typeof getToken === "function" ? getToken() : null;
    const isLoggedIn = !!token;

    const email = form.querySelector("#email")?.value.trim() || "";
    const phone = form.querySelector("#phone")?.value.trim() || "";
    const name = (document.getElementById("name")?.value || "").trim();
    const address = (document.getElementById("address")?.value || "").trim();
    const city = (document.getElementById("city")?.value || "").trim();
    const notes = (document.getElementById("notes")?.value || "").trim();
    let affiliateCode = (document.getElementById("affiliate-code")?.value || "").trim().toUpperCase();
    let affiliateName = "";
    let affiliateCommissionRate = 0;
    const discountInputCode = (document.getElementById("discount-code")?.value || "").trim();
    const method = (methodEl?.value || "").trim();
    const clientOrderRef = generateClientOrderRef();

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const phoneClean = phone.replace(/\s+/g, "");
    const phoneValid = /^(?:0\d{9}|\+233\d{9})$/.test(phoneClean);

    if (!emailValid || !phoneValid) {
      showMsg(
        "Please enter a valid email and Ghana phone number (e.g. 0241234567 or +233241234567).",
        false
      );
      return;
    }

    if (!name || !email || !address || !city || !phone || !method) {
      showMsg("Please fill all required fields.", false);
      return;
    }

    const cart = window.cart?.getLocalCart?.();
    if (!cart || cart.length === 0) {
      showMsg("Your cart is empty.", false);
      return;
    }

    form.dataset.submitting = "1";
    setCheckoutInProgress(true);
    let keepOverlayUntilRedirect = false;

    if (submitBtn) {
      setProcessingOverlay(true, "Validating your order details...");
      submitBtn.classList.add("loading");
      submitBtn.disabled = true;
      if (btnText) btnText.style.display = "none";
      if (spinner) spinner.style.display = "inline-block";
    }

    try {
      const items = cart
        .map((ci) => {
          const p = products.find(
            (x) => String(x._id) === String(ci.productId || ci._id)
          );
          if (!p) return null;
          return { product: p._id, qty: Number(ci.qty || 1), _p: p };
        })
        .filter(Boolean);

      if (!items.length) {
        showMsg("Some cart items are invalid. Please refresh and try again.", false);
        return;
      }
      const outOfStock = items.find((it) => Number(it._p?.countInStock || 0) < 1);
      if (outOfStock) {
        showMsg("Some items are out of stock. Please remove them from cart.", false);
        return;
      }
      const overStock = items.find(
        (it) => Number(it.qty || 0) > Number(it._p?.countInStock || 0)
      );
      if (overStock) {
        showMsg("Some items exceed available stock. Please reduce quantities.", false);
        return;
      }

      const orderItems = items.map((it) => ({
        product: it.product,
        qty: it.qty,
      }));

      const file = screenshotEl?.files?.[0];
      if (!file) {
        showMsg("Please upload a payment screenshot.", false);
        return;
      }

      let saved = null;
      let finalDiscountCode = "";
      const normalizedInputDiscount = discountInputCode.toUpperCase();

      if (affiliateCode) {
        const affiliateCheck = await validateAffiliateCodeBeforeSubmit(affiliateCode);
        if (affiliateCheck.ok) {
          affiliateCode = affiliateCheck.code;
          affiliateName = affiliateCheck.ownerName || "";
          affiliateCommissionRate = Number(affiliateCheck.commissionRate || 0);
          if (affiliateCheck.uncertain) {
            showMsg("Affiliate code verification is delayed. We will verify it on the server.", true);
          }
        } else {
          // Keep user-entered code so backend can still store/reconcile it.
          showMsg("Affiliate code could not be verified now. We will validate it on the server.", false);
        }
      }

      // Validate discount at submit time. Do not block order if validation endpoint is unavailable.
      if (normalizedInputDiscount) {
        const discountCheck = await validateDiscountCodeBeforeSubmit(normalizedInputDiscount);
        if (discountCheck.ok) {
          finalDiscountCode = discountCheck.code;
          const subtotal = getCartSubtotal();
          discountState = {
            code: finalDiscountCode,
            percent: Number(discountCheck.percent || 0),
            amount: (subtotal * Number(discountCheck.percent || 0)) / 100,
          };
          await renderOrder(products);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
          if (discountCheck.uncertain) {
            showMsg("Discount verification is delayed. We will verify it on the server.", true);
          }
        } else {
          finalDiscountCode = "";
          discountState = { code: null, percent: 0, amount: 0 };
          await renderOrder(products);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
          showMsg("Discount code is invalid/unavailable right now. Continuing without discount.", false);
        }
      }

      showMsg("Uploading payment proof...", true);
      setProcessingOverlay(true, "Uploading payment proof...");
      const uploadedProofUrl = await uploadPaymentProofImage(file);
      if (!uploadedProofUrl) {
        setProcessingOverlay(false);
        showMsg("Payment proof upload failed. Please try again.", false);
        return;
      }

      if (isLoggedIn) {
        savePendingOrderMarker({
          clientOrderRef,
          itemsCount: orderItems.length,
          paymentMethod: method,
          shippingEmail: email,
          mobileNumber: phoneClean,
        });
        const payload = {
          orderItems,
          paymentMethod: method,
          deliveryRegion: city,
          mobileNumber: phoneClean,
          shippingName: name,
          shippingEmail: email,
          shippingAddress: address,
          shippingCity: city,
          clientOrderRef,
          paymentScreenshotUrl: uploadedProofUrl,
          discountCode: finalDiscountCode || undefined,
          affiliateCode: affiliateCode || undefined,
        };
        showMsg("Saving your order...", true);
        setProcessingOverlay(true, "Saving your order...");
        saved = await apiFetch(`${API_BASE_ORDERS}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        const payload = {
          orderItems,
          paymentMethod: method,
          deliveryRegion: city,
          mobileNumber: phoneClean,
          clientOrderRef,
          guestName: name,
          guestEmail: email,
          guestAddress: address,
          guestCity: city,
          guestNotes: notes || "",
          paymentScreenshotUrl: uploadedProofUrl,
          discountCode: finalDiscountCode || undefined,
          affiliateCode: affiliateCode || undefined,
        };
        showMsg("Saving your order...", true);
        setProcessingOverlay(true, "Saving your order...");
        saved = await apiFetch(`${API_BASE_ORDERS}/guest`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      let savedOrder = normalizeSavedOrderResponse(saved);
      let savedOrderId = String(savedOrder?._id || savedOrder?.id || "");

      // If response was interrupted but order may still have been created, recover immediately.
      if (!savedOrder && isLoggedIn) {
        setProcessingOverlay(true, "Finalizing your order...");
        savedOrder = await waitForOrderByMarker(
          {
            clientOrderRef,
            createdAt: new Date().toISOString(),
            itemsCount: orderItems.length,
            paymentMethod: method,
            shippingEmail: email,
            mobileNumber: phoneClean,
          },
          12000,
          1200
        );
        savedOrderId = String(savedOrder?._id || savedOrder?.id || "");
      }

      if (!savedOrder) {
        showMsg("Could not confirm order creation. Please retry.", false);
        return;
      }

      // Logged-in safety check: confirm the new order exists server-side before sending emails/success.
      if (isLoggedIn) {
        setProcessingOverlay(true, "Confirming your order...");
        const myOrdersRaw = await fetchMyOrdersFresh();
        const myOrders = extractOrdersList(myOrdersRaw);
        if (savedOrder && Array.isArray(myOrders) && savedOrderId) {
          const exists = myOrders.some((o) => String(o?._id || o?.id) === savedOrderId);
          if (!exists) {
            showMsg("Order could not be confirmed on server. Please retry.", false);
            return;
          }
        } else if (!savedOrder && Array.isArray(myOrders)) {
          savedOrder = await waitForOrderByMarker(
            {
              clientOrderRef,
              createdAt: new Date().toISOString(),
              itemsCount: orderItems.length,
              paymentMethod: method,
              shippingEmail: email,
              mobileNumber: phoneClean,
            },
            12000,
            1200
          );
          savedOrderId = String(savedOrder?._id || savedOrder?.id || "");
          if (!savedOrder) {
            showMsg("Order could not be confirmed on server. Please retry.", false);
            return;
          }
        } else if (!Array.isArray(myOrders) || !myOrders.length) {
          console.warn("Unexpected /api/orders response shape:", saved);
        }
      }
      if (!savedOrder) {
        console.warn("Unexpected /api/orders response shape:", saved);
        showMsg("Order was not saved correctly. Please try again.", false);
        return;
      }

      const orderItemsHTML = cart
        .map((i) => `<li>${i.name} x ${i.qty} = ${money(i.price * i.qty)}</li>`)
        .join("");

      try {
        await sendOrderEmailsViaEmailJs({
          savedOrder,
          cart,
          customerName: name,
          customerEmail: email,
          customerPhone: phoneClean,
          address,
          city,
          paymentMethod: method,
          notes,
        });
      } catch (emailErr) {
        console.error("Order EmailJS send failed:", emailErr);
        showMsg("Order saved, but email notification failed. We'll still process your order.", false);
      }

      showMsg(`Order placed successfully (#${savedOrderId}). Redirecting...`, true);
      setProcessingOverlay(true, "Order confirmed. Redirecting to your receipt...");
      keepOverlayUntilRedirect = true;
      const checkoutTotals = computeCheckoutTotals(cart, 0);
      const commissionBase = Math.max(
        0,
        Number(checkoutTotals.subtotal || 0) - Number(checkoutTotals.discountAmount || 0)
      );
      const fallbackCommissionAmount =
        affiliateCode && Number(affiliateCommissionRate || 0) > 0
          ? Number(((commissionBase * Number(affiliateCommissionRate || 0)) / 100).toFixed(2))
          : 0;

      const summary = {
        ...checkoutTotals,
        reference: savedOrderId,
        name,
        email,
        phone: phoneClean,
        address,
        city,
        notes,
        paymentMethod: method,
        date: new Date().toISOString(),
        items: cart.map((i) => ({
          name: i.name,
          quantity: i.qty,
          price: i.price,
        })),
        discountCode: finalDiscountCode || "",
        discountPercent: Number(discountState.percent || 0),
        discountAmount: Number(discountState.amount || 0),
        affiliateCode: affiliateCode || "",
        affiliateName,
        affiliateCommissionRate: Number(savedOrder.affiliateCommissionRate || affiliateCommissionRate || 0),
        affiliateCommissionAmount: Number(
          savedOrder.affiliateCommissionAmount || fallbackCommissionAmount || 0
        ),
        screenshot_url: savedOrder.paymentScreenshotUrl || "",
      };
      localStorage.setItem("lastOrder", JSON.stringify(summary));
      localStorage.setItem("orderSent", "true");
      try { sessionStorage.removeItem(CHECKOUT_STEP_KEY); } catch {}
      try { sessionStorage.removeItem(CHECKOUT_DRAFT_KEY); } catch {}
      clearPendingOrderMarker();

      try {
        if (window.cart?.clearCart) {
          await window.cart.clearCart();
        }
      } catch (err) {
        console.warn("Failed to clear server cart:", err);
      }
      try {
        localStorage.removeItem("cart");
        document.dispatchEvent(new Event("cart-updated"));
      } catch (err) {
        console.warn("Failed to clear local cart:", err);
      }

      setTimeout(() => {
        setCheckoutInProgress(false);
        window.location.replace("thankyou.html");
      }, 80);
    } finally {
      if (!keepOverlayUntilRedirect) {
        setProcessingOverlay(false);
        setCheckoutInProgress(false);
      }
      form.dataset.submitting = "0";
      if (submitBtn) {
        submitBtn.classList.remove("loading");
        submitBtn.disabled = false;
        if (btnText) btnText.style.display = "inline";
        if (spinner) spinner.style.display = "none";
      }
    }
  };

  // Capture phase handler to block native form submit/navigation.
  form.addEventListener("submit", runCheckoutSubmit, true);
  submitBtn?.addEventListener("click", (ev) => {
    runCheckoutSubmit(ev);
  });
}

// ----------------------
// Init
// ----------------------
  document.addEventListener("DOMContentLoaded", async () => {
    setupCheckoutMobileLayout();
    enforceCheckoutMobileNoXScroll();
    window.addEventListener("resize", enforceCheckoutMobileNoXScroll, { passive: true });
    setTimeout(hidePageLoader, 9000);
    if (hasPendingOrderMarker() && isCheckoutInProgress()) {
      setProcessingOverlay(true, "Finalizing your order. Please wait...");
    }

    if (isCheckoutInProgress()) {
      const recovered = await tryRecoverPendingOrderAndRedirect();
      if (recovered) return;
    } else {
      setCheckoutInProgress(false);
    }

    let products = [];
    try {
      products = await loadProducts();
    } catch {
      products = [];
    }
    if (window.cart?.fetchCart) {
      try {
        await window.cart.fetchCart();
      } catch {}
    }
    await renderOrder(products);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
    setProcessingOverlay(false);
    requestAnimationFrame(() => {
      setTimeout(hidePageLoader, 120);
    });
    initCheckoutStepFlow();
    handleCheckout(products);
    setPaymentInstructions("");
    wireScreenshotPreview();
    const isLoggedIn = !!(typeof getToken === "function" ? getToken() : null);
    toggleGuestUI(isLoggedIn);
    if (isLoggedIn) {
      await prefillCheckoutDetails();
    }

    const discountInput = document.getElementById("discount-code");
    const discountStatusEl = document.getElementById("discount-code-status");
    const discountBtn = document.getElementById("apply-discount");

    let discountValidateTimer = null;
    async function validateDiscountCodeUi() {
      if (!discountInput || !discountStatusEl) return;
      const code = discountInput.value.trim().toUpperCase();

      if (!code) {
        discountState = { code: null, percent: 0, amount: 0 };
        await renderOrder(products);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
        discountStatusEl.style.display = "none";
        discountStatusEl.textContent = "";
        discountStatusEl.style.color = "";
        return;
      }

      discountStatusEl.style.display = "block";
      discountStatusEl.textContent = "Checking discount code...";
      discountStatusEl.style.color = "#475569";

      try {
        const res = await fetch(`${API_BASE}/discounts/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const subtotal = getCartSubtotal();
          discountState = {
            code: data.code,
            percent: Number(data.percent || 0),
            amount: 0,
          };
          discountState.amount = (subtotal * discountState.percent) / 100;
          await renderOrder(products);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
          discountStatusEl.textContent = `Discount code is valid (${Number(data.percent || 0)}% off).`;
          discountStatusEl.style.color = "#15803d";
        } else {
          discountState = { code: null, percent: 0, amount: 0 };
          await renderOrder(products);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
          discountStatusEl.textContent = data.message || "Discount code not valid.";
          discountStatusEl.style.color = "#b91c1c";
        }
      } catch {
        discountState = { code: null, percent: 0, amount: 0 };
        await renderOrder(products);
    requestAnimationFrame(enforceCheckoutMobileNoXScroll);
        discountStatusEl.textContent = "Could not validate discount code right now.";
        discountStatusEl.style.color = "#b45309";
      }
    }

    discountInput?.addEventListener("input", () => {
      if (discountValidateTimer) clearTimeout(discountValidateTimer);
      discountValidateTimer = setTimeout(() => {
        validateDiscountCodeUi();
      }, 350);
    });
    discountInput?.addEventListener("blur", () => {
      validateDiscountCodeUi();
    });


    [
      "name",
      "email",
      "phone",
      "address",
      "city",
      "notes",
      "affiliate-code",
      "discount-code",
      "payment-method",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const eventName = id === "payment-method" ? "change" : "input";
      el.addEventListener(eventName, saveCheckoutDraft);
    });
    if (discountBtn && discountInput) {
      discountBtn.addEventListener("click", async () => {
        const code = discountInput.value.trim();
        if (!code) {
          showMsg("Enter a discount code first.", false);
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/discounts/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Invalid code");
          discountState = {
            code: data.code,
            percent: data.percent,
            amount: 0,
          };

          const subtotal = getCartSubtotal();
          discountState.amount = (subtotal * discountState.percent) / 100;
          showMsg(`Discount applied: ${discountState.percent}%`, true);
          renderOrder(products);
        } catch (err) {
          discountState = { code: null, percent: 0, amount: 0 };
          renderOrder(products);
          showMsg(err.message || "Invalid code", false);
        }
      });
    }
  });
})();






































