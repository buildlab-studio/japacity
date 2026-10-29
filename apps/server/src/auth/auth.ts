// The Better Auth instance (account:sign-in-without-secret, account:email-code-is-short-lived, account:passkey-needs-signed-in-session, account:no-text-message-codes, account:stand-ins-test-sign-in, account:session-is-secure-cookie, account:sign-in-routes-rate-limited). Made from the
// server's dependencies and a database adapter: the memory adapter in tests,
// Drizzle's (drizzle.ts) on the Worker. On Workers it is made inside each request
// (decision 0006, section 1), so the send of an email code can hand its
// promise to that request's `waitUntil`.
// https://better-auth.com/docs/integrations/hono
// https://better-auth.com/docs/plugins/email-otp
// https://better-auth.com/docs/authentication/google
// https://better-auth.com/docs/plugins/passkey
// https://better-auth.com/docs/authentication/email-password
// https://better-auth.com/docs/concepts/rate-limit
// https://better-auth.com/docs/concepts/cookies
// https://better-auth.com/docs/concepts/users-accounts
// https://better-auth.com/docs/concepts/database#database-hooks
// https://better-auth.com/docs/plugins/test-utils
// https://better-auth.com/docs/plugins/anonymous
import { passkey } from "@better-auth/passkey";
import { time } from "@japacity/sim";
import { betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import type { memoryAdapter } from "better-auth/adapters/memory";
import { anonymous, emailOTP, testUtils } from "better-auth/plugins";

import { foldIntoGuest } from "../account/link";
import type { Linking } from "../account/link";
import { admitAccount, admitMethod, admitSession } from "../account/signup";
import type { TurnstileKeys } from "../account/turnstile";
import { requestDeletion } from "../account/deletion";
import type { ServerDeps } from "../dependencies";
import { logFailure } from "../log";
import { emailIdentity, isBanned } from "../moderation/identities";
import { afterAuth, beforeAuth } from "./hooks";
import { signedInWith } from "./session";

/** The memory adapter in tests; Drizzle's adapter has the same shape. */
type Adapter = ReturnType<typeof memoryAdapter>;

/** What an email code's send is given. Its promise is never awaited by the request (account:email-code-is-short-lived). */
export interface OtpMessage {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}

/** account:passkey-needs-signed-in-session: what the account's email is told, by a send the request never awaits. */
export interface AuthNotice {
  email: string;
  kind: "passkey-added";
  at: number;
}

/** The deployment's keys and outside services for sign-in. */
export interface AuthKeys {
  /** Signs the session cookie. At least 32 random characters. */
  secret: string;
  /** The game's own address: `https://japacity.app`, or `https://staging.japacity.app` on staging. The passkeys' relying party is its host (account:passkey-needs-signed-in-session). */
  siteUrl: string;
  google: { clientId: string; clientSecret: string };
  turnstile: TurnstileKeys;
  sendOtp: (message: OtpMessage) => Promise<void>;
  /** account:passkey-needs-signed-in-session: sends a notice to an account's email. */
  sendNotice: (notice: AuthNotice) => Promise<void>;
  /** Keeps a promise alive past the reply: the request's `waitUntil` on Workers. */
  background: (promise: Promise<unknown>) => void;
}

/** account:guest-and-secured-states: the longest a browser keeps a cookie. */
const SESSION_DAYS = 400;

/**
 * account:only-needed-data-kept: a sign-in method's row keeps none of Google's tokens, on its first sign-in or any later one.
 * Nothing in the game calls Google on the player's behalf, and an id token can carry the person's name and photo.
 */
const NO_TOKENS = { idToken: null, accessToken: null, refreshToken: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null };

/** account:session-is-secure-cookie: the session cookie's attributes, whatever the library's defaults become. */
export const COOKIE_ATTRIBUTES = { httpOnly: true, secure: true, sameSite: "lax" } as const;

/**
 * account:passkey-needs-signed-in-session: the passkeys' relying party id, exactly the host of SITE_URL: `japacity.app` in
 * production (the apex, never a subdomain) and `staging.japacity.app` on staging, so a staging passkey
 * never signs in to production. A passkey is bound to this id for good, so a SITE_URL that is not a bare
 * https origin is refused here rather than turned into an id no passkey could follow.
 */
export function relyingPartyOf(siteUrl: string): string {
  const url = new URL(siteUrl);
  if (url.protocol !== "https:") throw new Error(`SITE_URL must be https: ${siteUrl}`);
  if (siteUrl !== url.origin) throw new Error(`SITE_URL must be the bare origin, with no path, query or trailing slash: ${siteUrl}`);
  return url.hostname;
}

/**
 * account:stand-ins-test-sign-in: the test utilities exist only while the test server's config
 * turns them on. They capture no code: the database holds only its hash, so
 * the tests read a code from the stand-in for the send.
 */
function testPlugins(testServer: boolean): BetterAuthPlugin[] {
  return testServer ? [testUtils() as BetterAuthPlugin] : [];
}

/**
 * account:sign-in-without-secret, account:email-code-is-short-lived, moderation:ban-survives-as-hash: the code goes to every address
 * alike, with or without an account, except a banned one, which is mailed nothing. Run off the reply's path, so the reply is the
 * same and as quick for every address: the library looks the user up and stores the code for each alike before it calls this.
 */
async function sendUnlessBanned(deps: ServerDeps, keys: AuthKeys, message: OtpMessage): Promise<void> {
  if (await isBanned(deps, [emailIdentity(message.email)])) return;
  await keys.sendOtp(message);
}

export function makeAuth(deps: ServerDeps, adapter: Adapter, keys: AuthKeys) {
  const { config } = deps;
  const relyingParty = relyingPartyOf(keys.siteUrl);
  const linking: Linking = new Set();
  const plugins = [
    emailOTP({
      otpLength: config.auth.otp.length,
      expiresIn: config.auth.otp.expiresIn,
      allowedAttempts: config.auth.otp.attempts,
      // account:email-code-is-short-lived: the database keeps only a code's hash, so whoever reads it sees no live code.
      storeOTP: "hashed",
      resendStrategy: "rotate",
      // The library hands this promise to `advanced.backgroundTasks` without awaiting it, so the ban's check rides off the reply's path too.
      sendVerificationOTP: (message) => sendUnlessBanned(deps, keys, message),
    }),
    passkey({
      rpID: relyingParty,
      rpName: "Japacity",
      origin: keys.siteUrl,
      registration: { requireSession: true },
      // account:passkey-needs-signed-in-session: a passkey the phone keeps for its own list, so it signs in with no email typed.
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    }),
    // account:guest-and-secured-states, account:guest-secures-the-life: the guest's user is kept on a link; the user the link made is folded into it.
    anonymous({ disableDeleteAnonymousUser: true, generateName: () => "", onLinkAccount: (input) => foldIntoGuest(deps, linking, input) }),
    ...testPlugins(config.testing.captureOtp),
  ];

  return betterAuth({
    appName: "Japacity",
    baseURL: keys.siteUrl,
    basePath: "/api/auth",
    secret: keys.secret,
    database: adapter,
    // server:shared-observability-block: the library's errors become the server's one log line, scrubbed; its warnings and its own
    // printing (which would carry a failed statement's values) are dropped.
    logger: {
      level: "error",
      log: (level, message, ...args: unknown[]) => {
        if (level === "error") logFailure({ what: "auth", error: args.find((arg) => arg instanceof Error) ?? new Error(message) });
      },
    },
    trustedOrigins: [keys.siteUrl],
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: keys.google.clientId,
        clientSecret: keys.google.clientSecret,
        // account:only-needed-data-kept: Google is asked for the id and the email alone, never a scope granted to the game before.
        disableDefaultScope: true,
        scope: ["openid", "email"],
        includeGrantedScopes: false,
        // account:only-needed-data-kept: no name and no photo are kept.
        mapProfileToUser: () => ({ name: "", image: "" }),
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          await requestDeletion(deps, user.id);
        },
      },
    },
    session: {
      // account:guest-and-secured-states: a guest's session is its only way back, so it lasts as long as a browser keeps a cookie (400 days), renewed each day it is used.
      // No config field holds the session's life; the library's default of 7 days would lose a guest that rests a week.
      expiresIn: SESSION_DAYS * time.DAY_S,
      updateAge: time.DAY_S,
      // account:player-deletes-account: deletion needs a session signed in within this many seconds.
      freshAge: Math.floor(config.account.deleteFreshMs / 1000),
      // moderation:admin-view-for-admin-list: how the session was opened (a passkey only when it verified the person), set by the hook below and never by a request.
      additionalFields: { signedInWith: { type: "string", required: false, input: false } },
    },
    databaseHooks: {
      user: { create: { before: (user, endpoint) => admitAccount(deps, endpoint, linking, user) } },
      account: {
        create: {
          before: async (account, endpoint) => {
            await admitMethod(deps, endpoint, linking, account);
            return { data: { ...account, ...NO_TOKENS } };
          },
        },
        update: { before: (account) => Promise.resolve({ data: { ...account, ...NO_TOKENS } }) },
      },
      session: {
        create: {
          before: async (session, context) => {
            await admitSession(deps, context, linking, session);
            return { data: { ...session, signedInWith: signedInWith(context?.path, context?.body) } };
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: config.auth.limits.otpSendPer60s },
        "/sign-in/email-otp": { window: 10, max: 3 },
      },
    },
    hooks: {
      before: beforeAuth(deps),
      after: afterAuth(deps, keys),
    },
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: COOKIE_ATTRIBUTES,
      // server:anonymous-limit-by-address: the library keys its own limits by the same classes as `addressKey`, an IPv6 address
      // by its /64 and one carrying IPv4 as the IPv4. 64 is its default; it is written here so a change of default cannot move it.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"], ipv6Subnet: 64 },
      backgroundTasks: { handler: keys.background },
    },
    telemetry: { enabled: false },
    plugins,
  });
}

export type Auth = ReturnType<typeof makeAuth>;

/** What the account routes are given: the instance and the keys it was made with. */
export interface Accounts {
  auth: Auth;
  keys: AuthKeys;
}
