// assets/js/account-sidebar-profile.js
(function () {
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
    document.addEventListener("DOMContentLoaded", fillIdentity);
  } else {
    fillIdentity();
  }
})();
