// The things in a place (docs/rules/world.md R-WORLD-005): a model copy the player can tap, with
// its name and one or two acts. A place file declares them in `stage.things`; where and how far the
// character walks for one, and which of its acts the view lets happen today, are read here. Pure.
import { MAX_ACTS } from "../../../../../tools/assets/world-check";
import type { Act, Thing } from "../../shared/world/contract";
import type { Stage } from "./placeFile";

/** No thing offers more than two acts; a third goes on a sheet (the place check's number). */
export { MAX_ACTS };
/** How far short of a thing's spot the character stops when the thing names no spot to stand at: clear of a kiosk or a danfo. */
export const STOP_SHORT = 1.8;

/**
 * The tables of the first world mode, by the end of a model's file: what a thing is called
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

// until the places work ships files with `stage.things`, the ten built places get their things from the tables here; this adapter goes when the files land.
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

/** The place's things: its file's own, or the tables' for a file that has none, each with at most two acts. */
export function thingsOf(stage: Pick<Stage, "models" | "things">): Thing[] {
  return (stage.things ?? tableThings(stage)).map((thing) => (thing.acts.length > MAX_ACTS ? { ...thing, acts: thing.acts.slice(0, MAX_ACTS) } : thing));
}

/** Where a thing stands: its model's copy, or the spot it names when its model is not in the place. Null when it has neither. */
export function thingSpot(stage: Pick<Stage, "models">, thing: Pick<Thing, "file" | "copy" | "at">): [number, number] | null {
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

/**
 * The things the player can act on now: an act that opens an activity's sheet stays only while the
 * view offers that activity, and a thing left with no act shows no label. Other acts always stay.
 */
export function thingsNow(things: readonly Thing[], offered: (stages: string) => boolean): Thing[] {
  return things.flatMap((thing) => {
    // A sheet act stays while any entry it lists can open; the sheet shows only those that can.
    const acts = thing.acts.flatMap((act): Act[] => {
      // An act that stands in for others shows only while none of them can open.
      if (act.unless?.some(offered) === true) return [];
      if (act.kind === "command") return offered(`command:${act.command ?? ""}`) ? [act] : [];
      if ((act.kind !== "sheet" && act.kind !== "do") || act.stages === undefined) return [act];
      if (act.kind === "do") return offered(act.stages) ? [act] : [];
      const all = [act.stages, ...(act.more ?? [])];
      const listed = all.filter(offered);
      if (listed.length === all.length) return [act];
      const stages = listed[0];
      if (stages === undefined) return [];
      const more = listed.slice(1);
      return [{ id: act.id, label: act.label, kind: act.kind, stages, ...(more.length === 0 ? {} : { more }) }];
    });
    return acts.length === 0 ? [] : [acts.length === thing.acts.length && acts.every((act, index) => act === thing.acts[index]) ? thing : { ...thing, acts }];
  });
}

/** The vehicle a ride act takes, from its thing's model: the danfo, the keke or the okada. */
export function vehicleOf(thing: Pick<Thing, "file">): string | null {
  return /veh_(danfo|keke|okada)/.exec(thing.file)?.[1] ?? null;
}
