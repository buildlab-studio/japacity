// The switches and dials on the admin page (docs/rules/server.md R-SERVER-030,
// R-SERVER-031), and the gates they work through, mounted together before
// every other route. As on the rest of the admin page, a session whose
// account is not in `config.admin.accounts` finds no route here.
//
// GET  /api/admin/switches       the row: switches and dials
// GET  /api/admin/switches/log   every change, oldest first
// POST /api/admin/switches       { name, on, reason }
// POST /api/admin/dials          { dial, place?, value, reason }; value null unsets
import type { DialChange, SwitchName } from "@japacity/store";
import { isDialValue } from "@japacity/store";
import { Hono } from "hono";

import type { ServerDeps } from "../deps";
import { adminOnly } from "./admin";
import type { AdminEnv } from "./admin";
import { placeTargetFits } from "../switches/dials";
import { switchGates } from "../switches/gate";
import { SWITCH_NAMES, readSwitches, setDial, setSwitch } from "../switches/switches";

/** The longest reason kept in the log. */
const REASON_MAX = 500;

function reasonOf(body: Record<string, unknown>): string | null {
  const reason = typeof body["reason"] === "string" ? body["reason"].trim() : "";
  return reason === "" || reason.length > REASON_MAX ? null : reason;
}

/** The dial change a body asks for, or the reason it cannot be made. */
function dialChangeOf(deps: ServerDeps, body: Record<string, unknown>): DialChange | string {
  const value = body["value"];
  if (value !== null && typeof value !== "number") return "value is a whole number from 0, or null to unset.";
  if (!isDialValue(value)) return "value is a whole number from 0, or null to unset.";
  switch (body["dial"]) {
    case "placeTarget": {
      const place = body["place"];
      if (typeof place !== "string") return "place names a place.";
      if (!placeTargetFits(deps, place, value ?? 0)) return `${place} is not a place, or the target is over its crowd's high.`;
      return { dial: "placeTarget", place, value };
    }
    case "computerAfterMonths":
      return { dial: "computerAfterMonths", value };
    case "topUpTickets":
      return { dial: "topUpTickets", value };
    default:
      return "dial is placeTarget, computerAfterMonths or topUpTickets.";
  }
}

async function bodyOf(request: { json: () => Promise<unknown> }): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

export function switchRoutes(deps: ServerDeps): Hono {
  const app = new Hono();
  app.route("/", switchGates(deps));

  const admin = new Hono<AdminEnv>();
  const guard = adminOnly(deps);

  admin.get("/api/admin/switches", guard, async (c) => c.json({ ok: true, ...(await readSwitches(deps)) }));

  admin.get("/api/admin/switches/log", guard, async (c) => c.json({ ok: true, log: await deps.stores.switches.log() }));

  admin.post("/api/admin/switches", guard, async (c) => {
    const body = await bodyOf(c.req);
    const name = body["name"];
    const reason = reasonOf(body);
    if (typeof name !== "string" || !SWITCH_NAMES.includes(name as SwitchName)) return c.json({ ok: false, detail: `name is one of ${SWITCH_NAMES.join(", ")}.` }, 400);
    if (typeof body["on"] !== "boolean") return c.json({ ok: false, detail: "on is true or false." }, 400);
    if (reason === null) return c.json({ ok: false, detail: `reason is 1 to ${String(REASON_MAX)} characters.` }, 400);
    return c.json({ ok: true, ...(await setSwitch(deps, name as SwitchName, body["on"], c.get("admin"), reason)) });
  });

  admin.post("/api/admin/dials", guard, async (c) => {
    const body = await bodyOf(c.req);
    const change = dialChangeOf(deps, body);
    const reason = reasonOf(body);
    if (typeof change === "string") return c.json({ ok: false, detail: change }, 400);
    if (reason === null) return c.json({ ok: false, detail: `reason is 1 to ${String(REASON_MAX)} characters.` }, 400);
    const row = await setDial(deps, change, c.get("admin"), reason);
    if ("detail" in row) return c.json({ ok: false, detail: row.detail }, 400);
    return c.json({ ok: true, ...row });
  });

  app.route("/", admin);
  return app;
}
