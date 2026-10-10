// The account's own row (`GET /api/account`) and its settings
// (`PUT /api/account`), read once per server and shared by the screens that
// need a field of it: the advert slots' region and the usage-counts setting.
import type { AccountReply, AccountSettingsRequest, ServerRejection } from "./contract";
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
 * R-ANALYTICS-006: changes "Send usage counts" on the account.
 * `PUT /api/account { sendUsageCounts }` is the production wiring's; it answers the row.
 */
export async function putUsageCounts(server: Api, on: boolean): Promise<AccountReply> {
  const request: AccountSettingsRequest = { sendUsageCounts: on };
  const reply = await server.put<AccountReply>("/api/account", request).catch(() => unreachable);
  if (reply.ok) held.set(server, Promise.resolve(reply));
  return reply;
}

/** The region the account was made in, the advert slots' key (R-ADVERT-008); `default` when unknown. */
export async function regionOf(server: Api): Promise<string> {
  const reply = await readAccount(server);
  return reply.ok && reply.account.country !== "" ? reply.account.country : "default";
}
