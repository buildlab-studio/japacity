// Each step of the file not yet met names its act and its place in Japa (docs/rules/world.md R-WORLD-019,
// route-gates.md R-ENDORSE-001). Z7: "Strong tech" and "People who will write for
// you" stood unticked with no act named. Z10: the TB line said "At the clinic, once the passport is held" and nothing
// of the six months it lasts. Real content, a developer played through `step`.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { applyEffects, readyLife, slot } from "../../../../../../packages/sim/src/route/route.journey";
import { renderWithView } from "../../../shared/testing/render";
import { checklistWords } from "../../../shared/words/requirement";
import { say } from "../../../shared/words/text";
import { Japa, stepWay } from "./Japa";

const TALENT: Id<"route"> = "route.uk-talent";
const CARE: Id<"route"> = "route.uk-care";

describe("the file's needs name their acts", () => {
  test("[R-ENDORSE-001] [R-WORLD-019] given a developer whose plan is the talent route, short of tech and of people who will write, when Japa shows, then each of those needs names its act and place under it, and a need met names none", async () => {
    const game = readyLife(content, { quiet: true, qualities: { "quality.tech": 85, "quality.portfolio": 5, "quality.network": 70 } });
    for (let months = 0; months < 4 && game.state.route["route.uk-masters"]!.state === "unknown"; months += 1) game.endTurn();
    applyEffects(game, [{ type: "route/hear", route: TALENT, via: "meetup" }]);
    game.endTurn([slot("activity.look-into-route", TALENT)]);
    applyEffects(game, [
      { type: "quality/add", quality: "quality.tech", amount: 50 - (game.state.quality["quality.tech"] ?? 0) },
      { type: "quality/add", quality: "quality.network", amount: 30 - (game.state.quality["quality.network"] ?? 0) },
    ]);
    const view = game.view();
    const route = view.routes.find((each) => each.id === TALENT)!;
    expect(route.checklist.filter((item) => !item.met).map((item) => item.id)).toEqual(expect.arrayContaining(["tech", "network"]));
    await renderWithView(<Japa />, { ...view, plan: { ...view.plan, route: TALENT } });
    const steps = [...document.querySelectorAll("[data-steps] li")];
    const row = (item: string) => steps.find((li) => li.textContent?.startsWith(checklistWords(TALENT, item)));
    expect(row("tech")?.querySelector("[data-step-way]")?.textContent).toBe("The coding course at the hub");
    expect(row("network")?.querySelector("[data-step-way]")?.textContent).toBe("The meetups at the hub, or a talk");
    expect(row("portfolio")?.querySelector("[data-step-way]")).toBeNull();
  });

  test("[R-ENDORSE-001] given each need of the endorsement, when its way is read, then it names an act that moves that need and the place it is taken", () => {
    // The act each way names moves the quality the need reads (R-ACTIVITY-013): the course tech, the meetup and the talk the network.
    const moves = (activity: string, quality: string) => (content.activity[activity as Id<"activity">]?.effects ?? []).some((effect) => effect.type === "quality/add" && effect.quality === quality && effect.amount > 0);
    expect(moves("activity.learn-tech", "quality.tech")).toBe(true);
    expect(moves("activity.meetup", "quality.network")).toBe(true);
    expect(moves("activity.conference-talk", "quality.network")).toBe(true);
    expect(moves("activity.build-portfolio", "quality.portfolio")).toBe(true);
    expect(moves("activity.conference-talk", "quality.portfolio")).toBe(true);
    for (const item of ["tech", "portfolio", "network"]) expect(stepWay(TALENT, { id: item, met: false }).way).toMatch(/hub/);
    expect(content.place["place.yaba"]?.stages).toEqual(expect.arrayContaining(["activity.learn-tech", "activity.meetup", "activity.build-portfolio", "activity.conference-talk"]));
  });
});

describe("the TB line says it runs out", () => {
  test("[R-DOCUMENT-004] [R-WORLD-019] given the care file and the talent file, when the TB step's line is read, then it says how long the certificate lasts, from its entry, and that it is taken last, when the application is near", () => {
    const months = content.document["document.tb-certificate"]!.validMonths!;
    for (const route of [CARE, TALENT]) {
      const way = stepWay(route, { id: "tb", met: false }).way;
      expect(way).toBe(say(`${route}.item.tb.way`, { months }));
      expect(way).toContain(`lasts ${String(months)} months`);
      expect(way).toMatch(/last of all/);
      expect(way).toMatch(/when the application is near/);
    }
    expect(stepWay(CARE, { id: "tb", met: true })).toEqual({});
  });
});
