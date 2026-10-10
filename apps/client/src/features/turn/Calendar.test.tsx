// The Calendar app (docs/rules/world.md R-WORLD-002, R-WORLD-007, R-WORLD-018; turn.md R-TURN-006): the month on the phone, in order, with the things started carrying on until they are stopped, an empty free
// slot resting, the chores done and what they saved, what is coming opening where it is dealt with, the pages left, and
// its own Next month that puts the phone away and turns the page.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { slot } from "../../../../../packages/sim/src/route/route.journey";
import { plannable } from "../../shared/words/acts";
import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, MONTH_KEY } from "../../authority/store";
import { PhoneNav } from "../../shared/phone/nav";
import { engineView, gameAuthority, newGame, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say, words } from "../../shared/words/text";
import { wasTaught } from "../../shared/world/taught";
import { Calendar, calendarOpening, choresWords } from "./Calendar";
import { freeTimeWords, turnWords } from "./turn.words";
import { carriedPlan } from "./untilNews";

const LEARN = "activity.learn-tech" as Id<"activity">;
const PORTFOLIO = "activity.build-portfolio" as Id<"activity">;
const MEETUP = "activity.meetup" as Id<"activity">;
const COOK = "activity.cook-at-home" as Id<"activity">;
const WATER = "activity.fetch-water" as Id<"activity">;
const REST = "activity.rest" as Id<"activity">;
const TEACHER = "activity.job-teacher" as Id<"activity">;

function slots(state: "free" | "planned"): Element[] {
  return [...document.querySelectorAll(`[data-month-plan] [data-slot="${state}"]`)];
}

function endButton(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>("[data-month-end]");
  if (found === null) throw new Error("No Next month in the Calendar");
  return found;
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

describe("the Calendar's free time", () => {
  test("[R-WORLD-007] [R-TURN-006] given a fresh month, when the Calendar shows, then each free slot is a card saying you rest, and no line says slots, a count of things planned or that a thing takes no slot", async () => {
    const view = engineView();
    await renderWithView(<Calendar />, view);
    expect(slots("free")).toHaveLength(view.freeSlots);
    for (const card of slots("free")) expect(card.textContent).toBe("Free time: you rest");
    expect(say("ui.month.rest")).toBe("Free time: you rest");
    const shown = document.body.textContent ?? "";
    expect(shown).not.toMatch(/slot|takes no|\d+ of \d+|Same again/i);
    expect(screen.queryByRole("button", { name: "Same again" })).toBeNull();
  });

  test("[R-WORLD-007] given a thing started from the world, when the Calendar shows, then it is a card that says it carries on, with a stop that empties its slot", async () => {
    const view = engineView();
    const { store } = await renderWithView(<Calendar />, view);
    act(() => {
      store.getState().addToPlan({ activity: LEARN, param: null });
    });
    expect(slots("planned")).toHaveLength(1);
    expect(slots("planned")[0]?.textContent).toContain(nameOf(LEARN));
    expect(slots("planned")[0]?.textContent).toContain("Ongoing");
    expect(slots("free")).toHaveLength(view.freeSlots - 1);
    fireEvent.click(screen.getByRole("button", { name: say("ui.world.stop-act", { what: nameOf(LEARN) }) }));
    expect(slots("planned")).toHaveLength(0);
    expect(store.getState().plan.every((pick) => pick === null)).toBe(true);
  });

  test("[R-WORLD-007] [R-TURN-006] given every free slot taken, when the Calendar shows, then it says the free time is all used, and nothing more can be started until something stops", async () => {
    const view = engineView();
    const { store } = await renderWithView(<Calendar />, view);
    const picks = [LEARN, PORTFOLIO, "activity.study-english" as Id<"activity">, "activity.family-time" as Id<"activity">].slice(0, view.freeSlots);
    act(() => {
      for (const activity of picks) store.getState().addToPlan({ activity, param: null });
    });
    expect(document.querySelector("[data-free-full]")?.textContent).toBe("Free time: all used");
    expect(endButton().textContent).toContain("Free time: all used");
    let added = true;
    act(() => {
      added = store.getState().addToPlan({ activity: "activity.morning-run", param: null });
    });
    expect(added).toBe(false);
    expect(freeTimeWords(0, 3)).toBe("Free time: you rest");
    expect(freeTimeWords(1, 3)).toBe("Free time: two left");
    expect(freeTimeWords(3, 3)).toBe("Free time: all used");
  });

  test("[R-TURN-006] [R-ACTIVITY-015] given rest, a now-act and cooking, when each is offered to the plan, then none is taken: an empty slot rests and the others are done at once", async () => {
    const { store } = await renderWithView(<Calendar />, engineView());
    for (const activity of [REST, MEETUP, COOK, WATER]) {
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

  test("[R-TURN-009] [R-WORLD-007] given the burial holds a slot this month, when the Calendar shows, then the held slot is a row in its own words above the free ones", async () => {
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
      store.getState().addToPlan({ activity: LEARN, param: null });
    });
    await act(async () => {
      await store.getState().endMonth();
    });
    expect(authority.sent.at(-1)).toMatchObject({ type: "turn/end", slots: [{ activity: LEARN, param: null }] });
    expect(store.getState().plan).toContainEqual({ activity: LEARN, param: null });
    await act(async () => {
      await store.getState().endMonth();
    });
    expect(authority.sent.at(-1)).toMatchObject({ type: "turn/end", slots: [{ activity: LEARN, param: null }] });
    render(
      <GameProvider store={store}>
        <Calendar />
      </GameProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: say("ui.world.stop-act", { what: nameOf(LEARN) }) }));
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
    localStorage.setItem(MONTH_KEY, JSON.stringify({ v: game.view().v, scenario: game.view().scenario, plan: [{ activity: MEETUP, param: null }, { activity: LEARN, param: null }, { activity: COOK, param: null }], monthLines: [], lastMonthLines: [], cardClosed: null }));
    const store = createGameStore(authority, { rememberMonth: true });
    await store.getState().refresh();
    const planned = store.getState().plan.filter((pick) => pick !== null);
    expect(planned).toEqual([{ activity: LEARN, param: null }]);
    await act(async () => {
      await store.getState().endMonth();
    });
    expect(authority.sent.at(-1)).toMatchObject({ type: "turn/end", slots: [{ activity: LEARN, param: null }] });
    expect(store.getState().rejection).toBeNull();
    localStorage.removeItem(MONTH_KEY);
  });
});

