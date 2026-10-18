// The admin routes' answers for the page's tests and its browser pictures, in
// the server's shapes. Made-up accounts and businesses only.
import type {
  AlarmsReply,
  CampaignsReply,
  DashboardReply,
  FeedbackReply,
  LedgerReportReply,
  LogReply,
  PendingLightsReply,
  QueueReply,
  RejectionsReply,
  RollbackCheck,
  StatsPeriod,
  StatsReply,
  Switches,
  SwitchesReply,
  SwitchLogReply,
} from "@japacity/api";
import { time } from "@japacity/sim";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const { DAY_MS, HOUR_MS } = time;
/** 7 October 2026 as whole UTC days since 1970. */
export const YESTERDAY = 20_733;

const REPORT: LedgerReportReply = {
  ok: true,
  report: {
    day: YESTERDAY,
    created: { salary: { NGN: 125_000_000, GBP: 320_000 }, win: { NGN: 5_000_000 } },
    destroyed: { rent: { NGN: 48_000_000 }, ticket: { NGN: 1_200_000 } },
  },
};

const ALARMS: AlarmsReply = {
  ok: true,
  alarms: [
    { kind: "suspect", day: YESTERDAY, character: "character.c-7f2a", reason: "salary", currency: "NGN", total: 900_000_000, ceiling: 300_000_000 },
    { kind: "draw", day: YESTERDAY, draw: 412, check: "win", total: 61_000_000, limit: 60_000_000 },
    { kind: "diverged", day: YESTERDAY, character: "character.c-19bd", v: 88 },
  ],
};

const REJECTIONS: RejectionsReply = { ok: true, counts: { stale: 41, "no-turns": 17, "rate-limited": 3 } };

export const ROLLBACK: RollbackCheck = {
  ok: true,
  report: {
    character: "character.c-19bd",
    v: 96,
    replayed: 96,
    firstDiff: { v: 88, stored: "a91f03c2", replayed: "5be0d417" },
    dropped: [{ v: 88, type: "lottery/buy", code: "cannot-afford", detail: "Not enough money for 3 tickets." }],
  },
};

const ADA = {
  account: "account.ada",
  region: "NG",
  accountAge: 40 * DAY_MS,
  made: [],
  received: [{ id: "report.old", reason: "harassment" as const, at: NOW - 20 * DAY_MS, status: "decided" as const, outcome: "acted" as const }],
  actions: [{ id: "log.1", admin: "account.owner", at: NOW - 19 * DAY_MS, item: "report.old", action: "warn" as const, params: { account: "account.ada" }, reason: "harassment" }],
};

const BOLA = { account: "account.bola", region: "GB", accountAge: 3 * DAY_MS, made: [{ id: "report.1", reason: "scam" as const, at: NOW - 30 * HOUR_MS, status: "open" as const }], received: [], actions: [] };

export const QUEUE: QueueReply = {
  ok: true,
  queue: {
    items: [
      {
        kind: "report",
        id: "report.1",
        reason: "scam",
        at: NOW - 30 * HOUR_MS,
        age: 30 * HOUR_MS,
        subject: { account: "account.ada" },
        cites: { messages: ["message.1", "message.2"] },
        unverified: false,
        hold: { report: "report.1", messages: ["message.1", "message.2"], pair: "pair.1", until: NOW + 13 * DAY_MS },
        messages: [
          { id: "message.1", sender: "account.ada", phrase: "phrase.send-money", words: "Can you send me something small?", fill: null, sentAt: NOW - 31 * HOUR_MS },
          { id: "message.2", sender: "account.ada", phrase: "phrase.how-much", words: "I need {fill}", fill: "50k", sentAt: NOW - 31 * HOUR_MS + 60_000 },
        ],
        reporter: BOLA,
        reported: ADA,
      },
      {
        kind: "report",
        id: "report.2",
        reason: "other",
        at: NOW - 2 * HOUR_MS,
        age: 2 * HOUR_MS,
        subject: { account: "account.chidi" },
        cites: { place: "place.ojuelegba", phrase: "phrase.hello", at: NOW - 2 * HOUR_MS },
        unverified: true,
        hold: null,
        messages: [],
        reporter: { account: "account.dayo", region: "NG", accountAge: 9 * DAY_MS, made: [], received: [], actions: [] },
        reported: { account: "account.chidi", region: null, accountAge: null, made: [], received: [], actions: [] },
      },
      {
        kind: "appeal",
        id: "appeal.1",
        at: NOW - 5 * HOUR_MS,
        age: 5 * HOUR_MS,
        entry: { id: "log.1", admin: "account.owner", at: NOW - 19 * DAY_MS, item: "report.old", action: "warn", params: { account: "account.ada" }, reason: "harassment" },
        appellant: ADA,
        actedBy: "account.owner",
      },
    ],
    oldest: 30 * HOUR_MS,
    target: 24 * HOUR_MS,
    overdue: 1,
  },
};

