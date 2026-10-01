# Yandex Metrika: the counter settings, and what the site could add

Written on 2026-09-30 at the owner's request, for the colleague's review. Part 1 answers the questions the colleague
asked while setting up the counter. Part 2 describes what the counter code on the site does today. Part 3 proposes
changes to the site; **none of them is built yet**, each waits for the colleague's word. Part 4 lists the questions.

The counter code is in `src/layouts/Base.astro` since the colleague's commit e019697 (counter 113224698).

## 1. The colleague's questions

### 1.1 The counter's name ("Имя счетчика")

The name is only a label in the Metrika account; visitors never see it, and it changes nothing on the site.
"Клуб Биолокации Radiesthesia Club" is fine. One name is enough as well, for example "Radiesthesia Club". If there is
ever more than one counter, adding the address helps to tell them apart: "Radiesthesia Club (debi7.github.io)".

### 1.2 The code settings ("Настройки кода счетчика")

Checked against Yandex's help and the counter's documented parameters (sources at the end).

- **"Отслеживание хеша в адресной строке браузера" (hash tracking) - off, correct.** It is for sites that change the
  page by changing the `#...` part of the address. The only such links here are the table of contents of an article
  (`#section`); with the option on, every click in the table of contents would count as a separate page view.
- **"Для XML сайтов" - off, correct.** It only removes the `noscript` tag from the code, for pages served as XML. The
  site is ordinary HTML.
- **"В одну строку" - either way.** It changes only how the code looks: one line instead of several. The code is
  already in `Base.astro`, formatted by Prettier; there is no need to copy it again for this option.
- **"Альтернативный CDN" - depends on the audience.** The colleague's reading is right: it lets the counter count
  visits from regions where access to Yandex is restricted, and it may load the counter's code more slowly. Without it,
  a visitor in such a region is not counted at all, because the counter's code never loads for them. The slower load
  does not slow the page down: the counter loads asynchronously. Recommendation: on, if part of the club's audience is
  in such regions; off otherwise.
- **"Тайм-аут визита в минутах" - 30, the default.** Keep it.

One thing to keep in mind: the options in this dialog change the code snippet itself. After changing one, the new
snippet has to replace the old one in `Base.astro`, or the site keeps running the old code. "В одну строку" is the
exception, since it changes the formatting only.

## 2. What the counter code on the site does today

- `init` with `ssr`, `webvisor` (Session Replay), `clickmap`, `ecommerce: "dataLayer"`, `accurateTrackBounce`,
  `trackLinks`, and the referrer and address of the page. Every page load is counted by `init` itself.
- `ecommerce: "dataLayer"` comes from the e-commerce switch in the counter's settings. The site has no shop, so it
  collects nothing; it can be switched off in the settings and then disappears from the snippet.
- **The block at the end of the page never runs.** It sends a `hit` on the `astro:page-load` event. Astro 4 fires that
  event only from the `<ViewTransitions />` component (Astro docs, "View Transitions", lifecycle events), and the site
  does not use it, so the block does nothing. That is harmless, because `init` already counts each page. If view
  transitions are ever switched on, the block starts working, and then it would count the first page twice (`init`
  plus the event on the first load), so it would need to skip that first event.
- **The counter also runs on `npm run dev`.** Every local test on `localhost`, the owner's and the colleague's, goes
  into the statistics.
- The counter number is written out three times in `Base.astro`: the script address, `init`, and the `noscript`
  image (a fourth time in the block that never runs).

## 3. Proposals

### 3.1 Keep personal data out of Session Replay (recommended)

Session Replay records all the content of the site's pages, except fields where visitors enter confidential
information, such as names and passwords (Yandex's help, "Enabling and configuring Session Replay"). That leaves two
things on this site in the recordings:

- the member's email address and name on the account page, `/auth/account/`, which Clerk shows as text, not as a
  field, and the Clerk forms of `/auth/signin/` and `/auth/signup/`;
- the message a visitor types into the feedback form.

Yandex provides two CSS classes for this, both documented on the same help page:

- `ym-hide-content` - "prohibit the recording of an arbitrary site element": in the recording the element is greyed
  out and its text replaced with blurred random characters. Proposed on the elements Clerk is mounted into:
  `#clerk-signin` (`src/pages/auth/signin.astro`), `#clerk-signup` (`src/pages/auth/signup.astro`) and
  `#clerk-profile` (`src/pages/auth/account.astro`).
- `ym-disable-keys` - "prohibit the recording of a field's contents": replaced with asterisks. Proposed on the
  fields of the feedback form (`src/components/ContactModal.astro`, three inputs and the textarea).

Four files, a class each; nothing a visitor can see changes.

### 3.2 Count the published site only (recommended)

Load the counter only in the built site: the counter code in `Base.astro` goes inside a condition on
`import.meta.env.PROD`, which Astro sets for `astro build` and not for `astro dev`. Local work stops polluting the
statistics. A local `npm run preview` of a build would still count, which is rare.

### 3.3 Goals (recommended)

Metrika can count the actions that matter to the club as goals. Proposed:

- `feedback_sent` - the feedback form was sent successfully (`ContactModal.astro`, after web3forms answers);
- `paid_signin_click` - a guest pressed "Войти" on a paid lecture (`src/components/PaidVideo.astro`);
- `paid_lecture_opened` - a member's player appeared on a paid lecture (the page already sends the event
  `site.videoAccess.grantedEvent` at that moment, `src/scripts/paid-video.ts`).

On the site: a small helper, `src/scripts/metrika.ts`, which calls `ym(<counter>, "reachGoal", "<name>")` only when
the counter has loaded, and three calls to it. In Metrika, the colleague creates three goals of the type
"JavaScript-событие" with exactly these identifiers; a goal that does not exist in Metrika is not counted. The names
can be any others the colleague prefers.

### 3.4 The counter number in one place

The project's rule is that a site-wide setting lives in `src/config.ts` once. Proposed: `site.metrika.counterId`
there, handed to the inline block in the head through `define:vars` (as the sign-in flag block beside it already
does), and used by the `noscript` image and by the goals of 3.3. Changing the counter then means changing one line.

### 3.5 The block that never runs

Remove it, or keep it for a future with view transitions and teach it to skip the first event (part 2). Removing it
is the simpler choice; it is the colleague's code, so it is the colleague's call.

## 4. Questions for the colleague

- "Альтернативный CDN": is part of the audience in regions where Yandex is blocked? If yes, switch it on and replace
  the code in `Base.astro` with the new snippet.
- Which of 3.1 to 3.5 should be done? The recommendation is 3.1, 3.2 and 3.3.
- For 3.3: are the three goals and their names right, or are other actions more important?
- For 3.5: remove the block, or keep it?

## Sources

- Yandex Metrika help, "Enabling and configuring Session Replay":
  <https://yandex.ru/support/metrica/en/webvisor/settings>
- Yandex Metrika help, the counter's initialisation parameters:
  <https://yandex.ru/support/metrica/code/counter-initialize.html>
- The code settings dialog ("Альтернативный CDN", "Для XML сайтов", "В одну строку"), as described in PromoPult's
  guide: <https://blog.promopult.ru/sales/gajd-po-yandeks-metrike.html>
- Astro 4 documentation, "View Transitions", lifecycle events, `astro:page-load`.
