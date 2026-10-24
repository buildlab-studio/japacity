// analytics.md: the fixed list of counters. The server counts only what is
// here, and the client sends only the names marked `client`. A key is one of
// the listed words, the account's region, or an entry id (`kind.slug`, with a
// `:` and a word after it where the page pairs the id with a state or choice).
import type { CounterDef } from "@japacity/sim";

/** route:refusal-reasons-recorded: a refusal's reasons, its first one counted. */
const REFUSAL_REASONS = ["funds", "interview", "history", "credibility", "sponsor", "agent", "endorsement", "relationship", "sham", "lead"];

/** The simulation's rejection codes and the server's own (`ServerCode` of packages/api/src/reply.ts). */
const REJECTION_CODES = [
  "stale",
  "clock-went-back",
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
  "one-character",
  "no-character",
  "switched-off",
  "under-age",
  "bad-date",
  "bot-check",
  "not-fresh",
  "bad-code",
  // The people routes' refusals (pair.md), in ServerCode.
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
  // The dedication's light refused by the shared check (server:dedication-routes).
  "bad-light",
];

/** share:cards-due-at-set-moments: the moments a card is due at, as the view's `card.kind` names them. */
const CARD_KINDS = ["chapter", "granted", "send-off", "first-pay-abroad", "secured", "december", "draw-win", "real-story", "lost"];

/**
 * analytics:client-sends-interface-counts: the screens the client counts as opened.
 * The page names no list, so these are the client's screens by their feature folder.
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
  // analytics:nightly-game-counters: the front door's screens, the funnel's client steps.
  "door-1",
  "door-2",
  "page",
];

/** analytics:client-sends-interface-counts: a load's time in bands, never in milliseconds. The page names no bands. */
const LOAD_BANDS = ["under-1s", "1s-3s", "3s-10s", "over-10s"];

/** analytics:day-one-and-seven-return: an ask, by what was asked and whether the early win had been shown. */
const ASK_KEYS = ["sign-in:before", "sign-in:after", "notify:before", "notify:after"];

/**
 * analytics:nightly-game-counters: the onboarding funnel's steps, in order, and
 * where each is counted. `door-1`, `door-2` and `page` are the front door's
 * screens, which only the client sees (`screen/opened`); the rest are
 * `funnel/step` keys the server counts.
 */
export const FUNNEL_STEPS = [
  { step: "door-1", from: "screen/opened" },
  { step: "door-2", from: "screen/opened" },
  { step: "page", from: "screen/opened" },
  { step: "begin", from: "funnel/step" },
  { step: "world", from: "funnel/step" },
  { step: "month-1", from: "funnel/step" },
  { step: "chapter-1", from: "funnel/step" },
  { step: "secured", from: "funnel/step" },
] as const;

/** analytics:nightly-game-counters: the funnel steps the server counts. */
const SERVER_FUNNEL_STEPS: string[] = FUNNEL_STEPS.filter((each) => each.from === "funnel/step").map((each) => each.step);

/** analytics:session-split-by-command-gaps: a gap longer than this between one account's commands ends a session. */
export const SESSION_GAP_MINUTES = 30;

/** analytics:session-split-by-command-gaps: an account is online while its last accepted command is this recent. */
export const ONLINE_MINUTES = 5;

/** analytics:session-split-by-command-gaps: a session's length in bands of minutes, each up to (not including) the next band's start. */
export const SESSION_BANDS = [
  { key: "under-2", from: 0 },
  { key: "2-5", from: 2 },
  { key: "5-15", from: 5 },
  { key: "15-30", from: 15 },
  { key: "over-30", from: 30 },
] as const;

/** analytics:nightly-game-counters: months played in bands, by the month a life is in (1 is its first after the years before). */
export const MONTH_BANDS = [
  { key: "1-3", from: 1 },
  { key: "4-12", from: 4 },
  { key: "13+", from: 13 },
] as const;

/** analytics:nightly-game-counters: naira held in bands, by the kobo from which each starts (`0` is nothing held; 500,000 naira is still `50k-500k`). */
export const HELD_BANDS = [
  { key: "0", from: 0 },
  { key: "under-50k", from: 1 },
  { key: "50k-500k", from: 5_000_000 },
  { key: "over-500k", from: 50_000_001 },
] as const;

/** analytics:nightly-game-counters: `economy/held`'s keys, a month band and a naira band. */
const ECONOMY_KEYS = MONTH_BANDS.flatMap((month) => HELD_BANDS.map((held) => `${month.key}:${held.key}`));

