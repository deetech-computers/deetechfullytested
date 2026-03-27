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
  const form = document.getElementById("accountProfileForm");
  const messageEl = document.getElementById("accountProfileMessage");
  const logoutBtn = document.getElementById("accountLogoutBtn");

  const tabProfileBtn = document.getElementById("accountTabProfile");
  const tabReviewsBtn = document.getElementById("accountTabReviews");
  const tabAffiliateBtn = document.getElementById("accountTabAffiliate");
  const profileSection = document.getElementById("accountProfileSection");
  const reviewsSection = document.getElementById("accountReviewsSection");
  const affiliateSection = document.getElementById("accountAffiliateSection");
  const accountContent = document.querySelector(".account-content");
  const sidebar = document.querySelector(".account-sidebar");
  const backFromReviewsBtn = document.getElementById("accountBackFromReviews");
  const backFromAffiliateBtn = document.getElementById("accountBackFromAffiliate");
  const backFromProfileBtn = document.getElementById("accountBackFromProfile");
  const reviewsList = document.getElementById("accountReviewsList");

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

  function setMessage(text, type = "info") {
    if (!messageEl) return;
    messageEl.textContent = text || "";
    messageEl.style.marginTop = "12px";
    messageEl.style.color = type === "error" ? "#ef4444" : "#1e3a8a";
  }

  function isMobileAccountView() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  }

  function showAccountMenu() {
    if (!isMobileAccountView()) {
      accountContent?.classList.remove("account-hidden");
      sidebar?.classList.remove("account-hidden");
      return;
    }

    profileSection?.classList.add("account-hidden");
    reviewsSection?.classList.add("account-hidden");
    affiliateSection?.classList.add("account-hidden");

    tabProfileBtn?.classList.remove("account-active");
    tabReviewsBtn?.classList.remove("account-active");
    tabAffiliateBtn?.classList.remove("account-active");

    hideReviewEditor();
    accountContent?.classList.add("account-hidden");
    sidebar?.classList.remove("account-hidden");
    sidebar?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function activateTab(tab) {

    profileSection?.classList.add("account-hidden");
    reviewsSection?.classList.add("account-hidden");
    affiliateSection?.classList.add("account-hidden");

    tabProfileBtn?.classList.remove("account-active");
    tabReviewsBtn?.classList.remove("account-active");
    tabAffiliateBtn?.classList.remove("account-active");

    if (isMobileAccountView()) {
      sidebar?.classList.add("account-hidden");
      accountContent?.classList.remove("account-hidden");
    } else {
      sidebar?.classList.remove("account-hidden");
      accountContent?.classList.remove("account-hidden");
    }

    if (tab === "reviews") {
      reviewsSection?.classList.remove("account-hidden");
      tabReviewsBtn?.classList.add("account-active");
      loadMyReviews();
      reviewsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (tab === "affiliate") {
      affiliateSection?.classList.remove("account-hidden");
      tabAffiliateBtn?.classList.add("account-active");
      loadAffiliateSummary();
      hideReviewEditor();
      affiliateSection?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    profileSection?.classList.remove("account-hidden");
    tabProfileBtn?.classList.add("account-active");
    hideReviewEditor();
    profileSection?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <div class="account-reviews-note">
          You have not submitted any reviews yet. Reviews will appear here after you post them on product pages.
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
        return `
          <article class="account-review-card">
            <div class="account-review-card-head">
              <div>
                <div class="account-review-product">${escapeHtml(productName)}</div>
                <div class="account-review-meta">${escapeHtml(product.category || "General")} &bull; Updated ${escapeHtml(formatDate(review.updatedAt || review.createdAt))}</div>
              </div>
              <div class="account-review-stars-text">${starsText(review.rating)} (${Number(review.rating || 0)}/5)</div>
            </div>
            <p class="account-review-comment">${escapeHtml(review.comment || "")}</p>
            <div class="account-review-actions">
              <button type="button" class="btn account-review-edit-btn" data-review-id="${escapeHtml(review._id || "")}">Update Review</button>
              <a class="btn btn-outline" href="product.html?id=${encodeURIComponent(productId)}">Open Product</a>
            </div>
          </article>
        `;
      })
      .join("");

    reviewsList.querySelectorAll(".account-review-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-review-id");
        const review = reviewsCache.find((r) => String(r._id) === String(id));
        showReviewEditor(review);
      });
    });
  }

  async function loadMyReviews() {
    try {
      const token = typeof getToken === "function" ? getToken() : null;
      if (!token) {
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
      if (!token) {
        if (isOffline()) {
          setMessage("You're offline. Connect and sign in to load account details.", "error");
          return;
        }
        showToast?.("Please sign in to access your account.", "info");
        return;
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

    currentAffiliateCode = String(affiliate.code || "").trim();
    if (affiliateCodeEl) affiliateCodeEl.textContent = currentAffiliateCode || "-";
    if (affiliateTierEl) {
      const tier = String(affiliate.tier || "starter");
      affiliateTierEl.textContent = `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
    }
    if (affiliateTotalReferralsEl) affiliateTotalReferralsEl.textContent = String(stats.totalReferrals || 0);
    if (affiliatePendingReferralsEl) affiliatePendingReferralsEl.textContent = String(stats.pendingReferrals || 0);
    if (affiliateEarnedCommissionEl) affiliateEarnedCommissionEl.textContent = money(stats.earnedCommission || 0);
    if (affiliatePendingCommissionEl) affiliatePendingCommissionEl.textContent = money(stats.pendingCommission || 0);

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

  tabProfileBtn?.addEventListener("click", () => activateTab("profile"));
  tabReviewsBtn?.addEventListener("click", () => activateTab("reviews"));
  tabAffiliateBtn?.addEventListener("click", () => activateTab("affiliate"));

  backFromProfileBtn?.addEventListener("click", showAccountMenu);
  backFromReviewsBtn?.addEventListener("click", showAccountMenu);
  backFromAffiliateBtn?.addEventListener("click", showAccountMenu);

  logoutBtn?.addEventListener("click", handleLogout);
  form?.addEventListener("submit", handleProfileSave);
  reviewSaveBtn?.addEventListener("click", saveReviewUpdate);
  reviewCancelBtn?.addEventListener("click", hideReviewEditor);
  reviewStarsWrap?.querySelectorAll("button[data-value]").forEach((btn) => {
    btn.addEventListener("click", () => setEditorRating(Number(btn.dataset.value || 0)));
  });

  const tabFromUrl = new URLSearchParams(window.location.search).get("tab");
  if (tabFromUrl === "reviews") activateTab("reviews");
  else if (tabFromUrl === "affiliate") activateTab("affiliate");
  else if (tabFromUrl === "profile") activateTab("profile");
  else if (isMobileAccountView()) showAccountMenu();
  else activateTab("profile");

  window.addEventListener("resize", () => {
    if (!isMobileAccountView()) {
      sidebar?.classList.remove("account-hidden");
      accountContent?.classList.remove("account-hidden");
      if (
        profileSection?.classList.contains("account-hidden") &&
        reviewsSection?.classList.contains("account-hidden") &&
        affiliateSection?.classList.contains("account-hidden")
      ) {
        activateTab("profile");
      }
    }
  });

  loadAccountInfo();
});
