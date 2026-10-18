// Words for block, report, the team's notices, the appeal and feedback, read from content's ui/ui.moderation.text.ts.
import type { ReportReason } from "@japacity/api";
import { text, type uiModerationText } from "@japacity/content";

import { fill, type Filled } from "../words/text";

export type ModerationKey = keyof typeof uiModerationText;

export function words(key: ModerationKey, params: Filled = {}): string {
  return fill(text[key] ?? key, params);
}

export function reasonWords(reason: ReportReason): string {
  return text[`ui.report.reason.${reason}`] ?? reason;
}

/** A reason the server names, in words when it is one of the report reasons. */
export function anyReasonWords(reason: string): string {
  return text[`ui.report.reason.${reason}`]?.toLowerCase() ?? reason;
}
