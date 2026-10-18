// The server's config: every number the rule pages put "in config as" and
// the test switches. The production values are the pages'
// defaults; a test proves the production config holds no test switch
// (account:stand-ins-test-sign-in, clock:production-has-no-fast-clock).
import { FEEDBACK_MAX_CHARS } from "@japacity/api";
import { time } from "@japacity/sim";

export interface ServerConfig {
  /** server.md Numbers. */
  server: { snapshotEvery: number; seedBits: number };
  /** server:per-account-rate-limits, server:anonymous-limit-by-address and server:noisy-socket-closed; the body sizes server:body-size-limits, the command size server:command-size-limit, the preset's steps server:server-plays-prologue-preset. */
  limits: {
    commandsPer10s: number;
    commandsPer60s: number;
    readsPer60s: number;
    anonPer60s: number;
    socketPer10s: number;
    bodyBytes: number;
    adminBodyBytes: number;
    commandBytes: number;
    /** server:server-plays-prologue-preset: the most prologue steps one preset request plays. */
    presetSteps: number;
  };
  /** clock:server-owns-the-clock, clock:world-tick-length-and-epoch, clock:reply-carries-the-clock, clock:turns-earned-from-refill-time, clock:earned-turns-granted-first, clock:full-bank-earns-nothing, clock:world-fetch-is-jittered. `epoch` is a Friday at 18:00 UTC (clock:world-tick-length-and-epoch). */
  clock: { epoch: number; worldTickMs: number; turnRefillMs: number; worldFetchSpreadMs: number };
  /** clock:attachments-rebuild-presence, clock:presence-is-a-sample, clock:busy-place-splits-rooms. */
  presence: { maxPerObject: number; sample: number; nudgeEveryMs: number; attachmentBytes: number; todayMax: number };
  /** account.md Numbers. */
  account: {
    minAge: number;
    refusedCookieDays: number;
    deleteFreshMs: number;
    deleteWithinDays: number;
    maxCharacters: number;
    /** account:username-and-unconfirmed-email: days between username changes after the free one. */
    renameDays: number;
    /** account:guest-floods-are-capped: new guest lives from one device cookie, and from one connection, in `guestWindowHours`. */
    guestsPerDevice: number;
    guestsPerConnection: number;
    guestWindowHours: number;
    /** account:idle-guests-cleaned-by-hand: the clean-up tool's working number of days without play. */
    guestIdleDays: number;
  };
  /** account:email-code-is-short-lived, account:sign-in-routes-rate-limited. */
  auth: { otp: { length: number; expiresIn: number; attempts: number }; limits: { otpSendPer60s: number; otpSendPerDay: number } };
  /**
   * server:ledger-alarm-lists-suspects: the accounts that may read the admin page. Empty here; a deployment fills it from its
   * Worker secret ADMIN_ACCOUNTS (`deployedConfig`), so no account id is ever written in a committed file.
   * moderation:admin-view-for-admin-list: `passkeyMs`, how long after a user-verified passkey the session counts as having shown one.
   */
  admin: { accounts: string[]; passkeyMs: number };
  /** lottery.md Numbers: the secret's size and the public beacon (lottery:fingerprint-commits-secret). */
  lottery: { secretBits: number; beacon: { genesis: number; period: number; url: string } };
  /** server:private-settings-and-dials, server:four-off-switches and server:signups-off-shows-full: how long a switch is cached per isolate and how long the full screen asks a player to wait. */
  switches: { cacheMs: number; retryMs: number };
  /** moderation:feedback-box-in-settings. */
  feedback: { maxChars: number; perDay: number; keepDays: number };
  /** city:boards-switch-when-and-who, city:board-line-and-ranking. */
  board: { size: number };
  /** clock:full-bank-push-notification and the notify numbers: days before the bank-full notice is asked for again, a push's time to live, devices per account, a token's life. */
  notify: { reaskDays: number; pushTtlDays: number; maxDevices: number; tokenHours: number };
  /** moderation.md Numbers: reports a player may file a day, the longest hold, the decision target, how long decisions are kept. */
  moderation: { reportsPerDay: number; holdDays: number; decideHours: number; logYears: number };
  /**
   * advert:advertiser-records-stored: impressions and taps one account may add to a slot's totals in a UTC day. advert:campaign-chosen-without-player-data, advert:advertisers-get-daily-counts-only:
   * the regions a campaign may name, each a country's code, and `default` for any country not listed.
   */
  advert: { countsPerAccountDay: { impressions: number; taps: number }; regions: string[] };
  /**
   * account:stand-ins-test-sign-in, clock:production-has-no-fast-clock: the stand-ins that exist only in the test
   * server's config. Every one is false in production.
   */
  testing: { fastClock: boolean; captureOtp: boolean; stubGoogle: boolean; virtualPasskeys: boolean; testLogin: boolean };
}

const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];

/** A kibibyte, so the sizes read as they are meant. */
const KIB = 1024;

/** Friday 9 October 2026 at 18:00 UTC, the epoch every deployment runs on (clock:world-tick-length-and-epoch). */
export const DEFAULT_EPOCH = Date.UTC(2026, 9, 9, 18, 0, 0);

