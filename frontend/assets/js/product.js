// assets/js/product.js
document.addEventListener("DOMContentLoaded", () => {
  const { API_BASE_PRODUCTS, BASE_URL, loadCart, saveCart, showToast } = window.CONFIG || {};
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

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  const page = document.querySelector(".product-page");

  const cartCountEl = document.getElementById("headerCartCount");
  const cartTotalEl = document.getElementById("headerCartTotal");
  const searchInput = document.getElementById("searchInput") || document.querySelector(".searchbar input");
  const searchForm = searchInput ? searchInput.closest("form") : null;
  const navLinks = document.querySelectorAll(".nav-cat, .nav-cats a");

  function resolveImage(src) {
    if (!src) return PLACEHOLDER_IMAGE;
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return src;
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

  async function loadSnapshotProducts() {
    if (!CAN_FETCH_LOCAL_SNAPSHOT) {
      try {
        const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.length) showOfflineModeNotice();
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return [];
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
    } catch (error) {
      try {
        const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.length) showOfflineModeNotice();
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      console.warn("Snapshot load failed:", error);
      return [];
    }
  }

  async function fetchProductWithFallback(id) {
    try {
      const res = await fetchWithTimeout(`${API_BASE_PRODUCTS}/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || data.message) throw new Error(data?.message || "Product not found");
      try {
        const cache = await loadSnapshotProducts();
        const merged = Array.isArray(cache) ? cache.filter((p) => String(p._id || p.id) !== String(data._id || data.id)) : [];
        merged.unshift(data);
        localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(merged));
      } catch {}
      return data;
    } catch (apiError) {
      const snapshotProducts = await loadSnapshotProducts();
      if (snapshotProducts.length) showOfflineModeNotice();
      const found = snapshotProducts.find((p) => String(p._id || p.id) === String(id));
      if (found) return found;
      throw apiError;
    }
  }

  async function fetchRelatedProductsWithFallback(category) {
    try {
      const relatedRes = await fetchWithTimeout(`${API_BASE_PRODUCTS}?cat=${encodeURIComponent(category)}`);
      if (!relatedRes.ok) throw new Error(`HTTP ${relatedRes.status}`);
      const all = await relatedRes.json();
      return normalizeProductListPayload(all);
    } catch {
      const snapshotProducts = await loadSnapshotProducts();
      if (snapshotProducts.length) showOfflineModeNotice();
      return snapshotProducts;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function starsFromRating(rating) {
    const safe = Math.max(0, Math.min(5, Number(rating || 0)));
    return `${"\u2605".repeat(safe)}${"\u2606".repeat(5 - safe)}`;
  }

  function formatReviewDate(value) {
    try {
      return value ? new Date(value).toLocaleDateString() : "";
    } catch {
      return "";
    }
  }

  function updateCartUI() {
    const cart = loadCart();
    const totalItems = cart.reduce((sum, i) => sum + (i.qty || i.quantity || 0), 0);
    const totalPrice = cart.reduce((sum, i) => sum + (i.qty || i.quantity || 0) * Number(i.price || 0), 0);
    if (cartCountEl) cartCountEl.textContent = totalItems;
    if (cartTotalEl) cartTotalEl.textContent = `GHC ${totalPrice.toFixed(2)}`;
  }

  function resolveAuthToken() {
    const fromAuth = typeof window.auth?.getToken === "function" ? window.auth.getToken() : null;
    const fromStorage = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
    const raw = String(fromAuth || fromStorage || "").trim();
    const token = raw.replace(/^Bearer\s+/i, "");
    if (!token || token === "null" || token === "undefined") return null;
    return token;
  }

  function getStock(product) {
    return Number(product?.countInStock ?? product?.stock_quantity ?? product?.stock ?? 0);
  }

  function addToCart(product) {
    const cart = loadCart();
    const id = String(product._id || product.productId || product.id || "");
    const stock = getStock(product);
    if (!id) return;
    if (stock < 1) {
      showToast?.("Out of stock", "error");
      return;
    }

    const index = cart.findIndex((item) => String(item._id || item.productId || item.id) === id);
    if (index > -1) {
      const nextQty = Number(cart[index].qty || cart[index].quantity || 0) + 1;
      if (nextQty > stock) {
        showToast?.("You can't add more than available stock", "info");
        return;
      }
      cart[index].qty = nextQty;
    } else {
      cart.push({
        _id: id,
        productId: id,
        name: product.name,
        price: Number(product.price || 0),
        qty: 1,
        image: resolveImage(product.image || product.images?.[0]),
        countInStock: stock,
      });
    }

    if (window.cart && typeof window.cart.saveCart === "function") {
        window.cart.saveCart(cart);
      } else {
        saveCart(cart);
      }
    document.dispatchEvent(new Event("cart-updated"));
    showToast?.(`[${product.name}] added to cart`, "success");
  }

  function normalizeCategoryKey(category) {
    const key = String(category || "").trim().toLowerCase();
    if (key.startsWith("laptop")) return "laptops";
    if (key.startsWith("phone")) return "phones";
    if (key.startsWith("monitor")) return "monitors";
    if (key.startsWith("access")) return "accessories";
    if (key.startsWith("stor")) return "storage";
    if (key.startsWith("print")) return "printers";
    if (key.startsWith("other")) return "others";
    return key;
  }

  function categoryLabel(category) {
    const key = normalizeCategoryKey(category);
    if (key === "laptops") return "Laptops & Computers";
    if (key === "phones") return "Phones & Tablets";
    if (key === "monitors") return "Monitors & Displays";
    if (key === "accessories") return "Accessories";
    if (key === "storage") return "Storage Devices";
    if (key === "printers") return "Printers & Scanners";
    if (key === "others") return "Others";
    return key ? key.charAt(0).toUpperCase() + key.slice(1) : "Category";
  }

  function setAdaptiveImageFit(imgEl) {
    if (!imgEl) return;
    const applyFit = () => {
      const w = Number(imgEl.naturalWidth || 0);
      const h = Number(imgEl.naturalHeight || 0);
      if (!w || !h) return;
      const ratio = w / h;
      const contain = ratio > 2.2 || ratio < 0.75;
      imgEl.classList.toggle("img-fit-contain", contain);
      imgEl.classList.toggle("img-fit-cover", !contain);
    };
    if (imgEl.complete) applyFit();
    imgEl.addEventListener("load", applyFit);
  }

  function wireSearch() {
    if (!searchInput || !searchForm) return;
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = searchInput.value.trim();
      window.location.href = `products.html${q ? `?q=${encodeURIComponent(q)}` : ""}`;
    });
  }

  function wireNavCategories() {
    navLinks.forEach((link) => {
      if (!link.dataset.cat) return;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = `products.html?category=${encodeURIComponent(String(link.dataset.cat || "").trim().toLowerCase())}`;
      });
    });
  }

  function wireTabs() {
    const tabButtons = Array.from(document.querySelectorAll(".prod-tab-btn"));
    const panes = Array.from(document.querySelectorAll(".prod-tab-pane"));
    if (!tabButtons.length || !panes.length) return;

    const activateTab = (tabName) => {
      if (!tabName) return;
      const targetBtn = tabButtons.find((b) => String(b.dataset.tab || "").toLowerCase() === String(tabName).toLowerCase());
      if (!targetBtn) return;
      targetBtn.click();
    };

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        tabButtons.forEach((b) => {
          const active = b === btn;
          b.classList.toggle("active", active);
          b.setAttribute("aria-selected", active ? "true" : "false");
        });
        panes.forEach((pane) => {
          const active = pane.dataset.pane === tab;
          pane.classList.toggle("active", active);
          pane.hidden = !active;
        });
      });
    });

    const params = new URLSearchParams(window.location.search);
    const tabFromQuery = String(params.get("tab") || "").trim().toLowerCase();
    const hash = String(window.location.hash || "").trim().toLowerCase();
    const wantsReviews = tabFromQuery === "reviews" || hash === "#productreviewssection";
    if (wantsReviews) activateTab("reviews");
  }

  async function loadReviewsForProduct(product) {
    const reviewsListEl = document.getElementById("reviewsList");
    const reviewsSummaryEl = document.getElementById("reviewsSummary");
    const reviewFormWrapEl = document.getElementById("reviewFormWrap");
    const reviewComposerEl = document.getElementById("reviewComposer");
    const reviewToggleBtnEl = document.getElementById("reviewToggleBtn");
    const reviewFormEl = document.getElementById("reviewForm");
    const reviewAuthHintEl = document.getElementById("reviewAuthHint");
    const myReviewPreviewEl = document.getElementById("myReviewPreview");
    const reviewFormTitleEl = document.getElementById("reviewFormTitle");
    const reviewSubmitBtnEl = document.getElementById("reviewSubmitBtn");
    const reviewCancelEditBtnEl = document.getElementById("reviewCancelEditBtn");
    const reviewRatingEl = document.getElementById("reviewRating");
    const reviewStarsInputEl = document.getElementById("reviewStarsInput");
    const reviewRatingTextEl = document.getElementById("reviewRatingText");
    const reviewTitleEl = document.getElementById("reviewTitle");
    const reviewCommentEl = document.getElementById("reviewComment");
    const reviewImageEl = document.getElementById("reviewImage");
    const reviewImagePickerEl = document.getElementById("reviewImagePicker");
    const reviewImagePreviewWrapEl = document.getElementById("reviewImagePreviewWrap");
    const reviewImagePreviewEl = document.getElementById("reviewImagePreview");
    const reviewImageRemoveBtnEl = document.getElementById("reviewImageRemoveBtn");
    const prodRatingEl = document.getElementById("prodRating");
    const prodReviewsEl = document.getElementById("prodReviews");
    if (!reviewsListEl || !reviewFormEl) return;

    const ratingLabels = {
      1: "1 - Poor",
      2: "2 - Fair",
      3: "3 - Good",
      4: "4 - Very Good",
      5: "5 - Excellent",
    };

    function setRatingUI(value) {
      const rating = Number(value || 0);
      if (reviewRatingEl) reviewRatingEl.value = rating > 0 ? String(rating) : "";
      if (reviewStarsInputEl) {
        reviewStarsInputEl.querySelectorAll(".review-star-btn").forEach((btn) => {
          const starValue = Number(btn.dataset.value || 0);
          btn.classList.toggle("active", starValue <= rating && rating > 0);
        });
      }
      if (reviewRatingTextEl) {
        reviewRatingTextEl.textContent = ratingLabels[rating] || "Select rating";
      }
    }

    let hasExistingReview = false;

    function setComposerOpen(isOpen) {
      if (!reviewComposerEl || !reviewToggleBtnEl) return;
      reviewComposerEl.classList.toggle("hidden", !isOpen);
      reviewToggleBtnEl.setAttribute("aria-expanded", isOpen ? "true" : "false");
      reviewToggleBtnEl.textContent = isOpen ? "Close" : (hasExistingReview ? "Update Your Review" : "Write a Review");
    }

    let localImageUrl = "";

    function clearImagePreview() {
      if (localImageUrl) {
        URL.revokeObjectURL(localImageUrl);
        localImageUrl = "";
      }
      if (reviewImageEl) reviewImageEl.value = "";
      if (reviewImagePreviewEl) reviewImagePreviewEl.src = "";
      if (reviewImagePreviewWrapEl) reviewImagePreviewWrapEl.classList.add("hidden");
      reviewImagePickerEl?.classList.remove("has-image");
    }

    function setImagePreview(src) {
      if (!reviewImagePreviewEl || !reviewImagePreviewWrapEl) return;
      reviewImagePreviewEl.src = resolveImage(src || "");
      reviewImagePreviewWrapEl.classList.remove("hidden");
      reviewImagePickerEl?.classList.add("has-image");
    }

    async function uploadReviewImage(file, token) {
      if (!file) return "";
      const fd = new FormData();
      fd.append("image", file);
      const uploadRes = await fetch(`${BASE_URL}/api/reviews/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const uploadPayload = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(uploadPayload?.message || "Image upload failed");
      }
      return String(uploadPayload?.imageUrl || "").trim();
    }

    const token = resolveAuthToken();
    let reviews = [];
    let myReview = null;

    try {
      const response = await fetch(`${BASE_URL}/api/reviews/product/${encodeURIComponent(product._id)}`);
      const payload = await response.json();
      reviews = Array.isArray(payload) ? payload : [];
    } catch {
      reviews = [];
    }

    if (token) {
      try {
        const mineRes = await fetch(`${BASE_URL}/api/reviews/my/${encodeURIComponent(product._id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (mineRes.ok) myReview = await mineRes.json();
      } catch {}
    }

    const count = reviews.length;
    const avg = count ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count : 0;
    if (prodRatingEl) prodRatingEl.textContent = starsFromRating(Math.round(avg || 0));
    if (prodReviewsEl) prodReviewsEl.textContent = `(${count} reviews)`;
    if (reviewsSummaryEl) reviewsSummaryEl.textContent = count ? `${avg.toFixed(1)} / 5 - ${count} reviews` : "No reviews yet";
    if (!token) {
      hasExistingReview = false;
      reviewToggleBtnEl?.classList.add("hidden");
      reviewFormEl.classList.add("hidden");
      reviewAuthHintEl?.classList.add("hidden");
      if (reviewFormTitleEl) reviewFormTitleEl.textContent = "Sign in to review";
      if (myReviewPreviewEl) {
        myReviewPreviewEl.classList.remove("hidden");
        myReviewPreviewEl.innerHTML = '<p class="my-review-comment">Sign in to leave a review. <a href="login.html">Login</a></p>';
      }
      clearImagePreview();
      setComposerOpen(false);
    } else {
      reviewToggleBtnEl?.classList.remove("hidden");
      reviewAuthHintEl?.classList.add("hidden");
      const hasReview = Boolean(myReview?._id);
      hasExistingReview = hasReview;
      reviewFormEl.classList.toggle("hidden", hasReview);
      if (reviewFormTitleEl) reviewFormTitleEl.textContent = hasReview ? "Your Review" : "Rate Our Product";
      if (reviewSubmitBtnEl) reviewSubmitBtnEl.textContent = hasReview ? "Update Review" : "Submit Review";
      if (reviewCancelEditBtnEl) reviewCancelEditBtnEl.classList.toggle("hidden", !hasReview);
      setRatingUI(hasReview ? Number(myReview.rating || 0) : 0);
      if (reviewTitleEl) reviewTitleEl.value = hasReview ? String(myReview.title || "") : "";
      if (reviewCommentEl) reviewCommentEl.value = hasReview ? String(myReview.comment || "") : "";
      clearImagePreview();
      if (hasReview && myReview.image_url) setImagePreview(myReview.image_url);

      if (myReviewPreviewEl) {
        if (hasReview) {
          myReviewPreviewEl.classList.remove("hidden");
          myReviewPreviewEl.innerHTML = `
            <div class="my-review-head">
              <span class="my-review-stars">${starsFromRating(myReview.rating)} (${Number(myReview.rating || 0)}/5)</span>
              <span class="my-review-date">${escapeHtml(formatReviewDate(myReview.updatedAt || myReview.createdAt))}</span>
            </div>
            ${myReview.title ? `<p class="my-review-title">${escapeHtml(myReview.title)}</p>` : ""}
            <p class="my-review-comment">${escapeHtml(myReview.comment || "")}</p>
            ${myReview.image_url ? `<img class="my-review-image" src="${resolveImage(myReview.image_url)}" alt="Your review image" width="120" height="120" loading="lazy" decoding="async">` : ""}
            <div class="my-review-actions">
              <button type="button" class="btn" id="showReviewEditBtn">Update Review</button>
            </div>
          `;
          document.getElementById("showReviewEditBtn")?.addEventListener("click", () => {
            reviewFormEl.classList.remove("hidden");
            myReviewPreviewEl.classList.add("hidden");
            setComposerOpen(true);
          });
        } else {
          myReviewPreviewEl.classList.add("hidden");
          myReviewPreviewEl.innerHTML = "";
          setRatingUI(0);
        }
      }
      setComposerOpen(false);
    }

    reviewToggleBtnEl?.addEventListener("click", () => {
      const isOpen = !reviewComposerEl?.classList.contains("hidden");
      if (token && hasExistingReview) {
        reviewFormEl.classList.remove("hidden");
        myReviewPreviewEl?.classList.add("hidden");
      }
      setComposerOpen(!isOpen);
    });

    reviewImagePickerEl?.addEventListener("click", () => reviewImageEl?.click());
    reviewImagePickerEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        reviewImageEl?.click();
      }
    });

    reviewImageEl?.addEventListener("change", () => {
      const file = reviewImageEl.files?.[0];
      if (!file) return;
      if (!String(file.type || "").startsWith("image/")) {
        showToast?.("Only image files are allowed", "info");
        clearImagePreview();
        return;
      }
      if (localImageUrl) URL.revokeObjectURL(localImageUrl);
      localImageUrl = URL.createObjectURL(file);
      setImagePreview(localImageUrl);
    });

    reviewImageRemoveBtnEl?.addEventListener("click", () => {
      clearImagePreview();
      if (myReview?.image_url) {
        myReview.image_url = "";
      }
    });

    if (reviewStarsInputEl) {
      reviewStarsInputEl.querySelectorAll(".review-star-btn").forEach((btn) => {
        btn.onclick = () => {
          const selected = Number(btn.dataset.value || 0);
          setRatingUI(selected);
        };
      });
    }

    reviewsListEl.innerHTML = "";
    if (!count) {
      reviewsListEl.innerHTML = '<div class="review-empty">No customer reviews yet for this product.</div>';
    } else {
      reviews.forEach((review) => {
        const node = document.createElement("article");
        node.className = "review-item";
        node.innerHTML = `
          <div class="review-item-header">
            <div>
              <div class="review-user">${escapeHtml(review?.user?.name || "Verified Customer")}</div>
              <div class="review-stars">${starsFromRating(review?.rating)}</div>
            </div>
            <div class="review-date">${escapeHtml(formatReviewDate(review?.createdAt))}</div>
          </div>
          ${review?.title ? `<p class="review-title">${escapeHtml(review.title)}</p>` : ""}
          <p class="review-comment">${escapeHtml(review?.comment || "")}</p>
          ${review?.image_url ? `<img class="review-image" src="${resolveImage(review.image_url)}" alt="Review image" width="140" height="140" loading="lazy" decoding="async">` : ""}
        `;
        reviewsListEl.appendChild(node);
      });
    }

    reviewFormEl.onsubmit = async (e) => {
      e.preventDefault();
      if (!token) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          showToast?.("You're offline. Sign in when back online to review.", "info");
          return;
        }
        showToast?.("Please sign in to review", "info");
        window.location.href = "login.html";
        return;
      }

      const rating = Number(reviewRatingEl?.value || 0);
      const title = String(reviewTitleEl?.value || "").trim();
      const comment = String(reviewCommentEl?.value || "").trim();
      if (!rating || rating < 1 || rating > 5) {
        showToast?.("Please provide a valid rating", "info");
        return;
      }
      if (title.length < 2) {
        showToast?.("Please enter a review title", "info");
        return;
      }
      if (comment.length < 3) {
        showToast?.("Please provide a valid comment", "info");
        return;
      }

      try {
        const endpoint = myReview?._id
          ? `${BASE_URL}/api/reviews/${encodeURIComponent(myReview._id)}`
          : `${BASE_URL}/api/reviews/${encodeURIComponent(product._id)}`;
        const method = myReview?._id ? "PUT" : "POST";

        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rating, title, comment }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || "Review submit failed");
        showToast?.(method === "PUT" ? "Review updated" : "Review submitted", "success");
        await loadReviewsForProduct(product);
      } catch (error) {
        showToast?.(error.message || "Review submit failed", "error");
      }
    };

    if (reviewCancelEditBtnEl) {
      reviewCancelEditBtnEl.onclick = () => {
        reviewFormEl.classList.add("hidden");
        if (myReview?._id && myReviewPreviewEl) myReviewPreviewEl.classList.remove("hidden");
        setComposerOpen(false);
      };
    }

    if (reviewFormWrapEl) reviewFormWrapEl.classList.remove("hidden");
  }
  async function loadProduct() {
    try {
      const product = await fetchProductWithFallback(productId);
      if (!product || product.message) {
        page.innerHTML = "<p>Product not found.</p>";
        return;
      }

      document.getElementById("prodName").textContent = product.name;
      document.getElementById("prodBrand").textContent = product.brand || "Unknown";
      document.getElementById("prodPrice").textContent = `GHC ${Number(product.price || 0).toFixed(2)}`;
      document.getElementById("prodOldPrice").textContent = product.oldPrice ? `GHC ${Number(product.oldPrice).toFixed(2)}` : "";
      document.getElementById("prodDesc").textContent = product.description || "";

      const stock = getStock(product);
      const prodStockEl = document.getElementById("prodStock");
      if (prodStockEl) {
        const inStock = stock > 0;
        prodStockEl.textContent = inStock ? `In Stock (${stock})` : "Out of Stock";
        prodStockEl.classList.toggle("in", inStock);
        prodStockEl.classList.toggle("out", !inStock);
      }
      const qtyInput = document.getElementById("qtyInput");
      const qtyDecrease = document.getElementById("qtyDecrease");
      const qtyIncrease = document.getElementById("qtyIncrease");
      const maxQty = Math.max(stock, 1);

      const clampQty = (value) => {
        const safeValue = Number(value || 1);
        if (!stock || stock < 1) return 1;
        return Math.min(Math.max(safeValue, 1), maxQty);
      };

      const syncQtyControls = () => {
        if (!qtyInput) return;
        const current = clampQty(qtyInput.value);
        qtyInput.value = String(current);
        if (qtyDecrease) qtyDecrease.disabled = current <= 1 || stock < 1;
        if (qtyIncrease) qtyIncrease.disabled = current >= maxQty || stock < 1;
      };

      if (qtyInput) {
        qtyInput.value = "1";
        qtyInput.setAttribute("max", String(maxQty));
        qtyInput.setAttribute("min", "1");
        qtyInput.addEventListener("input", syncQtyControls);
        qtyInput.addEventListener("change", syncQtyControls);
      }

      qtyDecrease?.addEventListener("click", () => {
        if (!qtyInput) return;
        qtyInput.value = String(clampQty(Number(qtyInput.value || 1) - 1));
        syncQtyControls();
      });

      qtyIncrease?.addEventListener("click", () => {
        if (!qtyInput) return;
        qtyInput.value = String(clampQty(Number(qtyInput.value || 1) + 1));
        syncQtyControls();
      });

      const addBtn = document.getElementById("addToCartBtn");
      const buyBtn = document.getElementById("buyNowBtn");
      if (stock < 1) {
        if (addBtn) {
          addBtn.textContent = "Out of Stock";
          addBtn.disabled = true;
        }
        if (buyBtn) {
          buyBtn.textContent = "Out of Stock";
          buyBtn.disabled = true;
        }
      }
      syncQtyControls();

      const specList = document.getElementById("specList");
      if (specList && product.specs) {
        specList.innerHTML = "";
        Object.entries(product.specs).forEach(([key, value]) => {
          const li = document.createElement("li");
          li.innerHTML = `<strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}`;
          specList.appendChild(li);
        });
      }

      const mainImage = document.getElementById("mainImage");
      const thumbs = document.getElementById("thumbs");
      const prevBtn = document.querySelector(".gallery-prev");
      const nextBtn = document.querySelector(".gallery-next");
      const lightboxEl = document.getElementById("productImageLightbox");
      const lightboxImageEl = document.getElementById("productLightboxImage");
      const lightboxCloseEl = document.getElementById("productLightboxClose");
      const lightboxPrevEl = document.getElementById("productLightboxPrev");
      const lightboxNextEl = document.getElementById("productLightboxNext");
      const lightboxStageEl = document.getElementById("productLightboxStage");
      let galleryImages = [];
      let currentIndex = 0;
      let lightboxScale = 1;
      let lightboxTranslateX = 0;
      let lightboxTranslateY = 0;
      let dragStartX = 0;
      let dragStartY = 0;
      let isDraggingLightbox = false;

      const applyLightboxTransform = () => {
        if (!lightboxImageEl) return;
        lightboxImageEl.style.transform = `translate(${lightboxTranslateX}px, ${lightboxTranslateY}px) scale(${lightboxScale})`;
        lightboxImageEl.classList.toggle("is-zoomed", lightboxScale > 1);
      };

      const resetLightboxZoom = () => {
        lightboxScale = 1;
        lightboxTranslateX = 0;
        lightboxTranslateY = 0;
        applyLightboxTransform();
      };

      const setLightboxIndex = (index) => {
        if (!lightboxImageEl || !galleryImages.length) return;
        const nextIndex = Math.max(0, Math.min(index, galleryImages.length - 1));
        currentIndex = nextIndex;
        lightboxImageEl.src = resolveImage(galleryImages[currentIndex]);
        if (lightboxPrevEl) lightboxPrevEl.disabled = currentIndex <= 0;
        if (lightboxNextEl) lightboxNextEl.disabled = currentIndex >= galleryImages.length - 1;
        resetLightboxZoom();
      };

      const openLightbox = () => {
        if (!lightboxEl || !galleryImages.length) return;
        lightboxEl.classList.remove("hidden");
        lightboxEl.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        setLightboxIndex(currentIndex);
      };

      const closeLightbox = () => {
        if (!lightboxEl) return;
        lightboxEl.classList.add("hidden");
        lightboxEl.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        resetLightboxZoom();
      };

      const setGalleryIndex = (index) => {
        if (!galleryImages.length) return;
        const nextIndex = Math.max(0, Math.min(index, galleryImages.length - 1));
        currentIndex = nextIndex;
        const selected = galleryImages[currentIndex];
        mainImage.src = resolveImage(selected);
        setAdaptiveImageFit(mainImage);
        if (thumbs) {
          thumbs.querySelectorAll("img").forEach((node, idx) => {
            node.classList.toggle("active", idx === currentIndex);
          });
        }
        if (prevBtn) prevBtn.disabled = currentIndex <= 0;
        if (nextBtn) nextBtn.disabled = currentIndex >= galleryImages.length - 1;
        if (lightboxEl && !lightboxEl.classList.contains("hidden")) {
          setLightboxIndex(currentIndex);
        }
      };

      prevBtn?.addEventListener("click", () => setGalleryIndex(currentIndex - 1));
      nextBtn?.addEventListener("click", () => setGalleryIndex(currentIndex + 1));

      mainImage?.addEventListener("click", openLightbox);
      lightboxCloseEl?.addEventListener("click", closeLightbox);
      lightboxPrevEl?.addEventListener("click", () => setGalleryIndex(currentIndex - 1));
      lightboxNextEl?.addEventListener("click", () => setGalleryIndex(currentIndex + 1));
      lightboxEl?.addEventListener("click", (e) => {
        if (e.target === lightboxEl) closeLightbox();
      });

      lightboxImageEl?.addEventListener("click", () => {
        if (lightboxScale > 1) {
          resetLightboxZoom();
          return;
        }
        lightboxScale = 2;
        applyLightboxTransform();
      });

      lightboxImageEl?.addEventListener("pointerdown", (e) => {
        if (lightboxScale <= 1) return;
        isDraggingLightbox = true;
        dragStartX = e.clientX - lightboxTranslateX;
        dragStartY = e.clientY - lightboxTranslateY;
        lightboxImageEl.classList.add("is-dragging");
        lightboxImageEl.setPointerCapture?.(e.pointerId);
      });

      lightboxImageEl?.addEventListener("pointermove", (e) => {
        if (!isDraggingLightbox || lightboxScale <= 1) return;
        lightboxTranslateX = e.clientX - dragStartX;
        lightboxTranslateY = e.clientY - dragStartY;
        applyLightboxTransform();
      });

      const endLightboxDrag = () => {
        isDraggingLightbox = false;
        lightboxImageEl?.classList.remove("is-dragging");
      };

      lightboxImageEl?.addEventListener("pointerup", endLightboxDrag);
      lightboxImageEl?.addEventListener("pointercancel", endLightboxDrag);

      document.addEventListener("keydown", (e) => {
        if (!lightboxEl || lightboxEl.classList.contains("hidden")) return;
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowLeft") setGalleryIndex(currentIndex - 1);
        if (e.key === "ArrowRight") setGalleryIndex(currentIndex + 1);
      });
      if (Array.isArray(product.images) && product.images.length) {
        galleryImages = [...product.images];
        thumbs.innerHTML = "";
        product.images.forEach((img, idx) => {
          const thumb = document.createElement("img");
          thumb.src = resolveImage(img);
          thumb.className = "thumb";
          thumb.alt = `${product.name} thumbnail`;
          thumb.addEventListener("click", () => {
            setGalleryIndex(idx);
          });
          thumbs.appendChild(thumb);
        });
        setGalleryIndex(0);
      } else {
        galleryImages = [product.image];
        setGalleryIndex(0);
      }

      document.getElementById("addToCartBtn")?.addEventListener("click", () => {
        const qty = parseInt(document.getElementById("qtyInput")?.value, 10) || 1;
        const cart = loadCart();
        const existing = cart.find((item) => String(item._id || item.productId) === String(product._id));
        if (existing) {
          const nextQty = Number(existing.qty || existing.quantity || 0) + qty;
          if (nextQty > stock) {
            showToast?.("You can't add more than available stock", "info");
            return;
          }
          existing.qty = nextQty;
        } else {
          if (qty > stock) {
            showToast?.("You can't add more than available stock", "info");
            return;
          }
          cart.push({
            _id: product._id,
            productId: product._id,
            name: product.name,
            price: Number(product.price || 0),
            image: resolveImage(product.image || product.images?.[0]),
            qty,
            countInStock: stock,
          });
        }
        if (window.cart && typeof window.cart.saveCart === "function") {
        window.cart.saveCart(cart);
      } else {
        saveCart(cart);
      }
        updateCartUI();
        showToast?.(`[${product.name}] added to cart`, "success");
      });

      document.getElementById("buyNowBtn")?.addEventListener("click", () => {
        const qty = parseInt(document.getElementById("qtyInput")?.value, 10) || 1;
        if (qty > stock) {
          showToast?.("You can't add more than available stock", "info");
          return;
        }
        (window.cart && typeof window.cart.saveCart === "function" ? window.cart.saveCart : saveCart)([{
          _id: product._id,
          productId: product._id,
          name: product.name,
          price: Number(product.price || 0),
          image: resolveImage(product.image || product.images?.[0]),
          qty,
          countInStock: stock,
        }]);
        updateCartUI();
        window.location.href = "checkout.html";
      });

      const token = resolveAuthToken();
      const wishlistBtn = document.getElementById("wishlistBtn");
      const shareBtn = document.getElementById("shareBtn");
      if (!token) {
        if (wishlistBtn) wishlistBtn.style.display = "none";
        if (shareBtn) shareBtn.style.display = "none";
      }

      const setWishlistState = (isActive) => {
        if (!wishlistBtn) return;
        wishlistBtn.classList.toggle("active", isActive);
        wishlistBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
      };

      const setWishlistLoading = (isLoading) => {
        if (!wishlistBtn) return;
        wishlistBtn.classList.toggle("is-loading", isLoading);
        wishlistBtn.disabled = Boolean(isLoading);
        wishlistBtn.setAttribute("aria-busy", isLoading ? "true" : "false");
      };

      const loadWishlistState = async () => {
        const authToken = window.auth?.getToken?.();
        if (!authToken || !wishlistBtn) return;
        try {
          const response = await fetch(`${BASE_URL}/api/wishlist`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!response.ok) return;
          const data = await response.json();
          const exists = Array.isArray(data)
            ? data.some((item) => String(item._id || item.id) === String(product._id))
            : false;
          setWishlistState(exists);
        } catch {}
      };

      wishlistBtn?.addEventListener("click", async () => {
        if (wishlistBtn.classList.contains("is-loading")) return;
        const authToken = window.auth?.getToken?.();
        if (!authToken) {
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            showToast?.("You're offline. Sign in when back online to use wishlist.", "info");
            return;
          }
          showToast?.("Login to use wishlist", "info");
          window.location.href = "login.html";
          return;
        }
        const isActive = wishlistBtn.classList.contains("active");
        setWishlistLoading(true);
        try {
          const response = await fetch(`${BASE_URL}/api/wishlist/${product._id}`, {
            method: isActive ? "DELETE" : "POST",
            headers: { Authorization: `Bearer ${authToken}` },
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message = payload?.message || "Wishlist update failed";
            if (message.toLowerCase().includes("already")) {
              setWishlistState(true);
              showToast?.("Already in wishlist", "info");
            } else {
              showToast?.(message, "error");
            }
            return;
          }
          setWishlistState(!isActive);
          showToast?.(isActive ? "Removed from wishlist" : "Added to wishlist", "success");
          document.dispatchEvent(new Event("wishlist-updated"));
        } catch (error) {
          showToast?.(error?.message || "Wishlist update failed", "error");
        } finally {
          setWishlistLoading(false);
        }
      });

      if (token) {
        loadWishlistState();
      }

      shareBtn?.addEventListener("click", async () => {
        const url = `${location.origin}/product.html?id=${encodeURIComponent(product._id)}`;
        try {
          if (navigator.share) {
            await navigator.share({ url });
          } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(url);
            showToast?.("Link copied", "success");
          } else {
            showToast?.("Copy not supported here. Please copy from address bar.", "info");
          }
        } catch {}
      });

      const relatedGrid = document.getElementById("relatedGrid");
      if (relatedGrid) {
        const all = await fetchRelatedProductsWithFallback(product.category);
        const activeCategoryKey = normalizeCategoryKey(product.category);
        const related = (Array.isArray(all) ? all : [])
          .filter((p) => {
            const sameProduct = String(p?._id || p?.id || "") === String(product?._id || product?.id || "");
            if (sameProduct) return false;
            return normalizeCategoryKey(p?.category) === activeCategoryKey;
          })
          .slice(0, 4);

        relatedGrid.innerHTML = "";
        if (!related.length) {
          relatedGrid.innerHTML = '<p class="related-empty">No related product found.</p>';
        } else {
          related.forEach((r) => {
            const rStock = getStock(r);
            const rDesc = String(r.short_description || r.description || "").trim();
            const shortDesc = rDesc.length > 80 ? `${rDesc.slice(0, 77)}...` : rDesc;
            const card = document.createElement("div");
            card.className = "product-card";
            card.innerHTML = `
            <div class="product-media">
              ${r.featured ? '<div class="media-badge">FEATURED</div>' : ""}
              <a href="product.html?id=${encodeURIComponent(r._id)}">
                <img src="${resolveImage((r.images && r.images[0]) || r.image)}" alt="${escapeHtml(r.name)}" width="160" height="120" loading="lazy" decoding="async">
              </a>
            </div>
            <div class="product-info">
              <div class="product-category">${escapeHtml(categoryLabel(r.category).toUpperCase())}</div>
              <div class="product-name">${escapeHtml(r.name)}</div>
              <div class="product-desc">${escapeHtml(shortDesc)}</div>
              <div class="product-price">GHC ${Number(r.price || 0).toFixed(2)}</div>
              <div class="product-stock ${rStock > 0 ? "in" : "out"}">${rStock > 0 ? `In Stock (${rStock})` : "Out of Stock"}</div>
            </div>
            <div class="card-actions">
              <button class="add-to-cart related-add-btn" data-id="${r._id}" ${rStock > 0 ? "" : "disabled"}>${rStock > 0 ? "Add to Cart" : "Out of Stock"}</button>
              <a href="product.html?id=${encodeURIComponent(r._id)}" class="view-details-link">View Details</a>
            </div>
          `;
            relatedGrid.appendChild(card);
            setAdaptiveImageFit(card.querySelector("img"));
          });

          relatedGrid.addEventListener("click", (ev) => {
            const addBtn = ev.target.closest(".add-to-cart");
            if (!addBtn) return;
            const prod = related.find((p) => String(p._id) === String(addBtn.dataset.id));
            if (prod) addToCart(prod);
          });
        }
      }

      await loadReviewsForProduct(product);
      updateCartUI();
    } catch (err) {
      console.error("Failed to load product:", err);
      page.innerHTML = "<p>Could not load product. Please try again later.</p>";
    }
  }

  const miniCart = document.getElementById("miniCart");
  if (miniCart) {
    document.addEventListener("cart-updated", () => {
      const cart = loadCart();
      miniCart.innerHTML = "";
      if (!cart.length) {
        miniCart.innerHTML = "<p>Your cart is empty.</p>";
        return;
      }
      cart.forEach((item) => {
        const row = document.createElement("div");
        row.className = "mini-cart-item";
        row.innerHTML = `
          <span>${escapeHtml(item.name)} x${item.qty || item.quantity}</span>
          <span>GHC ${(Number(item.price || 0) * (item.qty || item.quantity)).toFixed(2)}</span>
        `;
        miniCart.appendChild(row);
      });
    });
  }

  updateCartUI();
  wireSearch();
  wireNavCategories();
  wireTabs();
  if (productId) loadProduct();
});

