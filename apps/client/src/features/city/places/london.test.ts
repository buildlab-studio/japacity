// London on the Lagos mold (docs/design/14-london-on-the-lagos-mold.md; world.md R-WORLD-039, streets.md R-STREET-012,
// place.md R-PLACE-012): Rye Lane's shops, the station, and the workplaces with a door. Each workplace has the thing where
// its job is got and held, the rota board for overtime, the next rung's door, and a colleague who says a line in turn.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import bigShop from "../../../../public/assets/places/big-shop-uk/place.json";
import careHome from "../../../../public/assets/places/care-home-uk/place.json";
import church from "../../../../public/assets/places/church-uk/place.json";
import office from "../../../../public/assets/places/office-uk/place.json";
import station from "../../../../public/assets/places/peckham-rye-station/place.json";
import ryeLane from "../../../../public/assets/places/rye-lane/place.json";
import ward from "../../../../public/assets/places/ward-uk/place.json";
import warehouse from "../../../../public/assets/places/warehouse-uk/place.json";
import type { Thing } from "../../../shared/world/contract";
import { abroadView, viewAfter, abroadGame } from "../../../shared/testing/fixtures";
import { inTurn, plainActLine } from "../actLines";
import { cityWords } from "../city.words";
import { heardHere } from "../overheard";
import { stageOf, type PlaceFile } from "../placeFile";
import { sceneWords } from "../scene.words";
import { onShift, SHIFT_ACT, shiftMarks } from "../shift";
import { stagedAt } from "../staging";
import { stagedNow, thingsNow, thingSpot } from "../things";
import { actEntries, frontageTests } from "./frontageTesting";
import { staged } from "./placeTesting";

const UK = { where: "abroad", country: "country.uk" } as const;
const PLACES = Object.values(content.place);

/** The workplaces abroad, each with its file, the thing its job is got at, the jobs there and its colleague. */
const WORKPLACES = [
  { id: "place.big-shop-uk", raw: bigShop, door: "tills", jobs: ["activity.job-uk-retail-part"], rota: "notice", colleague: null },
  { id: "place.care-home-uk", raw: careHome, door: "reception", jobs: ["activity.job-uk-care"], rota: "rota", colleague: "colleague" },
  { id: "place.ward-uk", raw: ward, door: "station", jobs: ["activity.job-uk-nurse"], rota: "rota", colleague: "colleague" },
  { id: "place.warehouse-uk", raw: warehouse, door: "clock-in", jobs: ["activity.job-uk-warehouse"], rota: "rota", colleague: "colleague" },
  { id: "place.office-uk", raw: office, door: "desk", jobs: ["activity.job-uk-skilled", "activity.job-uk-graduate"], rota: null, colleague: "colleague" },
] as const;

const INTERIORS = [...WORKPLACES.map(({ id, raw }) => ({ id, raw })), { id: "place.church-uk", raw: church }] as const;

function thingsOfFile(raw: unknown): Thing[] {
  return stageOf(raw as PlaceFile).things ?? [];
}

