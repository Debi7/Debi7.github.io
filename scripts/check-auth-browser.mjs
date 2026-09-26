// Browser checks of the Clerk sign-in against the built site, driven through the DevTools protocol
// of headless Edge. Rewritten on 2026-09-26 for the move to Clerk (CLERK.md step 6 and section 4,
// item 6); the checks of the previous provider's pages went with those pages, and the server and
// protocol plumbing below is kept as it was written on 2026-09-25.
// Run: npm run check:auth (builds first). Needs Microsoft Edge at the path below and Node's
// --experimental-websocket flag, which is for this script's own protocol connection; the site
// itself needs no flag. Ports 4388 and 9333 must be free.
//
// Two groups of checks. The first needs nothing but the built site: the header and the menu
// following the flag, Clerk confined to the three auth pages, the removed pages answering 404, and
// - while the publishable key in src/config.ts is empty - the auth pages saying that sign-in is
// not set up yet. The second talks to the Clerk development instance, so it needs the key and the
// network, and signs in with the demo account of CLERK.md section 1, item 6. It never signs up, so
// the instance's user cap is never touched. While the key is empty the second group is reported as
// SKIPPED and does not fail the run; it was written before any key existed and has not been run
// against a real instance yet, so its selectors for Clerk's own markup are the first thing to
// check when it first fails.
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PREVIEW_PORT = 4388;
const CDP_PORT = 9333;
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`;
const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The key is read from the source rather than imported: src/config.ts is TypeScript, and this
// script runs in plain Node. An empty string means the Clerk application does not exist yet.
const KEY =
  /publishableKey:\s*"([^"]*)"/.exec(
    readFileSync("src/config.ts", "utf8"),
  )?.[1] ?? "";
// The demo account of CLERK.md section 1, item 6: made up, development instance only. The
// +clerk_test suffix makes Clerk send no mail and accept the code 424242. Overridable from the
// environment should the Dashboard hold a different one.
const DEMO_EMAIL =
  process.env.CLERK_DEMO_EMAIL ?? "demo+clerk_test@example.com";
const DEMO_PASSWORD = process.env.CLERK_DEMO_PASSWORD ?? "Demo-2026-klub";
const TEST_CODE = "424242";

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("not reachable: " + url);
}

function killPort(port) {
  try {
    const out = execSync(`netstat -ano`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (line.includes(`:${port} `) && line.includes("LISTENING")) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== "0") pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      } catch {}
    }
  } catch {}
}

// --- servers ---
const preview = spawn(
  process.execPath,
  [
    "node_modules/astro/astro.js",
    "preview",
    "--port",
    String(PREVIEW_PORT),
    "--host",
    "127.0.0.1",
  ],
  {
    cwd: process.cwd(),
    stdio: "ignore",
    shell: false,
  },
);
await waitFor(BASE + "/");

const profile = mkdtempSync(join(tmpdir(), "edge-cdp-"));
const edge = spawn(
  EDGE,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${CDP_PORT}`,
    "--window-size=1280,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);
