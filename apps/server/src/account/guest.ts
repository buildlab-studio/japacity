// account:social-needs-secured-account, account:guest-floods-are-capped, account:idle-guests-cleaned-by-hand: what a guest may not do, the limits on making
// guests, and the last time each account played. Mounted with the account
// routes, before every route it guards, so the server refuses whatever the
// screen shows.
import type { ServerRejection } from "@japacity/api";
import { time } from "@japacity/sim";
import type { CommandType } from "@japacity/sim";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";

import { RATE_LIMIT_MODEL, sha256Hex } from "../auth/hooks";
import type { ServerDeps } from "../dependencies";
import { addressKey } from "../limits/address";
import type { SessionEnv } from "../limits/limit";

const SECURE = "Secure this life with Google or an email code";

/** account:social-needs-secured-account: what a guest asking for a board is told. */
export const BOARDS_DETAIL = `${SECURE} to be on the boards.`;

/** account:social-needs-secured-account: the commands only a secured account may send, each with what the refusal says. */
const SECURED_COMMANDS: Partial<Record<CommandType, string>> = {
  "lottery/buy": `${SECURE} to buy lottery tickets.`,
  "people/invite": `${SECURE} to invite a friend.`,
};

/** account:social-needs-secured-account: the routes only a secured account may use, by path pattern and method. */
export const SECURED_PATHS: readonly { path: string; method: "GET" | "POST"; detail: string }[] = [
  { path: "/api/invite", method: "POST", detail: `${SECURE} to invite a friend.` },
  { path: "/api/invite/:code/accept", method: "POST", detail: `${SECURE} to take a friend's invite.` },
  { path: "/api/pair/:pair/say", method: "POST", detail: `${SECURE} to send messages.` },
  { path: "/api/pair/:pair/conversation", method: "GET", detail: `${SECURE} to read messages.` },
  // The boards the client reads (city:boards-switch-when-and-who): `/api/boards/:when/:who` and `/api/boards/joined-week`. Their rows
  // leave guests out too (boards/figures.ts), and a secured account is listed again (link.ts).
  { path: "/api/boards/*", method: "GET", detail: BOARDS_DETAIL },
];

export function guestOnly(detail: string): ServerRejection {
  return { ok: false, code: "guest-only", detail };
}

/** True when the signed-in account is a guest. An account with no row is not one: the routes answer it themselves. */
async function isGuest(deps: ServerDeps, account: string): Promise<boolean> {
  return (await deps.stores.account.get(account))?.state === "guest";
}

async function refuseGuest(deps: ServerDeps, c: Context, detail: string): Promise<Response | null> {
  const session = await deps.session(c.req.raw);
  if (session === null || !(await isGuest(deps, session.account))) return null;
  return c.json(guestOnly(detail), 403);
}

/** The command's type from a request body, or null when the body is not a command. */
function commandTypeOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("command" in body)) return null;
  const command = body.command;
  if (typeof command !== "object" || command === null || !("type" in command)) return null;
  return typeof command.type === "string" ? command.type : null;
}

/**
 * account:idle-guests-cleaned-by-hand: every command and every new life keeps the account's last
 * play. Read after the route, from the session its limit already read.
 */
function keepLastPlay(deps: ServerDeps): MiddlewareHandler<SessionEnv> {
  return async (c, next) => {
    await next();
    const session = c.get("session") as { account: string } | null | undefined;
    if (session !== null && session !== undefined) await deps.stores.account.touch(session.account, deps.now());
  };
}

/** account:social-needs-secured-account: refuses a guest a secured-only command; the route reads the same body again from Hono's cache. */
function commandGate(deps: ServerDeps): MiddlewareHandler<SessionEnv> {
  return async (c, next) => {
    if (c.req.method === "POST") {
      const type = commandTypeOf(await c.req.json().catch(() => null));
      const detail = type === null ? undefined : SECURED_COMMANDS[type as CommandType];
      const refused = detail === undefined ? null : await refuseGuest(deps, c, detail);
      if (refused !== null) return refused;
    }
    await next();
    return undefined;
  };
}

