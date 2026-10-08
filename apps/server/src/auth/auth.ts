// The Better Auth instance (R-ACCOUNT-001 to 006, 014). Made from the
// server's dependencies and a database adapter: the memory adapter in tests,
// Drizzle's once packages/db lands. On Workers it is made inside each request
// (decision 0004, section 1), so the send of an email code can hand its
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
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import type { memoryAdapter } from "better-auth/adapters/memory";
import { emailOTP, testUtils } from "better-auth/plugins";

import { admitAccount, admitMethod, admitSession } from "../account/signup";
import type { TurnstileKeys } from "../account/turnstile";
import { requestDeletion } from "../account/deletion";
import type { ServerDeps } from "../deps";
import { emailSendLimit, endSessionsOnUnlink } from "./hooks";

/** The memory adapter in tests; Drizzle's adapter has the same shape. */
type Adapter = ReturnType<typeof memoryAdapter>;

/** What an email code's send is given. Its promise is never awaited by the request (R-ACCOUNT-002). */
export interface OtpMessage {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}

/** The deployment's keys and outside services for sign-in. */
export interface AuthKeys {
  /** Signs the session cookie. At least 32 random characters. */
  secret: string;
  /** The game's own address, e.g. `https://japacity.com`; the passkeys' relying party is its host (R-ACCOUNT-003). */
  siteUrl: string;
  google: { clientId: string; clientSecret: string };
  turnstile: TurnstileKeys;
  sendOtp: (message: OtpMessage) => Promise<void>;
  /** Keeps a promise alive past the reply: the request's `waitUntil` on Workers. */
  background: (promise: Promise<unknown>) => void;
}

/** R-ACCOUNT-006: the session cookie's attributes, whatever the library's defaults become. */
export const COOKIE_ATTRIBUTES = { httpOnly: true, secure: true, sameSite: "lax" } as const;

/** R-ACCOUNT-005: the test utilities exist only while the test server's config turns them on. */
function testPlugins(captureOtp: boolean): BetterAuthPlugin[] {
  return captureOtp ? [testUtils({ captureOTP: true }) as BetterAuthPlugin] : [];
}

export function makeAuth(deps: ServerDeps, adapter: Adapter, keys: AuthKeys) {
  const { config } = deps;
  const host = new URL(keys.siteUrl).hostname;
  const plugins = [
    emailOTP({
      otpLength: config.auth.otp.length,
      expiresIn: config.auth.otp.expiresIn,
      allowedAttempts: config.auth.otp.attempts,
      storeOTP: "plain",
      resendStrategy: "rotate",
      // The library hands this promise to `advanced.backgroundTasks` without awaiting it.
      sendVerificationOTP: (message) => keys.sendOtp(message),
    }),
    passkey({ rpID: host, rpName: "Japacity", origin: keys.siteUrl, registration: { requireSession: true } }),
    ...testPlugins(config.testing.captureOtp),
  ];

  return betterAuth({
    appName: "Japacity",
    baseURL: keys.siteUrl,
    basePath: "/api/auth",
    secret: keys.secret,
    database: adapter,
    trustedOrigins: [keys.siteUrl],
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: keys.google.clientId,
        clientSecret: keys.google.clientSecret,
        // R-ACCOUNT-020: no name and no photo are kept.
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
      // R-ACCOUNT-016: deletion needs a session signed in within this many seconds.
      freshAge: Math.floor(config.account.deleteFreshMs / 1000),
    },
    databaseHooks: {
      user: { create: { before: (user, endpoint) => admitAccount(deps, endpoint, user) } },
      account: {
        create: {
          before: async (account) => {
            await admitMethod(deps, account);
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            await admitSession(deps, session);
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
        "/email-otp/check-verification-otp": { window: 10, max: 3 },
      },
    },
    hooks: {
      before: emailSendLimit(deps),
      after: endSessionsOnUnlink(),
    },
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: COOKIE_ATTRIBUTES,
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
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
