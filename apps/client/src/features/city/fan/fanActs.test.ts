// Which things fan their acts and what each button says (docs/design/13-the-lively-layer.md section 3; docs/rules/world.md
// R-WORLD-005, R-WORLD-006): a thing whose every act lists the room's or the street's acts done at once fans them; a job,
// a route, an offer, a paper or a command keeps its chip and its sheet. Each button carries its price and the balance
// before and after as the sheet counts them, or the refusal the sheet would say.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { engineView } from "../../../shared/testing/fixtures";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import type { Thing } from "../../../shared/world/contract";
import { stageOf } from "../placeFile";
import { builtPlaces } from "../scene.testing";
import { thingsOf } from "../things";
import { fanActOf, fanAsked, fanEntriesOf, fanEntry, fanModel, pictureOf, tintOf } from "./fanActs";

function thingAt(folder: string, id: string): Thing {
  const file = builtPlaces().find((place) => place.folder === folder)?.file;
  if (file === undefined) throw new Error(`No place ${folder}.`);
  const thing = thingsOf(stageOf(file)).find((candidate) => candidate.id === id);
  if (thing === undefined) throw new Error(`No ${id} at ${folder}.`);
  return thing;
}

const COOK = "activity.cook-at-home";
const JOLLOF = "activity.cook-jollof";

/** The view with one act's option changed, as the engine would mark it. */
function withOption(view: PlayerView, id: string, change: Partial<PlayerView["activities"][number]>): PlayerView {
  return { ...view, activities: view.activities.map((option) => (option.id === id ? { ...option, ...change } : option)) };
}

describe("the things that fan", () => {
  test("[R-WORLD-005] given the family house's parlour, when its things are read, then the cooking corner fans both meals in the sheet's order, the drum its water and bath, the TV its film; the bed, Mama, the table, the papers box and the door keep their chips", () => {
    expect(fanEntriesOf(thingAt("family-house-parlour", "cooking"))?.map((one) => one.stages)).toEqual([COOK, JOLLOF]);
    expect(fanEntriesOf(thingAt("family-house-parlour", "drum"))?.map((one) => one.stages)).toEqual(["activity.fetch-water", "activity.bucket-bath"]);
    expect(fanEntriesOf(thingAt("family-house-parlour", "tv"))?.map((one) => one.stages)).toEqual(["activity.watch-tv"]);
    for (const id of ["bed", "mama", "table", "papers-box", "door", "sofa", "bag"]) expect(fanEntriesOf(thingAt("family-house-parlour", id))).toBeNull();
  });

  test("[R-WORLD-005] given the street at Ojuelegba and Bode Thomas, when their things are read, then the suya grill, the mallam's bench, the barber and the joint fan; the hub's door, the motor park and the rides keep their chips", () => {
    expect(fanEntriesOf(thingAt("ojuelegba-front", "suya"))?.map((one) => one.stages)).toEqual(["activity.buy-suya"]);
    expect(fanEntriesOf(thingAt("ojuelegba-front", "tea"))?.map((one) => one.stages)).toEqual(["activity.mallam-tea", "activity.pure-water"]);
    expect(fanEntriesOf(thingAt("bode-thomas-front", "barber"))).not.toBeNull();
    expect(fanEntriesOf(thingAt("bode-thomas-front", "joint"))?.map((one) => one.stages)).toEqual(["activity.beer-joint", "activity.night-out"]);
    for (const id of ["hub", "motor-park", "danfo", "stop"]) expect(fanEntriesOf(thingAt("ojuelegba-front", id))).toBeNull();
    // The kiosk's ticket is a paper slip, never a fan button.
    expect(fanEntriesOf(thingAt("bode-thomas-front", "kiosk"))).toBeNull();
  });

  test("[R-WORLD-005] given the hub's desks and boards, when their acts are read, then a job, a route, a course and a paper are never fan acts: a list is a list", () => {
    for (const id of ["activity.job-hunt", "activity.job-junior-dev", "activity.look-into-route", "activity.learn-tech", "activity.get-passport", "activity.play-lotto", "activity.send-money", "activity.apply-for-visa"]) expect(fanEntry(id)).toBe(false);
    for (const id of [COOK, JOLLOF, "activity.buy-suya", "activity.pure-water", "activity.nap", "activity.help-shop"]) expect(fanEntry(id)).toBe(true);
    expect(fanEntriesOf(thingAt("yaba-hub", "desk"))).toBeNull();
    expect(fanEntriesOf(thingAt("yaba-hub", "jobs"))).toBeNull();
  });

  test("[R-WORLD-005] given the mallam's bench, whose act sits the figure on it, when a fan act is made for its water, then it carries the water as its entry and keeps the seat and the pose", () => {
    const tea = thingAt("ojuelegba-front", "tea");
    const act = fanActOf(tea, "activity.pure-water");
    expect(act).toMatchObject({ kind: "sheet", stages: "activity.pure-water", pose: "sit" });
    expect(act?.more).toBeUndefined();
    expect(act?.seat).toEqual(tea.acts[0]?.seat);
  });
});