const LOG: LogReply = {
  ok: true,
  entries: [{ id: "log.1", admin: "account.owner", at: NOW - 19 * DAY_MS, item: "report.old", action: "warn", params: { account: "account.ada" }, reason: "harassment", note: "First time." }],
};

/** moderation:dedication-lights-await-approval: two dedication lights awaiting a look, the older first. */
export const PENDING_LIGHTS: PendingLightsReply = {
  ok: true,
  lights: [
    { account: "account.ada", id: "light.1a2b", name: "Mama Nkechi", years: { from: 1951, to: 2024 }, username: "ada_lagos", region: "NG", litAt: NOW - 2 * DAY_MS },
    { account: "account.bola", id: "light.3c4d", name: "Uncle Tunde", years: { from: null, to: null }, username: "bola_b", region: "GB", litAt: NOW - DAY_MS },
  ],
};

const FEEDBACK: FeedbackReply = {
  ok: true,
  feedback: [{ id: "feedback.1", text: "The rent screen is hard to read at night.", build: "a1b2c3d", screen: "wallet", mode: "high", day: "2026-10-07", region: "NG" }],
};

const DAYS = ["2026-10-06", "2026-10-07", "2026-10-08"];

const DASHBOARD: DashboardReply = {
  ok: true,
  dashboard: {
    day: "2026-10-08",
    from: "2026-09-08",
    minShown: 10,
    reference: { d1Bp: 4000, d7Bp: 1500 },
    askBeforeEarlyWin: true,
    daily: DAYS.map((day, at) => ({ day, players: at === 0 ? { fewerThan: 10 } : 120 + at, newPlayers: at === 2 ? 34 : { fewerThan: 10 }, turnsEnded: 900 + at })),
    weeks: [
      { week: "2026-09-28", newPlayers: 210, d1: 92, d7: 25, d1Bp: 4380, d7Bp: 1190, earlyWin: { "1": 80, "2": 61, "3": 30, later: 22, none: { fewerThan: 10 } } },
      { week: "2026-10-05", newPlayers: 64, d1: { fewerThan: 10 }, d7: { fewerThan: 10 }, d1Bp: null, d7Bp: null, earlyWin: { "1": 21, "2": 14, "3": { fewerThan: 10 }, later: { fewerThan: 10 }, none: { fewerThan: 10 } } },
    ],
    counters: [
      { day: "2026-10-07", region: "NG", name: "players/active", key: "", count: 121 },
      { day: "2026-10-07", region: "GH", name: "players/active", key: "", count: { fewerThan: 10 } },
    ],
  },
};

