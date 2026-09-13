// Date formatting for anything that ports a Hugo `.Date.Format` call. Added for the
// Categories page (MIGRATION-PLAN.md §4.1); the posts list and the post layout will use it
// next, and their Hugo layout strings are already in src/i18n/strings.ts
// (`date_month_day_format`, `date_year`).
//
// Hugo's `.Date.Format` renders a date in the offset written in the front matter - not in
// UTC and not in the build machine's zone. Every post in this site carries `+03:00`, so
// that offset is applied here. It matters: a post written at, say, 01:00+03:00 would slide
// to the previous day if the date were formatted in UTC.
//
// `z.coerce.date()` in src/content/config.ts parses the string into an absolute instant and
// drops the original offset, which is why the offset is a constant here rather than read
// per post. If content ever mixes offsets, keep the raw string in the collection schema and
// format from that instead.
const FRONT_MATTER_OFFSET_MINUTES = 180;

function shifted(date: Date): Date {
  return new Date(date.getTime() + FRONT_MATTER_OFFSET_MINUTES * 60_000);
}

// Hugo layout "2006-01-02".
export function formatIsoDate(date: Date): string {
  const d = shifted(date);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${month}-${day}`;
}

// English month abbreviations, hard-coded rather than taken from Intl: Hugo renders the
// English strings here (hugo.toml sets no defaultContentLanguage), and Intl output depends
// on the build machine's ICU data.
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Hugo layout "Jan 02", which the list templates take from the `date_month_day_format`
// i18n string. Renders e.g. "Sep 07".
export function formatMonthDay(date: Date): string {
  const d = shifted(date);
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Hugo layout "2006", used by `.Pages.GroupByDate "2006"`.
export function formatYear(date: Date): string {
  return String(shifted(date).getUTCFullYear());
}
