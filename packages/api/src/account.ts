// The age screen and the account (account.md R-ACCOUNT-011 to 016, 021 to 027;
// analytics.md R-ANALYTICS-006).
import type { ServerRejection } from "./reply";

/** The body of `POST /api/age`. */
export interface AgeRequest {
  dateOfBirth: string;
}

/** A pass, or `under-age`, `bad-date`, and `switched-off` while sign-ups are off. */
export type AgeReply = { ok: true } | ServerRejection;

/** `GET /api/age`: whether this browser was refused at the age screen and must not be asked again (R-ACCOUNT-012). */
export interface AgeStatus {
  refused: boolean;
}

/** `GET /api/account`: the account as its owner sees it. No age date (R-ACCOUNT-020), no email (the auth library's session holds that). */
export interface AccountView {
  id: string;
  country: string;
  age: { passed: boolean; method: "declared" | "verified" };
  createdAt: number;
  character: string | null;
  /** R-ANALYTICS-006: the "Send usage counts" setting. */
  sendUsageCounts: boolean;
  /** R-MODERATION-012: the account is on `config.admin.accounts` and this session was opened with a passkey, so the client mounts the admin page. */
  admin: boolean;
  /** R-ACCOUNT-021: a guest's life lives only in this browser until it is secured. */
  state: "guest" | "secured";
  /** R-ACCOUNT-024. */
  username: string;
  /** R-ACCOUNT-024: from when the username may change; 0 while the free change is unused. */
  renameFrom: number;
  /**
   * R-ACCOUNT-027, R-ACCOUNT-020: the ways back in, read from the auth library's rows and never written
   * here. `google`: the address Google gave where Google is linked; `email`: the address a code goes to; `passkeys`: how
   * many are held. A guest has none. No token, no Google subject.
   */
  ways: { google: string | null; email: string | null; passkeys: number };
}

/** `GET /api/account` and `PUT /api/account` answer the row. */
export type AccountReply = { ok: true; account: AccountView } | ServerRejection;

/** The body of `PUT /api/account` (R-ANALYTICS-006). */
export interface AccountChange {
  sendUsageCounts: boolean;
}

/** The body of `POST /api/guest`; the Turnstile token goes in the `x-captcha-response` header (R-ACCOUNT-013). */
export interface GuestRequest {
  username: string;
}

/** The body of `PUT /api/account/username`. */
export interface UsernameRequest {
  username: string;
}

/** R-ACCOUNT-024: why a username was refused; `taken` and `wait` come from the store and the clock. */
export type NameProblem = "format" | "reserved" | "blocked" | "taken" | "wait";

/** `POST /api/guest` and `PUT /api/account/username`: a refused username says why, so the screen can say it plainly. */
export type NameReply = { ok: true; account: AccountView } | (ServerRejection & { name?: NameProblem });

/** The body of `DELETE /api/account`; `code` is an email code sent with type `sign-in`, needed once the session is not fresh. */
export interface DeleteRequest {
  code?: string;
}

/** `DELETE /api/account` (R-ACCOUNT-016): the removal of R-ACCOUNT-017 happens by `dueAt`. Its refusals are `not-fresh`, `bad-code` and `signed-out`. */
export type DeleteReply = { ok: true; dueAt: number } | ServerRejection;
