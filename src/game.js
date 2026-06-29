(() => {
  "use strict";

  const addPolish = () => {
    if (!document.querySelector('link[href*="v6-polish.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "v6-polish.css?v=6";
      document.head.appendChild(link);
    }

    const shell = document.querySelector(".viewport-shell");
    if (shell && !shell.querySelector(".scanlines")) {
      const scanlines = document.createElement("div");
      scanlines.className = "scanlines";
      shell.appendChild(scanlines);
    }
  };

  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });

  const showError = error => {
    console.error(error);
    const message = document.getElementById("message");
    if (message) {
      message.textContent = "V6 LOAD ERROR — CLOSE THE TAB AND REOPEN";
      message.classList.add("show");
    }
  };

  addPolish();
  loadScript("src/v6-core.js?v=6")
    .then(() => loadScript("src/v6-engine.js?v=6"))
    .then(() => loadScript("src/v6-combat.js?v=6"))
    .then(() => loadScript("src/v6-boot.js?v=6"))
    .catch(showError);
})();
