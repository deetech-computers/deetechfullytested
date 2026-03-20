localStorage.removeItem("orderSent");
document.addEventListener("DOMContentLoaded", () => {
  const order = JSON.parse(localStorage.getItem("lastOrder"));
  const summaryEl = document.getElementById("thankyouSummary");
  const headingEl = document.getElementById("thankyou-msg");

  if (!summaryEl) return;

  if (!order) {
    summaryEl.innerHTML = "<p>Your order has already been processed. Thank you.</p>";
    setTimeout(() => {
      window.location.href = "index.html";
    }, 5000);
    return;
  }

  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const money = (n) => `GHc ${Number(n || 0).toFixed(2)}`;

  const labelForPayment = (value) => {
    if (value === "mtn") return "MTN Mobile Money";
    if (value === "vodafone") return "Telecel/Vodafone Cash";
    if (value === "bank") return "Bank Transfer";
    if (value === "hubtel") return "Hubtel";
    return value || "N/A";
  };

  const orderItems = Array.isArray(order.items) ? order.items : [];
  const shippingValue = Number(order.shipping || 0);
  const discountAmountValue = Number(order.discountAmount || 0);
  const subtotalValue =
    Number(order.subtotal || 0) > 0
      ? Number(order.subtotal || 0)
      : Math.max(0, Number(order.total || 0) - shippingValue + discountAmountValue);
  const createdAt = order.date ? new Date(order.date) : new Date();
  const orderDate = Number.isNaN(createdAt.getTime())
    ? "-"
    : createdAt.toLocaleDateString("en-GB");
  const supportPhone = "0591755964";
  const supportEmail = "deetechcomputers1@gmail.com";
  const companyName = "DEETECH COMPUTERS";
  const orderTrackingUrl = "orders.html?tab=orders";
  const absoluteTrackingUrl = new URL(orderTrackingUrl, window.location.href).href;
  const logoUrl = new URL("assets/img/logo.png", window.location.href).href;
  const orderId = esc(order.reference || "N/A");

  const affiliateName = String(order.affiliateName || "").trim();
  const affiliateCode = String(order.affiliateCode || "").trim();
  const affiliateCommissionRate = Number(order.affiliateCommissionRate || 0);
  const commissionBaseForDisplay = Math.max(0, subtotalValue - discountAmountValue);
  const affiliateCommissionAmount = Number(
    order.affiliateCommissionAmount ||
      ((commissionBaseForDisplay * Number(affiliateCommissionRate || 0)) / 100).toFixed(2) ||
      0
  );
  const discountCode = String(order.discountCode || "").trim();
  const discountPercent = Number(order.discountPercent || 0);

  if (headingEl) {
    headingEl.textContent = `Order Confirmed #${order.reference || "N/A"}`;
  }

  const orderItemsRows = orderItems.length
    ? orderItems
        .map((item) => {
          const qty = Number(item.quantity || 1);
          const price = Number(item.price || 0);
          const subtotal = qty * price;
          return `
            <tr class="receipt-item-row">
              <td class="item-desc">${esc(item.name || "Product")}</td>
              <td class="item-qty">${qty}</td>
              <td class="item-amt">${money(subtotal)}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr class="receipt-item-row"><td class="item-desc">No items listed</td><td class="item-qty">-</td><td class="item-amt">${money(0)}</td></tr>`;

  const orderItemsCards = orderItems.length
    ? orderItems
        .map((item) => {
          const qty = Number(item.quantity || 1);
          const price = Number(item.price || 0);
          const subtotal = qty * price;
          return `
            <div class="thankyou-item">
              <div class="thankyou-item-main">
                <strong>${esc(item.name || "Product")}</strong>
                <span class="thankyou-item-meta">Qty ${qty} x ${money(price)}</span>
              </div>
              <div class="thankyou-item-total">${money(subtotal)}</div>
            </div>
          `;
        })
        .join("")
    : `<div class="thankyou-item"><div class="thankyou-item-main"><strong>No items listed</strong></div><div class="thankyou-item-total">${money(0)}</div></div>`;

  const printReceiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order Confirmed - DEETECH #${orderId}</title>
  <style>
    body { margin: 0; padding: 20px 0; background: #f5f5f5; font-family: Arial, Helvetica, sans-serif; color: #000; }
    .receipt-shell { max-width: 340px; margin: 0 auto; background: #fff; border: 1px solid #ddd; color: #000; padding: 0; }
    .receipt-header { text-align: center; padding: 22px 18px 16px; border-bottom: 2px dashed #ccc; }
    .brand-row { display: inline-flex; align-items: center; gap: 10px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
    .receipt-logo { width: 30px; height: 30px; object-fit: contain; }
    .brand-name { font-size: 28px; font-weight: 700; letter-spacing: 1.5px; font-family: 'Courier New', monospace; }
    .brand-sub { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
    .brand-meta { font-size: 10px; color: #666; }
    .receipt-title-wrap { border-top: 1px dashed #ccc; border-bottom: 1px dashed #ccc; text-align: center; padding: 8px 10px; }
    .receipt-title { font-size: 18px; font-weight: 700; letter-spacing: 1px; }
    .receipt-subtitle { font-size: 10px; color: #666; margin-top: 3px; font-style: italic; }
    .receipt-greeting { padding: 14px 18px 0; font-size: 12px; color: #333; }
    .receipt-greeting p { margin: 0 0 8px; }
    .receipt-order-meta { display: flex; justify-content: space-between; padding: 0 18px 10px; margin-bottom: 10px; border-bottom: 2px solid #000; font-size: 11px; }
    .receipt-items-table { width: calc(100% - 36px); margin: 0 18px 12px; border-collapse: collapse; font-size: 12px; }
    .receipt-items-table thead th { background: #f9f9f9; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 8px 5px; font-size: 11px; text-align: left; }
    .receipt-item-row td { border-bottom: 1px dashed #ddd; padding: 8px 5px; }
    .item-desc { width: 50%; }
    .item-qty { width: 20%; text-align: center; }
    .item-amt { width: 30%; text-align: right; }
    .receipt-totals { margin: 0 18px 14px; padding-top: 10px; border-top: 2px solid #000; font-size: 12px; }
    .tot-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .tot-row.total { border-top: 1px solid #000; margin-top: 6px; padding-top: 8px; font-size: 14px; font-weight: 700; }
    .receipt-detail-grid { margin: 0 18px 12px; border: 1px solid #ddd; padding: 10px; font-size: 11px; display: grid; gap: 5px; }
    .receipt-status { margin: 0 18px 12px; border: 1px solid #cfe2ff; border-left: 4px solid #007bff; background: #f0f7ff; padding: 10px; text-align: center; font-size: 10px; color: #334155; display: grid; gap: 4px; }
    .receipt-status a { color: #007bff; font-weight: 700; text-decoration: none; }
    .receipt-footer { margin: 0 18px 18px; border-top: 1px dashed #ccc; padding-top: 10px; text-align: center; font-size: 10px; color: #666; }
    .receipt-footer p { margin: 3px 0; }
    .receipt-footer .end-line { margin-top: 8px; font-size: 9px; letter-spacing: 1.2px; }
  </style>
</head>
<body>
  <article class="receipt-shell">
    <header class="receipt-header">
      <div class="brand-row">
        <img src="${logoUrl}" alt="DEETECH" class="receipt-logo" />
        <div class="brand-name">DEETECH</div>
      </div>
      <div class="brand-sub">COMPUTERS & ELECTRONICS</div>
      <div class="brand-meta">Quality Tech Solutions Since 2020</div>
      <div class="brand-meta">${esc(supportPhone)} | ${esc(supportEmail)}</div>
    </header>

    <section class="receipt-title-wrap">
      <div class="receipt-title">ORDER CONFIRMATION</div>
      <div class="receipt-subtitle">Thank you for choosing DEETECH</div>
    </section>

    <section class="receipt-greeting">
      <p>Hi ${esc(order.name || "Customer")},</p>
      <p><strong>Thank you for trusting DEETECH with your tech needs!</strong> Your order has been confirmed and we're preparing it with care.</p>
    </section>

    <section class="receipt-order-meta">
      <div><strong>ORDER #${orderId}</strong></div>
      <div>${esc(orderDate)}</div>
    </section>

    <table class="receipt-items-table" aria-label="Order items">
      <thead>
        <tr>
          <th class="item-desc">ITEM DESCRIPTION</th>
          <th class="item-qty">QTY</th>
          <th class="item-amt">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${orderItemsRows}
      </tbody>
    </table>

    <section class="receipt-totals">
      <div class="tot-row"><span>Subtotal:</span><span>${money(subtotalValue)}</span></div>
      ${
        discountAmountValue > 0
          ? `<div class="tot-row"><span>Discount${discountCode ? ` (${esc(discountCode)})` : ""}:</span><span>- ${money(discountAmountValue)}</span></div>`
          : ""
      }
      <div class="tot-row"><span>Delivery Fee:</span><span>${shippingValue === 0 ? "FREE" : money(shippingValue)}</span></div>
      <div class="tot-row total"><span>TOTAL:</span><span>${money(order.total)}</span></div>
    </section>

    <section class="receipt-detail-grid">
      <div><strong>Payment:</strong> ${esc(labelForPayment(order.paymentMethod))}</div>
      <div><strong>Email:</strong> ${esc(order.email || "N/A")}</div>
      <div><strong>Phone:</strong> ${esc(order.phone || "N/A")}</div>
      <div><strong>Address:</strong> ${esc(order.address || "")}${order.city ? `, ${esc(order.city)}` : ""}</div>
      ${order.notes ? `<div><strong>Notes:</strong> ${esc(order.notes)}</div>` : ""}
    </section>

    <section class="receipt-status">
      <div><strong>ORDER STATUS:</strong> CONFIRMED</div>
      <div>Processing - Estimated: 4-24 hours</div>
      <div>Track anytime: <a href="${absoluteTrackingUrl}">View order</a></div>
    </section>

    <footer class="receipt-footer">
      <p><strong>THANK YOU FOR YOUR PURCHASE!</strong></p>
      <p>Please keep this receipt for your records.</p>
      <p>For inquiries: <strong>${esc(supportPhone)}</strong> - ${esc(supportEmail)}</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}</p>
      <p class="end-line">--- ORDER #${orderId} ---</p>
    </footer>
  </article>
</body>
</html>`;

  summaryEl.innerHTML = `
    <article class="thankyou-shell card">
      <section class="thankyou-top">
        <div>
          <p class="thankyou-kicker">Order placed successfully</p>
          <h2>Thanks, ${esc(order.name || "Customer")}.</h2>
          <p class="thankyou-sub">Your order is confirmed and is now being prepared.</p>
        </div>
        <div class="thankyou-ref">
          <span>Order Number</span>
          <strong>#${orderId}</strong>
          <small>${esc(orderDate)}</small>
        </div>
      </section>

      <section class="thankyou-grid">
        <div class="thankyou-panel">
          <h3>Order Items</h3>
          <div class="thankyou-items-list">${orderItemsCards}</div>
        </div>

        <div class="thankyou-panel">
          <h3>Order Summary</h3>
          <div class="thankyou-summary-row"><span>Subtotal</span><strong>${money(subtotalValue)}</strong></div>
          ${
            discountAmountValue > 0
              ? `<div class="thankyou-summary-row"><span>Discount${discountCode ? ` (${esc(discountCode)})` : ""}${discountPercent > 0 ? ` ${discountPercent}%` : ""}</span><strong>- ${money(discountAmountValue)}</strong></div>`
              : ""
          }
          <div class="thankyou-summary-row"><span>Delivery</span><strong>${shippingValue === 0 ? "FREE" : money(shippingValue)}</strong></div>
          <div class="thankyou-summary-row total"><span>Total</span><strong>${money(order.total)}</strong></div>
          <div class="thankyou-summary-row"><span>Payment</span><strong>${esc(labelForPayment(order.paymentMethod))}</strong></div>
          <div class="thankyou-summary-row"><span>Email</span><strong>${esc(order.email || "N/A")}</strong></div>
          <div class="thankyou-summary-row"><span>Phone</span><strong>${esc(order.phone || "N/A")}</strong></div>
          <div class="thankyou-summary-row"><span>Address</span><strong>${esc(order.address || "")}${order.city ? `, ${esc(order.city)}` : ""}</strong></div>
          ${order.notes ? `<div class="thankyou-summary-note"><strong>Note:</strong> ${esc(order.notes)}</div>` : ""}
        </div>
      </section>

      <section class="thankyou-status">
        <p><strong>Status:</strong> Confirmed</p>
        <p>Estimated processing: 4-24 hours</p>
        <p><a href="${orderTrackingUrl}">Track this order</a></p>
      </section>
      ${
        affiliateCode && affiliateCommissionRate > 0
          ? `<section class="thankyou-affiliate-note">
              <p>Thank you for supporting ${esc(affiliateName || "our affiliate partner")}.</p>
              <p>${esc(affiliateName || "Affiliate")} earns ${affiliateCommissionRate.toFixed(1)}% (${money(affiliateCommissionAmount)}) from this order.</p>
            </section>`
          : ""
      }
    </article>

    <div class="receipt-actions">
      <button id="downloadReceipt" type="button" class="receipt-print-btn receipt-download-btn">Download Receipt</button>
    </div>
  `;

  const downloadBtn = document.getElementById("downloadReceipt");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const blob = new Blob([printReceiptHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deetech-receipt-${String(order.reference || "order")}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  localStorage.removeItem("lastOrder");
});
