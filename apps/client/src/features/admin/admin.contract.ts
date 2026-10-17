// The admin routes' replies, copied from the server, because the client
// imports nothing from the server's side (decision 0006). Each block names its
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
interface RollbackReport {
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
export type AdminAction = ReportAction | "pull-advert" | "approve-advert" | "refuse-advert" | "approve-light" | "refuse-light";

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
interface HeldMessage {
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

// ---------------------------------------------------------------------------
// apps/server/src/routes/admin-dedication.ts (R-MODERATION-021)
// ---------------------------------------------------------------------------

/** apps/server/src/routes/admin-dedication.ts PendingLight: a dedication light whose name awaits a look. */
export interface PendingLight {
  account: string;
  id: string;
  name: string;
  years: { from: number | null; to: number | null };
  username: string | null;
  region: string | null;
  litAt: number;
}

export type PendingLightsReply = { ok: true; lights: PendingLight[] } | AdminRefusal;
/** An approval or a refusal, with the admin log's entry it was written as. */
export type LightDecidedReply = { ok: true; entry: string } | AdminRefusal;
export type FeedbackReply = { ok: true; feedback: FeedbackRow[] } | AdminRefusal;

// ---------------------------------------------------------------------------
// apps/server/src/routes/admin-analytics.ts (R-ANALYTICS-009 to 011)
// ---------------------------------------------------------------------------

/** apps/server/src/analytics/dashboard.ts Shown: a count, or the floor it is under. */
export type Shown = number | { fewerThan: number };

interface ShownTotal {
  day: string;
  region: string;
  name: string;
  key: string;
  count: Shown;
}

interface DailyRow {
  day: string;
  players: Shown;
  newPlayers: Shown;
  turnsEnded: Shown;
}

interface WeekRow {
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
// apps/server/src/routes/admin-stats.ts (R-ANALYTICS-012, 013): the Numbers tab.
// Copied from apps/server/src/analytics/stats.contract.ts; a test holds both to one shape.
// ---------------------------------------------------------------------------

export interface Regional {
  all: Shown;
  regions: Record<string, Shown>;
}

export interface PeriodRates {
  dailyOverPeriodBp: number | null;
  sessionsPerPlayerBp: number | null;
  errorsPerThousandSessions: number | null;
  departedPerNewBp: number | null;
  securedPerGuestBp: number | null;
}

export interface StatsPeriod {
  from: string;
  to: string;
  players: Regional;
  newPlayers: Regional;
  guests: Shown;
  secured: Shown;
  livesStarted: Shown;
  livesSecured: Shown;
  departed: Shown;
  turnsEnded: Shown;
  sessions: Shown;
  clientErrors: Shown;
  feedbackSent: Shown;
  reportsOpen: Shown;
  topUps: Shown;
  topUpKobo: number | null;
  rates: PeriodRates;
}

export interface FunnelStep {
  step: string;
  count: Shown;
  ofFirstBp: number | null;
}

export interface Returned {
  count: Shown;
  bp: number | null;
}

export interface RetentionWeek {
  week: string;
  newPlayers: Shown;
  returned: Record<"d1" | "d3" | "d7" | "d14" | "d30", Returned>;
  secured: Returned;
}

export interface ShareKind {
  kind: string;
  pressed: Shown;
  completed: Shown;
  arrived: Shown;
  arrivedPerShareBp: number | null;
}

export interface EconomyCell {
  months: string;
  held: string;
  lives: Shown;
}

export interface Stats {
  now: { at: number; online: Regional; peakToday: Regional };
  today: StatsPeriod;
  last7: StatsPeriod;
  last30: StatsPeriod;
  totals: { day: string; players: Regional };
  funnel: { from: string; to: string; steps: FunnelStep[] };
  retention: { from: string; to: string; weeks: RetentionWeek[] };
  sessions: { from: string; to: string; count: Shown; lengths: Record<string, Shown>; perPlayerBp: number | null };
  shares: { from: string; to: string; kinds: ShareKind[] };
  adverts: { from: string; to: string; impressions: Shown; taps: Shown; revenueKobo: number; revenuePerPlayerKobo: number | null };
  economy: { day: string; cells: EconomyCell[] };
}

export type StatsReply = { ok: true; stats: Stats } | AdminRefusal;

// ---------------------------------------------------------------------------
// apps/server/src/routes/admin-switches.ts (R-SERVER-030, 031)
// ---------------------------------------------------------------------------

/** packages/store/src/switches.ts Switches. */
export interface Switches {
  signups: boolean;
  lottery: boolean;
  adverts: boolean;
  partnerPlay: boolean;
  "boards.this-week.everyone": boolean;
  "boards.this-week.friends": boolean;
  "boards.all-time.everyone": boolean;
  "boards.all-time.friends": boolean;
  "boards.joined-week": boolean;
}

export type SwitchName = keyof Switches;

/** apps/server/src/switches/switches.ts SWITCH_NAMES. */
export const SWITCH_NAMES: readonly SwitchName[] = [
  "signups",
  "lottery",
  "adverts",
  "partnerPlay",
  "boards.this-week.everyone",
  "boards.this-week.friends",
  "boards.all-time.everyone",
  "boards.all-time.friends",
  "boards.joined-week",
];

/** packages/store/src/switches.ts Dials. */
export interface Dials {
  placeTargets: Record<string, number>;
  computerAfterMonths: number | null;
}

/** packages/store/src/switches.ts DialChange. */
export type DialChange =
  | { dial: "placeTarget"; place: string; value: number | null }
  | { dial: "computerAfterMonths"; value: number | null };

/** packages/store/src/switches.ts RetiredDialChange. */
interface RetiredDialChange {
  dial: "topUpTickets";
  value: number | null;
}

export type SettingChange = { switch: SwitchName; on: boolean } | DialChange | RetiredDialChange;

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

/** A version as the campaigns reply lists it: with the checks its approval needs (R-ADVERT-012). */
export type ReviewedCreative = Creative & { checks: string[] };

/** packages/store/src/advert.types.ts AdvertCount: one day's totals for a slot and region (R-ADVERT-020). */
export interface AdvertCount {
  day: number;
  slot: string;
  campaign: string;
  region: string;
  impressions: number;
  taps: number;
}

/** One row of `GET /api/admin/adverts/campaigns`. */
export interface CampaignRow {
  campaign: Campaign;
  advertiser: Advertiser | null;
  /** R-ADVERT-012: the checks the campaign's approval needs. */
  checks: string[];
  creatives: ReviewedCreative[];
  reviews: AdvertReview[];
  counts: AdvertCount[];
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
