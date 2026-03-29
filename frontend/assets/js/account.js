// assets/js/account.js
document.addEventListener("DOMContentLoaded", async () => {
  const firstNameInput = document.getElementById("accountFirstName");
  const lastNameInput = document.getElementById("accountLastName");
  const emailInput = document.getElementById("accountEmailInput");
  const phoneInput = document.getElementById("accountPhone");
  const addressInput = document.getElementById("accountAddress");
  const regionInput = document.getElementById("accountRegion");
  const cityInput = document.getElementById("accountCity");
  const welcomeName = document.getElementById("accountWelcomeName");
  const roleBadge = document.getElementById("accountRoleBadge");
  const adminBadge = document.getElementById("accountAdminBadge");
  const accountHeaderTitle = document.getElementById("accountHeaderTitle");
  const accountHeaderSubtitle = document.getElementById("accountHeaderSubtitle");
  const accountCrumbCurrent = document.getElementById("accountCrumbCurrent");
  const accountSidebarName = document.getElementById("accountSidebarName");
  const accountSidebarEmail = document.getElementById("accountSidebarEmail");
  const mobileQuickLinks = Array.from(document.querySelectorAll(".account-mobile-quicknav a[data-mobile-tab]"));
  const form = document.getElementById("accountProfileForm");
  const messageEl = document.getElementById("accountProfileMessage");
  const logoutBtn = document.getElementById("accountLogoutBtn");

  const tabProfileBtn = document.getElementById("accountTabProfile");
  const tabReviewsBtn = document.getElementById("accountTabReviews");
  const tabAffiliateBtn = document.getElementById("accountTabAffiliate");
  const tabWishlistBtn = document.getElementById("accountTabWishlist");
  const profileSection = document.getElementById("accountProfileSection");
  const reviewsSection = document.getElementById("accountReviewsSection");
  const affiliateSection = document.getElementById("accountAffiliateSection");
  const wishlistSection = document.getElementById("accountWishlistSection");
  const accountContent = document.querySelector(".account-content");
  const sidebar = document.querySelector(".account-sidebar");
  const backFromReviewsBtn = document.getElementById("accountBackFromReviews");
  const backFromAffiliateBtn = document.getElementById("accountBackFromAffiliate");
  const backFromProfileBtn = document.getElementById("accountBackFromProfile");
  const accountHeaderBackBtn = document.getElementById("accountHeaderBackBtn");
  const reviewsList = document.getElementById("accountReviewsList");
  const wishlistGrid = document.getElementById("accountWishlistGrid");

  const affiliateJoinCard = document.getElementById("accountAffiliateJoinCard");
  const affiliateDashboardCard = document.getElementById("accountAffiliateDashboardCard");
  const affiliateJoinBtn = document.getElementById("accountAffiliateJoinBtn");
  const affiliateJoinMessage = document.getElementById("accountAffiliateJoinMessage");
  const affiliateCodeEl = document.getElementById("accountAffiliateCode");
  const affiliateTierEl = document.getElementById("accountAffiliateTier");
  const affiliateTotalReferralsEl = document.getElementById("accountAffiliateTotalReferrals");
  const affiliatePendingReferralsEl = document.getElementById("accountAffiliatePendingReferrals");
  const affiliateEarnedCommissionEl = document.getElementById("accountAffiliateEarnedCommission");
  const affiliatePendingCommissionEl = document.getElementById("accountAffiliatePendingCommission");
  const affiliateTierHeadingEl = document.getElementById("accountAffiliateTierHeading");
  const affiliateTierChipEl = document.getElementById("accountAffiliateTierChip");
  const affiliateTierHintEl = document.getElementById("accountAffiliateTierHint");
  const affiliateLifetimeEl = document.getElementById("accountAffiliateLifetime");
  const affiliateSuccessRateEl = document.getElementById("accountAffiliateSuccessRate");

  const reviewEditor = document.getElementById("accountReviewEditor");
  const reviewIdInput = document.getElementById("accountReviewId");
  const reviewCommentInput = document.getElementById("accountReviewComment");
  const reviewStarsWrap = document.getElementById("accountReviewStars");
  const reviewStarsLabel = document.getElementById("accountReviewStarsLabel");
  const reviewSaveBtn = document.getElementById("accountReviewSaveBtn");
  const reviewCancelBtn = document.getElementById("accountReviewCancelBtn");

  const { API_BASE_USERS, API_BASE, API_BASE_PRODUCTS, showToast } = window.CONFIG || {};
  const { getToken, clearUser, clearToken, setUser, getUser } = window.auth || {};
  const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

  let reviewsCache = [];
  let selectedRating = 0;
  let currentUserId = "";
  let currentAffiliateCode = "";

  const ratingLabelMap = {
    1: "1 - Poor",
    2: "2 - Fair",
    3: "3 - Good",
    4: "4 - Very Good",
    5: "5 - Excellent",
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function starsText(value) {
    const rating = Math.max(0, Math.min(5, Number(value || 0)));
    return `${"\u2605".repeat(rating)}${"\u2606".repeat(5 - rating)}`;
  }

  function formatDate(value) {
    try {
      return value ? new Date(value).toLocaleDateString() : "-";
    } catch {
      return "-";
    }
  }

  function money(v) {
    return `GHC ${Number(v || 0).toFixed(2)}`;
  }

  function hydrateProfileFromUser(user) {
    if (!user || typeof user !== "object") return false;
    const fullName = String(user.name || "").trim();
    const first = user.firstName || fullName.split(/\s+/)[0] || "";
    const last = user.lastName || fullName.split(/\s+/).slice(1).join(" ") || "";

    if (firstNameInput) firstNameInput.value = first;
    if (lastNameInput) lastNameInput.value = last;
    if (emailInput) emailInput.value = user.email || "";
    if (accountSidebarName) accountSidebarName.textContent = `Hello! ${first || user.firstName || "Customer"}`;
    if (accountSidebarEmail) accountSidebarEmail.textContent = user.email || "guest@deetech.com";
    if (phoneInput) phoneInput.value = user.phone || "";
    if (addressInput) addressInput.value = user.address || "";
    if (regionInput) regionInput.value = user.region || "";
    if (cityInput) cityInput.value = user.city || "";
    if (welcomeName) welcomeName.textContent = first || user.name || "Customer";

    if (adminBadge) adminBadge.style.display = user.role === "admin" ? "inline-flex" : "none";
    if (roleBadge) {
      roleBadge.style.display = user.role === "admin" ? "none" : "inline-flex";
      roleBadge.textContent = user.role === "admin" ? "Admin" : "Member";
    }

    profileSnapshot = captureProfileSnapshot();
    setProfileEditMode(true);
    return true;
  }

  function setMessage(text, type = "info") {
    if (!messageEl) return;
    messageEl.textContent = text || "";
    messageEl.style.marginTop = "12px";
    messageEl.style.color = type === "error" ? "#ef4444" : "#1e3a8a";
  }

  function isMobileAccountView() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  }


  function setMobileQuickNav(tab) {
    if (!mobileQuickLinks.length) return;
    const activeTab = String(tab || "main");
    mobileQuickLinks.forEach((link) => {
      link.classList.toggle("account-active", String(link.dataset.mobileTab || "") === activeTab);
    });

    if (!isMobileAccountView()) return;
    const activeLink = mobileQuickLinks.find((link) => link.classList.contains("account-active"));
    if (!activeLink) return;
    requestAnimationFrame(() => {
      activeLink.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
    });
  }
  function updateAccountHeader(tab) {
    if (!accountHeaderTitle || !accountHeaderSubtitle) return;
    const copy = {
      main: {
        title: "My Account",
        subtitle: "Manage your personal details, reviews, affiliate profile, orders, wishlist, and password.",
      },
      profile: {
        title: "Profile",
        subtitle: "Manage your personal details, orders, and account preferences.",
      },
      reviews: {
        title: "Reviews",
        subtitle: "Track your product feedback and open any item directly to its Reviews section.",
      },
      wishlist: {
        title: "Wishlist",
        subtitle: "Review saved products and move them to cart from your account.",
      },    };
    const active = copy[tab] || copy.main;
    accountHeaderTitle.textContent = active.title;
    accountHeaderSubtitle.textContent = active.subtitle;
    if (accountCrumbCurrent) accountCrumbCurrent.textContent = active.title;
    setMobileQuickNav(tab);
  }

  function showAccountMenu() {
    updateAccountHeader("main");

    try {
      const currentPath = String(window.location.pathname || "").toLowerCase();
      if (currentPath.endsWith("/account.html") || currentPath.endsWith("account.html")) {
        const url = new URL(window.location.href);
        if (url.searchParams.has("tab") || url.hash) {
          url.searchParams.delete("tab");
          url.hash = "";
          if (window.history && typeof window.history.replaceState === "function") {
            window.history.replaceState({}, "", `${url.pathname}${url.search}`);
          }
        }
      }
    } catch {
      // no-op: keep menu behavior even if URL normalization fails
    }

    if (!isMobileAccountView()) {
      accountContent?.classList.remove("account-hidden");
      sidebar?.classList.remove("account-hidden");
      return;
    }

    profileSection?.classList.add("account-hidden");
    reviewsSection?.classList.add("account-hidden");
    affiliateSection?.classList.add("account-hidden");
    wishlistSection?.classList.add("account-hidden");

    tabProfileBtn?.classList.remove("account-active");
    tabReviewsBtn?.classList.remove("account-active");
    tabAffiliateBtn?.classList.remove("account-active");
    tabWishlistBtn?.classList.remove("account-active");

    hideReviewEditor();
    accountContent?.classList.add("account-hidden");
    sidebar?.classList.remove("account-hidden");
    setProfileEditMode(true);

  window.scrollTo({ top: 0, behavior: "auto" });
  }

  function activateTab(tab, options = {}) {
    const shouldScroll = options.scroll !== false;

    profileSection?.classList.add("account-hidden");
    reviewsSection?.classList.add("account-hidden");
    affiliateSection?.classList.add("account-hidden");
    wishlistSection?.classList.add("account-hidden");

    tabProfileBtn?.classList.remove("account-active");
    tabReviewsBtn?.classList.remove("account-active");
    tabAffiliateBtn?.classList.remove("account-active");
    tabWishlistBtn?.classList.remove("account-active");

    if (isMobileAccountView()) {
      sidebar?.classList.add("account-hidden");
      accountContent?.classList.remove("account-hidden");
    } else {
      sidebar?.classList.remove("account-hidden");
      accountContent?.classList.remove("account-hidden");
    }

    if (tab === "reviews") {
      updateAccountHeader("reviews");
      reviewsSection?.classList.remove("account-hidden");
      tabReviewsBtn?.classList.add("account-active");
      loadMyReviews();
      if (shouldScroll) window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    if (tab === "wishlist") {
      updateAccountHeader("wishlist");
      wishlistSection?.classList.remove("account-hidden");
      tabWishlistBtn?.classList.add("account-active");
      loadWishlistSection();
      hideReviewEditor();
      if (shouldScroll) window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    if (tab === "affiliate") {
      updateAccountHeader("affiliate");
      affiliateSection?.classList.remove("account-hidden");
      tabAffiliateBtn?.classList.add("account-active");
      loadAffiliateSummary();
      hideReviewEditor();
      if (shouldScroll) window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    updateAccountHeader("profile");
    profileSection?.classList.remove("account-hidden");
    tabProfileBtn?.classList.add("account-active");
    hideReviewEditor();
    if (shouldScroll) window.scrollTo({ top: 0, behavior: "auto" });
  }

  function setEditorRating(value) {
    selectedRating = Math.max(0, Math.min(5, Number(value || 0)));
    if (reviewStarsWrap) {
      reviewStarsWrap.querySelectorAll("button[data-value]").forEach((btn) => {
        const starVal = Number(btn.dataset.value || 0);
        btn.classList.toggle("account-active", starVal <= selectedRating && selectedRating > 0);
      });
    }
    if (reviewStarsLabel) {
      reviewStarsLabel.textContent = ratingLabelMap[selectedRating] || "Select rating";
    }
  }

  function hideReviewEditor() {
    reviewIdInput.value = "";
    reviewCommentInput.value = "";
    setEditorRating(0);
    reviewEditor?.classList.add("account-hidden");
  }

  function showReviewEditor(review) {
    if (!review) return;
    reviewIdInput.value = review._id || "";
    reviewCommentInput.value = review.comment || "";
    setEditorRating(review.rating || 0);
    reviewEditor?.classList.remove("account-hidden");
    reviewEditor?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderReviews() {
    if (!reviewsList) return;
    if (!Array.isArray(reviewsCache) || !reviewsCache.length) {
      reviewsList.innerHTML = `
        <div class="account-reviews-empty" role="status" aria-live="polite">
          <div class="account-reviews-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" focusable="false">
              <path d="M32 6 40.2 22.6 58 25.2 45 37.8 48.1 55.6 32 47.2 15.9 55.6 19 37.8 6 25.2l17.8-2.6z"></path>
            </svg>
          </div>
          <h3>No reviews added yet</h3>
          <p>Your posted product reviews will appear here.</p>
        </div>
      `;
      hideReviewEditor();
      return;
    }

    reviewsList.innerHTML = reviewsCache
      .map((review) => {
        const product = review.product || {};
        const productName = product.name || "Product";
        const productId = product._id || "";
        const reviewImageRaw =
          review?.image_url ||
          review?.image ||
          product?.image ||
          product?.image_url ||
          (Array.isArray(product?.images) ? product.images[0] : "") ||
          "assets/img/placeholder.svg";
        const reviewImage =
          typeof window.resolveImage === "function"
            ? window.resolveImage(reviewImageRaw)
            : String(reviewImageRaw || "").trim() || "assets/img/placeholder.svg";
        const reviewDateTime = (() => {
          try {
            const d = new Date(review.updatedAt || review.createdAt);
            if (Number.isNaN(d.getTime())) return "-";
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const hh = String(d.getHours()).padStart(2, "0");
            const mi = String(d.getMinutes()).padStart(2, "0");
            const ss = String(d.getSeconds()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
          } catch {
            return "-";
          }
        })();
        const reviewComment = escapeHtml(review.comment || "No comment provided.");

        return `
          <article class="account-review-card">
            <a class="account-review-card-link" href="product.html?id=${encodeURIComponent(productId)}&tab=reviews#productReviewsSection" aria-label="Open reviews for ${escapeHtml(productName)}">
              <div class="account-review-layout">
                <div class="account-review-thumb-link">
                  <img class="account-review-thumb" src="${escapeHtml(reviewImage)}" alt="${escapeHtml(productName)} review image" width="120" height="120" loading="lazy" decoding="async">
                </div>
                <div class="account-review-main">
                  <div class="account-review-card-head">
                    <div>
                      <div class="account-review-product">${escapeHtml(productName)}</div>
                      <div class="account-review-meta">${escapeHtml(reviewDateTime)}</div>
                    </div>
                    <div class="account-review-stars-text" aria-label="${Number(review.rating || 0)} out of 5 stars">${starsText(review.rating)}</div>
                  </div>
                  <p class="account-review-comment">${reviewComment}</p>
                </div>
              </div>
            </a>
          </article>
        `;
      })
      .join("");

  }
  function getWishlistCategoryLabel(category) {
    const key = String(category || "").toLowerCase();
    const map = {
      laptops: "LAPTOPS & COMPUTERS",
      phones: "PHONES & TABLETS",
      monitors: "MONITORS & DISPLAYS",
      accessories: "ACCESSORIES",
      storage: "STORAGE DEVICES",
      printers: "PRINTERS & SCANNERS",
      others: "OTHERS",
    };
    return map[key] || "PRODUCT";
  }

  function normalizeWishlistStock(product) {
    return Number(product?.countInStock ?? product?.stock_quantity ?? product?.stock ?? 0);
  }

  async function loadWishlistSection() {
    if (!wishlistGrid) return;

    const token = typeof getToken === "function" ? getToken() : null;
    if (!token) {
      wishlistGrid.innerHTML = `
        <div class="account-wishlist-auth-required">
          <h3>Please sign in to view your wishlist</h3>
          <p>Your wishlist is only available for logged-in users.</p>
          <a class="btn" href="login.html">Sign in</a>
        </div>
      `;
      return;
    }

    wishlistGrid.innerHTML = `<div class="account-reviews-note">Loading wishlist...</div>`;

    try {
      const res = await fetch(`${API_BASE}/wishlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load wishlist");

      if (!Array.isArray(data) || data.length === 0) {
        wishlistGrid.innerHTML = `
          <div class="account-wishlist-empty" role="status" aria-live="polite">
            <div class="account-wishlist-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 64 64" focusable="false">
                <path d="M32 57 28.5 53.9C16 42.6 8 35.4 8 25.8 8 17.9 14.1 12 22 12c4.5 0 8.8 2.1 11 5.5C35.2 14.1 39.5 12 44 12c7.9 0 14 5.9 14 13.8 0 9.6-8 16.8-20.5 28.1z"></path>
              </svg>
            </div>
            <h3>No products were added to the wishlist page.</h3>
            <p>Browse products and tap the wishlist icon to save your favorites.</p>
          </div>
        `;
        return;
      }

      wishlistGrid.innerHTML = data.map((p) => {
        const id = String(p?._id || p?.productId || p?.id || "");
        const imageRaw = p.image || p.image_url || (Array.isArray(p.images) ? p.images[0] : "") || "assets/img/placeholder.svg";
        const image = typeof window.resolveImage === "function" ? window.resolveImage(imageRaw) : String(imageRaw || "");
        const stock = normalizeWishlistStock(p);
        const shortDesc = String(p.short_description || p.description || "").trim();

        return `
          <article class="account-wishlist-card" data-id="${escapeHtml(id)}">
            <a class="account-wishlist-media" href="product.html?id=${encodeURIComponent(id)}">
              <img src="${escapeHtml(image)}" alt="${escapeHtml(p.name || "Product")}" width="140" height="140" loading="lazy" decoding="async">
            </a>
            <div class="account-wishlist-info">
              <div class="account-wishlist-category">${escapeHtml(getWishlistCategoryLabel(p.category))}</div>
              <a class="account-wishlist-name" href="product.html?id=${encodeURIComponent(id)}">${escapeHtml(p.name || "Product")}</a>
              <p class="account-wishlist-desc">${escapeHtml(shortDesc || "No description available")}</p>
              <div class="account-wishlist-price">GHC ${Number(p.price || 0).toFixed(2)}</div>
              <div class="account-wishlist-stock ${stock > 0 ? "in" : "out"}">${stock > 0 ? `In Stock (${stock})` : "Out of Stock"}</div>
              <div class="account-wishlist-actions">
                <button type="button" class="account-wishlist-cart-btn" data-action="add" data-id="${escapeHtml(id)}" ${stock > 0 ? "" : "disabled"}>${stock > 0 ? "Add to Cart" : "Out of Stock"}</button>
                <button type="button" class="account-wishlist-remove-btn" data-action="remove" data-id="${escapeHtml(id)}">Remove</button>
              </div>
            </div>
          </article>
        `;
      }).join("");

      wishlistGrid.querySelectorAll("button[data-action='remove']").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const productId = btn.dataset.id;
          if (!productId) return;
          try {
            const removeRes = await fetch(`${API_BASE}/wishlist/${encodeURIComponent(productId)}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!removeRes.ok) throw new Error("Failed to remove from wishlist");
            showToast?.("Removed from wishlist", "success");
            loadWishlistSection();
            document.dispatchEvent(new Event("wishlist-updated"));
          } catch (error) {
            showToast?.(error.message || "Failed to remove from wishlist", "error");
          }
        });
      });

      wishlistGrid.querySelectorAll("button[data-action='add']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const productId = btn.dataset.id;
          const product = data.find((item) => String(item?._id || item?.productId || item?.id || "") === String(productId));
          if (!product) return;

          const getCart = typeof window.CONFIG?.loadCart === "function"
            ? window.CONFIG.loadCart
            : () => JSON.parse(localStorage.getItem("cart") || "[]");
          const setCart = typeof window.CONFIG?.saveCart === "function"
            ? window.CONFIG.saveCart
            : (cart) => localStorage.setItem("cart", JSON.stringify(cart));

          const cart = getCart();
          const stock = normalizeWishlistStock(product);
          const existing = cart.find((item) => String(item._id || item.productId || item.id) === String(productId));

          if (existing) {
            const nextQty = Number(existing.qty || existing.quantity || 0) + 1;
            if (nextQty > stock) {
              showToast?.("You can't add more than available stock", "info");
              return;
            }
            existing.qty = nextQty;
          } else {
            const imageRaw = product.image || product.image_url || (Array.isArray(product.images) ? product.images[0] : "") || "assets/img/placeholder.svg";
            const image = typeof window.resolveImage === "function" ? window.resolveImage(imageRaw) : String(imageRaw || "");
            cart.push({
              _id: productId,
              productId,
              name: product.name,
              price: Number(product.price || 0),
              image,
              qty: 1,
              countInStock: stock,
            });
          }

          setCart(cart);
          document.dispatchEvent(new Event("cart-updated"));
          showToast?.(`[${product.name}] added to cart`, "success");
        });
      });
    } catch (error) {
      console.error("Wishlist load error:", error);
      wishlistGrid.innerHTML = `<div class="account-reviews-note">Unable to load wishlist right now.</div>`;
    }
  }
  async function loadMyReviews() {
    try {
      const token = typeof getToken === "function" ? getToken() : null;
      const localUser = typeof getUser === "function" ? getUser() : null;
      if (!token) {
        if (hydrateProfileFromUser(localUser)) return;
        if (isOffline()) {
          if (reviewsList) {
            reviewsList.innerHTML = "<div class='account-reviews-note'>You're offline. Sign in when online to load your reviews.</div>";
          }
          return;
        }
        showToast?.("Please sign in to view your reviews.", "info");
        return;
      }
      if (reviewsList) {
        reviewsList.innerHTML = "<div class='account-reviews-note'>Loading your reviews...</div>";
      }
      const res = await fetch(`${API_BASE}/reviews/me`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 404) {
        await loadMyReviewsFallback();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load reviews");
      reviewsCache = Array.isArray(data) ? data : [];
      renderReviews();
    } catch (error) {
      console.error("Load reviews error:", error);
      reviewsCache = [];
      if (reviewsList) {
        reviewsList.innerHTML = "<div class='account-reviews-note'>Unable to load reviews right now.</div>";
      }
    }
  }

  async function loadMyReviewsFallback() {
    const token = typeof getToken === "function" ? getToken() : null;
    if (!token) return;
    const authUser = typeof getUser === "function" ? getUser() : null;
    const userId = currentUserId || authUser?._id || authUser?.id || "";
    if (!userId) throw new Error("User not resolved");

    const res = await fetch(`${API_BASE_PRODUCTS}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Fallback review load failed");

    const products = Array.isArray(data) ? data : Array.isArray(data.products) ? data.products : [];
    const mine = [];

    products.forEach((product) => {
      const reviews = Array.isArray(product.reviews) ? product.reviews : [];
      reviews.forEach((review) => {
        const reviewUserId = review?.user?._id || review?.user || "";
        if (String(reviewUserId) === String(userId)) {
          mine.push({
            ...review,
            product: {
              _id: product._id,
              name: product.name,
              category: product.category,
              brand: product.brand,
              price: product.price,
              images: product.images,
            },
          });
        }
      });
    });

    mine.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    reviewsCache = mine;
    renderReviews();
  }

  async function saveReviewUpdate() {
    const reviewId = String(reviewIdInput.value || "").trim();
    const comment = String(reviewCommentInput.value || "").trim();
    if (!reviewId) return;
    if (!selectedRating || selectedRating < 1 || selectedRating > 5) {
      showToast?.("Please select a star rating", "info");
      return;
    }
    if (comment.length < 3) {
      showToast?.("Review comment is too short", "info");
      return;
    }

    const token = typeof getToken === "function" ? getToken() : null;
    if (!token) {
      showToast?.("Please sign in to update your review.", "info");
      return;
    }

    try {
      reviewSaveBtn.disabled = true;
      const res = await fetch(`${API_BASE}/reviews/${encodeURIComponent(reviewId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: selectedRating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update review");
      showToast?.("Review updated", "success");
      hideReviewEditor();
      await loadMyReviews();
    } catch (error) {
      console.error("Update review error:", error);
      showToast?.(error.message || "Failed to update review", "error");
    } finally {
      reviewSaveBtn.disabled = false;
    }
  }

  async function loadAccountInfo() {
    try {
      const token = typeof getToken === "function" ? getToken() : null;
      const localUser = typeof getUser === "function" ? getUser() : null;
      if (!token) {
        if (hydrateProfileFromUser(localUser)) return;
        if (isOffline()) {
          setMessage("You're offline. Connect and sign in to load account details.", "error");
          return;
        }
        showToast?.("Please sign in to access your account.", "info");
        return;
      }

      if (!API_BASE_USERS) {
        if (hydrateProfileFromUser(localUser)) return;
        throw new Error("Users API base is not configured");
      }

      const res = await fetch(`${API_BASE_USERS}/profile`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        if (!isOffline()) {
          clearUser?.();
          clearToken?.();
        }
        setMessage("Session not available. Sign in when you're ready.", "error");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch account data");

      const user = await res.json();
      currentUserId = user._id || "";
      const fullName = user.name || "";
      const first = user.firstName || fullName.split(/\s+/)[0] || "";
      const last = user.lastName || fullName.split(/\s+/).slice(1).join(" ") || "";

      if (firstNameInput) firstNameInput.value = first;
      if (lastNameInput) lastNameInput.value = last;
      if (emailInput) emailInput.value = user.email || "";
      if (accountSidebarName) accountSidebarName.textContent = `Hello! ${first || user.firstName || "Customer"}`;
      if (accountSidebarEmail) accountSidebarEmail.textContent = user.email || "guest@deetech.com";
      if (phoneInput) phoneInput.value = user.phone || "";
      if (addressInput) addressInput.value = user.address || "";
      if (regionInput) regionInput.value = user.region || "";
      if (cityInput) cityInput.value = user.city || "";
      profileSnapshot = captureProfileSnapshot();
      setProfileEditMode(true);
      if (welcomeName) welcomeName.textContent = first || user.name || "Customer";

      if (adminBadge) adminBadge.style.display = user.role === "admin" ? "inline-flex" : "none";
      if (roleBadge) {
        roleBadge.style.display = user.role === "admin" ? "none" : "inline-flex";
        roleBadge.textContent = user.role === "admin" ? "Admin" : "Member";
      }

      if (user.role !== "admin") {
        try {
          const affiliateRes = await fetch(`${API_BASE}/affiliates/me`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
          if (affiliateRes.ok) {
            const affiliateData = await affiliateRes.json();
            if (affiliateData?.isAffiliate && roleBadge) {
              const tier = String(affiliateData?.affiliate?.tier || "starter");
              roleBadge.style.display = "inline-flex";
              roleBadge.textContent = `Affiliate ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
            }
          }
        } catch (affiliateErr) {
          console.warn("Affiliate badge check failed", affiliateErr);
        }
      }
    } catch (err) {
      console.error("Account fetch error:", err.message);
      const fallbackUser = typeof getUser === "function" ? getUser() : null;
      if (hydrateProfileFromUser(fallbackUser)) {
        setMessage("Live account refresh failed. Showing saved profile data.", "info");
        return;
      }
      setMessage("Unable to load account info. Please log in again.", "error");
    }
  }


  function renderAffiliateJoinState(message = "") {
    affiliateDashboardCard?.classList.add("account-hidden");
    affiliateJoinCard?.classList.remove("account-hidden");
    if (affiliateJoinMessage) affiliateJoinMessage.textContent = message;
  }

  function renderAffiliateDashboard(data) {
    const affiliate = data?.affiliate || {};
    const stats = data?.stats || {};
    const settings = data?.settings || {};

    const toNumber = (value) => {
      if (typeof value === "number") return Number.isFinite(value) ? value : 0;
      const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    currentAffiliateCode = String(affiliate.code || "").trim();
    if (affiliateCodeEl) affiliateCodeEl.textContent = currentAffiliateCode || "-";

    const tierRaw = String(affiliate.tier || "starter");
    const tierText = `${tierRaw.charAt(0).toUpperCase()}${tierRaw.slice(1)}`;
    if (affiliateTierEl) affiliateTierEl.textContent = tierText;
    if (affiliateTierHeadingEl) affiliateTierHeadingEl.textContent = tierText;
    if (affiliateTierChipEl) affiliateTierChipEl.textContent = tierText;

    const totalReferrals = toNumber(stats.totalReferrals);
    const pendingReferrals = toNumber(stats.pendingReferrals);
    const cancelledReferrals = toNumber(stats.cancelledReferrals);
    const deliveredReferrals = toNumber(
      stats.deliveredReferrals ?? Math.max(totalReferrals - pendingReferrals - cancelledReferrals, 0)
    );

    const earnedCommission = toNumber(stats.earnedCommission);
    const pendingCommission = toNumber(stats.pendingCommission);

    if (affiliateTotalReferralsEl) affiliateTotalReferralsEl.textContent = String(totalReferrals);
    if (affiliatePendingReferralsEl) affiliatePendingReferralsEl.textContent = String(pendingReferrals);
    if (affiliateEarnedCommissionEl) affiliateEarnedCommissionEl.textContent = money(earnedCommission);
    if (affiliatePendingCommissionEl) affiliatePendingCommissionEl.textContent = money(pendingCommission);

    const lifetime = earnedCommission + pendingCommission;
    if (affiliateLifetimeEl) affiliateLifetimeEl.textContent = money(lifetime);

    const successRate = totalReferrals > 0 ? Math.round((deliveredReferrals / totalReferrals) * 100) : 0;
    if (affiliateSuccessRateEl) affiliateSuccessRateEl.textContent = `${successRate}%`;

    const thresholds = settings?.tierThresholds || { bronze: 8, silver: 18, gold: 35 };
    let hint = `Need ${Math.max(Number(thresholds.bronze || 8) - deliveredReferrals, 0)} more delivered referrals for Bronze.`;
    if (deliveredReferrals >= Number(thresholds.gold || 35)) {
      hint = "Gold tier unlocked. Keep scaling your referrals.";
    } else if (deliveredReferrals >= Number(thresholds.silver || 18)) {
      hint = `Need ${Math.max(Number(thresholds.gold || 35) - deliveredReferrals, 0)} more delivered referrals for Gold.`;
    } else if (deliveredReferrals >= Number(thresholds.bronze || 8)) {
      hint = `Need ${Math.max(Number(thresholds.silver || 18) - deliveredReferrals, 0)} more delivered referrals for Silver.`;
    }
    if (affiliateTierHintEl) affiliateTierHintEl.textContent = hint;

    affiliateJoinCard?.classList.add("account-hidden");
    affiliateDashboardCard?.classList.remove("account-hidden");
  }
  async function loadAffiliateSummary() {
    const token = typeof getToken === "function" ? getToken() : null;
    if (!token) {
      renderAffiliateJoinState("Please sign in to manage your affiliate profile.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/affiliates/me`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load affiliate profile");

      if (!data?.isAffiliate) {
        renderAffiliateJoinState("You're not an affiliate yet. Create your code to start earning.");
        return;
      }

      renderAffiliateDashboard(data);
    } catch (error) {
      console.error("Affiliate summary error:", error);
      renderAffiliateJoinState(error.message || "Unable to load affiliate profile.");
    }
  }

  async function createAffiliateCode() {
    const token = typeof getToken === "function" ? getToken() : null;
    if (!token) {
      showToast?.("Please sign in first", "info");
      return;
    }

    try {
      affiliateJoinBtn.disabled = true;
      const res = await fetch(`${API_BASE}/affiliates/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");
      showToast?.("Affiliate code created", "success");
      await loadAffiliateSummary();
    } catch (error) {
      console.error("Affiliate register error:", error);
      if (affiliateJoinMessage) affiliateJoinMessage.textContent = error.message || "Registration failed.";
      showToast?.(error.message || "Registration failed", "error");
    } finally {
      if (affiliateJoinBtn) affiliateJoinBtn.disabled = false;
    }
  }
  async function handleProfileSave(e) {
    e.preventDefault();
    const token = typeof getToken === "function" ? getToken() : null;
    if (!token) {
      showToast?.("Please sign in to update your profile.", "info");
      return;
    }

    const firstName = firstNameInput?.value.trim();
    const lastName = lastNameInput?.value.trim();
    if (!firstName || !lastName) {
      setMessage("First and last name are required.", "error");
      return;
    }

    try {
      if (!API_BASE_USERS) {
        throw new Error("Users API base is not configured");
      }

      const res = await fetch(`${API_BASE_USERS}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: phoneInput?.value.trim() || "",
          address: addressInput?.value.trim() || "",
          region: regionInput?.value.trim() || "",
          city: cityInput?.value.trim() || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || "Failed to update profile.", "error");
        return;
      }

      const updatedUser = {
        _id: data._id,
        name: data.name,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        region: data.region,
        city: data.city,
        role: data.role,
      };
      if (typeof setUser === "function") setUser(updatedUser);
      else localStorage.setItem("loggedInUser", JSON.stringify(updatedUser));

      if (welcomeName) welcomeName.textContent = data.firstName || firstName || data.name || "Customer";
      profileSnapshot = captureProfileSnapshot();
      setProfileEditMode(true);
      setMessage("Profile updated successfully.", "success");
      showToast?.("Profile updated", "success");
    } catch (err) {
      console.error("Profile update error:", err);
      setMessage("Server error. Please try again.", "error");
    }
  }

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("token");
    clearUser?.();
    clearToken?.();
    showToast?.("Logged out", "info");
    window.location.replace("login.html");
  }

  const profileEditBtn = document.getElementById("accountProfileEditBtn");
  const profileSaveBtn = form ? form.querySelector(".account-save-btn") : null;
  let isProfileEditing = false;
  let profileSnapshot = null;

  function captureProfileSnapshot() {
    return {
      firstName: firstNameInput?.value || "",
      lastName: lastNameInput?.value || "",
      phone: phoneInput?.value || "",
      address: addressInput?.value || "",
      region: regionInput?.value || "",
      city: cityInput?.value || "",
    };
  }

  function applyProfileSnapshot(snapshot) {
    if (!snapshot) return;
    if (firstNameInput) firstNameInput.value = snapshot.firstName || "";
    if (lastNameInput) lastNameInput.value = snapshot.lastName || "";
    if (phoneInput) phoneInput.value = snapshot.phone || "";
    if (addressInput) addressInput.value = snapshot.address || "";
    if (regionInput) regionInput.value = snapshot.region || "";
    if (cityInput) cityInput.value = snapshot.city || "";
  }

  function setProfileEditMode() {
    isProfileEditing = true;
    form?.classList.add("account-editing");

    [firstNameInput, lastNameInput, phoneInput, addressInput, regionInput, cityInput].forEach((input) => {
      if (!input) return;
      input.disabled = false;
      input.classList.remove("account-disabled-input");
    });

    if (profileEditBtn) profileEditBtn.style.display = "none";
    if (profileSaveBtn) {
      profileSaveBtn.style.display = "";
      profileSaveBtn.disabled = false;
    }
  }
  tabProfileBtn?.addEventListener("click", () => activateTab("profile"));
  tabReviewsBtn?.addEventListener("click", () => activateTab("reviews"));
  tabAffiliateBtn?.addEventListener("click", () => activateTab("affiliate"));
  tabWishlistBtn?.addEventListener("click", () => activateTab("wishlist"));

  backFromProfileBtn?.addEventListener("click", showAccountMenu);
  accountHeaderBackBtn?.addEventListener("click", showAccountMenu);
  backFromReviewsBtn?.addEventListener("click", showAccountMenu);
  backFromAffiliateBtn?.addEventListener("click", showAccountMenu);

    logoutBtn?.addEventListener("click", handleLogout);
  form?.addEventListener("submit", handleProfileSave);
  reviewSaveBtn?.addEventListener("click", saveReviewUpdate);
  reviewCancelBtn?.addEventListener("click", hideReviewEditor);
  reviewStarsWrap?.querySelectorAll("button[data-value]").forEach((btn) => {
    btn.addEventListener("click", () => setEditorRating(Number(btn.dataset.value || 0)));
  });

  let tabFromUrl = new URLSearchParams(window.location.search).get("tab");

  const navEntry = (typeof performance !== "undefined" && typeof performance.getEntriesByType === "function")
    ? performance.getEntriesByType("navigation")[0]
    : null;
  const isReloadNav = Boolean((navEntry && navEntry.type === "reload") || (performance && performance.navigation && performance.navigation.type === 1));
  if (isReloadNav && tabFromUrl) {
    tabFromUrl = null;
    if (window.history && typeof window.history.replaceState === "function") {
      window.history.replaceState({}, "", "account.html");
    }
  }
  if (isMobileAccountView()) {
    if (tabFromUrl === "reviews" || tabFromUrl === "affiliate" || tabFromUrl === "wishlist" || tabFromUrl === "profile") {
      activateTab(tabFromUrl, { scroll: false });
    } else {
      showAccountMenu();
    }
  } else if (tabFromUrl === "reviews") {
    activateTab("reviews", { scroll: false });
  } else if (tabFromUrl === "affiliate") {
    activateTab("affiliate", { scroll: false });
  } else if (tabFromUrl === "wishlist") {
    activateTab("wishlist", { scroll: false });
  } else {
    activateTab("profile", { scroll: false });
  }

  window.addEventListener("resize", () => {
    if (!isMobileAccountView()) {
      sidebar?.classList.remove("account-hidden");
      accountContent?.classList.remove("account-hidden");
      if (
        profileSection?.classList.contains("account-hidden") &&
        reviewsSection?.classList.contains("account-hidden") &&
        affiliateSection?.classList.contains("account-hidden") &&
        wishlistSection?.classList.contains("account-hidden")
      ) {
        activateTab("profile", { scroll: false });
      }
    }
  });

  setProfileEditMode(true);

  window.scrollTo({ top: 0, behavior: "auto" });
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));

  loadAccountInfo();
});


































