// Which things fan their acts, and what each button of the fan says (docs/design/13-the-lively-layer.md section 3; docs/rules/world.md
// R-WORLD-005, R-WORLD-006). The fan is for the room's and the street's acts done at once (decision 0036, R-STREET-011): each
// a tap that answers where it stands. A list is a list: a job, a route, an offer, a paper, a command or anything with a choice
// inside keeps the thing's chip and its sheet.
import { content } from "@japacity/content";
import type { Id, PlayerView, SlotPick } from "@japacity/sim";

import { afterPaying, monthDues, plannedCosts } from "../../../shared/words/cost";
import { formatMoney } from "../../../shared/words/format";
import { needsWords } from "../../../shared/words/requirement";
import { nameOf, say } from "../../../shared/words/text";
import type { Act, Thing } from "../../../shared/world/contract";
import { isPaper } from "../acts";

/** The tint a button takes by what its act is (section 2, "Tints by kind"). */
export type FanTint = "food" | "study" | "money" | "body" | "people" | "plain";

/** Money is sent home from the Bank's chooser, never from a button. */
const SEND_MONEY = "activity.send-money";
/** More entries than this is a long list: the sheet of sticker cards, never a fan (section 3). */
export const MOST_FANNED = 8;

/**
 * True when an entry is one of the room's or the street's acts: done at once (R-ACTIVITY-015), outside the month's free
 * time (`slot: "none"`, decision 0036), with no choice inside it, and neither a paper slip nor the Bank's.
 */
export function fanEntry(stages: string): boolean {
  if (!stages.startsWith("activity.") || isPaper(stages) || stages === SEND_MONEY) return false;
  const entry = content.activity[stages as Id<"activity">];
  return entry !== undefined && entry.when === "now" && entry.slot === "none" && entry.param === null;
}

/** One button's entry and the thing's act that lists it. */
export interface FanEntryOf {
  act: Act;
  stages: string;
}

/**
 * The entries a thing fans, in the order its sheets list them, or null when it keeps its chip: every act it offers now is a
 * sheet act whose entries are all fan acts, and there are no more of them than a fan holds.
 */
export function fanEntriesOf(thing: Pick<Thing, "acts">): FanEntryOf[] | null {
  if (thing.acts.length === 0) return null;
  const entries: FanEntryOf[] = [];
  for (const act of thing.acts) {
    if (act.kind !== "sheet" || act.stages === undefined || act.planned === true) return null;
    for (const stages of [act.stages, ...(act.more ?? [])]) {
      if (!fanEntry(stages)) return null;
      if (!entries.some((one) => one.stages === stages)) entries.push({ act, stages });
    }
  }
  return entries.length > MOST_FANNED ? null : entries;
}

/** The act the fan hands the walk for one entry: the thing's own act narrowed to that entry, with its seat and pose kept. */
export function fanActOf(thing: Pick<Thing, "acts">, stages: string): Act | null {
  const act = thing.acts.find((one) => one.stages === stages || one.more?.includes(stages) === true);
  if (act === undefined) return null;
  const narrowed: Act = { ...act, stages };
  delete narrowed.more;
  return narrowed;
}

/** The groups of quality a skill or a proof counts in (R-QUALITY-007). */
const STUDY_GROUPS: ReadonlySet<string> = new Set(["skills", "proof"]);
const PEOPLE_QUALITIES: ReadonlySet<string> = new Set(["quality.standing", "quality.network"]);
const BODY_QUALITIES: ReadonlySet<string> = new Set(["quality.energy", "quality.wellbeing"]);

/**
 * What an act is, from its effects and its cost: money when it earns (a gig, a job), food when it is paid as food or fills
 * the belly, people when it is company (standing, the network, a moment with someone), study when it adds a skill, body when
 * it rests or lifts you, else plain.
 */
export function tintOf(activity: string): FanTint {
  const entry = content.activity[activity as Id<"activity">];
  if (entry === undefined) return "plain";
  const adds = entry.effects.flatMap((effect) => (effect.type === "quality/add" && effect.amount > 0 ? [effect.quality as string] : []));
  if (entry.effects.some((effect) => effect.type === "activity/gig" || effect.type === "activity/start-job")) return "money";
  if (entry.cost.some((part) => part.reason === "food") || adds.includes("quality.belly")) return "food";
  if (adds.some((quality) => PEOPLE_QUALITIES.has(quality)) || entry.effects.some((effect) => effect.type === "people/moment")) return "people";
  if (adds.some((quality) => STUDY_GROUPS.has(content.quality[quality as Id<"quality">]?.group ?? ""))) return "study";
  if (adds.some((quality) => BODY_QUALITIES.has(quality))) return "body";
  return "plain";
}

