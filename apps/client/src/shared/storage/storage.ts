// What the game keeps on this device: every key it reads or writes in the browser's storage, and the one way the
// storage is reached. Ending a life drops the life's own keys (`authority/ended.ts` LIFE_KEYS, account:start-a-new-life);
// the device's settings stay.

/** The life's save. */
export const SAVE_KEY = "japacity.save";
/** The person built at the front door (prologue:front-door-builds-a-person): the look, the name, the archetype. */
export const PERSON_KEY = "japacity.person";
/** The month between loads: the plan, the lines so far, and the card closed. */
export const MONTH_KEY = "japacity.month";
/** The days of the month as the player walked them. */
export const DAYS_KEY = "japacity.days";
/** The front door's run, step by step. */
export const DOOR_KEY = "japacity.door";
/** The years' trail beside the door's run. */
export const TRAIL_KEY = "japacity.door.years";
/** A one-time ask from Settings that the next door open on the ready lives. */
export const READY_ASK_KEY = "japacity.door.ready";
/** The cards the gallery keeps. */
export const CARDS_KEY = "japacity.cards";
/** Where the player stopped in the city; written by the city whenever the place changes. */
export const CITY_LAST_KEY = "japacity.city.last";
/** The places of the city been to. */
export const CITY_BEEN_KEY = "japacity.city.been";
/** What the phone's apps were last seen holding. */
export const SEEN_KEY = "japacity.phone.seen";
/** Set once the account sheet has offered a passkey on this device (account:passkey-offered-where-it-works). */
export const PASSKEY_OFFERED_KEY = "japacity.passkey.offered";
/** The teaching marks already shown in this life. */
export const TAUGHT_KEY = "japacity.taught";
/** Where things stand in each home. */
export const ARRANGED_KEY = "japacity.arranged";
/** The chapters whose brief has been handed in this life. */
export const BRIEF_KEY = "japacity.brief";
/** The device's graphics choice, read when the city opens. */
export const GRAPHICS_KEY = "japacity.city.graphics";
/** Whether the sound is off on this device. */
export const MUTED_KEY = "japacity.sound.muted";
/** The seat picked at the send-off. */
export const SEAT_KEY = "japacity.send-off.seat";
/** The first-use labels tapped on this device, and whether it has played. */
export const WALK_KEY = "japacity.walkthrough";
/** The setting `prologue.full`: every card of the prologue, one answer each, no preset. No screen offers it. */
export const FULL_PROLOGUE_KEY = "japacity.prologue.full";
/** The dev switch that opens every envelope at once, so a tester need not wait for the game's own morning. */
export const MORNING_KEY = "japacity.morning";
/** The time of the last reload for the staging wall: kept in the tab's storage, gone with it. */
export const WALL_KEY = "japacity.wall";
/** When this device last turned the ask for notices down, in ms since 1970. */
export const NOTIFY_DISMISSED_KEY = "japacity.notify.dismissedAt";
/** That a kept life was open in this browser (account:start-screen-over-live-city): "1" or nothing, with no account data in it. */
export const KEPT_MARK_KEY = "japacity.account.kept";
/** That a passkey was added or used in this browser (account:passkey-in-email-autofill): "1" or nothing, with no account data in it. */
export const PASSKEY_MARK_KEY = "japacity.account.passkey";

/**
 * account:player-deletes-account: the account a trip to Google left to confirm a deletion for, in the tab's storage; only the
 * same account coming back reopens the confirmation, and the mark goes as it is read.
 */
export const DELETE_TRIP_KEY = "japacity.account.delete-trip";

/** The key an account's ask to secure it is marked under, once per account and moment. */
export function secureAskedKey(account: string, moment: string): string {
  return `japacity-secure-asked:${account}:${moment}`;
}

/** The device's storage, or the tab's; null where there is none or it is blocked. */
export function browserStorage(kind: "local" | "session" = "local"): Storage | null {
  try {
    if (kind === "session") return typeof sessionStorage === "undefined" ? null : sessionStorage;
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Some browsers throw on access when storage is blocked.
    return null;
  }
}
