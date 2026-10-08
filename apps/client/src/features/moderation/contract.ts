// The moderation routes' shapes, copied from apps/server/src/moderation/ and
// the pair side's block and report routes (moderation.md contract), because
// the client imports nothing from the server's side. Keep each copy the same.

/** Copied from apps/server/src/moderation/reports.ts (R-MODERATION-004). */
export const REPORT_REASONS = ["scam", "harassment", "impersonation", "underage", "sexual", "hate", "self-harm", "illegal", "cheating", "advert", "other"] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** Copied from apps/server/src/moderation/reports.ts. */
export type ReportCite =
  | { messages: string[] }
  | { place: string; phrase: string; at: number }
  | { card: string }
  | { pair: string }
  | { campaign: string; slot: string };

export type ReportSubject = { account: string } | { campaign: string };

/** `POST /api/moderation/report`, the pair side's route. */
export interface ReportRequest {
  subject: ReportSubject;
  reason: ReportReason;
  cites: ReportCite;
}

/** Copied from apps/server/src/moderation/standing.ts (R-MODERATION-007, R-MODERATION-016). */
export interface Standing {
  actions: {
    entry: string;
    action: "warn" | "mute" | "suspend" | "ban";
    reason: string;
    at: number;
    until: number | null;
    appeal: { status: "open" | "decided"; outcome?: "upheld" | "overturned" } | null;
  }[];
  mutedUntil: number | null;
  suspendedUntil: number | null;
  banned: boolean;
  reports: { id: string; at: number; status: "open" | "decided"; outcome?: "acted" | "no-action" }[];
}

/** `POST /api/feedback` (R-MODERATION-020). */
export interface FeedbackRequest {
  text: string;
  build: string;
  screen: string;
  mode: "low" | "high";
}