export const CAMPAIGNS: CampaignsReply = {
  ok: true,
  campaigns: [
    {
      campaign: { id: "campaign-a1", advertiser: "advertiser-1", slots: ["advert.park-billboard"], regions: ["NG"], starts: NOW + DAY_MS, ends: NOW + 30 * DAY_MS, status: "pending", category: "education", place: null },
      advertiser: { id: "advertiser-1", businessName: "Brightpath Study Centre", registration: { country: "NG", number: "RC-000123" }, contactName: "Kemi Ade", contactEmail: "kemi@brightpath.example" },
      checks: ["registered-business", "category", "accredited-institution", "no-charging-agent", "no-score-or-visa-promise", "regulator-approval"],
      creatives: [
        { id: "creative-b2", campaign: "campaign-a1", file: { format: "png", width: 640, height: 320, bytes: 48_211 }, text: "Evening classes in Yaba.", link: "https://brightpath.example/classes", version: 1, status: "pending", checks: ["format", "not-game-like", "text", "link-domain"] },
      ],
      reviews: [],
      counts: [],
    },
    {
      campaign: { id: "campaign-c3", advertiser: "advertiser-2", slots: ["advert.phone-tile"], regions: ["GB"], starts: NOW - DAY_MS, ends: NOW + 6 * DAY_MS, status: "live", category: "general", place: null },
      advertiser: { id: "advertiser-2", businessName: "Harbour Tea Room", registration: { country: "GB", number: "09876543" }, contactName: "Sam Lowe", contactEmail: "sam@harbourtea.example" },
      checks: ["registered-business", "category"],
      creatives: [
        { id: "creative-d4", campaign: "campaign-c3", file: { format: "webp", width: 320, height: 320, bytes: 20_480 }, text: "Tea by the water.", link: null, version: 1, status: "approved", checks: ["format", "not-game-like", "text"] },
        { id: "creative-d4", campaign: "campaign-c3", file: { format: "webp", width: 320, height: 320, bytes: 20_911 }, text: "Tea and cake by the water.", link: null, version: 2, status: "refused", checks: ["format", "not-game-like", "text"] },
      ],
      reviews: [
        { creative: "campaign-c3", version: 0, reviewer: "account.owner", at: NOW - 2 * DAY_MS, checks: ["registered-business", "category"], bannedListVersion: "2026-10-08", outcome: "approved", note: "" },
        { creative: "creative-d4", version: 1, reviewer: "account.owner", at: NOW - 2 * DAY_MS, checks: ["format", "not-game-like", "text"], bannedListVersion: "2026-10-08", outcome: "approved", note: "Clean." },
        { creative: "creative-d4", version: 2, reviewer: "account.owner", at: NOW - DAY_MS, checks: [], bannedListVersion: "2026-10-08", outcome: "refused", note: "Reads as a prize." },
      ],
      counts: [
        { day: YESTERDAY - 1, slot: "advert.phone-tile", campaign: "campaign-c3", region: "GB", impressions: 1_204, taps: 31 },
        { day: YESTERDAY, slot: "advert.phone-tile", campaign: "campaign-c3", region: "GB", impressions: 388, taps: 9 },
      ],
    },
  ],
};

export const SWITCH_ROW: Switches = {
  signups: true,
  lottery: false,
  adverts: true,
  partnerPlay: true,
  "boards.this-week.everyone": true,
  "boards.this-week.friends": true,
  "boards.all-time.everyone": true,
  "boards.all-time.friends": true,
  "boards.joined-week": false,
};

export const SWITCHES: SwitchesReply = {
  ok: true,
  switches: SWITCH_ROW,
  dials: { placeTargets: { "place.ojuelegba": 40 }, computerAfterMonths: 25 },
};

const SWITCH_LOG: SwitchLogReply = {
  ok: true,
  log: [
    { n: 1, at: NOW - 3 * HOUR_MS, admin: "account.owner", reason: "Draw audit", change: { switch: "lottery", on: false } },
    { n: 2, at: NOW - 2 * HOUR_MS, admin: "account.owner", reason: "Busy evening", change: { dial: "placeTarget", place: "place.ojuelegba", value: 40 } },
  ],
};

const FEWER = { fewerThan: 10 };

function period(from: string, to: string, scale: number, players: number): StatsPeriod {
  return {
    from,
    to,
    players: { all: players, regions: { GB: FEWER, NG: players - 4 } },
    newPlayers: { all: 40 * scale, regions: { NG: 40 * scale } },
    guests: 40 * scale,
    secured: 12 * scale,
    livesStarted: 38 * scale,
    livesSecured: FEWER,
    departed: 11 * scale,
    turnsEnded: 300 * scale,
    sessions: 95 * scale,
    clientErrors: 14 * scale,
    feedbackSent: FEWER,
    reportsOpen: FEWER,
    topUps: FEWER,
    topUpKobo: null,
    rates: { dailyOverPeriodBp: scale === 1 ? null : 2200, sessionsPerPlayerBp: 14500, errorsPerThousandSessions: 147, departedPerNewBp: 2750, securedPerGuestBp: 3000 },
  };
}

