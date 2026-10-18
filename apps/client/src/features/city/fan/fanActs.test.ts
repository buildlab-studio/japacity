// What each thing's fan holds and what each button says (docs/design/09-the-lively-layer.md section 3; docs/rules/world.md
// world:things-are-tappable-models, world:one-action-one-sheet, world:fan-of-sticker-buttons): every thing fans. The room's and the street's acts done at once are each their own
// button, priced and balanced as the sheet counts them, or refused as the sheet would; a job, a route, an offer, a paper,
// a pose, Sleep, a command or the way out is one button with its act's label and picture and no price.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { engineView } from "../../../shared/testing/fixtures";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import type { Thing } from "../../../shared/world/contract";
import { stageOf } from "../../../shared/scene/placeFile";
import { builtPlaces } from "../../../shared/scene/placeFile.testing";
import { thingsOf } from "../scene/things";
import { TILE_TABLE } from "../../../shared/tiles/tiles.data";
import { type FanEntryOf, fanActOf, fanEntriesOf, fanEntry, fanModel, glyphOf, pictureOf, tintOf } from "./fanActs";

function thingAt(folder: string, id: string): Thing {
  const file = builtPlaces().find((place) => place.folder === folder)?.file;
  if (file === undefined) throw new Error(`No place ${folder}.`);
  const thing = thingsOf(stageOf(file)).find((candidate) => candidate.id === id);
  if (thing === undefined) throw new Error(`No ${id} at ${folder}.`);
  return thing;
}

const COOK = "activity.cook-at-home";
const JOLLOF = "activity.cook-jollof";
const OWN = "activity.cook-own";
const OWN_POT = "activity.cook-own-pot";

/** The view with one act's option changed, as the engine would mark it. */
function withOption(view: PlayerView, id: string, change: Partial<PlayerView["activities"][number]>): PlayerView {
  return { ...view, activities: view.activities.map((option) => (option.id === id ? { ...option, ...change } : option)) };
}

/** Each entry as `kind:id`: the activity a `now` button sends, else the entry its act stages, else the act's id. */
function kinds(entries: readonly FanEntryOf[]): string[] {
  return entries.map((entry) => `${entry.kind}:${entry.stages ?? entry.act.id}`);
}

describe("the things that fan", () => {
  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given the family house's parlour, when its things are read, then the cooking corner fans both meals in the sheet's order, the drum its water and bath, the TV its film, as the simulation's buttons; the bed, Mama, the table, the papers box, the door, the sofa and the bag fan their acts as they stand, with no chip", () => {
    expect(kinds(fanEntriesOf(thingAt("home-family-house", "cooking")))).toEqual([`now:${COOK}`, `now:${JOLLOF}`]);
    expect(kinds(fanEntriesOf(thingAt("home-family-house", "drum")))).toEqual(["now:activity.fetch-water", "now:activity.bucket-bath"]);
    expect(kinds(fanEntriesOf(thingAt("home-family-house", "tv")))).toEqual(["now:activity.watch-tv"]);
    expect(kinds(fanEntriesOf(thingAt("home-family-house", "mattress")))).toEqual(["now:activity.nap", "act:end-month"]);
    expect(kinds(fanEntriesOf(thingAt("home-family-house", "mama")))).toEqual(["act:activity.family-time", "act:offer.nepa-bill"]);
    expect(kinds(fanEntriesOf(thingAt("home-family-house", "papers-box")))).toEqual(["act:papers"]);
    expect(kinds(fanEntriesOf(thingAt("home-family-house", "out")))).toEqual(["act:out"]);
    expect(kinds(fanEntriesOf(thingAt("home-family-house", "sofa")))).toEqual(["act:sit", "act:lie"]);
    expect(kinds(fanEntriesOf(thingAt("home-family-house", "bag")))).toEqual(["act:pack", "act:offer.send-off-party"]);
    expect(fanEntriesOf(thingAt("home-family-house", "table")).every((entry) => entry.kind === "act")).toBe(true);
  });

  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given the street at Ojuelegba and Bode Thomas, when their things are read, then the suya grill, the mallam's bench, the barber and the joint fan the simulation's buttons; the hub's door, the motor park and the rides fan their acts as single buttons", () => {
    expect(kinds(fanEntriesOf(thingAt("ojuelegba-front", "suya")))).toEqual(["now:activity.buy-suya"]);
    expect(kinds(fanEntriesOf(thingAt("ojuelegba-front", "tea")))).toEqual(["now:activity.mallam-tea", "now:activity.pure-water"]);
    expect(fanEntriesOf(thingAt("bode-thomas-front", "barber")).every((entry) => entry.kind === "now")).toBe(true);
    expect(kinds(fanEntriesOf(thingAt("bode-thomas-front", "joint")))).toEqual(["now:activity.beer-joint", "now:activity.night-out"]);
    expect(kinds(fanEntriesOf(thingAt("ojuelegba-front", "hub")))).toEqual(["act:enter", "act:chapter.find-your-feet"]);
    expect(kinds(fanEntriesOf(thingAt("ojuelegba-front", "danfo")))).toEqual(["act:ride", "act:offer.fuel-scarcity"]);
    expect(kinds(fanEntriesOf(thingAt("ojuelegba-front", "motor-park")))).toEqual(["act:activity.ask-around", "act:activity.see-agent-stop"]);
    // The kiosk's ticket is a paper slip, never one of the simulation's buttons: its act opens the slip on arrival.
    expect(kinds(fanEntriesOf(thingAt("bode-thomas-front", "kiosk")))).toEqual(["act:activity.play-lotto"]);
  });

  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given the hub's desks and boards, when their acts are read, then a job, a route, a course and a paper are never the simulation's buttons: a list is a list, one button that opens its sheet", () => {
    for (const id of ["activity.job-hunt", "activity.job-junior-dev", "activity.look-into-route", "activity.learn-tech", "activity.get-passport", "activity.play-lotto", "activity.send-money", "activity.apply-for-visa"]) expect(fanEntry(id)).toBe(false);
    for (const id of [COOK, JOLLOF, "activity.buy-suya", "activity.pure-water", "activity.nap", "activity.help-shop"]) expect(fanEntry(id)).toBe(true);
    expect(kinds(fanEntriesOf(thingAt("yaba-hub", "desk")))).toEqual(["act:activity.learn-tech", "act:activity.look-into-route"]);
    expect(kinds(fanEntriesOf(thingAt("yaba-hub", "jobs")))).toEqual(["act:activity.job-hunt"]);
  });

  test("[world:things-are-tappable-models] given the mallam's bench, whose act sits the figure on it, when a fan act is made for its water, then it carries the water as its entry and keeps the seat and the pose", () => {
    const tea = thingAt("ojuelegba-front", "tea");
    const act = fanActOf(tea, "activity.pure-water");
    expect(act).toMatchObject({ kind: "sheet", stages: "activity.pure-water", pose: "sit" });
    expect(act?.more).toBeUndefined();
    expect(act?.seat).toEqual(tea.acts[0]?.seat);
  });
});

