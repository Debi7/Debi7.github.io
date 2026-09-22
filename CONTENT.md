# Content guide

How to add and change posts on the site. Written on 2026-09-19. It keeps the headings of the Hugo site's
`CONTENT.md`, so that things are found in the same places. Images are covered as far as a post needs them; the
sections of that guide on the About page, the home page and the menu are not written for this site yet, and belong to
the documentation step of [MIGRATION-PLAN.md](MIGRATION-PLAN.md).

Every step below was tried on a copy of the site on 2026-09-19: a post made from `templates/post.md`, kept as a draft,
published, dated later in the day, given an image, and left without a title.

Run the commands from the repository root. Preview with `npm run dev` at <http://localhost:4321/>; the page reloads
on save. Before committing run `npm run fix` and `npm run check` (see [README.md](README.md)).

## Where things live

- Posts: `src/content/posts/<name>.md`, one file per post. The file name is the address: `/posts/<name>/`.
- Templates for new posts: `templates/`; see "Create a post" below.
- Images for posts: `public/images/`, shown at `/images/...`; see "Images in a post" below.
- The Posts list, the tag pages and the category pages: generated from the posts. Nothing to create by hand.
- The number of posts on one page of a list: `pagination.pageSize` in `src/config.ts`, 5 today.
- The fields a post may have, and which are required: the schema in `src/content/config.ts`.

## Posts

### Create a post

Pick the template closest to the post:

- `templates/post.md` - the general one. Its comments hold the full rules for every field and for headings.
- `templates/article.md` - a note in the `blog` category, showing the formatting a post can use.
- `templates/radiesthesia-and-energy-fields.md` - a long article in the `education` category, with sections,
  subsections and a glossary.
- `templates/draft.md` - a draft with only the fields a post needs.

On the GitHub website:

1. Open the template in `templates/` and copy its contents with the "Copy raw file" button above the file.
2. Open the folder `src/content/posts/` and choose "Add file" -> "Create new file".
3. Type the file name, for example `pendulum-exercises.md`: lower-case Latin letters, digits and hyphens. It becomes
   the address of the post, `/posts/pendulum-exercises/`. Do not name a post after a year, like `2025.md`:
   `/posts/2025/` is where the posts of 2025 are listed.
4. Paste the template, and fill in `title`, `date` and the text. Keep `draft: true` while the post is being written.
5. Choose "Commit changes" and commit to the `main` branch. Every commit to `main` rebuilds and publishes the site; a
   draft stays off it.
6. To publish: edit the file, set `draft` to `false` and `date` to the moment of publication, and commit again. See
   "The date and time" below: a time later than the build keeps the post hidden.

The build runs in the repository's "Actions" tab. If it fails, the site stays as it was, and the log names the file
and the field. A post without a title, for example, stops the build with
`posts → <name>.md frontmatter does not match collection schema. title: Required`.

On your own computer:

1. Copy the template into `src/content/posts/` under the new name, and fill it in.
2. Run `npm run dev` and open `http://localhost:4321/posts/<name>/`. Drafts and posts dated in the future are shown
   here, so the post can be read before it is published.
3. When it is ready, set `draft` to `false` and `date` to the moment of publication.
4. Run `npm run fix`, `npm run check`, `npm run build` and `npm run check:pages`. The last one checks every list the
   post appears in; see [PAGINATION.md](PAGINATION.md), section 10.
5. Commit, and push to `main`.

### The date and time

- Write the date the way the templates do: `"2026-09-19T10:00:00+03:00"`, the time included. Keep `+03:00` at the
  end: the site shows every date in that time zone.
- The post is published by the first build after that moment, not before. A date later in the day counts as the
  future: with `10:00` in the date, a post committed at 09:00 stays hidden until the next build after 10:00. To publish
  at once, use a time that has already passed, the current time or an earlier hour of the same day.
- The date also puts the post in its year on the Posts list, and in its place in every list; see "The posts list
  page".

### Front matter reference

The block between the two `---` lines at the top of a post. Lines starting with `#` in it are comments and are never
published.

- `title` - required. The heading of the post, its text in every list, and the browser tab.
- `date` - required. Publication date and time with the time zone, e.g. `"2026-09-19T10:00:00+03:00"`. Every list is
  ordered by it; see "The posts list page". A post dated in the future stays off the published site until that date.
- `draft` - `true` shows the post only in `npm run dev`. Defaults to `false`.
- `description` - one sentence about the post. The page description for search engines and link previews, and the
  text the Share button on the post uses. Not shown in the lists.
- `tags` - a list, e.g. `["pendulum", "practice"]`. Written in lower case on the site. Each tag gets a page at
  `/tags/<tag>/`, and the tags are shown on the post's card in the lists.
- `categories` - a list, usually one entry, e.g. `["education"]`. The first category is shown above the post's title,
  and each gets a page at `/categories/<category>/`. The site has two today, `blog` for notes and `education` for
  articles; any other name starts a new category.
