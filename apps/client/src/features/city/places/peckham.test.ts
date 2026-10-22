// Peckham as one frontage on Rye Lane (city.md place.peckham, world:place-is-one-screen): the
// shops across the road with the grocer's produce out front and the hair shop beside it, and on the
// near pavement the bus stop and a bench. It is the hub abroad in London; the community act is staged
// in the room abroad, not here. London is on the Lagos mold (design page 10, world:ride-abroad-and-workplace, streets.md
// streets:street-shopping-abroad): the stalls are on Rye Lane and each job is at its own workplace's door, so the notice and the agency
// start the hunt and the grocer is looked at.
import { content } from "@japacity/content";
import { uiLondonText } from "@japacity/content/ui/london";
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/peckham/place.json";
import room from "../../../../public/assets/places/the-room/place.json";
import { abroadGame, abroadView, openOffer, recordedGame, viewAfter } from "../../../shared/testing/fixtures";
import { tidyLines } from "../../../shared/words/lines";
import { words } from "../../../shared/words/text";
import { stageOf, type PlaceFile } from "../../../shared/scene/placeFile";
import { stagedAt } from "../../../shared/scene/staging";
import { stagedNow, thingSpot, thingsNow } from "../scene/things";
import { frontageTests } from "./frontage.testing";
import { copiesOf, staged, wordsOf } from "./place.testing";
import { addLateWords } from "../../../shared/words/late";
import { cityWords } from "../city.words";
import { thingIn } from "../../../shared/testing/things";

// London's words ride their own chunk in the game (shared/words/late.ts); a test of London adds them as the city does.
addLateWords(uiLondonText);

const ID = "place.peckham";
const { file, stage, entry } = staged(raw, ID);
const thing = (id: string) => thingIn(stage.things, id);

