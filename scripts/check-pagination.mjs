// Checks the paginated post lists of the built site. Added 2026-09-19, when the owner asked for
// a guarantee that pagination keeps working as the number of pages grows. See PAGINATION.md.
//
//   npm run check:pages          checks dist/ of this project; run it right after npm run build
//   npm run check:pages:stress   builds a temporary copy of the project with 159 generated posts
//                                added, once with 5 posts to a page and once with 1, and checks
//                                both builds; takes about a minute
//
// What it checks. The expected result is worked out here from the posts' front matter, on its
// own, without the site's code: which posts are published (no drafts, no future dates), their
// year, their order, and the pages of every list. Then the built pages are read the way a reader
// uses them - from the first page of a list to the last by following Next, and back by
// following Previous - and on every page it compares:
//
//   - the posts and their order;
//   - the addresses of Previous and Next, no Next on the last page, and no page after the last;
//   - both sets of page numbers (the full one, two pages either side of the current one, and
//     the compact one, one either side): the current page present and not a link, the first
//     and last pages present, the pages around the current one present, every link pointing at
//     its page, no more entries than allowed, and a gap only where two or more pages are skipped;
//   - on the Posts list, the year switcher: one button per year, newest first, each pointing at
//     its year, the year being shown highlighted.
//
// It does that for every year of the Posts list, every tag and every category, and also checks
// that /posts/ shows the newest year, that no year without published posts has a list, that
// every published post has its page, and that drafts and future posts have none.
//
// The rules it mirrors live in src/lib/posts.ts, src/lib/urlize.ts, src/lib/date.ts and the
// list templates. When one of them changes on purpose, change this script with it; a failure
// here after such a change means the two disagree, not necessarily that the site is wrong.
//
// Limits, on purpose: the front matter is read with a few regular expressions, not a YAML
// parser, so that the script needs no dependency. It understands what the templates in
// templates/ write - one `key: value` per line, quoted or not, and lists either as
// ["a", "b"] or as "- a" lines. Anything else is reported as a failure, not guessed at.
//
// Exit code: 0 when every check passes, 1 otherwise, so it can gate a build step.
//
// Filesystem paths use node:path rather than node:path/posix: they are real paths on the
// machine, C:\... on Windows. The site's own addresses are built as plain strings.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// ---------------------------------------------------------------------------------------------
// The site's settings and rules, read from its sources.

function readSettings(root) {
  const config = fs.readFileSync(path.join(root, "src/config.ts"), "utf8");
  const date = fs.readFileSync(path.join(root, "src/lib/date.ts"), "utf8");
  const pageSize = Number(
    config.match(/pagination:\s*\{\s*pageSize:\s*(\d+)/)?.[1],
  );
  const offsetMinutes = Number(
    date.match(/FRONT_MATTER_OFFSET_MINUTES\s*=\s*(-?\d+)/)?.[1],
  );
  if (!pageSize)
    throw new Error("pagination.pageSize not found in src/config.ts");
  if (Number.isNaN(offsetMinutes))
    throw new Error("FRONT_MATTER_OFFSET_MINUTES not found in src/lib/date.ts");
  return { pageSize, offsetMinutes };
}

// Mirrors urlize() in src/lib/urlize.ts.
const urlize = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-_.~]/gu, "")
    .replace(/-+/g, "-");

// Mirrors pageUrl() in src/lib/posts.ts: base itself for page 1, <base>page/<n>/ after it.
const pageUrl = (base, n) => (n === 1 ? base : `${base}page/${n}/`);

// ---------------------------------------------------------------------------------------------
// The posts, and what the lists should hold.

