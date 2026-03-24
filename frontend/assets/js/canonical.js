(function () {
  var ORIGIN = "https://deetechfullytested.vercel.app";
  var path = window.location.pathname.replace(/\\/g, "/");
  var file = path.split("/").pop() || "index.html";
  var params = new URLSearchParams(window.location.search || "");
  var canonical = ORIGIN;

  function normalizeCategory(value) {
    var v = String(value || "").trim().toLowerCase();
    if (!v || v === "all") return "all";
    if (v.indexOf("laptop") === 0) return "laptops";
    if (v.indexOf("phone") === 0) return "phones";
    if (v.indexOf("monitor") === 0) return "monitors";
    if (v.indexOf("access") === 0) return "accessories";
    if (v.indexOf("stor") === 0) return "storage";
    if (v.indexOf("print") === 0) return "printers";
    return v;
  }

  if (!file || file === "index.html") {
    canonical = ORIGIN + "/";
  } else if (file === "products.html") {
    var rawCategory = (params.get("category") || params.get("cat") || "").trim();
    var category = normalizeCategory(rawCategory);
    canonical = ORIGIN + "/products.html";
    if (category && category !== "all") {
      canonical += "?category=" + encodeURIComponent(category);
    }
  } else if (file === "account.html") {
    var tab = (params.get("tab") || "").trim().toLowerCase();
    canonical = ORIGIN + "/account.html";
    if (tab === "reviews") {
      canonical += "?tab=reviews";
    }
  } else {
    canonical = ORIGIN + "/" + file;
  }

  var canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement("link");
    canonicalLink.setAttribute("rel", "canonical");
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute("href", canonical);
})();
