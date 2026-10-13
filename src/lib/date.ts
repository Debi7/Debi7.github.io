const FRONT_MATTER_OFFSET_MINUTES = 180;

function shifted(date: Date): Date {
  return new Date(date.getTime() + FRONT_MATTER_OFFSET_MINUTES * 60_000);
}

export function formatIsoDate(date: Date): string {
  const d = shifted(date);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${month}-${day}`;
}

// English month abbreviations, hard-coded rather than taken from Intl: Hugo renders the
// English strings here (hugo.toml sets no defaultContentLanguage), and Intl output depends
// on the build machine's ICU data.
// Changed 2026-10-13 at the owner's word: the interface has one language, Russian. The abbreviations are Russian now,
// in the genitive a Russian date reads in ("05 мая"), and still hard-coded for the reason above.
const MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

export function formatMonthDay(date: Date): string {
  const d = shifted(date);
  // Changed 2026-10-13 with the Russian months: the day comes first, "07 сен".
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatYear(date: Date): string {
  return String(shifted(date).getUTCFullYear());
}

export function formatDateTime(date: Date): string {
  const d = shifted(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = Math.abs(FRONT_MATTER_OFFSET_MINUTES);
  const sign = FRONT_MATTER_OFFSET_MINUTES < 0 ? "-" : "+";
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  return `${formatIsoDate(date)}T${time}${sign}${pad(Math.floor(offset / 60))}:${pad(offset % 60)}`;
}
