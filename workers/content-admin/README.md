# The content service of the admin panel

`worker.mjs` is a Cloudflare Worker that adds, edits and deletes the site's posts for a metr or an admin, who need no
GitHub account. Added 2026-10-02. What it does, its contract and its settings are in the header of `worker.mjs`; how to
use it, set it up and test it is [ADMIN.md](../../ADMIN.md) (sections 3 to 5).

- On this machine: `npm run content-admin:dev` (or `npm run dev:all`), on http://127.0.0.1:8789, with a stand-in for
  GitHub that works on this working copy.
- Tests: `npm run check:content-admin`, no network.
- Live: a Worker of its own, the file pasted into its editor in the Cloudflare Dashboard, the settings of ADMIN.md
  section 5, and its address in `site.admin.endpoint` in `src/config.ts`. The answer header `X-Content-Admin-Version`
  shows which version is deployed; compare it with `VERSION` in the file after every change.
- Its session check is a copy of `workers/video-access/worker.mjs`'s; change the two together (the test fails otherwise).
