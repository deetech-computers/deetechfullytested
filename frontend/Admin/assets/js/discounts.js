(async function () {
  const { requireAdmin, apiFetch, API_BASE, toast } = window.AdminAPI || {};
  if (!requireAdmin || !(await requireAdmin())) return;

  const form = document.getElementById("discountForm");
  const tbody = document.querySelector("#discountsTable tbody");
  const mobileList = document.getElementById("discountsMobileList");
  const newCodes = document.getElementById("newCodes");
  const emptyState = document.getElementById("discountsEmptyState");

  const totalCodesEl = document.getElementById("summaryTotalCodes");
  const usedCodesEl = document.getElementById("summaryUsedCodes");
  const unusedCodesEl = document.getElementById("summaryUnusedCodes");
  const avgPercentEl = document.getElementById("summaryAvgPercent");

  const searchInput = document.getElementById("discountSearch");
  const usageFilter = document.getElementById("discountUsageFilter");
  const reloadBtn = document.getElementById("discountReloadBtn");

  let allDiscounts = [];

  function formatDate(v) {
    const d = v ? new Date(v) : null;
    if (!d || Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  }

  function usageLabel(isUsed) {
    return isUsed
      ? '<span class="used-chip yes">Used</span>'
      : '<span class="used-chip no">Unused</span>';
  }

  function renderSummary(list) {
    const total = list.length;
    const used = list.filter((item) => Boolean(item.used)).length;
    const unused = Math.max(total - used, 0);
    const avg = total > 0
      ? Math.round((list.reduce((sum, item) => sum + Number(item.percent || 0), 0) / total) * 10) / 10
      : 0;

    if (totalCodesEl) totalCodesEl.textContent = String(total);
    if (usedCodesEl) usedCodesEl.textContent = String(used);
    if (unusedCodesEl) unusedCodesEl.textContent = String(unused);
    if (avgPercentEl) avgPercentEl.textContent = `${avg}%`;
  }

  function filteredDiscounts() {
    const query = String(searchInput?.value || "").trim().toLowerCase();
    const usage = String(usageFilter?.value || "all");

    return allDiscounts.filter((item) => {
      if (usage === "used" && !item.used) return false;
      if (usage === "unused" && item.used) return false;
      if (!query) return true;
      return String(item.code || "").toLowerCase().includes(query);
    });
  }

  function renderTable(list) {
    if (!tbody) return;
    tbody.innerHTML = "";

    list.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="discount-code">${item.code || "-"}</span></td>
        <td>${Number(item.percent || 0)}%</td>
        <td>${usageLabel(Boolean(item.used))}</td>
        <td>${formatDate(item.createdAt)}</td>
        <td><button type="button" class="discount-action" data-copy-code="${item.code || ""}">Copy</button></td>
      `;
      tbody.appendChild(row);
    });
  }

  function renderMobile(list) {
    if (!mobileList) return;
    mobileList.innerHTML = "";

    list.forEach((item) => {
      const card = document.createElement("article");
      card.className = "discount-card";
      card.innerHTML = `
        <div class="discount-card-row">
          <span class="discount-card-label">Code</span>
          <span class="discount-card-value discount-code">${item.code || "-"}</span>
        </div>
        <div class="discount-card-row">
          <span class="discount-card-label">Percent</span>
          <span class="discount-card-value">${Number(item.percent || 0)}%</span>
        </div>
        <div class="discount-card-row">
          <span class="discount-card-label">Status</span>
          <span class="discount-card-value">${usageLabel(Boolean(item.used))}</span>
        </div>
        <div class="discount-card-row">
          <span class="discount-card-label">Created</span>
          <span class="discount-card-value">${formatDate(item.createdAt)}</span>
        </div>
        <div class="discount-card-actions">
          <button type="button" class="discount-action" data-copy-code="${item.code || ""}">Copy</button>
        </div>
      `;
      mobileList.appendChild(card);
    });
  }

  function render() {
    const list = filteredDiscounts();
    renderTable(list);
    renderMobile(list);
    emptyState?.classList.toggle("hidden", list.length > 0);
  }

  async function loadDiscounts() {
    const response = await apiFetch(`${API_BASE}/admin/discounts`);
    allDiscounts = Array.isArray(response) ? response : [];
    renderSummary(allDiscounts);
    render();
  }

  async function copyCode(code) {
    const value = String(code || "").trim();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      toast?.("Code copied", "success");
    } catch {
      try {
        const helper = document.createElement("textarea");
        helper.value = value;
        helper.setAttribute("readonly", "true");
        helper.style.position = "absolute";
        helper.style.left = "-9999px";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
        toast?.("Code copied", "success");
      } catch {
        toast?.("Copy failed", "error");
      }
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fd = new FormData(form);
    const percent = Number(fd.get("percent"));
    const count = Number(fd.get("count") || 1);

    const payload = { percent, count };
    const res = await apiFetch(`${API_BASE}/admin/discounts`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (Array.isArray(res.codes) && res.codes.length > 0) {
      newCodes.textContent = `New codes: ${res.codes.join(", ")}`;
      newCodes.classList.remove("hidden");
    } else {
      newCodes.textContent = "";
      newCodes.classList.add("hidden");
    }

    toast?.("Discount codes generated", "success");
    form.reset();
    await loadDiscounts();
  });

  searchInput?.addEventListener("input", render);
  usageFilter?.addEventListener("change", render);
  reloadBtn?.addEventListener("click", async () => {
    await loadDiscounts();
    toast?.("Discount list refreshed", "success");
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const code = target.getAttribute("data-copy-code");
    if (!code) return;
    copyCode(code);
  });

  loadDiscounts().catch((error) => {
    console.error(error);
    toast?.("Failed to load discount codes", "error");
  });
})();
