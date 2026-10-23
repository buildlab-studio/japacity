// The age screen and the account (account:sign-up-open-everywhere, account:age-screen-refuses-minors, account:bot-check-on-guest-creation, account:sign-in-routes-rate-limited, account:one-character-per-account, account:player-deletes-account, account:guest-and-secured-states, account:social-needs-secured-account, account:guest-secures-the-life, account:username-and-unconfirmed-email, account:guest-floods-are-capped, account:idle-guests-cleaned-by-hand and account:guest-reminded-to-secure;
// analytics:player-can-stop-usage-counts).
import type { ServerRejection } from "./reply";

/** account:username-and-unconfirmed-email: a username's length, shortest and longest. */
export const USERNAME_SHORTEST = 3;
export const USERNAME_LONGEST = 20;

/** account:username-and-unconfirmed-email: letters, digits and underscore. The reserved and blocked lists stay the server's. */
export const USERNAME = new RegExp(`^[A-Za-z0-9_]{${String(USERNAME_SHORTEST)},${String(USERNAME_LONGEST)}}$`);

/** The body of `POST /api/age`. */
export interface AgeRequest {
  dateOfBirth: string;
}

/** A pass, or `under-age`, `bad-date`, and `switched-off` while sign-ups are off. */
export type AgeReply = { ok: true } | ServerRejection;

/**
 * `GET /api/age` (account:age-screen-refuses-minors): whether this browser was refused at the age screen and must not be asked again, and
 * whether it holds a pass not yet spent nor run out, so a reload or Back before Begin goes on to the door without asking again.
 */
export interface AgeStatus {
  refused: boolean;
  passed: boolean;
}

/** `GET /api/account`: the account as its owner sees it. No age date (account:only-needed-data-kept), no email (the auth library's session holds that). */
export interface AccountView {
  id: string;
  country: string;
  age: { passed: boolean; method: "declared" | "verified" };
  createdAt: number;
  character: string | null;
  /** analytics:player-can-stop-usage-counts: the "Send usage counts" setting. */
  sendUsageCounts: boolean;
  /** moderation:admin-view-for-admin-list: the account is on `config.admin.accounts` and this session has shown a passkey recently, so the client mounts the admin page. */
  admin: boolean;
  /**
   * moderation:admin-view-for-admin-list: present only for an account on the admin list: true while this session has not shown a
   * passkey recently, so `/admin` asks for one. Absent for everyone else.
   */
  adminNeedsPasskey?: boolean;
  /** account:guest-and-secured-states: a guest's life lives only in this browser until it is secured. */
  state: "guest" | "secured";
  /** account:username-and-unconfirmed-email. */
  username: string;
  /** account:username-and-unconfirmed-email: from when the username may change; 0 while the free change is unused. */
  renameFrom: number;
  /**
   * account:guest-reminded-to-secure, account:only-needed-data-kept: the ways back in, read from the auth library's rows and never written
   * here. `google`: the address Google gave where Google is linked; `email`: the address a code goes to; `passkeys`: how
   * many are held. A guest has none. No token, no Google subject.
   */
  ways: { google: string | null; email: string | null; passkeys: number };
}

/** `GET /api/account` and `PUT /api/account` answer the row. */
export type AccountReply = { ok: true; account: AccountView } | ServerRejection;

/** The body of `PUT /api/account` (analytics:player-can-stop-usage-counts). */
export interface AccountChange {
  sendUsageCounts: boolean;
}

/** The body of `POST /api/guest`; the Turnstile token goes in the `x-captcha-response` header (account:bot-check-on-guest-creation). */
export interface GuestRequest {
  username: string;
}

/** The body of `PUT /api/account/username`. */
export interface UsernameRequest {
  username: string;
}

/** account:username-and-unconfirmed-email: why a username was refused; `taken` and `wait` come from the store and the clock. */
export type NameProblem = "format" | "reserved" | "blocked" | "taken" | "wait";

/** `POST /api/guest` and `PUT /api/account/username`: a refused username says why, so the screen can say it plainly. */
export type NameReply = { ok: true; account: AccountView } | (ServerRejection & { name?: NameProblem });

/** account:username-typed-and-checked: the read the username box asks while the player types, the name in the query. */
export const USERNAME_FREE_PATH = "/api/username/available";

/**
 * account:username-typed-and-checked: `GET /api/username/available?name=...`, signed in or out. `free` only for a name that
 * passed the username's own format and word checks; a refused one answers its problem (400) and never `free`. Rate-limited
 * per address, and per session when signed in (`rate-limited`, 429). Taking the name at Begin is the check that counts.
 */
export type UsernameFreeReply = { ok: true; free: boolean } | (ServerRejection & { name?: NameProblem });

/** The body of `DELETE /api/account`; `code` is an email code sent with type `sign-in`, needed once the session is not fresh. */
export interface DeleteRequest {
  code?: string;
}

/** `DELETE /api/account` (account:player-deletes-account): the removal of account:deleted-data-removed-within-month happens by `dueAt`. Its refusals are `not-fresh`, `bad-code` and `signed-out`. */
export type DeleteReply = { ok: true; dueAt: number } | ServerRejection;
