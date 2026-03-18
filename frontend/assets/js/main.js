// assets/js/main.js
(function () {
  const { API_BASE_PRODUCTS, BASE_URL, showToast } = window.CONFIG || {};
  const SNAPSHOT_PATH = "assets/data/products-snapshot.json";
  const PLACEHOLDER_IMAGE = "assets/img/placeholder.svg";
  const SNAPSHOT_STORAGE_KEY = "deetech_products_snapshot_v1";
  const API_TIMEOUT_MS = 5000;
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

  async function fetchWithTimeout(resource, options = {}, timeoutMs = API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(resource, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  function resolveImage(src) {
    if (!src) return PLACEHOLDER_IMAGE;
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return src;
    if (src.startsWith("/uploads") || src.startsWith("uploads/")) {
      return `${BASE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
    }
    return src;
  }

  function toNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function getStock(product) {
    return Number(
      product?.countInStock ??
        product?.stock_quantity ??
        product?.stock ??
        0
    );
  }

  function canonicalCategory(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v.startsWith("laptop")) return "laptops";
    if (v.startsWith("phone")) return "phones";
    if (v.startsWith("monitor")) return "monitors";
    if (v.startsWith("access")) return "accessories";
    if (v.startsWith("stor")) return "storage";
    if (v.startsWith("print")) return "printers";
    return v;
  }

  function normalizeProductListPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.products)) return payload.products;
    return [];
  }

  async function loadSnapshotProducts() {
    if (!CAN_FETCH_LOCAL_SNAPSHOT) {
      try {
        const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.length) showOfflineModeNotice();
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    try {
      const res = await fetchWithTimeout(SNAPSHOT_PATH, { cache: "force-cache" }, 1200);
      if (!res.ok) throw new Error(`Snapshot HTTP ${res.status}`);
      const data = await res.json();
      const products = normalizeProductListPayload(data);
      if (products.length) {
        showOfflineModeNotice();
        try {
          localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(products));
        } catch {}
      }
      return products;
    } catch {
      try {
        const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.length) showOfflineModeNotice();
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
  }

  async function fetchAllProductsWithFallback() {
    try {
      const res = await fetchWithTimeout(`${API_BASE_PRODUCTS}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load products");
      const products = normalizeProductListPayload(data);
      if (products.length) {
        try {
          localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(products));
        } catch {}
      }
      return products;
    } catch {
      const fallbackProducts = await loadSnapshotProducts();
      if (fallbackProducts.length) showOfflineModeNotice();
      return fallbackProducts;
    }
  }

  async function fetchProductByIdWithFallback(id) {
    try {
      const res = await fetchWithTimeout(`${API_BASE_PRODUCTS}/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Not found");
      return data;
    } catch {
      const snapshot = await loadSnapshotProducts();
      if (snapshot.length) showOfflineModeNotice();
      return snapshot.find((item) => String(item._id || item.id) === String(id)) || null;
    }
  }

  /* ---------- Header Cart Badge ---------- */
  function updateHeaderCartBadge() {
    const countEl = document.getElementById("headerCartCount");
    const totalEl = document.getElementById("headerCartTotal");
    if (!countEl || !totalEl || !window.cart) return;

    const cartItems = window.cart.getLocalCart();
    const count = cartItems.reduce((a, it) => a + (it.qty || it.quantity || 0), 0);
    const total = cartItems.reduce((a, it) => a + toNumber(it.price) * (it.qty || it.quantity || 0), 0);

    countEl.textContent = String(count);
    totalEl.textContent = `GHC ${total.toFixed(2)}`;
  }

  /* ---------- Cart Helpers ---------- */
  function updateCartItem(id, quantity) {
    if (!window.cart) return;
    const cart = window.cart.getLocalCart();
    const idx = cart.findIndex((it) => String(it._id || it.productId || it.id) === String(id));
    if (idx < 0) return;

    if (quantity <= 0) {
      cart.splice(idx, 1);
    } else {
      const maxStock = Number(cart[idx].countInStock ?? cart[idx].stock_quantity ?? cart[idx].stock ?? Infinity);
      const nextQty = Number(quantity) || 1;
      cart[idx].qty = Number.isFinite(maxStock) ? Math.min(nextQty, maxStock) : nextQty;
    }
    window.cart.saveCart(cart);
  }

  function initAddToCartButtons(root = document) {
    root.querySelectorAll(".add-to-cart").forEach((btn) => {
      if (btn.dataset._wired) return;
      btn.dataset._wired = "1";

      const id = btn.dataset.id;
      if (!id) return;

      const cart = window.cart?.getLocalCart() || [];
      if (cart.find((i) => String(i._id || i.productId) === String(id))) {
        btn.textContent = "Added";
        btn.disabled = true;
      }

      btn.addEventListener("click", async () => {
        try {
          const product = await fetchProductByIdWithFallback(id);
          if (!product) throw new Error("Not found");

          const stock = getStock(product);
          if (stock < 1) {
            if (typeof showToast === "function") showToast("Out of stock", "error");
            return;
          }

          const localCart = window.cart?.getLocalCart() || [];
          const existingIdx = localCart.findIndex((it) => String(it._id || it.productId) === String(id));
          if (existingIdx > -1) {
            const nextQty = Number(localCart[existingIdx].qty || 0) + 1;
            if (nextQty > stock) {
              if (typeof showToast === "function") showToast("You can't add more than available stock", "info");
              return;
            }
            localCart[existingIdx].qty = nextQty;
          } else {
            localCart.push({
              _id: product._id,
              productId: product._id,
              name: product.name,
              price: toNumber(product.price),
              qty: 1,
              image: resolveImage(product.image || product.images?.[0]),
              countInStock: stock,
            });
          }

          window.cart.saveCart(localCart);
          btn.textContent = "Added";
          btn.disabled = true;
          if (typeof showToast === "function") showToast(`[${product.name}] added to cart`, "success");
        } catch (err) {
          console.error("Failed to add product:", err);
          if (typeof showToast === "function") showToast("Error adding product", "error");
        }
      });
    });
  }

  function initBuyNowButtons(root = document) {
    root.querySelectorAll(".buy-now").forEach((btn) => {
      if (btn.dataset._wired) return;
      btn.dataset._wired = "1";
      const id = btn.dataset.id;
      if (!id) return;

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const product = await fetchProductByIdWithFallback(id);
          if (!product) throw new Error("Not found");

          const stock = getStock(product);
          if (stock < 1) {
            if (typeof showToast === "function") showToast("Out of stock", "error");
            return;
          }

          window.cart?.saveCart([
            {
              _id: product._id,
              productId: product._id,
              name: product.name,
              price: toNumber(product.price),
              qty: 1,
              image: resolveImage(product.image || product.images?.[0]),
              countInStock: stock,
            },
          ]);
          window.location.href = "checkout.html";
        } catch (err) {
          console.error("Failed to buy now:", err);
          if (typeof showToast === "function") showToast("Error starting checkout", "error");
        }
      });
    });
  }

  /* ---------- Cart Page Renderer ---------- */
  function renderCartPage() {
    const cartContainer = document.getElementById("cartItems");
    if (!cartContainer || !window.cart) return;
    if (document.querySelector(".cart-container")) return;

    const cart = window.cart.getLocalCart();
    cartContainer.innerHTML = "";

    if (!cart.length) {
      cartContainer.innerHTML = "<p>Your cart is empty.</p>";
      return;
    }

    cart.forEach((item) => {
      const maxStock = Number(item.countInStock ?? item.stock_quantity ?? item.stock ?? 99);
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <span>${item.name}</span>
        <span>GHC ${toNumber(item.price).toFixed(2)}</span>
        <div class="qty-controls">
          <button class="dec" data-id="${item._id || item.productId}">-</button>
          <input type="number" value="${item.qty}" min="1" max="${maxStock}" data-id="${item._id || item.productId}" />
          <button class="inc" data-id="${item._id || item.productId}">+</button>
        </div>
        <span>GHC ${(toNumber(item.price) * toNumber(item.qty, 1)).toFixed(2)}</span>
        <button class="remove" data-id="${item._id || item.productId}">X</button>
      `;
      cartContainer.appendChild(row);
    });

    cartContainer.querySelectorAll(".inc").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const item = window.cart.getLocalCart().find((i) => String(i._id || i.productId) === String(id));
        if (item) updateCartItem(id, (item.qty || 1) + 1);
        renderCartPage();
      });
    });

    cartContainer.querySelectorAll(".dec").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const item = window.cart.getLocalCart().find((i) => String(i._id || i.productId) === String(id));
        if (item) updateCartItem(id, (item.qty || 1) - 1);
        renderCartPage();
      });
    });

    cartContainer.querySelectorAll(".remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        updateCartItem(btn.dataset.id, 0);
        renderCartPage();
      });
    });

    cartContainer.querySelectorAll("input[type=number]").forEach((input) => {
      input.addEventListener("change", () => {
        const id = input.dataset.id;
        const val = parseInt(input.value, 10);
        if (!Number.isNaN(val) && val > 0) updateCartItem(id, val);
        renderCartPage();
      });
    });
  }

  /* ---------- Home Sections ---------- */
  function getHomeSectionDefinitions() {
    return [
      { key: "new_arrivals", title: "New Arrivals", subtitle: "Check out our latest special gift deals." },
      { key: "top_smartphones", title: "Smartphones Top Sellers", subtitle: "Most-loved phones picked by shoppers." },
      { key: "best_laptops", title: "Best Selling Laptops", subtitle: "Top laptops built for work and play." },
      { key: "popular", title: "Popular", subtitle: "Trending picks across all categories." },
    ];
  }

  function sectionAssigned(product, key) {
    const sections = Array.isArray(product.homeSections) ? product.homeSections : [];
    return sections.map((s) => String(s || "").toLowerCase()).includes(String(key).toLowerCase());
  }

  function pickProductsForSection(products, key, limit = 6) {
    const assigned = products.filter((p) => sectionAssigned(p, key));
    if (key === "new_arrivals" && assigned.length) {
      return assigned
        .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0))
        .slice(0, limit);
    }
    if (assigned.length) return assigned.slice(0, limit);

    if (key === "new_arrivals") {
      return products
        .slice()
        .sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0))
        .slice(0, limit);
    }
    return [];
  }

  function renderHomeProductCard(prod) {
    const stock = getStock(prod);
    const stockClass = stock > 0 ? "in" : "out";
    const stockLabel = stock > 0 ? `In Stock (${stock})` : "Out of Stock";
    const categoryLabel = (prod.category || "General").toString().toUpperCase();
    const descRaw = String(prod.description || "").trim();
    const descShort = descRaw.length > 80 ? `${descRaw.slice(0, 77)}...` : descRaw;
    return `
      <article class="product-card">
        <div class="product-media">
          <a href="product.html?id=${encodeURIComponent(prod._id)}">
            <img src="${resolveImage(prod.image || prod.images?.[0])}" alt="${prod.name}">
          </a>
        </div>
        <div class="product-info">
          <div class="product-category">${categoryLabel}</div>
          <div class="product-name">${prod.name}</div>
          <div class="product-desc">${descShort}</div>
          <div class="product-divider"></div>
          <div class="product-price">GHC ${toNumber(prod.price).toFixed(2)}</div>
          <div class="product-stock ${stockClass}">${stockLabel}</div>
          <div class="product-actions">
            <button class="add-to-cart" data-id="${prod._id}" ${stock > 0 ? "" : "disabled"}>${stock > 0 ? "Add to Cart" : "Out of Stock"}</button>
            <a class="buy-now" href="checkout.html" data-id="${prod._id}">Buy Now</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderGridSection(container, section, items) {
    const el = document.createElement("section");
    el.className = "home-product-section";
    el.innerHTML = `
      <div class="home-section-header">
        <div class="home-section-titles">
          <h2 class="section-title">${section.title}</h2>
          <p class="section-subtitle">${section.subtitle || ""}</p>
        </div>
      </div>
      <div class="product-grid">${items.map(renderHomeProductCard).join("")}</div>
      <div class="home-section-cta">
        <a class="home-section-btn" href="products.html?section=${encodeURIComponent(section.key)}">View all</a>
      </div>
    `;
    container.appendChild(el);
  }

  function setupHorizontalArrows(scroller, { minItems = 3 } = {}) {
    if (!scroller) return;
    const itemCount = scroller.children.length;
    if (itemCount < minItems) return;

    let wrapper = scroller.closest(".home-scroll-wrap");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "home-scroll-wrap";
      if (scroller.id === "categoryBubblesContainer") {
        wrapper.classList.add("for-categories");
      }
      scroller.parentNode.insertBefore(wrapper, scroller);
      wrapper.appendChild(scroller);
    }

    let controls = wrapper.querySelector(".home-scroll-controls");
    let leftBtn = wrapper.querySelector(".home-scroll-arrow.left");
    let rightBtn = wrapper.querySelector(".home-scroll-arrow.right");

    if (!controls || !leftBtn || !rightBtn) {
      if (!controls) {
        controls = document.createElement("div");
        controls.className = "home-scroll-controls";
        wrapper.insertBefore(controls, scroller);
      }

      leftBtn = document.createElement("button");
      leftBtn.type = "button";
      leftBtn.className = "home-scroll-arrow left";
      leftBtn.setAttribute("aria-label", "Scroll left");
      leftBtn.innerHTML = "&#8249;";

      rightBtn = document.createElement("button");
      rightBtn.type = "button";
      rightBtn.className = "home-scroll-arrow right";
      rightBtn.setAttribute("aria-label", "Scroll right");
      rightBtn.innerHTML = "&#8250;";

      controls.appendChild(leftBtn);
      controls.appendChild(rightBtn);
    }

    const getStep = () => Math.max(180, Math.floor(scroller.clientWidth * 0.75));

    const updateButtons = () => {
      const mobile = window.matchMedia("(max-width: 768px)").matches;
      const overflow = scroller.scrollWidth > scroller.clientWidth + 2;
      const show = mobile && overflow;
      wrapper.classList.toggle("has-scroll-arrows", show);
      if (!show) return;
      leftBtn.disabled = scroller.scrollLeft <= 2;
      rightBtn.disabled = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
    };

    leftBtn.onclick = () => {
      scroller.scrollBy({ left: -getStep(), behavior: "smooth" });
    };

    rightBtn.onclick = () => {
      scroller.scrollBy({ left: getStep(), behavior: "smooth" });
    };

    scroller.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);
    requestAnimationFrame(updateButtons);
  }

  function renderCategoryBubbles() {
    const host = document.getElementById("categoryBubblesContainer");
    if (!host) return;
    const categories = [
      { label: "Laptops", image: "category%20img/laptops.webp" },
      { label: "Phones & Tablets", image: "category%20img/mobilephones.jfif" },
      { label: "Monitors", image: "category%20img/monitors.avif" },
      { label: "Accessories", image: "category%20img/accessories.webp" },
      { label: "Storage Devices", image: "category%20img/storage%20devices.webp" },
      { label: "Printers & Scanners", image: "category%20img/printers.webp" },
      { label: "Projectors", image: "category%20img/projectors.webp" },
    ];

    host.innerHTML = categories
      .map((cat) => {
        const img = cat.image;
        return `
          <a class="category-bubble" href="products.html?cat=${encodeURIComponent(cat.label)}">
            <span class="bubble-media"><img src="${img}" alt="${cat.label}"></span>
            <span class="bubble-label">${cat.label}</span>
          </a>
        `;
      })
      .join("");

    setupHorizontalArrows(host, { minItems: 3 });
  }

  async function renderHomeSections() {
    const container = document.getElementById("homeSectionsContainer");
    if (!container) return;

    try {
      const products = await fetchAllProductsWithFallback();
      if (!products.length) throw new Error("Failed to load products");

      container.innerHTML = "";
      renderCategoryBubbles();
      getHomeSectionDefinitions().forEach((section) => {
        const items = pickProductsForSection(products, section.key, 4);
        if (!items.length) return;
        renderGridSection(container, section, items);
      });

      container.querySelectorAll(".home-product-section .product-grid").forEach((gridEl) => {
        setupHorizontalArrows(gridEl, { minItems: 3 });
      });

      initAddToCartButtons(container);
      initBuyNowButtons(container);
    } catch (err) {
      console.error("Error loading home sections:", err);
      container.innerHTML = "<p>Failed to load products.</p>";
    }
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    updateHeaderCartBadge();
    renderHomeSections();
    renderCartPage();

    document.addEventListener("cart-updated", () => {
      updateHeaderCartBadge();
      renderCartPage();
    });
  });
})();


