// Checks assets/posts.js (the Green Room data) so a typo can never publish a broken page.
// The file is run in an empty sandbox with no network, files or page access.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const file = path.join(process.cwd(), "assets", "posts.js");
let failed = false;
function fail(message) {
  console.error(`POSTS FAILURE: ${message}`);
  failed = true;
}

const sandbox = { window: {} };
try {
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { timeout: 1000 });
} catch (error) {
  fail(`assets/posts.js could not be read: ${error.message}`);
}

const posts = sandbox.window.SO_POSTS;
if (!Array.isArray(posts)) {
  fail("window.SO_POSTS must be a list.");
} else {
  const ids = new Set();
  let pinned = 0;
  posts.forEach((post, index) => {
    const where = `post ${index + 1}`;
    if (!post || typeof post !== "object") {
      fail(`${where} is not an object.`);
      return;
    }
    if (typeof post.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(post.id)) {
      fail(`${where}: id must use lowercase letters, numbers and dashes only.`);
    } else if (ids.has(post.id)) {
      fail(`${where}: the id "${post.id}" is used twice.`);
    } else {
      ids.add(post.id);
    }
    if (typeof post.date !== "string" || Number.isNaN(Date.parse(post.date))) {
      fail(`${where}: date is not valid.`);
    }
    if (!["update", "poem", "article"].includes(post.type)) {
      fail(`${where}: type must be "update", "poem" or "article".`);
    }
    if (typeof post.body !== "string" || !post.body.trim()) {
      fail(`${where}: the body is empty.`);
    } else if (post.body.length > 60000) {
      fail(`${where}: the body is too long.`);
    }
    if (post.type !== "update" && !(typeof post.title === "string" && post.title.trim())) {
      fail(`${where}: poems and articles need a title.`);
    }
    if (post.pinned) pinned += 1;
  });
  if (pinned > 1) {
    fail("Only one post can be pinned.");
  }
}

if (failed) {
  process.exit(1);
}
console.log("Green Room posts check passed.");