export const productionConfig: ServerConfig = {
  server: { snapshotEvery: 20, seedBits: 128 },
  limits: {
    commandsPer10s: 10,
    commandsPer60s: 60,
    readsPer60s: 120,
    anonPer60s: 60,
    socketPer10s: 10,
    // server:body-size-limits: a player's body is a few hundred bytes, the counters' batch at most 16 KB, a beacon at most 64 KiB.
    bodyBytes: 64 * KIB,
    // server:body-size-limits: an advert image is uploaded as base64, at most 200 KB before encoding (advert:one-labelled-still-image).
    adminBodyBytes: KIB * KIB,
    // server:command-size-limit: the largest command, a month's slots, is a few hundred bytes of JSON.
    commandBytes: 4 * KIB,
    // server:server-plays-prologue-preset: the longest preset is seventeen answers (counted over every tile, home and age).
    presetSteps: 20,
  },
  clock: { epoch: DEFAULT_EPOCH, worldTickMs: time.WORLD_TICK_MS, turnRefillMs: time.TURN_REFILL_MS, worldFetchSpreadMs: 60 * time.SECOND_MS },
  presence: { maxPerObject: 2000, sample: 20, nudgeEveryMs: 10 * time.SECOND_MS, attachmentBytes: 1024, todayMax: 20 },
  // renameDays, guestsPerDevice, guestsPerConnection and guestWindowHours are working values; account.md names the settings without numbers.
  account: { minAge: 18, refusedCookieDays: 30, deleteFreshMs: 10 * time.MINUTE_MS, deleteWithinDays: 30, maxCharacters: 1, renameDays: 30, guestsPerDevice: 3, guestsPerConnection: 30, guestWindowHours: 24, guestIdleDays: 90 },
  auth: { otp: { length: 6, expiresIn: 300, attempts: 3 }, limits: { otpSendPer60s: 3, otpSendPerDay: 10 } },
  // moderation:admin-view-for-admin-list: the 15 minutes NIST SP 800-63B-4 allows an AAL3 session without activity, counted here from the passkey itself.
  admin: { accounts: [], passkeyMs: 15 * time.MINUTE_MS },
  lottery: { secretBits: 256, beacon: { genesis: 1692803367, period: 3, url: "https://api.drand.sh" } },
  switches: { cacheMs: 30 * time.SECOND_MS, retryMs: 30 * time.SECOND_MS },
  feedback: { maxChars: FEEDBACK_MAX_CHARS, perDay: 5, keepDays: 180 },
  board: { size: 50 },
  notify: { reaskDays: 14, pushTtlDays: 1, maxDevices: 10, tokenHours: 12 },
  moderation: { reportsPerDay: 20, holdDays: 90, decideHours: 24, logYears: 3 },
  advert: { countsPerAccountDay: { impressions: 200, taps: 20 }, regions: ["default", "NG", "US", "CA", "GB", "AU", ...EU] },
  testing: { fastClock: false, captureOtp: false, stubGoogle: false, virtualPasskeys: false, testLogin: false },
};

/**
 * server:ledger-alarm-lists-suspects: the Worker secret ADMIN_ACCOUNTS read as account ids: comma-separated, each
 * trimmed, empty pieces and repeats dropped. Unset or empty, there is no admin account.
 */
export function adminAccountsFrom(value: string | undefined): string[] {
  const ids = (value ?? "").split(",").map((id) => id.trim()).filter((id) => id !== "");
  return [...new Set(ids)];
}

/** server:ledger-alarm-lists-suspects: the config a deployment runs: production's, with the admin accounts from its ADMIN_ACCOUNTS secret. */
export function deployedConfig(adminAccounts: string | undefined): ServerConfig {
  return { ...productionConfig, admin: { ...productionConfig.admin, accounts: adminAccountsFrom(adminAccounts) } };
}

type Deep<T> = { [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? Deep<T[K]> : T[K] };

/** The test server's config: production with the switches a test names. */
export function testConfig(over: Deep<ServerConfig> = {}): ServerConfig {
  return {
    server: { ...productionConfig.server, ...over.server },
    limits: { ...productionConfig.limits, ...over.limits },
    clock: { ...productionConfig.clock, ...over.clock },
    presence: { ...productionConfig.presence, ...over.presence },
    account: { ...productionConfig.account, ...over.account },
    auth: {
      otp: { ...productionConfig.auth.otp, ...over.auth?.otp },
      limits: { ...productionConfig.auth.limits, ...over.auth?.limits },
    },
    admin: { accounts: [...(over.admin?.accounts ?? productionConfig.admin.accounts)], passkeyMs: over.admin?.passkeyMs ?? productionConfig.admin.passkeyMs },
    lottery: { secretBits: over.lottery?.secretBits ?? productionConfig.lottery.secretBits, beacon: { ...productionConfig.lottery.beacon, ...over.lottery?.beacon } },
    switches: { ...productionConfig.switches, ...over.switches },
    feedback: { ...productionConfig.feedback, ...over.feedback },
    board: { ...productionConfig.board, ...over.board },
    notify: { ...productionConfig.notify, ...over.notify },
    moderation: { ...productionConfig.moderation, ...over.moderation },
    advert: { countsPerAccountDay: { ...productionConfig.advert.countsPerAccountDay, ...over.advert?.countsPerAccountDay }, regions: [...(over.advert?.regions ?? productionConfig.advert.regions)] },
    testing: { ...productionConfig.testing, ...over.testing },
  };
}
