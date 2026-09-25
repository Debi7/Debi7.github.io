// Browser checks of the sign-in pages and the guest gate against the built site, driven through the
// DevTools protocol of headless Edge (AUTH.md sections 5 and 10). Moved here from a session's scratch
// directory on 2026-09-25 at the owner's request, so that it survives the session.
// Run: npm run check:auth (builds first). Needs Microsoft Edge at the path below and Node's
// --experimental-websocket flag, which is for this script's own protocol connection; the site
// itself needs no flag. It talks to the live Supabase project (wrong-password and bogus-token
// checks), so it needs the network. Ports 4388 and 9333 must be free.
import { spawn, execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PREVIEW_PORT = 4388;
const CDP_PORT = 9333;
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`;
const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
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
await send("Page.enable");
await send("Runtime.enable");

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(
    (ok ? "PASS " : "FAIL ") + name + (detail ? "  [" + detail + "]" : ""),
  );
};

// a. anonymous visitor on the dashboard
await open("/auth/dashboard/", 3500);
const anon = await evalJs(
  `JSON.stringify({anon: !document.getElementById("state-anon").hidden, member: document.getElementById("state-member").hidden, loading: document.getElementById("state-loading").hidden, flag: localStorage.getItem("kb-auth-expires")})`,
);
check(
  "dashboard: anonymous sees the invitation",
  /"anon":true,"member":true,"loading":true,"flag":null/.test(anon),
  anon,
);

// b. wrong password on the sign-in page
await open("/auth/signin/", 2500);
await evalJs(
  `document.getElementById("email").value = "nobody@example.com"; document.getElementById("password").value = "wrong-password"; document.getElementById("signin-form").requestSubmit(); true`,
);
await sleep(5000);
const signinMsg = await evalJs(
  `document.getElementById("message").textContent`,
);
check(
  "signin: wrong password shows Supabase's message",
  /Invalid login credentials/.test(signinMsg),
  signinMsg,
);
const signinBtn = await evalJs(
  `JSON.stringify({disabled: document.getElementById("signin-btn").disabled, text: document.getElementById("signin-btn").textContent.trim()})`,
);
check(
  "signin: button re-enabled after the error",
  /"disabled":false/.test(signinBtn),
  signinBtn,
);

// c. callback with a bogus token_hash: button, then an error message on click
await open("/auth/callback/?token_hash=bogus-hash&type=email", 3000);
const cbBefore = await evalJs(
  `JSON.stringify({buttonHidden: document.getElementById("confirm-btn").hidden, msg: document.getElementById("message").textContent})`,
);
check(
  "callback: bogus hash shows the confirm button",
  /"buttonHidden":false/.test(cbBefore),
  cbBefore,
);
await evalJs(`document.getElementById("confirm-btn").click(); true`);
await sleep(5000);
const cbAfter = await evalJs(`document.getElementById("message").textContent`);
check(
  "callback: verifying a bogus hash prints an error, no crash",
  /Не удалось подтвердить адрес/.test(cbAfter),
  cbAfter,
);

// d. callback without parameters
await open("/auth/callback/", 3500);
const cbEmpty = await evalJs(`document.getElementById("message").textContent`);
check(
  "callback: no parameters -> invalid link message",
  /недействительна/.test(cbEmpty),
  cbEmpty,
);

// e. header link follows the flag (on the home page, the one page a guest may see since the gate)
await open("/", 2500);
const hrefOut = await evalJs(
  `document.getElementById("auth-link").getAttribute("href")`,
);
check(
  "header: signed out -> link to sign-in",
  hrefOut === "/auth/signin/",
  hrefOut,
);
await evalJs(
  `localStorage.setItem("kb-auth-expires", String(Math.floor(Date.now()/1000) + 3600)); true`,
);
await open("/about/", 2500);
const hrefIn = await evalJs(
  `JSON.stringify({href: document.getElementById("auth-link").getAttribute("href"), label: document.getElementById("auth-link").getAttribute("aria-label"), path: location.pathname})`,
);
check(
  "header: flag set -> link to the dashboard, and /about/ stays open",
  /\/auth\/dashboard\//.test(hrefIn) && /"path":"\/about\/"/.test(hrefIn),
  hrefIn,
);
await evalJs(
  `localStorage.setItem("kb-auth-expires", String(Math.floor(Date.now()/1000) - 60)); true`,
);
await open("/", 2500);
const hrefExpired = await evalJs(
  `document.getElementById("auth-link").getAttribute("href")`,
);
check(
  "header: expired flag -> back to sign-in (fail-closed)",
  hrefExpired === "/auth/signin/",
  hrefExpired,
);
await evalJs(`localStorage.removeItem("kb-auth-expires"); true`);

// f. the dashboard with a stale flag but no session still shows the invitation (flag is presentation only)
await evalJs(
  `localStorage.setItem("kb-auth-expires", String(Math.floor(Date.now()/1000) + 3600)); true`,
);
await open("/auth/dashboard/", 3500);
const stale = await evalJs(
  `JSON.stringify({anon: !document.getElementById("state-anon").hidden, flagAfter: localStorage.getItem("kb-auth-expires")})`,
);
check(
  "dashboard: flag without a session -> invitation, flag cleared by INITIAL_SESSION",
  /"anon":true,"flagAfter":null/.test(stale),
  stale,
);

// g. home page: the auth link is there since the gate (the owner's decision), and no supabase code
await open("/", 2500);
const home = await evalJs(
  `JSON.stringify({link: document.getElementById("auth-link") !== null, scripts: performance.getEntriesByType("resource").filter(e => /\\.js$/.test(e.name)).map(e => e.name.split("/").pop())})`,
);
check(
  "home: auth link present and no auth chunk",
  /"link":true/.test(home) && !/auth\./.test(home),
  home,
);
await evalJs(
  `localStorage.setItem("kb-auth-expires", String(Math.floor(Date.now()/1000) + 3600)); true`,
);
const sbLoadedOnAbout = await (async () => {
  await open("/about/", 2500);
  return evalJs(
    `performance.getEntriesByType("resource").filter(e => /\\.js$/.test(e.name)).map(e => e.name.split("/").pop()).join(",")`,
  );
})();
check(
  "about (member): no auth chunk loaded",
  !/auth\./.test(sbLoadedOnAbout),
  sbLoadedOnAbout,
);
await evalJs(`localStorage.removeItem("kb-auth-expires"); true`);

// h. sign-up form: the password minimum is 8 (owner, 2026-09-25 evening). The characters are typed through
// Input.insertText: the HTML tooShort constraint applies only to a value last changed by the user, so a
// value assigned by script would never trip it and the check would pass for the wrong reason.
await open("/auth/signup/", 2500);
await evalJs(
  `document.getElementById("email").value = "nobody@example.com"; document.getElementById("password").focus(); true`,
);
await send("Input.insertText", { text: "1234567" });
const short7 = await evalJs(
  `JSON.stringify({minlength: document.getElementById("password").getAttribute("minlength"), placeholder: document.getElementById("password").getAttribute("placeholder"), tooShort: document.getElementById("password").validity.tooShort, formValid: document.getElementById("signup-form").checkValidity()})`,
);
check(
  "signup: seven characters refused by minlength 8",
  /"minlength":"8"/.test(short7) &&
    /"tooShort":true,"formValid":false/.test(short7),
  short7,
);
await evalJs(
  `const p = document.getElementById("password"); p.value = ""; p.focus(); true`,
);
await send("Input.insertText", { text: "12345678" });
const ok8 = await evalJs(
  `JSON.stringify({tooShort: document.getElementById("password").validity.tooShort, formValid: document.getElementById("signup-form").checkValidity()})`,
);
check(
  "signup: eight characters accepted",
  /"tooShort":false,"formValid":true/.test(ok8),
  ok8,
);

// i. the site is open (the guest gate was removed after the colleague's review, AUTH.md section 11);
// only the Account menu item is members-only.
const menuShown = `[...document.querySelectorAll("nav li")].filter(li => li.offsetParent !== null).map(li => li.textContent.trim())`;
await evalJs(`localStorage.removeItem("kb-auth-expires"); true`);
await open("/about/", 2500);
const openAbout = await evalJs(`location.pathname + location.search`);
check("open: guest on /about/ stays there", openAbout === "/about/", openAbout);
await open("/search/?q=x", 2500);
const openSearch = await evalJs(`location.pathname + location.search`);
check(
  "open: guest on /search/?q=x stays there",
  openSearch === "/search/?q=x",
  openSearch,
);
await open("/posts/", 2500);
const openPosts = await evalJs(
  `JSON.stringify({path: location.pathname, noindex: document.querySelector('meta[name="robots"]') !== null})`,
);
check(
  "open: guest on /posts/ stays, no noindex",
  /"path":"\/posts\/","noindex":false/.test(openPosts),
  openPosts,
);
await open("/", 3000);
const guestHome = await evalJs(
  `JSON.stringify({memberClass: document.documentElement.classList.contains("kb-member"), tagCloud: document.querySelector("h1") !== null, menu: ${menuShown}, search: getComputedStyle(document.querySelector('a[href="/search/"]')).display, footer: getComputedStyle(document.querySelector("footer")).display})`,
);
check(
  "open: guest on / sees the whole page and every item but Account",
  /"memberClass":false/.test(guestHome) &&
    /"menu":\["Home","Posts","Video","Categories","Tags","About"\]/.test(
      guestHome,
    ) &&
    !/"search":"none"/.test(guestHome) &&
    !/"footer":"none"/.test(guestHome),
  guestHome,
);
await evalJs(
  `localStorage.setItem("kb-auth-expires", String(Math.floor(Date.now()/1000) + 3600)); true`,
);
await open("/", 3000);
const memberHome = await evalJs(
  `JSON.stringify({memberClass: document.documentElement.classList.contains("kb-member"), menu: ${menuShown}})`,
);
check(
  "open: member on / sees Account before About",
  /"memberClass":true/.test(memberHome) &&
    /"menu":\["Home","Posts","Video","Categories","Tags","Account","About"\]/.test(
      memberHome,
    ),
  memberHome,
);
await evalJs(`localStorage.removeItem("kb-auth-expires"); true`);
await open("/nothing-here/", 2500);
const notFound = await evalJs(
  `JSON.stringify({path: location.pathname, h1: document.querySelector("h1") && document.querySelector("h1").textContent})`,
);
check(
  "open: unknown address gives the 404 page",
  /"h1":"404"/.test(notFound),
  notFound,
);
await open("/auth/signin/?next=%2Fabout%2F", 2500);
const signinNext = await evalJs(
  `JSON.stringify({path: location.pathname, form: document.getElementById("signin-form") !== null})`,
);
check(
  "open: sign-in page with next shows the form",
  /"path":"\/auth\/signin\/","form":true/.test(signinNext),
  signinNext,
);

// k. password recovery (added 2026-09-25, AUTH.md section 11.4). The forgot form is not submitted:
// it would ask Supabase for a mail, and the default sender allows two an hour for the whole project.
await open("/auth/signin/", 2500);
const forgotLink = await evalJs(
  `JSON.stringify(!!document.querySelector('a[href="/auth/forgot/"]'))`,
);
check(
  "recovery: sign-in page links to /auth/forgot/",
  forgotLink === "true",
  forgotLink,
);
await open("/auth/forgot/", 2500);
const forgotForm = await evalJs(
  `JSON.stringify({form: document.getElementById("forgot-form") !== null, email: document.getElementById("email") !== null})`,
);
check(
  "recovery: forgot page has the email form",
  /"form":true,"email":true/.test(forgotForm),
  forgotForm,
);
await open("/auth/reset/", 3500);
const resetEmpty = await evalJs(
  `JSON.stringify({msg: document.getElementById("message").textContent, formHidden: document.getElementById("reset-form").hidden})`,
);
check(
  "recovery: reset without a link -> invalid-link message, no form",
  /недействительна/.test(resetEmpty) && /"formHidden":true/.test(resetEmpty),
  resetEmpty,
);
await open("/auth/reset/?token_hash=bogus-hash&type=recovery", 3000);
await evalJs(`document.getElementById("continue-btn").click(); true`);
await sleep(5000);
const resetBogus = await evalJs(
  `JSON.stringify({msg: document.getElementById("message").textContent, formHidden: document.getElementById("reset-form").hidden})`,
);
check(
  "recovery: bogus recovery hash -> error, no form",
  /Не удалось проверить ссылку/.test(resetBogus) &&
    /"formHidden":true/.test(resetBogus),
  resetBogus,
);
await open("/auth/reset/?token_hash=x&type=email", 3000);
const resetWrongType = await evalJs(
  `document.getElementById("message").textContent`,
);
check(
  "recovery: a hash of another type is refused",
  /не для смены пароля/.test(resetWrongType),
  resetWrongType,
);

// j. narrow viewport: the hamburger and the footer are there for a guest
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
  "open: guest at 400px has the hamburger and the footer",
  /"width":400/.test(narrowGuest) &&
    !/"hamburger":"none"/.test(narrowGuest) &&
    !/"footer":"none"/.test(narrowGuest),
  narrowGuest,
);
await send("Emulation.clearDeviceMetricsOverride");

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