function parseFrontMatter(text, file, problems) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    problems.push(`${file}: no front matter`);
    return null;
  }
  const lines = match[1].split(/\r?\n/).filter((line) => !/^\s*#/.test(line));
  const scalar = (key) => {
    const line = lines.find((l) => l.startsWith(`${key}:`));
    if (!line) return undefined;
    return line
      .slice(key.length + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .replace(/^'(.*)'$/, "$1");
  };
  const list = (key) => {
    const index = lines.findIndex((l) => l.startsWith(`${key}:`));
    if (index === -1) return [];
    const rest = lines[index].slice(key.length + 1).trim();
    if (rest.startsWith("[")) {
      if (!rest.endsWith("]"))
        problems.push(`${file}: ${key} is not a one-line list`);
      return rest
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
    if (rest !== "") {
      problems.push(`${file}: ${key} is not a list`);
      return [];
    }
    const items = [];
    for (const line of lines.slice(index + 1)) {
      const item = line.match(/^\s+-\s+(.*)$/);
      if (!item) break;
      items.push(item[1].trim().replace(/^["']|["']$/g, ""));
    }
    return items;
  };
  const title = scalar("title");
  const dateText = scalar("date");
  const date = new Date(dateText);
  if (!title) problems.push(`${file}: no title`);
  if (!dateText || Number.isNaN(date.getTime()))
    problems.push(`${file}: no readable date`);
  return {
    file,
    slug: file.replace(/\.mdx?$/, ""),
    title: title ?? "",
    date,
    draft: scalar("draft") === "true",
    tags: list("tags").map((t) => t.toLowerCase()),
    categories: list("categories"),
  };
}

function readPosts(root, problems) {
  const dir = path.join(root, "src/content/posts");
  return fs
    .readdirSync(dir)
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) =>
      parseFrontMatter(
        fs.readFileSync(path.join(dir, file), "utf8"),
        file,
        problems,
      ),
    )
    .filter(Boolean);
}

// Mirrors getPosts(): published posts only, newest first, then by title, then by file name
// (the collection's id is the file name with its extension).
function publishedPosts(posts, now) {
  return posts
    .filter((p) => !p.draft && p.date.getTime() <= now)
    .sort(
      (a, b) =>
        b.date - a.date ||
        a.title.localeCompare(b.title) ||
        a.file.localeCompare(b.file),
    );
}

// Mirrors formatYear() in src/lib/date.ts: the year in the site's fixed time zone.
const yearOf = (post, offsetMinutes) =>
  String(
    new Date(post.date.getTime() + offsetMinutes * 60_000).getUTCFullYear(),
  );

function groupBy(posts, keysOf) {
  const groups = new Map();
  for (const post of posts) {
    for (const key of keysOf(post))
      groups.set(key, [...(groups.get(key) ?? []), post]);
  }
  return groups;
}

// ---------------------------------------------------------------------------------------------
// Reading the built pages.

function readPage(dist, url) {
  const file = path.join(dist, decodeURIComponent(url), "index.html");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

const cardsOf = (html) =>
  [
    ...html.matchAll(
      /<a href="\/posts\/([^"/]+)\/" class="absolute inset-0 z-10"/g,
    ),
  ].map((m) => decodeURIComponent(m[1]));

// The Previous or Next link: an anchor whose content contains the word, with or without an icon.
function linkOf(html, word) {
  const m = html.match(
    new RegExp(`<a href="([^"]+)"[^>]*>(?:(?!</a>)[\\s\\S])*?\\b${word}\\b`),
  );
  return m ? m[1] : null;
}

function yearSwitcherOf(html) {
  const nav = html.match(/<nav aria-label="Years"[\s\S]*?<\/nav>/);
  if (!nav) return null;
  return [
    ...nav[0].matchAll(/<a href="([^"]+)"([^>]*)>\s*(\d{4})\s*<\/a>/g),
  ].map((m) => ({
    url: m[1],
    year: m[3],
    current: /aria-current/.test(m[2]),
  }));
}

function checkNumberBlock(block, n, last, base, where, radius, fail) {
  const re =
    /<a href="([^"]+)" aria-label="Page (\d+)"[^>]*>\s*(\d+)\s*<\/a>|<span aria-current="page"[^>]*>\s*(\d+)\s*<\/span>|<span aria-hidden="true"[^>]*>\s*(?:&hellip;|\u2026)\s*<\/span>/g;
  const entries = [...block.matchAll(re)].map((m) =>
    m[4]
      ? { n: Number(m[4]), current: true }
      : m[2]
        ? { n: Number(m[3]), url: m[1], label: Number(m[2]) }
        : { gap: true },
  );
  if (entries.length > 2 * radius + 5)
    fail(`${where}: ${entries.length} entries`);
  const current = entries.filter((e) => e.current);
  if (current.length !== 1 || current[0].n !== n)
    fail(`${where}: current page ${JSON.stringify(current)}`);
  const numbers = entries.filter((e) => !e.gap);
  if (numbers[0]?.n !== 1 || numbers.at(-1)?.n !== last)
    fail(`${where}: numbers do not run from 1 to ${last}`);
  for (let k = Math.max(1, n - radius); k <= Math.min(last, n + radius); k++) {
    if (!numbers.some((e) => e.n === k)) fail(`${where}: page ${k} missing`);
  }
  for (const e of numbers) {
    if (e.url && (e.url !== pageUrl(base, e.n) || e.label !== e.n))
      fail(`${where}: link ${e.n} points at ${e.url}`);
  }
  for (let i = 1; i < entries.length; i++) {
    const a = entries[i - 1];
    const b = entries[i];
    if (a.gap && b.gap) fail(`${where}: two gaps in a row`);
    if (!a.gap && !b.gap && b.n !== a.n + 1)
      fail(`${where}: ${a.n} then ${b.n} without a gap`);
    if (a.gap && (!entries[i - 2] || b.n - entries[i - 2].n < 3))
      fail(`${where}: a gap hides fewer than two pages`);
  }
}

