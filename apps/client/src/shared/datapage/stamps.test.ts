// The data page's stamps (prologue.md R-PROLOGUE-009): a red stamp for each step taken toward leaving, read from
// the view's documents, routes and chapters, never kept anywhere of their own.
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { engineView } from "../testing/fixtures";
import { say } from "../words/text";
import { stampsOf } from "./stamps";

const UK_CARE = "route.uk-care" as const;
const FIRST = "chapter.find-your-feet" as const;

function life(change: (view: PlayerView) => Partial<PlayerView>): PlayerView {
  const view = engineView("scenario.ada");
  return { ...view, ...change(view) };
}

const held = { id: "document.passport" as const, state: "held" as const, readyMonth: null, expiresMonth: 80, value: null };

function routeIn(view: PlayerView, state: PlayerView["routes"][number]["state"]): PlayerView["routes"] {
  return view.routes.map((route) => (route.id === UK_CARE ? { ...route, state } : route));
}

describe("the page's stamps", () => {
  test("[R-PROLOGUE-009] given a life that has taken no step toward leaving, then the page carries no stamp", () => {
    expect(stampsOf(engineView("scenario.ada"))).toEqual([]);
  });

  test("[R-PROLOGUE-009] given the passport held, then the page is stamped papers in order; a passport still on its way stamps nothing", () => {
    expect(stampsOf(life(() => ({ documents: [held] })))).toEqual([say("prologue.page.stamp.papers")]);
    expect(stampsOf(life(() => ({ documents: [{ ...held, state: "pending", readyMonth: 3 }] })))).toEqual([]);
  });

  test("[R-PROLOGUE-009] given the first chapter's look into it done, then the page is stamped adviser read, and stays stamped once the chapter is done", () => {
    const looked = life((view) => ({ chapter: { ...view.chapter, current: FIRST, items: [{ id: "known", met: true }] } }));
    expect(stampsOf(looked)).toEqual([say("prologue.page.stamp.adviser")]);
    const past = life((view) => ({ chapter: { ...view.chapter, current: "chapter.build-the-file", items: [], done: [FIRST] } }));
    expect(stampsOf(past)).toEqual([say("prologue.page.stamp.adviser")]);
    const notYet = life((view) => ({ chapter: { ...view.chapter, current: FIRST, items: [{ id: "known", met: false }] } }));
    expect(stampsOf(notYet)).toEqual([]);
  });

  test("[R-PROLOGUE-009] given the plan the chapters follow (R-CHAPTER-009) looked into, then the page is stamped with it in a few words; applied and granted stamp it again", () => {
    const plan = say("prologue.page.stamp.plan", { way: say(`prologue.page.way.${UK_CARE}`) });
    expect(plan).toBe("Plan: care work");
    expect(stampsOf(life((view) => ({ plan: { route: UK_CARE, ways: [{ route: UK_CARE, percent: 30 }] }, routes: routeIn(view, "known") })))).toEqual([plan]);
    expect(stampsOf(life((view) => ({ plan: { route: UK_CARE, ways: [{ route: UK_CARE, percent: 30 }] }, routes: routeIn(view, "heard") })))).toEqual([]);
    expect(stampsOf(life((view) => ({ plan: { route: UK_CARE, ways: [{ route: UK_CARE, percent: 80 }] }, routes: routeIn(view, "applying") })))).toEqual([plan, say("prologue.page.stamp.applied")]);
    expect(stampsOf(life((view) => ({ plan: { route: UK_CARE, ways: [{ route: UK_CARE, percent: 100 }] }, routes: routeIn(view, "granted") })))).toEqual([plan, say("prologue.page.stamp.applied"), say("prologue.page.stamp.granted")]);
  });

  test("[R-PROLOGUE-009] given every way out that can be a plan, then each has its few words for the stamp", () => {
    for (const route of engineView("scenario.ada").routes) expect(say(`prologue.page.way.${route.id}`)).not.toBe(`prologue.page.way.${route.id}`);
  });

  test("[R-PROLOGUE-009] given a file built and every step before it, then the stamps come in the order the steps are taken", () => {
    const all = life((view) => ({
      documents: [held],
      plan: { route: UK_CARE, ways: [{ route: UK_CARE, percent: 90 }] },
      routes: routeIn(view, "applying"),
      chapter: { ...view.chapter, current: "chapter.decision-day-care", items: [], done: [FIRST, "chapter.build-the-file-care"] },
    }));
    expect(stampsOf(all)).toEqual(["adviser", "plan", "papers", "file", "applied"].map((key) => (key === "plan" ? say("prologue.page.stamp.plan", { way: say(`prologue.page.way.${UK_CARE}`) }) : say(`prologue.page.stamp.${key}`))));
  });
});
