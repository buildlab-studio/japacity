// The server's config: every number the rule pages put "in config as", the
// region table and the test switches. The production values are the pages'
// defaults; a test proves the production config holds no test switch
// (R-ACCOUNT-005, R-CLOCK-009). This file is kept by hand.; a kind that needs
// a field says so in its report.
import { time } from "@japacity/sim";

import type { Regions } from "./region";

export interface ServerConfig {
  /** server.md Numbers. */
  server: { snapshotEvery: number; seedBits: number };
  /** R-SERVER-025 to 027. */
  limits: { commandsPer10s: number; commandsPer60s: number; readsPer60s: number; anonPer60s: number; socketPer10s: number };
  /** R-CLOCK-001 to 006, 019. `epoch` is a Friday at 18:00 UTC (R-CLOCK-002); the maintainer picks which. */
  clock: { epoch: number; worldTickMs: number; turnRefillMs: number; worldFetchSpreadMs: number };
  /** R-CLOCK-026, 028, 029. */
  presence: { maxPerObject: number; sample: number; nudgeEveryMs: number; attachmentBytes: number };
  /** account.md Numbers. */
  account: { minAge: number; refusedCookieDays: number; deleteFreshMs: number; deleteWithinDays: number; maxCharacters: number };
  auth: { otp: { length: number; expiresIn: number; attempts: number }; limits: { otpSendPer60s: number } };
  /** R-ACCOUNT-007: the policy table. */
  regions: Regions;
  /** R-SERVER-012: the accounts that may read the admin page. Empty in production until the maintainer adds one. */
  admin: { accounts: string[] };
  /**
   * R-ACCOUNT-005, R-CLOCK-009: the stand-ins that exist only in the test
   * server's config. Every one is false in production.
   */
  testing: { fastClock: boolean; captureOtp: boolean; stubGoogle: boolean; virtualPasskeys: boolean; testLogin: boolean };
}

const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];

const DECLARED = "declared" as const;

/** The policy table of account.md, row for row. */
export const launchRegions: Regions = {
  default: { open: true, interaction: "matched", ageCheck: DECLARED },
  unknown: { open: true, interaction: "invited", ageCheck: DECLARED },
  NG: { open: true, interaction: "matched", ageCheck: DECLARED },
  US: { open: true, interaction: "matched", ageCheck: DECLARED },
  CA: { open: true, interaction: "matched", ageCheck: DECLARED },
  GB: { open: true, interaction: "invited", ageCheck: DECLARED },
  AU: { open: false, interaction: "none", ageCheck: DECLARED },
  ...Object.fromEntries(EU.map((code) => [code, { open: true, interaction: "none", ageCheck: DECLARED }])),
};

/** Friday 9 October 2026 at 18:00 UTC, the default epoch until the maintainer picks the Friday after the first deploy (R-CLOCK-002). */
export const DEFAULT_EPOCH = Date.UTC(2026, 9, 9, 18, 0, 0);

export const productionConfig: ServerConfig = {
  server: { snapshotEvery: 20, seedBits: 128 },
  limits: { commandsPer10s: 10, commandsPer60s: 60, readsPer60s: 120, anonPer60s: 60, socketPer10s: 10 },
  clock: { epoch: DEFAULT_EPOCH, worldTickMs: time.WORLD_TICK_MS, turnRefillMs: time.TURN_REFILL_MS, worldFetchSpreadMs: 60 * time.SECOND_MS },
  presence: { maxPerObject: 2000, sample: 20, nudgeEveryMs: 10 * time.SECOND_MS, attachmentBytes: 1024 },
  account: { minAge: 18, refusedCookieDays: 30, deleteFreshMs: 10 * time.MINUTE_MS, deleteWithinDays: 30, maxCharacters: 1 },
  auth: { otp: { length: 6, expiresIn: 300, attempts: 3 }, limits: { otpSendPer60s: 3 } },
  regions: launchRegions,
  admin: { accounts: [] },
  testing: { fastClock: false, captureOtp: false, stubGoogle: false, virtualPasskeys: false, testLogin: false },
};

type Deep<T> = { [K in keyof T]?: T[K] extends object ? Deep<T[K]> : T[K] };

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
    regions: { ...productionConfig.regions, ...(over.regions as Partial<Regions>) } as Regions,
    admin: { accounts: [...(over.admin?.accounts ?? productionConfig.admin.accounts)] },
    testing: { ...productionConfig.testing, ...over.testing },
  };
}
