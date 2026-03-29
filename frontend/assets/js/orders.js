// assets/js/orders.js
document.addEventListener("DOMContentLoaded", async () => {
  const ordersEl = document.getElementById("ordersList");
  if (!ordersEl) return;

  const { API_BASE_ORDERS, API_BASE_PRODUCTS, BASE_URL, showToast } = window.CONFIG || {};
  const { getUser, getToken, clearUser, clearToken } = window.auth || {};

  const user = typeof getUser === "function" ? getUser() : null;
  const token = typeof getToken === "function" ? getToken() : null;
  const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

  if (!user || !token) {
    if (isOffline()) {
      ordersEl.innerHTML = `
        <div class="account-no-orders">
          You're offline. Connect to the internet and sign in to view your orders.
        </div>
      `;
      return;
    }
    location.href = "login.html?redirect=orders.html";
    return;
  }

  const paymentLabel = (status) => {
    if (status === "paid") return "payment verified";
    if (status === "failed") return "payment declined";
    return "pending";
  };

  const formatCurrency = (n) => `GHC ${Number(n || 0).toFixed(2)}`;
  const formatDate = (value) => {
    try {
      return value ? new Date(value).toLocaleDateString() : "-";
    } catch {
      return "-";
    }
  };
  const emptyOrdersMarkup = () => `
    <div class="account-no-orders account-orders-empty" role="status" aria-live="polite">
      <div class="account-orders-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false">
          <path d="M14 16h6l4 24h24l6-18H22" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
          <circle cx="28" cy="50" r="4" fill="currentColor"></circle>
          <circle cx="46" cy="50" r="4" fill="currentColor"></circle>
          <path d="M14 16h-4" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"></path>
        </svg>
      </div>
      <h3>No orders yet</h3>
      <p>Your order history will appear here once you complete a purchase.</p>
    </div>
  `;

  const affiliateStatusLabel = (order) => {
    const affiliateCode = String(order?.affiliateCode || "").trim();
    const enteredCode = String(order?.affiliateCodeEntered || "").trim();
    if (!affiliateCode && !enteredCode) return "Not used";
    if (!affiliateCode && enteredCode) return "Code entered";
    if (order?.orderStatus === "cancelled" || order?.paymentStatus === "failed") return "Reversed";
    if (order?.orderStatus === "delivered" || order?.isDelivered === true) return "Earned";
    return "Pending";
  };

  const affiliateSummary = (order) => {
    const linkedCode = String(order?.affiliateCode || "").trim();
    const enteredCode = String(order?.affiliateCodeEntered || "").trim();
    const code = linkedCode || enteredCode;
    const rate = Number(order?.affiliateCommissionRate || 0);
    const amount = Number(order?.affiliateCommissionAmount || 0);
    return {
      hasAffiliate: Boolean(code),
      code,
      rate,
      amount,
      status: affiliateStatusLabel(order),
    };
  };

  const resolveImage = (src) => {
    if (!src) return "assets/img/placeholder.png";
    if (/^(https?:|data:)/i.test(src)) return src;
    if (src.startsWith("/uploads") || src.startsWith("uploads/")) {
      return `${BASE_URL || ""}${src.startsWith("/") ? "" : "/"}${src}`;
    }
    return src;
  };

  const getItemProductId = (item) => {
    if (!item) return "";
    if (typeof item.product === "string") return item.product;
    if (item.product && typeof item.product === "object") return item.product._id || item.product.id || "";
    return item.productId || item._id || "";
  };

  const lookupProduct = (item) => {
    const productId = getItemProductId(item);
    if (!productId) return null;
    return productLookup.get(String(productId)) || null;
  };

  const getItemName = (item) =>
    item?.product?.name ||
    lookupProduct(item)?.name ||
    item?.name ||
    item?.title ||
    "Item";

  const getItemImage = (item) => {
    const product = item?.product && typeof item.product === "object" ? item.product : {};
    const fallbackProduct = lookupProduct(item) || {};
    return resolveImage(
      item?.image ||
      item?.image_url ||
      item?.productImage ||
      product?.image ||
      product?.image_url ||
      (Array.isArray(product?.images) ? product.images[0] : "") ||
      fallbackProduct?.image ||
      fallbackProduct?.image_url ||
      (Array.isArray(fallbackProduct?.images) ? fallbackProduct.images[0] : "") ||
      ""
    );
  };

  const getItemPrice = (item) => {
    const fallbackProduct = lookupProduct(item);
    return Number(item?.price || item?.unitPrice || fallbackProduct?.price || 0);
  };

  const buildReceiptItemsRows = (items) =>
    items
      .map((item) => {
        const qty = Number(item?.qty || item?.quantity || 1);
        const price = getItemPrice(item);
        const subtotal = qty * price;
        return `
          <tr>
            <td style="padding:8px 5px; border-bottom:1px dotted #cccccc; font-size:11px; line-height:1.3;">
              <strong>${getItemName(item)}</strong>
            </td>
            <td align="center" style="padding:8px 0; border-bottom:1px dotted #cccccc; font-size:11px;">${qty}</td>
            <td align="right" style="padding:8px 5px 8px 0; border-bottom:1px dotted #cccccc; font-size:11px;">
              GHC ${subtotal.toFixed(2)}
            </td>
          </tr>
        `;
      })
      .join("");

  const invoiceHTML = (order) => {
    const items = Array.isArray(order.orderItems) ? order.orderItems : [];
    const orderId = String(order._id || "");
    const orderDate = formatDate(order.createdAt);
    const toName = order.guestName || user?.name || "Customer";
    const supportPhone = "0591755964";
    const supportEmail = "deetechcomputers01@gmail.com";
    const subtotal = items.reduce((sum, item) => sum + (Number(item?.qty || 1) * getItemPrice(item)), 0);
    const total = Number(order.totalPrice || subtotal);
    const discountAmount = Number(order.discountAmount || 0);
    const discountCode = String(order.discountCode || "").trim();
    const discountPercent = Number(order.discountPercent || 0);
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed - DEETECH #${orderId}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      body { background:#121212 !important; color:#e0e0e0 !important; }
      .email-container { background:#1e1e1e !important; border-color:#333 !important; }
      .items-header { background:#2d2d2d !important; border-color:#444 !important; color:#fff !important; }
      .order-status-box { background:#1a2332 !important; border-color:#2d3a50 !important; border-left-color:#4d7cff !important; }
      .contact-section { background:#2d2d2d !important; border-color:#333 !important; color:#bbb !important; }
    }
    body { margin:0; padding:20px 0; background:#f5f5f5; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.4; color:#000; }
    .email-container { max-width:340px; margin:0 auto; background:#fff; border:1px solid #ddd; }
    .company-name { font-size:28px; font-weight:bold; letter-spacing:1.5px; font-family:'Courier New',monospace; }
    .receipt-title { border-top:1px dashed #ccc; border-bottom:1px dashed #ccc; }
    .items-header { background:#f9f9f9; border-top:1px solid #000; border-bottom:1px solid #000; }
    .order-status-box { border:1px solid #cfe2ff; border-left:4px solid #007bff; background:#f0f7ff; }
    .contact-section { border:1px solid #eee; background:#f9f9f9; color:#777; }
    .free-delivery { background:#f8fff8; border:1px dashed #c3e6cb; color:#28a745; font-size:10px; font-weight:600; padding:5px; text-align:center; }
  </style>
</head>
<body>
  <div class="email-container">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:2px dashed #ccc;">
      <tr>
        <td align="center" style="padding:25px 20px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:2px solid #000; padding-bottom:15px; margin-bottom:15px;">
            <tr>
              <td align="center">
                <div class="company-name">DEETECH</div>
                <div style="font-size:15px; font-weight:bold; margin:5px 0;">COMPUTERS & ELECTRONICS</div>
                <div style="font-size:10px; font-weight:500;">${supportPhone} | ${supportEmail}</div>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" class="receipt-title">
            <tr>
              <td align="center" style="padding:8px 0;">
                <div style="font-size:18px; font-weight:bold; letter-spacing:1px;">ORDER CONFIRMATION</div>
                <div style="font-size:10px; margin-top:4px; font-style:italic;">Thank you for choosing DEETECH</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:20px;">
          <p style="margin:0 0 10px; font-size:12px; line-height:1.5;">
            Hi ${toName},<br>
            <strong style="font-size:12.5px;">Your order has been confirmed and is being prepared.</strong>
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:2px solid #000; margin-bottom:18px; padding-bottom:12px;">
            <tr>
              <td width="50%" style="font-weight:bold; font-size:11.5px;">ORDER #${orderId}</td>
              <td width="50%" align="right" style="font-size:11px;">${orderDate}</td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" class="items-header">
            <tr>
              <td width="50%" style="padding:8px 0 8px 5px;"><strong style="font-size:11.5px;">ITEM DESCRIPTION</strong></td>
              <td width="20%" align="center" style="padding:8px 0;"><strong style="font-size:11.5px;">QTY</strong></td>
              <td width="30%" align="right" style="padding:8px 5px 8px 0;"><strong style="font-size:11.5px;">AMOUNT</strong></td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px; font-size:12px;">
            ${buildReceiptItemsRows(items)}
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #000; padding-top:12px; margin-bottom:18px;">
            <tr>
              <td width="70%" style="padding:4px 0; font-weight:500;">Subtotal:</td>
              <td width="30%" align="right" style="padding:4px 0; font-weight:500;">GHC ${subtotal.toFixed(2)}</td>
            </tr>
            ${
              discountAmount > 0
                ? `<tr>
                     <td style="padding:4px 0; font-weight:500;">Discount Code:</td>
                     <td align="right" style="padding:4px 0; font-weight:500;">${discountCode || "N/A"}</td>
                   </tr>
                   <tr>
                     <td style="padding:4px 0; font-weight:500;">Discount Percent:</td>
                     <td align="right" style="padding:4px 0; font-weight:500;">${discountPercent > 0 ? `${discountPercent}%` : "N/A"}</td>
                   </tr>
                   <tr>
                     <td style="padding:4px 0; font-weight:500;">Discount Amount:</td>
                     <td align="right" style="padding:4px 0; font-weight:500;">- GHC ${discountAmount.toFixed(2)}</td>
                   </tr>
                   <tr>
                     <td style="padding:4px 0; font-weight:500;">Subtotal After Discount:</td>
                     <td align="right" style="padding:4px 0; font-weight:500;">GHC ${subtotalAfterDiscount.toFixed(2)}</td>
                   </tr>`
                : ""
            }
            <tr>
              <td style="padding:4px 0; font-weight:500;">Delivery Fee:</td>
              <td align="right" style="padding:4px 0; color:#28a745; font-weight:bold;">FREE</td>
            </tr>
            <tr>
              <td colspan="2" style="border-top:1px solid #000; padding-top:10px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:13px; font-weight:bold;">TOTAL:</td>
                    <td align="right" style="font-size:16px; font-weight:bold;">GHC ${total.toFixed(2)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <div class="free-delivery">&#10003; Free delivery included</div>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" class="order-status-box" style="margin-top:18px;">
            <tr>
              <td style="padding:12px; font-size:10px; line-height:1.5;">
                <div style="font-weight:700; margin-bottom:4px;">ORDER STATUS: CONFIRMED</div>
                <div style="margin-bottom:4px;">Estimated delivery: 4-24 hours</div>
                <div>Support: ${supportPhone} | ${supportEmail}</div>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" class="contact-section" style="margin:18px 0;">
            <tr>
              <td align="center" style="padding:10px; font-size:9px; line-height:1.4; font-weight:500;">
                For inquiries: <strong>${supportPhone}</strong><br>
                Email: <strong>${supportEmail}</strong><br>
                &copy; ${year} DEETECH COMPUTERS
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
  };

  const downloadInvoice = (order) => {
    const html = invoiceHTML(order);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${order._id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  ordersEl.innerHTML = "<p class='loading'>Loading orders...</p>";

  try {
    if (API_BASE_PRODUCTS) {
      try {
        const productsRes = await fetch(`${API_BASE_PRODUCTS}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const productsData = await productsRes.json();
        if (productsRes.ok) {
          const products = Array.isArray(productsData)
            ? productsData
            : Array.isArray(productsData?.products)
              ? productsData.products
              : [];
          products.forEach((p) => {
            const id = p?._id || p?.id;
            if (id) productLookup.set(String(id), p);
          });
        }
      } catch (productErr) {
        console.warn("Could not preload products for order images:", productErr);
      }
    }

    const endpoint = user.role === "admin" ? `${API_BASE_ORDERS}` : `${API_BASE_ORDERS}/myorders`;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
      if (!isOffline()) {
        clearUser?.();
        clearToken?.();
        location.href = "login.html?redirect=orders.html";
        return;
      }
      ordersEl.innerHTML = `<p class="error">You're offline. Cached mode is active. Sign in when back online.</p>`;
      return;
    }

    if (!res.ok) {
      ordersEl.innerHTML = `<p class="error">${data.message || "Failed to load orders."}</p>`;
      return;
    }

    if (!Array.isArray(data) || !data.length) {
      ordersEl.innerHTML = emptyOrdersMarkup();
      return;
    }

    const ordersData = data;
    ordersEl.innerHTML = ordersData
      .map((order) => {
        const items = Array.isArray(order.orderItems) ? order.orderItems : [];
        const preview = items.slice(0, 3);
        return `
          <div class="account-order-card">
            <div class="account-order-header">
              <div>
                <h3>Order #${order._id}</h3>
                <div class="account-order-date">${formatDate(order.createdAt)}</div>
                ${
                  user.role === "admin"
                    ? `<div class="account-order-date">User: ${order.user?.name || "N/A"} (${order.user?.email || ""})</div>`
                    : ""
                }
              </div>
              <div class="account-order-status">
                <span class="account-status-badge ${order.orderStatus || "pending"}">${order.orderStatus || "pending"}</span>
              </div>
            </div>
            <div class="account-order-details">
              <p><strong>Payment:</strong> ${paymentLabel(order.paymentStatus)}</p>
              <p><strong>Total:</strong> ${formatCurrency(order.totalPrice)}</p>
              <p><strong>Items:</strong> ${items.length}</p>
              <p><strong>Affiliate:</strong> ${
                affiliateSummary(order).hasAffiliate
                  ? `${affiliateSummary(order).code} (${affiliateSummary(order).status})`
                  : "Not used"
              }</p>
              ${
                affiliateSummary(order).hasAffiliate
                  ? `<p><strong>Commission:</strong> ${affiliateSummary(order).rate.toFixed(1)}% (${formatCurrency(
                      affiliateSummary(order).amount
                    )})</p>`
                  : ""
              }
            </div>
            <div class="account-order-items-preview">
              ${preview
                .map((item) => {
                  const productId = getItemProductId(item);
                  const link = productId ? `product.html?id=${encodeURIComponent(productId)}` : "javascript:void(0)";
                  return `
                    <a class="account-order-item-preview" href="${link}" ${productId ? "" : "aria-disabled='true'"}>
                      <img src="${getItemImage(item)}" alt="${getItemName(item)}" width="96" height="96" loading="lazy" decoding="async">
                      <span>${getItemName(item)} x ${Number(item?.qty || item?.quantity || 1)}</span>
                    </a>
                  `;
                })
                .join("")}
            </div>
            <div class="account-order-actions">
              <button class="btn btn-outline btn-sm order-view-btn" data-id="${order._id}">View Details</button>
            </div>
          </div>
        `;
      })
      .join("");

    const statusMap = {
      pending: { step: 1, label: "Order Placed" },
      processing: { step: 2, label: "Processing" },
      shipped: { step: 3, label: "Shipped" },
      delivered: { step: 4, label: "Delivered" },
      completed: { step: 4, label: "Completed" },
      cancelled: { step: 1, label: "Cancelled" },
    };

    function buildTimeline(order) {
      const normalized = String(order?.orderStatus || "pending").toLowerCase();
      const current = statusMap[normalized]?.step || 1;
      const createdDate = (() => {
        try {
          return order?.createdAt ? new Date(order.createdAt).toLocaleDateString("en-GB") : "";
        } catch {
          return "";
        }
      })();

      const steps = [
        { step: 1, label: "Order Placed", meta: createdDate || "Placed" },
        { step: 2, label: "Payment Confirmed" },
        { step: 3, label: "Shipped" },
        { step: 4, label: "Delivered" },
      ];

      const progressPercent = Math.max(0, Math.min(100, ((current - 1) / (steps.length - 1)) * 100));

      const iconSvg = (step) => {
        if (step === 1) {
          return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4h10v2h2v14H5V6h2V4Zm0 4v10h10V8H7Zm2 2h6v2H9Z"/></svg>';
        }
        if (step === 2) {
          return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm2 0v2h14V6H5Zm14 6H5v6h14v-6Z"/></svg>';
        }
        if (step === 3) {
          return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6h11v8h2.5l2.5 3V19h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3V6Zm2 2v9h1a2 2 0 0 1 4 0h3V8H5Zm10 2h2.2l1.8 2.2V16h-4V10Zm-7 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>';
        }
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.6 7.8-5.2 6a1 1 0 0 1-1.5.05l-2.5-2.5 1.4-1.4 1.74 1.74 4.48-5.17 1.58 1.38Z"/></svg>';
      };

      const html = steps
        .map((s) => {
          const active = current >= s.step;
          const meta = s.meta || (active ? "Completed" : "Pending");
          return `
            <div class="account-timeline-step ${active ? "account-active" : ""}">
              <div class="account-timeline-icon">${iconSvg(s.step)}</div>
              <div class="account-timeline-content">
                <h4>${s.label}</h4>
                <p>${meta}</p>
              </div>
            </div>
          `;
        })
        .join("");

      return `<div class="account-order-progress" style="--progress:${progressPercent}%;">${html}</div>`;
    }

    function openOrderModal(order) {
      const overlay = document.createElement("div");
      overlay.className = "account-order-modal-overlay";
      const items = Array.isArray(order.orderItems) ? order.orderItems : [];
      const address = order.shippingAddress || order.guestAddress || "N/A";
      const city = order.shippingCity || order.guestCity || "N/A";
      const region = order.deliveryRegion || "N/A";
      const phone = order.mobileNumber || "N/A";
      const name = order.shippingName || order.guestName || user?.name || "Customer";
      const email = order.shippingEmail || order.guestEmail || user?.email || "N/A";

      overlay.innerHTML = `
        <div class="account-order-modal">
          <div class="account-order-modal-header">
            <h3>Order #${order._id}</h3>

          </div>
          <div class="account-order-modal-content">
            ${buildTimeline(order)}

            <h4>Items</h4>
            <div class="account-order-items-list">
              ${items
                .map((item) => {
                  const productId = getItemProductId(item);
                  const link = productId ? `product.html?id=${encodeURIComponent(productId)}` : "javascript:void(0)";
                  return `
                    <a class="account-order-item" href="${link}" ${productId ? "" : "aria-disabled='true'"}>
                      <img src="${getItemImage(item)}" alt="${getItemName(item)}" width="96" height="96" loading="lazy" decoding="async">
                      <div>
                        <div><strong>${getItemName(item)}</strong></div>
                        <div>Qty: ${Number(item?.qty || item?.quantity || 1)}</div>
                        <div>${formatCurrency(getItemPrice(item))}</div>
                      </div>
                    </a>
                  `;
                })
                .join("")}
            </div>

            <div class="account-order-summary">
              <h4>Order Summary</h4>
              <div class="account-order-summary-row"><span>Payment</span><span>${paymentLabel(order.paymentStatus)}</span></div>
              <div class="account-order-summary-row"><span>Status</span><span>${order.orderStatus || "pending"}</span></div>
              <div class="account-order-summary-row"><span>Affiliate</span><span>${
                affiliateSummary(order).hasAffiliate ? affiliateSummary(order).code : "Not used"
              }</span></div>
              ${
                affiliateSummary(order).hasAffiliate
                  ? `<div class="account-order-summary-row"><span>Affiliate Status</span><span>${affiliateSummary(order).status}</span></div>
                     <div class="account-order-summary-row"><span>Affiliate Commission</span><span>${affiliateSummary(order).rate.toFixed(
                       1
                     )}% (${formatCurrency(affiliateSummary(order).amount)})</span></div>`
                  : ""
              }
              <div class="account-order-summary-row account-order-total"><span>Total</span><span>${formatCurrency(order.totalPrice)}</span></div>
            </div>

            <div class="account-shipping-details">
              <h4>Shipping Info</h4>
              <div class="account-order-summary-row"><span>Name</span><span>${name}</span></div>
              <div class="account-order-summary-row"><span>Email</span><span>${email}</span></div>
              <div class="account-order-summary-row"><span>Phone</span><span>${phone}</span></div>
              <div class="account-order-summary-row"><span>Address</span><span>${address}</span></div>
              <div class="account-order-summary-row"><span>City</span><span>${city}</span></div>
              <div class="account-order-summary-row"><span>Region</span><span>${region}</span></div>
            </div>
          </div>
          <div class="account-order-modal-footer">
            <button class="btn btn-outline btn-sm account-order-modal-close" type="button" aria-label="Close order details">Close</button>
            <button class="btn btn-outline btn-sm account-invoice-btn" type="button">Download Invoice</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      document.body.classList.add("account-modal-open");
      const close = () => {
        document.body.classList.remove("account-modal-open");
        overlay.remove();
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
        if (e.target.closest(".account-order-modal-close")) close();
        if (e.target.closest(".account-invoice-btn")) downloadInvoice(order);
      });
    }

    ordersEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".order-view-btn");
      if (!btn) return;
      const id = btn.dataset.id;
      const order = ordersData.find((o) => String(o._id) === String(id));
      if (order) openOrderModal(order);
    });
  } catch (err) {
    console.error("Orders fetch error:", err.message);
    ordersEl.innerHTML = "<p class='error'>Error loading orders. Please try again later.</p>";
    if (typeof showToast === "function") showToast("Could not load orders", "error");
  }
});
  const productLookup = new Map();