describe("the Calendar's Next month", () => {
  test("[R-WORLD-002] [R-WORLD-007] given the month can end, when the Calendar's Next month is tapped, then the plan is sent and the phone is put away so the page turns over the world", async () => {
    const close = vi.fn();
    const { authority, store } = await renderWithView(
      <PhoneNav value={{ openApp: () => undefined, close }}>
        <Calendar />
      </PhoneNav>,
      { ...richView(), setpiece: null, interview: null },
    );
    act(() => {
      store.getState().addToPlan({ activity: LEARN, param: null });
    });
    fireEvent.click(endButton());
    expect(close).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(authority.sent).toHaveLength(1));
    expect(authority.sent[0]).toMatchObject({ type: "turn/end", slots: [{ activity: LEARN, param: null }] });
  });

  test("[R-WORLD-007] given a set piece open, when the Calendar shows, then Next month is held with the reason", async () => {
    await renderWithView(<Calendar />, richView());
    expect(endButton().disabled).toBe(true);
    expect(document.querySelector("[data-month-blocked]")?.textContent).toBe(words("reject.setpiece-open"));
  });
});

describe("the Calendar's other sections", () => {
  test("[R-OBLIGATION-014] given Ada cooking and fetching water now, when the Calendar shows, then the chores done say what they took off this month, from the relief held on the upkeep", async () => {
    const game = newGame("scenario.ada");
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

  test("[R-WORLD-002] given what is coming, when a paper on its way or the room's rent is tapped in the Calendar, then Japa or Bills opens; an ask names where it is answered", async () => {
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
    expect(openApp.mock.calls.map(([id]) => id as string)).toEqual(kinds.map((kind) => (kind === "rent" ? "bills" : "japa")));
    expect(document.querySelector("[data-calendar='coming']")).not.toBeNull();
  });

  test("[R-WORLD-027] given the pages left, when the Calendar shows, then its pages section says the count and that a page is a month of your life", async () => {
    const view = engineView();
    await renderWithView(<Calendar />, view);
    const pages = document.querySelector("[data-calendar-pages]")?.textContent ?? "";
    expect(pages).toContain(String(view.turns.banked));
    expect(document.querySelector(view.turns.banked >= view.turns.cap ? "[data-count-fact='full']" : "[data-count-fact='page']")).not.toBeNull();
  });

  test("[R-WORLD-002] given the Calendar opened by Next month in place of turning, when it shows, then one small teach card says what the month is, once in a life: dismissed, it never shows again", async () => {
    const view = engineView();
    localStorage.clear();
    await renderWithView(<Calendar opening="teach" />, view);
    expect(document.querySelector("[data-calendar-teach]")?.textContent).toContain("carries on");
    fireEvent.click(screen.getByRole("button", { name: turnWords("turn.calendar.teach.ok") }));
    expect(document.querySelector("[data-calendar-teach]")).toBeNull();
    expect(wasTaught("calendar", view.scenario)).toBe(true);
    await renderWithView(<Calendar opening="teach" />, view);
    expect(document.querySelector("[data-calendar-teach]")).toBeNull();
    expect(calendarOpening("teach")).toBe("teach");
    expect(calendarOpening("send")).toBeNull();
    localStorage.clear();
  });
});
