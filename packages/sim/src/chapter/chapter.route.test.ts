// The chapters follow the way out the life leans to: docs/rules/chapter.md R-CHAPTER-009.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import type { ChapterEntry, Content, Id } from "../engine/types";
import { slot } from "../route/route.journey";
import { start } from "../testing/play";
import type { Game } from "../testing/play";
import { leanRoute } from "./chapter.logic";

const UK: Id<"route"> = "route.uk-masters";
const CARE: Id<"route"> = "route.uk-care";
const TALENT: Id<"route"> = "route.uk-talent";
const POINTS: Id<"route"> = "route.canada-points";
const GULF: Id<"route"> = "route.gulf-contract";
const SKILLED: Id<"route"> = "route.uk-skilled";
const FEET: Id<"chapter"> = "chapter.find-your-feet";
const FILE: Id<"chapter"> = "chapter.build-the-file";
const DECISION: Id<"chapter"> = "chapter.decision-day";
const LOOK = "activity.look-into-route";

function life(scenario: Id<"scenario">, used: Content = content): Game {
  return start({ scenario, content: used });
}

/** Months pass, every slot resting, until the route is heard of. */
function untilHeard(game: Game, route: Id<"route">, most = 8): void {
  for (let month = 0; month < most && game.state.route[route]?.state === "unknown"; month += 1) game.endTurn();
  expect(game.state.route[route]?.state).toBe("heard");
}

function closedTo(result: { events: { type: string }[] }): unknown {
  return result.events.find((event) => event.type === "chapter/closed");
}

