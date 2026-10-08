// The admin routes' replies, copied from the server, because the client
// imports nothing from the server's side (decision 0004). Each block names its
// source; keep each copy the same as it.
import type { Currency, Reason } from "@japacity/sim";

/** A refusal from any admin route: `code` is the server's, `missing` the checks an approval lacked. */
export interface AdminRefusal {
  ok: false;
  code?: string;
  detail: string;
  missing?: string[];
  refusals?: string[];
}

// ---------------------------------------------------------------------------
// apps/server/src/routes/admin.ts (R-SERVER-005, 008, 011, 012)
// ---------------------------------------------------------------------------

/** packages/store/src/types.ts ByReason. */
export type ByReason = Partial<Record<Reason, Partial<Record<Currency, number>>>>;

/** packages/store/src/types.ts DayRow: `day` is whole UTC days since 1970. */
export interface DayRow {
  day: number;
  created: ByReason;
  destroyed: ByReason;
}

/** apps/server/src/admin/alarm.ts Alarm. */
export type Alarm =
  | { kind: "suspect"; day: number; character: string; reason: Reason; currency: Currency; total: number; ceiling: number }
  | { kind: "draw"; day: number; draw: number; check: "win" | "top-up" | "ticket"; total: number; limit: number }
  | { kind: "diverged"; day: number; character: string; v: number };

/** apps/server/src/admin/load.ts Diff. */
export interface Diff {
  v: number;
  stored: string;
  replayed: string | null;
}

/** apps/server/src/admin/load.ts Dropped. */
export interface Dropped {
  v: number;
  type: string;
  code: string;
  detail: string;
}

/** apps/server/src/admin/rollback.ts RollbackReport. */
export interface RollbackReport {
  character: string;
  v: number;
  replayed: number;
  firstDiff: Diff | null;
  dropped: Dropped[];
}

/** apps/server/src/admin/rollback.ts RollbackCheck, with LoadFailure's codes. */
export type RollbackCheck = { ok: true; report: RollbackReport } | { ok: false; code: string; detail: string };

export type ReportReply = { ok: true; report: DayRow } | AdminRefusal;
export type AlarmsReply = { ok: true; alarms: Alarm[] } | AdminRefusal;
export type RejectionsReply = { ok: true; counts: Record<string, number> } | AdminRefusal;

// ---------------------------------------------------------------------------
// apps/server/src/routes/moderation-admin.ts (R-MODERATION-010 to 016)
// ---------------------------------------------------------------------------

/** apps/server/src/moderation/reports.ts REPORT_REASONS: also the reasons an admin action is logged with. */
export const REPORT_REASONS = ["scam", "harassment", "impersonation", "underage", "sexual", "hate", "self-harm", "illegal", "cheating", "advert", "other"] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** apps/server/src/moderation/decide.ts ON_REPORT: the actions a report can be closed with. */
export const REPORT_ACTIONS = ["dismiss", "warn", "mute", "suspend", "ban", "reset-name", "refer", "rollback"] as const;

export type ReportAction = (typeof REPORT_ACTIONS)[number];

/** packages/store/src/moderation.types.ts AdminAction. */
export type AdminAction = ReportAction | "pull-advert" | "approve-advert" | "refuse-advert";

/** apps/server/src/moderation/reports.ts ReportCite. */
export type ReportCite =
  | { messages: string[] }
  | { place: string; phrase: string; at: number }
  | { card: string }
  | { pair: string }
  | { campaign: string; slot: string };

/** apps/server/src/moderation/reports.ts ReportSubject. */
export type ReportSubject = { account: string } | { campaign: string };

/** apps/server/src/moderation/reports.ts Hold. */
export interface Hold {
  report: string;
  messages: string[];
  pair?: string;
  until: number;
}

/** packages/store/src/moderation.types.ts ModerationLogEntry. */
export interface ModerationLogEntry {
  id: string;
  admin: string;
  at: number;
  item: string;
  action: AdminAction;
  params: Record<string, string | number>;
  reason: string;
  note?: string;
}

/** apps/server/src/moderation/queue.ts HeldMessage. */
export interface HeldMessage {
  id: string;
  sender: string;
  phrase: string;
  words: string;
  fill: string | null;
  sentAt: number;
}

