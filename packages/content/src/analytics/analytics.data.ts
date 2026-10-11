// analytics.md: the fixed list of counters. The server counts only what is
// here, and the client sends only the names marked `client`. A key is one of
// the listed words, the account's region, or an entry id (`kind.slug`, with a
// `:` and a word after it where the page pairs the id with a state or choice).
import type { CounterDef } from "@japacity/sim";

/** R-ROUTE-019: a refusal's reasons, its first one counted. */
const REFUSAL_REASONS = ["funds", "interview", "history", "credibility", "sponsor", "agent", "endorsement", "relationship", "sham", "lead"];

/** The simulation's rejection codes and the server's own (apps/server/src/types.ts `ServerCode`). */
const REJECTION_CODES = [
  "stale",
  "clock-went-back",
  "no-turns",
  "setpiece-open",
  "not-legal",
  "cannot-afford",
  "unknown-id",
  "bad-amount",
  "not-yours",
  "ended",
  "prologue-open",
  "rate-limited",
  "signed-out",
  "diverged",
  "region-closed",
  "one-character",
  "no-character",
  "switched-off",
  "region",
  "under-age",
  "bad-date",
  "bot-check",
  "not-fresh",
  "bad-code",
  // The people routes' refusals (pair.md), in ServerCode from 8 Oct 2026.
  "not-possible",
  "blocked",
  "too-many",
  "wrong-place",
  "bad-fill",
  "not-here",
  "used",
  "expired",
  "wrong-slot",
  "not-adult",
  "moved-on",
  "guest-only",
];

/** R-SHARE-001: the moments a card is due at, as the view's `card.kind` names them. */
const CARD_KINDS = ["chapter", "granted", "send-off", "first-pay-abroad", "secured", "december", "draw-win", "real-story", "lost"];

/**
 * R-ANALYTICS-002: the screens the client counts as opened.
 * the page names no list, so these are the client's screens by their feature folder.
 */
const SCREENS = [
  "turn",
  "report",
  "activity",
  "wallet",
  "route",
  "document",
  "quality",
  "obligation",
  "offer",
  "chapter",
  "goal",
  "news",
  "place",
  "status",
  "credit",
  "road",
  "setpiece",
  "prologue",
  "scenario",
  "japacity",
  "lottery",
  "people",
  "guide",
  "settings",
  "sign-in",
  "age",
  // R-ANALYTICS-008: the front door's screens, the funnel's client steps.
  "door-1",
  "door-2",
  "page",
];

/** R-ANALYTICS-002: a load's time in bands, never in milliseconds. the page names no bands. */
export const LOAD_BANDS = ["under-1s", "1s-3s", "3s-10s", "over-10s"];

/** R-ANALYTICS-011: an ask, by what was asked and whether the early win had been shown. */
export const ASK_KEYS = ["sign-in:before", "sign-in:after", "notify:before", "notify:after"];

/**
 * R-ANALYTICS-008: the onboarding funnel's steps, in order, and
 * where each is counted. `door-1`, `door-2` and `page` are the front door's
 * screens, which only the client sees (`screen/opened`); the rest are
 * `funnel/step` keys the server counts.
 */
export const FUNNEL_STEPS = [
  { step: "holding", from: "funnel/step" },
  { step: "invited", from: "funnel/step" },
  { step: "door-1", from: "screen/opened" },
  { step: "door-2", from: "screen/opened" },
  { step: "page", from: "screen/opened" },
  { step: "begin", from: "funnel/step" },
  { step: "world", from: "funnel/step" },
  { step: "month-1", from: "funnel/step" },
  { step: "chapter-1", from: "funnel/step" },
  { step: "secured", from: "funnel/step" },
] as const;

/** R-ANALYTICS-008: the funnel steps the server counts. */
export const SERVER_FUNNEL_STEPS: string[] = FUNNEL_STEPS.filter((each) => each.from === "funnel/step").map((each) => each.step);

/** R-ANALYTICS-013: a gap longer than this between one account's commands ends a session. */
export const SESSION_GAP_MINUTES = 30;

/** R-ANALYTICS-013: an account is online while its last accepted command is this recent. */
export const ONLINE_MINUTES = 5;

/** R-ANALYTICS-013: a session's length in bands of minutes, each up to (not including) the next band's start. */
export const SESSION_BANDS = [
  { key: "under-2", from: 0 },
  { key: "2-5", from: 2 },
  { key: "5-15", from: 5 },
  { key: "15-30", from: 15 },
  { key: "over-30", from: 30 },
] as const;

/** R-ANALYTICS-008: months played in bands, by the month a life is in (1 is its first after the years before). */
export const MONTH_BANDS = [
  { key: "1-3", from: 1 },
  { key: "4-12", from: 4 },
  { key: "13+", from: 13 },
] as const;

