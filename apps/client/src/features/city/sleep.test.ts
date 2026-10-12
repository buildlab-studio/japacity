// The sleep from the bed (docs/rules/world.md R-WORLD-025, R-WORLD-005; decision 0036): one fixed length, a development
// switch that shortens it for testing, the lying pose the bed's own acts already carry, and the corner's words on waking.
import { Object3D } from "three";
import { describe, expect, test } from "vitest";

import compoundRaw from "../../../public/assets/places/compound-room/place.json";
import parlourRaw from "../../../public/assets/places/family-house-parlour/place.json";
import makokoRaw from "../../../public/assets/places/makoko/place.json";
import roomRaw from "../../../public/assets/places/the-room/place.json";
import { say } from "../../shared/words/text";
import type { Thing } from "../../shared/world/contract";
import { type PlaceFile, stageOf } from "./placeFile";
import { bedLie, NAP, othersSeen, SLEEP_MS, sleepMsOf, wakeCommand, wokeWords } from "./sleep";
import { thingsOf } from "./things";

const HOMES = { parlour: parlourRaw, compound: compoundRaw, room: roomRaw, makoko: makokoRaw } as unknown as Record<string, PlaceFile>;

describe("the sleep's length", () => {
  test("[R-WORLD-025] given no switch, when the sleep's length is read, then it is the one constant, 36 seconds", () => {
    expect(SLEEP_MS).toBe(36_000);
    expect(sleepMsOf("", true)).toBe(SLEEP_MS);
    expect(sleepMsOf("?clock=night", true)).toBe(SLEEP_MS);
  });

  test("[R-WORLD-025] given a development build asked ?sleep=4, when the sleep's length is read, then it is 4 seconds; a build for players never reads the switch", () => {
    expect(sleepMsOf("?sleep=4", true)).toBe(4_000);
    expect(sleepMsOf("?clock=night&sleep=1.5", true)).toBe(1_500);
    expect(sleepMsOf("?sleep=4", false)).toBe(SLEEP_MS);
  });

  test("[R-WORLD-025] given a switch that is no length, when the sleep's length is read, then the constant stands", () => {
    for (const asked of ["?sleep=", "?sleep=0", "?sleep=-3", "?sleep=soon", "?sleep=Infinity"]) expect(sleepMsOf(asked, true)).toBe(SLEEP_MS);
  });
});

describe("lying down to sleep", () => {
  test("[R-WORLD-005] [R-WORLD-025] given each home the game ships, when the bed's Sleep is read, then it lies on the bed as the bed's nap does, on the same seat and top", () => {
    for (const [name, file] of Object.entries(HOMES)) {
      const bed = thingsOf(stageOf(file)).find((thing) => thing.acts.some((act) => act.kind === "end"));
      if (bed === undefined) throw new Error(`${name} has no bed.`);
      const nap = bed.acts.find((act) => act.pose === "lie");
      if (nap === undefined) throw new Error(`${name}'s bed has no lying act.`);
      expect({ name, lie: bedLie(bed) }).toEqual({ name, lie: { pose: "lie", seat: nap.seat, top: nap.top } });
    }
  });

  test("[R-WORLD-005] given a bed whose nap stands down for its Lie down, when the bed's Sleep is read, then it lies as the Lie down does; a thing with no lying act has none", () => {
    const lie = { id: "lie", label: "city.act.lie", kind: "plain", pose: "lie", seat: [1, 2, 3], top: 0.5 } as const;
    const bed: Thing = { id: "bed", file: "bed.glb", copy: 0, label: "city.thing.bed", acts: [lie, { id: "end-month", label: "ui.world.end-month", kind: "end" }] } as unknown as Thing;
    expect(bedLie(bed)).toEqual({ pose: "lie", seat: [1, 2, 3], top: 0.5 });
    const chair: Thing = { id: "chair", file: "chair.glb", copy: 0, label: "city.thing.chair", acts: [{ id: "sit", label: "city.act.sit", kind: "plain", pose: "sit" }] } as unknown as Thing;
    expect(bedLie(chair)).toBeNull();
  });
});

describe("waking early", () => {
  test("[R-WORLD-025] given the view's nap allowed, when the sleep is cut short, then the nap is what is sent; while no nap can be had, nothing is", () => {
    expect(wakeCommand([{ id: NAP, allowed: true }])).toEqual({ type: "activity/now", activity: NAP, param: null });
    expect(wakeCommand([{ id: NAP, allowed: false }])).toBeNull();
    expect(wakeCommand([{ id: "activity.rest", allowed: true }])).toBeNull();
  });
});

describe("the words on waking", () => {
  test("[R-WORLD-025] given a sleep cut short, when the corner says so, then at night and in the evening the night is still yours, and by day up again is enough", () => {
    expect(say(wokeWords("night"))).toBe("Up again. The night is still yours.");
    expect(say(wokeWords("evening"))).toBe("Up again. The night is still yours.");
    expect(say(wokeWords("morning"))).toBe("Up again.");
    expect(say(wokeWords("afternoon"))).toBe("Up again.");
    expect(say("ui.sleep.chip")).toBe("Asleep · tap to wake");
    expect(say("ui.sleep.wake")).toBe("Wake up");
    expect(say("ui.world.end-month")).toBe("Sleep");
  });
});

describe("eyes closed", () => {
  test("[R-WORLD-025] given the family, a dancer and someone standing at their own thing in the place, when the sleep runs, then none of them is seen, and when it ends they are all back", () => {
    const figure = () => ({ root: new Object3D() });
    const world = { crowd: [{ figure: figure() }, { figure: figure() }], dancers: [{ figure: figure() }], standers: [figure()] };
    const roots = [...world.crowd.map((placed) => placed.figure.root), ...world.dancers.map((dancer) => dancer.figure.root), ...world.standers.map((stander) => stander.root)];
    othersSeen(world as never, false);
    expect(roots.map((root) => root.visible)).toEqual([false, false, false, false]);
    othersSeen(world as never, true);
    expect(roots.map((root) => root.visible)).toEqual([true, true, true, true]);
  });
});
