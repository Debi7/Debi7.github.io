# Accepted risks

Risks the owner has looked at and accepted in writing, each with the date of the decision, what makes it acceptable,
and when it is looked at again. A risk leaves this file only when the reason for it is gone, and the entry then says
so instead of disappearing. Written on 2026-10-09 with the consilium verdict
`.specify/consilium/2026-10-09-self-hosted-rewrite.md`.

## 1. Node 20 after its end of life

- Accepted by the owner on 2026-10-09. Review on 2027-04-09, and again before the self-hosted site goes live
  (phase 8 of the verdict), whichever comes first.
- The facts on 2026-10-09: Node 20 reached its end of life on 2026-04-30; its last release is 20.20.2 of 2026-03-24.
  The security release of July 2026 shipped for the 26, 24 and 22 lines only and says that end-of-life versions are
  always affected (https://nodejs.org/en/blog/vulnerability/july-2026-security-releases). The official Docker images
  are built for 26, 24 and 22 only (https://raw.githubusercontent.com/nodejs/docker-node/main/versions.json); the tag
  `node:20.20.2-bookworm-slim` can still be pulled but is no longer rebuilt.
- Why it stays: the project runs on Node 20 on every machine it is developed on and will not move (CLAUDE.md, "Hard
  constraints"); the backend of the rewrite is written for Node 20 too.
- What makes it acceptable, all required before the site faces the internet: Node is never reachable from outside,
  only through nginx, and its port is not published; the image is `node:20.20.2-bookworm-slim` pinned by digest, with
  `apt-get upgrade` on every build so the Debian layer keeps its security updates (Debian 12 is supported until
  2028-06-30); the container runs as `node`, with a read-only root and dropped capabilities; every other dependency is
  on its latest patch release, and `npm audit` runs on every build. Recommended in addition: a weekly rebuild.
- What it does not cover: a flaw in Node's own HTTP parser or runtime found after 20.20.2 stays unpatched. nginx in
  front narrows that, it does not remove it.

## 2. The post validator of the admin panel can be bypassed (stored XSS)

- Found on 2026-10-09 by the consilium and reproduced against the real Markdown pipeline of the site. Not fixed, by
  the owner's decision of the same day: the rewrite replaces this code. If the rewrite does not go ahead, it must be
  fixed before the club's site is used with the admin panel.
- Where: `bodyProblem()` in `workers/content-admin/worker.mjs`, the check that is meant to refuse raw HTML outside
  code and links other than web, mail and the site's own paths (ADMIN.md 8). Its regular expressions read Markdown
  differently from the parser that renders it. Three cases pass the check and render as script or as a `javascript:`
  link: a code span that runs across a blank line, a code fence whose info string contains a backtick, and a
  reference link whose label contains an escaped bracket.
- What it allows: an editor (a metr) saves such a post; when an admin opens the page, the script runs as the admin on
  the site's origin and can call the statuses service on the admin's behalf, for example to make the metr an admin.
- Why it is not live today: the content-admin Worker is not deployed yet (ADMIN.md 7, "The live site (not done
  yet)"), so no post reaches the site through it.
- The fix, whichever code base it lands in: stop passing raw HTML through the Markdown pipeline and filter URL schemes
  on the parsed tree (a sanitizer such as `rehype-sanitize`), keeping the validator as a first gate only. More regular
  expressions would not close the class.