describe("the file follows the lean", () => {
  test("[R-CHAPTER-009] given a nurse who has heard of the master's and of care work, when she reads the care page first and the first chapter closes, then the care file stands in for the file, with its own items and the months on the ward already ticked", () => {
    const game = life("scenario.ngozi");
    untilHeard(game, CARE);
    // The master's was heard of first: hearing alone does not decide the lean.
    expect(game.state.route[UK]?.heardMonth).toBeLessThan(game.state.route[CARE]!.heardMonth!);
    const result = game.endTurn([slot(LOOK, CARE)]);
    expect(closedTo(result)).toEqual({ type: "chapter/closed", chapter: FEET, next: "chapter.build-the-file-care" });
    expect(game.state.chapter).toEqual({ current: "chapter.build-the-file-care", done: [FEET] });
    // Ngozi has thirty months as a staff nurse: the twenty-four are in.
    expect(game.view().chapter.items).toEqual([
      { id: "tenure", met: true },
      { id: "verification", met: false },
      { id: "sponsor", met: false },
      { id: "applied", met: false },
    ]);
    expect(content.chapter["chapter.build-the-file-care"]).toMatchObject({ variantOf: FILE, route: CARE });
  });

  test("[R-CHAPTER-009] given a developer whose first meetup hears of the talent visa, when the talent page is read first and the first chapter closes, then the talent file stands in", () => {
    const game = life("scenario.zainab");
    game.endTurn([slot("activity.meetup")]);
    expect(game.state.route[TALENT]?.state).toBe("heard");
    const result = game.endTurn([slot(LOOK, TALENT)]);
    expect(closedTo(result)).toEqual({ type: "chapter/closed", chapter: FEET, next: "chapter.build-the-file-talent" });
    expect(game.view().chapter.items.map((item) => item.id)).toEqual(["portfolio", "endorsement", "applied"]);
  });

  test("[R-CHAPTER-009] given a life that asks around at the motor park and looks into the Gulf contract first, when the first chapter closes, then the Gulf file stands in", () => {
    const game = life("scenario.tunde");
    game.endTurn([slot("activity.ask-around")]);
    expect(game.state.route[GULF]?.state).toBe("heard");
    const result = game.endTurn([slot(LOOK, GULF)]);
    expect(closedTo(result)).toEqual({ type: "chapter/closed", chapter: FEET, next: "chapter.build-the-file-gulf" });
    expect(game.view().chapter.items.map((item) => item.id)).toEqual(["passport", "medical", "agent", "contract"]);
  });

  test("[R-CHAPTER-009] given a graduate who looks into Canada's points before the master's, when the first chapter closes, then the points file stands in", () => {
    const game = life("scenario.tunde");
    untilHeard(game, POINTS);
    expect(game.state.route[UK]?.state).toBe("heard");
    const result = game.endTurn([slot(LOOK, POINTS)]);
    expect(closedTo(result)).toEqual({ type: "chapter/closed", chapter: FEET, next: "chapter.build-the-file-points" });
    expect(game.view().chapter.items.map((item) => item.id)).toEqual(["eca", "english", "pool", "invited"]);
  });

  test("[R-CHAPTER-009] given a graduate on the master's, when the master's is looked into and the first chapter closes, then the file stays the master's, and looking into Canada later does not move the lean", () => {
    const game = life("scenario.tunde");
    untilHeard(game, UK);
    const result = game.endTurn([slot(LOOK, UK)]);
    expect(closedTo(result)).toEqual({ type: "chapter/closed", chapter: FEET, next: FILE });
    untilHeard(game, POINTS);
    game.endTurn([slot(LOOK, POINTS)]);
    expect(game.state.route[POINTS]?.state).toBe("known");
    expect(leanRoute(game.state.route, content)).toBe(UK);
  });

  test("[R-CHAPTER-009] given a nurse who looks into the master's before care work, when the first chapter closes, then the file is the master's: the route looked into first leads", () => {
    const game = life("scenario.ngozi");
    untilHeard(game, UK);
    const result = game.endTurn([slot(LOOK, UK)]);
    expect(closedTo(result)).toEqual({ type: "chapter/closed", chapter: FEET, next: FILE });
  });

  test("[R-CHAPTER-009] given a nurse who looks into the master's and care work in the same month, when the first chapter closes, then the page's order breaks the tie and care leads", () => {
    const game = life("scenario.ngozi");
    untilHeard(game, CARE);
    untilHeard(game, UK);
    // R-ACTIVITY-015: reading the official page runs once a month, so the two routes are looked into in
    // one month by the adviser, who looks into every route only heard of in one visit (R-ADVICE-004).
    const result = game.endTurn([slot("activity.see-adviser")]);
    expect(game.state.route[UK]?.knownMonth).toBe(game.state.route[CARE]?.knownMonth);
    expect(closedTo(result)).toEqual({ type: "chapter/closed", chapter: FEET, next: "chapter.build-the-file-care" });
  });

  test("[R-CHAPTER-009] given no way out heard of, when the lean is read, then it is the master's; given only a route with no variant looked into, then the first heard of leads", () => {
    const game = life("scenario.ngozi");
    expect(leanRoute(game.state.route, content)).toBe(UK);
    untilHeard(game, SKILLED);
    game.endTurn([slot(LOOK, SKILLED)]);
    expect(game.state.route[SKILLED]?.state).toBe("known");
    // The master's was heard of before care work, and the skilled route has no file of its own.
    expect(leanRoute(game.state.route, content)).toBe(UK);
    expect(game.state.chapter.current).toBe(FILE);
  });
});

