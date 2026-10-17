// The things in a place (docs/rules/world.md R-WORLD-005): a model copy the player can tap, with
// its name and one or two acts. A place file declares them in `stage.things`; where and how far the
// character walks for one, and which of its acts the view lets happen today, are read here. Pure.
import type { DayPart } from "@japacity/sim";

import { MAX_ACTS } from "../../../../../tools/assets/world-check";
import type { Act, Thing } from "../../shared/world/contract";
import type { Stage } from "./placeFile";

/** No thing offers more than two acts; a third goes on a sheet (the place check's number). */
export { MAX_ACTS };
/** How far short of a thing's spot the character stops when the thing names no spot to stand at: clear of a kiosk or a danfo. */
export const STOP_SHORT = 1.8;

/**
 * The fallback tables, by the end of a model's file: what a thing is called
 * and what its one act does. Read only for a place whose file has no `stage.things`.
 */
const TABLE: readonly { suffix: string; label: string; act: Act }[] = [
  { suffix: "shop_lotto-kiosk.glb", label: "city.thing.lotto", act: { id: "play-lotto", label: "scene.act.play-lotto", kind: "sheet", stages: "activity.play-lotto" } },
  { suffix: "bld_bode-thomas-betting.glb", label: "city.thing.bets", act: { id: "bet-slip", label: "scene.act.bet-slip", kind: "sheet", stages: "activity.bet-slip" } },
  { suffix: "veh_danfo.glb", label: "city.thing.danfo", act: { id: "ride", label: "city.ride.danfo", kind: "ride" } },
  { suffix: "veh_keke.glb", label: "city.thing.keke", act: { id: "ride", label: "city.ride.keke", kind: "ride" } },
  { suffix: "veh_okada.glb", label: "city.thing.okada", act: { id: "ride", label: "city.ride.okada", kind: "ride" } },
  { suffix: "bld_family-house.glb", label: "scene.thing.house", act: { id: "enter", label: "scene.act.enter", kind: "enter" } },
];

// A place whose file declares no `stage.things` gets its things from the tables here.
/** The things of a place whose file declares none, from the tables: the first copy of each model the tables name. */
export function tableThings(stage: Pick<Stage, "models">): Thing[] {
  const found: Thing[] = [];
  for (const model of stage.models) {
    const row = TABLE.find((entry) => model.file.endsWith(entry.suffix));
    if (row === undefined || model.at.length === 0 || found.some((thing) => thing.file === model.file)) continue;
    found.push({ id: row.act.id === "ride" ? row.suffix.replace(/\.glb$/, "") : row.act.id, file: model.file, copy: 0, label: row.label, acts: [row.act] });
  }
  return found;
}

/** The choice a thing's act makes inside the entry it stages, where the thing's own words make it: the kiosk's "Buy a ticket" is one ticket (R-WORLD-005). */
const OWN_CHOICE: Record<string, string> = { "activity.play-lotto": "1" };

function withOwnChoice(act: Act): Act {
  const choice = act.kind === "sheet" && act.param === undefined && act.stages !== undefined ? OWN_CHOICE[act.stages] : undefined;
  return choice === undefined ? act : { ...act, param: choice };
}

// The places' files list what each desk's sheet offers, but not the care, talent, points and Gulf files' steps
// (R-CHAPTER-009), so those entries are listed here.
/** More entries a thing's sheet act lists, by `<place>:<thing>:<act>`. */
const MORE_AT: Record<string, readonly string[]> = {
  "place.yaba:desk:routes": ["activity.find-sponsor", "activity.apply-endorsement", "activity.enter-pool"],
  "place.visa-centre:desk:apply": ["activity.apply-uk-care", "activity.apply-uk-talent"],
  "place.agent-office:desk:visit": ["activity.apply-gulf-contract"],
};

/**
 * A thing as it stands in a place that borrows another place's room (city.md R-CITY-010, the hub's room in Yaba's
 * way), by `<place>:<thing>`: its own name and acts there, or none to stand empty. The passport office stands in the
 * visa centre's hall until its own is built: its desk takes the passport and nothing of the visa's (the passport is a
 * visit).
 */
const BORROWED_AT: Record<string, Pick<Thing, "label" | "acts"> | null> = {
  "place.passport-office:desk": { label: "city.thing.passport-desk", acts: [{ id: "passport", label: "activity.get-passport.name", kind: "sheet", stages: "activity.get-passport" }] },
  "place.passport-office:officer": null,
  "place.passport-office:police-notice": null,
};

/**
 * The entry a thing's sheet act lists first, by `<place>:<thing>:<act>`: at the hub's desk, "Ask about routes" leads with
 * the adviser's card, so the act's name holds before any way out is heard of.
 */
