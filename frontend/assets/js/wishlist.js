// assets/js/wishlist.js
(function () {
  const { API_BASE, BASE_URL, showToast, loadCart, saveCart } = window.CONFIG || {};
  const grid = document.getElementById("wishlistGrid");
  const token = window.auth?.getToken?.();

  if (!grid) return;

  if (!token) {
    grid.innerHTML = `
      <div class="wishlist-auth-required">
        <h3>Please sign in to view your wishlist</h3>
        <p>Your wishlist is only available for logged-in users.</p>
        <a class="btn" href="login.html">Sign in</a>
      </div>
    `;
    if (typeof showToast === "function") {
      showToast("Please sign in to access your wishlist", "info");
    }
    return;
  }

  function resolveImage(src) {
    if (!src) return "assets/img/placeholder.png";
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
      return src;
    }
    if (src.startsWith("/uploads") || src.startsWith("uploads/")) {
      return `${BASE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
    }
    return src;
  }

  function getCategoryLabel(category) {
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

  function getProductId(product) {
    return String(product?._id || product?.productId || product?.id || "");
  }

  function getStock(product) {
    return Number(product?.countInStock ?? product?.stock_quantity ?? product?.stock ?? 0);
  }

  function addToCartFromWishlist(product) {
    const getCart = typeof loadCart === "function" ? loadCart : () => JSON.parse(localStorage.getItem("cart") || "[]");
    const setCart = typeof saveCart === "function" ? saveCart : (cart) => localStorage.setItem("cart", JSON.stringify(cart));

    const cart = getCart();
    const id = getProductId(product);
    if (!id) return;

    const stock = getStock(product);
    if (stock < 1) {
      if (typeof showToast === "function") showToast("Out of stock", "error");
      return;
    }

    const existing = cart.find((item) => String(item._id || item.productId || item.id) === id);
    if (existing) {
      const nextQty = Number(existing.qty || existing.quantity || 0) + 1;
      if (nextQty > stock) {
        if (typeof showToast === "function") showToast("You can't add more than available stock", "info");
        return;
      }
      existing.qty = nextQty;
    } else {
      cart.push({
        _id: id,
        productId: id,
        name: product.name,
        price: Number(product.price || 0),
        image: resolveImage(product.image || product.images?.[0]),
        qty: 1,
        countInStock: stock,
      });
    }

    setCart(cart);
    document.dispatchEvent(new Event("cart-updated"));
    if (typeof showToast === "function") showToast(`[${product.name}] added to cart`, "success");
  }

  async function loadWishlist() {
    const res = await fetch(`${API_BASE}/wishlist`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      if (typeof showToast === "function") {
        showToast(data.message || "Failed to load wishlist", "error");
      }
      return;
    }

    grid.innerHTML = "";
    grid.classList.remove("wishlist-grid-empty");
    if (!Array.isArray(data) || data.length === 0) {
      grid.classList.add("wishlist-grid-empty");
      grid.innerHTML = `
        <div class="wishlist-empty wishlist-empty-rich" role="status" aria-live="polite">
          <div class="wishlist-empty-icon" aria-hidden="true">
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

    data.forEach((p) => {
      const productId = getProductId(p);
      const stock = getStock(p);
      const shortDesc = String(p.short_description || p.description || "").trim();
      const card = document.createElement("div");
      card.className = "product-card wishlist-product-card";
      card.innerHTML = `
        <div class="product-media">
          <a href="product.html?id=${encodeURIComponent(productId)}">
            <img src="${resolveImage(p.image || p.image_url || p.images?.[0])}" alt="${p.name}" width="140" height="140" loading="lazy" decoding="async">
          </a>
          ${p.featured || p.isFeatured ? '<div class="media-badge">FEATURED</div>' : ""}
        </div>
        <div class="product-info">
          <div class="product-category">${getCategoryLabel(p.category)}</div>
          <div class="product-name">${p.name}</div>
          <div class="product-desc">${shortDesc || "No description available"}</div>
          <div class="product-divider"></div>
          <div class="product-price">GHC ${Number(p.price || 0).toFixed(2)}</div>
          <div class="product-stock ${stock > 0 ? "in" : "out"}">${stock > 0 ? `In Stock (${stock})` : "Out of Stock"}</div>
          <div class="product-actions wishlist-actions">
            <button class="add-to-cart" data-id="${productId}" ${stock > 0 ? "" : "disabled"}>${stock > 0 ? "Add to Cart" : "Out of Stock"}</button>
            <button class="wishlist-remove-btn remove-wishlist" data-id="${productId}">Remove</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    grid.querySelectorAll(".add-to-cart").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const product = data.find((item) => getProductId(item) === String(id));
        if (product) addToCartFromWishlist(product);
      });
    });

    grid.querySelectorAll(".remove-wishlist").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const res = await fetch(`${API_BASE}/wishlist/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok && typeof showToast === "function") {
          showToast("Failed to remove from wishlist", "error");
          return;
        }
        document.dispatchEvent(new Event("wishlist-updated"));
        loadWishlist();
      });
    });
  }

  loadWishlist().catch((e) => console.error(e));
})();






