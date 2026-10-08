// Words for block, report, the team's notices, the appeal and feedback. First
// drafts in the voice of docs/rules/text.md, for the maintainer to move beside the
// other interface words.
import type { ReportReason } from "../net/contract";

export const moderationText = {
  "ui.block": "Block",
  "ui.block.done": "Blocked. You will not hear from them again.",
  "ui.block.undo": "Unblock",
  "ui.block.undone": "Unblocked. Nothing comes back: a new invite is needed.",
  "ui.report": "Report",
  "ui.report.title": "Report {name}",
  "ui.report.intro": "Pick what is wrong. A person on the team reads every report.",
  "ui.report.also-block": "Block them too",
  "ui.report.sent": "Report received. We will tell you when it is decided, not what was done.",
  "ui.report.failed": "The report did not go. Try again in a moment.",
  "ui.report.reason.scam": "Scam or asking for money",
  "ui.report.reason.harassment": "Harassment or bullying",
  "ui.report.reason.impersonation": "Pretending to be someone",
  "ui.report.reason.underage": "Under 18",
  "ui.report.reason.sexual": "Sexual content",
  "ui.report.reason.hate": "Hate",
  "ui.report.reason.self-harm": "Self-harm",
  "ui.report.reason.illegal": "Something illegal",
  "ui.report.reason.cheating": "Cheating",
  "ui.report.reason.advert": "A bad advert",
  "ui.report.reason.other": "Something else",
  "ui.feedback": "Feedback",
  "ui.feedback.title": "Tell the team",
  "ui.feedback.intro": "What works, what does not. Only the team reads it, and it does not say who you are.",
  "ui.feedback.label": "Your feedback",
  "ui.feedback.count": "{used} of {max}",
  "ui.feedback.send": "Send",
  "ui.feedback.sent": "Thank you. The team reads every one.",
  "ui.feedback.too-many": "That is all for today. Send more tomorrow.",
  "ui.feedback.failed": "It did not go. Try again in a moment.",
  "ui.notice": "From the team",
  "ui.notice.title": "From the team",
  "ui.notice.warn": "A warning, for {reason}.",
  "ui.notice.mute": "Phrases and invites are off until {until}, for {reason}.",
  "ui.notice.suspend": "Your account is suspended until {until}, for {reason}.",
  "ui.notice.ban": "Your account is closed, for {reason}.",
  "ui.notice.appeal": "Appeal",
  "ui.notice.appeal.intro": "Think we got it wrong? Appeal once and another person on the team looks again.",
  "ui.notice.appeal.open": "Appeal received. Someone else on the team will look at it.",
  "ui.notice.appeal.upheld": "Your appeal was looked at. The decision stands.",
  "ui.notice.appeal.overturned": "Your appeal was looked at. The decision is taken back.",
  "ui.notice.appeal.failed": "The appeal did not go. Try again in a moment.",
  "ui.notice.reports": "Your reports",
  "ui.notice.report.open": "Received. Not decided yet.",
  "ui.notice.report.acted": "Decided. We acted on it.",
  "ui.notice.report.no-action": "Decided. We took no action.",
} as const;

export type ModerationKey = keyof typeof moderationText;

const BRACE = /\{(\w+)\}/g;

export function words(key: ModerationKey, params: Record<string, string | number> = {}): string {
  return moderationText[key].replace(BRACE, (whole, name: string) => (params[name] === undefined ? whole : String(params[name])));
}

export function reasonWords(reason: ReportReason): string {
  return moderationText[`ui.report.reason.${reason}`];
}

/** A reason the server names, in words when it is one of the report reasons. */
export function anyReasonWords(reason: string): string {
  const key = `ui.report.reason.${reason}`;
  return key in moderationText ? moderationText[key as ModerationKey].toLowerCase() : reason;
}
