// The place routes: the presence fetch (R-CLOCK-028) and the nudge socket
// (R-CLOCK-020, R-CLOCK-029, R-CLOCK-030). Both need a session.
import { Hono } from "hono";
import type { Context } from "hono";

import type { ServerDeps } from "../deps";
import type { PlaceOf } from "../nudge/place.nudge";
import { openSocket } from "../place/place.rooms";
import { STATUS_TOO_LARGE } from "../place/place.socket";
import type { Rooms } from "../place/place.rooms";
import { policyFor } from "../region";
import type { RegionPolicy } from "../region";
import type { PresenceReply, ServerCode, ServerRejection } from "../types";

/** The character's display name and look, or null when the account has none. The core provides it. */
export type ProfileOf = (account: string) => Promise<{ name: string; look: string } | null>;

/** What the socket route needs beyond the deps: the place objects and two reads of the character. */
export interface PlaceBindings {
  rooms: Rooms;
  placeOf: PlaceOf;
  profileOf: ProfileOf;
}

type Status = 401 | 403 | 404 | 409 | 413 | 426 | 503;

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

/**
 * R-ACCOUNT-007, R-ACCOUNT-010, R-CLOCK-030: whether players may meet at all.
 * No strong age check exists in this milestone, so a `verified` row counts as `none`.
 */
export function allowsInteraction(policy: RegionPolicy): boolean {
  return policy.interaction !== "none" && policy.ageCheck !== "verified";
}

function seedFrom(bytes: Uint8Array): number {
  return bytes.reduce((seed, byte) => ((seed << 8) | byte) >>> 0, 0);
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** `GET /api/place/:place`: a fresh sample of the other players there (R-CLOCK-028). */
export function placeRoutes(deps: ServerDeps): Hono {
  const app = new Hono();

  app.get("/api/place/:place", async (c) => {
    const session = await deps.session(c.req.raw);
    if (session === null) return refuse(c, 401, "signed-out", "sign in first");
    const place = c.req.param("place");
    if (!Object.hasOwn(deps.contents.current.place, place)) return refuse(c, 404, "unknown-id", `no place ${place}`);
    const reply: PresenceReply = { place, others: [] };
    // R-CLOCK-030: where players may not meet, the place shows only computer people.
    if (!allowsInteraction(policyFor(deps.config.regions, countryOf(c.req.raw)))) return c.json(reply);
    const seed = seedFrom(deps.randomBytes(4));
    const members = await deps.stores.presence.sample(place, deps.config.presence.sample, session.account, seed);
    reply.others = members.map((member) => ({ name: member.name, look: member.look }));
    return c.json(reply);
  });

  return app;
}

/** `GET /api/place/:place/socket`: the nudge and presence socket, in the room the router picks (R-CLOCK-029). */
export function placeSocketRoutes(deps: ServerDeps, bindings: PlaceBindings): Hono {
  const app = new Hono();

  app.get("/api/place/:place/socket", async (c) => {
    const session = await deps.session(c.req.raw);
    if (session === null) return refuse(c, 401, "signed-out", "sign in first");
    const place = c.req.param("place");
    if (!Object.hasOwn(deps.contents.current.place, place)) return refuse(c, 404, "unknown-id", `no place ${place}`);
    // no ServerCode names "players do not meet in this region"; region-closed is the nearest.
    if (!allowsInteraction(policyFor(deps.config.regions, countryOf(c.req.raw)))) return refuse(c, 403, "region-closed", "players do not meet in this region");
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
