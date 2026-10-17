// The Calendar app (docs/rules/world.md R-WORLD-002, R-WORLD-007, R-WORLD-018; turn.md R-TURN-006, R-TURN-010;
// decision 0011): the month on the phone, in order, with the job, the things started carrying on until they
// are stopped, the chores done and what they saved, and what is coming opening where it is dealt with. The month turns
// when it is lived, so the Calendar holds no plan to fill, no pages, no Next month and no Until news.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { slot } from "../../../../../packages/sim/src/route/route.journey";
import { plannable } from "../../shared/words/acts";
import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, MONTH_KEY } from "../../authority/store";
import { PhoneNav } from "../../shared/phone/nav";
import { abroadGame, chargedLivingGame, engineView, gameAuthority, newGame, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say, words } from "../../shared/words/text";
import { Calendar, calendarOpening, choresWords, passWords } from "./Calendar";
import { turnWords } from "./turn.words";
import { carriedPlan } from "./carried";

const LEARN = "activity.learn-tech" as Id<"activity">;
// Decision 0012 (R-ACTIVITY-019): the coding course and the portfolio now answer at once and repeat, so they are never
// planned; the course that carries on as a commitment is a master's at home.
const COURSE = "activity.masters-at-home" as Id<"activity">;
const MEETUP = "activity.meetup" as Id<"activity">;
const COOK = "activity.cook-at-home" as Id<"activity">;
const WATER = "activity.fetch-water" as Id<"activity">;
const REST = "activity.rest" as Id<"activity">;
const TEACHER = "activity.job-teacher" as Id<"activity">;

function slots(state: "planned"): Element[] {
  return [...document.querySelectorAll(`[data-month-plan] [data-slot="${state}"]`)];
}

/** Ada after a month's hunt that found the teacher's job, and the job taken. */
function adaTeaching() {
  const game = newGame("scenario.ada");
  game.endTurn([slot("activity.job-hunt", TEACHER)]);
  const offer = game.view().offers.find((candidate) => candidate.entry === "offer.job");
  if (offer === undefined) throw new Error("The hunt found no job on this seed.");
  game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
  return game.view();
}

