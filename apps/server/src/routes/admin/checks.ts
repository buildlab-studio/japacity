// `GET /api/admin/checks` and `POST /api/admin/checks/:check/handle` (admin:checks-have-three-states,
// admin:check-handled-with-reason). As with the other admin routes, to anyone not in `config.admin.accounts` they do not exist.
import type { CheckName } from "@japacity/api";
import { CHECK_NAMES } from "@japacity/api";
import { Hono } from "hono";

import type { ServerDeps } from "../../dependencies";
import type { CheckPorts } from "../../ops/checks";
import { handleCheck, listChecks } from "../../ops/checks";
import { adminOnly } from "./admin";
import type { AdminEnv } from "./admin";

const REASON_MAX = 500;

function reasonOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const reason = (body as { reason?: unknown }).reason;
  if (typeof reason !== "string") return null;
  const trimmed = reason.trim();
  return trimmed === "" || trimmed.length > REASON_MAX ? null : trimmed;
}

export function adminCheckRoutes(deps: ServerDeps, ports: CheckPorts): Hono<AdminEnv> {
  const admin = new Hono<AdminEnv>();

  admin.use("/checks", adminOnly(deps));
  admin.use("/checks/*", adminOnly(deps));

  admin.get("/checks", async (c) => c.json({ ok: true, checks: await listChecks(deps, ports) }));

  admin.post("/checks/:check/handle", async (c) => {
    const check = c.req.param("check");
    if (!CHECK_NAMES.includes(check as CheckName)) return c.json({ ok: false, detail: `check is one of ${CHECK_NAMES.join(", ")}.` }, 400);
    const reason = reasonOf(await c.req.json().catch(() => null));
    if (reason === null) return c.json({ ok: false, detail: `reason is 1 to ${String(REASON_MAX)} characters.` }, 400);
    const handled = await handleCheck(deps, ports, check as CheckName, c.get("admin"), reason);
    if (!handled.ok) return c.json(handled, 409);
    return c.json({ ok: true, checks: [handled.check] });
  });

  return admin;
}
