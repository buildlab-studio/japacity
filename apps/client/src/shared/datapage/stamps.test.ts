// The data page's stamps (prologue:front-door-builds-a-person): none until a visa is granted. The visa's
// is the first, round and red, with the way under it; the flight, the landing and a status secured stamp beneath it.
// Nothing before the visa stamps the page, and the road, which gives no visa, never does. Read from the view, never kept.
import type { Id, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { abroadView, engineView } from "../testing/fixtures";
import { say } from "../words/text";
import { stampsOf } from "./stamps";

const UK_CARE = "route.uk-care" as const;
const ROAD = "route.road" as const;
const FIRST = "chapter.find-your-feet" as const;

function life(change: (view: PlayerView) => Partial<PlayerView>): PlayerView {
  const view = engineView("scenario.graduate");
  return { ...view, ...change(view) };
}

const held = { id: "document.passport" as const, state: "held" as const, readyMonth: null, expiresMonth: 80, value: null, onItsWay: null };

function routeIn(view: PlayerView, route: Id<"route">, state: PlayerView["routes"][number]["state"]): Pick<PlayerView, "routes" | "plan"> {
  return { routes: view.routes.map((one) => (one.id === route ? { ...one, state } : one)), plan: { route, ways: [{ route, percent: 100 }] } };
}

const visa = { words: say("prologue.page.stamp.granted"), under: say(`prologue.page.way.${UK_CARE}`) };

describe("the page's stamps", () => {
  test("[prologue:front-door-builds-a-person] given every step before a visa (the way looked into, the plan, the passport held, the file built, the visa applied for), then the page carries no stamp", () => {
    expect(stampsOf(engineView("scenario.graduate"))).toEqual([]);
    const before = life((view) => ({
      documents: [held],
      ...routeIn(view, UK_CARE, "applying"),
      chapter: { ...view.chapter, current: "chapter.decision-day-care", items: [{ id: "known", met: true }], done: [FIRST, "chapter.build-the-file-care"] },
    }));
    expect(stampsOf(before)).toEqual([]);
    for (const state of ["heard", "known", "applying", "refused"] as const) expect(stampsOf(life((view) => routeIn(view, UK_CARE, state)))).toEqual([]);
  });

  test("[prologue:front-door-builds-a-person] given the visa granted, then its stamp is the first, with the way under it", () => {
    expect(stampsOf(life((view) => routeIn(view, UK_CARE, "granted")))).toEqual([visa]);
    expect(visa.under).toBe("health care");
  });

  test("[prologue:front-door-builds-a-person] given the flight out, the landing and a status secured, then each stamps beneath the visa's, in the order a life takes them", () => {
    const flown = life((view) => routeIn(view, UK_CARE, "departed"));
    expect(stampsOf(flown)).toEqual([visa, { words: say("ui.page.stamp.flight") }]);
    const abroad = abroadView();
    const landed: PlayerView = { ...abroad, ...routeIn(abroad, UK_CARE, "departed") };
    expect(stampsOf(landed)).toEqual([visa, { words: say("ui.page.stamp.flight") }, { words: say("ui.page.stamp.landed") }]);
    const status = landed.status ?? { entry: "status.uk-skilled", monthsLeft: null, clock: null, lawfulMonths: 0, settleMonths: null, work: "any" as const, nextStep: null, renew: null, overstay: null, graduate: null };
    const settled: PlayerView = { ...landed, status: { ...status, entry: "status.uk-settled" } };
    expect(stampsOf(settled)).toEqual([visa, { words: say("ui.page.stamp.flight") }, { words: say("ui.page.stamp.landed") }, { words: say("ui.page.stamp.secured") }]);
    // A status held on the way is not yet secured.
    expect(stampsOf(landed).map((one) => one.words)).not.toContain(say("ui.page.stamp.secured"));
  });

  test("[prologue:front-door-builds-a-person] given the road, which gives no visa, then the page takes no stamp, even gone", () => {
    expect(stampsOf(life((view) => routeIn(view, ROAD, "departed")))).toEqual([]);
  });

  test("[prologue:front-door-builds-a-person] given every way out that can be a plan, then each has its few words for the visa's stamp", () => {
    for (const route of engineView("scenario.graduate").routes) expect(say(`prologue.page.way.${route.id}`)).not.toBe(`prologue.page.way.${route.id}`);
  });
});
