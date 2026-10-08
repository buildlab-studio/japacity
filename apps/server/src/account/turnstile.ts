// R-ACCOUNT-013: the bot check, against Turnstile's verify endpoint.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's published test secrets: one always passes, one always fails, one answers "already spent". */
export const TURNSTILE_TEST = {
  passSecret: "1x0000000000000000000000000000000AA",
  failSecret: "2x0000000000000000000000000000000AA",
  spentSecret: "3x0000000000000000000000000000000AA",
  passSiteKey: "1x00000000000000000000AA",
  dummyToken: "XXXX.DUMMY.TOKEN.XXXX",
} as const;

export interface TurnstileKeys {
  secretKey: string;
  /** Tests point these at a stand-in; production leaves them unset. */
  siteVerifyUrl?: string;
  fetch?: typeof fetch;
}

export type BotCheck = { ok: true } | { ok: false; reason: string };

/** A missing, failed, expired or reused token is refused; so is an unreachable endpoint. */
export async function checkTurnstile(keys: TurnstileKeys, token: string | null, remoteIp: string | null): Promise<BotCheck> {
  if (token === null || token === "") return { ok: false, reason: "missing-input-response" };
  let reply: Response;
  try {
    reply = await (keys.fetch ?? fetch)(keys.siteVerifyUrl ?? SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: keys.secretKey, response: token, ...(remoteIp === null ? {} : { remoteip: remoteIp }) }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!reply.ok) return { ok: false, reason: `status-${reply.status}` };
  const body = await reply.json<{ success?: unknown; "error-codes"?: unknown }>();
  if (body.success === true) return { ok: true };
  const codes = Array.isArray(body["error-codes"]) ? body["error-codes"].join(",") : "";
  return { ok: false, reason: codes === "" ? "rejected" : codes };
}
