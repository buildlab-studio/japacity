// Calgary, Dubai and Castel Volturno (docs/design/11-calgary-dubai-and-castel-volturno.md; world:ride-abroad-and-workplace,
// streets:calgary-life-by-hand, streets:dubai-life-by-hand, streets:castel-volturno-by-hand and place:country-pass-covers-ways): each
// country's frontages with their things, its workplaces with a door, the interiors it shares with London under its own entry and its own stage
// file, its colleagues' lines in turn and the talk overheard in every place.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { uiCalgaryText } from "@japacity/content/ui/calgary";
import { uiCastelText } from "@japacity/content/ui/castel";
import { uiDubaiText } from "@japacity/content/ui/dubai";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import bigShopCanada from "../../../../public/assets/places/big-shop-canada/place.json";
import bigShopItaly from "../../../../public/assets/places/big-shop-italy/place.json";
import bigShopUae from "../../../../public/assets/places/big-shop-uae/place.json";
import bigShopUk from "../../../../public/assets/places/big-shop-uk/place.json";
import calgary from "../../../../public/assets/places/calgary-north-east/place.json";
import careHomeCanada from "../../../../public/assets/places/care-home-canada/place.json";
import castel from "../../../../public/assets/places/castel-volturno/place.json";
import churchCanada from "../../../../public/assets/places/church-canada/place.json";
import churchItaly from "../../../../public/assets/places/church-italy/place.json";
import ctrain from "../../../../public/assets/places/ctrain-station-canada/place.json";
import farm from "../../../../public/assets/places/farm-italy/place.json";
import library from "../../../../public/assets/places/library-canada/place.json";
import metro from "../../../../public/assets/places/metro-station-uae/place.json";
import naif from "../../../../public/assets/places/naif/place.json";
import officeCanada from "../../../../public/assets/places/office-canada/place.json";
import site from "../../../../public/assets/places/site-uae/place.json";
import warehouseCanada from "../../../../public/assets/places/warehouse-canada/place.json";
import { landedGame, viewAfter } from "../../../shared/testing/fixtures";
import { addLateWords } from "../../../shared/words/late";
import type { Thing } from "../../../shared/world/contract";
import { isLong } from "../../../shared/world/Lines";
import { plainActLine } from "../acts/actLines";
import { cityWords } from "../city.words";
import { crowdSize } from "../../../shared/scene/crowd";
import { crowdTuning } from "../../../shared/scene/limits";
import { heardHere } from "../overheard";
import { type PlaceFile, stageFilePath, stageOf } from "../../../shared/scene/placeFile";
import { onShift, SHIFT_ACT, shiftMarks } from "../acts/shift";
import { stagedAt } from "../../../shared/scene/staging";
import { stagedNow, thingsNow, thingSpot } from "../scene/things";
import { actEntries, frontageTests } from "./frontage.testing";
import { city, staged } from "./place.testing";
import { thingIn as thingAmong } from "../../../shared/testing/things";

/** A place's file read from its assets folder, for a folder whose name reads as a style class to the palette's walk. */
function placeJson(id: Id<"place">): unknown {
  const folder = content.place[id]?.assets ?? "";
  return JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "..", "..", "public", "assets", "places", folder, "place.json"), "utf8")) as unknown;
}
const domitiana = placeJson("place.via-domitiana");

// Each country's words ride their own chunk in the game (shared/words/late.ts); the tests add them as the city does.
for (const table of [uiCalgaryText, uiDubaiText, uiCastelText]) addLateWords(table);

const PLACES = Object.values(content.place);
const CANADA = { where: "abroad", country: "country.canada" } as const;
const UAE = { where: "abroad", country: "country.uae" } as const;
const ITALY = { where: "abroad", country: "country.italy" } as const;

function thingIn(raw: unknown, id: string): Thing {
  return thingAmong(stageOf(raw as PlaceFile).things, id);
}

/** The entry each thing's sheet opens, by thing. */
function opens(raw: unknown, id: string): (string | undefined)[] {
  return thingIn(raw, id).acts.filter((act) => act.kind === "sheet").map((act) => act.stages);
}

const FRONTAGES = [
  ["place.calgary-north-east", calgary],
  ["place.ctrain-station-canada", ctrain],
  ["place.metro-station-uae", metro],
  ["place.naif", naif],
  ["place.site-uae", site],
  ["place.castel-volturno", castel],
  ["place.via-domitiana", domitiana],
  ["place.farm-italy", farm],
] as const;

