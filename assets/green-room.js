"use strict";

/*
  Standing Ovation: Green Room renderer (green-room.html, the home-page teaser and the studio preview).
  Reads window.SO_POSTS from assets/posts.js and builds the chat bubbles with createElement and
  textContent only, so a post can never inject markup or scripts. No network requests.

  Post text rules: a blank line starts a new paragraph, "## " starts a sub-heading, "---" is a divider,
  and *italic* / **bold** work inside a line. Links are not supported on purpose.
*/
(function () {
  const tr = (key, fallback) => (typeof window.soT === "function" && window.soT(key)) || fallback;
  const NAME = "Olulowo A. Ogundipe";
  const TYPES = {
    update: ["t.update", "Update"],
    poem: ["t.poem", "Poem"],
    article: ["t.article", "Article"],
  };
  const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let filter = "all";

  function lang() {
    return document.documentElement.lang || "en";
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = text;
    }
    return node;
  }

  function addInline(parent, text) {
    text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).forEach((part) => {
      if (!part) {
        return;
      }
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        parent.appendChild(make("strong", "", part.slice(2, -2)));
      } else if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
        parent.appendChild(make("em", "", part.slice(1, -1)));
      } else {
        parent.appendChild(document.createTextNode(part));
      }
    });
  }

  function buildBody(post) {
    const wrap = make("div", "b-body");
    wrap.setAttribute("lang", "en");
    String(post.body || "")
      .replace(/\r\n?/g, "\n")
      .trim()
      .split(/\n{2,}/)
      .forEach((block) => {
        const text = block.trim();
        if (!text) {
          return;
        }
        if (text === "---") {
          wrap.appendChild(document.createElement("hr"));
          return;
        }
        if (text.startsWith("## ")) {
          wrap.appendChild(make("h4", "", text.slice(3).trim()));
          return;
        }
        const paragraph = document.createElement("p");
        text.split("\n").forEach((line, index) => {
          if (index) {
            paragraph.appendChild(document.createElement("br"));
          }
          addInline(paragraph, line);
        });
        wrap.appendChild(paragraph);
      });
    return wrap;
  }

  function wordCount(post) {
    return (String(post.body || "").trim().match(/\S+/g) || []).length;
  }

  function dayLabel(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const that = new Date(date);
    that.setHours(0, 0, 0, 0);
    const diff = Math.round((that - today) / 86400000);
    try {
      if (diff === 0 || diff === -1) {
        const text = new Intl.RelativeTimeFormat(lang(), { numeric: "auto" }).format(diff, "day");
        return text.charAt(0).toLocaleUpperCase(lang()) + text.slice(1);
      }
      return new Intl.DateTimeFormat(lang(), { dateStyle: "long" }).format(date);
    } catch {
      return date.toDateString();
    }
  }

  function timeLabel(date) {
    try {
      return new Intl.DateTimeFormat(lang(), { timeStyle: "short" }).format(date);
    } catch {
      return "";
    }
  }

  function buildMessage(post, options) {
    const opts = options || {};
    const date = new Date(post.date);
    const message = make("article", "msg");
    message.dataset.type = post.type;
    message.id = "p-" + post.id;

    const avatar = make("div", "avatar sm", "OA");
    avatar.setAttribute("aria-hidden", "true");
    message.appendChild(avatar);

    const bubble = make("div", "bubble");
    const head = make("div", "b-head");
    head.appendChild(make("span", "b-name", NAME));
    const kind = TYPES[post.type] || TYPES.update;
    head.appendChild(make("span", "tag tag-" + (TYPES[post.type] ? post.type : "update"), tr(kind[0], kind[1])));
    bubble.appendChild(head);

    if (post.title) {
      const title = make("h3", "b-title", post.title);
      title.setAttribute("lang", "en");
      bubble.appendChild(title);
    }

    const body = buildBody(post);
    const words = wordCount(post);
    if (opts.snippet) {
      body.classList.add("snip");
    }
    bubble.appendChild(body);

    if (!opts.snippet && words > 110) {
      body.classList.add("collapsed");
      const more = make("button", "b-more", tr("grp.more", "Read more"));
      more.type = "button";
      more.setAttribute("aria-expanded", "false");
      more.addEventListener("click", () => {
        const open = !body.classList.toggle("collapsed");
        more.textContent = open ? tr("grp.less", "Show less") : tr("grp.more", "Read more");
        more.setAttribute("aria-expanded", String(open));
      });
      bubble.appendChild(more);
    }

    const foot = make("div", "b-foot");
    if (post.type !== "update" || words > 110) {
      const minutes = Math.max(1, Math.round(words / 200));
      foot.appendChild(make("span", "", tr("grp.min", "{n} min read").replace("{n}", String(minutes))));
    }
    const time = make("time", "", timeLabel(date));
    time.setAttribute("datetime", date.toISOString());
    foot.appendChild(time);
    bubble.appendChild(foot);

    message.appendChild(bubble);
    return message;
  }

  function sortedPosts() {
    const list = Array.isArray(window.SO_POSTS) ? window.SO_POSTS.slice() : [];
    return list
      .filter((post) => post && !Number.isNaN(Date.parse(post.date)))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }

  function watch(nodes) {
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("in"));
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
      { threshold: 0.08 }
    );
    nodes.forEach((node) => observer.observe(node));
  }

  function firstLine(post) {
    return String(post.body || "").trim().split("\n")[0].replace(/[*#]/g, "").slice(0, 140);
  }

  function renderFeed() {
    const feed = document.getElementById("grFeed");
    if (!feed) {
      return;
    }
    const all = sortedPosts();

    document.querySelectorAll(".chip").forEach((chip) => {
      const key = chip.dataset.filter;
      const count = key === "all" ? all.length : all.filter((post) => post.type === key).length;
      let badge = chip.querySelector(".n");
      if (!badge) {
        badge = make("span", "n");
        chip.appendChild(badge);
      }
      badge.textContent = String(count);
      chip.setAttribute("aria-pressed", String(key === filter));
    });

    feed.textContent = "";
    const list = all.filter((post) => filter === "all" || post.type === filter);
    if (!list.length) {
      feed.appendChild(make("p", "chat-empty", tr("grp.empty", "Nothing here yet. Check back soon.")));
    }

    let lastDay = "";
    const nodes = [];
    list.forEach((post, index) => {
      const date = new Date(post.date);
      const key = date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();
      if (key !== lastDay) {
        lastDay = key;
        feed.appendChild(make("div", "day", dayLabel(date)));
      }
      const message = buildMessage(post);
      message.style.setProperty("--d", String(Math.min(index, 5) * 90) + "ms");
      feed.appendChild(message);
      nodes.push(message);
    });
    watch(nodes);

    const bar = document.getElementById("grPinned");
    if (bar) {
      const pinned = all.find((post) => post.pinned);
      bar.hidden = !pinned;
      if (pinned) {
        bar.querySelector(".pinned-text").textContent = pinned.title || firstLine(pinned);
        bar.dataset.target = "p-" + pinned.id;
      }
    }
  }

  function renderTeaser() {
    const box = document.getElementById("grTeaser");
    const section = document.getElementById("greenroom");
    if (!box) {
      return;
    }
    const all = sortedPosts();
    if (section) {
      section.hidden = all.length === 0;
    }
    box.textContent = "";
    const nodes = [];
    all.slice(0, 2).forEach((post, index) => {
      const message = buildMessage(post, { snippet: true });
      message.style.setProperty("--d", String(index * 120) + "ms");
      box.appendChild(message);
      nodes.push(message);
    });
    watch(nodes);
  }

  function setupControls() {
    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        filter = chip.dataset.filter || "all";
        renderFeed();
      });
    });

    const bar = document.getElementById("grPinned");
    if (bar) {
      bar.addEventListener("click", () => {
        if (filter !== "all") {
          filter = "all";
          renderFeed();
        }
        const target = document.getElementById(bar.dataset.target || "");
        if (target) {
          target.classList.add("in");
          target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
          target.classList.remove("flash");
          void target.offsetWidth;
          target.classList.add("flash");
        }
      });
    }
  }

  window.soGreenRoom = { buildMessage: buildMessage, dayLabel: dayLabel };

  function init() {
    setupControls();
    renderFeed();
    renderTeaser();
    document.addEventListener("so:lang", () => {
      renderFeed();
      renderTeaser();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
