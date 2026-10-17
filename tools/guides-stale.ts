// tsx tools/guides-stale.ts --today YYYY-MM-DD: lists the guides not checked for
// tuning.guide.staleMonths months (R-GUIDE-004). The date is an argument so the
// content check itself never reads a clock.
import type { Content } from "@japacity/sim";

import { content, staleGuides, text } from "../packages/content/src/index";

/** What the tool prints and its exit code: 1 when the arguments are wrong, otherwise 0. */
export function guidesStale(args: readonly string[], of: Content = content): { lines: string[]; code: number } {
  const at = args.indexOf("--today");
  const today = at === -1 ? undefined : args[at + 1];
  if (today === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return { lines: ["Usage: tsx tools/guides-stale.ts --today YYYY-MM-DD"], code: 1 };
  }
  let stale: string[];
  try {
    stale = staleGuides(of, today);
  } catch (error) {
    return { lines: [error instanceof Error ? error.message : String(error)], code: 1 };
  }
  const months = of.tuning.guide.staleMonths;
  if (stale.length === 0) return { lines: [`No guide is more than ${String(months)} months past its check on ${today}.`], code: 0 };
  return {
    lines: [
      `${String(stale.length)} guide(s) not checked for ${String(months)} months on ${today}:`,
      ...stale.map((id) => `${id}  checked ${of.guide[id as keyof Content["guide"]]?.checkedOn ?? "never"}  ${text[`${id}.title`] ?? ""}`),
    ],
    code: 0,
  };
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) {
  const { lines, code } = guidesStale(process.argv.slice(2));
  for (const line of lines) console.log(line);
  process.exit(code);
}
