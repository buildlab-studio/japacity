// The player's own light (docs/rules/account.md R-ACCOUNT-033): a name of at most four words and forty characters, and
// the years if wanted, kept on this device only, beside the front door's other memories (the run, the years' trail, the
// ask for the ready lives), under one key of its own. One light per device. It is never sent anywhere, so there is
// nothing to moderate; a value that cannot be read is dropped, never shown.
import { useSyncExternalStore } from "react";

/** The one localStorage key the light is kept under, beside the door's own. */
export const OWN_LIGHT_KEY = "japacity.door.light";

/** R-ACCOUNT-033: the most words and characters a light's name may have. */
export const LIGHT_NAME_WORDS = 4;
export const LIGHT_NAME_CHARACTERS = 40;
/** R-ACCOUNT-033: the earliest year a light may carry; the latest is the current year. */
export const LIGHT_FIRST_YEAR = 1900;

export interface OwnLight {
  /** The name as typed, its spaces tidied. */
  name: string;
  /** The first year, or null. */
  from: number | null;
  /** The last year, never before the first, or null. */
  to: number | null;
}

/** What the sheet holds while it is filled in: the fields as typed. */
export interface LightAsked {
  name: string;
  from: string;
  to: string;
}

/** Why the sheet cannot light it yet: the field and the reason, each with its words in the start screen's table. */
export type LightProblem = "name-empty" | "name-words" | "name-characters" | "from-year" | "to-year" | "to-before";

export type LightChecked = { ok: true; light: OwnLight } | { ok: false; problems: LightProblem[] };

/** The name with its spaces tidied: no space at either end and one between words. */
function tidy(name: string): string {
  return name.trim().split(/\s+/u).filter((word) => word !== "").join(" ");
}

/** Characters as a person counts them: a letter with its accent is one. */
function characters(words: string): number {
  return [...words.normalize("NFC")].length;
}

/** A year field: null when empty, the year when it is one between the first year and this year, else "bad". */
function yearOf(typed: string, thisYear: number): number | null | "bad" {
  const trimmed = typed.trim();
  if (trimmed === "") return null;
  if (!/^\d{4}$/.test(trimmed)) return "bad";
  const year = Number(trimmed);
  return year >= LIGHT_FIRST_YEAR && year <= thisYear ? year : "bad";
}

/** R-ACCOUNT-033: the sheet's limits, each at its edge. `thisYear` is the device's own year. */
export function checkLight(asked: LightAsked, thisYear: number): LightChecked {
  const problems: LightProblem[] = [];
  const name = tidy(asked.name);
  if (name === "") problems.push("name-empty");
  else {
    if (name.split(" ").length > LIGHT_NAME_WORDS) problems.push("name-words");
    if (characters(name) > LIGHT_NAME_CHARACTERS) problems.push("name-characters");
  }
  const from = yearOf(asked.from, thisYear);
  const to = yearOf(asked.to, thisYear);
  if (from === "bad") problems.push("from-year");
  if (to === "bad") problems.push("to-year");
  if (typeof from === "number" && typeof to === "number" && to < from) problems.push("to-before");
  if (problems.length > 0 || from === "bad" || to === "bad") return { ok: false, problems };
  return { ok: true, light: { name, from, to } };
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Some browsers throw on access when storage is blocked.
    return null;
  }
}

/** The device's year, which a kept light's years are read against. */
function deviceYear(): number {
  return new Date().getFullYear();
}

/** The light kept on this device, or null when none is, or what is kept cannot be read or breaks a limit. */
export function readOwnLight(storage: Pick<Store, "getItem"> | null = browserStorage(), thisYear: number = deviceYear()): OwnLight | null {
  try {
    const raw = storage?.getItem(OWN_LIGHT_KEY) ?? null;
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { name, from, to } = parsed as Record<string, unknown>;
    const year = (value: unknown): string | null => (value === null ? "" : typeof value === "number" && Number.isInteger(value) ? String(value) : null);
    const [first, last] = [year(from), year(to)];
    if (typeof name !== "string" || first === null || last === null) return null;
    const checked = checkLight({ name, from: first, to: last }, thisYear);
    return checked.ok ? checked.light : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
let version = 0;

function changed(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/** Keeps the light, in the place of any kept before: one light per device. */
export function keepOwnLight(light: OwnLight, storage: Pick<Store, "setItem"> | null = browserStorage()): void {
  try {
    storage?.setItem(OWN_LIGHT_KEY, JSON.stringify(light));
  } catch {
    // A private window may refuse storage; the light then lasts the visit only, as the door's run does.
  }
  changed();
}

/** "Put it out": the light goes from this device. */
export function putOutOwnLight(storage: Pick<Store, "removeItem"> | null = browserStorage()): void {
  try {
    storage?.removeItem(OWN_LIGHT_KEY);
  } catch {
    // Storage refused: nothing was kept to remove.
  }
  changed();
}

/** The light's years as a person says them: "1951 to 2024", or the one year given, or null with none. */
export function lightYears(light: OwnLight, between: string): string | null {
  return light.from !== null && light.to !== null ? `${String(light.from)} ${between} ${String(light.to)}` : light.from !== null ? String(light.from) : light.to !== null ? String(light.to) : null;
}

/** The light's words on tap and on the page: the name, then its years. */
export function lightWords(light: OwnLight, between: string): string {
  const years = lightYears(light, between);
  return years === null ? light.name : `${light.name}, ${years}`;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab of the game lighting or putting out its light shows here too.
  const other = (event: StorageEvent): void => {
    if (event.key === null || event.key === OWN_LIGHT_KEY) changed();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", other);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", other);
  };
}

let cached: { version: number; light: OwnLight | null } | null = null;

function snapshot(): OwnLight | null {
  if (cached === null || cached.version !== version) cached = { version, light: readOwnLight() };
  return cached.light;
}

/** For tests: forgets the read kept between renders, as a new visit would. */
export function forgetOwnLightRead(): void {
  cached = null;
  version += 1;
}

/** The light kept on this device, following a light lit or put out anywhere on the page. */
export function useOwnLight(): OwnLight | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