// The site's models carry no sign (its hoarding, its frame, the guard's post): held to that instead of to its boards.
describe.each(FRONTAGES)("%s", (id, raw) => {
  frontageTests(raw, id, { boards: id !== "place.site-uae" });
});

describe("Calgary's strip mall and its station", () => {
  test("[streets:calgary-life-by-hand] [world:things-are-tappable-models] given the strip mall, when its things are read, then the notice opens the hunt, the coffee shop, the African store and the barber their acts, the transfer counter money home and the bench the find, each staged here for Canada", () => {
    const acts: Record<string, string> = {
      "jobs-notice": "activity.job-hunt",
      "coffee-shop": "activity.coffee-canada",
      "naija-shop": "activity.naija-shop-canada",
      barber: "activity.barber-canada",
      transfer: "activity.send-money",
      bench: "offer.street-find-canada",
    };
    for (const [thing, act] of Object.entries(acts)) {
      expect([thing, opens(calgary, thing)]).toEqual([thing, [act]]);
      expect([thing, stagedAt(act, CANADA, PLACES)]).toEqual([thing, "place.calgary-north-east"]);
    }
    expect(cityWords(thingIn(calgary, "transfer").label)).toBe("Money transfer");
  });

  test("[city:ojuelegba-is-the-hub] given the hubs of Calgary and Castel Volturno, when their files are read, then each entry is its country's hub and its file is not the first download", () => {
    for (const [id, raw] of [["place.calgary-north-east", calgary], ["place.castel-volturno", castel]] as const) {
      const { file, entry } = staged(raw, id);
      expect([id, entry.hub, file.hub]).toEqual([id, true, false]);
    }
  });

  test("[world:ride-abroad-and-workplace] [world:things-are-tappable-models] given the African store and its transfer counter on one unit, when their things are placed, then each is marked at its own spot", () => {
    const stage = stageOf(calgary as unknown as PlaceFile);
    const spots = ["naija-shop", "transfer"].map((id) => thingSpot(stage, thingIn(calgary, id))?.join(","));
    expect(new Set(spots).size).toBe(2);
  });

  test("[place:country-pass-covers-ways] [world:things-are-tappable-models] given the CTrain station and Union station, when their machines are read, then each sells its country's month's pass, Transit pass and Zone pass, and the platform rides", () => {
    expect(opens(ctrain, "ticket-machine")).toEqual(["activity.transit-pass-canada"]);
    expect(stagedAt("activity.transit-pass-canada", CANADA, PLACES)).toBe("place.ctrain-station-canada");
    expect(opens(metro, "nol-machine")).toEqual(["activity.transit-pass-uae"]);
    expect(stagedAt("activity.transit-pass-uae", UAE, PLACES)).toBe("place.metro-station-uae");
    for (const raw of [ctrain, metro]) expect(thingIn(raw, "platform").acts.map((act) => act.kind)).toContain("ride");
  });
});

describe("Naif", () => {
  test("[streets:dubai-life-by-hand] [streets:street-shopping-abroad] [world:things-are-tappable-models] given Naif's souq frontage on Deira's arcades, when its things are read, then the stall opens the souq's shopping, the tailor the tailor and the laundry the laundry, each staged there for the UAE, under Naif's own boards", () => {
    const acts: Record<string, string> = { "spice-stall": "activity.street-shopping-uae", tailor: "activity.buy-clothes-uae", laundry: "activity.laundry-uae" };
    for (const [thing, act] of Object.entries(acts)) {
      expect([thing, opens(naif, thing)]).toEqual([thing, [act]]);
      expect([thing, stagedAt(act, UAE, PLACES)]).toEqual([thing, "place.naif"]);
    }
    const boards = stageOf(naif as unknown as PlaceFile).models.flatMap((model) => (model.signs ?? []).flat());
    expect(boards.length).toBe(7);
    expect(boards.every((key) => key.startsWith("place.naif.sign."))).toBe(true);
  });
});

