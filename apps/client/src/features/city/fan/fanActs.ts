// What each thing's fan holds, and what each button of the fan says (docs/design/13-the-lively-layer.md section 3; docs/rules/world.md
// R-WORLD-005, R-WORLD-006, R-WORLD-034). Every thing fans its acts. The room's and the street's acts done at once (decision
// 0036, R-STREET-011) are the simulation's own buttons: priced, balanced, refused as their sheet would, and sent on arrival.
// Every other act (a pose, the bed's Sleep, a sheet that opens a card, a command, the way out, the papers, a word with
// someone) is a button with the act's own label and a picture, no price, and on arrival it does what its kind does.
import { content } from "@japacity/content";
import type { Id, PlayerView, SlotPick } from "@japacity/sim";

import { type ActGlyph, glyphTile, TILE_TABLE } from "../../../shared/tiles/tiles.data";
import { freeShown } from "../../../shared/words/chips";
import { afterPaying, monthDues, plannedCosts } from "../../../shared/words/cost";
import { formatMoney } from "../../../shared/words/format";
import { needsWords } from "../../../shared/words/requirement";
import { nameOf, say } from "../../../shared/words/text";
import type { Act, Thing } from "../../../shared/world/contract";
import { isPaper } from "../acts";
import { sceneWords } from "../scene.words";

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

/**
 * What a button does: `now`, one of the simulation's acts done at once, sent on arrival as its sheet's button sends it;
 * `act`, any other act of the thing, handed to the walk and done on arrival as its kind does (a pose, Sleep, a card, a
 * command, the map, the phone); `stop`, an act carrying on in the plan taken out of it (R-WORLD-007).
 */
export type FanKind = "now" | "act" | "stop";

/** One button's entry and the thing's act that lists it. */
export interface FanEntryOf {
  act: Act;
  kind: FanKind;
  /** The activity a `now` button sends; the entry an `act` stages, when it stages one. */
  stages: string | null;
}

/**
 * The entries a thing fans, in the order its acts and its sheets list them. A sheet act whose every entry is an act done at
 * once fans each entry as its own button; any other act is one button; an act carrying on in the plan is its button, shut,
 * and a stop beside it.
 */
export function fanEntriesOf(thing: Pick<Thing, "acts">): FanEntryOf[] {
  const entries: FanEntryOf[] = [];
  for (const act of thing.acts) {
    const listed = act.stages === undefined ? [] : [act.stages, ...(act.more ?? [])];
    if (act.kind === "sheet" && act.planned !== true && listed.length > 0 && listed.every(fanEntry)) {
      for (const stages of listed) if (!entries.some((one) => one.kind === "now" && one.stages === stages)) entries.push({ act, kind: "now", stages });
      continue;
    }
    entries.push({ act, kind: "act", stages: act.stages ?? null });
    if (act.planned === true) entries.push({ act, kind: "stop", stages: act.stages ?? null });
  }
  return entries;
}

/** True when every entry is one of the simulation's acts done at once: with no room for the fan, they open as their own sheet. */
export function allNow(entries: readonly FanEntryOf[]): boolean {
  return entries.length > 0 && entries.every((entry) => entry.kind === "now");
}

/** The act the fan hands the walk for one entry: the thing's own act narrowed to that entry, with its seat and pose kept. */
export function fanActOf(thing: Pick<Thing, "acts">, stages: string): Act | null {
  const act = thing.acts.find((one) => one.stages === stages || one.more?.includes(stages) === true);
  if (act === undefined) return null;
  const narrowed: Act = { ...act, stages };
  delete narrowed.more;
  return narrowed;
}

/** The ids a person is asked something by, and a thing is spoken to: those plain acts are a word with someone. */
const TALK_ACTS: ReadonlySet<string> = new Set(["ask", "greet"]);

/** True when an offer asks for money: one of its choices takes it (the light bill, the brother's fees, a pledge). */
function asksMoney(offer: string): boolean {
  return content.offer[offer as Id<"offer">]?.choices.some((choice) => choice.effects.some((effect) => effect.type === "money/take")) === true;
}

/** The glyph an act with no picture of its own carries, by what it is (the fan for every thing). */
export function glyphOf(act: Pick<Act, "id" | "kind" | "pose" | "stages" | "command">): ActGlyph {
  switch (act.kind) {
    case "plain":
      if (act.pose === "lie") return "lie";
      if (act.pose === "sit" || act.id === "sit") return "sit";
      if (act.id === "shut") return "shut";
      return TALK_ACTS.has(act.id) ? "talk" : "look";
    case "end":
      return "sleep";
    case "out":
      return "out";
    case "enter":
      return "in";
    case "ride":
      return "ride";
    case "app":
      return "papers";
    case "command":
      if (act.command === "route/depart") return "pack";
      if (act.command === "return/home") return "home";
      if (act.command === "people/court") return "talk";
      return "pay";
    case "sheet":
    case "do":
      if (act.stages?.startsWith("offer.") === true) return asksMoney(act.stages) ? "pay" : "talk";
      if (act.pose === "lie") return "lie";
      if (act.pose === "sit") return "sit";
      return act.stages?.startsWith("setpiece.") === true || act.stages?.startsWith("chapter.") === true ? "talk" : "look";
  }
}

