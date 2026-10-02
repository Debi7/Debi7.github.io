// Starts everything local work needs in one terminal: the access service for paid videos
// (scripts/video-access-dev.mjs, http://127.0.0.1:8787) and the Astro dev server. Added
// 2026-09-28 at the owner's request; until then it took two terminals (PAID-VIDEO.md, section 3).
//
// Both run as child processes of this one, started with process.execPath: no shell, no npx
// wrapper and no new dependency (a package such as concurrently is not worth it for two
// processes). Astro is started from its own entry file, so the process this script stops is the
// real server, not a wrapper that would leave the port taken (CLAUDE.md, Workflow).
//
// Arguments go to astro dev: `npm run dev:all -- --port 4387`. The local service accepts the
// pages of ports 4321, 4387 and 4388 only (ALLOWED_ORIGINS in video-access-dev.mjs); another port
// gets a warning, because its paid videos would say "Видео сейчас недоступно".
//
// Stopping is guaranteed, the owner's requirement of the same day: nothing may be left running
// or holding a port after this script ends, even when a child hangs.
// - Ctrl+C: each child gets a few seconds (graceMs) to end on its own; whatever is still running
//   then is killed together with everything it started. A second Ctrl+C kills at once.
// - One child ends by itself (a crash, or port 8787 taken): the other is stopped the same way,
//   and this script exits with the first one's code, so the failure is seen at once instead of
//   through a paid video that never plays.
// - Last resort: on the way out this script kills any child still running, synchronously.
// Killing means the whole process tree: taskkill /T /F on Windows, where child.kill() would end
// the one process and leave anything it started behind; elsewhere each child leads its own
// process group (detached), which gets SIGTERM and, after graceMs, SIGKILL. Detached is off on
// Windows, where it would open a console window per child; there the console delivers Ctrl+C to
// the children itself. No child reads the keyboard (stdin "ignore"): a background process group
// that did would be stopped by the terminal.
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const astro = fileURLToPath(
  new URL("../node_modules/astro/astro.js", import.meta.url),
);
const astroArgs = process.argv.slice(2);
const isWindows = process.platform === "win32";
const graceMs = 5000;

const portArg = astroArgs.findIndex(
  (a) => a === "--port" || a.startsWith("--port="),
);
const port =
  portArg === -1
    ? "4321"
    : astroArgs[portArg].includes("=")
      ? astroArgs[portArg].split("=")[1]
      : astroArgs[portArg + 1];
if (!["4321", "4387", "4388"].includes(port ?? "")) {
  console.warn(
    `dev:all: the local access service does not accept port ${port}; paid videos will not play there.`,
  );
}

const start = (args) =>
  spawn(process.execPath, args, {
    cwd: root,
    stdio: ["ignore", "inherit", "inherit"],
    detached: !isWindows,
  });

// Changed 2026-10-02 with the admin panel (ADMIN.md): a third child, the content service of
// workers/content-admin/ on http://127.0.0.1:8789 (scripts/content-admin-dev.mjs), which the panel
// at /admin/posts/ asks; it accepts the same three ports. Everything said above about two children
// holds for three: one ending stops the others.
const children = [
  { name: "video-access", child: start(["scripts/video-access-dev.mjs"]) },
  { name: "content-admin", child: start(["scripts/content-admin-dev.mjs"]) },
  // Added later on 2026-10-02: the status service on http://127.0.0.1:8790
  // (scripts/statuses-dev.mjs), which /admin/users/ asks.
  { name: "statuses", child: start(["scripts/statuses-dev.mjs"]) },
  { name: "astro dev", child: start([astro, "dev", ...astroArgs]) },
];

const running = (child) => child.exitCode === null && child.signalCode === null;

// Ends a child and its whole tree without asking. Synchronous, so the exit handler can use it.
function kill(child) {
  if (!running(child)) return;
  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // The group is already gone.
    }
  }
}

// Asks a child to end. On Windows there is no such request from outside a console program's own
// console: after Ctrl+C the console has asked already, and otherwise the only way is kill().
function ask(child, byCtrlC) {
  if (!running(child)) return;
  if (isWindows) {
    if (!byCtrlC) kill(child);
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    // The group is already gone.
  }
}

let stopping = false;
let exitCode = 0;
function stopAll(reason, byCtrlC) {
  if (stopping) {
    // A second Ctrl+C while waiting: do not wait any longer.
    if (byCtrlC) for (const { child } of children) kill(child);
    return;
  }
  stopping = true;
  console.log(`\ndev:all: ${reason}, stopping everything.`);
  for (const { child } of children) ask(child, byCtrlC);
  setTimeout(() => {
    for (const { name, child } of children) {
      if (!running(child)) continue;
      console.log(
        `dev:all: ${name} did not stop in ${graceMs / 1000} s, killing it.`,
      );
      kill(child);
    }
  }, graceMs).unref();
}

for (const { name, child } of children) {
  child.on("exit", (code, signal) => {
    if (!stopping) {
      exitCode = code ?? 1;
      stopAll(`${name} ended (${signal ?? `exit code ${code}`})`, false);
      // Added 2026-10-02: the same advice for the ports of the two admin services.
      const adminPorts = { "content-admin": 8789, statuses: 8790 };
      if (Object.hasOwn(adminPorts, name) && code !== 0) {
        const taken = adminPorts[name];
        console.log(
          `dev:all: if the lines above say EADDRINUSE, port ${taken} is taken, usually by a dev:all or ` +
            `${name}:dev still running elsewhere. Find it with \`netstat -ano | findstr :${taken}\` ` +
            `(Windows) or \`lsof -i :${taken}\`, and end it.`,
        );
      }
      if (name === "video-access" && code !== 0) {
        console.log(
          "dev:all: if the lines above say EADDRINUSE, port 8787 is taken, usually by a dev:all or " +
            "video-access:dev still running elsewhere. Find it with `netstat -ano | findstr :8787` " +
            "(Windows) or `lsof -i :8787`, and end it.",
        );
      }
    }
    if (children.every((c) => !running(c.child))) process.exit(exitCode);
  });
}

process.on("SIGINT", () => stopAll("Ctrl+C", true));
process.on("SIGTERM", () => stopAll("asked to stop", false));
process.on("SIGHUP", () => stopAll("the terminal closed", false));
process.on("exit", () => {
  for (const { child } of children) kill(child);
});
