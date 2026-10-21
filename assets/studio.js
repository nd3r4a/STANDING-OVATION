"use strict";

/*
  Standing Ovation: Green Room studio (studio.html). Author-only helper.
  Turns a new post into a complete, updated assets/posts.js that the author pastes into the site folder.
  Nothing is sent anywhere and nothing is saved: it reads the posts already on the site and builds text in the page.
*/
(function () {
  const byId = (id) => document.getElementById(id);
  const typeField = byId("stType");
  const pinField = byId("stPin");
  const titleField = byId("stTitle");
  const bodyField = byId("stBody");
  const out = byId("stOut");
  const status = byId("stStatus");
  const preview = byId("stPreview");
  if (!typeField || !bodyField || !out || !preview) {
    return;
  }

  const existing = Array.isArray(window.SO_POSTS) ? window.SO_POSTS : [];
  const HEADER = [
    "/*",
    "  GREEN ROOM POSTS. This file is data only. Use studio.html to add a post: it writes the",
    "  whole updated file for you, then you paste it over this one and redeploy.",
    "",
    "  Each post has:  id (lowercase letters, numbers, dashes)  date  type (\"update\", \"poem\" or \"article\")",
    "                  pinned (true or false, only one post should be pinned)  title  body",
    "  In the body, a blank line starts a new paragraph, \"## \" starts a sub-heading, \"---\" is a divider,",
    "  and *italic* / **bold** work inside a line.",
    "*/",
  ].join("\n");

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function isoLocal(date) {
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const abs = Math.abs(offset);
    return (
      date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
      "T" + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) +
      sign + pad(Math.floor(abs / 60)) + ":" + pad(abs % 60)
    );
  }

  function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "post";
  }

  function escapeTemplate(text) {
    return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  }

  function serialize(posts) {
    const lines = [HEADER, "window.SO_POSTS = ["];
    posts.forEach((post) => {
      lines.push(
        "  {",
        "    id: " + JSON.stringify(post.id) + ",",
        "    date: " + JSON.stringify(post.date) + ",",
        "    type: " + JSON.stringify(post.type) + ",",
        "    pinned: " + (post.pinned ? "true" : "false") + ",",
        "    title: " + JSON.stringify(post.title || "") + ",",
        "    body: `" + escapeTemplate(String(post.body)) + "`,",
        "  },"
      );
    });
    lines.push("];", "");
    return lines.join("\n");
  }

  function draft() {
    const now = new Date();
    return {
      id: now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + "-" + slug(titleField.value || bodyField.value),
      date: isoLocal(now),
      type: typeField.value,
      pinned: pinField.value === "yes",
      title: titleField.value.replace(/\s*\n\s*/g, " ").trim(),
      body: bodyField.value.replace(/\r\n?/g, "\n").trim(),
    };
  }

  function problem(post) {
    if (!post.body) {
      return "Write something in the post first.";
    }
    if (post.type !== "update" && !post.title) {
      return "Poems and articles need a title.";
    }
    return "";
  }

  function showPreview() {
    preview.textContent = "";
    const post = draft();
    if (!post.body || !window.soGreenRoom) {
      return;
    }
    const message = window.soGreenRoom.buildMessage(post, {});
    message.classList.add("in");
    preview.appendChild(message);
  }

  function build() {
    const post = draft();
    const message = problem(post);
    if (message) {
      status.textContent = message;
      return;
    }
    const taken = new Set(existing.map((item) => item.id));
    let id = post.id;
    let n = 2;
    while (taken.has(id)) {
      id = post.id + "-" + String(n);
      n += 1;
    }
    post.id = id;
    const others = existing.map((item) => Object.assign({}, item, { pinned: post.pinned ? false : Boolean(item.pinned) }));
    out.value = serialize([post].concat(others));
    status.textContent = "Done. Now copy it (button below) and paste it over assets/posts.js.";
    showPreview();
  }

  function copy() {
    if (!out.value) {
      status.textContent = "Build the file first.";
      return;
    }
    const done = () => {
      status.textContent = "Copied. Paste it over the whole of assets/posts.js, save, then redeploy the site.";
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(out.value).then(done, () => {
        out.select();
        status.textContent = "Select all and copy (Ctrl or Cmd + C).";
      });
    } else {
      out.select();
      status.textContent = "Select all and copy (Ctrl or Cmd + C).";
    }
  }

  [typeField, titleField, bodyField].forEach((field) => field.addEventListener("input", showPreview));
  typeField.addEventListener("change", showPreview);
  byId("stBuild").addEventListener("click", build);
  byId("stCopy").addEventListener("click", copy);
})();
