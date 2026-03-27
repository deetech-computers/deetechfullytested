// assets/js/account-mobile-reveal.js
(function () {
  function isMobile() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  }

  let lastTapTs = 0;
  function bindTapOnce(el, handler) {
    if (!el) return;
    const wrapped = (event) => {
      const now = Date.now();
      if (now - lastTapTs < 250) {
        event.preventDefault();
        return;
      }
      lastTapTs = now;
      event.preventDefault();
      event.stopPropagation();
      handler();
    };
    el.addEventListener("pointerup", wrapped);
    el.addEventListener("click", wrapped);
  }

  function init() {
    const sidebar = document.querySelector(".account-layout .account-sidebar");
    const content = document.querySelector(".account-layout .account-content");
    if (!sidebar || !content) return;

    const openCurrentBtn = document.querySelector("[data-account-open-current]");
    const backBtn = document.querySelector("[data-account-back]");

    const showMenu = () => {
      if (!isMobile()) {
        sidebar.classList.remove("account-hidden");
        content.classList.remove("account-hidden");
        return;
      }
      content.classList.add("account-hidden");
      sidebar.classList.remove("account-hidden");
    };

    const openContent = () => {
      content.classList.remove("account-hidden");
      if (isMobile()) {
        sidebar.classList.add("account-hidden");
      } else {
        sidebar.classList.remove("account-hidden");
      }
    };

    bindTapOnce(openCurrentBtn, openContent);
    bindTapOnce(backBtn, showMenu);

    if (isMobile()) {
      showMenu();
      window.scrollTo({ top: 0, behavior: "auto" });
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    } else {
      openContent();
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    window.addEventListener("resize", () => {
      if (!isMobile()) {
        sidebar.classList.remove("account-hidden");
        content.classList.remove("account-hidden");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();