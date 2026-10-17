// R-ACCOUNT-013: the bot check, against Turnstile's verify endpoint.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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

/** R-ACCOUNT-013: the action the widget is rendered with at the guest start, the one surface it guards. */
export const TURNSTILE_ACTION = "guest";

/** Siteverify's documented longest token; a longer one is refused before the call. */
export const TOKEN_MAX_LENGTH = 2048;

/** The only hosts where a pass made with Cloudflare's test keys is taken: the local stack's (server.md R-SERVER-038). */
const LOCAL_SITE_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1"]);

export type BotCheck = { ok: true } | { ok: false; reason: string };

/**
 * A missing, failed, expired or reused token is refused; so is a token longer
 * than Turnstile issues (refused before any call), an unreachable endpoint, a
 * reply that is not JSON, a pass for a token solved on a host other than
 * `host`, the site's own, so a token solved elsewhere with the same key is no
 * pass, and a pass whose action is not
 * `TURNSTILE_ACTION`, so a token made for another page or site is no pass. The one
 * exception: a pass Turnstile marks as made with a test key
 * (`metadata.result_with_testing_key`), whose host is always example.com and
 * which carries no action, on a SITE_URL of this machine.
 */
export async function checkTurnstile(keys: TurnstileKeys, token: string | null, remoteIp: string | null, host: string): Promise<BotCheck> {
  if (token === null || token === "") return { ok: false, reason: "missing-input-response" };
  if (token.length > TOKEN_MAX_LENGTH) return { ok: false, reason: "token-too-long" };
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
  type Answer = { success?: unknown; "error-codes"?: unknown; hostname?: unknown; action?: unknown; metadata?: { result_with_testing_key?: unknown } };
  let body: Answer;
  try {
    // R-ACCOUNT-013: a reply that is not a JSON object fails closed.
    const parsed = await reply.json<unknown>();
    if (typeof parsed !== "object" || parsed === null) return { ok: false, reason: "bad-reply" };
    body = parsed;
  } catch {
    return { ok: false, reason: "bad-reply" };
  }
  if (body.success === true) {
    // R-ACCOUNT-013: a test key's pass always says example.com and names no action, so it stands only on the local stack.
    const testing = body.metadata?.result_with_testing_key === true;
    if (body.hostname !== host && !(testing && LOCAL_SITE_HOSTS.has(host))) return { ok: false, reason: "hostname-mismatch" };
    if (!testing && body.action !== TURNSTILE_ACTION) return { ok: false, reason: "action-mismatch" };
    return { ok: true };
  }
  const codes = Array.isArray(body["error-codes"]) ? body["error-codes"].join(",") : "";
  return { ok: false, reason: codes === "" ? "rejected" : codes };
}