const FIRST_AT: Record<string, string> = {
  "place.yaba:desk:routes": "activity.see-adviser",
};

/**
 * The things with the entries these tables add to their sheets at `place`, and the one each lists first; in a borrowed
 * room, each thing as it stands there, a thing with nothing to do there left out.
 */
export function withMoreAt(things: readonly Thing[], place: string): Thing[] {
  return things.flatMap((thing) => {
    const borrowed = BORROWED_AT[`${place}:${thing.id}`];
    if (borrowed === null) return [];
    return [borrowed === undefined ? thing : { ...thing, ...borrowed }];
  }).map((thing) => ({
    ...thing,
    acts: thing.acts.map((act) => {
      const at = `${place}:${thing.id}:${act.id}`;
      const extra = MORE_AT[at];
      const first = FIRST_AT[at];
      if ((extra === undefined && first === undefined) || act.kind !== "sheet" || act.stages === undefined) return act;
      const all = [...new Set([...(first === undefined ? [] : [first]), act.stages, ...(act.more ?? []), ...(extra ?? [])])];
      const [stages = act.stages, ...more] = all;
      return { ...act, stages, ...(more.length === 0 ? {} : { more }) };
    }),
  }));
}

/** The place's things: its file's own, or the tables' for a file that has none, each with at most two acts, each act with the choice its words make. */
export function thingsOf(stage: Pick<Stage, "models" | "things">): Thing[] {
  return (stage.things ?? tableThings(stage)).map((thing) => ({ ...thing, acts: thing.acts.slice(0, MAX_ACTS).map(withOwnChoice) }));
}

/**
 * Where a thing stands: where the person standing as it stands (world.md R-WORLD-020), so their mark is over them; else its
 * model's copy, or the spot it names when its model is not in the place. Null when it has none.
 */
export function thingSpot(stage: Pick<Stage, "models"> & Partial<Pick<Stage, "standing" | "things">>, thing: Pick<Thing, "file" | "copy" | "at"> & Partial<Pick<Thing, "id">>): [number, number] | null {
  const stander = thing.id === undefined ? undefined : stage.standing?.find((one) => one.thing === thing.id);
  if (stander !== undefined) return [stander.at[0], stander.at[1]];
  // Two shops of one terrace are one model copy (Rye Lane's chicken shop and barber, world.md R-WORLD-039: the things'
  // spots are the place file's): a thing that shares its copy with another standing elsewhere is marked at its own spot.
  if (thing.at !== undefined && (stage.things ?? []).some((other) => other.id !== thing.id && other.file === thing.file && other.copy === thing.copy && other.at !== undefined && (other.at[0] !== thing.at?.[0] || other.at[1] !== thing.at?.[1]))) return thing.at;
  const copy = stage.models.find((model) => model.file === thing.file)?.at[thing.copy];
  if (copy !== undefined) return [copy[0], copy[1]];
  return thing.at ?? null;
}

/**
 * Where the character walks for a thing (R-WORLD-010): straight to the spot the thing names, or
 * toward its copy and STOP_SHORT before it, so no one walks into a kiosk. Null when it has no spot.
 */
export function walkSpot(stage: Pick<Stage, "models">, thing: Pick<Thing, "file" | "copy" | "at">, from: { x: number; z: number }): [number, number] | null {
  if (thing.at !== undefined) return thing.at;
  const spot = thingSpot(stage, thing);
  if (spot === null) return null;
  const [dx, dz] = [spot[0] - from.x, spot[1] - from.z];
  const length = Math.hypot(dx, dz);
  if (length <= STOP_SHORT) return [from.x, from.z];
  const share = (length - STOP_SHORT) / length;
  return [from.x + dx * share, from.z + dz * share];
}

/** Nearer than this to a thing's spot, the character is at it and no walk starts. */
const AT_THING = 0.05;

/**
 * Where the character walks before an act on a thing lands (R-WORLD-010, R-WORLD-005): the act and its
 * words start at the thing, also when its acts were opened by the nudge with no walk yet. Null when the character already stands there, or the thing has no spot.
 */
export function walkBeforeAct(stage: Pick<Stage, "models">, thing: Pick<Thing, "file" | "copy" | "at">, from: { x: number; z: number }): [number, number] | null {
  const to = walkSpot(stage, thing, from);
  if (to === null) return null;
  return Math.hypot(to[0] - from.x, to[1] - from.z) < AT_THING ? null : to;
}

/**
 * Whether an act's entry has something to open now (R-WORLD-005): an activity the view allows and the
 * place stages, an offer that is open, the set piece that is asking, the chapter in hand.
 */
