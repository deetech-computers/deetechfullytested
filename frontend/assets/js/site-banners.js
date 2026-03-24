// assets/js/site-banners.js
(function () {
  const { API_BASE, BASE_URL } = window.CONFIG || {};
  const host = document.getElementById("heroBanner");
  if (!host || !API_BASE) return;
  const BANNER_STORAGE_KEY = "deetech_banners_cache_v1";
  const API_TIMEOUT_MS = 2500;
  let currentIndex = 0;
  let slides = [];
  let autoSlideTimer = null;
  const AUTO_SLIDE_MS = 4000;

  function resolveImage(src) {
    if (!src) return null;
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
      return src;
    }
    if (src.startsWith("/uploads") || src.startsWith("uploads/")) {
      return `${BASE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
    }
    return src;
  }

  function renderBanner(index) {
    if (!slides.length) return;
    const banner = slides[index];
    const img = resolveImage(banner.imageUrl);
    if (!img) return;

    host.innerHTML = "";
    const link = document.createElement("a");
    link.href = banner.link || "products.html";
    link.className = "hero-link";

    const image = document.createElement("img");
    image.src = img;
    image.alt = banner.title || "Deetech banner";
    image.width = 1600;
    image.height = 600;
    image.decoding = "async";
    image.loading = "eager";
    image.fetchPriority = "high";

    const overlay = document.createElement("div");
    overlay.className = "hero-overlay";
    overlay.innerHTML = `
      <div>
        <h1>${banner.title || "Explore Our Deals"}</h1>
        <p>Discover featured products and offers</p>
        <span class="hero-btn">Click to Explore</span>
      </div>
    `;

    link.appendChild(image);
    link.appendChild(overlay);
    host.appendChild(link);

    if (slides.length > 1) {
      const controls = document.createElement("div");
      controls.className = "hero-controls";
      controls.innerHTML = `
        <button type="button" class="hero-arrow hero-arrow-prev" aria-label="Previous banner">&#8249;</button>
        <span class="hero-indicator">${index + 1}/${slides.length}</span>
        <button type="button" class="hero-arrow hero-arrow-next" aria-label="Next banner">&#8250;</button>
      `;
      host.appendChild(controls);

      controls.querySelector(".hero-arrow-prev")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentIndex = currentIndex === 0 ? slides.length - 1 : currentIndex - 1;
        renderBanner(currentIndex);
        startAutoSlide();
      });

      controls.querySelector(".hero-arrow-next")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentIndex = currentIndex === slides.length - 1 ? 0 : currentIndex + 1;
        renderBanner(currentIndex);
        startAutoSlide();
      });
    }
  }

  function renderFallbackBanner() {
    const defaultBanner = {
      link: "products.html",
      title: "Deetech Deals",
      imageUrl: "assets/img/placeholder.svg",
    };
    slides = [defaultBanner];
    currentIndex = 0;
    renderBanner(currentIndex);
  }

  function readBannerCache() {
    try {
      const raw = localStorage.getItem(BANNER_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeBannerCache(banners) {
    try {
      localStorage.setItem(BANNER_STORAGE_KEY, JSON.stringify(banners || []));
    } catch {}
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

  function startAutoSlide() {
    if (autoSlideTimer) clearInterval(autoSlideTimer);
    if (slides.length <= 1) return;
    autoSlideTimer = setInterval(() => {
      currentIndex = currentIndex === slides.length - 1 ? 0 : currentIndex + 1;
      renderBanner(currentIndex);
    }, AUTO_SLIDE_MS);
  }

  async function loadBanner() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/banners`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const banners = await res.json();
      if (!Array.isArray(banners) || banners.length === 0) throw new Error("No banners");

      slides = banners
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .filter((b) => !!resolveImage(b.imageUrl));
      if (!slides.length) throw new Error("No valid banners");

      writeBannerCache(slides);

      currentIndex = 0;
      renderBanner(currentIndex);
      startAutoSlide();
    } catch (err) {
      console.warn("Banner load failed:", err);
      const cachedBanners = readBannerCache().filter((b) => !!resolveImage(b?.imageUrl));
      if (cachedBanners.length) {
        slides = cachedBanners;
        currentIndex = 0;
        renderBanner(currentIndex);
        startAutoSlide();
        return;
      }
      renderFallbackBanner();
    }
  }

  const cachedBanners = readBannerCache().filter((b) => !!resolveImage(b?.imageUrl));
  if (cachedBanners.length) {
    slides = cachedBanners;
    currentIndex = 0;
    renderBanner(currentIndex);
    startAutoSlide();
  } else {
    renderFallbackBanner();
  }

  loadBanner();
})();