describe("Peckham", () => {
  frontageTests(raw, ID);

  test("[city:ojuelegba-is-the-hub] given the hub abroad in London, when its file is read, then the entry is the country's hub and the file is not the first download, and the community act waits in the room abroad", () => {
    expect(entry.hub).toBe(true);
    expect(file.hub).toBe(false);
    const window = (stageOf(room as unknown as PlaceFile).things ?? []).flatMap((candidate) => candidate.acts.map((act) => act.stages));
    expect(window).toContain("activity.community-uk");
  });

  test("[world:things-are-tappable-models] given Peckham's things, when they are read, then the grocer is looked at, the barber looked at, the bench sat on with the find beside it, and the bus stop opens the ride sheet", () => {
    expect(thing("grocer").acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(thing("barber").acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(thing("bench").acts.map((act) => [act.kind, cityWords(act.label)])).toEqual([
      ["plain", "Sit"],
      ["sheet", "See what's on"],
    ]);
    expect(thing("stop").acts.map((act) => act.kind)).toEqual(["ride"]);
    expect(thing("bench").file.endsWith("prop_street-bench.glb")).toBe(true);
    expect(thing("stop").file.endsWith("prop_bus-shelter.glb")).toBe(true);
  });

  test("[streets:street-shopping-abroad] given the grocer, when its act is read, then it is a look that tells a line, and the street shopping is staged on Rye Lane's stalls, not here", () => {
    expect(thing("grocer").acts.map((act) => [act.id, act.kind, act.stages ?? null])).toEqual([["look", "plain", null]]);
    expect(cityWords(`${thing("grocer").acts[0]?.label ?? ""}.done`)).not.toBe(`${thing("grocer").acts[0]?.label ?? ""}.done`);
    expect(stagedAt("activity.street-shopping-uk", { where: "abroad", country: "country.uk" }, Object.values(content.place))).toBe("place.rye-lane");
    expect(entry.stages).not.toContain("activity.street-shopping-uk");
  });

  test("[streets:street-finds-abroad] given the bench, when the find in the UK is open and then not, then its second act opens the find's sheet only while it is open, and Sit always stays", () => {
    const things = stage.things ?? [];
    const staged = new Set<string>(entry.stages);
    const bench = (open: string[]) => thingsNow(things, stagedNow(new Set(), staged, new Set(open), null)).find((candidate) => candidate.id === "bench");
    expect(bench(["offer.street-find-uk"])?.acts.map((act) => [act.id, act.stages ?? null])).toEqual([
      ["sit", null],
      ["street-find", "offer.street-find-uk"],
    ]);
    expect(bench([])?.acts.map((act) => act.id)).toEqual(["sit"]);
    expect(stagedAt("offer.street-find-uk", { where: "abroad", country: "country.uk" }, Object.values(content.place))).toBe(ID);
  });

  test("[city:place-words-are-text-keys] given the terraces across the road, when their boards are read, then the grocer's and the hair shop's boards stand over them, with the Nigerian restaurant along the row", () => {
    const boards = stage.models.flatMap((model) => (model.signs ?? []).flat());
    const words = boards.map(wordsOf);
    expect(words.some((said) => said.includes("AFRO-CARIBBEAN"))).toBe(true);
    expect(words.some((said) => said.includes("HAIR"))).toBe(true);
    expect(words.some((said) => said.includes("NIGERIAN RESTAURANT"))).toBe(true);
    const [grocer] = copiesOf(stage, thing("grocer").file.split("/").pop() ?? "");
    const [terrace] = copiesOf(stage, "building_rye-lane-terrace_a.glb");
    const lettered = stage.models.find((model) => model.file.endsWith("building_rye-lane-terrace_a.glb"));
    if (grocer === undefined || terrace === undefined || lettered === undefined) throw new Error("No grocer or terrace");
    expect(wordsOf(lettered.signs?.[0]?.[2] ?? "")).toContain("AFRO-CARIBBEAN");
    // The grocer's board is the row's third, five metres right of its middle (buildings/rye-lane-terrace).
    expect(Math.abs(grocer[0] - (terrace[0] + 5))).toBeLessThan(1);
  });

  test("[world:place-is-one-screen] given the bus stop and the bench, when the near pavement is read, then both stand between the kerb and the player's start", () => {
    const kerb = Math.max(...stage.roads.filter((road) => road.raise !== undefined && road.raise > 0.1).map((road) => road.at[1]));
    for (const id of ["stop", "bench"]) {
      const [, z] = copiesOf(stage, thing(id).file.split("/").pop() ?? "")[0] ?? [0, 0];
      expect(z).toBeGreaterThan(kerb);
      expect(z).toBeLessThan(stage.start[1]);
    }
  });
});

// Work at Peckham (world:ride-abroad-and-workplace): the jobs notice by the grocer and the
// job agency's stand start the hunt, whose card names every job open to the player; each UK job is got and held at its
// own workplace (the tills, the kitchen door, the courier's bike, the reception, the nurses' station, the clock-in, the desks).
describe("Peckham's jobs", () => {
  const UK = { where: "abroad", country: "country.uk" } as const;
  const PLACES = Object.values(content.place);
  const DOORS: Readonly<Record<string, string>> = {
    "activity.job-uk-retail-part": "place.big-shop-uk",
    "activity.job-uk-kitchen-cash": "place.rye-lane",
    "activity.job-uk-courier-cash": "place.peckham-rye-station",
    "activity.job-uk-care": "place.care-home-uk",
    "activity.job-uk-senior-care": "place.care-home-uk",
    "activity.job-uk-nurse": "place.ward-uk",
    "activity.job-uk-warehouse": "place.warehouse-uk",
    "activity.job-uk-skilled": "place.office-uk",
    "activity.job-uk-graduate": "place.office-uk",
    "activity.job-uk-senior-developer": "place.office-uk",
  };

  test("[world:things-are-tappable-models] [world:ride-abroad-and-workplace] [city:places-stage-their-acts] given the UK's jobs, when Peckham is read, then the jobs notice and the agency each open the hunt staged here, the agency also takes a question, and every job is staged at its own workplace", () => {
    expect(thing("jobs-notice").acts.map((act) => [act.kind, act.stages, cityWords(act.label)])).toEqual([["sheet", "activity.job-hunt", "Jobs"]]);
    expect(thing("agency").acts.map((act) => [act.kind, act.stages ?? null, cityWords(act.label)])).toEqual([
      ["sheet", "activity.job-hunt", "Jobs"],
      ["plain", null, "Ask"],
    ]);
    expect(stagedAt("activity.job-hunt", UK, PLACES)).toBe(ID);
    // The jobs a hunt asks for each carry a hire chance.
    for (const job of ["activity.job-uk-retail-part", "activity.job-uk-kitchen-cash", "activity.job-uk-senior-care", "activity.job-uk-nurse", "activity.job-uk-warehouse"]) {
      expect(content.activity[job as keyof typeof content.activity]?.hireBp ?? null).not.toBeNull();
    }
    for (const [job, door] of Object.entries(DOORS)) expect([job, stagedAt(job, UK, PLACES)]).toEqual([job, door]);
    expect(entry.stages.filter((id) => id.startsWith("activity.job-uk-"))).toEqual([]);
    expect(cityWords(thing("jobs-notice").label)).toBe("Jobs notice");
    expect(cityWords(thing("agency").label)).toBe("Job agency");
  });

  test("[world:things-are-tappable-models] given the graduate landed in London on a student visa, when Peckham's things are read, then the notice and the agency open the hunt, whose card asks for the shop job, and the agency's question stays", () => {
    const view = abroadView();
    const hunt = view.activities.find((option) => option.id === "activity.job-hunt");
    expect(hunt?.allowed).toBe(true);
    expect(hunt?.params ?? []).toEqual(["activity.job-uk-retail-part"]);
    const offered = new Set(view.activities.filter((option) => option.allowed).map((option) => option.id));
    const now = thingsNow(stage.things ?? [], stagedNow(offered, new Set(entry.stages), new Set(), null));
    expect(now.find((candidate) => candidate.id === "jobs-notice")?.acts.map((act) => act.stages)).toEqual(["activity.job-hunt"]);
    expect(now.find((candidate) => candidate.id === "agency")?.acts.map((act) => act.id)).toEqual(["hunt", "ask"]);
    expect(now.find((candidate) => candidate.id === "jobs-notice-read")).toBeUndefined();
  });

  test("[world:things-are-tappable-models] given the graduate in London on a graduate visa, when the hunt's jobs are read, then the warehouse job is among them, a tap at the warehouse's clock-in names it on the hunt's card, and the agency still opens the hunt", () => {
    // A student's hunt asks for none of the agency's jobs; open work brings them.
    const view = viewAfter(recordedGame("graduate-careful"), [{ type: "status/grant", status: "status.uk-graduate" }]);
    const jobs = view.activities.find((option) => option.id === "activity.job-hunt")?.params ?? [];
    expect(jobs).toContain("activity.job-uk-warehouse");
    // The care job asks for care work done before (two years in it), so on open work alone it is not yet asked for.
    expect(jobs).not.toContain("activity.job-uk-senior-care");
    expect(stagedAt("activity.job-uk-warehouse", UK, PLACES)).toBe("place.warehouse-uk");
    const offered = new Set(view.activities.filter((option) => option.allowed).map((option) => option.id));
    const agency = thingsNow(stage.things ?? [], stagedNow(offered, new Set(entry.stages), new Set(), null)).find((candidate) => candidate.id === "agency");
    expect(agency?.acts[0]).toMatchObject({ kind: "sheet", stages: "activity.job-hunt" });
  });

  test("[world:place-is-one-screen] given the jobs notice and the agency, when the pavements are read, then the notice stands on the far pavement before the shops and the agency's stand on the near one, each on its own copy", () => {
    const [notice] = copiesOf(stage, "prop_jobs-board.glb");
    const [stand] = copiesOf(stage, "prop_stall.glb");
    if (notice === undefined || stand === undefined) throw new Error("No notice or stand");
    expect(notice[1]).toBeLessThan(-3.3);
    expect(stand[1]).toBeGreaterThan(3.3);
    expect(stand[1]).toBeLessThan(stage.start[1]);
  });
});

// Once hired the notice stays. On a student visa the hunt lists only the shop job, and the hunt
// never lists the job held (activity.logic.ts huntableJobs), so once the shop job is taken the hunt cannot open; the
// notice's reader stands in for it, as the agent's ask does at his desk, and the notice keeps its label at the same copy.
describe("Peckham's notice once hired", () => {
  const read = (view: ReturnType<typeof abroadView>) => {
    const offered = new Set(view.activities.filter((option) => option.allowed).map((option) => option.id));
    return thingsNow(stage.things ?? [], stagedNow(offered, new Set(entry.stages), new Set(), null)).filter((candidate) => candidate.file === thing("jobs-notice").file && candidate.copy === thing("jobs-notice").copy);
  };

  test("[world:things-are-tappable-models] given the graduate in London who took the shop job, when Peckham's things are read, then the jobs notice still stands with one act to read it, and its line says nothing new on it is open to it", () => {
    const view = viewAfter(abroadGame(), [{ type: "activity/start-job", job: "activity.job-uk-retail-part" }]);
    expect(view.job.id).toBe("activity.job-uk-retail-part");
    const notice = read(view);
    expect(notice.map((candidate) => cityWords(candidate.label))).toEqual(["Jobs notice"]);
    expect(notice[0]?.acts.map((act) => [act.kind, cityWords(act.label)])).toEqual([["plain", "Read"]]);
    expect(cityWords(`${notice[0]?.acts[0]?.label ?? ""}.done`)).toBe("Shops, kitchens, care homes, warehouses. Nothing new on it is open to you this month.");
  });

  test("[world:things-are-tappable-models] given the graduate just landed with the shop job open, when the notice is read, then its hunt shows and the reader is gone, the reader standing in only while the hunt cannot open", () => {
    const notice = read(abroadView());
    expect(notice.map((candidate) => candidate.id)).toEqual(["jobs-notice"]);
    const reader = (stage.things ?? []).find((candidate) => candidate.id === "jobs-notice-read");
    expect((reader?.acts[0] as { unless?: string[] } | undefined)?.unless ?? []).toEqual(["activity.job-hunt"]);
    expect(thingSpot(stage, reader ?? thing("jobs-notice"))).toEqual(thingSpot(stage, thing("jobs-notice")));
  });
});

// The market behind the station: an answer that is followed by a line in the find's own words.
describe("the market's find in London", () => {
  test("[world:one-action-one-sheet] given the find open, when the graduate has a look, then the line the engine tells is said in the find's own words for that answer", () => {
    const game = abroadGame();
    const offer = openOffer(game, "offer.street-find-uk");
    expect(offer.choices.map((choice) => choice.id)).toContain("look");
    const reply = game.accept({ type: "offer/choose", offer: offer.id, choice: "look" });
    if (!reply.ok) throw new Error("The look was refused.");
    const said = tidyLines(reply.lines).filter((line) => line.key.startsWith("offer.street-find-uk.said."));
    expect(said.map((line) => words(line.key, line.params))).toEqual(["You buy puff-puff and stay for the suya. For an hour it feels like home."]);
  });
});
