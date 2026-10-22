// The bank-full notice's routes (clock:full-bank-push-notification): the
// setting, and the devices that agreed. `GET /api/notify/key` gives the
// deployment's public key and is mounted with the keys in index.ts.
// https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
import type { NotifyKeyReply, NotifyReply, ServerRejection } from "@japacity/api";
import { Hono } from "hono";

import type { ServerDeps } from "../dependencies";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import { readDevice, readEndpoint } from "../notify/device";
import { stopNotices } from "../notify/notice";
import type { PushKeys } from "../notify/webpush";
import { bodyOf, rejection } from "./reply";

const signedOut: ServerRejection = { ok: false, code: "signed-out", detail: "Sign in first." };

export function notifyRoutes(deps: ServerDeps): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();

  async function reply(account: string): Promise<NotifyReply | null> {
    const row = await deps.stores.account.get(account);
    return row === null ? null : { ok: true, on: row.notifyBankFull, reaskDays: deps.config.notify.reaskDays };
  }

  route.get("/api/notify", limit(deps, "reads"), async (c) => {
    const session = sessionOf(c);
    const answer = session === null ? null : await reply(session.account);
    return answer === null ? c.json<NotifyReply>(signedOut, 401) : c.json<NotifyReply>(answer);
  });

  route.put("/api/notify", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    if (session === null || (await deps.stores.account.get(session.account)) === null) return c.json<NotifyReply>(signedOut, 401);
    const { on } = await bodyOf(c.req.raw);
    if (typeof on !== "boolean") return c.json<NotifyReply>(rejection("not-legal", "The setting is on or off."), 400);
    if (on) await deps.stores.account.setNotify(session.account, true);
    else await stopNotices(deps, session.account);
    return c.json<NotifyReply>((await reply(session.account)) ?? signedOut);
  });

  route.post("/api/notify/subscribe", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    if (session === null || (await deps.stores.account.get(session.account)) === null) return c.json<NotifyReply>(signedOut, 401);
    const device = readDevice((await bodyOf(c.req.raw)).subscription);
    if (device === null) return c.json<NotifyReply>(rejection("not-legal", "The subscription is not one a browser gives."), 400);
    const held = await deps.stores.push.forAccount(session.account);
    // At most `config.notify.maxDevices`, so one account cannot point the job at a crowd of addresses.
    const { maxDevices } = deps.config.notify;
    if (!held.some((each) => each.endpoint === device.endpoint) && held.length >= maxDevices) {
      return c.json<NotifyReply>(rejection("not-legal", `At most ${String(maxDevices)} devices take the notice.`), 400);
    }
    await deps.stores.push.subscribe(session.account, device);
    await deps.stores.account.setNotify(session.account, true);
    return c.json<NotifyReply>((await reply(session.account)) ?? signedOut);
  });

  route.delete("/api/notify/subscribe", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    if (session === null || (await deps.stores.account.get(session.account)) === null) return c.json<NotifyReply>(signedOut, 401);
    const endpoint = readEndpoint((await bodyOf(c.req.raw)).endpoint);
    if (endpoint === null) return c.json<NotifyReply>(rejection("not-legal", "The endpoint is not a push service's address."), 400);
    await deps.stores.push.unsubscribe(session.account, endpoint);
    return c.json<NotifyReply>((await reply(session.account)) ?? signedOut);
  });

  return route;
}

/** clock:full-bank-push-notification: the public key a browser subscribes with, or null while the deployment has none. Needs no session. */
export function notifyKeyRoute(keys: PushKeys | null): Hono {
  const route = new Hono();
  route.get("/api/notify/key", (c) => c.json<NotifyKeyReply>({ ok: true, key: keys?.publicKey ?? null }));
  return route;
}
