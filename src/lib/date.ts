// Added 2026-10-12 for formatMonthDay() (two interface languages). Type-only, so nothing is loaded.
import type { Phrase } from "../i18n/lang";

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

// Added 2026-10-12 with the two interface languages: the Russian abbreviations, hard-coded for the
// same reason as the English ones above. Genitive, as a Russian date reads ("05 мая").
// camelCase, the house rule for new names (CLAUDE.md, open question 1 about the older ones).
const monthsRu = [
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

// Changed 2026-10-12: the date of a list card in both languages, the day first in Russian ("05
// мая") and second in English ("May 05", Hugo's "Jan 02" layout as before). It returned the English
// string: return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
export function formatMonthDay(date: Date): Phrase {
  const d = shifted(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  return {
    ru: `${day} ${monthsRu[d.getUTCMonth()]}`,
    en: `${MONTHS[d.getUTCMonth()]} ${day}`,
  };
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
