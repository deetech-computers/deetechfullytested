// assets/js/account-sidebar-profile.js
(function () {
  function alignActiveMobileQuickNav(behavior = "auto") {
    const nav = document.querySelector(".account-mobile-quicknav");
    const activeLink = nav?.querySelector("a.account-active");
    if (!nav || !activeLink) return;

    const navRect = nav.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const outsideViewport = linkRect.left < navRect.left || linkRect.right > navRect.right;
    if (!outsideViewport) return;

    activeLink.scrollIntoView({ behavior, block: "nearest", inline: "center" });
  }

  function fillIdentity() {
    const nameEl = document.getElementById("accountSidebarName");
    const emailEl = document.getElementById("accountSidebarEmail");
    if (!nameEl && !emailEl) return;

    const user = window.auth?.getUser?.() || null;
    const first = String(user?.firstName || user?.name || "Customer").trim().split(/\s+/)[0] || "Customer";
    const email = user?.email || "guest@deetech.com";

    if (nameEl) nameEl.textContent = `Hello! ${first}`;
    if (emailEl) emailEl.textContent = email;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      fillIdentity();
      requestAnimationFrame(() => alignActiveMobileQuickNav("auto"));
    });
  } else {
    fillIdentity();
    requestAnimationFrame(() => alignActiveMobileQuickNav("auto"));
  }

  window.addEventListener("resize", () => alignActiveMobileQuickNav("auto"));
})();
