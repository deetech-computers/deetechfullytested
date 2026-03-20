document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("faqSearch");
  const categoryButtons = document.querySelectorAll(".faq-category");
  const faqItems = [...document.querySelectorAll(".faq-item")];
  const countEl = document.getElementById("faqCount");
  let activeCategory = "all";

  if (!searchInput || !countEl || !faqItems.length) return;

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    faqItems.forEach((item) => {
      const cat = item.dataset.category;
      const q = item.querySelector(".faq-question")?.textContent.toLowerCase() || "";
      const a = item.querySelector(".faq-answer")?.textContent.toLowerCase() || "";
      const categoryMatch = activeCategory === "all" || cat === activeCategory;
      const searchMatch = !query || q.includes(query) || a.includes(query);
      const show = categoryMatch && searchMatch;
      item.style.display = show ? "" : "none";
      if (show) visibleCount += 1;
    });

    countEl.textContent = visibleCount + (visibleCount === 1 ? " question found" : " questions found");
  }

  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      categoryButtons.forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      activeCategory = btn.dataset.category;
      applyFilters();
    });
  });

  searchInput.addEventListener("input", applyFilters);

  document.querySelectorAll(".faq-question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      if (item) item.classList.toggle("open");
    });
  });

  applyFilters();
});
