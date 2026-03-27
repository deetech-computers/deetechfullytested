(function () {
  const { API_BASE, showToast } = window.CONFIG || {};
  const { getToken } = window.auth || {};

  const DEFAULT_THRESHOLDS = { bronze: 8, silver: 18, gold: 35 };

  const els = {
    guestCard: document.getElementById("affiliateGuestCard"),
    joinCard: document.getElementById("affiliateJoinCard"),
    dashboardCard: document.getElementById("affiliateDashboardCard"),
    infoBlocks: document.getElementById("affiliateInfoBlocks"),
    registerBtn: document.getElementById("affiliateRegisterBtn"),
    joinMessage: document.getElementById("affiliateJoinMessage"),
    copyCodeBtn: document.getElementById("affiliateCopyCodeBtn"),
    codeValue: document.getElementById("affiliateCodeValue"),
    tierValue: document.getElementById("affiliateTierValue"),
    tierHint: document.getElementById("affiliateTierHint"),
    commissionPoint: document.getElementById("affiliateCommissionPoint"),
    thresholdPoint: document.getElementById("affiliateThresholdPoint"),
    totalReferrals: document.getElementById("affiliateTotalReferrals"),
    pendingReferrals: document.getElementById("affiliatePendingReferrals"),
    deliveredReferrals: document.getElementById("affiliateDeliveredReferrals"),
    cancelledReferrals: document.getElementById("affiliateCancelledReferrals"),
    pendingCommission: document.getElementById("affiliatePendingCommission"),
    earnedCommission: document.getElementById("affiliateEarnedCommission"),
    statusChart: document.getElementById("affiliateStatusChart"),
    monthlyChart: document.getElementById("affiliateMonthlyChart"),
    historyBody: document.querySelector("#affiliateHistoryTable tbody"),
    emptyHistory: document.getElementById("affiliateEmptyHistory"),
  };

  let currentCode = "";

  function money(v) {
    return `GHC ${Number(v || 0).toFixed(2)}`;
  }

  function text(v) {
    return String(v ?? "").trim();
  }

  function formatDate(v) {
    const d = v ? new Date(v) : null;
    if (!d || Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  }

  function statusLabel(status) {
    if (status === "earned") return "Earned";
    if (status === "cancelled") return "Cancelled";
    return "Pending";
  }

  function tierLabel(tier) {
    const t = String(tier || "starter").toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function tierProgressHint(deliveredReferrals, thresholds = DEFAULT_THRESHOLDS) {
    const count = Number(deliveredReferrals || 0);
    const bronze = Number(thresholds?.bronze || DEFAULT_THRESHOLDS.bronze);
    const silver = Number(thresholds?.silver || DEFAULT_THRESHOLDS.silver);
    const gold = Number(thresholds?.gold || DEFAULT_THRESHOLDS.gold);

    if (count >= gold) return "Gold tier unlocked. Keep scaling deals.";
    if (count >= silver) return `Need ${gold - count} more delivered deals for Gold tier.`;
    if (count >= bronze) return `Need ${silver - count} more delivered deals for Silver tier.`;
    return `Need ${bronze - count} delivered deals for Bronze tier.`;
  }

  function updateProgramPoints(settings) {
    const rate = Number(settings?.defaultCommissionRate || 5);
    const thresholds = settings?.tierThresholds || DEFAULT_THRESHOLDS;
    if (els.commissionPoint) {
      els.commissionPoint.textContent = `${rate}% commission base rate`;
    }
    if (els.thresholdPoint) {
      els.thresholdPoint.textContent = `Deals to tier up: Bronze ${thresholds.bronze}, Silver ${thresholds.silver}, Gold ${thresholds.gold}`;
    }
  }

  function monthKeyFromDate(value) {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function formatMonthLabel(key) {
    if (!key) return "-";
    const [y, m] = String(key).split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }

  function buildMonthlyCommissionRows(referrals, maxMonths = 6) {
    const map = new Map();
    (Array.isArray(referrals) ? referrals : []).forEach((ref) => {
      const key = monthKeyFromDate(ref.createdAt);
      if (!key) return;
      const earned = text(ref.status).toLowerCase() === "earned";
      const prev = Number(map.get(key) || 0);
      map.set(key, prev + (earned ? Number(ref.commissionAmount || 0) : 0));
    });

    return [...map.entries()]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .slice(-maxMonths)
      .map(([key, value]) => ({ label: formatMonthLabel(key), value }));
  }

  function renderMiniChart(container, rows, valueFormatter = (v) => String(v)) {
    if (!container) return;
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
      container.innerHTML = `<p class="affiliate-empty-history">No analytics data yet.</p>`;
      return;
    }
    const max = Math.max(...safeRows.map((r) => Number(r.value || 0)), 1);
    container.innerHTML = safeRows
      .map((row) => {
        const value = Number(row.value || 0);
        const pct = Math.max(0, Math.min(100, (value / max) * 100));
        return `
          <div class="mini-chart-row">
            <span class="mini-chart-label">${row.label}</span>
            <div class="mini-chart-track">
              <div class="mini-chart-bar" style="width:${pct}%"></div>
            </div>
            <span class="mini-chart-value">${valueFormatter(value)}</span>
          </div>
        `;
      })
      .join("");
  }

  async function apiFetch(url, options = {}) {
    const token = typeof getToken === "function" ? getToken() : null;
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });
    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { message: raw };
    }

    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  function renderHistory(referrals) {
    if (!els.historyBody || !els.emptyHistory) return;
    const list = Array.isArray(referrals) ? referrals : [];
    els.historyBody.innerHTML = "";

    if (!list.length) {
      els.emptyHistory.classList.remove("affiliate-hidden");
      return;
    }
    els.emptyHistory.classList.add("affiliate-hidden");

    list.forEach((ref) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>#${text(ref.order?._id || ref.order || "").slice(-8).toUpperCase() || "-"}</td>
        <td>${text(ref.customerName) || "-"}</td>
        <td>${money(ref.orderAmount)}</td>
        <td>${money(ref.commissionAmount)}</td>
        <td><span class="affiliate-status-chip ${text(ref.status).toLowerCase()}">${statusLabel(ref.status)}</span></td>
        <td>${formatDate(ref.createdAt)}</td>
      `;
      els.historyBody.appendChild(tr);
    });
  }

  function showGuestState() {
    if (els.infoBlocks) els.infoBlocks.style.display = "";
    els.guestCard?.classList.remove("affiliate-hidden");
    els.joinCard?.classList.add("affiliate-hidden");
    els.dashboardCard?.classList.add("affiliate-hidden");
  }

  function showJoinState() {
    if (els.infoBlocks) els.infoBlocks.style.display = "none";
    els.guestCard?.classList.add("affiliate-hidden");
    els.joinCard?.classList.remove("affiliate-hidden");
    els.dashboardCard?.classList.add("affiliate-hidden");
  }

  function showDashboardState() {
    if (els.infoBlocks) els.infoBlocks.style.display = "none";
    els.guestCard?.classList.add("affiliate-hidden");
    els.joinCard?.classList.add("affiliate-hidden");
    els.dashboardCard?.classList.remove("affiliate-hidden");
  }

  function renderAnalytics(stats, referrals) {
    renderMiniChart(
      els.statusChart,
      [
        { label: "Pending", value: Number(stats.pendingReferrals || 0) },
        { label: "Earned", value: Number(stats.deliveredReferrals || 0) },
        { label: "Cancelled", value: Number(stats.cancelledReferrals || 0) },
      ],
      (v) => String(v)
    );

    renderMiniChart(
      els.monthlyChart,
      buildMonthlyCommissionRows(referrals, 6),
      (v) => money(v)
    );
  }

  function renderDashboard(data) {
    const affiliate = data?.affiliate || {};
    const stats = data?.stats || {};
    const settings = data?.settings || null;
    const thresholds = settings?.tierThresholds || DEFAULT_THRESHOLDS;
    const referrals = data?.referrals || [];

    updateProgramPoints(settings);
    currentCode = text(affiliate.code);
    if (els.codeValue) els.codeValue.textContent = currentCode || "-";
    if (els.tierValue) els.tierValue.textContent = tierLabel(affiliate.tier);
    if (els.tierHint) {
      els.tierHint.textContent = tierProgressHint(stats.deliveredReferrals, thresholds);
    }

    if (els.totalReferrals) els.totalReferrals.textContent = String(stats.totalReferrals || 0);
    if (els.pendingReferrals) els.pendingReferrals.textContent = String(stats.pendingReferrals || 0);
    if (els.deliveredReferrals) els.deliveredReferrals.textContent = String(stats.deliveredReferrals || 0);
    if (els.cancelledReferrals) els.cancelledReferrals.textContent = String(stats.cancelledReferrals || 0);
    if (els.pendingCommission) els.pendingCommission.textContent = money(stats.pendingCommission);
    if (els.earnedCommission) els.earnedCommission.textContent = money(stats.earnedCommission);

    renderAnalytics(stats, referrals);
    renderHistory(referrals);
    showDashboardState();
  }

  async function loadProgramSettingsForGuests() {
    try {
      const settings = await apiFetch(`${API_BASE}/affiliates/settings`);
      updateProgramPoints(settings);
    } catch (error) {
      console.warn("Affiliate settings load failed:", error);
    }
  }

  async function loadProfile() {
    const token = typeof getToken === "function" ? getToken() : null;
    if (!token) {
      showGuestState();
      await loadProgramSettingsForGuests();
      return;
    }

    try {
      const data = await apiFetch(`${API_BASE}/affiliates/me`);
      if (!data?.isAffiliate) {
        showJoinState();
        updateProgramPoints(data?.settings || null);
        return;
      }
      renderDashboard(data);
    } catch (error) {
      console.error(error);
      showToast?.(error.message || "Failed to load affiliate data", "error");
    }
  }

  async function registerAffiliate() {
    if (!els.registerBtn) return;
    els.registerBtn.disabled = true;
    try {
      await apiFetch(`${API_BASE}/affiliates/register`, { method: "POST" });
      if (els.joinMessage) els.joinMessage.textContent = "Affiliate code created successfully.";
      showToast?.("Affiliate account activated", "success");
      await loadProfile();
    } catch (error) {
      console.error(error);
      if (els.joinMessage) els.joinMessage.textContent = error.message || "Registration failed.";
      showToast?.(error.message || "Registration failed", "error");
    } finally {
      els.registerBtn.disabled = false;
    }
  }

  async function copyCode() {
    const notify = (message, type = "info") => {
      if (typeof window?.CONFIG?.showToast === "function") return window.CONFIG.showToast(message, type);
      if (typeof window?.showToast === "function") return window.showToast(message, type);
      console.log(`[${String(type).toUpperCase()}] ${message}`);
    };

    const codeFromState = text(currentCode);
    const codeFromData = text(els.copyCodeBtn?.dataset?.code || "");
    const codeFromUi = text(els.codeValue?.textContent || "");
    const code = [codeFromState, codeFromData, codeFromUi].find((v) => v && v !== "-") || "";

    if (!code) {
      notify("Affiliate code is not available yet.", "info");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const input = document.createElement("input");
        input.value = code;
        document.body.appendChild(input);
        input.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(input);
        if (!ok) throw new Error("copy-command-failed");
      }
      notify("Affiliate code copied", "success");
    } catch (error) {
      console.error(error);
      notify("Could not copy code", "error");
    }
  }

  function initFaqAccordion() {
    const items = document.querySelectorAll(".affiliate-faq-item");
    if (!items.length) return;

    items.forEach((button) => {
      button.addEventListener("click", () => {
        const isOpen = button.classList.contains("is-open");
        button.classList.toggle("is-open");
        button.setAttribute("aria-expanded", isOpen ? "false" : "true");
      });
    });
  }

  els.registerBtn?.addEventListener("click", registerAffiliate);
  els.copyCodeBtn?.addEventListener("click", copyCode);

  document.addEventListener("DOMContentLoaded", () => {
    initFaqAccordion();
    loadProfile();
  });
})();
