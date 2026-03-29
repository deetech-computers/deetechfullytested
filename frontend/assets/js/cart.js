// assets/js/cart.js
(function () {
  const {
    API_BASE_CART,
    API_BASE_PRODUCTS,
    BASE_URL,
    loadCart,
    saveCart,
    showToast,
  } = window.CONFIG || {};
  const SNAPSHOT_PATH = "assets/data/products-snapshot.json";
  const SNAPSHOT_STORAGE_KEY = "deetech_products_snapshot_v1";
  const CAN_FETCH_LOCAL_SNAPSHOT = window.location.protocol === "http:" || window.location.protocol === "https:";
  let offlineNoticeShown = false;

  function showOfflineModeNotice() {
    if (navigator.onLine !== false) return;
    if (offlineNoticeShown) return;
    offlineNoticeShown = true;
    const msg = "Offline mode: showing cached products";
    if (typeof window.CONFIG?.showToast === "function") {
      window.CONFIG.showToast(msg, "info");
      return;
    }
    if (typeof window.showToast === "function") {
      window.showToast(msg, "info");
      return;
    }
    console.info(msg);
  }

  const { clearUser, getToken } = window.auth || {
    clearUser: () => {},
    getToken: () => localStorage.getItem("token"),
  };

  const MAX_QTY = 99;
  const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
  function hidePageLoader() {
    const body = document.body;
    if (!body) return;
    body.classList.remove("page-loading");
    const loader = document.getElementById("page-loader");
    if (loader) loader.style.display = "none";
  }

  function clampQty(val) {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(Math.round(n), MAX_QTY);
  }

  // -----------------------
  // Local Cart Helpers
  // -----------------------
  function getLocalCart() {
    try {
      return loadCart();
    } catch {
      return [];
    }
  }

  function setLocalCart(cart) {
    try {
      const map = new Map();
      (cart || []).forEach((item) => {
        const id = String(item.productId || item._id || item.id || "");
        if (!id) return;
        const qty = clampQty(item.qty || item.quantity || 1);
        const existing = map.get(id);
        if (existing) {
          existing.qty = clampQty(Math.max(existing.qty || 0, qty));
        } else {
          map.set(id, {
            ...item,
            _id: item._id || item.productId || id,
            productId: item.productId || item._id || id,
            qty,
          });
        }
      });
      saveCart(Array.from(map.values()));
    } catch {
      localStorage.setItem("cart", JSON.stringify(cart));
      document.dispatchEvent(new Event("cart-updated"));
    }
  }

  function clearLocalCart() {
    setLocalCart([]);
  }

  async function clearCartFully() {
    setLocalCart([]);
    clearTimeout(syncTimer);
    try {
      await syncCartToServer([]);
    } catch (err) {
      console.warn("Failed to clear server cart:", err);
    }
  }

  // -----------------------
  // API Fetch Wrapper
  // -----------------------
  async function apiFetch(url, options = {}) {
    const token = typeof getToken === "function" ? getToken() : null;
    const headers = { ...(options.headers || {}) };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(url, { ...options, headers });

      if ((res.status === 401 || res.status === 403) && token) {
        if (!isOffline()) {
          if (typeof clearUser === "function") clearUser();
        }
        showToast(
          isOffline()
            ? "You're offline. Cached mode is active. Login can be done when back online."
            : "Session expired. Please log in again when ready.",
          "info"
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

      if (!res.ok) {
        throw new Error(data.message || data.raw || "Request failed");
      }
      return data;
    } catch (err) {
      console.error("API Error:", err.message || err);
      showToast(err.message || "Server error. Try again.", "error");
      return null;
    }
  }

  // -----------------------
  // Server Cart Helpers
  // -----------------------
  function normalizeServerCart(serverCart) {
    const items = (serverCart?.items || []).map((item) => {
      const product = item.product || {};
      const id = product._id || item.product;
      return {
        _id: id,
        productId: id,
        qty: clampQty(item.qty || 1),
        name: product.name,
        price: product.price,
        image: (product.images && product.images[0]) || product.image,
      };
    });
    return items;
  }

  function mergeCartItems(serverItems = [], localItems = []) {
    const map = new Map();

    serverItems.forEach((si) => {
      const id = String(si.productId || si._id || "");
      if (!id) return;
      const qty = clampQty(si.qty || si.quantity || 1);
      map.set(id, {
        ...si,
        _id: si._id || si.productId || id,
        productId: si.productId || si._id || id,
        qty,
      });
    });

    localItems.forEach((li) => {
      const id = String(li.productId || li._id || "");
      if (!id) return;
      const qty = clampQty(li.qty || li.quantity || 1);
      const existing = map.get(id) || {};
      map.set(id, {
        ...existing,
        ...li,
        _id: li._id || li.productId || id,
        productId: li.productId || li._id || id,
        qty,
      });
    });

    return Array.from(map.values());
  }

  async function fetchServerCart() {
    const data = await apiFetch(`${API_BASE_CART}`);
    if (!data) return null;
    return normalizeServerCart(data);
  }

  let syncTimer = null;
  async function syncCartToServer(localCart) {
    const token = typeof getToken === "function" ? getToken() : null;
    if (!token) return;

    const normalized = (localCart || []).map((item) => ({
      productId: item.productId || item._id,
      qty: Number(item.qty || item.quantity || 1),
    }));

    if (!normalized.length) {
      const server = await fetchServerCart();
      if (!server || server.length === 0) return;
      for (const item of server) {
        const sid = item.productId || item._id;
        if (!sid) continue;
        await apiFetch(`${API_BASE_CART}/${sid}`, { method: "DELETE" });
      }
      return;
    }

    const server = await fetchServerCart();
    const serverIds = new Set((server || []).map((i) => String(i.productId || i._id)));
    const localIds = new Set(normalized.map((i) => String(i.productId)));

    // Remove items that no longer exist locally
    for (const sid of serverIds) {
      if (!localIds.has(sid)) {
        await apiFetch(`${API_BASE_CART}/${sid}`, { method: "DELETE" });
      }
    }

    // Upsert local items
    for (const item of normalized) {
      if (!item.productId) continue;
      await apiFetch(`${API_BASE_CART}/${item.productId}`, {
        method: "POST",
        body: JSON.stringify({ qty: item.qty }),
      });
    }
  }

  // -----------------------
  // Public Cart API
  // -----------------------
  async function fetchCart() {
    const token = typeof getToken === "function" ? getToken() : null;
    const localCart = getLocalCart();

    if (!token) {
      return localCart;
    }

    const serverItems = await fetchServerCart();

    // Source of truth rule:
    // - If local cart has items, keep local state and sync server to it.
    // - This prevents deleted items from "coming back" from stale server carts.
    if (localCart.length > 0) {
      await syncCartToServer(localCart);
      return localCart;
    }

    if (serverItems && serverItems.length > 0) {
      setLocalCart(serverItems);
      return serverItems;
    }

    return [];
  }

  function scheduleSync(cart) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncCartToServer(cart).catch(() => {});
    }, 400);
  }

  async function saveCartHybrid(cart) {
    const map = new Map();
    (cart || []).forEach((item) => {
      const id = String(item.productId || item._id || item.id || "");
      if (!id) return;
      const qty = Number(item.qty || item.quantity || 1);
      const existing = map.get(id);
      if (existing) {
        existing.qty = Math.max(existing.qty || 0, qty);
      } else {
        map.set(id, {
          ...item,
          _id: item._id || item.productId || id,
          productId: item.productId || item._id || id,
          qty,
        });
      }
    });
    const normalized = Array.from(map.values());
    setLocalCart(normalized);

    // Hard guarantee: when cart is emptied, sync immediately to server
    // so removed items cannot reappear after an instant refresh.
    if (!normalized.length) {
      clearTimeout(syncTimer);
      await syncCartToServer([]);
      return;
    }

    scheduleSync(normalized);
  }

  // -----------------------
  // Utilities
  // -----------------------
  function resolveImage(src) {
    if (!src) return "assets/img/placeholder.png";
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
      return src;
    }
    if (src.startsWith("/uploads") || src.startsWith("uploads/")) {
      return `${BASE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
    }
    return src;
  }

  function getCartCount() {
    return getLocalCart().reduce(
      (acc, item) => acc + (Number(item.qty || item.quantity || 0) || 0),
      0
    );
  }

  function getCartTotal(products = []) {
    const cart = getLocalCart();
    return cart.reduce((sum, item) => {
      const pid = item.productId || item._id;
      const product = products.find((p) => String(p._id) === String(pid));
      const price = Number(item.price || product?.price || 0);
      const qty = Number(item.qty || item.quantity || 1) || 1;
      return sum + price * qty;
    }, 0);
  }

  async function loadProducts() {
    try {
      const res = await fetch(`${API_BASE_PRODUCTS}`);
      const data = await res.json();
      const products = Array.isArray(data) ? data : Array.isArray(data.products) ? data.products : [];
      if (products.length) {
        try {
          localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(products));
        } catch {}
      }
      return products;
    } catch (err) {
      try {
        if (CAN_FETCH_LOCAL_SNAPSHOT) {
          const snapRes = await fetch(SNAPSHOT_PATH, { cache: "force-cache" });
          if (snapRes.ok) {
            const snapData = await snapRes.json();
            const snapshotProducts = Array.isArray(snapData) ? snapData : Array.isArray(snapData?.products) ? snapData.products : [];
            if (snapshotProducts.length) {
              showOfflineModeNotice();
              try {
                localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshotProducts));
              } catch {}
              return snapshotProducts;
            }
          }
        }
      } catch {}

      try {
        const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.length) showOfflineModeNotice();
        if (Array.isArray(parsed)) return parsed;
      } catch {}

      console.warn("Failed to load products, using local cart data only:", err);
      return [];
    }
  }

  async function sanitizeCartForStock(products, { notify = true } = {}) {
    const cart = getLocalCart();
    if (!cart.length) return { cart: [], changed: false };

    const next = [];
    const removedNames = [];
    const adjustedNames = [];

    cart.forEach((item) => {
      const pid = item.productId || item._id;
      const product = products.find((p) => String(p._id) === String(pid));
      if (!product) {
        removedNames.push(item.name || "Item");
        return;
      }

      const stockRaw = product?.countInStock ?? item.countInStock ?? item.stock;
      const stock = stockRaw === undefined || stockRaw === null ? null : Number(stockRaw);
      if (Number.isFinite(stock) && stock <= 0) {
        removedNames.push(item.name || product.name || "Item");
        return;
      }

      let qty = clampQty(item.qty || item.quantity || 1);
      if (Number.isFinite(stock) && stock >= 0 && qty > stock) {
        adjustedNames.push(`${item.name || product.name || "Item"} (${qty}->${stock})`);
        qty = stock;
      }

      next.push({
        ...item,
        _id: item._id || item.productId || pid,
        productId: item.productId || item._id || pid,
        qty,
      });
    });

    const changed =
      next.length !== cart.length ||
      next.some((n, i) => Number(n.qty || 0) !== Number(cart[i]?.qty || cart[i]?.quantity || 0));

    if (changed) {
      await saveCartHybrid(next);
      if (notify) {
        if (removedNames.length) {
          showToast(`Removed out-of-stock items: ${removedNames.join(", ")}`, "info");
        }
        if (adjustedNames.length) {
          showToast(`Adjusted quantities: ${adjustedNames.join(", ")}`, "info");
        }
      }
    }

    return { cart: next, changed };
  }

  // -----------------------
  // Render Cart
  // -----------------------
  function renderCart(products) {
    const cartItemsEl = document.getElementById("cartItems");
    const subtotalEl = document.getElementById("subtotal");
    const shippingEl = document.getElementById("shipping");
    const totalEl = document.getElementById("total");
    const checkoutBtn = document.getElementById("checkoutBtn");

    if (!cartItemsEl || !subtotalEl || !shippingEl || !totalEl) return;

    const rawCart = getLocalCart();
    const cartMap = new Map();
    rawCart.forEach((item) => {
      const id = String(item.productId || item._id || item.id || "");
      if (!id) return;
      const existing = cartMap.get(id);
      const qty = Number(item.qty || item.quantity || 1);
      if (existing) {
        existing.qty = Math.max(existing.qty || 0, qty);
      } else {
        cartMap.set(id, { ...item, qty });
      }
    });
    const cart = Array.from(cartMap.values());
    cartItemsEl.innerHTML = "";

    if (!cart || cart.length === 0) {
      cartItemsEl.innerHTML = `
        <div class="cart-empty-cart cart-empty-cart-rich" role="status" aria-live="polite">
          <div class="cart-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" focusable="false">
              <path d="M14 16h6l4 24h24l6-18H22" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
              <circle cx="28" cy="50" r="4" fill="currentColor"></circle>
              <circle cx="46" cy="50" r="4" fill="currentColor"></circle>
              <path d="M14 16h-4" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"></path>
            </svg>
          </div>
          <h2>Your cart is empty</h2>
          <p>Add products to your cart and they will appear here.</p>
        </div>
      `;
      subtotalEl.textContent = "GHC 0.00";
      shippingEl.textContent = "FREE";
      totalEl.textContent = "GHC 0.00";
      if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.classList.add("disabled");
      }
      document.dispatchEvent(new Event("cart-updated"));
      return;
    }

    let subtotal = 0;
    let hasOutOfStock = false;
    cart.forEach((item, index) => {
      const pid = item.productId || item._id;
      const product = products.find((p) => String(p._id) === String(pid));
      const price = Number(item.price || product?.price || 0);
      const name = item.name || product?.name || "Item";
      const imageSrc =
        (product?.images && product.images[0]) ||
        product?.image ||
        item.image ||
        "assets/img/placeholder.png";
      const productLink = `product.html?id=${encodeURIComponent(pid)}`;
      const stockRaw = product?.countInStock ?? item.countInStock ?? item.stock;
      const stock =
        stockRaw === undefined || stockRaw === null ? null : Number(stockRaw);
      let qty = clampQty(item.qty || item.quantity || 1);
      if (Number.isFinite(stock) && stock >= 0) {
        qty = Math.min(qty, stock);
      }
      if (Number.isFinite(stock) && stock <= 0) {
        hasOutOfStock = true;
      }
      const itemTotal = price * qty;
      subtotal += itemTotal;

      const row = document.createElement("div");
      row.classList.add("cart-item");
      if (Number.isFinite(stock) && stock <= 0) row.classList.add("cart-unavailable");
      const stockStatus =
        Number.isFinite(stock) && stock <= 0
          ? { cls: "cart-out-of-stock", text: "Out of stock" }
          : Number.isFinite(stock) && stock <= 2
          ? { cls: "cart-low-stock", text: `Low stock (${stock})` }
          : { cls: "cart-in-stock", text: `In stock (${stock ?? "N/A"})` };
      const descRaw = (product?.description || "").toString().trim();
      const descShort = descRaw.length > 90 ? `${descRaw.slice(0, 87)}...` : descRaw;
      const categoryLabel = (product?.category || "General").toString().toUpperCase();

      row.innerHTML = `
        <a class="cart-item-image" href="${productLink}">
          <img src="${resolveImage(imageSrc)}" alt="${name}" width="120" height="120" loading="lazy" decoding="async">
          ${Number.isFinite(stock) && stock <= 0 ? `<span class="cart-stock-badge cart-unavailable-badge">Out</span>` : ""}
        </a>
        <div class="cart-item-details">
          <span class="cart-item-category">${categoryLabel}</span>
          <h3>${name}</h3>
          <div class="cart-item-price">GHC ${price.toFixed(2)}</div>
          <div class="cart-stock-info">
            <span class="cart-stock-status ${stockStatus.cls}">${stockStatus.text}</span>
          </div>
          ${descShort ? `<div class="cart-item-description">${descShort}</div>` : ""}
        </div>
        <div class="cart-item-controls">
          <div class="cart-quantity-controls">
            <button class="cart-quantity-btn dec" data-id="${pid}" ${Number.isFinite(stock) && stock <= 0 ? "disabled" : ""}>-</button>
            <span class="cart-quantity-display">${qty}</span>
            <button class="cart-quantity-btn inc" data-id="${pid}" ${Number.isFinite(stock) && stock <= 0 ? "disabled" : ""}>+</button>
          </div>
          <div class="cart-item-total">GHC ${itemTotal.toFixed(2)}</div>
          <button class="cart-remove-btn" data-id="${pid}">Remove</button>
        </div>
      `;
      cartItemsEl.appendChild(row);
    });

    subtotalEl.textContent = `GHC ${subtotal.toFixed(2)}`;
    const shipping = 0;
    shippingEl.textContent = "FREE";
    totalEl.textContent = `GHC ${(subtotal + shipping).toFixed(2)}`;

    if (checkoutBtn) {
      checkoutBtn.disabled = hasOutOfStock;
      checkoutBtn.classList.toggle("disabled", hasOutOfStock);
    }

    document.dispatchEvent(new Event("cart-updated"));
  }

  // -----------------------
  // Events
  // -----------------------
  function attachCartEvents(products) {
    const cartItemsEl = document.getElementById("cartItems");
    if (!cartItemsEl) return;
    cartItemsEl.addEventListener("click", async (e) => {
      if (e.target.classList.contains("cart-quantity-btn")) {
        const pid = e.target.dataset.id;
        if (!pid) return;
        const cart = getLocalCart();
        const index = cart.findIndex((i) => String(i.productId || i._id) === String(pid));
        if (index < 0) return;
        const product = products.find((p) => String(p._id) === String(pid));
        const stockRaw = product?.countInStock ?? cart[index].countInStock ?? cart[index].stock;
        const stock =
          stockRaw === undefined || stockRaw === null ? null : Number(stockRaw);
        let nextQty = Number(cart[index].qty || 1);
        if (e.target.classList.contains("inc")) {
          nextQty += 1;
        } else {
          nextQty -= 1;
        }
        if (nextQty <= 0) {
          const filtered = cart.filter((i) => String(i.productId || i._id) !== String(pid));
          await saveCartHybrid(filtered);
          renderCart(products);
          return;
        }
        if (nextQty <= 0) {
          cart.splice(index, 1);
          await saveCartHybrid(cart);
          renderCart(products);
          return;
        }
        nextQty = clampQty(nextQty);
        if (Number.isFinite(stock) && stock >= 0) {
          nextQty = Math.min(nextQty, stock);
        }
        if (Number.isFinite(stock) && stock <= 0) {
          nextQty = 0;
        }
        cart[index].qty = nextQty;
        await saveCartHybrid(cart);
        renderCart(products);
      }
    });

    cartItemsEl.addEventListener("click", async (e) => {
      if (e.target.classList.contains("cart-remove-btn")) {
        const pid = e.target.dataset.id;
        if (!pid) return;
        const cart = getLocalCart();
        const removed = cart.filter((i) => String(i.productId || i._id) === String(pid));
        const next = cart.filter((i) => String(i.productId || i._id) !== String(pid));
        await saveCartHybrid(next);
        renderCart(products);
        showToast(`${removed[0]?.name || "Item"} removed from cart`, "info");
      }
    });
  }

  // -----------------------
  // Header Badge
  // -----------------------
  async function updateHeaderBadge() {
    const products = await loadProducts();
    const countEl = document.getElementById("headerCartCount");
    const totalEl = document.getElementById("headerCartTotal");
    if (!countEl || !totalEl) return;
    countEl.textContent = getCartCount();
    totalEl.textContent = "GHC " + getCartTotal(products).toFixed(2);
  }

  // -----------------------
  // Init
  // -----------------------
  document.addEventListener("DOMContentLoaded", async () => {
    setTimeout(hidePageLoader, 8000);
    let products = [];
    try {
      products = await loadProducts();
    } catch {}
    try {
      await fetchCart();
    } catch (err) {
      console.warn("Failed to fetch cart:", err);
    }
    try {
      await sanitizeCartForStock(products, { notify: false });
    } catch (err) {
      console.warn("Failed to sanitize cart:", err);
    }
    renderCart(products);
    attachCartEvents(products);
    updateHeaderBadge();
    requestAnimationFrame(() => {
      setTimeout(hidePageLoader, 120);
    });
    let headerTimer = null;
    document.addEventListener("cart-updated", () => {
      clearTimeout(headerTimer);
      headerTimer = setTimeout(updateHeaderBadge, 300);
    });
    const checkoutBtn = document.getElementById("checkoutBtn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", async () => {
        const result = await sanitizeCartForStock(products, { notify: true });
        renderCart(products);

        if (!result.cart.length) {
          showToast("Cart is empty after removing out-of-stock items.", "error");
          return;
        }

        const stillInvalid = result.cart.some((item) => {
          const product = products.find((p) => String(p._id) === String(item.productId || item._id));
          const stock = Number(product?.countInStock ?? item.countInStock ?? item.stock ?? 0);
          return !Number.isFinite(stock) || stock <= 0;
        });
        if (stillInvalid || checkoutBtn.disabled) {
          showToast("Please remove unavailable items before checkout.", "error");
          return;
        }

        window.location.href = "checkout.html";
      });
    }
  });

  // Expose helpers
  window.cart = {
    getLocalCart,
    saveCart: saveCartHybrid,
    fetchCart,
    clearCart: clearCartFully,
  };
})();


















