# The status service of the admin panel

`worker.mjs` is a Cloudflare Worker through which a metr or an admin gives the club's members their statuses. Added
2026-10-02. It holds the Clerk secret key, which controls every user of the instance, and nothing else secret. What it
does, its rules, its contract and its settings are in the header of `worker.mjs`; how to use it, set it up and test it
is [ADMIN.md](../../ADMIN.md) (sections 1 to 5).

- On this machine: `npm run statuses:dev` (or `npm run dev:all`), on http://127.0.0.1:8790, against the real Clerk
  instance, with the secret key and `ADMIN_IDS` from `settings.local.json` in this folder, which git ignores
  (ADMIN.md 4.2).
  Changed later on 2026-10-02: the secret key is no longer in `settings.local.json`, which keeps `ADMIN_IDS` only. It is
  in `clerk-secret.local.dpapi` in this folder, encrypted for one Windows account by `npm run statuses:key`, also
  ignored by git (ADMIN.md section 3, step 4, and section 9).
- Tests: `npm run check:statuses`, no network.
- Live: a Worker of its own (never the content or the video Worker: no Worker holds two secrets), the settings of
  ADMIN.md section 5, and its address in `site.admin.statusesEndpoint` in `src/config.ts`. The answer header
  `X-Statuses-Version` shows which version is deployed.
- Its session check is a copy of `workers/video-access/worker.mjs`'s; change the two together (the test fails otherwise).
