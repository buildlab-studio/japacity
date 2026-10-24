// Each step of the file not yet met names its act and its place in Japa (world:phone-holds-what-phones-hold,
// route-gates:applying-for-endorsement): "Strong tech" and "People who will write for you" never stand unticked with no act
// named, and the TB line says the six months it lasts, not only "At the clinic, once the passport is held". Real
// content, a developer played through `step`.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { applyEffects, readyLife, slot } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { renderWithView } from "../../../shared/testing/render";
import { checklistWords } from "../../../shared/words/requirement";
import { say } from "../../../shared/words/text";
import { Japa, stepWay } from "./Japa";

const TALENT: Id<"route"> = "route.uk-talent";
const CARE: Id<"route"> = "route.uk-care";

describe("the file's needs name their acts", () => {
  test("[route-gates:applying-for-endorsement] [world:phone-holds-what-phones-hold] given a developer whose plan is the talent route, short of tech and of people who will write, when Japa shows, then each of those needs names its act and place under it, and a need met names none", async () => {
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

  test("[route-gates:applying-for-endorsement] given each need of the endorsement, when its way is read, then it names an act that moves that need and the place it is taken", () => {
    // The act each way names moves the quality the need reads (activity:waiting-months-build-profile): the course tech, by its band gains
    // (quality:skill-bands-slow-gains), the meetup and the talk the network.
    const moves = (activity: string, quality: string) => {
      const entry = content.activity[activity as Id<"activity">];
      const banded = quality === "quality.tech" && (entry?.bandGains ?? []).some((gain) => gain > 0);
      return banded || (entry?.effects ?? []).some((effect) => effect.type === "quality/add" && effect.quality === quality && effect.amount > 0);
    };
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
  test("[document:one-pending-copy] [world:phone-holds-what-phones-hold] given the care file and the talent file, when the TB step's line is read, then it says how long the certificate lasts, from its entry, and that it is taken last, when the application is near", () => {
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
