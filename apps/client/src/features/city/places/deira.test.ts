// Deira as one souk frontage (city.md place.deira, world:place-is-one-screen): the gold shops' and
// the cafeteria's arcades across the road with the cafe's table under the colonnade, and on the near
// pavement the spice stall, a taxi and the corner where the community meets. It is the hub in Dubai.
import { content } from "@japacity/content";
import { uiDubaiText } from "@japacity/content/ui/dubai";
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/deira/place.json";
import site from "../../../../public/assets/places/site-uae/place.json";
import { addLateWords } from "../../../shared/words/late";
import { tidyLines } from "../../../shared/words/lines";
import { words } from "../../../shared/words/text";
import { stagedAt } from "../../../shared/scene/staging";
import { stagedNow, thingsNow } from "../scene/things";
import { frontageTests } from "./frontage.testing";
import { copiesOf, staged, wordsOf } from "./place.testing";
import { cityWords } from "../city.words";
import { thingIn } from "../../../shared/testing/things";

// Dubai's words ride their own chunk in the game (shared/words/late.ts); a test of Dubai adds them as the city does.
addLateWords(uiDubaiText);

const ID = "place.deira";
const { file, stage, entry } = staged(raw, ID);
const thing = (id: string) => thingIn(stage.things, id);

describe("Deira", () => {
  frontageTests(raw, ID);

  test("[city:ojuelegba-is-the-hub] given the hub in Dubai, when its file is read, then the entry is the country's hub and the file is not the first download", () => {
    expect(entry.hub).toBe(true);
    expect(file.hub).toBe(false);
  });

  test("[world:things-are-tappable-models] given the corner, when its act is read, then the community in Dubai opens as a sheet under its own words", () => {
    const corner = thing("corner");
    expect(corner.acts.map((act) => [act.kind, act.stages, cityWords(act.label)])).toEqual([["sheet", "activity.community-uae", "Community"]]);
    expect(stagedAt("activity.community-uae", { where: "abroad", country: "country.uae" }, Object.values(content.place))).toBe(ID);
  });

  // The souq's shopping is at Naif (streets:street-shopping-abroad), so Deira's spice stall is looked at only.
  test("[world:things-are-tappable-models] [streets:street-shopping-abroad] given the souk's other things, when they are read, then the gold shop and the spice stall are looked at, the cafe's chairs sat on with the find beside them, and the taxi opens the ride sheet", () => {
    expect(thing("gold-shop").acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(thing("spice-stall").acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(thing("cafe").acts.map((act) => [act.kind, cityWords(act.label)])).toEqual([
      ["plain", "Sit"],
      ["sheet", "See what's on"],
    ]);
    expect(thing("taxi").acts.map((act) => act.kind)).toEqual(["ride"]);
    expect(thing("taxi").file).toBe("places/deira/vehicle_taxi-dubai.glb");
  });

  // The souq stands at Naif (streets:street-shopping-abroad, streets:dubai-life-by-hand), so the stall here does not open the street shopping, which
  // Deira does not stage.
  test("[streets:street-shopping-abroad] [streets:dubai-life-by-hand] given the spice stall, when its acts are read, then it is looked at with words of its own, and the street shopping is staged at Naif for Dubai, not here", () => {
    expect(thing("spice-stall").acts.map((act) => [act.kind, act.stages ?? null])).toEqual([["plain", null]]);
    expect(cityWords(thing("spice-stall").acts[0]?.label ?? "")).not.toBe(thing("spice-stall").acts[0]?.label);
    expect(entry.stages).not.toContain("activity.street-shopping-uae");
    expect(stagedAt("activity.street-shopping-uae", { where: "abroad", country: "country.uae" }, Object.values(content.place))).toBe("place.naif");
  });

  test("[streets:street-finds-abroad] given the cafe, when the find in Dubai is open and then not, then its second act opens the find's sheet only while it is open, and Sit always stays", () => {
    const things = stage.things ?? [];
    const staged = new Set<string>(entry.stages);
    const cafe = (open: string[]) => thingsNow(things, stagedNow(new Set(), staged, new Set(open), null)).find((candidate) => candidate.id === "cafe");
    expect(cafe(["offer.street-find-uae"])?.acts.map((act) => [act.id, act.stages ?? null])).toEqual([
      ["sit", null],
      ["street-find", "offer.street-find-uae"],
    ]);
    expect(cafe([])?.acts.map((act) => act.id)).toEqual(["sit"]);
    expect(stagedAt("offer.street-find-uae", { where: "abroad", country: "country.uae" }, Object.values(content.place))).toBe(ID);
  });

  test("[city:place-words-are-text-keys] given the arcades across the road, when their boards are read, then the gold shops stand under at least two gold boards and the cafe under the cafeteria's", () => {
    const words = stage.models.flatMap((model) => (model.signs ?? []).flat()).map(wordsOf);
    expect(words.filter((said) => said.includes("GOLD")).length).toBeGreaterThanOrEqual(2);
    const lettered = stage.models.find((model) => model.file.endsWith("building_deira-arcade_b.glb"));
    const [arcade] = copiesOf(stage, "building_deira-arcade_b.glb");
    const [table] = copiesOf(stage, "prop_dining-table.glb");
    if (lettered === undefined || arcade === undefined || table === undefined) throw new Error("No cafe");
    // The cafeteria's board is the arcade's first, four metres left of its middle (buildings/deira-arcade/b).
    expect(wordsOf(lettered.signs?.[0]?.[0] ?? "")).toContain("CAFETERIA");
    expect(Math.abs(table[0] - (arcade[0] - 4))).toBeLessThan(1);
  });
});

// Work in Dubai (city:places-stage-their-acts, design page 11 section 3): the typing centre that does the labour papers opens the hunt, and the UAE's two jobs are staged at
// the site across the creek, at the guard's post and the cleaner's trolley. Both come by the agent's contract and the
// hunt never asks for them (activity.abroad.data.ts: no hire chance), so each thing there is looked at, and its job act
// opens only for a job the hunt can ask for. Deira's labour bus is looked at; the ride to the site is the site's own.
describe("Deira's jobs", () => {
  const UAE = { where: "abroad", country: "country.uae" } as const;
  const siteStaged = staged(site, "place.site-uae");
  const atSite = (id: string) => {
    const found = (siteStaged.stage.things ?? []).find((candidate) => candidate.id === id);
    if (found === undefined) throw new Error(`No ${id} at the site`);
    return found;
  };

  test("[world:things-are-tappable-models] [city:places-stage-their-acts] given the UAE's jobs, when Deira and the site are read, then the typing centre opens the hunt, Deira's site bus is looked at, and the guard's and the cleaner's jobs are at the site's post and trolley, each staged there for the UAE and both looked at", () => {
    expect(thing("agency").acts.map((act) => [act.kind, act.stages ?? null])).toEqual([
      ["sheet", "activity.job-hunt"],
      ["plain", null],
    ]);
    expect(thing("site-bus").acts.map((act) => [act.kind, act.stages ?? null])).toEqual([["plain", null]]);
    expect(thing("agency").file).toBe("places/deira/building_deira-arcade_b.glb");
    expect(thing("site-bus").file).toBe("places/deira/vehicle_labour-bus.glb");
    expect(atSite("guard-post").acts.map((act) => [act.kind, act.stages ?? null])).toEqual([
      ["sheet", "activity.job-gulf-guard"],
      ["plain", null],
    ]);
    expect(atSite("cleaner-trolley").acts.map((act) => [act.kind, act.stages ?? null])).toEqual([
      ["sheet", "activity.job-gulf-cleaner"],
      ["plain", null],
    ]);
    for (const job of ["activity.job-gulf-guard", "activity.job-gulf-cleaner"]) expect(stagedAt(job, UAE, Object.values(content.place))).toBe("place.site-uae");
    expect(stagedAt("activity.job-hunt", UAE, Object.values(content.place))).toBe(ID);
    const [, typing] = stage.models.find((model) => model.file.endsWith("building_deira-arcade_b.glb"))?.signs?.[0] ?? [];
    expect(wordsOf(typing ?? "")).toContain("TYPING CENTRE");
  });

  test("[world:things-are-tappable-models] given a Gulf job started by the agent's contract, when the hunt cannot ask for it, then its act does not show at the site and the thing keeps its look", () => {
    for (const job of ["activity.job-gulf-guard", "activity.job-gulf-cleaner"] as const) expect(content.activity[job]?.hireBp).toBeNull();
    const things = siteStaged.stage.things ?? [];
    const now = thingsNow(things, stagedNow(new Set(), new Set(siteStaged.entry.stages), new Set(), null));
    expect(now.find((candidate) => candidate.id === "guard-post")?.acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(now.find((candidate) => candidate.id === "cleaner-trolley")?.acts.map((act) => act.kind)).toEqual(["plain"]);
    const hunted = thingsNow(things, stagedNow(new Set(["activity.job-gulf-guard"]), new Set(siteStaged.entry.stages), new Set(), null));
    expect(hunted.find((candidate) => candidate.id === "guard-post")?.acts.map((act) => act.stages ?? null)).toEqual(["activity.job-gulf-guard", null]);
  });
});

// The dhow at the creek: the answer is followed by a line in the find's own words.
describe("the find by the creek", () => {
  test("[world:one-action-one-sheet] given the find answered with Stay and watch, when the taken line is told, then it is said in the find's own words", () => {
    const [said] = tidyLines([{ key: "line.offer.taken", params: { offer: "offer.street-find-uae", choice: "look" }, tone: "plain", attention: false, counts: [] }]);
    expect(said?.key).toBe("offer.street-find-uae.said.look");
    expect(words(said?.key ?? "", said?.params ?? {})).toBe("You watch them load until the light goes. One of the crew hands you sweet tea.");
  });
});
