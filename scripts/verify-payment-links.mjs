import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const EXPECTED_PAYSTACK_URL = "https://paystack.shop/pay/standing-ovation";
const EXPECTED_LULU_URL =
  "https://www.lulu.com/shop/olulowo-adebayo-ogundipe/standing-ovation/paperback/product-yvqk2d2.html?page=1&pageSize=4";
const EXPECTED_WHATSAPP_URL = "https://wa.me/qr/BI523PI6DXGLJ1";

const HTML_FILES = ["index.html", "chapter-one.html"];
const CODE_FILES = [
  "index.html",
  "chapter-one.html",
  "green-room.html",
  "studio.html",
  "assets/theme.js",
  "assets/site.js",
  "assets/i18n.js",
  "assets/green-room.js",
  "assets/studio.js",
  "assets/base.css",
  "assets/index.css",
  "assets/green-room.css",
  "assets/chapter-one.css",
];

const forbiddenPaymentPatterns = [
  /paystack\.co\/transaction\/initialize/i,
  /sk_live_/i,
  /sk_test_/i,
  /secret[_-]?key/i,
];

let failed = false;

function fail(message) {
  console.error(`SECURITY FAILURE: ${message}`);
  failed = true;
}

function read(relativeFile) {
  return fs.readFileSync(path.join(ROOT, relativeFile), "utf8");
}

// 1. No secrets / server-side payment calls anywhere in shipped code.
for (const relativeFile of CODE_FILES) {
  const source = read(relativeFile);

  for (const pattern of forbiddenPaymentPatterns) {
    if (pattern.test(source)) {
      fail(`forbidden payment/backend pattern in ${relativeFile}: ${pattern}`);
    }
  }
}

// 2. Every Paystack URL in shipped code must be exactly the approved one.
for (const relativeFile of CODE_FILES) {
  const source = read(relativeFile);
  const paystackUrls = [
    ...source.matchAll(
      /https:\/\/paystack\.shop\/pay\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g
    ),
  ].map((match) => match[0]);

  for (const url of paystackUrls) {
    if (url !== EXPECTED_PAYSTACK_URL) {
      fail(`unexpected Paystack destination in ${relativeFile}: ${url}`);
    }
  }
}

// 3. Any other paystack host reference is unexpected.
for (const relativeFile of CODE_FILES) {
  const hosts = [...read(relativeFile).matchAll(/https?:\/\/[^\s"'<>)]*paystack[^\s"'<>)]*/gi)]
    .map((match) => match[0])
    .filter((url) => url !== EXPECTED_PAYSTACK_URL);

  for (const url of hosts) {
    fail(`unexpected Paystack-related URL in ${relativeFile}: ${url}`);
  }
}

// 4. Anchors: the reserve button, Lulu and WhatsApp links must be static and exact.
for (const relativeFile of HTML_FILES) {
  const source = read(relativeFile);
  const anchors = [...source.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]);
  const hrefOf = (tag) => {
    const found = tag.match(/\shref="([^"]*)"/i);
    return found ? found[1].replaceAll("&amp;", "&") : null;
  };

  const reserve = anchors.filter((tag) => /\sid="reserveBtn"/.test(tag));
  if (reserve.length !== 1) {
    fail(`${relativeFile}: expected exactly one #reserveBtn, found ${reserve.length}`);
  } else if (hrefOf(reserve[0]) !== EXPECTED_PAYSTACK_URL) {
    fail(`${relativeFile}: #reserveBtn href is not the approved Paystack URL`);
  }

  for (const tag of anchors) {
    const href = hrefOf(tag);

    if (href && /lulu\.com/i.test(href) && href !== EXPECTED_LULU_URL) {
      fail(`${relativeFile}: unexpected Lulu destination: ${href}`);
    }

    if (href && /wa\.me|whatsapp/i.test(href) && href !== EXPECTED_WHATSAPP_URL) {
      fail(`${relativeFile}: unexpected WhatsApp destination: ${href}`);
    }
  }
}

// 5. index.html must contain the Lulu and WhatsApp links exactly as approved.
{
  const index = read("index.html").replaceAll("&amp;", "&");

  if (!index.includes(`href="${EXPECTED_LULU_URL}"`)) {
    fail("index.html: approved Lulu link not found");
  }

  if (!index.includes(`href="${EXPECTED_WHATSAPP_URL}"`)) {
    fail("index.html: approved WhatsApp link not found");
  }
}

// 6. Amazon: every Amazon link and /amazon redirect target must be an approved store URL.
{
  const AMAZON_URLS = [
  "https://www.amazon.com/s?k=standing+ovation+olulowo+adebayo+ogundipe",
  "https://www.amazon.co.uk/dp/9786705181",
  "https://www.amazon.de/dp/9786705181",
  "https://www.amazon.fr/dp/9786705181",
  "https://www.amazon.es/dp/9786705181",
  "https://www.amazon.it/dp/9786705181",
  "https://www.amazon.nl/dp/9786705181",
  "https://www.amazon.pl/dp/9786705181",
  "https://www.amazon.se/dp/9786705181",
  "https://www.amazon.com.be/dp/9786705181",
  "https://www.amazon.ie/dp/9786705181",
  "https://www.amazon.co.jp/dp/9786705181",
  "https://www.amazon.ca/dp/9786705181",
  "https://www.amazon.com.au/dp/9786705181"
];
  const COUNTRIES = ["GB", "DE", "FR", "ES", "IT", "NL", "PL", "SE", "BE", "IE", "JP", "CA", "AU"];
  for (const f of HTML_FILES) {
    for (const m of read(f).matchAll(/https:\/\/www\.amazon\.[a-z.]+\/[^\s"'<>]*/g)) {
      if (!AMAZON_URLS.includes(m[0])) fail(`${f}: unapproved Amazon URL ${m[0]}`);
    }
  }
  const toml = read("netlify.toml");
  for (const m of toml.matchAll(/to\s*=\s*"(https:\/\/www\.amazon\.[^"]+)"/g)) {
    if (!AMAZON_URLS.includes(m[1])) fail(`netlify.toml: unapproved Amazon redirect ${m[1]}`);
  }
  for (const c of COUNTRIES) {
    if (!toml.includes(`Country = ["${c}"]`)) fail(`netlify.toml: missing /amazon rule for ${c}`);
  }
  const last = toml.slice(toml.lastIndexOf('from = "/amazon"'));
  if (!last.includes("amazon.com/s?k=") || last.includes("conditions")) {
    fail("netlify.toml: the last /amazon rule must be the unconditional US fallback");
  }
}

// 7. Price: the book has one fixed price (₦20,000). Fail if the old preorder price or a deadline comes back.
{
  for (const f of CODE_FILES) {
    const text = read(f);
    if (/₦\s?25,?000|25k/i.test(text)) fail(`${f}: old price ₦25,000 is still present`);
  }
  for (const f of HTML_FILES) {
    if (!read(f).includes("₦20,000")) fail(`${f}: the ₦20,000 price is missing`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("Payment destination integrity check passed.");
