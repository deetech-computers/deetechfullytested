(async function () {
  const { requireAdmin, apiFetch, API_BASE, BASE_URL, toast, confirmAction } = window.AdminAPI || {};
  if (!requireAdmin || !(await requireAdmin())) return;

  const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

  const els = {
    tableBody: document.querySelector("#ordersTable tbody"),
    mobileList: document.getElementById("mobileOrdersList"),
    emptyState: document.getElementById("ordersEmptyState"),
    searchInput: document.getElementById("ordersSearchInput"),
    statusFilter: document.getElementById("ordersStatusFilter"),
    paymentFilter: document.getElementById("ordersPaymentFilter"),
    summaryTotal: document.getElementById("ordersSummaryTotal"),
    summaryDelivered: document.getElementById("ordersSummaryDelivered"),
    summaryPending: document.getElementById("ordersSummaryPending"),
    summaryRejected: document.getElementById("ordersSummaryRejected"),
    modal: document.getElementById("orderDetailsModal"),
    modalTitle: document.getElementById("orderDetailsTitle"),
    modalBody: document.getElementById("orderDetailsBody"),
    closeModalBtn: document.getElementById("closeOrderDetailsModal"),
  };

  const state = {
    orders: [],
    filteredOrders: [],
  };

  function text(v) {
    return String(v ?? "").trim();
  }

  function formatCurrency(v) {
    return `GHC ${Number(v || 0).toFixed(2)}`;
  }

  function formatDate(v) {
    const dt = v ? new Date(v) : null;
    if (!dt || Number.isNaN(dt.getTime())) return "-";
    return dt.toLocaleString();
  }

  function shortId(id) {
    const raw = text(id);
    return raw ? raw.slice(-8).toUpperCase() : "-";
  }

  function paymentStatusLabel(status) {
    if (status === "paid") return "Verified";
    if (status === "failed") return "Rejected";
    return "Pending";
  }

  function orderStatusLabel(status) {
    if (status === "cancelled") return "Rejected";
    return status || "pending";
  }

  function statusClass(status) {
    if (status === "pending") return "orange";
    if (status === "processing") return "blue";
    if (status === "shipped") return "purple";
    if (status === "delivered") return "green";
    if (status === "cancelled") return "red";
    return "blue";
  }

  function paymentClass(status) {
    if (status === "paid") return "green";
    if (status === "failed") return "red";
    return "orange";
  }

  function paymentProofUrl(order) {
    const raw = text(
      order.paymentScreenshotUrl ||
        order.paymentProofUrl ||
        order.paymentProof ||
        order.payment_screenshot ||
        order.paymentScreenshot ||
        order.proofImage ||
        order.screenshot ||
        order.paymentImage ||
        order.proof ||
        order?.paymentDetails?.screenshotUrl ||
        order?.paymentDetails?.proofUrl ||
        order?.paymentDetails?.image
    );
    if (!raw) return "";
    if (isLegacyUploadUrl(raw)) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("/")) return `${BASE_URL || ""}${raw}`;
    return `${BASE_URL || ""}/${raw}`;
  }

  function isLegacyUploadUrl(url) {
    const value = text(url).toLowerCase();
    return value.includes("/uploads/") || value.endsWith("/uploads");
  }

  function customerName(order) {
    return text(order.user?.name) || text(order.guestName) || "Guest User";
  }

  function customerEmail(order) {
    return text(order.user?.email) || text(order.guestEmail) || "-";
  }

  function customerAddress(order) {
    return text(order.guestAddress) || "-";
  }

  function affiliateInfo(order) {
    const linkedCode = text(order.affiliateCode);
    const enteredCode = text(order.affiliateCodeEntered);
    const code = linkedCode || enteredCode;
    const hasAffiliate = Boolean(code);
    const linked = Boolean(linkedCode);
    const rate = Number(order.affiliateCommissionRate || 0);
    const amount = Number(order.affiliateCommissionAmount || 0);
    return { hasAffiliate, linked, code, rate, amount };
  }

  function affiliateStatusLabel(order) {
    const info = affiliateInfo(order);
    if (!info.hasAffiliate) return "No Affiliate";
    if (!info.linked) return "Code Entered";
    if (text(order.orderStatus) === "cancelled" || text(order.paymentStatus) === "failed") {
      return "Reversed";
    }
    if (text(order.orderStatus) === "delivered" || order.isDelivered === true) {
      return "Earned";
    }
    return "Pending";
  }

  function affiliateStatusClass(order) {
    const status = affiliateStatusLabel(order);
    if (status === "Earned") return "green";
    if (status === "Reversed") return "red";
    if (status === "Pending") return "orange";
    if (status === "Code Entered") return "purple";
    return "blue";
  }

  function orderStatusSelect(order) {
    const current = text(order.orderStatus || "pending");
    const options = ORDER_STATUSES.map((status) => {
      const selected = status === current ? "selected" : "";
      return `<option value="${status}" ${selected}>${orderStatusLabel(status)}</option>`;
    }).join("");
    return `<select class="status-select" data-order-id="${order._id}">${options}</select>`;
  }

  function orderStatusSelectMobile(order) {
    const current = text(order.orderStatus || "pending");
    const options = ORDER_STATUSES.map((status) => {
      const selected = status === current ? "selected" : "";
      return `<option value="${status}" ${selected}>${orderStatusLabel(status)}</option>`;
    }).join("");
    return `<select class="status-select-mobile" data-order-id="${order._id}">${options}</select>`;
  }

  function paymentStatusSelect(order, mobile = false) {
    const current = text(order.paymentStatus || "pending");
    const cls = mobile ? "status-select-mobile" : "status-select";
    const options = ["pending", "paid", "failed"]
      .map((status) => {
        const selected = status === current ? "selected" : "";
        return `<option value="${status}" ${selected}>${paymentStatusLabel(status)}</option>`;
      })
      .join("");
    return `<select class="${cls}" data-payment-order-id="${order._id}">${options}</select>`;
  }

  function orderMatchesFilters(order) {
    const q = text(els.searchInput?.value).toLowerCase();
    const status = text(els.statusFilter?.value);
    const payment = text(els.paymentFilter?.value);

    if (status && text(order.orderStatus) !== status) return false;
    if (payment && text(order.paymentStatus) !== payment) return false;

    if (!q) return true;

    const lookup = [
      text(order._id),
      shortId(order._id),
      customerName(order),
      customerEmail(order),
      text(order.mobileNumber),
    ]
      .join(" ")
      .toLowerCase();

    return lookup.includes(q);
  }

  function renderTable(orders) {
    if (!els.tableBody) return;
    els.tableBody.innerHTML = "";

    orders.forEach((order) => {
      const tr = document.createElement("tr");
      const proof = paymentProofUrl(order);
      tr.innerHTML = `
        <td>
          <div class="order-id-display">#${shortId(order._id)}</div>
          <small>${formatDate(order.createdAt)}</small>
        </td>
        <td>
          <div class="customer-info">
            <strong>${customerName(order)}</strong>
            <small>${customerEmail(order)}</small>
            <small>${text(order.mobileNumber) || "-"}</small>
          </div>
        </td>
        <td><strong>${formatCurrency(order.totalPrice)}</strong></td>
        <td>
          <span class="status-badge ${paymentClass(order.paymentStatus)}">${paymentStatusLabel(order.paymentStatus)}</span>
          <div style="margin-top:6px">${paymentStatusSelect(order)}</div>
        </td>
        <td>
          ${
            proof
              ? `<div class="proof-thumb-wrap">
                   <a class="proof-link" href="${proof}" target="_blank" rel="noreferrer">View Proof</a>
                   <img class="proof-thumb" src="${proof}" alt="Proof thumbnail" loading="lazy" />
                 </div>`
              : "<small>-</small>"
          }
        </td>
        <td>
          ${
            affiliateInfo(order).hasAffiliate
              ? `<div class="affiliate-block">
                   <span class="status-badge ${affiliateStatusClass(order)}">${affiliateStatusLabel(order)}</span>
                   <small>Code: ${affiliateInfo(order).code}</small>
                   <small>${affiliateInfo(order).rate.toFixed(1)}% • ${formatCurrency(affiliateInfo(order).amount)}</small>
                 </div>`
              : `<span class="status-badge blue">No Affiliate</span>`
          }
        </td>
        <td>
          <span class="status-badge ${statusClass(order.orderStatus)}">${orderStatusLabel(order.orderStatus)}</span>
          <div style="margin-top:6px">${orderStatusSelect(order)}</div>
        </td>
        <td>${formatDate(order.updatedAt || order.createdAt)}</td>
        <td>
          <div class="table-actions">
            <button class="btn-view-order" data-view-order="${order._id}">Details</button>
            <button class="btn-delete-order" data-delete-order="${order._id}">Delete</button>
          </div>
        </td>
      `;
      els.tableBody.appendChild(tr);
    });
  }

  function renderMobile(orders) {
    if (!els.mobileList) return;
    els.mobileList.innerHTML = "";

    orders.forEach((order) => {
      const proof = paymentProofUrl(order);
      const card = document.createElement("article");
      card.className = "order-card";
      card.innerHTML = `
        <div class="card-header">
          <div>
            <div class="order-id-display">#${shortId(order._id)}</div>
            <small>${formatDate(order.createdAt)}</small>
          </div>
          <span class="status-badge ${statusClass(order.orderStatus)}">${orderStatusLabel(order.orderStatus)}</span>
        </div>
        <div class="card-body">
          <div class="info-group customer-info-mobile">
            <div class="info-label">Customer</div>
            <div class="info-value">${customerName(order)}</div>
            <div class="info-value">${customerEmail(order)}</div>
          </div>
          <div class="info-group">
            <div class="info-label">Total</div>
            <div class="info-value"><strong>${formatCurrency(order.totalPrice)}</strong></div>
          </div>
          <div class="info-group">
            <div class="info-label">Payment</div>
            <div class="info-value">
              <span class="status-badge ${paymentClass(order.paymentStatus)}">${paymentStatusLabel(order.paymentStatus)}</span>
            </div>
          </div>
          <div class="info-group">
            <div class="info-label">Proof</div>
            <div class="info-value">
              ${
                proof
                  ? `<a class="proof-link" href="${proof}" target="_blank" rel="noreferrer">View</a>
                     <img class="proof-thumb mobile" src="${proof}" alt="Proof thumbnail" loading="lazy" />`
                  : "-"
              }
            </div>
          </div>
          <div class="info-group">
            <div class="info-label">Affiliate</div>
            <div class="info-value">
              ${
                affiliateInfo(order).hasAffiliate
                  ? `<span class="status-badge ${affiliateStatusClass(order)}">${affiliateStatusLabel(order)}</span><br>
                     <small>Code: ${affiliateInfo(order).code}</small><br>
                     <small>${affiliateInfo(order).rate.toFixed(1)}% • ${formatCurrency(affiliateInfo(order).amount)}</small>`
                  : `<span class="status-badge blue">No Affiliate</span>`
              }
            </div>
          </div>
        </div>
        <div class="mobile-actions">
          ${paymentStatusSelect(order, true)}
          ${orderStatusSelectMobile(order)}
          <div class="action-row">
            <button class="btn-view-order" data-view-order="${order._id}">View Details</button>
            <button class="btn-delete-order" data-delete-order="${order._id}">Delete</button>
          </div>
        </div>
      `;
      els.mobileList.appendChild(card);
    });
  }

  function toggleEmptyState(show) {
    if (!els.emptyState) return;
    els.emptyState.classList.toggle("hidden", !show);
  }

  function render() {
    state.filteredOrders = state.orders.filter(orderMatchesFilters);
    const delivered = state.filteredOrders.filter((o) => text(o.orderStatus) === "delivered").length;
    const pending = state.filteredOrders.filter((o) => text(o.orderStatus) === "pending").length;
    const rejected = state.filteredOrders.filter((o) => text(o.orderStatus) === "cancelled").length;
    if (els.summaryTotal) els.summaryTotal.textContent = String(state.filteredOrders.length);
    if (els.summaryDelivered) els.summaryDelivered.textContent = String(delivered);
    if (els.summaryPending) els.summaryPending.textContent = String(pending);
    if (els.summaryRejected) els.summaryRejected.textContent = String(rejected);
    renderTable(state.filteredOrders);
    renderMobile(state.filteredOrders);
    toggleEmptyState(state.filteredOrders.length === 0);
  }

  function findOrderById(id) {
    return state.orders.find((o) => String(o._id) === String(id));
  }

  function renderOrderItems(order) {
    const items = Array.isArray(order.orderItems) ? order.orderItems : [];
    if (!items.length) return "<p>No items captured for this order.</p>";
    return items
      .map((item) => {
        const name = text(item.product?.name) || "Product";
        const qty = Number(item.qty || 0);
        const price = Number(item.price || 0);
        const sub = qty * price;
        return `
          <div class="order-item-detail">
            <strong>${name}</strong>
            <small>Qty: ${qty}</small>
            <small>Unit: ${formatCurrency(price)}</small>
            <small>Subtotal: ${formatCurrency(sub)}</small>
          </div>
        `;
      })
      .join("");
  }

  function openOrderDetails(orderId) {
    const order = findOrderById(orderId);
    if (!order || !els.modal || !els.modalBody) return;

    const proof = paymentProofUrl(order);
    els.modalTitle.textContent = `Order #${shortId(order._id)}`;
    els.modalBody.innerHTML = `
      <div class="details-grid">
        <div class="detail-row"><span class="detail-label">Order Status</span><span class="detail-value">${orderStatusLabel(order.orderStatus)}</span></div>
        <div class="detail-row"><span class="detail-label">Payment Status</span><span class="detail-value">${paymentStatusLabel(order.paymentStatus)}</span></div>
        <div class="detail-row"><span class="detail-label">Customer</span><span class="detail-value">${customerName(order)}</span></div>
        <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${customerEmail(order)}</span></div>
        <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${text(order.mobileNumber) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Payment Method</span><span class="detail-value">${text(order.paymentMethod) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">${customerAddress(order)}</span></div>
        <div class="detail-row"><span class="detail-label">Region</span><span class="detail-value">${text(order.deliveryRegion) || "-"}</span></div>
        <div class="detail-row"><span class="detail-label">Total</span><span class="detail-value">${formatCurrency(order.totalPrice)}</span></div>
        <div class="detail-row"><span class="detail-label">Affiliate</span><span class="detail-value">${
          affiliateInfo(order).hasAffiliate ? affiliateInfo(order).code : "Not used"
        }</span></div>
        <div class="detail-row"><span class="detail-label">Affiliate Commission</span><span class="detail-value">${
          affiliateInfo(order).hasAffiliate
            ? `${affiliateInfo(order).rate.toFixed(1)}% • ${formatCurrency(affiliateInfo(order).amount)}`
            : "-"
        }</span></div>
        <div class="detail-row"><span class="detail-label">Affiliate Status</span><span class="detail-value">${
          affiliateStatusLabel(order)
        }${
          affiliateStatusLabel(order) === "Code Entered"
            ? " (will auto-link when a matching active affiliate is found)"
            : " (earned only when order is Delivered)"
        }</span></div>
        <div class="detail-row"><span class="detail-label">Updated</span><span class="detail-value">${formatDate(order.updatedAt || order.createdAt)}</span></div>
      </div>
      <div class="order-items-section">
        <h4>Order Items</h4>
        <div class="order-items-list">${renderOrderItems(order)}</div>
      </div>
      <div class="payment-proof-box">
        <h4>Uploaded Payment Proof</h4>
        ${
          proof
            ? `<a class="proof-link" href="${proof}" target="_blank" rel="noreferrer" style="margin-bottom:8px;display:inline-flex;">Open Original</a>
               <div class="payment-proof-media">
                 <img class="payment-proof-image" src="${proof}" alt="Payment proof" loading="lazy" />
                 <p class="payment-proof-error" hidden>Could not load payment proof image. Use "Open Original".</p>
               </div>`
            : "<p>No payment proof uploaded.</p>"
        }
      </div>
    `;
    els.modal.classList.remove("hidden");
  }

  function closeOrderDetails() {
    if (!els.modal || !els.modalBody) return;
    els.modal.classList.add("hidden");
    els.modalBody.innerHTML = "";
  }

  async function updateOrderStatus(orderId, status) {
    try {
      const updated = await apiFetch(`${API_BASE}/orders/${orderId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      const idx = state.orders.findIndex((o) => String(o._id) === String(orderId));
      if (idx >= 0) {
        state.orders[idx] = updated;
      }
      render();
      if (toast) toast(`Order status updated to ${orderStatusLabel(status)}`, "success");
    } catch (error) {
      console.error(error);
      if (toast) toast("Failed to update order status", "error");
      render();
    }
  }

  async function updatePaymentStatus(orderId, paymentStatus) {
    try {
      const updated = await apiFetch(`${API_BASE}/orders/${orderId}/payment-status`, {
        method: "PUT",
        body: JSON.stringify({ paymentStatus }),
      });

      const idx = state.orders.findIndex((o) => String(o._id) === String(orderId));
      if (idx >= 0) {
        state.orders[idx] = updated;
      }
      render();
      if (toast) toast(`Payment status updated to ${paymentStatusLabel(paymentStatus)}`, "success");
    } catch (error) {
      console.error(error);
      if (toast) toast("Failed to update payment status", "error");
      render();
    }
  }

  async function loadOrders() {
    const result = await apiFetch(`${API_BASE}/orders`);
    const list = Array.isArray(result) ? result : [];
    state.orders = list;
    render();
  }

  async function deleteOrder(orderId) {
    const order = findOrderById(orderId);
    const label = order ? `#${shortId(order._id)} (${customerName(order)})` : `#${shortId(orderId)}`;
    const ok = await confirmAction?.(
      `Delete order ${label} permanently?\n\nThis will remove the order record, linked referral history, and linked discount usage for this order only.`,
      { title: "Delete Order", confirmText: "Delete" }
    );
    if (!ok) return;

    try {
      await apiFetch(`${API_BASE}/orders/${orderId}`, {
        method: "DELETE",
      });

      state.orders = state.orders.filter((o) => String(o._id) !== String(orderId));
      render();
      closeOrderDetails();
      if (toast) toast("Order deleted permanently", "success");
    } catch (error) {
      console.error(error);
      if (toast) toast("Failed to delete order", "error");
    }
  }

  function bindEvents() {
    els.searchInput?.addEventListener("input", render);
    els.statusFilter?.addEventListener("change", render);
    els.paymentFilter?.addEventListener("change", render);

    document.addEventListener("change", (e) => {
      const statusSelect = e.target.closest(".status-select, .status-select-mobile");
      if (statusSelect && statusSelect.hasAttribute("data-order-id")) {
        const orderId = statusSelect.getAttribute("data-order-id");
        const status = statusSelect.value;
        updateOrderStatus(orderId, status);
        return;
      }

      const paymentSelect = e.target.closest(".status-select, .status-select-mobile");
      if (paymentSelect && paymentSelect.hasAttribute("data-payment-order-id")) {
        const orderId = paymentSelect.getAttribute("data-payment-order-id");
        const paymentStatus = paymentSelect.value;
        updatePaymentStatus(orderId, paymentStatus);
      }
    });

    document.addEventListener("click", (e) => {
      const viewBtn = e.target.closest("[data-view-order]");
      if (viewBtn) {
        openOrderDetails(viewBtn.getAttribute("data-view-order"));
        return;
      }

      const deleteBtn = e.target.closest("[data-delete-order]");
      if (deleteBtn) {
        deleteOrder(deleteBtn.getAttribute("data-delete-order"));
      }
    });

    els.closeModalBtn?.addEventListener("click", closeOrderDetails);
    els.modal?.addEventListener("click", (e) => {
      if (e.target === els.modal) closeOrderDetails();
    });
  }

  bindEvents();
  loadOrders().catch((e) => {
    console.error(e);
    if (toast) toast("Failed to load orders", "error");
  });
})();



