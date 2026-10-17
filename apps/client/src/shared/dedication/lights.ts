// The dedication's lights as the client holds them (docs/rules/server.md R-SERVER-045; account.md R-ACCOUNT-032 and
// R-ACCOUNT-033; world.md R-WORLD-036): what `GET /api/dedication/lights` last answered, the account's own light
// among it, and the two writes, lighting one and putting it out. Shared because the dedication page draws the lights
// and the map's lantern canoe carries a second lantern once the account's own is lit. Offline, in a build with no
// server, or when the read fails, the water is out of reach and nothing is guessed. Nothing here is counted.
import type { LightProblem } from "@japacity/content";
import { useEffect, useSyncExternalStore } from "react";

import { authorityMode } from "../../authority/mode";
import { api, type Api } from "../net/http";
import type { WallGuard } from "../net/wall";

/** R-SERVER-045: a light as everyone sees it: its name and years only once approved. */
export interface SharedLight {
  id: string;
  name?: string;
  years?: { from: number | null; to: number | null };
}

/** R-SERVER-045: the account's own light in full. */
export interface MyLight {
  id: string;
  name: string;
  years: { from: number | null; to: number | null };
  approved: boolean;
}

/** R-SERVER-045: the read's reply. */
export interface DedicationReply {
  ok: true;
  count: number;
  lights: SharedLight[];
  mine?: MyLight;
}

/** What the client knows of the water: not asked yet, being asked, out of reach, or the lights as last read. */
export type Water = { kind: "unasked" } | { kind: "asking" } | { kind: "out" } | { kind: "read"; count: number; lights: SharedLight[]; mine: MyLight | null };

/** Why a light was not lit: the shared check's problems from the server, or no answer the page can use. */
export type LightRefused = { ok: false; problems: LightProblem[] } | { ok: false; out: true };

/**
 * A picture never moves the page: a login wall met here is left to the account's own reads, which reload for it
 * (R-ENGINE-015), as the two lights' read does.
 */
const QUIET_WALL: WallGuard = { met: () => false, passed: () => undefined };

/** The server where the build has one; none in a build that plays on the device. */
function buildServer(): Api | null {
  const mode = authorityMode();
  return mode.authority === "remote" ? api({ baseUrl: mode.baseUrl, wall: QUIET_WALL }) : null;
}

let server: Api | null | undefined;
let water: Water = { kind: "unasked" };
const listeners = new Set<() => void>();

function serverNow(): Api | null {
  if (server === undefined) server = buildServer();
  return server;
}

function set(next: Water): void {
  water = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For tests: the server to ask (null for none), and the water forgotten as on a new visit. */
export function setDedicationServer(next: Api | null): void {
  server = next;
  water = { kind: "unasked" };
  for (const listener of listeners) listener();
}

/** For tests: forgets what was read and which server to ask. */
export function forgetDedication(): void {
  server = undefined;
  water = { kind: "unasked" };
}

/** The water as it stands now. */
function waterNow(): Water {
  return water;
}

function isReply(value: unknown): value is DedicationReply {
  if (typeof value !== "object" || value === null) return false;
  const reply = value as Partial<DedicationReply>;
  return reply.ok === true && typeof reply.count === "number" && Array.isArray(reply.lights);
}

/** R-ACCOUNT-032: reads the lights as the page opens. A failed read, or no server, leaves the water out of reach. */
export async function readLights(): Promise<Water> {
  const asked = serverNow();
  if (asked === null) {
    set({ kind: "out" });
    return water;
  }
  if (water.kind !== "read") set({ kind: "asking" });
  try {
    const reply = await asked.get<unknown>("/api/dedication/lights");
    set(isReply(reply) ? { kind: "read", count: reply.count, lights: reply.lights, mine: reply.mine ?? null } : { kind: "out" });
  } catch {
    set({ kind: "out" });
  }
  return water;
}

/** R-ACCOUNT-033: lights the account's light; the reply's own light shows at once and the count takes it in. */
export async function lightOne(sent: { name: string; from: number | null; to: number | null }): Promise<{ ok: true; mine: MyLight } | LightRefused> {
  const asked = serverNow();
  if (asked === null) return { ok: false, out: true };
  try {
    const body = { name: sent.name, ...(sent.from === null ? {} : { from: sent.from }), ...(sent.to === null ? {} : { to: sent.to }) };
    const reply = await asked.put<{ ok: true; mine: MyLight } | { ok: false; code: string; problems?: LightProblem[] }>("/api/dedication/light", body);
    if (!reply.ok) return reply.code === "bad-light" ? { ok: false, problems: reply.problems ?? [] } : { ok: false, out: true };
    const before = water;
    if (before.kind === "read") {
      const had = before.mine;
      const lights = had === null ? before.lights : before.lights.filter((light) => light.id !== had.id);
      set({ kind: "read", count: had === null ? before.count + 1 : before.count, lights: [{ id: reply.mine.id }, ...lights], mine: reply.mine });
    } else set({ kind: "read", count: 1, lights: [{ id: reply.mine.id }], mine: reply.mine });
    return reply;
  } catch {
    return { ok: false, out: true };
  }
}

/** R-ACCOUNT-033: "Put it out". True once the server has taken it. */
export async function putOutMine(): Promise<boolean> {
  const asked = serverNow();
  if (asked === null) return false;
  try {
    const reply = await asked.delete<{ ok: boolean }>("/api/dedication/light", {});
    if (!reply.ok) return false;
    const before = water;
    if (before.kind === "read" && before.mine !== null) {
      const gone = before.mine.id;
      set({ kind: "read", count: Math.max(0, before.count - 1), lights: before.lights.filter((light) => light.id !== gone), mine: null });
    }
    return true;
  } catch {
    return false;
  }
}

/** The water, following every read and write on the page. */
export function useWater(): Water {
  return useSyncExternalStore(subscribe, waterNow, waterNow);
}

/**
 * R-WORLD-036: whether the account's own light is lit, for the canoe's second lantern. Asks the server once in a visit
 * if nothing has asked yet; until an answer, and with none, the canoe carries its one lantern.
 */
export function useMineLit(): boolean {
  const now = useWater();
  useEffect(() => {
    if (waterNow().kind === "unasked") void readLights();
  }, []);
  return now.kind === "read" && now.mine !== null;
}
