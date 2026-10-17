// The dedication's lights (docs/rules/server.md R-SERVER-045; account.md R-ACCOUNT-032 and R-ACCOUNT-033;
// moderation.md R-MODERATION-021 for the approval):
//
// GET    /api/dedication/lights  { count, lights, mine? }: the shared part from the server's cache, `mine` read fresh
// PUT    /api/dedication/light   { name, from?, to? }: lights the account's one light, checked by content's checkLight
// DELETE /api/dedication/light   puts it out
//
// The shared part is the same for everyone: the whole count and at most 240 lights, each with an opaque id and, only
// once approved, its name and years. It is kept in the server's cache (R-SERVER-039) in five-minute windows and let go
// at once when a light is lit, put out, approved or refused, so every account sees a new light straight away. A reply
// with `mine` differs for each account, so nothing here is kept by the browser. The counts route of R-ACCOUNT-031 is
// `/api/lights` and is not this one.
import { checkSentLight, type LightProblem } from "@japacity/content";
import { int, time } from "@japacity/sim";
import type { DedicationLight } from "@japacity/store";
import { Hono } from "hono";
import type { Context } from "hono";

import type { ServerDeps } from "../deps";
import { newId } from "../moderation/decide";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import type { ServerRejection } from "../types";
import type { EdgeCache } from "./edge";
import { edgeCache, edgeKey, forgetKept, JSON_TYPE, throughEdge } from "./edge";

export const DEDICATION_LIGHTS_PATH = "/api/dedication/lights";
export const DEDICATION_LIGHT_PATH = "/api/dedication/light";

/** R-SERVER-045: the most lights a reply lists; the count is every light whatever is listed. */
export const DEDICATION_MOST = 240;

/** R-SERVER-045: how long the server's cache keeps the shared part. */
export const DEDICATION_KEPT_MS = 5 * time.MINUTE_MS;

/** A light's years as the routes send them: either may be null. */
export interface LightYears {
  from: number | null;
  to: number | null;
}

/** R-SERVER-045: a light as everyone sees it: the name and years only once approved. */
export interface SharedLight {
  id: string;
  name?: string;
  years?: LightYears;
}

/** R-SERVER-045: the asker's own light in full. */
export interface MyLight {
  id: string;
  name: string;
  years: LightYears;
  approved: boolean;
}

export interface DedicationReply {
  ok: true;
  count: number;
  lights: SharedLight[];
  mine?: MyLight;
}

/** R-SERVER-045: a light refused by the shared check, with what is wrong. */
export interface BadLight extends ServerRejection {
  code: "bad-light";
  problems: LightProblem[];
}

/** The part of the reply that is the same for everyone. */
interface Shared {
  count: number;
  lights: SharedLight[];
}

function shared(light: DedicationLight): SharedLight {
  if (light.approvedAt === null) return { id: light.id };
  return light.from === null && light.to === null ? { id: light.id, name: light.name } : { id: light.id, name: light.name, years: { from: light.from, to: light.to } };
}

function myLight(light: DedicationLight): MyLight {
  return { id: light.id, name: light.name, years: { from: light.from, to: light.to }, approved: light.approvedAt !== null };
}

/** The five-minute window `now` falls in. */
function windowOf(now: number): number {
  return int.divFloor(now, DEDICATION_KEPT_MS);
}

/** The cache's key for the shared part in `now`'s window. Nothing about the asker is in it. */
function sharedKey(origin: string, now: number): string {
  return edgeKey(origin, ["dedication", windowOf(now)]);
}

/** The year a light's years run up to: the server's own, in UTC. */
export function serverYear(now: number): number {
  return new Date(now).getUTCFullYear();
}

async function readShared(deps: ServerDeps, edge: EdgeCache | null, origin: string): Promise<Shared> {
  const now = deps.now();
  const served = await throughEdge(edge, sharedKey(origin, now), now, async () => {
    const { count, lights } = await deps.stores.dedication.shared(DEDICATION_MOST);
    const body: Shared = { count, lights: lights.map(shared) };
    return { body: JSON.stringify(body), type: JSON_TYPE, freshUntil: (windowOf(now) + 1) * DEDICATION_KEPT_MS };
  });
  const text = typeof served.body === "string" ? served.body : new TextDecoder().decode(served.body);
  return JSON.parse(text) as Shared;
}

/** A reply that differs for each account: never kept by the browser. */
function personal(c: Context<SessionEnv>, body: unknown, status: 200 | 400 | 401 = 200): Response {
  c.header("cache-control", "private, no-store");
  return c.json(body, status);
}

const SIGNED_OUT: ServerRejection = { ok: false, code: "signed-out", detail: "Sign in to light one." };

export function dedicationRoutes(deps: ServerDeps, edge: EdgeCache | null = edgeCache()): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  const origin = (c: Context<SessionEnv>): string => new URL(c.req.url).origin;
  // A light lit, put out, approved or refused shows at once: the window's kept part is let go.
  const changed = (c: Context<SessionEnv>): Promise<void> => forgetKept(edge, sharedKey(origin(c), deps.now()));

  route.get(DEDICATION_LIGHTS_PATH, limit(deps, "reads"), async (c) => {
    const part = await readShared(deps, edge, origin(c));
    const session = sessionOf(c);
    const own = session === null ? null : await deps.stores.dedication.mine(session.account);
    const reply: DedicationReply = own === null ? { ok: true, ...part } : { ok: true, ...part, mine: myLight(own) };
    return personal(c, reply);
  });

  route.put(DEDICATION_LIGHT_PATH, limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    // The light is kept with the account (R-ACCOUNT-033), so a session with no account behind it has nowhere to keep one.
    if (session === null || (await deps.stores.account.get(session.account)) === null) return personal(c, SIGNED_OUT, 401);
    const sent: unknown = await c.req.json<unknown>().catch(() => null);
    const now = deps.now();
    const checked = checkSentLight(sent, serverYear(now));
    if (!checked.ok) {
      const refused: BadLight = { ok: false, code: "bad-light", detail: `The light was refused: ${checked.problems.join(", ")}.`, problems: checked.problems };
      return personal(c, refused, 400);
    }
    const lit = await deps.stores.dedication.light({ account: session.account, id: newId(deps, "light"), ...checked.light, litAt: now });
    await changed(c);
    return personal(c, { ok: true, mine: myLight(lit) });
  });

  route.delete(DEDICATION_LIGHT_PATH, limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    if (session === null) return personal(c, SIGNED_OUT, 401);
    await deps.stores.dedication.putOut(session.account);
    await changed(c);
    return personal(c, { ok: true });
  });

  return route;
}

/** For the admin's routes (R-MODERATION-021): the shared part's kept copy let go after an approval or a refusal. */
export function forgetSharedLights(edge: EdgeCache | null, origin: string, now: number): Promise<void> {
  return forgetKept(edge, sharedKey(origin, now));
}