describe("the Calendar's month", () => {
  test("[R-WORLD-007] [R-TURN-010] [R-WORLD-028] given a fresh month and a month with a course carrying on, when the Calendar shows, then it holds no free time rows, no pages, no Next month and no Until news, and never says Free time, pages, Next month or Until news", async () => {
    const view = { ...richView(), setpiece: null, interview: null };
    const { authority, store } = await renderWithView(<Calendar />, view);
    const shown = (): string => document.querySelector("[data-calendar-app]")?.textContent ?? "";
    const nothingOfThePlan = (): void => {
      // "next month" in what is coming says when a thing comes; the button's words never stand.
      expect(shown()).not.toMatch(/[Ff]ree time|\b[Pp]ages?\b|Next month|[Uu]ntil news/);
      expect(document.querySelector("[data-slot='free'], [data-calendar-pages], [data-month-end], [data-month-until], [data-calendar-teach], [data-free-full]")).toBeNull();
      expect(screen.queryByRole("button", { name: /^(Next month|Until news)/ })).toBeNull();
    };
    nothingOfThePlan();
    act(() => {
      store.getState().addToPlan({ activity: COURSE, param: null });
    });
    expect(shown()).toContain(nameOf(COURSE));
    nothingOfThePlan();
    expect(shown()).not.toMatch(/slot|takes no|\d+ of \d+|Same again/i);
    expect(authority.sent).toEqual([]);
  });

  test("[R-WORLD-007] given a thing started from the world, when the Calendar shows, then it is a card that says it carries on, with a stop that empties its slot", async () => {
    const view = engineView();
    const { store } = await renderWithView(<Calendar />, view);
    act(() => {
      store.getState().addToPlan({ activity: COURSE, param: null });
    });
    expect(slots("planned")).toHaveLength(1);
    expect(slots("planned")[0]?.textContent).toContain(nameOf(COURSE));
    expect(slots("planned")[0]?.textContent).toContain("Ongoing");
    fireEvent.click(screen.getByRole("button", { name: say("ui.world.stop-act", { what: nameOf(COURSE) }) }));
    expect(slots("planned")).toHaveLength(0);
    expect(store.getState().plan.every((pick) => pick === null)).toBe(true);
  });

  test("[R-WORLD-007] [R-TURN-006] given every free slot taken, when another thing is started, then it is not taken until something stops", async () => {
    const view = engineView();
    const { store } = await renderWithView(<Calendar />, view);
    // Decision 0012: the study and time with family answer at once now, so the month is filled with commitments that carry on.
    const picks = [COURSE, "activity.apprentice-repair" as Id<"activity">, "activity.sleep-rough" as Id<"activity">, "activity.sleep-at-office" as Id<"activity">].slice(0, view.freeSlots);
    act(() => {
      for (const activity of picks) store.getState().addToPlan({ activity, param: null });
    });
    expect(slots("planned")).toHaveLength(picks.length);
    let added = true;
    act(() => {
      added = store.getState().addToPlan({ activity: "activity.morning-run", param: null });
    });
    expect(added).toBe(false);
  });

  test("[R-TURN-006] [R-ACTIVITY-015] given rest, a now-act and cooking, when each is offered to the plan, then none is taken: an empty slot rests and the others are done at once", async () => {
    const { store } = await renderWithView(<Calendar />, engineView());
    // Decision 0012 (R-ACTIVITY-019): the study and time with family are now acts too, done at once and never planned.
    for (const activity of [REST, MEETUP, COOK, WATER, LEARN, "activity.family-time" as Id<"activity">]) {
      let added = true;
      act(() => {
        added = store.getState().addToPlan({ activity, param: null });
      });
      expect({ activity, added }).toEqual({ activity, added: false });
    }
    expect(store.getState().plan.every((pick) => pick === null)).toBe(true);
  });

  test("[R-WORLD-007] given a job held, when the Calendar shows, then the job is its first line and no line says the month is empty or quiet", async () => {
    const view = adaTeaching();
    expect(view.job.id).toBe(TEACHER);
    await renderWithView(<Calendar />, view);
    const rows = [...document.querySelectorAll("[data-calendar-app] li")];
    expect(rows[0]?.textContent).toBe(turnWords("turn.month.working", { job: nameOf(TEACHER) }));
    expect(rows[0]?.getAttribute("data-slot")).toBe("job");
    const shown = document.querySelector("[data-calendar-app]")?.textContent ?? "";
    expect(shown).not.toContain("Nothing yet");
    expect(shown).not.toContain("A quiet month");
  });

  test("[R-TURN-009] [R-WORLD-007] given the burial holds a slot this month, when the Calendar shows, then the held slot is a row in its own words", async () => {
    const view = { ...richView(), setpiece: null, interview: null };
    await renderWithView(<Calendar />, { ...view, locks: [{ slots: 1, why: "burial", untilMonth: view.month }] });
    const row = document.querySelector('[data-slot="lock"]');
    expect(row?.textContent).toBe(words("ui.locks.row.burial"));
    expect(row?.textContent).not.toMatch(/\d/);
  });
});

