// Run AFTER deployment:  npm run security:production-payment
// Optional: PRODUCTION_URL=https://your-domain.example/ npm run security:production-payment
const PRODUCTION_URL = process.env.PRODUCTION_URL ?? "https://nd3r4a.netlify.app/";
const EXPECTED = "https://paystack.shop/pay/standing-ovation";

const PAGES = ["", "chapter-one.html"];
const REQUIRED_HEADERS = [
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "content-security-policy",
];

let failed = false;
const fail = (message) => {
  console.error(`SECURITY FAILURE: ${message}`);
  failed = true;
};

for (const page of PAGES) {
  const url = new URL(page, PRODUCTION_URL).toString();
  const response = await fetch(url, { redirect: "manual" });

  if (!response.ok) {
    fail(`${url} returned HTTP ${response.status}`);
    continue;
  }

  for (const header of REQUIRED_HEADERS) {
    if (!response.headers.has(header)) fail(`${url} is missing the ${header} header`);
  }

  const html = await response.text();

  if (/<script\b(?![^>]*\ssrc=)[^>]*>/i.test(html)) fail(`${url} contains an inline script`);

  const matches = [
    ...html.matchAll(
      /https:\/\/paystack\.shop\/pay\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g
    ),
  ].map((match) => match[0]);

  if (!matches.includes(EXPECTED)) {
    fail(`${url}: expected Paystack payment destination was not found.`);
  }

  const unexpected = matches.filter((found) => found !== EXPECTED);
  if (unexpected.length > 0) {
    fail(`${url}: unexpected Paystack destinations: ${unexpected.join(", ")}`);
  }
}

if (failed) process.exit(1);
console.log("Production payment destination and headers verified.");
