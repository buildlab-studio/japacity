// Peckham rebuilt as one frontage on Rye Lane (city.md place.peckham, world.md R-WORLD-011): the
// shops across the road with the grocer's produce out front and the hair shop beside it, and on the
// near pavement the bus stop and a bench. It is the hub abroad in London; the community act is staged
// in the room abroad, not here.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/peckham/place.json";
import room from "../../../../public/assets/places/the-room/place.json";
import { abroadGame, abroadView, openOffer, recordedGame, viewAfter } from "../../../shared/testing/fixtures";
import { tidyLines } from "../../../shared/words/lines";
import { words } from "../../../shared/words/text";
import { stageOf, type PlaceFile } from "../placeFile";
import { sceneWords } from "../scene.words";
import { stagedAt } from "../staging";
import { stagedNow, thingSpot, thingsNow } from "../things";
import { frontageTests } from "./frontageTesting";
import { copiesOf, staged, wordsOf } from "./placeTesting";

const ID = "place.peckham";
const { file, stage, entry } = staged(raw, ID);
const thing = (id: string) => {
  const found = (stage.things ?? []).find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
};

describe("Peckham", () => {
  frontageTests(raw, ID);

  test("[R-CITY-013] given the hub abroad in London, when its file is read, then the entry is the country's hub and the file is not the first download, and the community act waits in the room abroad", () => {
    expect(entry.hub).toBe(true);
    expect(file.hub).toBe(false);
    const window = (stageOf(room as unknown as PlaceFile).things ?? []).flatMap((candidate) => candidate.acts.map((act) => act.stages));
    expect(window).toContain("activity.community-uk");
  });

  test("[R-WORLD-005] given Rye Lane's things, when they are read, then the grocer is shopped at and looked at, the barber looked at, the bench sat on with the find beside it, and the bus stop opens the ride sheet", () => {
    expect(thing("grocer").acts.map((act) => act.kind)).toEqual(["sheet", "plain"]);
    expect(thing("barber").acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(thing("bench").acts.map((act) => [act.kind, sceneWords(act.label)])).toEqual([
      ["plain", "Sit"],
      ["sheet", "See what's on"],
    ]);
    expect(thing("stop").acts.map((act) => act.kind)).toEqual(["ride"]);
    expect(thing("bench").file.endsWith("prop_street-bench.glb")).toBe(true);
    expect(thing("stop").file.endsWith("prop_bus-shelter.glb")).toBe(true);
  });

  test("[R-STREET-005] given the grocer, when its first act is read, then Shop opens the street shopping's sheet, staged here for the UK", () => {
    expect(thing("grocer").acts[0]).toMatchObject({ id: "shop", kind: "sheet", stages: "activity.street-shopping-uk" });
    expect(sceneWords(thing("grocer").acts[0]?.label ?? "")).toBe("Shop");
    expect(stagedAt("activity.street-shopping-uk", { where: "abroad", country: "country.uk" }, Object.values(content.place))).toBe(ID);
  });

  test("[R-STREET-006] given the bench, when the find in the UK is open and then not, then its second act opens the find's sheet only while it is open, and Sit always stays", () => {
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

  test("[R-CITY-024] given the terraces across the road, when their boards are read, then the grocer's and the hair shop's boards stand over them, with the Nigerian restaurant along the row", () => {
    const boards = stage.models.flatMap((model) => (model.signs ?? []).flat());
    const words = boards.map(wordsOf);
    expect(words.some((said) => said.includes("AFRO-CARIBBEAN"))).toBe(true);
    expect(words.some((said) => said.includes("HAIR"))).toBe(true);
    expect(words.some((said) => said.includes("NIGERIAN RESTAURANT"))).toBe(true);
    const [grocer] = copiesOf(stage, thing("grocer").file.split("/").pop() ?? "");
    const [terrace] = copiesOf(stage, "bld_rye-lane-terrace_a.glb");
    const lettered = stage.models.find((model) => model.file.endsWith("bld_rye-lane-terrace_a.glb"));
    if (grocer === undefined || terrace === undefined || lettered === undefined) throw new Error("No grocer or terrace");
    expect(wordsOf(lettered.signs?.[0]?.[2] ?? "")).toContain("AFRO-CARIBBEAN");
    // The grocer's board is the row's third, five metres right of its middle (bld/rye-lane-terrace).
    expect(Math.abs(grocer[0] - (terrace[0] + 5))).toBeLessThan(1);
  });

  test("[R-WORLD-011] given the bus stop and the bench, when the near pavement is read, then both stand between the kerb and the player's start", () => {
    const kerb = Math.max(...stage.roads.filter((road) => road.raise !== undefined && road.raise > 0.1).map((road) => road.at[1]));
    for (const id of ["stop", "bench"]) {
      const [, z] = copiesOf(stage, thing(id).file.split("/").pop() ?? "")[0] ?? [0, 0];
      expect(z).toBeGreaterThan(kerb);
      expect(z).toBeLessThan(stage.start[1]);
    }
  });
});

// Work at Peckham: the UK jobs the hunt can ask for are staged at a jobs
// notice by the grocer and a job agency's stand, so a job open to the player is an act there.
describe("Peckham's jobs", () => {
  const UK = { where: "abroad", country: "country.uk" } as const;
  const NOTICE = ["activity.job-uk-retail-part", "activity.job-uk-kitchen-cash"];
  const AGENCY = ["activity.job-uk-senior-care", "activity.job-uk-nurse", "activity.job-uk-warehouse"];

  test("[R-WORLD-005] [R-CITY-010] given the UK's hunted jobs, when Peckham is read, then shop and kitchen work are on the jobs notice by the grocer and care and warehouse work at the agency, each staged here for the UK and opened as the hunt's card", () => {
    expect(thing("jobs-notice").acts.map((act) => [act.kind, act.stages, ...(act.more ?? [])])).toEqual([
      ["sheet", "activity.job-uk-retail-part"],
      ["sheet", "activity.job-uk-kitchen-cash"],
    ]);
    expect(thing("jobs-notice").acts.map((act) => sceneWords(act.label))).toEqual(["Shop work", "Kitchen work"]);
    expect(thing("agency").acts.map((act) => [act.kind, act.stages, ...(act.more ?? [])])).toEqual([
      ["sheet", "activity.job-uk-senior-care", "activity.job-uk-nurse"],
      ["sheet", "activity.job-uk-warehouse"],
    ]);
    expect(thing("agency").acts.map((act) => sceneWords(act.label))).toEqual(["Care work", "Warehouse"]);
    for (const job of [...NOTICE, ...AGENCY]) {
      expect(content.activity[job as keyof typeof content.activity]?.hireBp ?? null).not.toBeNull();
      expect(stagedAt(job, UK, Object.values(content.place))).toBe(ID);
    }
    expect(sceneWords(thing("jobs-notice").label)).toBe("Jobs notice");
    expect(sceneWords(thing("agency").label)).toBe("Job agency");
  });

  test("[R-WORLD-005] given Ada landed in London on a student visa, when the hunt's jobs are read at Peckham, then the jobs notice offers the shop job alone and the agency stands without an act", () => {
    const view = abroadView();
    const hunt = view.activities.find((option) => option.id === "activity.job-hunt");
    expect(hunt?.allowed).toBe(true);
    const jobs = hunt?.params ?? [];
    expect(jobs).toEqual(["activity.job-uk-retail-part"]);
    const offered = new Set([...view.activities.filter((option) => option.allowed).map((option) => option.id), ...jobs]);
    const now = thingsNow(stage.things ?? [], stagedNow(offered, new Set(entry.stages), new Set(), null));
    expect(now.find((candidate) => candidate.id === "jobs-notice")?.acts.map((act) => act.stages)).toEqual(["activity.job-uk-retail-part"]);
    expect(now.find((candidate) => candidate.id === "agency")).toBeUndefined();
  });

  test("[R-WORLD-005] given Ada in London on a graduate visa, when the hunt's jobs are read at Peckham, then the agency stands with Warehouse, the act a tap turns into the hunt's card with that job, and the notice keeps shop and kitchen work", () => {
    // a student's hunt asks for none of its jobs. Open work brings it.
    const view = viewAfter(recordedGame("ada-careful"), [{ type: "status/grant", status: "status.uk-graduate" }]);
    const jobs = view.activities.find((option) => option.id === "activity.job-hunt")?.params ?? [];
    expect(jobs).toContain("activity.job-uk-warehouse");
    // The care job asks for care work done before (two years in it), so on open work alone it is not yet asked for.
    expect(jobs).not.toContain("activity.job-uk-senior-care");
    const offered = new Set([...view.activities.filter((option) => option.allowed).map((option) => option.id), ...jobs]);
    const now = thingsNow(stage.things ?? [], stagedNow(offered, new Set(entry.stages), new Set(), null));
    const agency = now.find((candidate) => candidate.id === "agency");
    expect(agency?.acts.map((act) => [act.id, act.kind, act.stages, sceneWords(act.label)])).toEqual([["warehouse-work", "sheet", "activity.job-uk-warehouse", "Warehouse"]]);
    expect(sceneWords(agency?.label ?? "")).toBe("Job agency");
    // City.tsx turns a sheet act whose entry is among the hunt's jobs into the hunt's card with that job chosen.
    expect(jobs).toContain(agency?.acts[0]?.stages);
    expect(now.find((candidate) => candidate.id === "jobs-notice")?.acts.map((act) => act.stages)).toEqual(["activity.job-uk-retail-part", "activity.job-uk-kitchen-cash"]);
  });

  test("[R-WORLD-011] given the jobs notice and the agency, when the pavements are read, then the notice stands on the far pavement before the shops and the agency's stand on the near one, each on its own copy", () => {
    const [notice] = copiesOf(stage, "prop_jobs-board.glb");
    const [stand] = copiesOf(stage, "prop_stall.glb");
    if (notice === undefined || stand === undefined) throw new Error("No notice or stand");
    expect(notice[1]).toBeLessThan(-3.3);
    expect(stand[1]).toBeGreaterThan(3.3);
    expect(stand[1]).toBeLessThan(stage.start[1]);
  });
});

// Once hired the notice stays. On a student visa the hunt lists only the shop job,
// and the hunt never lists the job held (activity.logic.ts huntableJobs), so once the shop job is taken
// neither of the notice's acts can open; the notice's reader stands in for them, as the agent's ask does at
// his desk, and the notice keeps its label at the same copy.
describe("Peckham's notice once hired", () => {
  const NOTICE = ["activity.job-uk-retail-part", "activity.job-uk-kitchen-cash"];
  const read = (view: ReturnType<typeof abroadView>) => {
    const jobs = view.activities.find((option) => option.id === "activity.job-hunt")?.params ?? [];
    const offered = new Set([...view.activities.filter((option) => option.allowed).map((option) => option.id), "activity.job-hunt", ...jobs]);
    return thingsNow(stage.things ?? [], stagedNow(offered, new Set(entry.stages), new Set(), null)).filter((candidate) => candidate.file === thing("jobs-notice").file && candidate.copy === thing("jobs-notice").copy);
  };

  test("[R-WORLD-005] given Ada in London who took the shop job, when Peckham's things are read, then the jobs notice still stands with one act to read it, and its line says nothing new on it is open to her", () => {
    const view = viewAfter(abroadGame(), [{ type: "activity/start-job", job: "activity.job-uk-retail-part" }]);
    expect(view.job.id).toBe("activity.job-uk-retail-part");
    const notice = read(view);
    expect(notice.map((candidate) => sceneWords(candidate.label))).toEqual(["Jobs notice"]);
    expect(notice[0]?.acts.map((act) => [act.kind, sceneWords(act.label)])).toEqual([["plain", "Read"]]);
    expect(sceneWords(`${notice[0]?.acts[0]?.label ?? ""}.done`)).toBe("Shop work and kitchen work, by the till. Nothing new on it is open to you this month.");
  });

  test("[R-WORLD-005] given Ada just landed with the shop job open, when the notice is read, then its job acts show and the reader is gone; it names every job the notice holds", () => {
    const notice = read(abroadView());
    expect(notice.map((candidate) => candidate.id)).toEqual(["jobs-notice"]);
    const reader = (stage.things ?? []).find((candidate) => candidate.id === "jobs-notice-read");
    expect([...((reader?.acts[0] as { unless?: string[] } | undefined)?.unless ?? [])].sort()).toEqual([...NOTICE].sort());
    expect(thingSpot(stage, reader ?? thing("jobs-notice"))).toEqual(thingSpot(stage, thing("jobs-notice")));
  });
});

// The market behind the station: an answer that is followed by a line in the find's own words.
describe("the market's find in London", () => {
  test("[R-WORLD-006] given the find open, when Ada has a look, then the line the engine tells is said in the find's own words for that answer", () => {
    const game = abroadGame();
    const offer = openOffer(game, "offer.street-find-uk");
    expect(offer.choices.map((choice) => choice.id)).toContain("look");
    const reply = game.accept({ type: "offer/choose", offer: offer.id, choice: "look" });
    if (!reply.ok) throw new Error("The look was refused.");
    const said = tidyLines(reply.lines).filter((line) => line.key.startsWith("offer.street-find-uk.said."));
    expect(said.map((line) => words(line.key, line.params))).toEqual(["You buy puff-puff and stay for the suya. For an hour it feels like home."]);
  });
});