/**
 * The picture on each button until the tiles of the game's own models land (section 2, "Pictures"): an emoji stand-in by
 * the act. The lead swaps these for `<Tile of=...>` once `shared/tiles` is on the branch.
 */
const STAND_IN: Readonly<Record<string, string>> = {
  "activity.cook-at-home": "🍜",
  "activity.cook-jollof": "🥘",
  "activity.nap": "🛏️",
  "activity.bucket-bath": "🧽",
  "activity.watch-tv": "📺",
  "activity.help-shop": "🛒",
  "activity.fetch-water": "🪣",
  "activity.fill-drum": "🛢️",
  "activity.buy-suya": "🍢",
  "activity.mallam-tea": "🍵",
  "activity.pure-water": "💧",
  "activity.barber": "💈",
  "activity.viewing-centre": "⚽",
  "activity.beer-joint": "🍺",
  "activity.night-out": "🪩",
  "activity.buy-clothes": "👕",
  "activity.buy-phone": "📱",
  "activity.tech-posts": "💻",
};
const NO_PICTURE = "✨";

export function pictureOf(activity: string): string {
  return STAND_IN[activity] ?? NO_PICTURE;
}

/** Why a button cannot be had, in the words the sheet would use (R-WORLD-006, R-ACTIVITY-020). */
export interface FanRefusal {
  kind: "spent" | "short" | "locked";
  words: string;
}

/** One button of the fan. */
export interface FanEntry {
  /** The activity it sends. */
  id: string;
  name: string;
  picture: string;
  tint: FanTint;
  /** The price in words, or null when it is free. */
  price: string | null;
  /** The balance before, to strike, and after; null when free or short. */
  balance: { before: { amount: number; words: string }; after: { amount: number; words: string } } | null;
  refusal: FanRefusal | null;
  /** The choice the act sends with it: the thing's own, else the entry's one. */
  param: string | null;
}

/**
 * The buttons for a thing's entries as the view stands: each named, priced and balanced as its sheet counts them (the pockets,
 * less what the month's plan already pays for), or refused as the sheet would refuse it: a body spent, a need not met, or
 * the money short.
 */
export function fanModel(entries: readonly FanEntryOf[], view: PlayerView, plan: readonly (SlotPick | null)[]): FanEntry[] {
  const planned = plannedCosts(view, plan);
  const dues = monthDues(view);
  return entries.flatMap(({ act, stages }): FanEntry[] => {
    const option = view.activities.find((candidate) => candidate.id === stages);
    if (option === undefined) return [];
    const first = option.cost[0] ?? null;
    const cost = first === null ? null : { currency: first.currency, amount: option.cost.filter((part) => part.currency === first.currency).reduce((sum, part) => sum + part.amount, 0) };
    const paying = cost === null || cost.amount === 0 ? null : afterPaying(view, planned, [cost], dues);
    const refusal: FanRefusal | null =
      option.spent === true
        ? { kind: "spent", words: say("ui.act.spent") }
        : !option.allowed
          ? { kind: "locked", words: needsWords(option.missing) }
          : paying !== null && paying.short !== null
            ? { kind: "short", words: say("ui.world.short", { amount: formatMoney(paying.short.amount, paying.short.currency) }) }
            : null;
    const balance =
      paying === null || paying.short !== null
        ? null
        : {
            before: { amount: paying.before.amount, words: formatMoney(paying.before.amount, paying.before.currency) },
            after: { amount: paying.left.amount, words: formatMoney(paying.left.amount, paying.left.currency) },
          };
    return [
      {
        id: stages,
        name: nameOf(stages),
        picture: pictureOf(stages),
        tint: tintOf(stages),
        price: cost === null || cost.amount === 0 ? null : formatMoney(cost.amount, cost.currency),
        balance,
        refusal,
        param: (act.stages === stages ? act.param : undefined) ?? option.params?.[0] ?? null,
      },
    ];
  });
}

/** The fan stands in for the chip unless a development build is asked for the chip with `?fan=off`, to compare the two. */
export function fanAsked(search: string, development: boolean): boolean {
  return !(development && new URLSearchParams(search).get("fan") === "off");
}
