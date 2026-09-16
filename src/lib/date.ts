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

export function formatMonthDay(date: Date): string {
  const d = shifted(date);
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
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