/** analytics:admin-stats-for-admins-only: the numbers on the 8th at noon. */
export const STATS: StatsReply = {
  ok: true,
  stats: {
    now: { at: NOW, online: { all: 23, regions: { GB: FEWER, NG: 21 } }, peakToday: { all: 41, regions: { GB: FEWER, NG: 37 } } },
    today: period("2026-10-08", "2026-10-08", 1, 64),
    last7: period("2026-10-01", "2026-10-07", 7, 210),
    last30: period("2026-09-08", "2026-10-07", 30, 520),
    totals: { day: "2026-10-07", players: { all: 1240, regions: { GB: 61, NG: 1179 } } },
    funnel: {
      from: "2026-09-08",
      to: "2026-10-07",
      steps: [
        { step: "door-1", count: 820, ofFirstBp: 10000 },
        { step: "door-2", count: 700, ofFirstBp: 8536 },
        { step: "page", count: 640, ofFirstBp: 7804 },
        { step: "begin", count: 600, ofFirstBp: 7317 },
        { step: "world", count: 540, ofFirstBp: 6585 },
        { step: "month-1", count: 470, ofFirstBp: 5731 },
        { step: "chapter-1", count: 300, ofFirstBp: 3658 },
        { step: "secured", count: 150, ofFirstBp: 1829 },
      ],
    },
    retention: {
      from: "2026-09-08",
      to: "2026-10-07",
      weeks: [
        {
          week: "2026-09-28",
          newPlayers: 280,
          returned: { d1: { count: 90, bp: 3214 }, d3: { count: 60, bp: 2142 }, d7: { count: 30, bp: 1071 }, d14: { count: FEWER, bp: null }, d30: { count: FEWER, bp: null } },
          secured: { count: 70, bp: 2500 },
        },
      ],
    },
    sessions: { from: "2026-09-08", to: "2026-10-07", count: 2850, lengths: { "under-2": 400, "2-5": 700, "5-15": 1100, "15-30": 450, "over-30": 200 }, perPlayerBp: 14500 },
    shares: {
      from: "2026-09-08",
      to: "2026-10-07",
      kinds: [
        { kind: "send-off", pressed: 120, completed: 80, arrived: 64, arrivedPerShareBp: 8000 },
        { kind: "granted", pressed: 30, completed: FEWER, arrived: FEWER, arrivedPerShareBp: null },
      ],
    },
    adverts: { from: "2026-09-08", to: "2026-10-07", impressions: 41000, taps: 120, revenueKobo: 0, revenuePerPlayerKobo: 0 },
    economy: {
      day: "2026-10-07",
      cells: ["1-3", "4-12", "13+"].flatMap((months) => ["0", "under-50k", "50k-500k", "over-500k"].map((held) => ({ months, held, lives: months === "1-3" && held === "under-50k" ? 140 : FEWER }))),
    },
  },
};

/** Every admin GET this page makes, by path without its query. */
export const ADMIN_GETS: Record<string, unknown> = {
  "/api/account": { ok: true, account: { id: "account.owner", country: "NG", age: { passed: true, method: "declared" }, createdAt: NOW - 90 * DAY_MS, character: null, admin: true, ways: { google: null, email: "owner@example.com", passkeys: 1 } } },
  "/api/admin/report": REPORT,
  "/api/admin/alarms": ALARMS,
  "/api/admin/rejections": REJECTIONS,
  "/api/admin/moderation/queue": QUEUE,
  "/api/admin/moderation/log": LOG,
  "/api/admin/moderation/feedback": FEEDBACK,
  "/api/admin/dedication/pending": PENDING_LIGHTS,
  "/api/admin/analytics": DASHBOARD,
  "/api/admin/stats": STATS,
  "/api/admin/adverts/campaigns": CAMPAIGNS,
  "/api/admin/switches": SWITCHES,
  "/api/admin/switches/log": SWITCH_LOG,
};
