"use strict";

/*
  Standing Ovation: runs first, before the page paints, so there is no flash of the wrong theme.
  - Sets data-theme (light or dark) from the visitor's saved choice, else from their device setting.
  - Adds the "js" class so scripted styles apply, and the "curtain" class once per browser session
    on pages marked data-curtain (home page), unless the visitor prefers reduced motion.
  No network requests, no HTML writing. Storage holds only cosmetic choices.
*/
(function () {
  var root = document.documentElement;
  root.classList.add("js");

  var theme = null;
  try {
    theme = localStorage.getItem("so_theme");
  } catch (e) {
    theme = null;
  }
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  root.setAttribute("data-theme", theme);

  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (root.hasAttribute("data-curtain") && !calm) {
    var seen = true;
    try {
      seen = sessionStorage.getItem("so_curtain") === "1";
      if (!seen) sessionStorage.setItem("so_curtain", "1");
    } catch (e) {
      seen = true;
    }
    if (!seen) root.classList.add("curtain");
  }
})();