describe("commitments carry on", () => {
  test("[R-WORLD-007] given a course started, when the month ends, then it is still planned for the next month without being picked again, and stopping it from the Calendar takes it out", async () => {
    const game = newGame("scenario.ada");
    const authority = gameAuthority(game);
    const store = createGameStore(authority);
    await store.getState().refresh();
    act(() => {
      store.getState().addToPlan({ activity: COURSE, param: null });
    });
    await act(async () => {
      await store.getState().endMonth();
    });
    expect(authority.sent.at(-1)).toMatchObject({ type: "turn/end", slots: [{ activity: COURSE, param: null }] });
    expect(store.getState().plan).toContainEqual({ activity: COURSE, param: null });
    await act(async () => {
      await store.getState().endMonth();
    });
    expect(authority.sent.at(-1)).toMatchObject({ type: "turn/end", slots: [{ activity: COURSE, param: null }] });
    render(
      <GameProvider store={store}>
        <Calendar />
      </GameProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: say("ui.world.stop-act", { what: nameOf(COURSE) }) }));
    expect(store.getState().plan.some((pick) => pick !== null)).toBe(false);
  });

  test("[R-WORLD-007] given a plan, when it is carried into the next month, then what the view no longer allows, a now-act, rest and the search for a job now held are dropped, and the free time is the limit", () => {
    const view = engineView();
    const allowed = view.activities.filter((option) => option.allowed && option.affordable && option.params === null && plannable(option.id)).map((option) => option.id);
    const [first, second] = allowed;
    if (first === undefined || second === undefined) throw new Error("Two month-acts are open to Ada.");
    const shut = { ...view, activities: view.activities.map((option) => (option.id === second ? { ...option, allowed: false } : option)) };
    expect(carriedPlan([{ activity: first, param: null }, { activity: second, param: null }, null], shut)).toEqual([{ activity: first, param: null }]);
    expect(carriedPlan([{ activity: MEETUP, param: null }, { activity: REST, param: null }, { activity: first, param: null }], view)).toEqual([{ activity: first, param: null }]);
    const held = { ...view, job: { ...view.job, id: TEACHER } };
    expect(carriedPlan([{ activity: "activity.job-hunt", param: TEACHER }], held)).toEqual([]);
    expect(carriedPlan([{ activity: first, param: null }, { activity: first, param: null }, { activity: first, param: null }], { ...view, freeSlots: 2 })).toHaveLength(2);
  });

  test("[R-ACTIVITY-015] [R-WORLD-007] given a month kept on the device from before holding a now-act and cooking, when the game loads, then the plan holds only what takes the month and Next month is accepted", async () => {
    const game = newGame("scenario.ada");
    const authority = gameAuthority(game);
    // Decision 0012 (R-ACTIVITY-019): a month kept from before may hold the coding course as it was planned then; it now
    // answers at once, so it is dropped with the other now-acts, and the commitment that carries on stays.
    localStorage.setItem(MONTH_KEY, JSON.stringify({ v: game.view().v, scenario: game.view().scenario, plan: [{ activity: MEETUP, param: null }, { activity: LEARN, param: null }, { activity: COOK, param: null }, { activity: COURSE, param: null }], monthLines: [], lastMonthLines: [], cardClosed: null }));
    const store = createGameStore(authority, { rememberMonth: true });
    await store.getState().refresh();
    const planned = store.getState().plan.filter((pick) => pick !== null);
    expect(planned).toEqual([{ activity: COURSE, param: null }]);
    await act(async () => {
      await store.getState().endMonth();
    });
    expect(authority.sent.at(-1)).toMatchObject({ type: "turn/end", slots: [{ activity: COURSE, param: null }] });
    expect(store.getState().rejection).toBeNull();
    localStorage.removeItem(MONTH_KEY);
  });
});