describe("the coast", () => {
  test("[streets:castel-volturno-by-hand] [world:things-are-tappable-models] given the roundabout and the Domitiana, when their things are read, then the roundabout opens the hunt, the bar the coffee, the African shop its act, the call shop money home; the pickup point overtime, the Nigerian shop the evening, the barber and the stall their acts, each staged there for Italy", () => {
    const at: [unknown, string, string, Id<"place">][] = [
      [castel, "roundabout", "activity.job-hunt", "place.castel-volturno"],
      [castel, "bar", "activity.coffee-italy", "place.castel-volturno"],
      [castel, "african-shop", "activity.naija-shop-italy", "place.castel-volturno"],
      [castel, "call-shop", "activity.send-money", "place.castel-volturno"],
      [castel, "bench", "offer.street-find-italy", "place.castel-volturno"],
      [domitiana, "nigerian-shop", "activity.street-shopping-italy", "place.via-domitiana"],
      [domitiana, "barber", "activity.barber-italy", "place.via-domitiana"],
      [domitiana, "stall", "activity.buy-clothes-italy", "place.via-domitiana"],
    ];
    for (const [raw, thing, act, place] of at) {
      expect([thing, opens(raw, thing)]).toEqual([thing, [act]]);
      expect([thing, stagedAt(act, ITALY, PLACES)]).toEqual([thing, place]);
    }
    expect(opens(domitiana, "pickup")).toEqual(["activity.overtime"]);
    expect(stagedAt("activity.overtime", ITALY, PLACES, "place.via-domitiana")).toBe("place.via-domitiana");
  });
});

/** The interiors of the three countries, each under its own entry with its own stage file. */
const INTERIORS = [
  ["place.library-canada", library],
  ["place.big-shop-canada", bigShopCanada],
  ["place.big-shop-uae", bigShopUae],
  ["place.big-shop-italy", bigShopItaly],
  ["place.warehouse-canada", warehouseCanada],
  ["place.care-home-canada", careHomeCanada],
  ["place.office-canada", officeCanada],
  ["place.church-canada", churchCanada],
  ["place.church-italy", churchItaly],
] as const;

