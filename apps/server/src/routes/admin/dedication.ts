// The lights list (docs/rules/moderation.md R-MODERATION-021, a name shows once approved): the
// dedication lights whose names await a look, for the admin page's moderation tab, and the two decisions on each.
// Behind the admin gate (R-SERVER-012, R-MODERATION-012), like every admin route.
//
// GET  /api/admin/dedication/pending          the lights awaiting a look, oldest first, with each account's username and region
// POST /api/admin/dedication/:account/approve the name shows to everyone from the next read
// POST /api/admin/dedication/:account/refuse  the light is put out; the account may light again
//
// Both decisions are written to the admin log (R-MODERATION-015) with the reason `dedication`. Planned, not built: a
// reviewer job approving on the makers' behalf through the same route.
import type { DedicationLight } from "@japacity/store";
import { Hono } from "hono";
import type { Context } from "hono";

import type { ServerDeps } from "../../deps";
import { newId } from "../../moderation/decide";
import { DEDICATION_LOG_REASON } from "../../moderation/reports";
import type { ServerRejection } from "../../types";
import { adminOnly, type AdminEnv } from "./admin";
import { forgetSharedLights, type LightYears } from "../dedication";
import { edgeCache, type EdgeCache } from "../cache";

export const DEDICATION_PENDING_PATH = "/api/admin/dedication/pending";

/** R-MODERATION-021: a light as the list shows it. */
export interface PendingLight {
  account: string;
  id: string;
  name: string;
  years: LightYears;
  /** The account's username and region, null when the account row is gone. */
  username: string | null;
  region: string | null;
  litAt: number;
}

async function readNote(c: Context): Promise<string | null> {
  const body: unknown = await c.req.json<unknown>().catch(() => null);
  if (typeof body !== "object" || body === null || !("note" in body)) return null;
  const { note } = body;
  return typeof note === "string" && note.trim() !== "" ? note.trim().slice(0, 500) : null;
}

/** R-MODERATION-015: the decision in the admin log, on the light, naming the account it was taken on. */
async function logDecision(deps: ServerDeps, admin: string, action: "approve-light" | "refuse-light", light: DedicationLight, note: string | null): Promise<string> {
  const entry = { id: newId(deps, "log"), admin, at: deps.now(), item: light.id, action, params: { account: light.account }, reason: DEDICATION_LOG_REASON, ...(note === null ? {} : { note }) };
  const written = await deps.stores.moderationLog.append(entry);
  if (!written.ok) throw new Error(`The log refused an entry: ${written.detail}`);
  return entry.id;
}

const NO_LIGHT = (account: string): ServerRejection => ({ ok: false, code: "unknown-id", detail: `No light for ${account}.` });

export function adminDedicationRoutes(deps: ServerDeps, edge: EdgeCache | null = edgeCache()): Hono<AdminEnv> {
  const routes = new Hono<AdminEnv>();
  routes.use("/api/admin/dedication/*", adminOnly(deps));

  routes.get(DEDICATION_PENDING_PATH, async (c) => {
    const lights: PendingLight[] = [];
    for (const light of await deps.stores.dedication.pending()) {
      const row = await deps.stores.account.get(light.account);
      lights.push({ account: light.account, id: light.id, name: light.name, years: { from: light.from, to: light.to }, username: row?.username ?? null, region: row?.country ?? null, litAt: light.litAt });
    }
    return c.json({ ok: true, lights });
  });

  routes.post("/api/admin/dedication/:account/approve", async (c) => {
    const account = c.req.param("account");
    const approved = await deps.stores.dedication.approve(account, c.get("admin"), deps.now());
    if (!approved.ok) return c.json(NO_LIGHT(account), 404);
    const entry = await logDecision(deps, c.get("admin"), "approve-light", approved.value, await readNote(c));
    await forgetSharedLights(edge, new URL(c.req.url).origin, deps.now());
    return c.json({ ok: true, entry });
  });

  routes.post("/api/admin/dedication/:account/refuse", async (c) => {
    const account = c.req.param("account");
    const light = await deps.stores.dedication.mine(account);
    if (light === null) return c.json(NO_LIGHT(account), 404);
    await deps.stores.dedication.putOut(account);
    const entry = await logDecision(deps, c.get("admin"), "refuse-light", light, await readNote(c));
    await forgetSharedLights(edge, new URL(c.req.url).origin, deps.now());
    return c.json({ ok: true, entry });
  });

  return routes;
}
