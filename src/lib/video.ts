import { getCollection, type CollectionEntry } from "astro:content";
import { urlize } from "./urlize";
import { titleize } from "./titleize";
import { formatYear } from "./date";
import { site } from "../config";

export type Video = CollectionEntry<"video">;

export async function getVideo(): Promise<Video[]> {
  const now = Date.now();
  const video = await getCollection(
    "video",
    (p) =>
      import.meta.env.DEV || (!p.data.draft && p.data.date.getTime() <= now),
  );
  return video.sort(
    (a, b) =>
      b.data.date.getTime() - a.data.date.getTime() ||
      a.data.title.localeCompare(b.data.title) ||
      a.id.localeCompare(b.id),
  );
}

export type ListPage<T> = {
  items: T[];
  number: number;
  last: number;
  prevUrl: string | undefined;
  nextUrl: string | undefined;
  numbers: PageNumber[];
  numbersCompact: PageNumber[];
};

export type PageNumber =
  | { kind: "page"; number: number; url: string; current: boolean }
  | { kind: "gap" };

export function pageNumbers(
  current: number,
  last: number,
  base: string,
  radius: number,
): PageNumber[] {
  const around = Array.from(
    { length: 2 * radius + 1 },
    (_, i) => current - radius + i,
  );
  const shown = [1, ...around, last]
    .filter((n, index, all) => n >= 1 && n <= last && all.indexOf(n) === index)
    .sort((a, b) => a - b);
  const page = (n: number): PageNumber => ({
    kind: "page",
    number: n,
    url: pageUrl(base, n),
    current: n === current,
  });
  const entries: PageNumber[] = [];
  let previous = 0;
  for (const n of shown) {
    if (n - previous === 2) entries.push(page(previous + 1));
    else if (n - previous > 2) entries.push({ kind: "gap" });
    entries.push(page(n));
    previous = n;
  }
  return entries;
}

export function pageUrl(base: string, n: number): string {
  return n === 1 ? base : `${base}page/${n}/`;
}

export function pageParam(n: number, prefix?: string): string | undefined {
  const parts = [prefix, n === 1 ? undefined : `page/${n}`].filter(Boolean);
  return parts.length > 0 ? parts.join("/") : undefined;
}

export function paginateList<T>(
  items: T[],
  base: string,
  pageSize: number = site.pagination.pageSize,
): ListPage<T>[] {
  const last = Math.max(1, Math.ceil(items.length / pageSize));
  return Array.from({ length: last }, (_, index) => {
    const number = index + 1;
    return {
      items: items.slice(index * pageSize, number * pageSize),
      number,
      last,
      prevUrl: number > 1 ? pageUrl(base, number - 1) : undefined,
      nextUrl: number < last ? pageUrl(base, number + 1) : undefined,
      numbers: pageNumbers(number, last, base, 2),
      numbersCompact: pageNumbers(number, last, base, 1),
    };
  });
}

export type YearLink = { year: string; url: string };

export function yearLinks(groups: YearGroup[]): YearLink[] {
  return groups.map((group) => ({
    year: group.year,
    url: `/video/${group.year}/`,
  }));
}

export type Term = {
  name: string;
  title: string;
  slug: string;
  videoArr: Video[];
};

export async function getTerms(kind: "tags" | "categories"): Promise<Term[]> {
  const byName = new Map<string, Video[]>();
  for (const videoArr of await getVideo()) {
    for (const name of videoArr.data[kind]) {
      byName.set(name, [...(byName.get(name) ?? []), videoArr]);
    }
  }
  return [...byName]
    .map(([name, videoArr]) => ({
      name,
      title: titleize(name),
      slug: urlize(name),
      videoArr,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type YearGroup = { year: string; videoArr: Video[] };

export function groupByYear(videoArr: Video[]): YearGroup[] {
  const groups: YearGroup[] = [];
  for (const videoItem of videoArr) {
    const year = formatYear(videoItem.data.date);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.videoArr.push(videoItem);
    else groups.push({ year, videoArr: [videoItem] });
  }
  return groups;
}

export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words / 200);
}
