// Words for block, report, the team's notices, the appeal and feedback, read from content's ui/ui.moderation.text.ts.
import type { ReportReason } from "@japacity/api";
import { text, type uiModerationText } from "@japacity/content";

export type ModerationKey = keyof typeof uiModerationText;

const BRACE = /\{(\w+)\}/g;

export function words(key: ModerationKey, params: Record<string, string | number> = {}): string {
  return (text[key] ?? key).replace(BRACE, (whole, name: string) => (params[name] === undefined ? whole : String(params[name])));
}

export function reasonWords(reason: ReportReason): string {
  return text[`ui.report.reason.${reason}`] ?? reason;
}

/** A reason the server names, in words when it is one of the report reasons. */
export function anyReasonWords(reason: string): string {
  return text[`ui.report.reason.${reason}`]?.toLowerCase() ?? reason;
}
