// Signing in, the age screen's answer and deleting the account, behind one
// seam so the screens never touch the auth library and tests fake it whole.
// Better Auth's client, version 1.7, as its docs describe it (read 8 Oct 2026):
// https://www.better-auth.com/docs/concepts/client
// https://www.better-auth.com/docs/plugins/email-otp
// https://www.better-auth.com/docs/plugins/passkey
// https://www.better-auth.com/docs/authentication/google
// https://www.better-auth.com/docs/plugins/captcha
// https://www.better-auth.com/docs/concepts/users-accounts (deleting a user)
import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

import type { AgeReply, AgeRequest, AgeStatusReply } from "./contract";
import { api, type Fetch } from "./http";

export type AuthFailure = "not-fresh" | "wrong-code" | "expired" | "too-many" | "cancelled" | "unreachable" | "refused";

export type AuthResult = { ok: true } | { ok: false; why: AuthFailure };

export type AgeStanding = "unasked" | "passed" | "refused" | "region-closed";

export interface AccountApi {
  /** R-ACCOUNT-011, R-ACCOUNT-012: where this browser stands before any sign-in method. */
  ageStatus(): Promise<AgeStanding>;
  /** R-ACCOUNT-012: sends the date as typed. The server decides and keeps no date of birth. */
  declareAge(birth: string): Promise<AgeStanding>;
  /** R-ACCOUNT-002. `bot` is the Turnstile token, sent wherever an account could be made (R-ACCOUNT-013). */
  sendCode(email: string, bot: string | null): Promise<AuthResult>;
  signInWithCode(email: string, code: string, bot: string | null): Promise<AuthResult>;
  /** Leaves the page for Google and comes back signed in. */
  signInWithGoogle(bot: string | null): Promise<AuthResult>;
  signInWithPasskey(): Promise<AuthResult>;
  /** R-ACCOUNT-003: only from a signed-in session. */
  addPasskey(): Promise<AuthResult>;
  /** The signed-in account's email, where it has one. */
  email(): Promise<string | null>;
  /** R-ACCOUNT-016: `not-fresh` when the session is too old and the player must sign in again first. */
  deleteAccount(): Promise<AuthResult>;
  signOut(): Promise<void>;
}

/** The header Better Auth's captcha plugin reads the Turnstile token from. */
export const CAPTCHA_HEADER = "x-captcha-response";

interface LibraryError {
  code?: string | undefined;
  status: number;
}

function failure(error: LibraryError): AuthFailure {
  switch (error.code) {
    case "SESSION_NOT_FRESH":
      return "not-fresh";
    case "INVALID_OTP":
      return "wrong-code";
    case "OTP_EXPIRED":
      return "expired";
    case "TOO_MANY_ATTEMPTS":
      return "too-many";
    case "AUTH_CANCELLED":
    case "REGISTRATION_CANCELLED":
      return "cancelled";
    default:
      return error.status === 429 ? "too-many" : "refused";
  }
}

async function attempt(run: () => Promise<{ error: LibraryError | null }>): Promise<AuthResult> {
  try {
    const { error } = await run();
    return error === null ? { ok: true } : { ok: false, why: failure(error) };
  } catch {
    return { ok: false, why: "unreachable" };
  }
}

const botHeaders = (bot: string | null) => (bot === null ? {} : { headers: { [CAPTCHA_HEADER]: bot } });

function standing(reply: AgeStatusReply | AgeReply): AgeStanding {
  if (reply.ok) return reply.age;
  if (reply.code === "region-closed") return "region-closed";
  throw new Error(reply.detail);
}

export function betterAuthApi({ baseUrl, fetch }: { baseUrl: string; fetch?: Fetch }): AccountApi {
  const base = baseUrl.replace(/\/+$/, "");
  const http = api({ baseUrl: base, ...(fetch === undefined ? {} : { fetch }) });
  // the server mounts Better Auth at /api/auth, its default base path.
  const client = createAuthClient({
    baseURL: `${base}/api/auth`,
    fetchOptions: { credentials: "include" },
    plugins: [emailOTPClient(), passkeyClient()],
  });
  const home = () => (typeof location === "undefined" ? "/" : `${location.origin}/`);

  return {
    async ageStatus() {
      return standing(await http.get<AgeStatusReply>("/api/age"));
    },
    async declareAge(birth) {
      const request: AgeRequest = { birth };
      return standing(await http.post<AgeReply>("/api/age", request));
    },
    sendCode: (email, bot) => attempt(() => client.emailOtp.sendVerificationOtp({ email, type: "sign-in", fetchOptions: botHeaders(bot) })),
    signInWithCode: (email, otp, bot) => attempt(() => client.signIn.emailOtp({ email, otp, fetchOptions: botHeaders(bot) })),
    signInWithGoogle: (bot) => attempt(() => client.signIn.social({ provider: "google", callbackURL: home(), fetchOptions: botHeaders(bot) })),
    // A button, not the browser's autofill: autofill needs a field this game does not have.
    signInWithPasskey: () => attempt(() => client.signIn.passkey({ autoFill: false })),
    addPasskey: () => attempt(() => client.passkey.addPasskey({})),
    async email() {
      try {
        const { data } = await client.getSession();
        return data?.user.email ?? null;
      } catch {
        return null;
      }
    },
    deleteAccount: () => attempt(() => client.deleteUser({})),
    async signOut() {
      await attempt(() => client.signOut());
    },
  };
}