/** The picture an act's button carries: the act's own tile where the table has one for its activity, else its kind's glyph. */
export function pictureOf(act: Pick<Act, "id" | "kind" | "pose" | "stages" | "command">): string {
  const stages = act.stages;
  if ((act.kind === "sheet" || act.kind === "do") && stages?.startsWith("activity.") === true && TILE_TABLE[stages] !== undefined) return stages;
  return glyphTile(glyphOf(act));
}

/** The soft tint of a glyph's button: a pose or a sleep the body's, money paid money's, a word people's, else the sheet's. */
const GLYPH_TINTS: Readonly<Partial<Record<ActGlyph, FanTint>>> = { sit: "body", lie: "body", sleep: "body", pay: "money", talk: "people" };

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

/** Why a button cannot be had, in the words the sheet would use (R-WORLD-006, R-ACTIVITY-020). */
export interface FanRefusal {
  /** `planned`: the act carries on in the plan, so its button is shut and the stop beside it takes it out (R-WORLD-007). */
  kind: "spent" | "short" | "locked" | "planned";
  words: string;
}

/** One button of the fan. */
export interface FanEntry {
  /** The button's id: the activity it sends, the entry its act stages, else its act's id; a stop is `<act>:stop`. */
  id: string;
  /** The id of the thing's act the button comes from. */
  from: string;
  kind: FanKind;
  /** The act handed to the walk: narrowed to its entry for a `now` button, the thing's own act otherwise. */
  act: Act;
  name: string;
  /** What a screen reader hears when it is more than the name: a stop says what it stops. */
  label?: string;
  /** The id whose tile is the button's picture: the act itself, as the tile table maps it (shared/tiles). */
  picture: string;
  tint: FanTint;
  /** The price in words, or null when it is free. */
  price: string | null;
  /** The balance before, to strike, and after; null when free or short. */
  balance: { before: { amount: number; words: string }; after: { amount: number; words: string } } | null;
  refusal: FanRefusal | null;
  /** The choice the act sends with it: the thing's own, else the entry's one. */
  param: string | null;
  /** True when a free act is one a player would expect to pay for, a meal, so its pill says Free (chips earn their place). */
  free?: boolean;
}

/**
 * The buttons for a thing's entries as the view stands. A `now` button is named, priced and balanced as its sheet counts
 * them (the pockets, less what the month's plan already pays for), or refused as the sheet would refuse it: a body spent, a
 * need not met, or the money short. Any other button carries its act's own label and picture and no price (chips earn
 * their place), shut only when the body is spent or the act carries on in the plan.
 */
export function fanModel(entries: readonly FanEntryOf[], view: PlayerView, plan: readonly (SlotPick | null)[]): FanEntry[] {
  // What the plan already pays for and what the month owes, counted once and only for a priced button.
  let counted: { planned: ReturnType<typeof plannedCosts>; dues: ReturnType<typeof monthDues> } | null = null;
  const counts = () => (counted ??= { planned: plannedCosts(view, plan), dues: monthDues(view) });
  return entries.flatMap(({ act, kind, stages }): FanEntry[] => {
    if (kind === "stop") {
      const what = sceneWords(act.label);
      return [{ id: `${act.id}:stop`, from: act.id, kind, act, name: sceneWords("ui.world.stop"), label: sceneWords("ui.world.stop-act", { what }), picture: glyphTile("stop"), tint: "plain", price: null, balance: null, refusal: null, param: null }];
    }
    if (kind === "act" || stages === null) {
      const picture = pictureOf(act);
      const glyph = picture.startsWith("act.") ? (picture.slice("act.".length) as ActGlyph) : null;
      const refusal: FanRefusal | null =
        act.planned === true ? { kind: "planned", words: sceneWords("ui.world.thing.planned") } : act.spent === true ? { kind: "spent", words: say("ui.act.spent") } : null;
      return [
        {
          id: act.stages ?? act.id,
          from: act.id,
          kind: "act",
          act,
          name: sceneWords(act.label),
          picture,
          tint: glyph === null ? tintOf(picture) : (GLYPH_TINTS[glyph] ?? "plain"),
          price: null,
          balance: null,
          refusal,
          param: act.param ?? null,
        },
      ];
    }
    const option = view.activities.find((candidate) => candidate.id === stages);
    if (option === undefined) return [];
    const first = option.cost[0] ?? null;
    const cost = first === null ? null : { currency: first.currency, amount: option.cost.filter((part) => part.currency === first.currency).reduce((sum, part) => sum + part.amount, 0) };
    const paying = cost === null || cost.amount === 0 ? null : afterPaying(view, counts().planned, [cost], counts().dues);
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
    const narrowed: Act = { ...act, stages };
    delete narrowed.more;
    return [
      {
        id: stages,
        from: act.id,
        kind: "now",
        act: narrowed,
        name: nameOf(stages),
        picture: stages,
        tint: tintOf(stages),
        price: cost === null || cost.amount === 0 ? null : formatMoney(cost.amount, cost.currency),
        balance,
        refusal,
        param: (act.stages === stages ? act.param : undefined) ?? option.params?.[0] ?? null,
        free: freeShown(stages),
      },
    ];
  });
}