await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`);

// --- one CDP session on the first page target ---
const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
// Every top-level address the browser visits, for the __clerk_db_jwt check at the end. Added
// 2026-09-26: a development instance passes that token in the query string on cross-origin
// redirects, and with email and password on the site's own pages there should be none (the Clerk
// verdict, security remark).
const visited = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === "Page.frameNavigated" && !msg.params.frame.parentId) {
    visited.push(msg.params.frame.url);
  }
});
function send(method, params = {}) {
  return new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.result?.exceptionDetails)
    return (
      "EXCEPTION: " +
      (r.result.exceptionDetails.exception?.description ??
        r.result.exceptionDetails.text)
    );
  return r.result?.result?.value;
}
async function open(path, settle = 2500) {
  await send("Page.navigate", { url: BASE + path });
  await sleep(settle);
}
// Polls an expression until it is truthy, for the steps that wait on Clerk's network calls.
async function until(expression, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await evalJs(expression)) return true;
    await sleep(500);
  }
  return false;
}
// Typed through Input.insertText, as a person would: Clerk's inputs are controlled components,
// and a value assigned by script is not seen by them.
async function typeInto(selector, text) {
  await evalJs(
    `document.querySelector(${JSON.stringify(selector)}).focus(); true`,
  );
  await send("Input.insertText", { text });
}
await send("Page.enable");
await send("Runtime.enable");

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(
    (ok ? "PASS " : "FAIL ") + name + (detail ? "  [" + detail + "]" : ""),
  );
};
const skip = (name) => console.log("SKIP " + name + "  [no publishable key]");

const menuShown = `[...document.querySelectorAll("nav li")].filter(li => li.offsetParent !== null).map(li => li.textContent.trim())`;
const authChunkLoaded = `performance.getEntriesByType("resource").some(e => /\\/_astro\\/auth\\.[^/]*\\.js$/.test(e.name))`;
const flag = `localStorage.getItem("kb-auth-expires")`;

// ===== Group 1: no Clerk instance needed =====

// a. a guest on the home page: no kb-member, no Account item, the icon leads to the sign-in page,
// and the Clerk chunk is not loaded.
await open("/", 3000);
const guestHome = await evalJs(
  `JSON.stringify({member: document.documentElement.classList.contains("kb-member"), menu: ${menuShown}, href: document.getElementById("auth-link").getAttribute("href"), clerk: ${authChunkLoaded}})`,
);
check(
  "guest on /: no kb-member, no Account, icon to sign-in, no Clerk chunk",
  /"member":false/.test(guestHome) &&
    /"menu":\["Home","Posts","Video","Categories","Tags","About"\]/.test(
      guestHome,
    ) &&
    /"href":"\/auth\/signin\/"/.test(guestHome) &&
    /"clerk":false/.test(guestHome),
  guestHome,
);

// b. a valid flag: kb-member, Account before About, the icon leads to the account page.
await evalJs(
  `localStorage.setItem("kb-auth-expires", String(Math.floor(Date.now()/1000) + 3600)); true`,
);
await open("/about/", 3000);
const flaggedAbout = await evalJs(
  `JSON.stringify({member: document.documentElement.classList.contains("kb-member"), menu: ${menuShown}, href: document.getElementById("auth-link").href.replace(location.origin, "")})`,
);
check(
  "valid flag on /about/: kb-member, Account shown, icon to the account page",
  /"member":true/.test(flaggedAbout) &&
    /"menu":\["Home","Posts","Video","Categories","Tags","Account","About"\]/.test(
      flaggedAbout,
    ) &&
    /"href":"\/auth\/account\/"/.test(flaggedAbout),
  flaggedAbout,
);

// c. an expired flag reads as signed out.
await evalJs(
  `localStorage.setItem("kb-auth-expires", String(Math.floor(Date.now()/1000) - 60)); true`,
);
await open("/about/", 2500);
const expired = await evalJs(
  `JSON.stringify({member: document.documentElement.classList.contains("kb-member"), href: document.getElementById("auth-link").getAttribute("href")})`,
);
check(
  "expired flag: no kb-member, icon to sign-in",
  /"member":false/.test(expired) && /"href":"\/auth\/signin\/"/.test(expired),
  expired,
);
await evalJs(`localStorage.removeItem("kb-auth-expires"); true`);

// d. the pages Clerk replaced are gone.
for (const gone of [
  "/auth/dashboard/",
  "/auth/callback/",
  "/auth/forgot/",
  "/auth/reset/",
]) {
  await open(gone, 2000);
  const h1 = await evalJs(
    `document.querySelector("h1") && document.querySelector("h1").textContent`,
  );
  check(`removed page ${gone} answers the 404 page`, h1 === "404", h1);
}

// e. the auth pages load the Clerk chunk; with no key they say that sign-in is not set up.
for (const path of ["/auth/signin/", "/auth/signup/", "/auth/account/"]) {
  await open(path, 3500);
  const state = await evalJs(
    `JSON.stringify({clerk: ${authChunkLoaded}, status: document.getElementById("auth-status") && document.getElementById("auth-status").textContent.trim()})`,
  );
  check(`${path} loads the Clerk chunk`, /"clerk":true/.test(state), state);
  if (KEY === "") {
    check(
      `${path} without a key says sign-in is not set up`,
      /Вход на сайт ещё не подключён/.test(state),
      state,
    );
  }
}

// f. narrow viewport: the hamburger and the footer are there for a guest (kept from 2026-09-25).
await send("Emulation.setDeviceMetricsOverride", {
  width: 400,
  height: 800,
  deviceScaleFactor: 1,
  mobile: true,
});
await open("/", 3000);
const narrowGuest = await evalJs(
  `JSON.stringify({width: innerWidth, hamburger: getComputedStyle(document.getElementById("menu-toggle")).display, footer: getComputedStyle(document.querySelector("footer")).display})`,
);
check(
  "guest at 400px has the hamburger and the footer",
  /"width":400/.test(narrowGuest) &&
    !/"hamburger":"none"/.test(narrowGuest) &&
    !/"footer":"none"/.test(narrowGuest),
  narrowGuest,
);
await send("Emulation.clearDeviceMetricsOverride");

// ===== Group 2: the Clerk development instance =====
// Selectors for Clerk's markup use its stable cl- class names and the input names Clerk documents
// (identifier, password, code). Not yet run against a real instance (see the header).
const G2 = [
  "guest on /auth/account/ is sent to sign-in with next",
  "sign-in form mounts and the status line is gone",
  "wrong password shows an error and writes no flag",
  "demo sign-in lands on /auth/account/ with a future flag",
  "after sign-in /about/ has kb-member, Account and the account icon",
  "account page shows the profile and the demo line",
  "sign-out clears the flag and lands on /",
  "no visited address carries __clerk_db_jwt",
];
if (KEY === "") {
  for (const name of G2) skip(name);
} else {
  const hasClerkUi = (rootId) =>
    `!!document.querySelector("#${rootId} [class*='cl-']")`;

  await open("/auth/account/", 1000);
  await until(`location.pathname === "/auth/signin/"`);
  const redirected = await evalJs(`location.pathname + location.search`);
  check(
    G2[0],
    redirected === "/auth/signin/?next=%2Fauth%2Faccount%2F",
    redirected,
  );

  const mounted = await until(hasClerkUi("clerk-signin"));
  const statusGone = await evalJs(
    `document.getElementById("auth-status") === null`,
  );
  check(G2[1], mounted && statusGone, JSON.stringify({ mounted, statusGone }));

  // Fills the identifier, then the password, on one step or two - Clerk shows the password on the
  // first step or after "Continue" depending on the instance's settings.
  async function signIn(password) {
    await until(`!!document.querySelector("input[name=identifier]")`);
    await typeInto("input[name=identifier]", DEMO_EMAIL);
    if (!(await evalJs(`!!document.querySelector("input[name=password]")`))) {
      await evalJs(
        `document.querySelector(".cl-formButtonPrimary").click(); true`,
      );
      await until(`!!document.querySelector("input[name=password]")`);
    }
    await typeInto("input[name=password]", password);
    await evalJs(
      `document.querySelector(".cl-formButtonPrimary").click(); true`,
    );
  }

  await signIn("wrong-password-" + Date.now());
  const errorShown = await until(
    `!!document.querySelector("[class*='cl-formFieldErrorText'], [class*='cl-alert']")`,
  );
  const noFlag = (await evalJs(flag)) === null;
  check(G2[2], errorShown && noFlag, JSON.stringify({ errorShown, noFlag }));

  await open("/auth/signin/", 1000);
  await until(hasClerkUi("clerk-signin"));
  await signIn(DEMO_PASSWORD);
  // "Client trust": Clerk may ask a new device for an email code; the test address takes 424242.
  if (
    await until(
      `location.pathname === "/auth/account/" || !!document.querySelector("input[name^=code], input[autocomplete=one-time-code]")`,
    )
  ) {
    if (await evalJs(`location.pathname !== "/auth/account/"`)) {
      await typeInto(
        "input[name^=code], input[autocomplete=one-time-code]",
        TEST_CODE,
      );
    }
  }
  await until(`location.pathname === "/auth/account/"`);
  const landed = await evalJs(
    `JSON.stringify({path: location.pathname, flag: ${flag}})`,
  );
  const stored = Number(JSON.parse(landed).flag);
  check(
    G2[3],
    /"path":"\/auth\/account\/"/.test(landed) &&
      Number.isFinite(stored) &&
      stored * 1000 > Date.now(),
    landed,
  );

  await open("/about/", 2500);
  const memberAbout = await evalJs(
    `JSON.stringify({member: document.documentElement.classList.contains("kb-member"), menu: ${menuShown}, href: document.getElementById("auth-link").href.replace(location.origin, "")})`,
  );
  check(
    G2[4],
    /"member":true/.test(memberAbout) &&
      /"Account","About"\]/.test(memberAbout) &&
      /"href":"\/auth\/account\/"/.test(memberAbout),
    memberAbout,
  );

  await open("/auth/account/", 1000);
  const profileShown = await until(hasClerkUi("clerk-profile"));
  const demoShown = await evalJs(
    `!document.getElementById("member-demo").hidden`,
  );
  check(
    G2[5],
    profileShown && demoShown,
    JSON.stringify({ profileShown, demoShown }),
  );

  await evalJs(`document.getElementById("signout-btn").click(); true`);
  await until(`location.pathname === "/"`);
  const out = await evalJs(
    `JSON.stringify({path: location.pathname, flag: ${flag}})`,
  );
  check(G2[6], out === `{"path":"/","flag":null}`, out);

  const leaked = visited.filter((u) => u.includes("__clerk_db_jwt"));
  check(
    G2[7],
    leaked.length === 0,
    leaked.join(" ") || `${visited.length} addresses`,
  );

  // For the record (CLERK.md section 4, item 6): what the instance left in the browser.
  const cookies = await send("Network.getCookies");
  console.log(
    "INFO cookies: " +
      (cookies.result?.cookies ?? [])
        .map((c) => c.domain + " " + c.name)
        .join(", "),
  );
  console.log(
    "INFO localStorage: " +
      (await evalJs(`JSON.stringify(Object.keys(localStorage))`)),
  );
}

// The resource check of the Clerk verdict (no zxcvbn-common, base-account-sdk or
// coinbase-wallet-sdk chunk loaded) is not here. It was written for Clerk's hosted browser build,
// which fetches those parts as separate files; the owner chose the installed npm package on
// 2026-09-26, whose single-file build carries them inside the bundled auth chunk, so no such file
// is ever requested and the check could only pass (package.json, the Clerk size note).

ws.close();
try {
  edge.kill();
} catch {}
killPort(CDP_PORT);
killPort(PREVIEW_PORT);
try {
  preview.kill();
} catch {}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
