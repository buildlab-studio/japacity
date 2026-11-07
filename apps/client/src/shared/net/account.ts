// The account's own row (`GET /api/account`) and its settings
// (`PUT /api/account`), read once per server and shared by the screens that
// need a field of it: the advert slots' region and the usage-counts setting.
import type { AccountChange, AccountReply, ServerRejection } from "@japacity/api";

import type { Api } from "./http";

const held = new WeakMap<Api, Promise<AccountReply>>();

/** A failed fetch is a refusal like any other. */
const unreachable: ServerRejection = { ok: false, code: "not-legal", detail: "The server could not be reached." };

/** The row, fetched once for this server; a refusal is fetched again next time. */
export function readAccount(server: Api): Promise<AccountReply> {
  const kept = held.get(server);
  if (kept !== undefined) return kept;
  const reading = server.get<AccountReply>("/api/account").catch(() => unreachable);
  held.set(server, reading);
  void reading.then((reply) => {
    if (!reply.ok) held.delete(server);
  });
  return reading;
}

/** The row is read again next time: the account changed (a guest started, secured, renamed). */
export function forgetAccount(server: Api): void {
  held.delete(server);
}

/**
 * analytics:player-can-stop-usage-counts: changes "Send usage counts" on the account.
 * The server's `PUT /api/account { sendUsageCounts }` answers with the account's row.
 */
export async function putUsageCounts(server: Api, on: boolean): Promise<AccountReply> {
  const request: AccountChange = { sendUsageCounts: on };
  const reply = await server.put<AccountReply>("/api/account", request).catch(() => unreachable);
  if (reply.ok) held.set(server, Promise.resolve(reply));
  return reply;
}

/**
 * The region the account was made in, the advert slots' key (advert:campaign-chosen-without-player-data); `default` when the
 * account names no country, and null when the read was refused, so a refusal never stands for another region.
 */
export async function regionOf(server: Api): Promise<string | null> {
  const reply = await readAccount(server);
  if (!reply.ok) return null;
  return reply.account.country !== "" ? reply.account.country : "default";
}