interface ReportBrief {
  id: string;
  reason: ReportReason;
  at: number;
  status: "open" | "decided";
  outcome?: "acted" | "no-action";
}

/** apps/server/src/moderation/queue.ts AccountSummary. */
export interface AccountSummary {
  account: string;
  region: string | null;
  accountAge: number | null;
  made: ReportBrief[];
  received: ReportBrief[];
  actions: ModerationLogEntry[];
}

/** apps/server/src/moderation/queue.ts QueueItem. */
export type QueueItem =
  | {
      kind: "report";
      id: string;
      reason: ReportReason;
      at: number;
      age: number;
      subject: ReportSubject;
      cites: ReportCite;
      unverified: boolean;
      hold: Hold | null;
      messages: HeldMessage[];
      reporter: AccountSummary;
      reported: AccountSummary | null;
    }
  | {
      kind: "appeal";
      id: string;
      at: number;
      age: number;
      entry: ModerationLogEntry | null;
      appellant: AccountSummary;
      actedBy: string | null;
    };

/** apps/server/src/moderation/queue.ts QueueView. */
export interface QueueView {
  items: QueueItem[];
  oldest: number;
  target: number;
  overdue: number;
}

/** packages/store/src/moderation.types.ts AppealRow. */
export interface AppealRow {
  id: string;
  account: string;
  entry: string;
  at: number;
  status: "open" | "decided";
  outcome?: "upheld" | "overturned";
  decidedBy?: string;
  decidedAt?: number;
}

/** packages/store/src/moderation.types.ts FeedbackRow. */
export interface FeedbackRow {
  id: string;
  text: string;
  build: string;
  screen: string;
  mode: "low" | "high";
  day: string;
  region: string;
}

/** The body of `POST /api/admin/moderation/:item/close` for a report (apps/server/src/moderation/decide.ts closeReport). */
export interface CloseReportBody {
  action: ReportAction;
  reason: ReportReason;
  days?: number;
  body?: string;
  note?: string;
}

/** The body of the same route for an appeal (decideAppeal). */
export interface DecideAppealBody {
  outcome: "upheld" | "overturned";
  reason: ReportReason;
  note?: string;
}

export type QueueReply = { ok: true; queue: QueueView } | AdminRefusal;
export type DecidedReply = { ok: true; entry: ModerationLogEntry; appeal?: AppealRow; rollback?: RollbackCheck } | AdminRefusal;
export type LogReply = { ok: true; entries: ModerationLogEntry[] } | AdminRefusal;
export type FeedbackReply = { ok: true; feedback: FeedbackRow[] } | AdminRefusal;

// ---------------------------------------------------------------------------
// apps/server/src/routes/admin-analytics.ts (R-ANALYTICS-009 to 011)
// ---------------------------------------------------------------------------

/** apps/server/src/analytics/dashboard.ts Shown: a count, or the floor it is under. */
export type Shown = number | { fewerThan: number };

export interface ShownTotal {
  day: string;
  region: string;
  name: string;
  key: string;
  count: Shown;
}

export interface DailyRow {
  day: string;
  players: Shown;
  newPlayers: Shown;
  turnsEnded: Shown;
}

export interface WeekRow {
  week: string;
  newPlayers: Shown;
  d1: Shown;
  d7: Shown;
  d1Bp: number | null;
  d7Bp: number | null;
  earlyWin: Record<string, Shown>;
}

/** apps/server/src/analytics/dashboard.ts Dashboard. */
export interface Dashboard {
  day: string;
  from: string;
  minShown: number;
  reference: { d1Bp: number; d7Bp: number };
  askBeforeEarlyWin: boolean;
  daily: DailyRow[];
  weeks: WeekRow[];
  counters: ShownTotal[];
}

export type DashboardReply = { ok: true; dashboard: Dashboard } | AdminRefusal;

// ---------------------------------------------------------------------------
// apps/server/src/routes/admin-switches.ts (R-SERVER-030, 031)
// ---------------------------------------------------------------------------

/** packages/store/src/switches.ts Switches. */
export interface Switches {
  signups: boolean;
  lottery: boolean;
  adverts: boolean;
  partnerPlay: boolean;
}

export type SwitchName = keyof Switches;