function thingIn(raw: unknown, id: string): Thing {
  const found = thingsOfFile(raw).find((thing) => thing.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
}

describe("Rye Lane", () => {
  frontageTests(ryeLane, "place.rye-lane");

  test("[R-STREET-012] [R-STREET-005] [R-WORLD-005] given Rye Lane's shops, when their acts are read, then the chicken shop, the Nigerian shop, the barber, the clothes shop, the pub, the stalls and the transfer shop each open their own act, staged here for the UK, and the kitchen door its job", () => {
    const opens = (id: string) => thingIn(ryeLane, id).acts.find((act) => act.kind === "sheet")?.stages;
    const shops: Record<string, string> = {
      "chicken-shop": "activity.chicken-shop",
      "naija-shop": "activity.naija-shop-uk",
      barber: "activity.barber-uk",
      "clothes-shop": "activity.buy-clothes-uk",
      pub: "activity.pub-pint",
      stalls: "activity.street-shopping-uk",
      transfer: "activity.send-money",
      kitchen: "activity.job-uk-kitchen-cash",
    };
    for (const [thing, act] of Object.entries(shops)) {
      expect([thing, opens(thing)]).toEqual([thing, act]);
      expect([thing, stagedAt(act, UK, PLACES)]).toEqual([thing, "place.rye-lane"]);
    }
    expect(sceneWords(thingIn(ryeLane, "naija-shop").acts[0]?.label ?? "")).toBe("A taste of home");
  });

  test("[R-CITY-024] given Rye Lane's terraces, when their boards are read, then each shop's board is Rye Lane's own sign, never Peckham's", () => {
    const boards = stageOf(ryeLane as unknown as PlaceFile).models.flatMap((model) => (model.signs ?? []).flat());
    expect(boards.sort()).toEqual(["place.rye-lane.sign.barber", "place.rye-lane.sign.chicken", "place.rye-lane.sign.clothes", "place.rye-lane.sign.naija", "place.rye-lane.sign.transfer"]);
    for (const key of boards) expect(text[key]?.trim() ?? "").not.toBe("");
  });
});

describe("Peckham Rye station", () => {
  frontageTests(station, "place.peckham-rye-station");

  test("[R-PLACE-012] [R-WORLD-005] given the station, when its things are read, then the ticket machine sells the month's bus pass, the platform rides, and the courier's bike is the courier's job", () => {
    expect(thingIn(station, "ticket-machine").acts.map((act) => [act.kind, act.stages, sceneWords(act.label)])).toEqual([["sheet", "activity.bus-pass-uk", "Bus pass"]]);
    expect(thingIn(station, "platform").acts.map((act) => act.kind)).toEqual(["ride"]);
    expect(thingIn(station, "courier").acts[0]?.stages).toBe("activity.job-uk-courier-cash");
    expect(stagedAt("activity.bus-pass-uk", UK, PLACES)).toBe("place.peckham-rye-station");
  });
});

describe("the workplaces with a door", () => {
  test.each(INTERIORS.map(({ id }) => id))("[R-WORLD-005] [R-WORLD-039] given %s's things, when they are read, then each name and act label has words, a plain act says a line unless the figure shows it, and every entry content stages there opens from a thing", (id) => {
    const raw = INTERIORS.find((one) => one.id === id)?.raw;
    const { stage, entry } = staged(raw, id);
    const things = stage.things ?? [];
    expect(things.length).toBeGreaterThanOrEqual(3);
    expect(things.filter((thing) => thingSpot(stage, thing) === null).map((thing) => thing.id)).toEqual([]);
    const labels = things.flatMap((thing) => [thing.label, ...thing.acts.map((act) => act.label)]);
    expect(labels.filter((label) => sceneWords(label) === label)).toEqual([]);
    // A plain act says a line or a person speaks; one with a pose is seen, and says nothing (R-WORLD-005, R-TEXT-008).
    const plain = things.flatMap((thing) => thing.acts.filter((act) => act.kind === "plain").map((act) => ({ id: `${thing.id} ${act.id}`, says: plainActLine(thing, act) !== null, posed: act.pose !== undefined })));
    expect(plain.filter((act) => act.says === act.posed)).toEqual([]);
    expect(things.some((thing) => thing.acts.some((act) => act.kind === "out"))).toBe(true);
    const opened = new Set(actEntries(raw, id));
    expect(entry.stages.filter((one) => !opened.has(one))).toEqual([]);
  });

  test.each(WORKPLACES.map(({ id }) => id))("[R-WORLD-039] [R-CITY-010] given %s, when its job's thing is read, then it opens the job staged here for the UK, and the rota board opens overtime with a reader standing in once it is done", (id) => {
    const place = WORKPLACES.find((one) => one.id === id);
    if (place === undefined) throw new Error(id);
    const door = thingIn(place.raw, place.door);
    expect(door.acts.filter((act) => act.kind === "sheet").map((act) => act.stages)).toEqual([...place.jobs]);
    for (const job of place.jobs) expect(stagedAt(job, UK, PLACES)).toBe(id);
    if (place.rota === null) return;
    const rota = thingIn(place.raw, place.rota);
    expect(rota.acts.map((act) => [act.kind, act.stages ?? null, act.unless ?? null])).toEqual([
      ["sheet", "activity.overtime", null],
      ["plain", null, ["activity.overtime"]],
    ]);
    expect(stagedAt("activity.overtime", UK, PLACES, id)).toBe(id);
  });

  test("[R-WORLD-039] given the care home and the office, when the next rung is read, then the manager's door opens the senior care job and the glass office the senior developer's", () => {
    expect(thingIn(careHome, "manager").acts[0]?.stages).toBe("activity.job-uk-senior-care");
    expect(thingIn(office, "glass-office").acts[0]?.stages).toBe("activity.job-uk-senior-dev");
  });

  test.each(WORKPLACES.filter((place) => place.colleague !== null).map(({ id }) => id))("[R-WORLD-039] [R-WORLD-005] given the colleague at %s, when they are talked to four times, then they say their three lines in turn over their own head and the fourth is the first again", (id) => {
    const place = WORKPLACES.find((one) => one.id === id);
    const colleague = thingIn(place?.raw, place?.colleague ?? "");
    const talk = colleague.acts.find((act) => act.id === "talk");
    if (talk === undefined) throw new Error(`${id}: no talk`);
    const folder = id.slice("place.".length);
    expect(talk.tells).toBe(`city.line.colleague.${folder}.1`);
    const said = [0, 1, 2, 3].map((nth) => plainActLine(colleague, talk, nth));
    expect(said.map((line) => line?.kind)).toEqual(["say", "say", "say", "say"]);
    expect(said.map((line) => (line?.kind === "say" ? line.who : null))).toEqual(["colleague", "colleague", "colleague", "colleague"]);
    const lines = [1, 2, 3].map((n) => cityWords(`city.line.colleague.${folder}.${String(n)}`));
    expect(said.map((line) => (line?.kind === "say" ? line.words : null))).toEqual([...lines, lines[0]]);
    expect(new Set(lines).size).toBe(3);
    for (const line of lines) expect(line).not.toMatch(/[–—"]/);
    expect(sceneWords(colleague.label)).toBe("Colleague");
  });

  test("[R-WORLD-039] given a key that names no set, when it is told in turn, then it is itself", () => {
    expect(inTurn("city.act.read-rota.done", 3)).toBe("city.act.read-rota.done");
    expect(inTurn("city.line.colleague.ward-uk.1", 4)).toBe("city.line.colleague.ward-uk.2");
  });
});

describe("a job held at its door", () => {
  test("[R-WORLD-039] given Ada in London who took the shop job, when the big shop's things are read, then the tills stand with the shift's act and say On shift, while the trolley still offers the weekly shop", () => {
    const view = viewAfter(abroadGame(), [{ type: "activity/start-job", job: "activity.job-uk-retail-part" }]);
    const { stage, entry } = staged(bigShop, "place.big-shop-uk");
    const offered = new Set(view.activities.filter((option) => option.allowed).map((option) => option.id));
    const now = thingsNow(onShift(stage.things ?? [], view.job.id, true), stagedNow(offered, new Set(entry.stages), new Set(), null));
    const tills = now.find((thing) => thing.id === "tills");
    expect(tills?.acts.map((act) => [act.id, act.kind, sceneWords(act.label)])).toEqual([[SHIFT_ACT, "plain", "Your shift"]]);
    expect(shiftMarks(now, cityWords("city.thing.on-shift"))).toEqual({ tills: "On shift" });
    expect(plainActLine(tills as Thing, tills?.acts[0] as Thing["acts"][number])).toEqual({ kind: "tell", words: cityWords("city.act.on-shift.done") });
    // Without the shift the held job's act would leave the thing: the hunt never lists the job held.
    expect(thingsNow(stage.things ?? [], stagedNow(offered, new Set(entry.stages), new Set(), null)).find((thing) => thing.id === "tills")).toBeUndefined();
  });

  test("[R-WORLD-039] given no job held, or a job held at home, when the things are read, then nothing is turned into a shift", () => {
    const things = thingsOfFile(careHome);
    expect(onShift(things, null, true)).toEqual(things);
    expect(onShift(things, "activity.job-uk-care", false)).toEqual(things);
    expect(shiftMarks(onShift(things, "activity.job-uk-care", true), "On shift")).toEqual({ reception: "On shift" });
  });
});

describe("talk overheard in London", () => {
  test("[R-WORLD-039] [R-CITY-003] given each London place, when its talk is read, then there are at least four lines of its own and no Lagos rumour", () => {
    const view = abroadView();
    for (const id of ["place.peckham", "place.rye-lane", "place.peckham-rye-station", "place.big-shop-uk", "place.care-home-uk", "place.ward-uk", "place.office-uk", "place.warehouse-uk", "place.church-uk", "place.test-centre-uk"]) {
      const heard = heardHere(view, id);
      expect([id, heard.length >= 4]).toEqual([id, true]);
      expect(heard.filter((line) => line.key === "city.overheard.news" || line.key === "city.overheard.route")).toEqual([]);
      for (const line of heard) expect(cityWords(line.key)).not.toBe(line.key);
    }
  });
});
