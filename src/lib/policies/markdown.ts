/**
 * Parser for policy documents.
 *
 * Policies are written in a small, fixed subset of Markdown: `##` sections, `###`
 * sub-headings, paragraphs, `-` and `1.` lists, `>` notes, `**bold**`, `[links](...)`
 * and `{{tokens}}`. The parser produces a plain tree and never passes text through as
 * HTML, so whatever an administrator types can only ever become text, a list, a
 * heading or a link to an allowed address.
 *
 * This file has no server-only imports: the admin editor runs it in the browser for
 * its live preview.
 */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] }
  /** A token that resolved to a configured value. */
  | { type: "value"; value: string }
  /** A token with nothing configured yet, shown as a marked placeholder. */
  | { type: "placeholder"; label: string };

export type BlockNode =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "note"; children: InlineNode[] }
  | { type: "subheading"; text: string }
  | { type: "list"; ordered: boolean; items: InlineNode[][] };

export interface PolicySection {
  id: string;
  number: number;
  title: string;
  blocks: BlockNode[];
}

export interface PolicyDocument {
  intro: BlockNode[];
  sections: PolicySection[];
  /** Labels of every placeholder left in the document, for the admin "outstanding" list. */
  placeholders: string[];
}

export interface TokenResolver {
  /** Returns the configured value, or a placeholder label when nothing is set. */
  inline(key: string): { value: string } | { placeholder: string };
  /** Markdown lines for a `{{block.*}}` token on its own line, or null if unknown. */
  block(key: string): string[] | null;
}

const INLINE_PATTERN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Links may only go to this site, a secure web address, an email or a phone number. */
export function isAllowedHref(href: string): boolean {
  return (
    (href.startsWith("/") && !href.startsWith("//")) ||
    href.startsWith("#") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section"
  );
}

function parseInline(source: string, resolver: TokenResolver, found: string[]): InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;

  for (const match of source.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push({ type: "text", value: source.slice(cursor, index) });

    const [whole, bold, linkText, linkHref, token] = match;
    if (bold !== undefined) {
      nodes.push({ type: "bold", children: parseInline(bold, resolver, found) });
    } else if (linkText !== undefined && linkHref !== undefined) {
      const children = parseInline(linkText, resolver, found);
      // A link to anywhere else is dropped, keeping its text.
      if (isAllowedHref(linkHref)) nodes.push({ type: "link", href: linkHref, children });
      else nodes.push(...children);
    } else if (token !== undefined) {
      const resolved = resolver.inline(token);
      if ("value" in resolved) {
        nodes.push({ type: "value", value: resolved.value });
      } else {
        found.push(resolved.placeholder);
        nodes.push({ type: "placeholder", label: resolved.placeholder });
      }
    }
    cursor = index + whole.length;
  }

  if (cursor < source.length) nodes.push({ type: "text", value: source.slice(cursor) });
  return nodes;
}

/** Replace `{{block.*}}` lines with the Markdown they stand for. */
function expandBlocks(content: string, resolver: TokenResolver): string[] {
  const lines: string[] = [];
  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    const match = /^\s*\{\{\s*(block\.[a-zA-Z0-9_.]+)\s*\}\}\s*$/.exec(line);
    const expansion = match ? resolver.block(match[1]) : null;
    if (expansion) lines.push("", ...expansion, "");
    else lines.push(line);
  }
  return lines;
}

export function parsePolicy(content: string, resolver: TokenResolver): PolicyDocument {
  const found: string[] = [];
  const intro: BlockNode[] = [];
  const sections: PolicySection[] = [];
  const usedIds = new Set<string>();

  let target = intro;
  let paragraph: string[] = [];
  let note: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) {
      target.push({ type: "paragraph", children: parseInline(paragraph.join(" "), resolver, found) });
      paragraph = [];
    }
    if (note.length) {
      target.push({ type: "note", children: parseInline(note.join(" "), resolver, found) });
      note = [];
    }
    if (list) {
      target.push({
        type: "list",
        ordered: list.ordered,
        items: list.items.map((item) => parseInline(item, resolver, found)),
      });
      list = null;
    }
  };

  for (const raw of expandBlocks(content, resolver)) {
    const line = raw.trim();

    if (!line) {
      flush();
      continue;
    }

    const section = /^##\s+(.+)$/.exec(line);
    if (section) {
      flush();
      const title = section[1].trim();
      let id = slugify(title);
      for (let suffix = 2; usedIds.has(id); suffix += 1) id = `${slugify(title)}-${suffix}`;
      usedIds.add(id);
      const next: PolicySection = { id, number: sections.length + 1, title, blocks: [] };
      sections.push(next);
      target = next.blocks;
      continue;
    }

    const sub = /^###\s+(.+)$/.exec(line);
    if (sub) {
      flush();
      target.push({ type: "subheading", text: sub[1].trim() });
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (paragraph.length || note.length || (list && list.ordered !== ordered)) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }

    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      if (paragraph.length || list) flush();
      note.push(quoted[1]);
      continue;
    }

    if (list || note.length) flush();
    paragraph.push(line);
  }
  flush();

  return { intro, sections, placeholders: [...new Set(found)] };
}