/** Every guest gate and the last-play keeper, as one router mounted before the routes they guard. */
export function guestGates(deps: ServerDeps): Hono<SessionEnv> {
  const gates = new Hono<SessionEnv>();
  for (const { path, method, detail } of SECURED_PATHS) {
    gates.on(method, path, async (c, next) => {
      const refused = await refuseGuest(deps, c, detail);
      if (refused !== null) return refused;
      await next();
      return undefined;
    });
  }
  gates.use("/api/command", commandGate(deps));
  gates.use("/api/command", keepLastPlay(deps));
  // server:server-plays-prologue-preset: the prologue's preset is the player's commands in one request.
  gates.use("/api/prologue/preset", keepLastPlay(deps));
  gates.use("/api/character", keepLastPlay(deps));
  return gates;
}

// ---------------------------------------------------------------------------
// account:guest-floods-are-capped: new guest lives from one device and from one connection.
// Counted in the auth library's rate-limit table, the database store that
// account:sign-in-routes-rate-limited already uses, because the rate-limit bindings count only 10 or
// 60 second periods and this window is hours long.
// ---------------------------------------------------------------------------

/** The device cookie: a random id, set on the first guest start, that only this count reads. */
export const DEVICE_COOKIE = "japacity-device";

const GUEST_DEVICE_PREFIX = "guest-device:";
const GUEST_ADDRESS_PREFIX = "guest-address:";

interface WindowRow {
  key: string;
  count: number;
  /** For these rows, when the window ends, so the nightly prune of rows past their window keeps them until then. */
  lastRequest: number | bigint;
}

interface LimitAdapter {
  findOne: <T>(input: { model: string; where: { field: string; value: string }[] }) => Promise<T | null>;
  create: (input: { model: string; data: Record<string, unknown> }) => Promise<unknown>;
  update: (input: { model: string; where: { field: string; value: string }[]; update: Record<string, unknown> }) => Promise<unknown>;
}

async function keysOf(device: string, address: string | null): Promise<{ key: string; max: "guestsPerDevice" | "guestsPerConnection" }[]> {
  const keys: { key: string; max: "guestsPerDevice" | "guestsPerConnection" }[] = [{ key: GUEST_DEVICE_PREFIX + (await sha256Hex(device)), max: "guestsPerDevice" }];
  if (address !== null && address !== "") keys.push({ key: GUEST_ADDRESS_PREFIX + (await sha256Hex(addressKey(address))), max: "guestsPerConnection" });
  return keys;
}

/** account:guest-floods-are-capped: true when one more guest from this device or this connection would pass its limit in the window. */
export async function tooManyGuests(deps: ServerDeps, adapter: LimitAdapter, device: string, address: string | null): Promise<boolean> {
  const now = deps.now();
  for (const { key, max } of await keysOf(device, address)) {
    const row = await adapter.findOne<WindowRow>({ model: RATE_LIMIT_MODEL, where: [{ field: "key", value: key }] });
    if (row !== null && Number(row.lastRequest) > now && row.count >= deps.config.account[max]) return true;
  }
  return false;
}

/** account:guest-floods-are-capped: counts a guest made from this device and this connection. A window starts with the first guest after the last one ended. */
export async function countGuest(deps: ServerDeps, adapter: LimitAdapter, device: string, address: string | null): Promise<void> {
  const now = deps.now();
  const ends = now + deps.config.account.guestWindowHours * time.HOUR_MS;
  for (const { key } of await keysOf(device, address)) {
    const where = [{ field: "key", value: key }];
    const row = await adapter.findOne<WindowRow>({ model: RATE_LIMIT_MODEL, where });
    if (row === null) await adapter.create({ model: RATE_LIMIT_MODEL, data: { key, count: 1, lastRequest: ends } });
    else if (Number(row.lastRequest) <= now) await adapter.update({ model: RATE_LIMIT_MODEL, where, update: { count: 1, lastRequest: ends } });
    else await adapter.update({ model: RATE_LIMIT_MODEL, where, update: { count: row.count + 1 } });
  }
}