- `lastmod` - when the post was last changed, shown as "Last updated on". It does not change the order of the lists.
- `share_title`, `share_description` - the title and the text the Share button on the post uses, if they should
  differ from `title` and `description`.
- `summary` - the text the Share button uses when `share_description` and `description` are both empty; without all
  three, it uses the site title. The lists never use it.

The Hugo guide also lists `slug`, `aliases` and `cover`. This site does not support them yet, and they are ignored.

### Edit, rename, delete

- Edit: change the file. `npm run dev` reloads the page.
- Rename: the file name is the address, so the old address stops working; there are no redirects yet. Update the
  links other posts have to it.
- Delete: delete the file. A tag or a category no longer used by any post loses its page with the next build.

### The posts list page

Every list is split by year: the Posts list, each tag page and each category page. The buttons under the title choose
a year: `/posts/2025/` lists only the posts of 2025, five to a page, and Previous, Next and the page numbers at the
foot move between the pages of that year only; `/tags/<tag>/2025/` does the same for one tag. `/posts/` and
`/tags/<tag>/` themselves show the newest year. A post appears in the year of its `date`. Details are in
[PAGINATION.md](PAGINATION.md).

The order:

1. Newest first, by `date`, including the time.
2. The same date and time: by title, alphabetically.
3. The same title too: by file name.

`lastmod` does not move a post. A draft is counted in `npm run dev` but not on the published site, so the pages can
differ between the two.

A post with a `date` in the future is not published until that date, as on the Hugo site. It then appears with the
first build after its date - and a build runs when something is committed to `main`, so on a quiet day the post waits
for the next commit. `npm run dev` shows it at once, like a draft, so it can be read before its day.

A post's card in a list shows the title, the date, the first 140 or so characters of the text, the tags and a "Read
more" link. The opening paragraph is therefore what readers see in the list.

The page title "Posts" is written in `src/pages/posts/[...page].astro`.

### Writing

- Plain Markdown: paragraphs, `**bold**`, `_italic_`, lists, links `[text](https://...)`, quotes with `>`.
- Headings `##` and `###` build the table of contents. From a 1472px wide window up it stands to the right of the
  article and stays in view while scrolling; below that it is a collapsible list at the top of the article.
  Subsections are listed under their section, and a click on an entry scrolls to the heading and highlights it.
- Do not use a single `#` in the text: the title is already the top heading of the page. Do not add ids to headings;
  they are made from the text, Cyrillic included. A `####` is listed at the same level as a `###`.
- Code blocks with a language name, such as three backticks followed by `md`, are highlighted.
- Tables in GitHub style are supported.
- Link to another post by its address with the trailing slash: `[text](/posts/<name>/)`.
- Images: see "Images in a post" below.
- Not rendered in a post yet: formulas between dollar signs, which come out as code, and the callout boxes of the Hugo
  theme, which come out as raw text. Both are waiting on `MIGRATION-PLAN.md` §6.

## Images in a post

1. Name the image after the post, before uploading it: `pendulum-exercises-1.jpg`, `pendulum-exercises-2.jpg`, in
   lower-case Latin letters, digits and hyphens. The name is part of its address.
2. Put it into `public/images/`. On the GitHub website: open that folder, choose "Add file" -> "Upload files", drop
   the file in, and commit to `main`.
3. In the text of the post, on a line of its own:

   ```md
   ![What the image shows](/images/pendulum-exercises-1.jpg)
   ```

   The text in square brackets is read out to readers who cannot see the image and shown when it fails to load, so
   describe the picture there.

Everything in `public/` is published exactly as it is, without resizing or conversion. Use JPEG for photographs and
PNG for drawings, and keep a file under about 500 KB; a photo straight from a phone is usually several times that, so
scale it down first. On the page the image is centred, never wider than the text, with rounded corners and a shadow.
The address is case-sensitive on the server: `Photo.jpg` and `photo.jpg` are two different files.

The folder `public/images/carousel/` is the home page carousel, and every photo in it appears there; do not put post
images into it.

## Categories and tags

Both are set in the front matter of the posts, and nothing else is needed: the build generates `/categories/`,
`/categories/<name>/`, `/tags/` and `/tags/<name>/`. A tag with a space gets a hyphen in its address, so the tag
`water search` lives at `/tags/water-search/`. A tag used only by drafts gets no page on the published site.

## Checklist before publishing

1. Read the post once with `npm run dev`, or in the preview of the GitHub editor.
2. `draft: false`, and `date` set to a moment that has already passed, with `+03:00` at the end.
3. The file name is lower-case Latin letters, digits and hyphens, and is not a year.
4. Every image is in `public/images/`, and its address in the text matches the file name exactly, letter case
   included.
5. If you work on your own computer: `npm run fix`, `npm run check`, `npm run build`, `npm run check:pages`.
6. Commit to `main`, and check in the "Actions" tab that the build succeeded.
