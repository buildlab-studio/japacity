// The dedication's lights (server:dedication-routes; account:name-a-light-for-yours; moderation:dedication-lights-await-approval):
// one light per account, its name and years, when it was lit, and whether the game's makers have approved its name.
// `id` is opaque and never the account's id, so a list of lights never names an account. No store reads a clock.
import type { StoreResult } from "./types";

/** One light as stored. */
export interface DedicationLight {
  /** The account that lit it: one light per account. */
  account: string;
  /** Opaque, never the account id: what a list of lights shows of it. */
  id: string;
  name: string;
  from: number | null;
  to: number | null;
  litAt: number;
  /** moderation:dedication-lights-await-approval: when the name was approved, null while it awaits a look. */
  approvedAt: number | null;
  /** The admin who approved it. */
  approvedBy: string | null;
}

/** A light as it is lit: everything but its approval, which a new light never has. */
export type NewDedicationLight = Omit<DedicationLight, "approvedAt" | "approvedBy">;

/** server:dedication-routes: the whole number of lights and the first `most` of them in the order the page draws them. */
export interface DedicationShared {
  count: number;
  lights: DedicationLight[];
}

export interface DedicationStore {
  /** account:name-a-light-for-yours: lights the account's light, in place of any before it, which clears its approval. */
  light: (light: NewDedicationLight) => Promise<DedicationLight>;
  /** "Put it out", or a refusal (moderation:dedication-lights-await-approval): the account's light goes. True when there was one. */
  putOut: (account: string) => Promise<boolean>;
  /** The account's own light, or null. */
  mine: (account: string) => Promise<DedicationLight | null>;
  /**
   * server:dedication-routes: the count of every light and at most `most` of them: the approved first, newest lit first, then the
   * rest, newest lit first; an even tie by id.
   */
  shared: (most: number) => Promise<DedicationShared>;
  /** moderation:dedication-lights-await-approval: the lights whose names await a look, oldest lit first. */
  pending: () => Promise<DedicationLight[]>;
  /** moderation:dedication-lights-await-approval: sets the approval. Refused with `missing` when the account has no light. */
  approve: (account: string, by: string, at: number) => Promise<StoreResult<DedicationLight>>;
}

/** server:dedication-routes: the order the lights are listed in: the approved first, then newest lit first, then by id. */
export function sharedOrder(a: DedicationLight, b: DedicationLight): number {
  const approved = Number(b.approvedAt !== null) - Number(a.approvedAt !== null);
  if (approved !== 0) return approved;
  if (a.litAt !== b.litAt) return b.litAt - a.litAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
