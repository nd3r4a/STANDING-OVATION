import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const HTML_FILES = ["index.html", "chapter-one.html", "green-room.html", "studio.html"];
const JS_FILES = [
  "assets/theme.js",
  "assets/site.js",
  "assets/i18n.js",
  "assets/green-room.js",
  "assets/studio.js",
]; // posts.js is data and is checked by verify-posts.mjs instead
const CSS_FILES = ["assets/base.css", "assets/index.css", "assets/green-room.css", "assets/chapter-one.css"];

let failed = false;

function fail(message) {
  console.error(`SECURITY FAILURE: ${message}`);
  failed = true;
}

function read(relativeFile) {
  return fs.readFileSync(path.join(ROOT, relativeFile), "utf8");
}

// ---------- HTML rules ----------
for (const file of HTML_FILES) {
  const html = read(file);

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const [, attrs, body] of scripts) {
    if (body.trim() !== "") fail(`${file}: inline <script> body found`);
    const src = attrs.match(/\ssrc="([^"]*)"/i)?.[1];
    if (!src) fail(`${file}: <script> without src`);
    else if (/^[a-z]+:|^\/\//i.test(src)) fail(`${file}: external script not allowed: ${src}`);
  }

  if (/<style\b/i.test(html)) fail(`${file}: inline <style> block found`);
  if (/\sstyle\s*=/i.test(html)) fail(`${file}: inline style attribute found`);
  if (/\son[a-z]+\s*=/i.test(html)) fail(`${file}: inline event handler attribute found`);
  if (/javascript:/i.test(html)) fail(`${file}: javascript: URL found`);
  if (/<(iframe|frame|object|embed|form|input|base)\b/i.test(html)) {
    fail(`${file}: disallowed element (iframe/object/embed/form/input/base) found`);
  }
  if (/http:\/\//i.test(html.replace(/<!--[\s\S]*?-->/g, ""))) fail(`${file}: insecure http:// reference`);
  if (/data:/i.test(html)) fail(`${file}: data: URI found`);
  if (/₦0,000/.test(html)) fail(`${file}: price placeholder still present`);

  for (const tag of html.matchAll(/<a\b[^>]*>/gi)) {
    const t = tag[0];
    if (/target="_blank"/i.test(t)) {
      const rel = t.match(/\srel="([^"]*)"/i)?.[1] ?? "";
      if (!/\bnoopener\b/.test(rel) || !/\bnoreferrer\b/.test(rel)) {
        fail(`${file}: target=_blank link missing rel="noopener noreferrer": ${t}`);
      }
    }
    const href = t.match(/\shref="([^"]*)"/i)?.[1] ?? "";
    if (/^(javascript|data|file):/i.test(href)) fail(`${file}: dangerous link scheme: ${href}`);
  }

  // Every local resource must exist.
  for (const m of html.matchAll(/\s(?:src|href|poster)="(assets\/[^"#?]+)"/gi)) {
    if (!fs.existsSync(path.join(ROOT, m[1]))) fail(`${file}: missing local file ${m[1]}`);
  }

  // Only known external origins.
  const allowedOrigins = new Set([
    "https://paystack.shop",
    "https://www.lulu.com",
    "https://wa.me",
    "https://www.amazon.ca",
    "https://www.amazon.co.jp",
    "https://www.amazon.co.uk",
    "https://www.amazon.com",
    "https://www.amazon.com.au",
    "https://www.amazon.com.be",
    "https://www.amazon.de",
    "https://www.amazon.es",
    "https://www.amazon.fr",
    "https://www.amazon.ie",
    "https://www.amazon.it",
    "https://www.amazon.nl",
    "https://www.amazon.pl",
    "https://www.amazon.se",
  ]);
  for (const m of html.replace(/<!--[\s\S]*?-->/g, "").matchAll(/https:\/\/[^\s"'<>)]+/g)) {
    let origin;
    try { origin = new URL(m[0]).origin; } catch { fail(`${file}: unparsable URL ${m[0]}`); continue; }
    if (!allowedOrigins.has(origin)) fail(`${file}: unexpected external origin ${origin}`);
  }
}

// ---------- JavaScript rules ----------
const bannedJs = [
  [/\beval\s*\(/, "eval()"],
  [/new\s+Function\s*\(/, "new Function()"],
  [/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML/, "HTML string injection"],
  [/document\.write/, "document.write"],
  [/\.href\s*=/, "assigning .href"],
  [/location\s*(\.\s*(href|assign|replace))?\s*[=(]/, "navigation via location"],
  [/window\.open\s*\(/, "window.open"],
  [/URLSearchParams|location\.search|location\.hash/, "reading URL parameters"],
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/, "network request"],
  [/createElement\(\s*["']script/i, "dynamic script element"],
  [/https?:\/\//, "hard-coded URL"],
];
for (const file of JS_FILES) {
  const src = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const [pattern, label] of bannedJs) {
    if (pattern.test(src)) fail(`${file}: ${label} found`);
  }
}

// ---------- CSS rules ----------
for (const file of CSS_FILES) {
  const css = read(file);
  if (/@import/i.test(css)) fail(`${file}: @import found`);
  if (/expression\s*\(|javascript:/i.test(css)) fail(`${file}: script-capable CSS found`);
  if (/data:/i.test(css)) fail(`${file}: data: URI found`);
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (/^[a-z]+:|^\/\//i.test(m[1])) fail(`${file}: external url() ${m[1]}`);
    else if (!fs.existsSync(path.join(ROOT, "assets", m[1]))) fail(`${file}: missing file ${m[1]}`);
  }
}

// ---------- _headers rules ----------
{
  const headers = read("_headers");
  const required = [
    "Strict-Transport-Security",
    "X-Content-Type-Options: nosniff",
    "X-Frame-Options: DENY",
    "Referrer-Policy",
    "Permissions-Policy",
    "Content-Security-Policy",
  ];
  for (const name of required) {
    if (!headers.includes(name)) fail(`_headers: missing ${name}`);
  }

  const csp = headers.match(/Content-Security-Policy:\s*(.+)/)?.[1] ?? "";
  const directive = (name) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(name + " ") || d === name) ?? "";

  if (/\*/.test(csp)) fail("CSP contains a wildcard");
  if (/unsafe-eval/.test(csp)) fail("CSP contains unsafe-eval");
  if (/(^|\s)https:(\s|;|$)/.test(csp)) fail("CSP allows any https: origin");
  if (/unsafe-inline/.test(directive("script-src"))) fail("CSP script-src allows unsafe-inline");
  if (directive("script-src") !== "script-src 'self'") fail("CSP script-src must be exactly 'self'");
  if (!directive("frame-ancestors").includes("'none'")) fail("CSP frame-ancestors must be 'none'");
  if (!directive("object-src").includes("'none'")) fail("CSP object-src must be 'none'");
  if (!directive("base-uri")) fail("CSP base-uri missing");
  if (!/default-src/.test(csp)) fail("CSP default-src missing");
  if (/includeSubDomains|preload/.test(headers)) fail("HSTS must not use includeSubDomains/preload until all subdomains are confirmed HTTPS");
}

// ---------- secret scan (whole repo, excluding binaries and this scanner) ----------
{
  const pattern = /sk_live_|sk_test_|PAYSTACK_SECRET|api[_-]?key|private[_-]?key|Authorization:\s*Bearer|BEGIN (RSA |EC )?PRIVATE KEY/i;
  const skipDirs = new Set([".git", "node_modules"]);
  const skipExt = new Set([".mp4", ".mp3", ".jpg", ".jpeg", ".png", ".webp"]);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skipDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!skipExt.has(path.extname(entry.name).toLowerCase())) {
        const rel = path.relative(ROOT, full);
        if (rel.startsWith("scripts")) continue; // scanners legitimately mention the patterns
        if (pattern.test(fs.readFileSync(full, "utf8"))) fail(`possible secret pattern in ${rel}`);
      }
    }
  };
  walk(ROOT);

  for (const bad of [".env", "secrets.json", "credentials.json"]) {
    if (fs.existsSync(path.join(ROOT, bad))) fail(`${bad} must not exist in the repository`);
  }
}

if (failed) process.exit(1);
console.log("Static security checks passed.");