describe("the interiors with a door", () => {
  test.each(INTERIORS.map(([id]) => id))("[world:things-are-tappable-models] [world:ride-abroad-and-workplace] given %s's things, when they are read, then each name and act label has words, a plain act says a line unless the figure shows it, the door leads out, every entry content stages there opens from a thing, and its crowd is the entry's under the indoor caps", (id) => {
    const raw = INTERIORS.find(([one]) => one === id)?.[1];
    const { file, stage, entry } = staged(raw, id);
    const things = stage.things ?? [];
    expect(file.place).toBe(id);
    expect(things.length).toBeGreaterThanOrEqual(3);
    expect(things.filter((thing) => thingSpot(stage, thing) === null).map((thing) => thing.id)).toEqual([]);
    const labels = things.flatMap((thing) => [thing.label, ...thing.acts.map((act) => act.label)]);
    expect(labels.filter((label) => cityWords(label) === label)).toEqual([]);
    const plain = things.flatMap((thing) => thing.acts.filter((act) => act.kind === "plain").map((act) => ({ id: `${thing.id} ${act.id}`, says: plainActLine(thing, act) !== null, posed: act.pose !== undefined })));
    expect(plain.filter((act) => act.says === act.posed)).toEqual([]);
    expect(things.some((thing) => thing.acts.some((act) => act.kind === "out"))).toBe(true);
    const opened = new Set(actEntries(raw, id));
    expect(entry.stages.filter((one) => !opened.has(one))).toEqual([]);
    // Nothing of another country is staged from a thing here: every sheet opens an entry content stages here.
    expect([...opened].filter((one) => !entry.stages.includes(one as never))).toEqual([]);
    for (const mode of ["low", "high"] as const) expect(file.people[mode]).toBe(crowdSize(entry, mode, crowdTuning(city, "interior", false)));
  });

  test("[world:ride-abroad-and-workplace] [streets:calgary-life-by-hand] given the shared big shop in each country, when its things are read, then the trolley opens that country's weekly shop, Calgary's back aisle its winter clothes, and the tills and the staff notice are looked at, since no country but the UK holds a job there", () => {
    const shops: [unknown, string][] = [
      [bigShopCanada, "activity.weekly-shop-canada"],
      [bigShopUae, "activity.weekly-shop-uae"],
      [bigShopItaly, "activity.weekly-shop-italy"],
    ];
    for (const [raw, shop] of shops) {
      expect(opens(raw, "trolley")).toEqual([shop]);
      expect(thingIn(raw, "tills").acts.map((act) => act.kind)).toEqual(["plain"]);
      expect(thingIn(raw, "notice").acts.map((act) => act.kind)).toEqual(["plain"]);
    }
    expect(opens(bigShopCanada, "clothes")).toEqual(["activity.buy-clothes-canada"]);
    expect(stagedAt("activity.buy-clothes-canada", CANADA, PLACES)).toBe("place.big-shop-canada");
    expect(cityWords(thingIn(bigShopCanada, "clothes").label)).toBe("Winter clothes");
  });

  test("[world:ride-abroad-and-workplace] [city:places-stage-their-acts] given Calgary's workplaces and the site, when their doors are read, then each opens its job staged there for its country, the rota board opens overtime with a reader once it is done, the care home's manager's door is looked at with no senior rung, and the office's desks and glass office open the professional's and the developer's jobs", () => {
    const doors: [unknown, string, string, Id<"place">, typeof CANADA | typeof UAE][] = [
      [warehouseCanada, "clock-in", "activity.job-canada-warehouse", "place.warehouse-canada", CANADA],
      [careHomeCanada, "reception", "activity.job-canada-care-aide", "place.care-home-canada", CANADA],
      [officeCanada, "desk", "activity.job-canada-professional", "place.office-canada", CANADA],
      [officeCanada, "glass-office", "activity.job-canada-developer", "place.office-canada", CANADA],
      [site, "guard-post", "activity.job-gulf-guard", "place.site-uae", UAE],
      [site, "cleaner-trolley", "activity.job-gulf-cleaner", "place.site-uae", UAE],
    ];
    for (const [raw, thing, job, place, here] of doors) {
      expect([thing, opens(raw, thing)]).toEqual([thing, [job]]);
      expect([thing, stagedAt(job, here, PLACES)]).toEqual([thing, place]);
    }
    for (const [raw, place, here] of [[warehouseCanada, "place.warehouse-canada", CANADA], [careHomeCanada, "place.care-home-canada", CANADA], [site, "place.site-uae", UAE]] as const) {
      expect(thingIn(raw, "rota").acts.map((act) => [act.kind, act.stages ?? null, act.unless ?? null])).toEqual([
        ["sheet", "activity.overtime", null],
        ["plain", null, ["activity.overtime"]],
      ]);
      expect(stagedAt("activity.overtime", here, PLACES, place)).toBe(place);
    }
    expect(thingIn(careHomeCanada, "manager").acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(opens(farm, "table")).toEqual(["activity.job-italy-farm-cash"]);
    expect(stagedAt("activity.job-italy-farm-cash", ITALY, PLACES)).toBe("place.farm-italy");
  });

  test("[world:ride-abroad-and-workplace] [world:painted-maps-abroad] given a country's entry on a scene London keeps, when its stage file is looked for, then it is its own file beside the shared models where one is shipped, its models London's, and a place at home or one with no own file reads its assets folder's", () => {
    const shipped = (path: string) => ["places/big-shop-canada/place.json", "places/ojuelegba/place.json"].includes(path);
    const of = (id: Id<"place">) => {
      const entry = content.place[id];
      if (entry === undefined) throw new Error(id);
      return entry;
    };
    expect(of("place.big-shop-canada").assets).toBe("big-shop-uk");
    expect(stageFilePath(of("place.big-shop-canada"), shipped)).toBe("places/big-shop-canada/place.json");
    expect(stageFilePath(of("place.big-shop-uk"), shipped)).toBe("places/big-shop-uk/place.json");
    expect(stageFilePath(of("place.big-shop-uae"), shipped)).toBe("places/big-shop-uk/place.json");
    // A place at home reads its assets folder's file even where a folder of its own name holds one (city:places-load-on-entry).
    expect(stageFilePath(of("place.ojuelegba"), shipped)).toBe(`places/${of("place.ojuelegba").assets}/place.json`);
    // The shared interiors stand London's models: the same files, the same spots.
    expect(stageOf(bigShopCanada as unknown as PlaceFile).models.map((model) => model.file)).toEqual(stageOf(bigShopUk as unknown as PlaceFile).models.map((model) => model.file));
  });
});

const COLLEAGUES = [
  ["place.warehouse-canada", warehouseCanada, "colleague"],
  ["place.care-home-canada", careHomeCanada, "colleague"],
  ["place.office-canada", officeCanada, "colleague"],
  ["place.site-uae", site, "colleague"],
  ["place.farm-italy", farm, "colleague"],
] as const;

describe("the colleagues", () => {
  test.each(COLLEAGUES.map(([id]) => id))("[world:ride-abroad-and-workplace] [world:things-are-tappable-models] given the colleague at %s, when they are talked to four times, then they say their three lines in turn over their own head, eight words or fewer, and the fourth is the first again", (id) => {
    const [, raw, thing] = COLLEAGUES.find(([one]) => one === id) ?? [];
    const colleague = thingIn(raw, thing ?? "");
    const talk = colleague.acts.find((act) => act.id === "talk");
    if (talk === undefined) throw new Error(`${id}: no talk`);
    const folder = id.slice("place.".length);
    expect(talk.tells).toBe(`city.line.colleague.${folder}.1`);
    const said = [0, 1, 2, 3].map((nth) => plainActLine(colleague, talk, nth));
    expect(said.map((line) => line?.kind)).toEqual(["say", "say", "say", "say"]);
    const lines = [1, 2, 3].map((n) => cityWords(`city.line.colleague.${folder}.${String(n)}`));
    expect(said.map((line) => (line?.kind === "say" ? line.words : null))).toEqual([...lines, lines[0]]);
    expect(new Set(lines).size).toBe(3);
    const marks = [String.fromCharCode(0x2013), String.fromCharCode(0x2014), '"'];
    for (const line of lines) expect(marks.filter((mark) => line.includes(mark))).toEqual([]);
    expect(lines.filter((line) => isLong(line))).toEqual([]);
  });
});

describe("a job held at its door abroad", () => {
  test("[world:ride-abroad-and-workplace] [world:things-are-tappable-models] given a contract life in Dubai who holds the guard's job from the first morning, when the site's things are read, then the guard's post says On shift with the shift's act, and the cleaner's trolley keeps its look", () => {
    const view = viewAfter(landedGame("country.uae"), [{ type: "activity/start-job", job: "activity.job-gulf-guard" }]);
    expect(view.job.id).toBe("activity.job-gulf-guard");
    const { stage, entry } = staged(site, "place.site-uae");
    const offered = new Set(view.activities.filter((option) => option.allowed).map((option) => option.id));
    const now = thingsNow(onShift(stage.things ?? [], view.job.id, view.place.where === "abroad"), stagedNow(offered, new Set(entry.stages), new Set(), null));
    expect(now.find((thing) => thing.id === "guard-post")?.acts.map((act) => act.id)).toEqual([SHIFT_ACT, "look"]);
    expect(shiftMarks(now, cityWords("city.thing.on-shift"))).toEqual({ "guard-post": "On shift" });
    expect(now.find((thing) => thing.id === "cleaner-trolley")?.acts.map((act) => act.kind)).toEqual(["plain"]);
  });
});

describe("talk overheard in the three countries", () => {
  test("[world:ride-abroad-and-workplace] [city:overheard-talk-from-view] given the places listed for Calgary, Dubai and Castel Volturno, when its talk is read, then there are at least four lines of its own, each in words, none Lagos rumour, and the city's own float whole", () => {
    const view = viewAfter(landedGame("country.canada"), []);
    const ids: Id<"place">[] = [
      "place.calgary-north-east",
      "place.ctrain-station-canada",
      "place.big-shop-canada",
      "place.warehouse-canada",
      "place.care-home-canada",
      "place.office-canada",
      "place.library-canada",
      "place.church-canada",
      "place.metro-station-uae",
      "place.site-uae",
      "place.big-shop-uae",
      "place.castel-volturno",
      "place.via-domitiana",
      "place.farm-italy",
      "place.big-shop-italy",
      "place.church-italy",
    ];
    for (const id of ids) {
      const heard = heardHere(view, id);
      expect([id, heard.length >= 4]).toEqual([id, true]);
      expect(heard.filter((line) => line.key === "city.overheard.news" || line.key === "city.overheard.route")).toEqual([]);
      for (const line of heard) expect(cityWords(line.key)).not.toBe(line.key);
      expect(heard.filter((line) => line.key.startsWith("city.overheard.") && isLong(cityWords(line.key))).map((line) => line.key)).toEqual([]);
    }
  });
});
