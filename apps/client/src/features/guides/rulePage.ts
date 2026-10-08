// Reads a rule page's Sources list and Numbers table (docs/rules/<page>.md) for the sources
// page and the numbers pages (R-GUIDE-006, R-GUIDE-007). Plain text in, plain data out.

export interface RuleSource {
  title: string;
  url: string;
  /** `YYYY-MM-DD`: the page's "All read" date, or failing that the date in its status line. */
  readOn: string | null;
}

export interface RulePage {
  /** The file name without `.md`: `route-gates`. */
  name: string;
  /** The page's first heading. */
  title: string;
  sources: RuleSource[];
  numbers: { header: string[]; rows: { cells: string[]; working: boolean }[] } | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "8 Oct 2026" or "8 October 2026" as `2026-10-08`, or null. */
export function isoDay(words: string): string | null {
  const match = /(\d{1,2}) ([A-Z][a-z]+) (\d{4})/.exec(words);
  if (match === null) return null;
  const month = MONTHS.indexOf((match[2] ?? "").slice(0, 3)) + 1;
  if (month === 0) return null;
  return `${match[3] ?? ""}-${String(month).padStart(2, "0")}-${(match[1] ?? "").padStart(2, "0")}`;
}

/** The lines of one `## ` section, without its heading. */
function section(lines: readonly string[], heading: string): string[] {
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return end === -1 ? rest : rest.slice(0, end);
}

const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

/** Splits a table row into its cells. */
function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function readRulePage(name: string, markdown: string): RulePage {
  const lines = markdown.split("\n");
  const title = (lines.find((line) => line.startsWith("# ")) ?? name).replace(/^# /, "").trim();
  const status = lines.find((line) => line.startsWith("> Status:")) ?? "";
  const sourceLines = section(lines, "Sources");
  const allRead = sourceLines.find((line) => /^All read /.test(line.trim()));
  const readOn = isoDay(allRead ?? status);
  const sources: RuleSource[] = sourceLines
    .filter((line) => line.trim().startsWith("- "))
    .flatMap((line) => [...line.matchAll(LINK)].map((match) => ({ title: match[1] ?? "", url: match[2] ?? "", readOn })));
  const table = section(lines, "Numbers").filter((line) => line.trim().startsWith("|"));
  const [head, , ...body] = table;
  const numbers =
    head === undefined
      ? null
      : {
          header: cells(head),
          rows: body.map((row) => ({ cells: cells(row), working: /working value/i.test(row) })),
        };
  return { name, title, sources, numbers };
}

/** Inline markdown in a cell: text, `code` and [links](https://...), in order. */
export type Inline = { kind: "text" | "code"; text: string } | { kind: "link"; text: string; url: string };

export function inline(cell: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let at = 0;
  for (const match of cell.matchAll(pattern)) {
    const index = match.index;
    if (index > at) parts.push({ kind: "text", text: cell.slice(at, index) });
    if (match[1] !== undefined) parts.push({ kind: "code", text: match[1] });
    else parts.push({ kind: "link", text: match[2] ?? "", url: match[3] ?? "" });
    at = index + match[0].length;
  }
  if (at < cell.length) parts.push({ kind: "text", text: cell.slice(at).replace(/\*\*/g, "") });
  return parts.map((part) => (part.kind === "text" ? { ...part, text: part.text.replace(/\*\*/g, "") } : part));
}