export function stagedNow(offered: ReadonlySet<string>, staged: ReadonlySet<string>, openOffers: ReadonlySet<string>, setpiece: string | null, chapter: string | null = null): (stages: string) => boolean {
  return (stages) => {
    if (stages.startsWith("activity.")) return offered.has(stages) && staged.has(stages);
    if (stages.startsWith("offer.")) return openOffers.has(stages);
    if (stages.startsWith("setpiece.")) return stages === setpiece;
    if (stages.startsWith("chapter.")) return stages === chapter;
    if (stages.startsWith("command:")) return offered.has(stages);
    return true;
  };
}

/** The parts of the world's day in their order from the morning (clock.md R-CLOCK-033). */
const DAY_PARTS: readonly DayPart[] = ["morning", "afternoon", "evening", "night"];

/** Whether an act is open at the world's part of the day: every act with no hours is; with no part read, the hours are not. */
function openAt(act: Act, part: DayPart | undefined): boolean {
  return part === undefined || act.parts === undefined || act.parts.includes(part);
}

/** The first part of the day after `part`, going round, in which any of the acts opens. */
function opensNext(acts: readonly Act[], part: DayPart): DayPart | undefined {
  const from = DAY_PARTS.indexOf(part);
  return [1, 2, 3].map((step) => DAY_PARTS[(from + step) % DAY_PARTS.length]).find((next) => next !== undefined && acts.some((act) => act.parts?.includes(next) === true));
}

/**
 * A thing shut by the hour (R-CLOCK-033, R-WORLD-005): it still stands with one plain act naming the part it opens in, and
 * its line, told in the corner, says why it is shut, in the words of its first act's `.shut`.
 */
function shutAct(acts: readonly Act[], part: DayPart): Act | null {
  const next = opensNext(acts, part);
  const first = acts[0];
  if (next === undefined || first === undefined) return null;
  return { id: "shut", label: `city.act.opens-${next}`, kind: "plain", tells: `${first.label}.shut` };
}

/** What an act keeps when its sheet lists fewer entries: where and how the figure takes the thing, and its hours. */
function keptOf(act: Act): Partial<Act> {
  return {
    ...(act.pose === undefined ? {} : { pose: act.pose }),
    ...(act.seat === undefined ? {} : { seat: act.seat }),
    ...(act.top === undefined ? {} : { top: act.top }),
    ...(act.parts === undefined ? {} : { parts: act.parts }),
  };
}

/**
 * The things the player can act on now: an act that opens an activity's sheet stays only while the
 * view offers that activity, and a thing left with no act shows no label. Other acts always stay.
 * An act open only at some parts of the world's day (R-CLOCK-033) stays only in them; a thing that
 * leaves with no act stands shut, saying when it opens.
 */
export function thingsNow(things: readonly Thing[], offered: (stages: string) => boolean, part?: DayPart): Thing[] {
  return things.flatMap((thing) => {
    const closed = thing.acts.filter((act) => !openAt(act, part));
    // A sheet act stays while any entry it lists can open; the sheet shows only those that can.
    const acts = thing.acts.filter((act) => openAt(act, part)).flatMap((act): Act[] => {
      // An act that stands in for others shows only while none of them can open.
      if (act.unless?.some(offered) === true) return [];
      if (act.kind === "command") return offered(`command:${act.command ?? ""}`) ? [act] : [];
      if ((act.kind !== "sheet" && act.kind !== "do") || act.stages === undefined) return [act];
      if (act.kind === "do") return offered(act.stages) ? [act] : [];
      const all = [act.stages, ...(act.more ?? [])];
      const listed = all.filter(offered);
      if (listed.length === all.length) return [act];
      const stages = listed[0];
      // An act that names what stands in its place while nothing it lists can open shows that instead (the bed's Lie down).
      if (stages === undefined) return act.otherwise === undefined ? [] : [act.otherwise];
      const more = listed.slice(1);
      return [{ id: act.id, label: act.label, kind: act.kind, stages, ...(more.length === 0 ? {} : { more }), ...keptOf(act) }];
    });
    if (acts.length === 0) {
      const shut = part === undefined ? null : shutAct(closed, part);
      return shut === null ? [] : [{ ...thing, acts: [shut] }];
    }
    return [acts.length === thing.acts.length && acts.every((act, index) => act === thing.acts[index]) ? thing : { ...thing, acts }];
  });
}

/** The vehicle a ride act takes, from its thing's model: the danfo, the keke or the okada. */
export function vehicleOf(thing: Pick<Thing, "file">): string | null {
  return /veh_(danfo|keke|okada)/.exec(thing.file)?.[1] ?? null;
}