describe("the lean is read again at each close", () => {
  /** The file closes once a job is held, so the next close can be watched without building a whole file. */
  function quickFile(used: Content): Content {
    const quick = (entry: ChapterEntry): ChapterEntry => ({ ...entry, items: [{ id: "job", requirement: { type: "job/any" } }] });
    const chapters = { ...used.chapter };
    for (const entry of Object.values(used.chapter)) if (entry.id === FILE || entry.variantOf === FILE) chapters[entry.id] = quick(entry);
    return { ...used, chapter: chapters };
  }

  test("[R-CHAPTER-009] given a nurse whose first close leaned to the master's, when she looks into care work in the file's month and the file closes, then care's decision day stands in", () => {
    const game = life("scenario.ngozi", quickFile(content));
    untilHeard(game, SKILLED);
    game.endTurn([slot(LOOK, SKILLED)]);
    expect(game.state.chapter.current).toBe(FILE);
    const result = game.endTurn([slot(LOOK, CARE)]);
    expect(closedTo(result)).toEqual({ type: "chapter/closed", chapter: FILE, next: "chapter.decision-day-care" });
    expect(game.view().chapter.items.map((item) => item.id)).toEqual(["tb", "police", "applied", "granted"]);
  });

  test("[R-CHAPTER-009] given the care file done, when a base chapter's turn is asked after, then the base counts as done and the next base's variant follows", () => {
    const game = life("scenario.ngozi", quickFile(content));
    untilHeard(game, CARE);
    game.endTurn([slot(LOOK, CARE)]);
    expect(game.state.chapter.current).toBe("chapter.build-the-file-care");
    const result = game.endTurn();
    expect(closedTo(result)).toEqual({ type: "chapter/closed", chapter: "chapter.build-the-file-care", next: "chapter.decision-day-care" });
    const read = { state: game.state, world: game.world(), content: game.content };
    expect(check(read, { type: "chapter/done", chapter: FILE }).met).toBe(true);
    expect(check(read, { type: "chapter/done", chapter: "chapter.build-the-file-care" }).met).toBe(true);
    expect(check(read, { type: "chapter/done", chapter: "chapter.build-the-file-talent" }).met).toBe(false);
    expect(check(read, { type: "chapter/done", chapter: DECISION }).met).toBe(false);
  });
});

describe("the variants in content", () => {
  test("[R-CHAPTER-009] given the variants, when they are read, then each names a base and a way out of the player's own effort, the file and decision day have one for care, talent, points and the Gulf with the page's items, and decision day closes on the grant", () => {
    const variants = Object.values(content.chapter).filter((entry) => entry.variantOf !== undefined);
    const items = (id: string) => content.chapter[id as Id<"chapter">]?.items.map((item) => item.id);
    expect(variants.map((entry) => `${entry.variantOf ?? ""} ${entry.route ?? ""}`).sort()).toEqual(
      [FILE, DECISION].flatMap((base) => [CARE, TALENT, POINTS, GULF].map((route) => `${base} ${route}`)).sort(),
    );
    expect(items("chapter.build-the-file-care")).toEqual(["tenure", "verification", "sponsor", "applied"]);
    expect(items("chapter.decision-day-care")).toEqual(["tb", "police", "applied", "granted"]);
    expect(items("chapter.build-the-file-talent")).toEqual(["portfolio", "endorsement", "applied"]);
    expect(items("chapter.decision-day-talent")).toEqual(["tb", "applied", "granted"]);
    expect(items("chapter.build-the-file-points")).toEqual(["eca", "english", "pool", "invited"]);
    expect(items("chapter.decision-day-points")).toEqual(["police", "applied", "granted"]);
    expect(items("chapter.build-the-file-gulf")).toEqual(["passport", "medical", "agent", "contract"]);
    expect(items("chapter.decision-day-gulf")).toEqual(["police", "applied", "granted"]);
    expect(variants.filter((entry) => entry.variantOf === DECISION).map((entry) => entry.closesOn)).toEqual(["granted", "granted", "granted", "granted"]);
    // The first chapter and the send-off are the same for every life.
    expect(variants.some((entry) => entry.variantOf === FEET || entry.variantOf === "chapter.send-off")).toBe(false);
  });

  test("[R-CHAPTER-009] given the care file, when its numbers are read, then the months on the ward are the council's twenty-four, the English band is 6.0 for points, and the portfolio bar is the endorsement's", () => {
    const requirement = (chapter: string, item: string) => content.chapter[chapter as Id<"chapter">]?.items.find((entry) => entry.id === item)?.requirement;
    expect(requirement("chapter.build-the-file-care", "tenure")).toEqual({ type: "activity/tenure", activities: ["activity.job-nurse"], months: 24 });
    expect(requirement("chapter.build-the-file-points", "english")).toEqual({ type: "document/held", document: "document.english-test", min: 60 });
    const bar = content.route[TALENT]?.checklist.find((item) => item.id === "portfolio")?.requirement;
    expect(requirement("chapter.build-the-file-talent", "portfolio")).toEqual(bar);
  });
});
