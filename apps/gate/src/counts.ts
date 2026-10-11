// The gate's counts (analytics.md R-ANALYTICS-008): the holding
// screen served, the invite link used, and a page opened from a shared card
// (`?card=<kind>`). Each is a counter's name and key and the visitor's country
// as Cloudflare gave it, handed to the game's Worker over a service binding
// (`GAME`, its `GateCounters` entrypoint), which is not on the internet. No
// cookie, no header and nothing else about the visitor goes with it, and the
// gate keeps nothing. The game checks each against its own list.

/** One count: a counter's name and key. */
export interface CountRow {
  name: "funnel/step" | "share/arrival";
  key: string;
}

/** The game's entrypoint as the gate calls it. */
export interface GameCounters {
  count: (rows: CountRow[], country: string) => Promise<unknown>;
}

/**
 * The game's binding as the gate calls it. `wrangler types` gives a service binding to another Worker the plain
 * `Service` type, since it cannot see that Worker's entrypoint from here; this names the one method the gate calls.
 * A binding without it refuses the call, which `report` swallows.
 */
export function gameOf(binding: Service | undefined): GameCounters | undefined {
  return binding === undefined ? undefined : (binding as Service & GameCounters);
}

/** What the gate did with the request. */
export type Seen = "holding" | "invited" | "passed";

/** A card's kind as the share link carries it; the game holds the list of kinds. */
const CARD_KIND = /^[a-z0-9-]{1,32}$/;

/** A page load: a GET of a path that is not the game's routes and not a file. */
function pageLoad(request: Request, url: URL): boolean {
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) return false;
  const last = url.pathname.split("/").at(-1) ?? "";
  return !last.includes(".");
}

/** The counts one request makes. */
export function countsFor(request: Request, url: URL, seen: Seen): CountRow[] {
  const rows: CountRow[] = [];
  if (seen === "invited") rows.push({ name: "funnel/step", key: "invited" });
  if (seen === "holding" && request.method === "GET") rows.push({ name: "funnel/step", key: "holding" });
  const card = url.searchParams.get("card");
  if (card !== null && CARD_KIND.test(card) && pageLoad(request, url)) rows.push({ name: "share/arrival", key: card });
  return rows;
}

/** The visitor's country as Cloudflare gave it, or empty. */
export function countryOf(request: Request): string {
  const country = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  return typeof country === "string" ? country : "";
}

/** Hands the counts to the game after the reply; a missing binding or a failed call changes nothing the visitor sees. */
export function report(game: GameCounters | undefined, rows: CountRow[], country: string, waitUntil: (promise: Promise<unknown>) => void): void {
  if (game === undefined || rows.length === 0) return;
  try {
    waitUntil(game.count(rows, country).catch(() => undefined));
  } catch {
    // A binding that throws before it answers is the same as no binding.
  }
}