/** moderation:report-from-every-surface: a report's reasons, as the store keeps them (`ReportReason`). */
const REPORT_REASONS = ["scam", "harassment", "impersonation", "underage", "sexual", "hate", "self-harm", "illegal", "cheating", "advert", "other"];

/**
 * analytics:nightly-game-counters, server:csp-reports-to-own-origin: the directives a report of the page's content policy may be
 * counted under; any other is counted as `other`.
 */
export const CSP_DIRECTIVES = [
  "default-src",
  "script-src",
  "script-src-elem",
  "script-src-attr",
  "style-src",
  "style-src-elem",
  "style-src-attr",
  "img-src",
  "font-src",
  "connect-src",
  "media-src",
  "object-src",
  "frame-src",
  "child-src",
  "worker-src",
  "manifest-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
  "require-trusted-types-for",
  "trusted-types",
  "other",
] as const;

/**
 * analytics:nightly-game-counters, server:csp-reports-to-own-origin: what kind of thing a report of the page's content
 * policy says was blocked: the browser's word for a thing with no address, a scheme, a browser extension's own address,
 * the page's own origin, one of the hosts the policy names, or any other host. A kind never holds an address.
 */
export const CSP_BLOCKED_KINDS = [
  "inline",
  "eval",
  "wasm-eval",
  "trusted-types-policy",
  "trusted-types-sink",
  "data",
  "blob",
  "extension",
  "self",
  "challenges.cloudflare.com",
  "static.cloudflareinsights.com",
  "cloudflareinsights.com",
  "other-host",
  "other",
] as const;

/** `client/csp-blocked`'s keys: each directive with each kind, as `script-src-elem:inline`. */
const CSP_BLOCKED_KEYS = CSP_DIRECTIVES.flatMap((directive) => CSP_BLOCKED_KINDS.map((kind) => `${directive}:${kind}`));

/** analytics:server-checks-every-batch: why a row or a batch was dropped. */
const DROP_REASONS = ["signed-out", "size", "shape", "rate", "name", "key", "count"];

export const counterTable: CounterDef[] = [
  // analytics:nightly-game-counters: made nightly from the command log.
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
  // analytics:day-one-and-seven-return.
  { name: "first/early-win", keys: ["1", "2", "3", "later", "none"], source: "server" },
  // analytics:server-checks-every-batch.
  { name: "analytics/dropped", keys: DROP_REASONS, source: "server" },
  // analytics:nightly-game-counters, analytics:admin-stats-for-admins-only, analytics:session-split-by-command-gaps: the admin's numbers.
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
  { name: "lives/started", keys: "region", source: "server" },
  { name: "lives/secured", keys: "region", source: "server" },
  { name: "japa/departed", keys: "region", source: "server" },
  { name: "economy/held", keys: ECONOMY_KEYS, source: "server" },
  { name: "wallet/topped-up", keys: ["count", "kobo"], source: "server" },
  { name: "advert/revenue", keys: ["kobo"], source: "server" },
  { name: "moderation/open", keys: REPORT_REASONS, source: "server" },
  { name: "feedback/sent", keys: "region", source: "server" },
  // analytics:nightly-game-counters, server:csp-reports-to-own-origin: the page policy's reports, counted by the server as they arrive.
  { name: "client/csp", keys: [...CSP_DIRECTIVES], source: "server" },
  { name: "client/csp-blocked", keys: CSP_BLOCKED_KEYS, source: "server" },
  // analytics:nightly-game-counters, account:two-lights-and-wink-lines: the lives being played as the day ends, by where each stands, for the two lights.
  { name: "lives/playing", keys: ["home", "abroad", "road"], source: "server" },

  // analytics:client-sends-interface-counts: what only the client sees.
  { name: "screen/opened", keys: SCREENS, source: "client" },
  { name: "share/pressed", keys: CARD_KINDS, source: "client" },
  { name: "share/completed", keys: CARD_KINDS, source: "client" },
  { name: "advert/impression", keys: "id", source: "client" },
  { name: "advert/tap", keys: "id", source: "client" },
  { name: "settings/sound", keys: ["on", "off"], source: "client" },
  { name: "settings/graphics", keys: ["low", "high", "auto"], source: "client" },
  { name: "load/time", keys: LOAD_BANDS, source: "client" },
  { name: "client/error", keys: ["render", "network", "authority", "asset", "other"], source: "client" },
  // analytics:day-one-and-seven-return.
  { name: "ask/shown", keys: ASK_KEYS, source: "client" },
  { name: "ask/accepted", keys: ASK_KEYS, source: "client" },
];