function checkNumbers(html, n, last, base, where, fail) {
  const blocks = [
    ...html.matchAll(
      /<div class="[^"]*\border-last\b[^"]*">([\s\S]*?)<\/div>/g,
    ),
  ];
  if (last === 1) {
    if (blocks.length) fail(`${where}: page numbers on a list of one page`);
    return;
  }
  if (blocks.length !== 2)
    return fail(
      `${where}: ${blocks.length} blocks of page numbers, expected 2`,
    );
  checkNumberBlock(
    blocks[0][1],
    n,
    last,
    base,
    `${where}, full numbers`,
    2,
    fail,
  );
  checkNumberBlock(
    blocks[1][1],
    n,
    last,
    base,
    `${where}, compact numbers`,
    1,
    fail,
  );
}

// Walks one list from its first page with Next, then back from its last page with Previous.
function checkList({
  dist,
  base,
  expected,
  pageSize,
  label,
  fail,
  years,
  currentYear,
}) {
  const last = Math.max(1, Math.ceil(expected.length / pageSize));
  const seen = [];
  let url = base;
  let n = 0;
  while (url) {
    n++;
    if (n > last) {
      fail(`${label}: Next leads past the last page, to ${url}`);
      break;
    }
    if (url !== pageUrl(base, n))
      fail(`${label}: page ${n} is at ${url}, expected ${pageUrl(base, n)}`);
    const html = readPage(dist, url);
    if (!html) {
      fail(`${label}: ${url} is missing`);
      break;
    }
    const where = `${label} page ${n}`;
    const onPage = cardsOf(html);
    const want = expected
      .slice((n - 1) * pageSize, n * pageSize)
      .map((p) => p.slug);
    if (onPage.join() !== want.join())
      fail(`${where}: shows ${onPage.join(" ")}, expected ${want.join(" ")}`);
    seen.push(...onPage);
    const prev = linkOf(html, "Previous");
    if (prev !== (n === 1 ? null : pageUrl(base, n - 1)))
      fail(`${where}: Previous points at ${prev}`);
    checkNumbers(html, n, last, base, where, fail);
    if (years) {
      const switcher = yearSwitcherOf(html);
      const wanted = years.length > 1 ? years.join() : null;
      if ((switcher ? switcher.map((s) => s.year).join() : null) !== wanted)
        fail(
          `${where}: the year switcher shows ${switcher?.map((s) => s.year).join()}`,
        );
      if (switcher && switcher.some((s) => s.url !== `/posts/${s.year}/`))
        fail(`${where}: a year button points elsewhere`);
      if (
        switcher &&
        switcher
          .filter((s) => s.current)
          .map((s) => s.year)
          .join() !== currentYear
      )
        fail(`${where}: the highlighted year is not ${currentYear}`);
    }
    url = linkOf(html, "Next");
  }
  if (n === last && seen.length !== expected.length)
    fail(
      `${label}: ${seen.length} posts over all pages, expected ${expected.length}`,
    );
  if (new Set(seen).size !== seen.length)
    fail(`${label}: a post appears twice`);
  if (readPage(dist, pageUrl(base, last + 1)))
    fail(`${label}: a page ${last + 1} exists`);
  let back = pageUrl(base, last);
  let steps = 0;
  while (back && steps <= last) {
    steps++;
    back = linkOf(readPage(dist, back) ?? "", "Previous");
  }
  if (steps !== last)
    fail(`${label}: Previous goes back over ${steps} pages, expected ${last}`);
  return last;
}

