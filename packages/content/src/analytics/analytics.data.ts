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
];

/** R-ANALYTICS-002: a load's time in bands, never in milliseconds. the page names no bands. */
export const LOAD_BANDS = ["under-1s", "1s-3s", "3s-10s", "over-10s"];

/** R-ANALYTICS-011: an ask, by what was asked and whether the early win had been shown. */
export const ASK_KEYS = ["sign-in:before", "sign-in:after", "notify:before", "notify:after"];

/** R-ANALYTICS-004: why a row or a batch was dropped. */
export const DROP_REASONS = ["signed-out", "size", "shape", "rate", "name", "key", "count"];

export const counterTable: CounterDef[] = [
  // R-ANALYTICS-008: made nightly from the command log.
  { name: "players/active", keys: "region", source: "server" },
  { name: "players/new", keys: "region", source: "server" },
  { name: "players/returned", keys: ["d1", "d7", "d30"], source: "server" },
  { name: "turns/ended", keys: "region", source: "server" },
  { name: "chapter/closed", keys: "id", source: "server" },
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
