# video-access

The access service for paid videos: a Cloudflare Worker that gives a signed-in member the player address of a paid
video and refuses everybody else. Added on 2026-09-28. The contract, the settings and the token checks are in the
header of `worker.mjs`; how it fits the site, how to deploy it and how to add a video are in `PAID-VIDEO.md` at the
root of the repository (section 5.2 is the deployment, step by step).

- `worker.mjs` is the whole service: one file, no imports, pasted into the Worker's editor in the Cloudflare
  Dashboard. No wrangler and no npm dependency.
- `videos.local.json` is the local map of slugs to video ids for `npm run video-access:dev`. Git ignores it: real
  ids of paid videos never enter the repository. The live map is the Worker's secret `VIDEOS`.
  Added 2026-09-30: a value may also be `{"yandexDisk": "https://disk.yandex.ru/i/<key>"}`, the public link of a
  lecture on Yandex Disk; the service then answers a short-lived file address (`PAID-VIDEO.md` section 10).
- `npm run check:video-access` tests the file without a network; `npm run video-access:dev` runs it on this machine
  at `http://127.0.0.1:8787`.
- `CLOUDFLARE.md` at the root of the repository: why Cloudflare, registering the account, the costs and the
  alternatives (added 2026-09-28).
- `npm run dev:all` runs it together with the dev server, in one terminal; this is how to start the site for any
  work on videos (added 2026-09-28).

When `worker.mjs` changes, paste it into the Dashboard again and raise `VERSION` in it, so that the header
`X-Video-Access-Version` shows which copy is live.