// Checks one built site against the posts of the project it was built from.
function checkBuild(root, { now = Date.now(), quiet = false } = {}) {
  const dist = path.join(root, "dist");
  const failures = [];
  const fail = (message) => failures.push(message);
  const log = (message) => quiet || console.log(message);
  if (!fs.existsSync(dist))
    return {
      failures: ["dist/ is missing - run npm run build first"],
      pages: 0,
    };

  const { pageSize, offsetMinutes } = readSettings(root);
  const all = readPosts(root, failures);
  const published = publishedPosts(all, now);
  const byYear = groupBy(published, (p) => [yearOf(p, offsetMinutes)]);
  const years = [...byYear.keys()];
  let pages = 0;

  for (const year of years) {
    const posts = byYear.get(year);
    pages += checkList({
      dist,
      base: `/posts/${year}/`,
      expected: posts,
      pageSize,
      label: `year ${year}`,
      fail,
      years,
      currentYear: year,
    });
    log(`year ${year}: ${posts.length} posts - checked`);
  }
  const home = readPage(dist, "/posts/");
  if (!home) fail("/posts/ is missing");
  else if (
    years.length &&
    cardsOf(home).join() !==
      cardsOf(readPage(dist, `/posts/${years[0]}/`) ?? "").join()
  )
    fail(`/posts/ does not show the first page of ${years[0]}`);
  else if (
    years.length > 1 &&
    yearSwitcherOf(home)?.find((s) => s.current)?.year !== years[0]
  )
    fail(`/posts/ does not highlight ${years[0]}`);

  for (const [kind, keysOf] of [
    ["tags", (p) => p.tags],
    ["categories", (p) => p.categories],
  ]) {
    const groups = groupBy(published, keysOf);
    for (const [name, posts] of groups) {
      const base = `/${kind}/${encodeURIComponent(urlize(name))}/`;
      pages += checkList({
        dist,
        base,
        expected: posts,
        pageSize,
        label: `${kind} "${name}"`,
        fail,
      });
    }
    log(`${kind}: ${groups.size} lists - checked`);
  }

  // Nothing unpublished shows up, and every published post has its page.
  const publishedSlugs = new Set(published.map((p) => p.slug));
  for (const post of all) {
    const hasPage = Boolean(readPage(dist, `/posts/${post.slug}/`));
    if (publishedSlugs.has(post.slug) && !hasPage)
      fail(`${post.file}: published, but has no page`);
    if (!publishedSlugs.has(post.slug) && hasPage)
      fail(
        `${post.file}: ${post.draft ? "a draft" : "dated in the future"}, but has a page`,
      );
    const year = yearOf(post, offsetMinutes);
    if (!byYear.has(year) && readPage(dist, `/posts/${year}/`))
      fail(`/posts/${year}/ exists, but ${year} has no published post`);
  }

  return {
    failures,
    pages,
    pageSize,
    years: years.length,
    published: published.length,
  };
}

function report({ failures, pages, pageSize, years, published }, title) {
  console.log(
    `${title}: ${published} published posts in ${years} years, ${pages} list pages walked, ${pageSize} to a page`,
  );
  if (failures.length === 0) {
    console.log("all checks passed");
    return true;
  }
  console.log(`${failures.length} failures:`);
  for (const message of failures.slice(0, 50)) console.log(`  - ${message}`);
  if (failures.length > 50)
    console.log(`  ... and ${failures.length - 50} more`);
  return false;
}

// ---------------------------------------------------------------------------------------------
// The stress test: a temporary copy of the project with many generated posts.

// Years with a single post, exactly one full page, one post over a full page, and many pages;
// three posts on one date and time, to exercise the tie-break on the title; a year with only a
// draft; and two posts dated in the future.
const stressPlan = { 2023: 1, 2022: 5, 2021: 6, 2020: 47, 2019: 100 };

