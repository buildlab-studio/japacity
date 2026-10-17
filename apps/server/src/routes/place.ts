// The place routes: the presence fetch (R-CLOCK-028, R-CITY-036) and the nudge socket
// (R-CLOCK-020, R-CLOCK-029, R-CLOCK-030). Both need a session and answer in
// every region: presence is not contact (region.md R-REGION-002), and the
// socket carries only nudges, never words between players.
import { Hono } from "hono";
import type { Context } from "hono";

import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import type { PlaceOf } from "../nudge/place.nudge";
import { readsToday } from "../place/place.presence";
import { openSocket } from "../place/place.rooms";
import { STATUS_TOO_LARGE } from "../place/place.socket";
import type { Rooms } from "../place/place.rooms";
import { placeTarget } from "../switches/dials";
import type { PresenceReply, ServerCode, ServerRejection } from "../types";

/** The character's display name and look, or null when the account has none. The core provides it. */
export type ProfileOf = (account: string) => Promise<{ name: string; look: string } | null>;

/** What the socket route needs beyond the deps: the place objects and two reads of the character. */
export interface PlaceBindings {
  rooms: Rooms;
  placeOf: PlaceOf;
  profileOf: ProfileOf;
}

type Status = 401 | 404 | 409 | 413 | 426 | 503;

function refuse(c: Context, status: Status, code: ServerCode, detail: string): Response {
  const body: ServerRejection = { ok: false, code, detail };
  return c.json(body, status);
}

/** R-ACCOUNT-008: Cloudflare's country for the request, from `request.cf` or the header it sets. */
export function countryOf(request: Request): string | null {
  const cf = (request as Request & { cf?: { country?: unknown } }).cf;
  if (typeof cf?.country === "string") return cf.country;
  return request.headers.get("cf-ipcountry");
}

function seedFrom(bytes: Uint8Array): number {
  return bytes.reduce((seed, byte) => ((seed << 8) | byte) >>> 0, 0);
}

/** R-CITY-036: a name and a look, so no account id or position can reach the reply. */
function shown(member: { name: string; look: string }): { name: string; look: string } {
  return { name: member.name, look: member.look };
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** `GET /api/place/:place`: a fresh sample of the other players there (R-CLOCK-028), and of some seen there today (R-CITY-036). */
export function placeRoutes(deps: ServerDeps): Hono<SessionEnv> {
  const app = new Hono<SessionEnv>();

  app.get("/api/place/:place", limit(deps, "reads"), async (c) => {
    const session = sessionOf(c);
    if (session === null) return refuse(c, 401, "signed-out", "sign in first");
    const place = c.req.param("place");
    if (!Object.hasOwn(deps.contents.current.place, place)) return refuse(c, 404, "unknown-id", `no place ${place}`);
    const reply: PresenceReply = { place, others: [], today: [] };
    const seed = seedFrom(deps.randomBytes(4));
    const store = deps.stores.presence;
    // R-CITY-032, R-SERVER-030: never more players than the place's target headcount, dial applied.
    const n = Math.min(deps.config.presence.sample, await placeTarget(deps, place));
    if (readsToday(store)) {
      const look = await store.lookWithToday(place, n, session.account, seed, deps.now());
      reply.others = look.others.map(shown);
      reply.today = look.today.map(shown);
      return c.json(reply);
    }
    reply.others = (await store.sample(place, n, session.account, seed)).map(shown);
    return c.json(reply);
  });

  return app;
}

/** `GET /api/place/:place/socket`: the nudge and presence socket, in the room the router picks (R-CLOCK-029). */
export function placeSocketRoutes(deps: ServerDeps, bindings: PlaceBindings): Hono<SessionEnv> {
  const app = new Hono<SessionEnv>();

  // Opening a socket reads the character twice, so it counts against the reads limit.
  app.get("/api/place/:place/socket", limit(deps, "reads"), async (c) => {
    const session = sessionOf(c);
    if (session === null) return refuse(c, 401, "signed-out", "sign in first");
    const place = c.req.param("place");
    if (!Object.hasOwn(deps.contents.current.place, place)) return refuse(c, 404, "unknown-id", `no place ${place}`);
    if (c.req.header("upgrade")?.toLowerCase() !== "websocket") return refuse(c, 426, "not-legal", "expected a socket upgrade");

    const [where, profile] = await Promise.all([bindings.placeOf(session.account), bindings.profileOf(session.account)]);
    if (where === null || profile === null) return refuse(c, 404, "no-character", "the account has no character");
    // no ServerCode names "the character is not in that place"; not-legal is the nearest.
    if (where !== place) return refuse(c, 409, "not-legal", `the character is in ${where}`);

    const member = { account: session.account, name: profile.name, look: profile.look, place, joinedAt: deps.now() };
    const response = await openSocket(bindings.rooms, place, { kind: "member", socket: hex(deps.randomBytes(16)), member });
    if (response.status === 101) return response;
    const detail = await response.text();
    return refuse(c, response.status === STATUS_TOO_LARGE ? 413 : 503, "not-legal", detail);
  });

  return app;
}
