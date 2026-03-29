// assets/js/products.js
document.addEventListener("DOMContentLoaded", () => {
  const {
    API_BASE_PRODUCTS,
    BASE_URL,
    loadCart,
    saveCart,
  } = window.CONFIG || {};
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

  const grid = document.querySelector(".product-grid");
  if (!grid) return;

  const paginationEl = document.getElementById("pagination");
  const cartCountEl = document.getElementById("headerCartCount");
  const cartTotalEl = document.getElementById("headerCartTotal");
  const headingEl = document.querySelector(".products-header h1, .products-header h2");

  const searchInput = document.getElementById("productsSearchInput");
  const searchForm = document.getElementById("productsSearchForm");
  const searchInputMobile = document.getElementById("productsSearchInputMobile");
  const searchFormMobile = document.getElementById("productsSearchFormMobile");
  const fallbackSearchInput =
    document.getElementById("search-input") ||
    document.querySelector(".searchbar input");
  const fallbackSearchForm =
    document.getElementById("search-form") ||
    (fallbackSearchInput ? fallbackSearchInput.closest("form") : null);

  const categorySelect = document.getElementById("categorySelect");
  const sortSelect = document.getElementById("sortSelect");
  const maxPriceRange = document.getElementById("maxPriceRange");
  const maxPriceValue = document.getElementById("maxPriceValue");
  const brandFiltersEl = document.getElementById("brandFilters");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  const openFiltersBtn = document.getElementById("openFiltersBtn");
  const closeFiltersBtn = document.getElementById("closeFiltersBtn");
  const applyFiltersBtn = document.getElementById("applyFiltersBtn");
  const filtersPanel = document.getElementById("productsFilters");
  const filtersBackdrop = document.getElementById("productsFiltersBackdrop");
  const applyFiltersDesktopBtn = document.getElementById("applyFiltersDesktopBtn");
  const activeFiltersDisplay = document.getElementById("productsActiveFiltersDisplay");
  const activeFilterTags = document.getElementById("productsActiveFilterTags");
  const clearAllBtn = document.getElementById("productsClearAllBtn");
  const searchTimerEl = document.getElementById("productsSearchTimer");
  const searchTypingEl = document.getElementById("productsSearchTyping");
  const searchHintEl = document.getElementById("productsSearchHint");
  const searchClearBtn = document.getElementById("productsSearchClear");
  const searchTimerMobileEl = document.getElementById("productsSearchTimerMobile");
  const searchTypingMobileEl = document.getElementById("productsSearchTypingMobile");
  const searchHintMobileEl = document.getElementById("productsSearchHintMobile");
  const searchClearMobileBtn = document.getElementById("productsSearchClearMobile");
  const navLinks = document.querySelectorAll(".nav-cats a");

  let cart = typeof loadCart === "function" ? loadCart() : [];
  let allProducts = [];
  let currentPage = 1;
  let lastTotalPages = 1;
  let autoSearchTimer = null;
  let countdownTimer = null;
  const SEARCH_DELAY_MS = 8000;
  const SEARCH_MIN_CHARS = 2;
  const searchInputs = [searchInput, searchInputMobile, fallbackSearchInput].filter(Boolean);
  const searchForms = [searchForm, searchFormMobile, fallbackSearchForm].filter(Boolean);
  const searchUIs = [
    { timer: searchTimerEl, typing: searchTypingEl, hint: searchHintEl },
    { timer: searchTimerMobileEl, typing: searchTypingMobileEl, hint: searchHintMobileEl },
  ];

  const state = {
    q: "",
    category: "all",
    sort: "name",
    section: "",
    brands: [],
    maxPrice: 25000,
  };

  const tempFilters = {
    category: "all",
    sort: "name",
    section: "",
    brands: [],
    maxPrice: 25000,
  };

  const categoryNames = {
    laptops: "Laptops & Computers",
    phones: "Phones & Tablets",
    monitors: "Monitors & Displays",
    accessories: "Accessories",
    storage: "Storage Devices",
    printers: "Printers & Scanners",
    others: "Others",
  };

  const categoryBrands = {
    laptops: ["HP", "Dell", "Lenovo", "Apple", "Asus", "Acer", "Microsoft", "Samsung", "Toshiba", "MSI", "Other"],
    phones: ["Apple", "Samsung", "Google", "Huawei", "Xiaomi", "Oppo", "Vivo", "Tecno", "Infinix", "Nokia", "Other"],
    monitors: ["Dell", "HP", "Samsung", "LG", "Acer", "Asus", "BenQ", "ViewSonic", "Philips", "AOC", "Other"],
    accessories: ["Logitech", "Microsoft", "Apple", "Samsung", "Anker", "JBL", "Sony", "Razer", "Corsair", "HyperX", "Other"],
    storage: ["Seagate", "Western Digital", "Samsung", "Toshiba", "Kingston", "SanDisk", "Crucial", "Transcend", "Other"],
    printers: ["HP", "Canon", "Epson", "Brother", "Xerox", "Lexmark", "Ricoh", "Kyocera", "Other"],
    others: ["Generic", "Unbranded", "Other", "Multiple"],
  };

  const categoryPriceRanges = {
    laptops: { min: 1500, max: 25000, step: 500 },
    phones: { min: 150, max: 20000, step: 300 },
    monitors: { min: 300, max: 10000, step: 500 },
    accessories: { min: 50, max: 5000, step: 50 },
    storage: { min: 50, max: 3000, step: 50 },
    printers: { min: 500, max: 10000, step: 500 },
    others: { min: 50, max: 25000, step: 100 },
    default: { min: 0, max: 25000, step: 100 },
  };

  const wishlistState = {
    loaded: false,
    ids: new Set(),
    pending: new Set(),
  };

  function normalize(str) {
    return (str || "").toString().trim().toLowerCase();
  }

  function canonicalCategory(value) {
    const v = normalize(value);
    if (v === "all" || !v) return "all";
    if (v.startsWith("laptop")) return "laptops";
    if (v.startsWith("phone")) return "phones";
    if (v.startsWith("monitor")) return "monitors";
    if (v.startsWith("access")) return "accessories";
    if (v.startsWith("stor")) return "storage";
    if (v.startsWith("print")) return "printers";
    if (v.startsWith("other")) return "others";
    return v;
  }

  function getCategoryLabel(category) {
    const key = canonicalCategory(category);
    if (key === "all") return "All Categories";
    return categoryNames[key] || key.charAt(0).toUpperCase() + key.slice(1);
  }

  function formatCurrency(value) {
    return `GHC ${Number(value || 0).toFixed(2)}`;
  }

  function getStock(product) {
    return Number(
      product.stock_quantity ??
      product.countInStock ??
      product.stock ??
      0
    );
  }

  function resolveImage(src) {
    if (!src) return PLACEHOLDER_IMAGE;
    if (/^(https?:|data:)/i.test(src)) return src;
    if (src.startsWith("/uploads") || src.startsWith("uploads/")) {
      return `${BASE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
    }
    return src;
  }

  function normalizeProductListPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.products)) return payload.products;
    return [];
  }

  async function loadProductsDataset() {
    try {
      const res = await fetchWithTimeout(`${API_BASE_PRODUCTS}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const products = normalizeProductListPayload(data);
      if (products.length) {
        try {
          localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(products));
        } catch {}
      }
      return products;
    } catch (networkError) {
      try {
        if (!CAN_FETCH_LOCAL_SNAPSHOT) throw new Error("snapshot fetch blocked on file://");
        const fallbackRes = await fetchWithTimeout(SNAPSHOT_PATH, { cache: "force-cache" }, 1200);
        if (!fallbackRes.ok) throw new Error(`Snapshot HTTP ${fallbackRes.status}`);
        const fallbackData = await fallbackRes.json();
        const snapshotProducts = normalizeProductListPayload(fallbackData);
        if (snapshotProducts.length) {
          showOfflineModeNotice();
          try {
            localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshotProducts));
          } catch {}
        }
        return snapshotProducts;
      } catch (snapshotError) {
        try {
          const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed) && parsed.length) {
            showOfflineModeNotice();
            return parsed;
          }
        } catch {}
        console.warn("Products API and snapshot fallback failed:", networkError, snapshotError);
        return [];
      }
    }
  }

  function shareLink(id) {
    return `${location.origin}/product.html?id=${encodeURIComponent(id)}`;
  }

  function notify(message, type = "success") {
    if (!message) return;
    if (typeof window.CONFIG?.showToast === "function") {
      window.CONFIG.showToast(message, type);
      return;
    }
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
      return;
    }
    console.log(`[${type}] ${message}`);
  }

  function clearSearchTimers() {
    if (autoSearchTimer) {
      clearTimeout(autoSearchTimer);
      autoSearchTimer = null;
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    searchUIs.forEach(({ timer, typing }) => {
      if (timer) {
        timer.classList.add("hidden");
        timer.textContent = `${Math.floor(SEARCH_DELAY_MS / 1000)}s`;
      }
      if (typing) typing.classList.add("hidden");
    });
  }

  function runSearch(value) {
    state.q = String(value || "").trim();
    currentPage = 1;
    applyFilters(true);
  }

  function updateSearchHint(value) {
    const v = String(value || "").trim();
    searchUIs.forEach(({ hint }) => {
      if (!hint) return;
      if (v && v.length < SEARCH_MIN_CHARS) hint.classList.remove("hidden");
      else hint.classList.add("hidden");
    });
  }

  function startDelayedSearch(value) {
    clearSearchTimers();
    const v = String(value || "").trim();
    if (!v || v.length >= SEARCH_MIN_CHARS) {
      let left = Math.floor(SEARCH_DELAY_MS / 1000);
      searchUIs.forEach(({ timer, typing }) => {
        if (timer) {
          timer.classList.remove("hidden");
          timer.textContent = `${left}s`;
        }
        if (typing) typing.classList.add("hidden");
      });
      countdownTimer = setInterval(() => {
        left -= 1;
        searchUIs.forEach(({ timer }) => {
          if (timer) timer.textContent = `${Math.max(0, left)}s`;
        });
        if (left <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
        }
      }, 1000);
      autoSearchTimer = setTimeout(() => {
        clearSearchTimers();
        runSearch(v);
      }, SEARCH_DELAY_MS);
    } else {
      searchUIs.forEach(({ typing }) => {
        if (typing) typing.classList.remove("hidden");
      });
    }
  }

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function syncSearchInputs(value, sourceInput = null) {
    searchInputs.forEach((input) => {
      if (!input || input === sourceInput) return;
      input.value = value;
    });
  }

  function openMobileFilters() {
    if (!filtersPanel || !filtersBackdrop) return;
    filtersPanel.classList.add("open");
    filtersBackdrop.classList.add("active");
    document.body.style.overflow = "hidden";
    document.body.classList.add("filters-open");
  }

  function closeMobileFilters() {
    if (!filtersPanel || !filtersBackdrop) return;
    filtersPanel.classList.remove("open");
    filtersBackdrop.classList.remove("active");
    document.body.style.overflow = "";
    document.body.classList.remove("filters-open");
  }

  function syncFilterControlsFromTemp() {
    if (categorySelect) categorySelect.value = tempFilters.category;
    if (sortSelect) {
      sortSelect.value = tempFilters.section ? `section-${tempFilters.section}` : tempFilters.sort;
    }
    if (maxPriceRange) maxPriceRange.value = String(tempFilters.maxPrice);
    if (maxPriceValue) maxPriceValue.textContent = formatCurrency(tempFilters.maxPrice);
  }

  function updatePriceRangeControlByCategory() {
    if (!maxPriceRange) return;
    const key = canonicalCategory(tempFilters.category);
    const cfg = key !== "all" && categoryPriceRanges[key] ? categoryPriceRanges[key] : categoryPriceRanges.default;
    maxPriceRange.min = String(cfg.min);
    maxPriceRange.max = String(cfg.max);
    maxPriceRange.step = String(cfg.step);
    if (Number(tempFilters.maxPrice) < cfg.min || Number(tempFilters.maxPrice) > cfg.max) {
      tempFilters.maxPrice = cfg.max;
    }
    maxPriceRange.value = String(tempFilters.maxPrice);
    if (maxPriceValue) maxPriceValue.textContent = formatCurrency(tempFilters.maxPrice);
  }

  function applyTempFilters(pushUrl = true) {
    if (sortSelect) {
      const value = sortSelect.value || "name";
      if (value.startsWith("section-")) {
        tempFilters.section = value.replace("section-", "");
        tempFilters.sort = "name";
      } else {
        tempFilters.sort = value;
        tempFilters.section = "";
      }
    }
    state.category = canonicalCategory(tempFilters.category);
    state.sort = tempFilters.sort;
    state.section = tempFilters.section || "";
    state.maxPrice = Number(tempFilters.maxPrice || 25000);
    state.brands = [...tempFilters.brands];
    currentPage = 1;
    applyFilters(pushUrl);
  }

  async function safeCopyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-999999px";
      ta.style.top = "-999999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) return true;
    } catch {}
    notify("Copy failed. Use your browser share menu or copy from address bar.", "info");
    return false;
  }

  function setCart(next) {
    cart = next;
    if (window.cart && typeof window.cart.saveCart === "function") {
      window.cart.saveCart(cart);
    } else if (typeof saveCart === "function") {
      saveCart(cart);
    }
  }

  function updateCartUI() {
    let totalItems = 0;
    let totalPrice = 0;
    cart.forEach((item) => {
      const qty = Number(item.qty || item.quantity || 0);
      totalItems += qty;
      totalPrice += Number(item.price || 0) * qty;
    });
    if (cartCountEl) cartCountEl.textContent = String(totalItems);
    if (cartTotalEl) cartTotalEl.textContent = formatCurrency(totalPrice);
  }

  function getPerPage() {
    return window.matchMedia("(max-width: 768px)").matches ? 4 : 6;
  }

  function parseDateSafe(d) {
    const t = Date.parse(d);
    return Number.isFinite(t) ? t : 0;
  }

  function parsePrice(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value).replace(/[^0-9.]+/g, "");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function sectionAssigned(product, key) {
    const sections = Array.isArray(product.homeSections) ? product.homeSections : [];
    return sections.map((s) => String(s || "").toLowerCase()).includes(String(key || "").toLowerCase());
  }

  function applySectionFilter(list) {
    if (!state.section) return list;
    if (state.section === "new_arrivals") {
      return list
        .slice()
        .sort((a, b) => parseDateSafe(b.createdAt || b.updatedAt) - parseDateSafe(a.createdAt || a.updatedAt));
    }
    return list.filter((p) => sectionAssigned(p, state.section));
  }

  function sortProducts(list) {
    const out = [...list];
    out.sort((a, b) => {
      const aPrice = parsePrice(a.discountPrice ?? a.price);
      const bPrice = parsePrice(b.discountPrice ?? b.price);
      if (state.section === "new_arrivals" && state.sort === "name") {
        return parseDateSafe(b.createdAt || b.updatedAt) - parseDateSafe(a.createdAt || a.updatedAt);
      }
      if (state.sort === "price-low") {
        return aPrice - bPrice;
      }
      if (state.sort === "price-high") {
        return bPrice - aPrice;
      }
      return normalize(a.name).localeCompare(normalize(b.name));
    });
    return out;
  }

  function getFilteredProducts() {
    const q = normalize(state.q);
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];
    const selectedBrands = state.brands.map(normalize);

    const base = allProducts.filter((p) => {
        const category = canonicalCategory(p.category);
        const name = normalize(p.name);
        const brand = normalize(p.brand);
        const desc = normalize(p.description);
        const shortDesc = normalize(p.short_description);
        const price = Number(p.discountPrice ?? p.price ?? 0);

        const searchBlob = `${name} ${brand} ${desc} ${shortDesc} ${category}`;
        const matchesSearch = !terms.length || terms.every((t) => searchBlob.includes(t));
        const matchesCategory = state.category === "all" || category === canonicalCategory(state.category);
        const matchesBrand =
          !selectedBrands.length ||
          selectedBrands.some((b) => brand === b || name.includes(b));
        const matchesPrice = price <= Number(state.maxPrice || 25000);
        return matchesSearch && matchesCategory && matchesBrand && matchesPrice;
      });

    const sectionFiltered = applySectionFilter(base);
    return sortProducts(sectionFiltered);
  }

  function renderPagination(totalPages) {
    if (!paginationEl) return;
    if (totalPages <= 1) {
      paginationEl.innerHTML = "";
      return;
    }
    const prevDisabled = currentPage === 1 ? "disabled" : "";
    const nextDisabled = currentPage === totalPages ? "disabled" : "";
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
      .map((p) => `<button class="page-btn ${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`)
      .join("");

    paginationEl.innerHTML = `
      <button class="page-btn" data-page="prev" ${prevDisabled}>Prev</button>
      ${pages}
      <button class="page-btn" data-page="next" ${nextDisabled}>Next</button>
    `;
  }

  function updateHeading(total) {
    const label = state.category === "all" ? "All Products" : getCategoryLabel(state.category);
    const sortLabel =
      state.sort === "price-low" ? " - Price Low to High" :
      state.sort === "price-high" ? " - Price High to Low" :
      " - Name A-Z";
    const sectionLabel = state.section
      ? state.section === "new_arrivals"
        ? " - New Arrivals"
        : ` - ${state.section.replace(/_/g, " ")}`
      : "";
    if (headingEl) headingEl.textContent = `${label}${sortLabel}${sectionLabel} (${total})`;
  }

  function updateSeoMeta(total) {
    const meta = document.querySelector('meta[name="description"]');
    const label = state.category === "all" ? "All Products" : getCategoryLabel(state.category);
    const titleBase = "Deetech Computers | Products";
    const hasSearch = Boolean(state.q && state.q.trim());
    const rawSection = state.section ? state.section.replace(/_/g, " ") : "";
    const sectionLabel = rawSection ? rawSection.replace(/\b\w/g, (c) => c.toUpperCase()) : "";
    let title = titleBase;
    let description = "Browse all laptops, gadgets, and accessories at Deetech Computers. Best deals in Ghana.";

    if (state.category !== "all") {
      title = `${label} | Deetech Computers`;
      description = `Shop ${label.toLowerCase()} at Deetech Computers with trusted support and delivery across Ghana.`;
    }

    if (state.section) {
      title = `${label === "All Categories" ? "Products" : label} - ${sectionLabel} | Deetech Computers`;
      description = `Browse ${rawSection} in ${label === "All Categories" ? "our full product catalog" : label.toLowerCase()} at Deetech Computers.`;
    }

    if (hasSearch) {
      title = `Search results for "${state.q.trim()}" | Deetech Computers`;
      description = `Find search results for ${state.q.trim()} at Deetech Computers across laptops, gadgets, and accessories in Ghana.`;
    }

    if (typeof total === "number" && total > 0 && !hasSearch) {
      description += ` Explore ${total} available options.`;
    }

    document.title = title;
    if (meta) meta.setAttribute("content", description);
  }
  function updateUrl() {
    const params = new URLSearchParams();
    if (state.q) params.set("search", state.q);
    if (state.category !== "all") params.set("category", state.category);
    if (state.sort !== "name") params.set("sort", state.sort);
    if (state.section) params.set("section", state.section);
    if (state.brands.length) params.set("brands", state.brands.join(","));
    if (Number(state.maxPrice) !== 25000) params.set("maxPrice", String(state.maxPrice));
    if (currentPage > 1) params.set("page", String(currentPage));
    history.replaceState(null, "", params.toString() ? `?${params.toString()}` : location.pathname);
  }

  function renderProducts(products) {
    grid.innerHTML = "";
    if (!products.length) {
      grid.innerHTML = "<p>No products found.</p>";
      return;
    }

    products.forEach((p) => {
      const productId = p._id || p.id;
      const imageSrc = resolveImage((Array.isArray(p.images) && p.images[0]) || p.image || p.image_url);
      const basePrice = Number(p.price || 0);
      const discountPrice = p.discountPrice != null ? Number(p.discountPrice) : null;
      const currentPrice = discountPrice != null ? discountPrice : basePrice;
      const oldPrice = discountPrice != null ? basePrice : null;
      const stock = getStock(p);
      const isFeatured = p.featured || p.isFeatured;
      const desc = String(p.short_description || p.description || "").trim();
      const shortDesc = desc.length > 80 ? `${desc.slice(0, 77)}...` : desc;
      const inWishlist = wishlistState.ids.has(String(productId));
      const wishlistPending = wishlistState.pending.has(String(productId));

      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="product-media">
          <a href="product.html?id=${encodeURIComponent(productId)}">
            <img src="${imageSrc}" alt="${escapeHtml(p.name)}" width="400" height="300" loading="lazy" decoding="async">
          </a>
          ${isFeatured ? '<div class="media-badge">FEATURED</div>' : ""}
          <div class="media-actions">
            <button
              class="media-action btn-wishlist ${inWishlist ? "active" : ""} ${wishlistPending ? "is-loading" : ""}"
              data-id="${productId}"
              aria-label="Wishlist"
              aria-pressed="${inWishlist ? "true" : "false"}"
              aria-busy="${wishlistPending ? "true" : "false"}"
              ${wishlistPending ? "disabled" : ""}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 21s-6.7-4.35-9.2-8.1C.66 9.7 2.1 5.5 6.15 4.7c2.2-.45 4.3.36 5.85 2.18 1.55-1.82 3.65-2.63 5.85-2.18 4.05.8 5.49 5 3.35 8.2C18.7 16.65 12 21 12 21Z" stroke-width="1.9" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="media-action btn-copy" data-url="${shareLink(productId)}" aria-label="Copy link">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="9" width="10" height="10" rx="2" stroke-width="1.9"/>
                <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="media-action btn-share" data-url="${shareLink(productId)}" aria-label="Share">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 8l-6 4 6 4" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="18" cy="6" r="3" stroke-width="1.9"/>
                <circle cx="6" cy="12" r="3" stroke-width="1.9"/>
                <circle cx="18" cy="18" r="3" stroke-width="1.9"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="product-info">
          <div class="product-category">${escapeHtml(getCategoryLabel(p.category).toUpperCase())}</div>
          <div class="product-name">${escapeHtml(p.name)}</div>
          <div class="product-desc">${escapeHtml(shortDesc)}</div>
          <div class="product-divider"></div>
          <div class="product-price">
            <span class="current">${formatCurrency(currentPrice)}</span>
            ${oldPrice != null ? `<span class="old">${formatCurrency(oldPrice)}</span>` : ""}
          </div>
          <div class="product-stock ${stock > 0 ? "in" : "out"}">${stock > 0 ? `In Stock (${stock})` : "Out of Stock"}</div>
          <div class="product-actions">
            <button class="add-to-cart" data-id="${productId}" ${stock > 0 ? "" : "disabled"}>${stock > 0 ? "Add to Cart" : "Out of Stock"}</button>
            <a href="product.html?id=${encodeURIComponent(productId)}" class="view-link">View Details</a>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderBrandFilters() {
    if (!brandFiltersEl) return;
    const key = canonicalCategory(tempFilters.category);
    const brands = key !== "all" ? (categoryBrands[key] || []) : [];

    if (!brands.length) {
      brandFiltersEl.innerHTML = '<span class="products-brand-option">No brands available</span>';
      return;
    }

    brandFiltersEl.innerHTML = brands
      .map((brand) => {
        const checked = tempFilters.brands.includes(brand) ? "checked" : "";
        const id = `brand-${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        return `
          <label class="products-brand-option" for="${id}">
            <input type="checkbox" id="${id}" data-brand="${escapeHtml(brand)}" ${checked}>
            <span>${escapeHtml(brand)}</span>
          </label>
        `;
      })
      .join("");
  }

  function hasActiveFilters() {
    return Boolean(
      state.q ||
      (state.category && state.category !== "all") ||
      state.section ||
      (state.brands && state.brands.length) ||
      Number(state.maxPrice) < 25000
    );
  }

  function renderActiveFilterTags() {
    if (!activeFiltersDisplay || !activeFilterTags) return;
    if (!hasActiveFilters()) {
      activeFiltersDisplay.classList.add("hidden");
      activeFilterTags.innerHTML = "";
      return;
    }

    const tags = [];
    if (state.category && state.category !== "all") {
      tags.push(`<span class="products-filter-tag">${escapeHtml(getCategoryLabel(state.category))}<button type="button" data-remove="category">&times;</button></span>`);
    }
    if (state.section) {
      const sectionLabel = state.section === "new_arrivals"
        ? "New Arrivals"
        : state.section.replace(/_/g, " ");
      tags.push(`<span class="products-filter-tag">${escapeHtml(sectionLabel)}<button type="button" data-remove="section">&times;</button></span>`);
    }
    (state.brands || []).forEach((brand) => {
      tags.push(`<span class="products-filter-tag">${escapeHtml(brand)}<button type="button" data-remove="brand" data-brand="${escapeHtml(brand)}">&times;</button></span>`);
    });
    if (Number(state.maxPrice) < 25000) {
      tags.push(`<span class="products-filter-tag">Under ${escapeHtml(formatCurrency(state.maxPrice))}<button type="button" data-remove="price">&times;</button></span>`);
    }
    if (state.q) {
      tags.push(`<span class="products-filter-tag">Search: "${escapeHtml(state.q)}"<button type="button" data-remove="search">&times;</button></span>`);
    }

    activeFiltersDisplay.classList.remove("hidden");
    activeFilterTags.innerHTML = tags.join("");
  }

  function applyFilters(pushUrl = true) {
    const filtered = getFilteredProducts();
    const perPage = getPerPage();
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    lastTotalPages = totalPages;
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * perPage;
    renderProducts(filtered.slice(start, start + perPage));
    renderPagination(totalPages);
    updateHeading(filtered.length);
    updateSeoMeta(filtered.length);
    renderActiveFilterTags();
    if (pushUrl) updateUrl();
  }

  async function loadWishlist() {
    const token = window.auth?.getToken?.();
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/wishlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
      list.forEach((item) => {
        const id = item.productId || item.product_id || item._id || item.id;
        if (id) wishlistState.ids.add(String(id));
      });
      wishlistState.loaded = true;
    } catch {}
  }

  async function toggleWishlist(id) {
    const token = window.auth?.getToken?.();
    if (!token) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        notify("You're offline. Sign in when back online to use wishlist.", "info");
        return;
      }
      notify("Login to use wishlist", "info");
      window.location.href = "login.html";
      return;
    }
    if (wishlistState.pending.has(String(id))) return;

    wishlistState.pending.add(String(id));
    applyFilters(false);

    const wanted = !wishlistState.ids.has(String(id));
    try {
      const res = await fetch(`${BASE_URL}/api/wishlist/${id}`, {
        method: wanted ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("wishlist request failed");
      if (wanted) {
        wishlistState.ids.add(String(id));
        notify("Added to wishlist", "success");
      } else {
        wishlistState.ids.delete(String(id));
        notify("Removed from wishlist", "info");
      }
      applyFilters(false);
      document.dispatchEvent(new Event("wishlist-updated"));
    } catch {
      notify("Failed to update wishlist", "error");
    } finally {
      wishlistState.pending.delete(String(id));
      applyFilters(false);
    }
  }

  function addToCartById(id) {
    const product = allProducts.find((p) => String(p._id || p.id) === String(id));
    if (!product) return;
    const stock = getStock(product);
    if (stock < 1) {
      notify("Out of stock", "error");
      return;
    }
    const existing = cart.find((item) => String(item._id || item.productId) === String(id));
    if (existing) {
      const nextQty = Number(existing.qty || existing.quantity || 0) + 1;
      if (nextQty > stock) {
        notify("Cannot add more than available stock", "info");
        return;
      }
      existing.qty = nextQty;
    } else {
      cart.push({
        _id: id,
        productId: id,
        name: product.name,
        price: Number(product.discountPrice ?? product.price ?? 0),
        image: resolveImage((Array.isArray(product.images) && product.images[0]) || product.image || product.image_url),
        qty: 1,
        countInStock: stock,
      });
    }
    setCart(cart);
    updateCartUI();
    notify(`${product.name} added to cart`, "success");
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("cartUpdated"));
      window.dispatchEvent(new Event("storage"));
    });
  }

  function wireEvents() {
    searchInputs.forEach((input) => {
      input.addEventListener("input", () => {
        const v = input.value || "";
        syncSearchInputs(v, input);
        updateSearchHint(v);
        startDelayedSearch(v);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        clearSearchTimers();
        runSearch(input.value || "");
      });
    });

    searchForms.forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const targetInput = form.contains(searchInputMobile) ? searchInputMobile : form.contains(searchInput) ? searchInput : fallbackSearchInput;
        clearSearchTimers();
        runSearch(targetInput?.value || "");
      });
    });

    [searchClearBtn, searchClearMobileBtn].filter(Boolean).forEach((btn) => {
      btn.addEventListener("click", () => {
        syncSearchInputs("");
        if (searchInput) searchInput.value = "";
        if (searchInputMobile) searchInputMobile.value = "";
        if (fallbackSearchInput) fallbackSearchInput.value = "";
        updateSearchHint("");
        clearSearchTimers();
        runSearch("");
      });
    });

    if (categorySelect) {
      categorySelect.addEventListener("change", () => {
        tempFilters.category = canonicalCategory(categorySelect.value || "all");
        tempFilters.brands = [];
        updatePriceRangeControlByCategory();
        renderBrandFilters();
        if (!isMobile()) applyTempFilters(true);
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        const value = sortSelect.value || "name";
        if (value.startsWith("section-")) {
          tempFilters.section = value.replace("section-", "");
          tempFilters.sort = "name";
        } else {
          tempFilters.sort = value;
          tempFilters.section = "";
        }
        if (!isMobile()) applyTempFilters(true);
      });
    }

    if (maxPriceRange) {
      maxPriceRange.addEventListener("input", () => {
        tempFilters.maxPrice = Number(maxPriceRange.value || 25000);
        if (maxPriceValue) maxPriceValue.textContent = formatCurrency(tempFilters.maxPrice);
        if (!isMobile()) applyTempFilters(false);
      });
    }

    if (brandFiltersEl) {
      brandFiltersEl.addEventListener("change", (e) => {
        const input = e.target.closest("input[type='checkbox'][data-brand]");
        if (!input) return;
        const brand = input.dataset.brand;
        if (!brand) return;
        if (input.checked) {
          if (!tempFilters.brands.includes(brand)) tempFilters.brands.push(brand);
        } else {
          tempFilters.brands = tempFilters.brands.filter((b) => b !== brand);
        }
        if (!isMobile()) applyTempFilters(true);
      });
    }

    if (openFiltersBtn) {
      openFiltersBtn.addEventListener("click", () => {
        syncFilterControlsFromTemp();
        renderBrandFilters();
        if (isMobile()) openMobileFilters();
      });
    }

    if (closeFiltersBtn) closeFiltersBtn.addEventListener("click", closeMobileFilters);
    if (filtersBackdrop) filtersBackdrop.addEventListener("click", closeMobileFilters);
    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener("click", () => {
        applyTempFilters(true);
        if (isMobile()) closeMobileFilters();
      });
    }
    if (applyFiltersDesktopBtn) {
      applyFiltersDesktopBtn.addEventListener("click", () => {
        applyTempFilters(true);
      });
    }

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => {
        tempFilters.category = "all";
        tempFilters.sort = "name";
        tempFilters.section = "";
        tempFilters.brands = [];
        tempFilters.maxPrice = 25000;
        state.category = "all";
        state.sort = "name";
        state.section = "";
        state.brands = [];
        state.maxPrice = 25000;
        state.q = "";
        currentPage = 1;

        syncSearchInputs("");
        if (searchInput) searchInput.value = "";
        if (searchInputMobile) searchInputMobile.value = "";
        if (fallbackSearchInput) fallbackSearchInput.value = "";
        syncFilterControlsFromTemp();
        updatePriceRangeControlByCategory();

        renderBrandFilters();
        applyFilters(true);
        notify("Filters cleared", "info");
      });
    }

    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        clearFiltersBtn?.click();
      });
    }

    if (activeFilterTags) {
      activeFilterTags.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-remove]");
        if (!btn) return;
        const type = btn.dataset.remove;
        if (type === "category") {
          state.category = "all";
          tempFilters.category = "all";
          tempFilters.brands = [];
          state.brands = [];
          updatePriceRangeControlByCategory();
          renderBrandFilters();
        } else if (type === "section") {
          state.section = "";
          tempFilters.section = "";
        } else if (type === "brand") {
          const brand = btn.dataset.brand || "";
          state.brands = state.brands.filter((b) => b !== brand);
          tempFilters.brands = tempFilters.brands.filter((b) => b !== brand);
          renderBrandFilters();
        } else if (type === "price") {
          state.maxPrice = 25000;
          tempFilters.maxPrice = 25000;
        } else if (type === "search") {
          state.q = "";
          syncSearchInputs("");
          if (searchInput) searchInput.value = "";
          if (searchInputMobile) searchInputMobile.value = "";
          if (fallbackSearchInput) fallbackSearchInput.value = "";
          updateSearchHint("");
          clearSearchTimers();
        }
        syncFilterControlsFromTemp();
        applyFilters(true);
      });
    }

    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href") || "";
        if (!href.includes("products.html")) return;
        const url = new URL(link.href, location.origin);
        const cat = url.searchParams.get("cat");
        if (!cat) return;
        e.preventDefault();
        const nextCat = canonicalCategory(cat);
        tempFilters.category = nextCat;
        tempFilters.brands = [];
        state.category = nextCat;
        state.brands = [];
        currentPage = 1;
        syncFilterControlsFromTemp();
        updatePriceRangeControlByCategory();
        renderBrandFilters();
        applyFilters(true);
      });
    });

    if (paginationEl) {
      paginationEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".page-btn");
        if (!btn) return;
        const page = btn.dataset.page;
        if (page === "prev") currentPage = Math.max(1, currentPage - 1);
        else if (page === "next") currentPage = Math.min(lastTotalPages, currentPage + 1);
        else currentPage = Number(page || 1);
        applyFilters(true);
      });
    }

    grid.addEventListener("click", async (e) => {
      const addBtn = e.target.closest(".add-to-cart");
      if (addBtn) {
        if (!addBtn.disabled) addToCartById(addBtn.dataset.id);
        return;
      }

      const wishBtn = e.target.closest(".btn-wishlist");
      if (wishBtn) {
        if (wishBtn.classList.contains("is-loading")) return;
        await toggleWishlist(wishBtn.dataset.id);
        return;
      }

      const copyBtn = e.target.closest(".btn-copy");
      if (copyBtn) {
        const ok = await safeCopyToClipboard(copyBtn.dataset.url || "");
        notify(ok ? "Link copied" : "Copy canceled", ok ? "success" : "info");
        return;
      }

      const shareBtn = e.target.closest(".btn-share");
      if (shareBtn) {
        const url = shareBtn.dataset.url || "";
        try {
          if (navigator.share) {
            await navigator.share({ url });
            notify("Shared successfully", "success");
          } else {
            const ok = await safeCopyToClipboard(url);
            notify(ok ? "Link copied" : "Copy canceled", ok ? "success" : "info");
          }
        } catch {
          notify("Share canceled", "info");
        }
      }
    });

    window.addEventListener("resize", () => {
      if (!isMobile()) closeMobileFilters();
      currentPage = 1;
      applyFilters(false);
    });
  }

  function hydrateStateFromUrl() {
    const params = new URLSearchParams(location.search);
    state.q = params.get("search") || params.get("q") || "";
    state.category = canonicalCategory(params.get("category") || params.get("cat") || "all");
    const sortParam = params.get("sort") || "name";
    const sectionParam = params.get("section") || "";
    state.sort = ["name", "price-low", "price-high"].includes(sortParam)
      ? sortParam
      : sortParam === "price-asc"
      ? "price-low"
      : sortParam === "price-desc"
      ? "price-high"
      : "name";
    state.section = sectionParam;
    state.maxPrice = Number(params.get("maxPrice") || 25000);
    state.brands = (params.get("brands") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    tempFilters.category = state.category;
    tempFilters.sort = state.sort;
    tempFilters.section = state.section;
    tempFilters.maxPrice = state.maxPrice;
    tempFilters.brands = [...state.brands];
    currentPage = Math.max(1, Number(params.get("page") || 1));

    syncSearchInputs(state.q);
    if (searchInput) searchInput.value = state.q;
    if (searchInputMobile) searchInputMobile.value = state.q;
    if (fallbackSearchInput) fallbackSearchInput.value = state.q;
    updateSearchHint(state.q);
    clearSearchTimers();
    updatePriceRangeControlByCategory();
    syncFilterControlsFromTemp();
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function init() {
    updateCartUI();
    hydrateStateFromUrl();

    try {
      allProducts = await loadProductsDataset();
      await loadWishlist();
      renderBrandFilters();
      applyFilters(false);
      wireEvents();
    } catch {
      grid.innerHTML = "<p>Could not load products. Please try again later.</p>";
    }
  }

  init();
});