describe("the acts' pictures", () => {
  test("[world:fan-of-sticker-buttons] given every kind of act that is no activity of its own, when its button's picture is asked for, then it is its kind's drawn glyph: sit, lie, sleep, pay, papers, pack, out, in, talk, look, ride, home and shut", () => {
    const glyph = (folder: string, thing: string, act: string): string => {
      const one = thingAt(folder, thing).acts.find((candidate) => candidate.id === act);
      if (one === undefined) throw new Error(`No ${act} on ${thing}.`);
      return pictureOf(one);
    };
    expect(glyph("home-family-house", "sofa", "sit")).toBe("act.sit");
    expect(glyph("home-family-house", "sofa", "lie")).toBe("act.lie");
    expect(glyph("home-family-house", "mattress", "end-month")).toBe("act.sleep");
    expect(glyph("home-family-house", "mama", "bills")).toBe("act.pay");
    expect(glyph("home-family-house", "papers-box", "papers")).toBe("act.papers");
    expect(glyph("home-family-house", "bag", "pack")).toBe("act.pack");
    expect(glyph("home-family-house", "out", "out")).toBe("act.out");
    expect(glyph("home-family-house", "after-service", "talk")).toBe("act.talk");
    expect(glyph("ojuelegba-front", "hub", "enter")).toBe("act.in");
    expect(glyph("ojuelegba-front", "danfo", "ride")).toBe("act.ride");
    expect(glyph("the-room", "bag", "go-home")).toBe("act.home");
    expect(glyph("computer-village", "phone-stall", "look")).toBe("act.look");
    expect(glyph("agent-office", "agent", "ask")).toBe("act.talk");
    expect(glyph("bank-counter", "counter", "deposit")).toBe("act.pay");
    expect(glyphOf({ id: "shut", kind: "plain" })).toBe("shut");
    // An act whose activity has its own tile shows it: the bed's nap, the TV, the table's study.
    expect(glyph("home-family-house", "mattress", "nap")).toBe("activity.nap");
    expect(glyph("home-family-house", "tv", "watch-tv")).toBe("activity.watch-tv");
    expect(glyph("home-family-house", "table", "study")).toBe("activity.study-english");
  });
});