/** apps/server/src/switches/switches.ts SWITCH_NAMES. */
export const SWITCH_NAMES: readonly SwitchName[] = ["signups", "lottery", "adverts", "partnerPlay"];

/** packages/store/src/switches.ts Dials. */
export interface Dials {
  placeTargets: Record<string, number>;
  computerAfterMonths: number | null;
  topUpTickets: number | null;
}

/** packages/store/src/switches.ts DialChange. */
export type DialChange =
  | { dial: "placeTarget"; place: string; value: number | null }
  | { dial: "computerAfterMonths"; value: number | null }
  | { dial: "topUpTickets"; value: number | null };

export type SettingChange = { switch: SwitchName; on: boolean } | DialChange;

/** packages/store/src/switches.ts SwitchLogRow. */
export interface SwitchLogRow {
  n: number;
  at: number;
  admin: string;
  reason: string;
  change: SettingChange;
}

export type SwitchesReply = ({ ok: true } & { switches: Switches; dials: Dials }) | AdminRefusal;
export type SwitchLogReply = { ok: true; log: SwitchLogRow[] } | AdminRefusal;

// ---------------------------------------------------------------------------
// apps/server/src/routes/admin-adverts.ts (R-ADVERT-010 to 014)
// ---------------------------------------------------------------------------

/** packages/store/src/advert.types.ts CampaignStatus. */
export type CampaignStatus = "pending" | "approved" | "live" | "paused" | "ended" | "refused";

export interface Advertiser {
  id: string;
  businessName: string;
  registration: { country: string; number: string };
  contactName: string;
  contactEmail: string;
}

export interface Campaign {
  id: string;
  advertiser: string;
  slots: string[];
  regions: string[];
  starts: number;
  ends: number;
  status: CampaignStatus;
  category: string;
  place: { place: string; name: string; sign: string } | null;
}

export interface Creative {
  id: string;
  campaign: string;
  file: { format: "png" | "jpeg" | "webp"; width: number; height: number; bytes: number };
  text: string;
  link: string | null;
  version: number;
  status: "pending" | "approved" | "refused";
}

export interface AdvertReview {
  creative: string;
  version: number;
  reviewer: string;
  at: number;
  checks: string[];
  bannedListVersion: string;
  outcome: "approved" | "refused";
  note: string;
}

/** One row of `GET /api/admin/adverts/campaigns`. */
export interface CampaignRow {
  campaign: Campaign;
  advertiser: Advertiser | null;
  creatives: Creative[];
  reviews: AdvertReview[];
}

/** The body of an approve or refuse (apps/server/src/routes/admin-adverts.ts decisionOf). */
export interface ReviewBody {
  checks: string[];
  note: string;
}

export type CampaignsReply = { ok: true; campaigns: CampaignRow[] } | AdminRefusal;
export type CampaignReply = { ok: true; campaign: Campaign } | AdminRefusal;
export type CreativeReply = { ok: true; creative: Creative } | AdminRefusal;
export type RecheckReply = { ok: true; failing: string[]; pulled: boolean } | AdminRefusal;

/**
 * apps/server/src/adverts/categories.ts RESTRICTED: the conditions a reviewer
 * records for a restricted category. the campaigns reply could carry
 * each row's required checks so this copy can go.
 */
export const RESTRICTED_CONDITIONS: Readonly<Record<string, readonly string[]>> = {
  "immigration-advice": ["adviser-registered", "no-result-promise", "no-proof-of-funds"],
  "money-transfer": ["licensed-each-region", "no-credit-product"],
  education: ["accredited-institution", "no-charging-agent", "no-score-or-visa-promise"],
  travel: ["no-visa-claim"],
  telco: ["no-prize-or-promo"],
  "named-place": ["place-agreement"],
};

/** apps/server/src/adverts/campaign.ts campaignChecks. */
export function campaignChecks(campaign: Campaign): string[] {
  const checks = ["registered-business", "category", ...(RESTRICTED_CONDITIONS[campaign.category] ?? [])];
  if (campaign.regions.includes("NG")) checks.push("regulator-approval");
  return checks;
}

/** apps/server/src/adverts/campaign.ts creativeChecks. */
export function creativeChecks(creative: Creative): string[] {
  return ["format", "not-game-like", "text", ...(creative.link === null ? [] : ["link-domain"])];
}
