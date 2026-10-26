"use strict";

/*
  Standing Ovation: shared page script (all pages).

  Security notes:
  - This file does NOT set, read or change any payment, Amazon, Lulu or WhatsApp link.
    Those are plain <a href> elements in the HTML.
  - It reads no URL parameters and performs no network requests or redirects.
  - It never writes HTML (no innerHTML / eval / new Function / document.write).
  - Browser storage holds only cosmetic things: theme, language, music flag and position,
    and the time the visitor last opened the Green Room. None of it is trusted for anything else.
  - Visual effects set CSS variables with style.setProperty (allowed by the page's CSP).
*/

const root = document.documentElement;
const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const tr = (key, fallback) => (typeof window.soT === "function" && window.soT(key)) || fallback;

function setupTheme() {
  const button = document.getElementById("themeToggle");
  if (!button) {
    return;
  }

  function label() {
    const light = root.getAttribute("data-theme") === "light";
    button.setAttribute(
      "aria-label",
      light ? tr("theme.toDark", "Switch to dark mode") : tr("theme.toLight", "Switch to light mode")
    );
  }

  button.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.classList.add("theme-anim");
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("so_theme", next);
    } catch {
      // Storage may be unavailable.
    }
    label();
    window.setTimeout(() => root.classList.remove("theme-anim"), 650);
  });

  document.addEventListener("so:lang", label);
  label();
}

function setupNav() {
  const nav = document.getElementById("nav");
  if (!nav) {
    return;
  }
  const progress = document.getElementById("progress");
  const burger = document.getElementById("navBurger");
  const heroBg = document.querySelector(".hero-bg");
  let ticking = false;

  function update() {
    ticking = false;
    const y = window.scrollY || 0;
    nav.classList.toggle("scrolled", y > 24);

    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty("--p", max > 0 ? String(Math.min(1, y / max)) : "0");
    }

    if (heroBg && !calm && y < window.innerHeight * 1.3) {
      heroBg.style.setProperty("--py", String(Math.round(y * 0.22)) + "px");
    }
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  window.addEventListener("resize", update);
  update();

  if (burger) {
    const close = () => {
      nav.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    };
    burger.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll(".nav-links a").forEach((link) => link.addEventListener("click", close));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
      }
    });
  }

  // Highlight the nav link of the section being read.
  if ("IntersectionObserver" in window) {
    const links = new Map();
    nav.querySelectorAll('.nav-links a[href^="#"]').forEach((link) => {
      links.set(link.getAttribute("href").slice(1), link);
    });
    if (links.size) {
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const link = links.get(entry.target.id);
            if (link && entry.isIntersecting) {
              links.forEach((other) => other.classList.remove("active"));
              link.classList.add("active");
            }
          });
        },
        { rootMargin: "-45% 0px -50% 0px" }
      );
      links.forEach((_link, id) => {
        const section = document.getElementById(id);
        if (section) {
          spy.observe(section);
        }
      });
    }
  }
}

function setupReveal() {
  document.querySelectorAll("[data-stagger]").forEach((group) => {
    Array.from(group.children).forEach((child, index) => {
      child.style.setProperty("--d", String(index * 110) + "ms");
    });
  });

  const elements = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("in"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  elements.forEach((element) => observer.observe(element));
}

function setupPointerEffects() {
  if (calm || !canHover) {
    return;
  }

  document.querySelectorAll(".tilt").forEach((element) => {
    const max = Number.parseFloat(element.dataset.tilt || "9") || 9;
    element.addEventListener("pointermove", (event) => {
      const box = element.getBoundingClientRect();
      const px = (event.clientX - box.left) / box.width;
      const py = (event.clientY - box.top) / box.height;
      element.style.setProperty("--ry", ((px - 0.5) * 2 * max).toFixed(2) + "deg");
      element.style.setProperty("--rx", ((0.5 - py) * 2 * max).toFixed(2) + "deg");
      element.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      element.style.setProperty("--my", (py * 100).toFixed(1) + "%");
    });
    element.addEventListener("pointerleave", () => {
      element.style.setProperty("--rx", "0deg");
      element.style.setProperty("--ry", "0deg");
    });
  });

  document.querySelectorAll(".glow").forEach((element) => {
    element.addEventListener("pointermove", (event) => {
      const box = element.getBoundingClientRect();
      element.style.setProperty("--mx", String(Math.round(event.clientX - box.left)) + "px");
      element.style.setProperty("--my", String(Math.round(event.clientY - box.top)) + "px");
    });
  });

  // Buttons lean gently toward the pointer.
  document.querySelectorAll(".btn").forEach((button) => {
    button.addEventListener("pointermove", (event) => {
      const box = button.getBoundingClientRect();
      const dx = (event.clientX - (box.left + box.width / 2)) / box.width;
      const dy = (event.clientY - (box.top + box.height / 2)) / box.height;
      button.style.setProperty("--tx", (dx * 12).toFixed(1) + "px");
      button.style.setProperty("--ty", (dy * 8).toFixed(1) + "px");
    });
    button.addEventListener("pointerleave", () => {
      button.style.setProperty("--tx", "0px");
      button.style.setProperty("--ty", "0px");
    });
  });
}

function setupButtonPop() {
  document.querySelectorAll(".btn").forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.remove("pop");
      void button.offsetWidth;
      button.classList.add("pop");
    });
    button.addEventListener("animationend", (event) => {
      if (event.animationName === "pop") {
        button.classList.remove("pop");
      }
    });
  });
}

