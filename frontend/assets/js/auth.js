// assets/js/auth.js
(function () {
  const { API_BASE, API_BASE_USERS, showToast } = window.CONFIG || {};
  const notify = typeof showToast === "function" ? showToast : (msg) => console.log(msg);

// -----------------------------
// Session helpers
// -----------------------------
const getUser = () => {
  try {
    const raw = localStorage.getItem("loggedInUser");
    if (!raw || raw === "undefined" || raw === "null") return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const setUser = (u) => localStorage.setItem("loggedInUser", JSON.stringify(u));
const clearUser = () => localStorage.removeItem("loggedInUser");

const getToken = () => {
  const t = localStorage.getItem("token");
  return t && t !== "null" && t !== "undefined" ? t : null;
};
const setToken = (t) => localStorage.setItem("token", t);
const clearToken = () => localStorage.removeItem("token");

// -----------------------------
// Auth endpoints
// -----------------------------
  const AUTH_BASE = `${API_BASE}/auth`;
  const $id = (id) => document.getElementById(id);

// -----------------------------
// Navbar render + update
// -----------------------------
  function ensureMobileBottomNavStyles(basePrefix) {
    const hasMobileNavCss = Array.from(document.querySelectorAll("link[rel='stylesheet']")).some(
      (l) => (l.getAttribute("href") || "").includes("assets/css/mobile-bottom-nav.css")
    );
    if (hasMobileNavCss) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${basePrefix}assets/css/mobile-bottom-nav.css`;
    document.head.appendChild(link);
  }

  function renderMobileBottomNav() {
    const path = location.pathname.toLowerCase();
    if (path.includes("/admin/")) return;
    if (document.getElementById("mobileBottomNav")) return;

    const basePrefix = path.includes("/admin/") ? "../" : "";
    ensureMobileBottomNavStyles(basePrefix);
    document.body.classList.add("has-mobile-bottom-nav");

    const nav = document.createElement("nav");
    nav.className = "mobile-bottom-nav";
    nav.id = "mobileBottomNav";
    nav.innerHTML = `
      <div class="mobile-bottom-nav__inner">
        <a class="mobile-bottom-nav__item" data-route="home" href="${basePrefix}index.html">
          <span class="mobile-bottom-nav__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3 2 11h2v10h6v-6h4v6h6V11h2z"></path></svg>
          </span>
          <span>Home</span>
        </a>
        <a class="mobile-bottom-nav__item" data-route="products" href="${basePrefix}products.html">
          <span class="mobile-bottom-nav__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M21 7 12 2 3 7v10l9 5 9-5V7zm-9-3.18L17.74 7 12 10.18 6.26 7 12 3.82zM5 9.24l6 3.33v6.18l-6-3.33V9.24zm14 6.18-6 3.33v-6.18l6-3.33v6.18z"></path></svg>
          </span>
          <span>Products</span>
        </a>
        <a class="mobile-bottom-nav__item is-center" data-route="cart" href="${basePrefix}cart.html">
          <span class="mobile-bottom-nav__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h2l2.2 9.2a1 1 0 0 0 1 .8H18a1 1 0 0 0 1-.76L21 8H8"></path><circle cx="10" cy="19" r="1.6"></circle><circle cx="17" cy="19" r="1.6"></circle></svg>
          </span>
          <span>Cart</span>
          <span class="mobile-bottom-nav__badge is-hidden" id="mobileBottomNavBadge">0</span>
        </a>
        <a class="mobile-bottom-nav__item" data-route="account" href="${basePrefix}login.html" id="mobileBottomNavAccountLink">
          <span class="mobile-bottom-nav__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5C20 16 16.42 14 12 14z"></path></svg>
          </span>
          <span id="mobileBottomNavAccountLabel">Login</span>
        </a>
      </div>
    `;
    document.body.appendChild(nav);
  }

  function updateMobileBottomNav() {
    const nav = document.getElementById("mobileBottomNav");
    if (!nav) return;

    const path = location.pathname.toLowerCase();
    const isHome = path.endsWith("/") || path.endsWith("/index.html") || path.endsWith("index.html");
    const isProducts = path.includes("products.html") || path.includes("product.html");
    const isCart = path.includes("cart.html");
    const isAccount =
      path.includes("account.html") ||
      path.includes("login.html") ||
      path.includes("register.html") ||
      path.includes("orders.html") ||
      path.includes("edit-account.html") ||
      path.includes("change-password.html");

    nav.querySelectorAll(".mobile-bottom-nav__item").forEach((item) => {
      item.classList.remove("is-active");
    });

    const setActive = (route) => {
      const el = nav.querySelector(`[data-route="${route}"]`);
      if (el) el.classList.add("is-active");
    };

    if (isHome) setActive("home");
    else if (isProducts) setActive("products");
    else if (isCart) setActive("cart");
    else if (isAccount) setActive("account");

    const user = getUser();
    const accountLink = document.getElementById("mobileBottomNavAccountLink");
    const accountLabel = document.getElementById("mobileBottomNavAccountLabel");
    if (accountLink) {
      accountLink.href = user ? "account.html" : "login.html";
    }
    if (accountLabel) {
      accountLabel.textContent = user ? "Account" : "Login";
    }

    const badge = document.getElementById("mobileBottomNavBadge");
    if (badge && typeof window.CONFIG?.loadCart === "function") {
      const cart = window.CONFIG.loadCart() || [];
      const count = cart.reduce((sum, item) => sum + (item.qty || item.quantity || 0), 0);
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.classList.toggle("is-hidden", count <= 0);
    }
  }

  function renderNavbar() {
    const path = location.pathname.toLowerCase();
    const isAdminPage = path.includes("/admin/");
    const basePrefix = isAdminPage ? "../" : "";
    const adminPrefix = isAdminPage ? "" : "Admin/";

    // Ensure navbar styles are loaded (some pages omit header.css)
    const hasHeaderCss = Array.from(document.querySelectorAll("link[rel='stylesheet']"))
      .some((l) => (l.getAttribute("href") || "").includes("assets/css/header.css"));
    if (!hasHeaderCss) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${basePrefix}assets/css/header.css`;
      document.head.appendChild(link);
    }

    const header = document.querySelector(".site-header");
    if (!header) return;

    const isProductsPage = path.includes("products.html");

    header.innerHTML = `
      <nav class="navbar">
        <div class="container nav-container">
          <a class="nav-logo" href="${basePrefix}index.html">
            <img src="${basePrefix}assets/img/logo.png" alt="Deetech Computers" class="logo-image" />
          </a>

          <ul class="nav-menu">
            <li><a class="nav-link ${path.includes('index.html') ? "active" : ""}" href="${basePrefix}index.html">Home</a></li>
            <li><a class="nav-link ${path.includes('products.html') ? "active" : ""}" href="${basePrefix}products.html">Products</a></li>
            <li><a class="nav-link ${path.includes('about.html') ? "active" : ""}" href="${basePrefix}about.html">About</a></li>
            <li><a class="nav-link ${path.includes('contact.html') ? "active" : ""}" href="${basePrefix}contact.html">Support</a></li>
            <li><a class="nav-link ${path.includes('affiliates.html') ? "active" : ""}" href="${basePrefix}affiliates.html">Affiliates</a></li>
          </ul>

          <div class="nav-icons">
            ${!isProductsPage ? `
            <button class="nav-icon search-toggle" aria-label="Search">
              <img class="icon-img" src="${basePrefix}assets/img/icons/search.png" alt="" />
            </button>` : ""}

            <a class="nav-icon wishlist-link ${path.includes('wishlist.html') ? "active" : ""}" href="${basePrefix}wishlist.html" aria-label="Wishlist">
              <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span class="icon-badge" id="wishlistCount">0</span>
            </a>

            <a class="nav-icon cart-link" href="${basePrefix}cart.html" aria-label="Cart">
              <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h2l2.2 9.2a1 1 0 0 0 1 .8H18a1 1 0 0 0 1-.76L21 8H8"></path><circle cx="10" cy="19" r="1.6"></circle><circle cx="17" cy="19" r="1.6"></circle></svg>
              <span class="icon-badge" id="cartCount">0</span>
            </a>

            <div class="user-dropdown" id="userDropdownWrap">
              <button class="nav-icon user-toggle" aria-label="Account">
                <img class="icon-img" src="${basePrefix}assets/img/icons/user.png" alt="" />
              </button>
              <div class="dropdown-menu" id="userDropdown">
                <div class="dropdown-user-info" id="dropdownUserEmail"></div>
                <a href="${basePrefix}account.html" class="dropdown-item auth-only">My Account</a>
                <a href="${basePrefix}orders.html" class="dropdown-item auth-only">Orders</a>
                <a href="${basePrefix}wishlist.html" class="dropdown-item auth-only">Wishlist</a>
                <a href="${adminPrefix}admin.html" class="dropdown-item admin-only">Admin Dashboard</a>
                <button class="dropdown-item logout" id="logoutBtn">Logout</button>
              </div>
            </div>
            <a class="nav-icon account-link" id="loginIcon" href="${basePrefix}login.html" aria-label="Login">
              <img class="icon-img" src="${basePrefix}assets/img/icons/user.png" alt="" />
            </a>

            <button class="mobile-hamburger" aria-label="Menu">
              <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path></svg>
            </button>
          </div>

          <div class="mobile-nav-icons">
            ${!isProductsPage ? `
            <button class="mobile-search-icon" aria-label="Search">
              <img class="icon-img" src="${basePrefix}assets/img/icons/search.png" alt="" />
            </button>` : ""}
            <button class="mobile-hamburger" aria-label="Menu">
              <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path></svg>
            </button>
          </div>
        </div>

        ${!isProductsPage ? `
        <div class="search-overlay" id="searchOverlay">
          <div class="search-container search-container-pill">
            <div class="search-input-wrapper pill-input">
              <input id="searchInput" class="search-input" type="text" placeholder="Search" />
              <button id="searchClear" class="search-clear-btn" type="button" aria-label="Clear search">&times;</button>
              <button id="searchGo" class="search-icon-btn" type="button" aria-label="Search">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </button>
            </div>
            <button id="searchClose" class="search-close-x" type="button" aria-label="Close search">&times;</button>
          </div>
          <div class="search-suggestions-panel" id="searchSuggestionsPanel">
            <div class="search-suggestions-section" id="searchSuggestionsBlock">
              <div class="search-suggestions-title">Suggestions</div>
              <div class="search-suggestions-list" id="searchSuggestionsList"></div>
            </div>
            <div class="search-suggestions-section" id="searchProductsBlock">
              <div class="search-suggestions-title">Products</div>
              <div class="search-products-list" id="searchProductsList"></div>
            </div>
          </div>
        </div>` : ""}
      </nav>

      <div class="mobile-menu-overlay" id="mobileMenu">
        <div class="mobile-menu-content" role="dialog" aria-modal="true" aria-label="Mobile menu">
          <button class="mobile-menu-close" id="mobileMenuClose" type="button" aria-label="Close menu">
            <img class="icon-img" src="${basePrefix}assets/img/icons/x.png" alt="" />
          </button>
          <div class="mobile-menu-header">
            <a class="mobile-profile-card" href="${basePrefix}account.html">
              <div class="mobile-profile-left">
                <img class="mobile-profile-avatar" src="${basePrefix}assets/img/logo.png" alt="Deetech logo" />
                <div class="mobile-profile-text">
                  <span class="mobile-profile-name" id="mobileProfileName">Deetech Guest</span>
                  <span class="mobile-profile-email" id="mobileUserEmail">Guest</span>
                </div>
              </div>
            </a>
            <a href="${basePrefix}login.html" class="mobile-login-btn" id="mobileLoginBtn">Login</a>
          </div>

          <div class="mobile-menu-sections">
            <div class="mobile-menu-grid" id="mobileCategoryGrid"></div>

            <div class="mobile-menu-items">
              <a class="mobile-menu-item ${path.includes('contact.html') ? "active" : ""}" href="${basePrefix}contact.html">
                <img class="mobile-menu-item-icon" src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/question-circle.svg" alt="" />
                Support
              </a>
              <a class="mobile-menu-item ${path.includes('about.html') ? "active" : ""}" href="${basePrefix}about.html">
                <img class="mobile-menu-item-icon" src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/info-circle.svg" alt="" />
                About
              </a>
              <a class="mobile-menu-item ${path.includes('affiliates.html') ? "active" : ""}" href="${basePrefix}affiliates.html">
                <img class="mobile-menu-item-icon" src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/cash-coin.svg" alt="" />
                Affiliates
              </a>
              <a class="mobile-menu-item auth-only ${path.includes('wishlist.html') ? "active" : ""}" href="${basePrefix}wishlist.html">
                <span class="mobile-menu-item-icon mobile-menu-item-icon--wishlist">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  <span class="mobile-wishlist-badge" id="mobileWishlistCount">0</span>
                </span>
                Wishlist
              </a>
              <a class="mobile-menu-item admin-only" href="${adminPrefix}admin.html">
                <img class="mobile-menu-item-icon" src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/shield-lock.svg" alt="" />
                Admin Dashboard
              </a>
              <button class="mobile-menu-item logout auth-only" id="mobileLogoutBtn" type="button">
                <img class="mobile-menu-item-icon" src="${basePrefix}assets/img/icons/x.png" alt="" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire navbar UI
    const dropdown = header.querySelector("#userDropdown");
    const userToggle = header.querySelector(".user-toggle");
    const userWrap = header.querySelector("#userDropdownWrap");
    const loginIcon = header.querySelector("#loginIcon");
    const hamburgers = header.querySelectorAll(".mobile-hamburger");
    const mobileSearchBtn = header.querySelector(".mobile-search-icon");
    const mobileMenu = header.querySelector("#mobileMenu");
    const searchOverlay = header.querySelector("#searchOverlay");
    const searchToggle = header.querySelector(".search-toggle");
    const searchInput = header.querySelector("#searchInput");
    const searchGo = header.querySelector("#searchGo");
    const searchClose = header.querySelector("#searchClose");
    const searchClear = header.querySelector("#searchClear");
    const suggestionsPanel = header.querySelector("#searchSuggestionsPanel");
    const suggestionsList = header.querySelector("#searchSuggestionsList");
    const productsList = header.querySelector("#searchProductsList");
    const suggestionsBlock = header.querySelector("#searchSuggestionsBlock");
    const productsBlock = header.querySelector("#searchProductsBlock");

    if (userToggle && dropdown) {
      userToggle.addEventListener("click", () => {
        dropdown.classList.toggle("open");
      });
      document.addEventListener("click", (e) => {
        if (!userToggle.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.remove("open");
        }
      });
    }

    if (hamburgers.length && mobileMenu) {
      const setMobileMenuState = (isOpen) => {
        mobileMenu.classList.toggle("active", isOpen);
        document.body.classList.toggle("mobile-menu-open", isOpen);
      };
      hamburgers.forEach((btn) => {
        btn.addEventListener("click", () => {
          setMobileMenuState(!mobileMenu.classList.contains("active"));
        });
      });
      const mobileMenuClose = header.querySelector("#mobileMenuClose");
      if (mobileMenuClose) {
        mobileMenuClose.addEventListener("click", () => setMobileMenuState(false));
      }
      mobileMenu.addEventListener("click", (e) => {
        if (e.target === mobileMenu) setMobileMenuState(false);
      });
    }

    if (searchToggle && searchOverlay) {
      searchToggle.addEventListener("click", () => {
        searchOverlay.classList.add("active");
        if (searchInput) searchInput.focus();
        if (suggestionsPanel) suggestionsPanel.classList.remove("active");
      });
    }
    if (mobileSearchBtn && searchOverlay) {
      mobileSearchBtn.addEventListener("click", () => {
        searchOverlay.classList.add("active");
        if (searchInput) searchInput.focus();
        if (suggestionsPanel) suggestionsPanel.classList.remove("active");
      });
    }
    if (searchClose && searchOverlay) {
      searchClose.addEventListener("click", () => {
        searchOverlay.classList.remove("active");
        if (suggestionsPanel) suggestionsPanel.classList.remove("active");
      });
    }

    // Close search when user clicks/taps outside the search UI.
    if (searchOverlay) {
      document.addEventListener("click", (e) => {
        if (!searchOverlay.classList.contains("active")) return;
        const clickedInsideOverlay = searchOverlay.contains(e.target);
        const clickedSearchToggle = searchToggle && searchToggle.contains(e.target);
        const clickedMobileSearch = mobileSearchBtn && mobileSearchBtn.contains(e.target);
        if (!clickedInsideOverlay && !clickedSearchToggle && !clickedMobileSearch) {
          searchOverlay.classList.remove("active");
          if (suggestionsPanel) suggestionsPanel.classList.remove("active");
        }
      });
    }
    let searchProductsCache = null;
    let searchFetchInFlight = null;
    const SEARCH_MIN_CHARS = 2;
    const SEARCH_RESULTS_LIMIT = 6;
    const SEARCH_PRODUCTS_LIMIT = 4;

    const resolveSearchImage = (src) => {
      if (!src) return "assets/img/placeholder.png";
      if (/^(https?:|data:)/i.test(src)) return src;
      if (src.startsWith("/uploads") || src.startsWith("uploads/")) {
        return `${window.CONFIG?.BASE_URL || ""}${src.startsWith("/") ? "" : "/"}${src}`;
      }
      return src;
    };

    const fetchSearchProducts = async () => {
      if (Array.isArray(searchProductsCache)) return searchProductsCache;
      if (searchFetchInFlight) return searchFetchInFlight;
      const endpoint =
        window.CONFIG?.API_BASE_PRODUCTS ||
        (API_BASE ? `${API_BASE}/products` : null);
      if (!endpoint) return [];
      searchFetchInFlight = fetch(endpoint)
        .then((res) => res.json())
        .then((data) => {
          const items = Array.isArray(data) ? data : Array.isArray(data.products) ? data.products : [];
          searchProductsCache = items;
          return items;
        })
        .catch(() => []);
      return searchFetchInFlight;
    };

    const buildSuggestions = (query, products) => {
      const q = query.toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);
      const suggestions = new Set();
      const pick = (value) => {
        if (!value) return;
        const v = String(value).trim();
        if (v && v.toLowerCase().includes(q)) suggestions.add(v);
      };
      products.forEach((p) => {
        pick(p.name);
        pick(p.brand);
        pick(p.category);
      });
      const sorted = Array.from(suggestions)
        .filter((s) => terms.every((t) => s.toLowerCase().includes(t)))
        .slice(0, SEARCH_RESULTS_LIMIT);
      return sorted;
    };

    const filterProducts = (query, products) => {
      const q = query.toLowerCase();
      return products
        .filter((p) => {
          const name = String(p.name || "").toLowerCase();
          const brand = String(p.brand || "").toLowerCase();
          const category = String(p.category || "").toLowerCase();
          return name.includes(q) || brand.includes(q) || category.includes(q);
        })
        .slice(0, SEARCH_PRODUCTS_LIMIT);
    };

    const renderSearchPanel = async (query) => {
      if (!suggestionsPanel || !suggestionsList || !productsList || !suggestionsBlock || !productsBlock) return;
      const q = query.trim();
      if (q.length < SEARCH_MIN_CHARS) {
        suggestionsPanel.classList.remove("active");
        return;
      }
      const products = await fetchSearchProducts();
      const suggestions = buildSuggestions(q, products);
      const matches = filterProducts(q, products);

      suggestionsList.innerHTML = suggestions.length
        ? suggestions
            .map((s) => `<button class="search-suggestion-item" type="button" data-value="${s}">${s}</button>`)
            .join("")
        : `<div class="search-empty">No suggestions</div>`;

      productsList.innerHTML = matches.length
        ? matches
            .map((p) => {
              const productId = p._id || p.id;
              const imageSrc = resolveSearchImage((p.images && p.images[0]) || p.image || p.image_url);
              return `
                <a class="search-product-item" href="product.html?id=${encodeURIComponent(productId)}">
                  <img src="${imageSrc}" alt="${p.name}" />
                  <div>
                    <span class="search-product-brand">${p.brand || ""}</span>
                    <span class="search-product-name">${p.name || ""}</span>
                  </div>
                </a>
              `;
            })
            .join("")
        : `<div class="search-empty">No products found</div>`;

      suggestionsBlock.style.display = suggestions.length ? "block" : "none";
      productsBlock.style.display = matches.length ? "block" : "none";
      suggestionsPanel.classList.add("active");
    };

    if (searchGo && searchInput) {
      searchGo.addEventListener("click", () => {
        const q = searchInput.value.trim();
        if (!q) return;
        location.href = `products.html?q=${encodeURIComponent(q)}`;
      });
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") searchGo.click();
      });
    }
    if (searchClear && searchInput) {
      const toggleClear = () => {
        searchClear.classList.toggle("is-visible", !!searchInput.value.trim());
      };
      searchClear.addEventListener("click", () => {
        searchInput.value = "";
        toggleClear();
        searchInput.focus();
        if (suggestionsPanel) suggestionsPanel.classList.remove("active");
      });
      let searchDebounce = null;
      searchInput.addEventListener("input", () => {
        toggleClear();
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          renderSearchPanel(searchInput.value || "");
        }, 200);
      });
      toggleClear();
    }

    if (suggestionsList && searchInput) {
      suggestionsList.addEventListener("click", (e) => {
        const btn = e.target.closest(".search-suggestion-item");
        if (!btn) return;
        const value = btn.dataset.value || "";
        searchInput.value = value;
        searchInput.focus();
        renderSearchPanel(value);
      });
    }
    // Scroll effect
    const navbar = header.querySelector(".navbar");
    if (navbar) {
      const onScroll = () => {
        navbar.classList.toggle("scrolled", window.scrollY > 20);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
  }

  function updateNavbar() {
    const user = getUser();
    const dropdownEmail = document.getElementById("dropdownUserEmail");
    const adminOnly = document.querySelectorAll(".admin-only");
    const authOnly = document.querySelectorAll(".auth-only");
    const userWrap = document.getElementById("userDropdownWrap");
    const loginIcon = document.getElementById("loginIcon");
    const mobileUserEmail = document.getElementById("mobileUserEmail");
    const mobileProfileName = document.getElementById("mobileProfileName");
    const mobileLoginBtn = document.getElementById("mobileLoginBtn");
    if (userWrap && loginIcon) {
      if (user) {
        userWrap.style.display = "block";
        loginIcon.style.display = "none";
      } else {
        userWrap.style.display = "none";
        loginIcon.style.display = "flex";
        loginIcon.href = loginIcon.getAttribute("href") || "login.html";
      }
    }
    if (dropdownEmail) {
      dropdownEmail.textContent = user?.email || "Guest";
    }
    if (mobileUserEmail) {
      mobileUserEmail.textContent = user?.email || "Guest";
    }
    if (mobileProfileName) {
      mobileProfileName.textContent = user?.name || user?.email || "Deetech Guest";
    }
    adminOnly.forEach((el) => {
      if (user?.role === "admin") {
        el.style.display = el.classList.contains("mobile-menu-item") ? "flex" : "block";
      } else {
        el.style.display = "none";
      }
    });
    authOnly.forEach((el) => {
      if (user) {
        el.style.display = el.classList.contains("mobile-menu-item") ? "flex" : "block";
      } else {
        el.style.display = "none";
      }
    });
    if (mobileLoginBtn) {
      mobileLoginBtn.style.display = user ? "none" : "block";
    }

    const cartCountEl = document.getElementById("cartCount");
    if (cartCountEl && typeof window.CONFIG?.loadCart === "function") {
      const cart = window.CONFIG.loadCart() || [];
      const count = cart.reduce((sum, item) => sum + (item.qty || item.quantity || 0), 0);
      cartCountEl.textContent = count;
    }

    const wishlistCountEl = document.getElementById("wishlistCount");
    const mobileWishlistCountEl = document.getElementById("mobileWishlistCount");
    const setWishlistCount = (count) => {
      if (wishlistCountEl) wishlistCountEl.textContent = String(count);
      if (mobileWishlistCountEl) {
        mobileWishlistCountEl.textContent = String(count);
        mobileWishlistCountEl.style.display = count > 0 ? "flex" : "none";
      }
    };

    if (wishlistCountEl || mobileWishlistCountEl) {
      setWishlistCount(0);
      const token = getToken();
      if (token && API_BASE) {
        if (!window.__wishlistState) {
          window.__wishlistState = { inFlight: false, lastFetch: 0 };
        }
        const state = window.__wishlistState;
        const now = Date.now();
        if (state.inFlight || now - state.lastFetch < 3000) return;
        state.inFlight = true;
        state.lastFetch = now;
        fetch(`${API_BASE}/wishlist`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) {
              setWishlistCount(data.length);
            }
          })
          .catch(() => {})
          .finally(() => {
            state.inFlight = false;
          });
      }
    }
  }

  function ensureAffiliateFooterLink() {
    const footerBlocks = Array.from(document.querySelectorAll(".footer .footer-grid > div"));
    if (!footerBlocks.length) return;
    const quickLinksBlock = footerBlocks.find((block) => {
      const h4 = block.querySelector("h4");
      return String(h4?.textContent || "").trim().toLowerCase() === "quick links";
    });
    if (!quickLinksBlock) return;

    const ul = quickLinksBlock.querySelector("ul");
    if (!ul) return;

    const hasAffiliate = Array.from(ul.querySelectorAll("a")).some(
      (a) => String(a.getAttribute("href") || "").toLowerCase().includes("affiliates.html")
    );
    if (hasAffiliate) return;

    const li = document.createElement("li");
    li.innerHTML = `<a href="affiliates.html">Affiliates</a>`;
    ul.appendChild(li);
  }

  async function syncProfile() {
    const token = getToken();
    if (!token) return;
    if (!API_BASE_USERS) return;
    try {
      const res = await fetch(`${API_BASE_USERS}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const user = await res.json();
      if (user && user.email) {
        setUser({
          _id: user._id,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          address: user.address,
          region: user.region,
          city: user.city,
          role: user.role,
        });
      }
    } catch {}
  }

  function canonicalCategory(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v.startsWith("laptop")) return "laptops";
    if (v.startsWith("phone")) return "phones";
    if (v.startsWith("monitor")) return "monitors";
    if (v.startsWith("access")) return "accessories";
    if (v.startsWith("stor")) return "storage";
    if (v.startsWith("print")) return "printers";
    return v || "other";
  }

  const categoryLabels = {
    laptops: "Laptops",
    phones: "Phones",
    monitors: "Monitors",
    accessories: "Accessories",
    storage: "Storage",
    printers: "Printers",
    other: "Other",
  };

  const categoryIconMap = {
    laptops: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/laptop.svg",
    phones: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/phone.svg",
    monitors: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/display.svg",
    accessories: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/headphones.svg",
    storage: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/device-hdd.svg",
    printers: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/printer.svg",
    other: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/grid.svg",
  };

  function loadMobileCategories() {
    const grid = document.getElementById("mobileCategoryGrid");
    if (!grid) return;

    const basePrefix = location.pathname.toLowerCase().includes("/admin/") ? "../" : "";
    const order = ["laptops", "phones", "monitors", "accessories", "storage", "printers"];

    grid.innerHTML = order
      .map((key) => {
        const label = categoryLabels[key] || key;
        const icon = categoryIconMap[key] || categoryIconMap.other;
        return `
          <a class="mobile-menu-tile" href="${basePrefix}products.html?cat=${encodeURIComponent(key)}">
            <img src="${icon}" alt="${label}" />
            <span>${label}</span>
          </a>
        `;
      })
      .join("");
  }

// -----------------------------
// Register
// -----------------------------
function wireRegister() {
  const form = $id("registerForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $id("name").value.trim();
    const email = $id("email").value.trim().toLowerCase();
    const password = $id("password").value;
    const confirmPassword = $id("confirmPassword")?.value;

    if (confirmPassword && password !== confirmPassword) {
      notify("Passwords do not match", "error");
      return;
    }

    try {
      const res = await fetch(`${AUTH_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        const user = data.user || {
          _id: data._id,
          name: data.name,
          email: data.email,
          role: data.role,
        };
        const token = data.token || data?.token;
        setUser(user);
        setToken(token);
        notify("Registration successful! Redirecting...", "success");
        const target = user.role === "admin" ? "Admin/admin.html" : "account.html";
        setTimeout(() => (location.href = target), 1000);
      } else {
        notify(data.message || "Registration failed", "error");
      }
    } catch (err) {
      console.error("Register error:", err);
      notify("Something went wrong. Try again later.", "error");
    }
  });
}

// -----------------------------
// Login
// -----------------------------
function wireLogin() {
  const form = $id("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $id("email").value.trim().toLowerCase();
    const password = $id("password").value;

    try {
      const res = await fetch(`${AUTH_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        const user = data.user || {
          _id: data._id,
          name: data.name,
          email: data.email,
          role: data.role,
        };
        const token = data.token || data?.token;
        setUser(user);
        setToken(token);
        notify("Login successful! Redirecting...", "success");
        const target = user.role === "admin" ? "Admin/admin.html" : "account.html";
        setTimeout(() => (location.href = target), 1000);
      } else {
        notify(data.message || "Login failed", "error");
      }
    } catch (err) {
      console.error("Login error:", err);
      notify("Something went wrong. Try again later.", "error");
    }
  });
}

// -----------------------------
// Password visibility toggle
// -----------------------------
function wirePasswordToggles() {
  const toggles = document.querySelectorAll("[data-password-toggle]");
  if (!toggles.length) return;

  toggles.forEach((btn) => {
    btn.addEventListener("click", () => {
      const selector = btn.getAttribute("data-password-toggle");
      const input = selector ? document.querySelector(selector) : null;
      if (!input) return;

      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      btn.textContent = isHidden ? "Hide" : "Show";
      btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  });
}

// -----------------------------
// Logout
// -----------------------------
function wireLogout() {
  document.body.addEventListener("click", (e) => {
    if (e.target && (e.target.id === "logoutBtn" || e.target.id === "mobileLogoutBtn")) {
      clearUser();
      clearToken();
      notify("Logged out", "info");
      setTimeout(() => (location.href = "index.html"), 800);
    }
  });
}

// -----------------------------
// Auth Guard
// -----------------------------
function guardProtected() {
  const needAuth = document.body.dataset.requireAuth === "true";
  const token = getToken();
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (needAuth && !getUser() && !token && !isOffline) {
    location.href = "login.html";
  }
}

// -----------------------------
// Init
// -----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    renderNavbar();
    renderMobileBottomNav();
    ensureAffiliateFooterLink();
    await syncProfile();
    updateNavbar();
    loadMobileCategories();
    updateMobileBottomNav();
    document.addEventListener("cart-updated", updateNavbar);
    document.addEventListener("cart-updated", updateMobileBottomNav);
    document.addEventListener("wishlist-updated", updateNavbar);
    window.addEventListener("storage", updateMobileBottomNav);
    window.addEventListener("storage", updateNavbar);
    wireRegister();
    wireLogin();
    wirePasswordToggles();
    wireLogout();
    guardProtected();
  });

  // Keep global fallback for non-module scripts
  window.auth = { getUser, setUser, clearUser, getToken, setToken, clearToken };
})();