function generatePosts(dir, now) {
  const write = (name, frontMatter, text) =>
    fs.writeFileSync(
      path.join(dir, `${name}.md`),
      `---\n${frontMatter}\n---\n\n${text}\n`,
    );
  const pad = (n) => String(n).padStart(2, "0");
  let count = 0;
  for (const [year, total] of Object.entries(stressPlan)) {
    for (let i = 1; i <= total; i++) {
      const tie = year === "2020" && i <= 3;
      const date = tie
        ? `${year}-06-15T10:00:00+03:00`
        : `${year}-${pad(((i - 1) % 12) + 1)}-${pad(((i * 7) % 28) + 1)}T${pad(i % 24)}:00:00+03:00`;
      const title = tie
        ? ["Charlie", "Alpha", "Bravo"][i - 1]
        : `Generated ${year} number ${i}`;
      write(
        `stress-${year}-${String(i).padStart(3, "0")}`,
        `title: "${title}"\ndate: "${date}"\ntags: ["stress"]\ncategories: ["stress"]\ndraft: false`,
        `Post ${i} of ${year}.\n\n## Section\n\nText.`,
      );
      count++;
    }
  }
  const soon = new Date(now + 30 * 24 * 3600 * 1000)
    .toISOString()
    .replace(/\.\d+Z$/, "Z");
  const nextYear = `${new Date(now).getUTCFullYear() + 1}-06-10T10:00:00+03:00`;
  write(
    "stress-future-soon",
    `title: "Future, in a month"\ndate: "${soon}"\ntags: ["stress"]\ncategories: ["stress"]\ndraft: false`,
    "Not yet.",
  );
  write(
    "stress-future-next-year",
    `title: "Future, next year"\ndate: "${nextYear}"\ntags: ["stress"]\ncategories: ["stress"]\ndraft: false`,
    "Not yet.",
  );
  write(
    "stress-2018-draft",
    `title: "Draft only"\ndate: "2018-05-05T10:00:00+03:00"\ndraft: true`,
    "A draft.",
  );
  return count;
}

function build(root) {
  const astro = path.join(projectRoot, "node_modules/astro/astro.js");
  const result = spawnSync(process.execPath, [astro, "build"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(
      `the build of the copy failed:\n${result.stdout}\n${result.stderr}`,
    );
}

function stress() {
  const now = Date.now();
  // The copy lives in the system's temporary folder, under a name only this run uses.
  const copy = fs.mkdtempSync(
    path.join(os.tmpdir(), "klub-pagination-stress-"),
  );
  console.log(`copy: ${copy}`);
  for (const entry of ["src", "public"])
    fs.cpSync(path.join(projectRoot, entry), path.join(copy, entry), {
      recursive: true,
    });
  for (const file of [
    "package.json",
    "astro.config.mjs",
    "tailwind.config.cjs",
    "tsconfig.json",
  ])
    fs.copyFileSync(path.join(projectRoot, file), path.join(copy, file));
  // node_modules is linked, not copied: a junction on Windows, a directory link elsewhere.
  fs.symlinkSync(
    path.join(projectRoot, "node_modules"),
    path.join(copy, "node_modules"),
    "junction",
  );
  const generated = generatePosts(path.join(copy, "src/content/posts"), now);
  console.log(
    `generated ${generated} posts, 2 posts dated in the future and 1 draft`,
  );

  let passed = true;
  const configFile = path.join(copy, "src/config.ts");
  for (const pageSize of [5, 1]) {
    const config = fs.readFileSync(configFile, "utf8");
    fs.writeFileSync(
      configFile,
      config.replace(/(pagination:\s*\{\s*pageSize:\s*)\d+/, `$1${pageSize}`),
    );
    console.log(`building the copy with ${pageSize} to a page...`);
    build(copy);
    passed =
      report(
        checkBuild(copy, { now, quiet: true }),
        `stress, ${pageSize} to a page`,
      ) && passed;
  }

  if (passed) {
    // Everything passed, so the copy holds nothing worth inspecting. Remove only what this run
    // created: the link first, so that removing the folder can never reach the real
    // node_modules, then the folder itself.
    fs.unlinkSync(path.join(copy, "node_modules"));
    fs.rmSync(copy, { recursive: true });
    console.log("copy removed");
  } else {
    console.log(`the copy is kept for inspection: ${copy}`);
  }
  return passed;
}

// ---------------------------------------------------------------------------------------------

const passed = process.argv.includes("--stress")
  ? stress()
  : report(checkBuild(projectRoot), "dist");
process.exit(passed ? 0 : 1);