describe("the Calendar's other sections", () => {
  test("[R-OBLIGATION-014] given Ada cooking and fetching water now, when the Calendar shows, then the chores done say what they took off this month, from the relief held on the upkeep", async () => {
    // Decision 0013 (R-HOME-012): at home nothing of the living is charged as the month turns, so the chores take nothing
    // off and the Calendar says no saving.
    const lived = newGame("scenario.ada");
    lived.accept({ type: "activity/now", activity: COOK, param: null });
    lived.accept({ type: "activity/now", activity: WATER, param: null });
    expect(choresWords(lived.view())).toBeNull();
    // The saving's words are tested on the living charged whole, as the simulation's relief tests charge it.
    const game = chargedLivingGame("scenario.ada");
    const before = game.view();
    expect(choresWords(before)).toBeNull();
    game.accept({ type: "activity/now", activity: COOK, param: null });
    game.accept({ type: "activity/now", activity: WATER, param: null });
    const view = game.view();
    const upkeep = view.obligations.find((owed) => content.obligation[owed.entry]?.type === "upkeep");
    if (upkeep === undefined) throw new Error("Ada pays an upkeep at home.");
    const share = content.tuning.room.cookedBp + content.tuning.room.waterBp;
    await renderWithView(<Calendar />, view);
    expect(document.querySelector("[data-month-chores]")?.textContent).toBe(`Cooked and fetched water: ${formatMoney(Math.floor((upkeep.due * share) / 10000), "NGN")} less this month`);
  });

  test("[R-PLACE-012] [R-WORLD-039] given Ada in London, when she buys the month's bus pass, then the Calendar says the bus is free till the month ends, and before it says nothing of a pass", async () => {
    const game = abroadGame();
    expect(passWords(game.view())).toBeNull();
    const bought = game.accept({ type: "activity/now", activity: "activity.bus-pass-uk", param: null });
    if (!bought.ok) throw new Error("The pass was refused.");
    expect(passWords(game.view())).toBe("Bus pass bought: the bus is free till the month ends");
    await renderWithView(<Calendar />, game.view());
    expect(document.querySelector("[data-month-pass]")?.textContent).toBe("Bus pass bought: the bus is free till the month ends");
    expect(passWords(engineView("scenario.ada"))).toBeNull();
  });

  test("[R-WORLD-002] [R-WORLD-019] given what is coming, when a paper on its way or the room's rent is tapped in the Calendar, then Papers or Bills opens; an ask names where it is answered", async () => {
    const openApp = vi.fn();
    const rich = richView();
    const view = {
      ...rich,
      documents: [{ id: "document.passport" as Id<"document">, state: "pending" as const, readyMonth: rich.month + 2, expiresMonth: null, value: null, onItsWay: rich.month + 2 }],
      home: { ...rich.home, roomRent: { year: 50_000_00, fees: 0, dueIn: 1 } },
    };
    await renderWithView(
      <PhoneNav value={{ openApp, close: () => undefined }}>
        <Calendar opening="coming" />
      </PhoneNav>,
      view,
    );
    const rows = [...document.querySelectorAll("[data-coming-open]")];
    for (const row of rows) fireEvent.click(row);
    const kinds = rows.map((row) => row.getAttribute("data-coming-open"));
    expect(kinds).toEqual(expect.arrayContaining(["paper", "rent"]));
    // A paper on its way opens Papers, the plan's waits Japa.
    expect(openApp.mock.calls.map(([id]) => id as string)).toEqual(kinds.map((kind) => (kind === "rent" ? "bills" : kind === "paper" ? "papers" : "japa")));
    expect(document.querySelector("[data-calendar='coming']")).not.toBeNull();
  });

  test("[R-WORLD-002] given a burial in the village to answer next month, when the Calendar shows what is coming, then its row says the months away and where it is attended", async () => {
    const rich = richView();
    const [ask] = rich.offers;
    if (ask === undefined) throw new Error("No ask in the rich view.");
    const view = { ...rich, offers: [{ ...ask, entry: "offer.village-burial" as typeof ask.entry, expiresMonth: rich.month + 1 }] };
    await renderWithView(<Calendar opening="coming" />, view);
    const row = document.querySelector("[data-coming-row='offer']");
    expect(row?.querySelector("[data-coming-box]")?.getAttribute("data-coming-box")).toBe("1");
    expect(row?.textContent).toContain(words("offer.village-burial.name"));
    expect(row?.querySelector("[data-coming-note]")?.textContent).toBe("In the village");
  });

  test("[R-WORLD-002] given the phone asked to open the Calendar, when its opening is read, then only its coming list is a place to open on; anything else opens the month as it is", () => {
    expect(calendarOpening("coming")).toBe("coming");
    expect(calendarOpening("teach")).toBeNull();
    expect(calendarOpening("send")).toBeNull();
    expect(calendarOpening(null)).toBeNull();
  });
});
