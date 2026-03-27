(function () {
  const { API_BASE, BASE_URL, showToast } = window.CONFIG || {};
  const API_TIMEOUT_MS = 8000;

  async function fetchWithTimeout(resource, options = {}, timeoutMs = API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(resource, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  function ensureAdminConfirmStyles() {
    if (document.getElementById("adminConfirmStyles")) return;
    const style = document.createElement("style");
    style.id = "adminConfirmStyles";
    style.textContent = `
      .admin-confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(2, 6, 23, 0.56);
        z-index: 1400;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .admin-confirm-card {
        width: min(460px, 96vw);
        background: #fff;
        border-radius: 14px;
        border: 1px solid #dbe2ef;
        box-shadow: 0 18px 44px rgba(15, 23, 42, 0.24);
        padding: 16px;
      }
      .admin-confirm-card h3 {
        margin: 0 0 8px;
        color: #0f172a;
      }
      .admin-confirm-card p {
        margin: 0;
        color: #334155;
        white-space: pre-line;
      }
      .admin-confirm-actions {
        margin-top: 14px;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      .admin-confirm-btn {
        border: 1px solid #d4dbe8;
        background: #fff;
        color: #0f172a;
        border-radius: 10px;
        padding: 8px 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .admin-confirm-btn.danger {
        background: #b91c1c;
        color: #fff;
        border-color: #b91c1c;
      }
    `;
    document.head.appendChild(style);
  }

  function confirmAction(message, opts = {}) {
    return new Promise((resolve) => {
      const title = String(opts.title || "Please Confirm");
      const confirmText = String(opts.confirmText || "Confirm");
      const cancelText = String(opts.cancelText || "Cancel");

      ensureAdminConfirmStyles();
      const overlay = document.createElement("div");
      overlay.className = "admin-confirm-overlay";
      overlay.innerHTML = `
        <div class="admin-confirm-card" role="dialog" aria-modal="true" aria-label="${title}">
          <h3>${title}</h3>
          <p>${String(message || "")}</p>
          <div class="admin-confirm-actions">
            <button type="button" class="admin-confirm-btn" data-admin-confirm-cancel>${cancelText}</button>
            <button type="button" class="admin-confirm-btn danger" data-admin-confirm-ok>${confirmText}</button>
          </div>
        </div>
      `;

      const cleanup = (value) => {
        overlay.remove();
        resolve(Boolean(value));
      };

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) cleanup(false);
      });

      overlay.querySelector("[data-admin-confirm-cancel]")?.addEventListener("click", () => cleanup(false));
      overlay.querySelector("[data-admin-confirm-ok]")?.addEventListener("click", () => cleanup(true));

      const onKeyDown = (e) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", onKeyDown);
          cleanup(false);
        }
      };
      document.addEventListener("keydown", onKeyDown, { once: true });
      document.body.appendChild(overlay);
    });
  }

  function setActiveAdminNav() {
    try {
      const current = (window.location.pathname.split("/").pop() || "").toLowerCase();
      document.querySelectorAll(".admin-nav a").forEach((link) => {
        const href = String(link.getAttribute("href") || "").toLowerCase();
        if (href === current) {
          link.classList.add("active");
          link.setAttribute("aria-current", "page");
        }
      });
    } catch {}
  }
  function enhanceAdminShell() {
    const shell = document.querySelector(".admin-shell");
    const nav = document.querySelector(".admin-nav");
    const header = document.querySelector(".admin-header");
    if (!shell || !nav || !header) return;

    document.body.classList.add("admin-portal");

    if (!nav.querySelector(".admin-brand")) {
      const brand = document.createElement("div");
      brand.className = "admin-brand";
      brand.innerHTML = `
        <a href="index.html" class="admin-brand-link" aria-label="Deetech Admin Dashboard">
          <span class="admin-brand-mark">D</span>
          <span class="admin-brand-text-wrap">
            <span class="admin-brand-text">DEETECH</span>
            <span class="admin-brand-subtext">Admin Portal</span>
          </span>
        </a>
      `;
      nav.prepend(brand);
    }

    if (!header.querySelector(".admin-nav-toggle")) {
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "admin-nav-toggle";
      toggleBtn.setAttribute("aria-label", "Open admin menu");
      toggleBtn.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
      `;
      header.prepend(toggleBtn);
    }

    let backdrop = document.querySelector(".admin-nav-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "admin-nav-backdrop";
      backdrop.setAttribute("aria-label", "Close admin menu");
      document.body.appendChild(backdrop);
    }

    const closeNav = () => document.body.classList.remove("admin-nav-open");
    const toggleNav = () => document.body.classList.toggle("admin-nav-open");

    header.querySelector(".admin-nav-toggle")?.addEventListener("click", toggleNav);
    backdrop.addEventListener("click", closeNav);

    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 1023px)").matches) closeNav();
      });
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 1023) closeNav();
    });
  }
  async function requireAdmin() {
    let user = window.auth?.getUser?.();
    if (user && user.role === "admin") return true;

    const token = window.auth?.getToken?.();
    if (token && API_BASE) {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          user = await res.json();
          if (user && user.email) {
            window.auth?.setUser?.({
              _id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
            });
            if (user.role === "admin") return true;
          }
        }

        if (res.status === 401 || res.status === 403) {
          window.location.href = "../login.html";
          return false;
        }
      } catch (err) {
        const msg =
          err?.name === "AbortError"
            ? "Admin verification is taking too long. Please try again."
            : navigator.onLine === false
              ? "You appear to be offline. Reconnect to access the admin area."
              : "Could not verify your admin session right now. Please try again.";
        if (showToast) showToast(msg, "error");
        return false;
      }
    }

    window.location.href = "../login.html";
    return false;
  }

  async function apiFetch(url, options = {}) {
    const token = window.auth?.getToken?.();
    const headers = { ...(options.headers || {}) };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let res;
    try {
      res = await fetchWithTimeout(url, { ...options, headers });
    } catch (err) {
      const msg =
        err?.name === "AbortError"
          ? "Request timed out. Render may be waking up. Please try again."
          : navigator.onLine === false
            ? "You appear to be offline. Please reconnect and try again."
            : "Could not reach the server right now. Please try again.";
      if (showToast) showToast(msg, "error");
      throw new Error(msg);
    }

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = data.message || data.raw || "Request failed";
      if (showToast) showToast(msg, "error");
      throw new Error(msg);
    }
    return data;
  }

  window.AdminAPI = {
    API_BASE,
    BASE_URL,
    requireAdmin,
    apiFetch,
    toast: showToast,
    confirmAction,
  };

  setActiveAdminNav();
  enhanceAdminShell();
})();