/** R-ANALYTICS-008: naira held in bands, by the kobo from which each starts (`0` is nothing held; 500,000 naira is still `50k-500k`). */
export const HELD_BANDS = [
  { key: "0", from: 0 },
  { key: "under-50k", from: 1 },
  { key: "50k-500k", from: 5_000_000 },
  { key: "over-500k", from: 50_000_001 },
] as const;

/** R-ANALYTICS-008: `economy/held`'s keys, a month band and a naira band. */
const ECONOMY_KEYS = MONTH_BANDS.flatMap((month) => HELD_BANDS.map((held) => `${month.key}:${held.key}`));

/** R-MODERATION-003: a report's reasons, as the store keeps them (`ReportReason`). */
const REPORT_REASONS = ["scam", "harassment", "impersonation", "underage", "sexual", "hate", "self-harm", "illegal", "cheating", "advert", "other"];

/** R-ANALYTICS-004: why a row or a batch was dropped. */
export const DROP_REASONS = ["signed-out", "size", "shape", "rate", "name", "key", "count"];

export const counterTable: CounterDef[] = [
  // R-ANALYTICS-008: made nightly from the command log.
  { name: "players/active", keys: "region", source: "server" },
  { name: "players/new", keys: "region", source: "server" },
  { name: "players/returned", keys: ["d1", "d3", "d7", "d14", "d30"], source: "server" },
  { name: "turns/ended", keys: "region", source: "server" },
  { name: "chapter/closed", keys: "id", source: "server" },
  { name: "chapter/reopened", keys: "id", source: "server" },
  { name: "route/moved", keys: "id", source: "server" },
  { name: "route/refused", keys: REFUSAL_REASONS, source: "server" },
  { name: "offer/chosen", keys: "id", source: "server" },
  { name: "place/returned", keys: ["removed", "assisted", "broke", "by-choice", "with-papers"], source: "server" },
  { name: "command/rejected", keys: REJECTION_CODES, source: "server" },
  { name: "lottery/tickets", keys: "region", source: "server" },
  // R-ANALYTICS-011.
  { name: "first/early-win", keys: ["1", "2", "3", "later", "none"], source: "server" },
  // R-ANALYTICS-004.
  { name: "analytics/dropped", keys: DROP_REASONS, source: "server" },
  // R-ANALYTICS-008, 012, 013: the numbers before launch.
  { name: "players/weekly", keys: "region", source: "server" },
  { name: "players/monthly", keys: "region", source: "server" },
  { name: "players/online-peak", keys: ["peak"], source: "server" },
  { name: "players/guest", keys: "region", source: "server" },
  { name: "players/secured", keys: "region", source: "server" },
  { name: "players/secured-by-signup", keys: "region", source: "server" },
  { name: "players/total", keys: "region", source: "server" },
  { name: "sessions/count", keys: "region", source: "server" },
  { name: "sessions/length", keys: SESSION_BANDS.map((band) => band.key), source: "server" },
  { name: "funnel/step", keys: SERVER_FUNNEL_STEPS, source: "server" },
  { name: "share/arrival", keys: CARD_KINDS, source: "server" },
  { name: "lives/started", keys: "region", source: "server" },
  { name: "lives/secured", keys: "region", source: "server" },
  { name: "japa/departed", keys: "region", source: "server" },
  { name: "economy/held", keys: ECONOMY_KEYS, source: "server" },
  { name: "wallet/topped-up", keys: ["count", "kobo"], source: "server" },
  { name: "advert/revenue", keys: ["kobo"], source: "server" },
  { name: "moderation/open", keys: REPORT_REASONS, source: "server" },
  { name: "feedback/sent", keys: "region", source: "server" },

  // R-ANALYTICS-002: what only the client sees.
  { name: "screen/opened", keys: SCREENS, source: "client" },
  { name: "share/pressed", keys: CARD_KINDS, source: "client" },
  { name: "share/completed", keys: CARD_KINDS, source: "client" },
  { name: "advert/impression", keys: "id", source: "client" },
  { name: "advert/tap", keys: "id", source: "client" },
  { name: "settings/sound", keys: ["on", "off"], source: "client" },
  { name: "settings/graphics", keys: ["low", "high", "auto"], source: "client" },
  { name: "load/time", keys: LOAD_BANDS, source: "client" },
  { name: "client/error", keys: ["render", "network", "authority", "asset", "other"], source: "client" },
  // R-ANALYTICS-011.
  { name: "ask/shown", keys: ASK_KEYS, source: "client" },
  { name: "ask/accepted", keys: ASK_KEYS, source: "client" },
];