function setupDust() {
  const box = document.getElementById("dust");
  if (!box || calm) {
    return;
  }
  for (let i = 0; i < 20; i += 1) {
    const mote = document.createElement("span");
    mote.style.setProperty("--x", String(Math.round(Math.random() * 100)) + "%");
    mote.style.setProperty("--s", (1.5 + Math.random() * 3.5).toFixed(1) + "px");
    mote.style.setProperty("--dur", (11 + Math.random() * 12).toFixed(1) + "s");
    mote.style.setProperty("--delay", (-Math.random() * 20).toFixed(1) + "s");
    mote.style.setProperty("--dx", String(Math.round(-50 + Math.random() * 100)) + "px");
    box.appendChild(mote);
  }
}

function setupCurtain() {
  if (!root.classList.contains("curtain")) {
    return;
  }
  const done = () => root.classList.add("curtain-done");
  const right = document.querySelector(".cur-r");
  if (right) {
    right.addEventListener("animationend", done, { once: true });
  }
  window.setTimeout(done, 3800);
}

function setupNewBadge() {
  const links = document.querySelectorAll("[data-gr-link]");
  const posts = Array.isArray(window.SO_POSTS) ? window.SO_POSTS : [];
  if (!links.length || !posts.length) {
    return;
  }

  const latest = Math.max(...posts.map((post) => Date.parse(post.date) || 0));
  let seen = 0;
  try {
    seen = Number.parseFloat(localStorage.getItem("so_gr_seen") || "0") || 0;
  } catch {
    seen = 0;
  }

  if (document.getElementById("grFeed")) {
    try {
      localStorage.setItem("so_gr_seen", String(latest));
    } catch {
      // Storage may be unavailable.
    }
    return;
  }

  if (latest > seen) {
    links.forEach((link) => link.classList.add("has-new"));
  }
}

function setupMusic() {
  const audio = document.getElementById("bgMusic");
  const button = document.getElementById("musicBtn");
  const label = document.getElementById("musicLabel");

  if (!audio || !button || !label) {
    return;
  }

  audio.volume = 0.35;

  function updateUI(isPlaying) {
    button.classList.toggle("playing", isPlaying);
    button.setAttribute("aria-pressed", String(isPlaying));
    label.textContent = isPlaying ? tr("music.on", "Music on") : tr("music.play", "Play music");
    button.setAttribute(
      "aria-label",
      isPlaying
        ? tr("music.aria.pause", "Pause background music")
        : tr("music.aria.play", "Play background music")
    );
  }

  document.addEventListener("so:lang", () => updateUI(!audio.paused));
  updateUI(!audio.paused);

  function readStoredTime() {
    try {
      const value = Number.parseFloat(sessionStorage.getItem("so_t") || "0");
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  async function play() {
    const storedTime = readStoredTime();

    if (storedTime > 0) {
      try {
        audio.currentTime = storedTime;
      } catch {
        // Ignore an invalid media seek.
      }
    }

    try {
      await audio.play();
      updateUI(true);

      try {
        localStorage.setItem("so_music", "on");
      } catch {
        // Storage may be unavailable.
      }

      return true;
    } catch {
      updateUI(false);
      return false;
    }
  }

  function pause() {
    audio.pause();
    updateUI(false);

    try {
      localStorage.setItem("so_music", "off");
    } catch {
      // Storage may be unavailable.
    }
  }

  button.addEventListener("click", () => {
    if (audio.paused) {
      void play();
    } else {
      pause();
    }
  });

  window.addEventListener("pagehide", () => {
    try {
      sessionStorage.setItem("so_t", String(audio.currentTime));
    } catch {
      // Storage may be unavailable.
    }
  });

  let wantsMusic = false;

  try {
    wantsMusic = localStorage.getItem("so_music") === "on";
  } catch {
    wantsMusic = false;
  }

  if (wantsMusic) {
    audio.preload = "auto";

    // Browsers block autoplay until the visitor interacts, so retry once on the first gesture.
    void play().then((started) => {
      if (started) {
        return;
      }

      const retry = () => {
        void play();
      };

      ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
        window.addEventListener(eventName, retry, { once: true });
      });
    });
  }
}

function setupStoreToggle() {
  const tabs = document.querySelectorAll(".store-tab");
  if (!tabs.length) {
    return;
  }
  const toggle = document.getElementById("storeToggle");

  // Without JavaScript both stores stay visible one under the other.
  function show(name) {
    tabs.forEach((tab) => {
      tab.setAttribute("aria-pressed", String(tab.dataset.store === name));
    });
    document.querySelectorAll(".store-pane").forEach((pane) => {
      pane.hidden = pane.dataset.store !== name;
      pane.classList.toggle("is-active", pane.dataset.store === name);
    });
    if (toggle) {
      toggle.classList.toggle("is-lulu", name === "lulu");
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => show(tab.dataset.store));
  });
  show("amazon");
}

function init() {
  root.classList.add("js", "ready");
  setupTheme();
  setupNav();
  setupReveal();
  setupStoreToggle();
  setupMusic();
  setupPointerEffects();
  setupButtonPop();
  setupDust();
  setupCurtain();
  setupNewBadge();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
