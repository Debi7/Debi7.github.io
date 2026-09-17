import type { MarkdownHeading } from "astro";

const startLevel = 1;
const endLevel = 6;

type TocNode = { heading?: MarkdownHeading; children: TocNode[] };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderList(nodes: TocNode[]): string {
  if (nodes.length === 0) return "";
  const items = nodes.map((node) => {
    const link = node.heading
      ? `<a href="#${escapeHtml(node.heading.slug)}">${escapeHtml(node.heading.text)}</a>`
      : "";
    return `<li>${link}${renderList(node.children)}</li>`;
  });
  return `<ul>${items.join("")}</ul>`;
}

export function tocHtml(headings: MarkdownHeading[]): string {
  const root: TocNode = { children: [] };
  for (const heading of headings) {
    if (heading.depth < startLevel || heading.depth > endLevel) continue;
    let parent = root;
    for (let level = startLevel; level < heading.depth; level++) {
      if (parent.children.length === 0) parent.children.push({ children: [] });
      parent = parent.children[parent.children.length - 1];
    }
    parent.children.push({ heading, children: [] });
  }
  const list = renderList(root.children);
  return list ? `<nav id="TableOfContents">${list}</nav>` : "";
}
