// The Worker's request and job plumbing (decision 0006), kept apart from
// `index.ts` so the tests run it on Node. One request or one job has one `pg`
// client through the Hyperdrive configuration with caching off, opened when a
// store or the auth library first asks for it (server:one-command-one-transaction) and closed once
// the reply and every background task have settled;
// nothing holds a client between requests.
import { content, text } from "@japacity/content";
import { connectOnFirstUse, pgDayLog } from "@japacity/db";
import type { Connection } from "@japacity/db";

import { makeApp } from "./app";
import { makeAuth } from "./auth/auth";
import type { AuthKeys } from "./auth/auth";
import { drizzleAuthAdapter } from "./auth/drizzle";
import { sessionReader } from "./auth/session";
import { contentsFor, withContentBefore } from "./authority/overlay";
import { deployedConfig, productionConfig } from "./config";
import { webRandomBytes } from "./dependencies";
import type { Env } from "./index";
import { logFailure } from "./log";
import { mailFor } from "./mail/mail";
import type { PushKeys } from "./notify/webpush";
import { isolateFor, openRequest, placeOfIn, profileOfIn } from "./postgres";
import type { Isolate, RequestBounds, RequestScope } from "./postgres";
import { ADMIN_STATEMENT_MS, adminRead } from "./ops/timeout";
import { adminStatsRoutes } from "./routes/admin/stats";
import { drawRoute } from "./routes/lottery";
import { notifyKeyRoute } from "./routes/notify";
import { placeSocketRoutes } from "./routes/place";
import type { FailureBindings } from "./security/fail";

let isolate: Isolate | null = null;

/** server:hidden-values-made-once: what the isolate keeps: the overlay applied once, the secrets, the limits, the switch and counter stores. */
export function isolateOf(env: Env): Isolate {
  isolate ??= isolateFor(
    { connectionString: env.GAME_DB.connectionString, place: env.PLACE },
    {
      config: deployedConfig(env.ADMIN_ACCOUNTS),
      contents: withContentBefore(contentsFor(content, env.OVERLAY), env.OVERLAY),
      secrets: { worldSeed: env.WORLD_SEED, banSalt: env.BAN_SALT, drawTokenKey: env.DRAW_TOKEN_KEY },
      limits: { commands10s: env.COMMANDS_10S, commands60s: env.COMMANDS_60S, reads60s: env.READS_60S, anon60s: env.ANON_60S, socket10s: env.SOCKET_10S },
      text,
      now: () => Date.now(),
      randomBytes: webRandomBytes,
    },
  );
  return isolate;
}

/**
 * The mail transport (account:sign-in-routes-rate-limited, decision 0007): the MAIL binding on a deployment, Mailpit on the
 * local stack (mail.ts). account:passkey-needs-signed-in-session: the notices go by the same way as the codes.
 */
function authKeys(env: Env, waitUntil: (promise: Promise<unknown>) => void): AuthKeys {
  const { sendOtp, sendNotice } = mailFor(env, { text, codeSeconds: productionConfig.auth.otp.expiresIn }, (input, init) => fetch(input, init));
  return {
    secret: env.BETTER_AUTH_SECRET,
    siteUrl: env.SITE_URL,
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    turnstile: { secretKey: env.TURNSTILE_SECRET_KEY },
    sendOtp,
    sendNotice,
    background: waitUntil,
  };
}

/** clock:full-bank-push-notification: the push keys from the bindings, or null while one is missing. */
export function pushKeys(env: Env): PushKeys | null {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = env;
  if (publicKey === undefined || privateKey === undefined || subject === undefined) return null;
  return { publicKey, privateKey, subject, numbers: productionConfig.notify, fetch: (input, init) => fetch(input, init) };
}

/** What a test hands in place of the deployment's: the isolate, and how a request's connection is made. */
export interface Plumbing {
  isolate?: Isolate;
  open?: (url: string) => Promise<Connection>;
}

/** server:one-command-one-transaction: the deployment's connection, which opens its client on the first statement. */
const onFirstUse = (url: string): Promise<Connection> => Promise.resolve(connectOnFirstUse(url));

/**
 * One request's or one job's scope: the client (opened on first use) and the
 * auth library on it. The client is closed once `run` has settled and so has
 * every task the library handed to `waitUntil`, so the reply never waits on the close.
 */
export async function within<T>(
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void,
  run: (scope: RequestScope, auth: ReturnType<typeof makeAuth>, keys: AuthKeys) => Promise<T>,
  plumbing: Plumbing = {},
  bounds: RequestBounds = {},
): Promise<T> {
  const scope = await openRequest(plumbing.isolate ?? isolateOf(env), env.GAME_DB.connectionString, plumbing.open ?? onFirstUse, bounds);
  const tasks: Promise<unknown>[] = [];
  const keep = (promise: Promise<unknown>) => {
    tasks.push(promise);
    waitUntil(promise);
  };
  try {
    const keys = authKeys(env, keep);
    const auth = makeAuth(scope.deps, drizzleAuthAdapter(scope.db), keys);
    scope.setSession(sessionReader(auth, scope.deps));
    return await run(scope, auth, keys);
  } finally {
    waitUntil(
      Promise.allSettled(tasks)
        .then(() => scope.close())
        .catch((error: unknown) => logFailure({ what: "close", error })),
    );
  }
}

/**
 * The game's answer to one request under `/api/*`: the app with every route, over the request's scope. An admin
 * read runs every statement under the admin's statement timeout (server:ledger-alarm-lists-suspects).
 */
export function gameReply(request: Request, env: Env, waitUntil: (promise: Promise<unknown>) => void, plumbing: Plumbing = {}): Promise<Response> {
  return within(
    env,
    waitUntil,
    async ({ deps, handle, unavailable }, auth, keys) => {
      const rooms = (plumbing.isolate ?? isolateOf(env)).rooms;
      const app = makeApp(deps, { auth, keys })
        // analytics:admin-stats-for-admins-only: the admin's numbers read the command log by its time.
        .route("/api/admin", adminStatsRoutes(deps, pgDayLog(handle)))
        .route("/", drawRoute(deps))
        .route("/", notifyKeyRoute(pushKeys(env)))
        .route("/", placeSocketRoutes(deps, { rooms, placeOf: placeOfIn(deps), profileOf: profileOfIn(deps) }));
      // server:no-platform-error-page: `onError` asks the request's connection whether the database answered (security/fail.ts).
      const bindings: FailureBindings = { databaseUnavailable: unavailable };
      return app.fetch(request, bindings);
    },
    plumbing,
    adminRead(request) ? { statementMs: ADMIN_STATEMENT_MS } : {},
  );
}
