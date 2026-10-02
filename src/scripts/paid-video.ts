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
//
// Changed later on 2026-09-28, the owner's decision on who sees what on a paid lecture: a guest
// gets block 1 and the sign-in link; a signed-in visitor without access also gets the comments,
// so that they can be instructed there before paying; a member gets the player, block 2 and the
// comments. So once step 3 has confirmed a session, this script sends
// site.videoAccess.signedInEvent, which shows the comments (Disqus.astro), and only after that
// does it look at the service. The check for an empty service address, which came first, moved
// behind step 3 for the same reason: it used to show "unavailable" even to a guest.
import { site } from "../config";
import { readAuthFlag } from "./auth-flag";
// A type-only import is erased from the bundle, so it does not pull Clerk into this script; the
// code comes through the dynamic import in loadClerk().
import type { Clerk } from "@clerk/clerk-js";

// "blocked" added 2026-10-02 with the owner's status model: the service answers 403 "blocked" to a
// member whose status is blocked, which is not "pay to watch" (PaidVideo.astro).
type State = "loading" | "guest" | "denied" | "missing" | "failed" | "blocked";

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
  // Added later on 2026-09-28 (the header says why): no session means a stale flag, so the
  // sign-in link, as the token check below would give; a session tells the comments to show.
  if (!clerk.session) {
    show("guest");
    return;
  }
  document.dispatchEvent(new CustomEvent(site.videoAccess.signedInEvent));

  // Moved here from the top of this function later on 2026-09-28 (see the header).
  if (endpoint === "") {
    console.error(
      "Paid video: site.videoAccess.endpoint is empty (PAID-VIDEO.md, one-time setup).",
    );
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
        // Changed 2026-10-02: a 403 may now name the status "blocked" (the State type's note).
        const refusal: unknown = await answer.json().catch(() => undefined);
        const blocked =
          typeof refusal === "object" &&
          refusal !== null &&
          "error" in refusal &&
          refusal.error === "blocked";
        show(blocked ? "blocked" : "denied");
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
    // Added 2026-09-30: a lecture stored as a file (Yandex Disk) comes as {"videoUrl"}, played in a
    // video element; the rest of this function is the frame for a player page, as before.
    if (typeof body === "object" && body !== null && "videoUrl" in body) {
      playFile(target, body.videoUrl);
      return;
    }
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

  // Added 2026-09-30: the same steps as play() for a direct file address - https on one of
  // site.videoAccess.fileHosts or nothing, then the video element from its template - so a broken
  // or taken-over service cannot make the page load a file from anywhere else.
  function playFile(target: HTMLElement, address: unknown): void {
    const hosts: readonly string[] = site.videoAccess.fileHosts;
    let url: URL | undefined;
    try {
      url = typeof address === "string" ? new URL(address) : undefined;
    } catch {
      url = undefined;
    }
    const template = document.querySelector<HTMLTemplateElement>(
      "template[data-paid-file]",
    );
    const video = template?.content.firstElementChild?.cloneNode(true);
    if (
      url === undefined ||
      url.protocol !== "https:" ||
      !hosts.includes(url.hostname) ||
      !(video instanceof HTMLVideoElement)
    ) {
      console.error("Paid video: refused the file address", address);
      show("failed");
      return;
    }
    video.src = url.href;
    target.replaceWith(video);
    document.dispatchEvent(new CustomEvent(site.videoAccess.grantedEvent));
  }
}