describe("the switch", () => {
  test("[R-WORLD-005] given a development build asked for ?fan=off, when the fan is asked for, then the chip stands instead; a build for players always fans", () => {
    expect(fanAsked("", true)).toBe(true);
    expect(fanAsked("?fan=off", true)).toBe(false);
    expect(fanAsked("?clock=night&fan=off", true)).toBe(false);
    expect(fanAsked("?fan=off", false)).toBe(true);
  });
});

describe("tints and pictures", () => {
  test("[R-WORLD-005] given the acts' effects and costs, when each is tinted, then a meal is food, a skill study, a gig money, a nap or a bath body, company people, and an act that changes nothing plain", () => {
    expect(tintOf(COOK)).toBe("food");
    expect(tintOf("activity.buy-suya")).toBe("food");
    expect(tintOf("activity.learn-tech")).toBe("study");
    expect(tintOf("activity.help-shop")).toBe("money");
    expect(tintOf("activity.nap")).toBe("body");
    expect(tintOf("activity.bucket-bath")).toBe("body");
    expect(tintOf("activity.mallam-tea")).toBe("people");
    expect(tintOf("activity.night-out")).toBe("people");
    expect(tintOf("activity.fill-drum")).toBe("plain");
  });

  test("[R-WORLD-005] given every act a thing of the world fans, when its picture is asked for, then it has a stand-in of its own", () => {
    const fanned = Object.keys(content.activity).filter(fanEntry);
    expect(fanned.length).toBeGreaterThan(10);
    for (const id of fanned) expect(pictureOf(id)).not.toBe(pictureOf("activity.nothing-at-all"));
  });
});

describe("what a button says", () => {
  const view = engineView("scenario.ada");
  const cooking = fanEntriesOf(thingAt("family-house-parlour", "cooking")) ?? [];

  test("[R-WORLD-006] given the cooking corner and the naira held, when its buttons are made, then each names its meal, its price and the balance before and after, as the sheet counts them", () => {
    const entries = fanModel(cooking, view, []);
    expect(entries.map((entry) => entry.id)).toEqual([COOK, JOLLOF]);
    const held = view.pockets.NGN.bank + view.pockets.NGN.cash;
    const price = view.activities.find((option) => option.id === COOK)?.cost[0]?.amount ?? 0;
    expect(price).toBeGreaterThan(0);
    expect(entries[0]).toMatchObject({ name: "Indomie and egg", tint: "food", price: formatMoney(price, "NGN"), refusal: null });
    expect(entries[0]?.balance?.before.amount).toBe(held);
    expect(entries[0]?.balance?.after.amount).toBe(held - price);
    expect(entries[0]?.balance?.after.words).toBe(formatMoney(held - price, "NGN"));
  });

  test("[R-WORLD-006] given a free act, when its button is made, then it carries no price and no balance", () => {
    const drum = fanEntriesOf(thingAt("family-house-parlour", "drum")) ?? [];
    const entries = fanModel(drum, view, []);
    expect(entries[0]?.price).toBeNull();
    expect(entries[0]?.balance).toBeNull();
  });

  test("[R-WORLD-006] [R-ACTIVITY-020] given a meal the naira cannot pay, a body spent, and an act shut by a need, when the buttons are made, then each carries the refusal the sheet would say: how much is short, You are spent, and the need", () => {
    const broke = { ...view, pockets: { ...view.pockets, NGN: { ...view.pockets.NGN, bank: 0, cash: 100_000 } } };
    const short = fanModel(cooking, broke, [])[0];
    const price = view.activities.find((option) => option.id === COOK)?.cost[0]?.amount ?? 0;
    expect(short?.refusal).toEqual({ kind: "short", words: say("ui.world.short", { amount: formatMoney(price - 100_000, "NGN") }) });
    expect(short?.balance).toBeNull();
    const spent = fanModel(cooking, withOption(view, COOK, { allowed: false, spent: true }), [])[0];
    expect(spent?.refusal).toEqual({ kind: "spent", words: say("ui.act.spent") });
    const need = { type: "quality/min", quality: "quality.tech", value: 40 } as PlayerView["activities"][number]["missing"][number];
    const locked = fanModel(cooking, withOption(view, COOK, { allowed: false, missing: [need] }), [])[0];
    expect(locked?.refusal?.kind).toBe("locked");
    expect(locked?.refusal?.words.length).toBeGreaterThan(0);
  });
});
