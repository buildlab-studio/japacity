// The family group feed: a small feed beside the
// news with forwarded prayers, a cousin's business, and the billing that starts
// the day people hear you are travelling. Each post's words are
// `family.<slug>.text`; who sent it is `family.from.<sender>`, named from the
// life's own family below, or plainly by relation when the life has none.
// the news kind reads this as `news/feed` once the lead adds its view field.
import type { Id } from "@japacity/sim";

export type FamilySender = "aunt" | "cousin" | "uncle" | "mum" | "group";

export type FamilyPostKind = "prayer" | "business" | "billing" | "chatter";

export interface FamilyPost {
  id: `family.${string}`;
  from: FamilySender;
  kind: FamilyPostKind;
  /** A report line key whose month unlocks the post; null for a post any month may carry. */
  after: string | null;
}

/** The report lines after which the family knows you are travelling. Billing waits for one of them. */
export const travelKnown: readonly string[] = [
  "line.route.applied",
  "line.route.granted",
  "line.route.departed",
  "line.place.arrived",
  "line.activity.salary-first-foreign",
  "line.setpiece.december-go",
];

/** At most this many posts reach the player in a month: the feed stays small. */
export const familyFeed = { perMonth: 1 } as const;

export const familyPosts: FamilyPost[] = [
  { id: "family.chain-amen", from: "aunt", kind: "prayer", after: null },
  { id: "family.warm-water", from: "uncle", kind: "prayer", after: null },
  { id: "family.morning-light", from: "mum", kind: "prayer", after: null },
  { id: "family.original-bags", from: "cousin", kind: "business", after: null },
  { id: "family.chin-chin", from: "cousin", kind: "business", after: null },
  { id: "family.doubling", from: "cousin", kind: "business", after: null },
  { id: "family.who-added", from: "uncle", kind: "chatter", after: null },
  { id: "family.admins-only", from: "group", kind: "chatter", after: null },
  { id: "family.remember-aunty", from: "aunt", kind: "billing", after: "line.route.applied" },
  { id: "family.check-price", from: "cousin", kind: "billing", after: "line.route.applied" },
  { id: "family.roof", from: "uncle", kind: "billing", after: "line.route.granted" },
  { id: "family.told-few", from: "mum", kind: "chatter", after: "line.route.granted" },
  { id: "family.group-name", from: "group", kind: "chatter", after: "line.route.departed" },
  { id: "family.size-44", from: "cousin", kind: "billing", after: "line.place.arrived" },
  { id: "family.dollars", from: "aunt", kind: "billing", after: "line.activity.salary-first-foreign" },
  { id: "family.december-room", from: "mum", kind: "chatter", after: "line.setpiece.december-go" },
];

/**
 * Each fixed life's aunt and cousin, from the pool and from the life's own
 * people (lifePeople in person.names.data.ts). The prologue's life has no fixed
 * family, so its senders go by relation.
 */
export const familyNames: Partial<Record<Id<"scenario">, Partial<Record<FamilySender, string>>>> = {
  "scenario.ada": { aunt: "Nkechi", cousin: "Ebuka" },
  "scenario.tunde": { aunt: "Ronke", cousin: "Seun" },
  "scenario.zainab": { aunt: "Halima", cousin: "Sani" },
  "scenario.ngozi": { aunt: "Chioma", cousin: "Obinna" },
  "scenario.aniekan": { aunt: "Ekaette", cousin: "Ubong" },
};