describe("tints and pictures", () => {
  test("[world:things-are-tappable-models] given the acts' effects and costs, when each is tinted, then a meal is food, a skill study, a gig money, a nap or a bath body, company people, and an act that changes nothing plain", () => {
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

  test("[world:things-are-tappable-models] given every act a thing of the world fans, when its picture is asked for, then it is the act's own tile in the table, a model's render or a stand-in of its own", () => {
    const fanned = Object.keys(content.activity).filter(fanEntry);
    expect(fanned.length).toBeGreaterThan(10);
    expect(fanned.filter((id) => TILE_TABLE[id] === undefined)).toEqual([]);
  });
});

describe("what a button says", () => {
  const view = engineView("scenario.ada");
  // A home of your own's corner, whose meal and pot are bought; the family house's pot is free.
  const cooking = fanEntriesOf(thingAt("home-room-house", "cooking"));

  test("[world:one-action-one-sheet] given the cooking corner and the naira held, when its buttons are made, then each names its meal, its price and the balance before and after, as the sheet counts them", () => {
    const entries = fanModel(cooking, view, []);
    expect(entries.map((entry) => entry.id)).toEqual([OWN, OWN_POT]);
    const held = view.pockets.NGN.bank + view.pockets.NGN.cash;
    const price = view.activities.find((option) => option.id === OWN)?.cost[0]?.amount ?? 0;
    expect(price).toBeGreaterThan(0);
    expect(entries[0]).toMatchObject({ name: "Indomie and egg", tint: "food", price: formatMoney(price, "NGN"), refusal: null });
    expect(entries[0]?.balance?.before.amount).toBe(held);
    expect(entries[0]?.balance?.after.amount).toBe(held - price);
    expect(entries[0]?.balance?.after.words).toBe(formatMoney(held - price, "NGN"));
  });

  test("[world:one-action-one-sheet] given a free act, when its button is made, then it carries no price and no balance", () => {
    const drum = fanEntriesOf(thingAt("home-family-house", "drum"));
    const entries = fanModel(drum, view, []);
    expect(entries[0]?.price).toBeNull();
    expect(entries[0]?.balance).toBeNull();
  });

  test("[world:one-action-one-sheet] [activity:spent-body-refuses-acts] given a meal the naira cannot pay, a body spent, and an act shut by a need, when the buttons are made, then each carries the refusal the sheet would say: how much is short, You are spent, and the need", () => {
    const broke = { ...view, pockets: { ...view.pockets, NGN: { ...view.pockets.NGN, bank: 0, cash: 100_000 } } };
    const short = fanModel(cooking, broke, [])[0];
    const price = view.activities.find((option) => option.id === OWN)?.cost[0]?.amount ?? 0;
    expect(short?.refusal).toEqual({ kind: "short", words: say("ui.world.short", { amount: formatMoney(price - 100_000, "NGN") }) });
    expect(short?.balance).toBeNull();
    const spent = fanModel(cooking, withOption(view, OWN, { allowed: false, spent: true }), [])[0];
    expect(spent?.refusal).toEqual({ kind: "spent", words: say("ui.act.spent") });
    const need = { type: "quality/min", quality: "quality.tech", value: 40 } as PlayerView["activities"][number]["missing"][number];
    const locked = fanModel(cooking, withOption(view, OWN, { allowed: false, missing: [need] }), [])[0];
    expect(locked?.refusal?.kind).toBe("locked");
    expect(locked?.refusal?.words.length).toBeGreaterThan(0);
  });

  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given the sofa, the bed's Sleep and Mama's bill, when their buttons are made, then each names its act by its own label, carries no price, no balance and no Free, and hands the walk the thing's own act", () => {
    const sofa = fanModel(fanEntriesOf(thingAt("home-family-house", "sofa")), view, []);
    expect(sofa.map((entry) => [entry.id, entry.name, entry.kind, entry.picture, entry.tint])).toEqual([
      ["sit", "Sit", "act", "act.sit", "body"],
      ["lie", "Lie down", "act", "act.lie", "body"],
    ]);
    for (const entry of sofa) expect([entry.price, entry.balance, entry.refusal, entry.free ?? false]).toEqual([null, null, null, false]);
    expect(sofa[0]?.act).toMatchObject({ id: "sit", pose: "sit" });
    const sleep = fanModel(fanEntriesOf(thingAt("home-family-house", "mattress")), view, []).find((entry) => entry.from === "end-month");
    expect(sleep).toMatchObject({ id: "end-month", name: say("ui.world.end-month"), kind: "act", picture: "act.sleep", price: null });
    expect(sleep?.act.kind).toBe("end");
    const bills = fanModel(fanEntriesOf(thingAt("home-family-house", "mama")), view, []).find((entry) => entry.from === "bills");
    expect(bills).toMatchObject({ id: "offer.nepa-bill", name: "The bills", kind: "act", picture: "act.pay", tint: "money", price: null });
  });
});
