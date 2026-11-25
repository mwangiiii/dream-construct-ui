// Minimal markdown → HTML for admin-authored policy content.
//
// Deliberately not a markdown library. The supported subset (headings, bold,
// italic, links, lists, paragraphs) covers legal copy, and avoiding a
// dependency keeps the bundle and the audit surface small.
//
// ── Safety ─────────────────────────────────────────────────────────────────
// HTML is escaped BEFORE any formatting is applied, so author input can never
// introduce tags — the only tags in the output are ones this function emits.
// That is what makes the result safe to pass to dangerouslySetInnerHTML.
// Keep that order if you extend this: format-then-escape would be an XSS hole.
//
// Link hrefs are additionally whitelisted to http/https/mailto so a
// `javascript:` URL cannot slip through as a clickable link.

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const SAFE_HREF = /^(https?:\/\/|mailto:|\/)/i;

// Inline formatting, applied to already-escaped text.
const inline = (s: string): string =>
  s
    // [label](href) — href validated, anything else renders as plain text.
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) =>
      SAFE_HREF.test(href)
        ? `<a href="${href}" class="text-primary underline hover:no-underline"` +
          `${href.startsWith("/") ? "" : ' target="_blank" rel="noopener noreferrer"'}>${label}</a>`
        : `${label} (${href})`)
    // Bold before italic, so ** is not consumed by the single-* rule.
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

export function renderMarkdown(src: string): string {
  if (!src?.trim()) return "";

  const lines = escapeHtml(src).replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (listType) { out.push(`</${listType}>`); listType = null; }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) { flushPara(); closeList(); continue; }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushPara(); closeList();
      const level = Math.min(heading[1].length + 1, 6); // # → h2, page owns h1
      const size = level === 2 ? "text-xl" : level === 3 ? "text-lg" : "text-base";
      out.push(
        `<h${level} class="${size} font-semibold text-foreground mt-8 mb-3">` +
        `${inline(heading[2])}</h${level}>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const want = ul ? "ul" : "ol";
      if (listType !== want) {
        closeList();
        listType = want;
        out.push(`<${want} class="${want === "ul" ? "list-disc" : "list-decimal"} ` +
                 `pl-6 space-y-1.5 my-4">`);
      }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
      continue;
    }

    closeList();
    para.push(line);
  }

  flushPara();
  closeList();
  return out.join("");
}
