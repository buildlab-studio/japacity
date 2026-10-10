// Acts that answer in the place (docs/rules/activity.md R-ACTIVITY-015): an entry says when it answers. A now-act's
// card sends it at once and the place answers in a person's voice; a month-act fills a slot of the month.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";

import { words } from "./text";

const NOW_LINE = /^line\.activity\.[a-z0-9-]+\.now$/;

/** True when the entry answers now: its card sends `activity/now`, and it never fills a slot of the month. */
export function answersNow(activity: string): boolean {
  return content.activity[activity as keyof typeof content.activity]?.when === "now";
}

/** The place's answer among a command's lines, `line.activity.<slug>.now`, or null when it holds none. */
export function nowLineIn(lines: readonly ReportLine[]): ReportLine | null {
  return lines.find((line) => NOW_LINE.test(line.key)) ?? null;
}

/** The act a now-line answers, from its params. */
export function nowActOf(line: ReportLine): string {
  return typeof line.params.activity === "string" ? line.params.activity : "";
}

/** What the place says for a now-act with no paper to wait on (the official page read from the phone): its now-line with the act and its param. */
export function nowSaid(activity: string, param: string | null): string {
  return words(`line.activity.${activity.replace(/^activity\./, "")}.now`, param === null ? { activity } : { activity, param });
}
