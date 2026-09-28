// The player of a paid video, in the browser. Added 2026-09-28; the design is the consilium verdict
// in .specify/consilium/2026-09-28-paid-video-access.md, the markup is src/components/PaidVideo.astro
// and the service it asks is workers/video-access/.
//
// Steps, cheapest first, so that a guest pays for none of Clerk:
// 1. No stub on the page (a public video): return. Astro puts this script on every video page.
// 2. The header's flag says nobody is signed in: show the sign-in link. The flag is presentation
//    (auth-flag.ts), which is fine here: a wrong "signed in" only costs a Clerk load and ends in
//    step 3, and a wrong "signed out" shows a link to the sign-in page, which sends a signed-in
//    visitor straight back.
// 3. Load Clerk through a dynamic import of auth.ts, the one place an instance is created, and
//    take a session token. No session or no token: the sign-in link.
// 4. Ask the service for this slug with the token. 200 carries the player address; 401 means the
//    token was refused (tried once more with a fresh token, since Clerk refreshes them every 60
//    seconds); 403 means signed in but not a member; 404 means the service does not know the
//    slug yet. Anything else, or no answer, is "unavailable", with the reason in the console.
// 5. The player address is used only when it is https on one of site.videoAccess.playerHosts.
import { site } from "../config";
import { readAuthFlag } from "./auth-flag";
// A type-only import is erased from the bundle, so it does not pull Clerk into this script; the
// code comes through the dynamic import in loadClerk().
import type { Clerk } from "@clerk/clerk-js";

type State = "loading" | "guest" | "denied" | "missing" | "failed";

// Clerk through auth.ts, loaded only when this function runs. A static import would put the Clerk
// chunk (656 KB gzip, package.json) on every video page, for guests too.
async function loadClerk(): Promise<Clerk | undefined> {
  try {
    const { getClerk } = await import("./auth");
    return await getClerk();
  } catch (error) {
    console.error("Paid video: Clerk could not be loaded.", error);
    return undefined;
  }
}

const stub = document.querySelector<HTMLElement>("[data-paid-video]");
if (stub !== null) void run(stub);

async function run(box: HTMLElement): Promise<void> {
  const slug = box.dataset.paidVideo ?? "";
  // import.meta.env.DEV is replaced at build time, so a bundle carries one address
  // (src/config.ts says why there are two).
  const endpoint = import.meta.env.DEV
    ? site.videoAccess.devEndpoint
    : site.videoAccess.endpoint;
  const show = (state: State) => {
    for (const element of box.querySelectorAll<HTMLElement>("[data-state]")) {
      element.hidden = element.dataset.state !== state;
    }
  };

  if (endpoint === "") {
    console.error(
      "Paid video: site.videoAccess.endpoint is empty (PAID-VIDEO.md, one-time setup).",
    );
    show("failed");
    return;
  }
  if (!readAuthFlag()) {
    show("guest");
    return;
  }
  show("loading");

  const clerk = await loadClerk();
  if (clerk === undefined) {
    show("failed");
    return;
  }

  // One request to the service. `fresh` asks Clerk for a new token instead of its cached one.
  const ask = async (fresh: boolean): Promise<Response | State> => {
    const token = await clerk.session?.getToken({ skipCache: fresh });
    if (token === null || token === undefined) return "guest";
    return fetch(endpoint + "/video", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slug }),
    });
  };

  const check = async (fresh: boolean): Promise<void> => {
    try {
      let answer = await ask(fresh);
      if (answer instanceof Response && answer.status === 401 && !fresh) {
        answer = await ask(true);
      }
      if (!(answer instanceof Response)) {
        show(answer);
      } else if (answer.status === 200) {
        play(box, await answer.json());
      } else if (answer.status === 403) {
        show("denied");
      } else if (answer.status === 404) {
        show("missing");
      } else {
        console.error(
          "Paid video: the access service answered",
          answer.status,
          await answer.text(),
        );
        show("failed");
      }
    } catch (error) {
      console.error(
        "Paid video: the access service could not be asked.",
        error,
      );
      show("failed");
    }
  };

  // "Check again" after a 403: the administrator may have granted access a moment ago, and the
  // cached token (up to 60 seconds old) would still carry the old claims.
  const recheck = box.querySelector<HTMLButtonElement>("[data-recheck]");
  recheck?.addEventListener("click", async () => {
    recheck.disabled = true;
    show("loading");
    await check(true);
    recheck.disabled = false;
  });

  await check(false);

  function play(target: HTMLElement, body: unknown): void {
    const address =
      typeof body === "object" && body !== null && "embedUrl" in body
        ? body.embedUrl
        : undefined;
    const hosts: readonly string[] = site.videoAccess.playerHosts;
    let url: URL | undefined;
    try {
      url = typeof address === "string" ? new URL(address) : undefined;
    } catch {
      url = undefined;
    }
    const template = document.querySelector<HTMLTemplateElement>(
      "template[data-paid-player]",
    );
    const frame = template?.content.firstElementChild?.cloneNode(true);
    if (
      url === undefined ||
      url.protocol !== "https:" ||
      !hosts.includes(url.hostname) ||
      !(frame instanceof HTMLIFrameElement)
    ) {
      console.error("Paid video: refused the player address", address);
      show("failed");
      return;
    }
    frame.src = url.href;
    target.replaceWith(frame);
    // Added 2026-09-28: the comments of a paid video are shown only now (the owner's choice), and
    // Disqus.astro owns that block, so it is told by an event rather than reached into.
    document.dispatchEvent(new CustomEvent(site.videoAccess.grantedEvent));
  }
}
