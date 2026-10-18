// What each home on the door takes, charges and leaves (prologue:front-door-three-screens, prologue:printed-page-hands-over): the figures the row Where you
// live shows and the page after Begin repeats, from the home step's own answers in content. Kept apart from the screens
// so the door and the page after Begin read the same sums.
import { content } from "@japacity/content";
import { int } from "@japacity/sim";

import { yearsWorked } from "../datapage/age";
import type { DoorDraft } from "../datapage/door";
import { type Archetype, type Home, homeOf, homesFor, savingsOf } from "./archetypes";

/**
 * What a home takes and charges, from the home step's own answer in content (prologue:front-door-three-screens): `now`, what moving in
 * takes at once (the room's year and fees); `monthly`, its living costs a month; `rentYear`, a year's rent paid upfront.
 */
export function homeFigures(home: Home): { now: number; monthly: number; rentYear: number | null } {
  const effects = content.prologue["home"]?.answers.find((answer) => answer.id === home)?.effects ?? [];
  let now = 0;
  let monthly = 0;
  let rentYear: number | null = null;
  for (const effect of effects) {
    if (effect.type === "money/take" && effect.currency === "NGN" && typeof effect.amount === "number") now += effect.amount;
    if (effect.type !== "obligation/open" || typeof effect.amount !== "number") continue;
    const type = content.obligation[effect.obligation]?.type;
    if (type === "upkeep") monthly = effect.amount;
    if (type === "rent") rentYear = effect.amount;
  }
  return { now, monthly, rentYear };
}

/**
 * The naira in kobo left after moving in (prologue:front-door-three-screens): the tile's savings and what its age step saves, less what
 * moving in takes and the first month's living. Below nothing, the shortfall, or for the room the figure still needed.
 */
export function pocketIn(archetype: Archetype, years: number, home: Home): number {
  const saved = yearsWorked(years).saved;
  const { now, monthly } = homeFigures(home);
  return savingsOf(archetype) + saved - now - monthly;
}

/**
 * The naira in kobo the life holds at Begin in a home: the tile's savings and what its age step
 * saves, less what moving in takes. The band shows this figure when the world opens; the month's living falls due at the
 * month's end, so the row names it apart.
 */
export function startIn(archetype: Archetype, years: number, home: Home): number {
  return savingsOf(archetype) + yearsWorked(years).saved - homeFigures(home).now;
}

/** The home kept when the tile or the age changes: the one the player picked while the life can still move in, else the tile's own, else the first it can pay for. */
export function fitHome(archetype: Archetype, years: number, draft: Pick<DoorDraft, "home" | "homePicked">): Home {
  const offered = homesFor(archetype);
  const picked = draft.homePicked === true ? offered.filter((one) => one === draft.home) : [];
  const own = homeOf(archetype);
  return [...picked, own, ...offered].find((one) => pocketIn(archetype, years, one) >= 0) ?? own;
}

/** The self-contain the door shows as a goal (prologue:front-door-three-screens): its year's rent with the same fees as the room's. */
export function selfContainYear(): number {
  const { selfContainRentYear, compound } = content.tuning.home;
  return selfContainRentYear + int.bp(selfContainRentYear, compound.feesBp);
}

/**
 * True when the tile's savings at the age picked already cover the self-contain's year and fees. The row stays, locked
 * as the goal with its figure; it only says "reached" beside the lock.
 */
export function selfContainReached(archetype: Archetype, years: number): boolean {
  return savingsOf(archetype) + yearsWorked(years).saved >= selfContainYear();
}

