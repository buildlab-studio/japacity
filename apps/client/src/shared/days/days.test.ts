// The month passes as the player moves (docs/rules/world.md R-WORLD-030): the days the interface
// counts from rides and acts, never past the month, and the lines each month-act says of itself, on
// the real content and the real engine through the real store.
import { activitySignals, content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { localAuthority } from "../../authority/local";
import { createGameStore, type GameStore } from "../../authority/store";
import { DAYS_IN_MONTH, dueSignals, isMonthAct, monthActs, signalsOf, waitingSignals } from "./days";
import { atHome, CITY_LAST_KEY } from "./standing";
import { currentDays, forgetDays, tellSignals, watchDays } from "./days.store";

/** The month-acts of docs/rules/activity.md R-ACTIVITY-015 beside every job and side job. */
const MONTH_ACTS_FREE = [
  "activity.apprentice-repair",
  "activity.study-english",
  "activity.study-english-uk",
  "activity.learn-tech",
  "activity.learn-tech-uk",
  "activity.learn-tech-ca",
  "activity.build-portfolio",
  "activity.open-source",
  "activity.conference-talk",
  "activity.masters-at-home",
  "activity.nurse-certification",
  "activity.interview-prep",
  "activity.be-noticed",
  "activity.morning-run",
  "activity.family-time",
  "activity.sleep-at-office",
  "activity.sleep-rough",
  "activity.rest",
  "activity.overtime",
];

const COURSE = "activity.learn-tech" as Id<"activity">;

async function adaStore(): Promise<GameStore> {
  const authority = localAuthority({ fastClock: true, storage: null, scenario: "scenario.ada", makeSeed: () => "month-signals", now: () => 0 });
  const store = createGameStore(authority);
  await store.getState().refresh();
  return store;
}

/** Two places of the city a danfo runs between. */
function twoStops(): [Id<"place">, Id<"place">] {
  const home = Object.values(content.place).filter((place) => place.where === "home" && place.id !== "place.family-house");
  const other = home[0];
  if (other === undefined) throw new Error("No place in the city beside the family house.");
  return ["place.family-house", other.id];
}

async function ride(store: GameStore, from: Id<"place">, to: Id<"place">): Promise<void> {
  const reply = await store.getState().send({ type: "place/ride", from, to, way: "danfo" });
  if (reply === null || !reply.ok) throw new Error("The ride was refused.");
}

function stand(place: string, inside = false): void {
  localStorage.setItem(CITY_LAST_KEY, JSON.stringify(inside ? [place, "inside"] : [place]));
}

function day(): number {
  return currentDays()?.day ?? 0;
}

beforeEach(() => {
  localStorage.clear();
  forgetDays();
});
afterEach(() => {
  forgetDays();
});

describe("the lines each month-act says of itself", () => {
  test("[R-WORLD-030] given every job, side job and month-act in content, when its lines are looked up, then it has one or two, each with a week of the month", () => {
    const acts = [...Object.values(content.activity).filter((entry) => entry.slot === "main" || entry.slot === "side").map((entry) => entry.id as string), ...MONTH_ACTS_FREE];
    expect(acts.length).toBeGreaterThan(40);
    const wrong = acts.filter((id) => {
      const lines = signalsOf(id);
      const weeksFit = lines.every((line) => line.week >= 1 && line.week <= DAYS_IN_MONTH / 7);
      return !(id in content.activity) || lines.length < 1 || lines.length > 2 || !isMonthAct(id) || !weeksFit;
    });
    expect(wrong).toEqual([]);
  });

  test("[R-WORLD-030] given every line in content, when its key is read, then it names an activity in content, its words are short, and they carry no figure in braces", () => {
    const wrong = Object.entries(activitySignals).filter(([key, signal]) => {
      const found = /^(activity\.[a-z-]+)\.signal\.([12])$/.exec(key);
      return found === null || !(found[1]! in content.activity) || /[{}]/.test(signal.words) || signal.words.length > 100;
    });
    expect(wrong).toEqual([]);
  });

  test("[R-WORLD-030] given a now-act, when it is asked whether it tells of itself, then it does not: the kiosk, asking around and the job hunt answer at once", () => {
    const nowActs = ["activity.play-lotto", "activity.ask-around", "activity.job-hunt", "activity.get-passport", "activity.meetup"];
    expect(nowActs.filter((id) => isMonthAct(id) || signalsOf(id).length > 0)).toEqual([]);
  });
});

describe("the days of the month", () => {
  test("[R-WORLD-030] given a new month, when a ride is accepted, then the days move by one, and an act planned moves them by one more", async () => {
    const store = await adaStore();
    const stop = watchDays(store);
    const [house, other] = twoStops();
    expect(day()).toBe(0);
    await ride(store, house, other);
    expect(day()).toBe(1);
    store.getState().addToPlan({ activity: COURSE, param: null });
    expect(day()).toBe(2);
    await ride(store, other, house);
    expect(day()).toBe(3);
    stop();
  });

  test("[R-WORLD-030] given rides back and forth all month, when the days are counted, then they stop at four weeks and never pass the month", async () => {
    const store = await adaStore();
    const stop = watchDays(store);
    const [house, other] = twoStops();
    for (let leg = 0; leg < DAYS_IN_MONTH + 4; leg += 1) await ride(store, leg % 2 === 0 ? house : other, leg % 2 === 0 ? other : house);
    expect(day()).toBe(DAYS_IN_MONTH);
    expect(DAYS_IN_MONTH).toBe(28);
    stop();
  });

  test("[R-WORLD-030] given days gone this month, when the page is turned, then the next month starts at its first day", async () => {
    const store = await adaStore();
    const stop = watchDays(store);
    const [house, other] = twoStops();
    await ride(store, house, other);
    await ride(store, other, house);
    expect(day()).toBe(2);
    const month = store.getState().view!.month;
    await store.getState().endMonth();
    expect(store.getState().view!.month).toBe(month + 1);
    expect(day()).toBe(0);
    expect(currentDays()?.month).toBe(month + 1);
    stop();
  });

  test("[R-WORLD-030] given the days counted, when the store is watched twice, then each move still counts once", async () => {
    const store = await adaStore();
    const first = watchDays(store);
    const second = watchDays(store);
    const [house, other] = twoStops();
    await ride(store, house, other);
    expect(day()).toBe(1);
    second();
    await ride(store, other, house);
    expect(day()).toBe(2);
    first();
    await ride(store, house, other);
    expect(day()).toBe(2);
  });
});

describe("a planned course tells of itself on its day, at home", () => {
  test("[R-WORLD-030] given a coding course planned, when the days pass, then its first line comes the day after and its second in its third week", async () => {
    const store = await adaStore();
    const stop = watchDays(store);
    const [house, other] = twoStops();
    const lines = signalsOf(COURSE);
    expect(lines.map((line) => line.week)).toEqual([1, 3]);
    store.getState().addToPlan({ activity: COURSE, param: null });
    const due = () => dueSignals(currentDays()!, store.getState().view!, store.getState().plan).map((signal) => signal.key);
    expect(monthActs(store.getState().view!, store.getState().plan)).toContain(COURSE);
    // Planning took the day; nothing of the course has happened yet.
    expect(due()).toEqual([]);
    await ride(store, house, other);
    expect(due()).toEqual([`${COURSE}.signal.1`]);
    // Planned on day 1, the course's first day is the next; its third week starts two weeks on.
    expect(currentDays()?.since[COURSE]).toBe(1);
    while (day() < 1 + 1 + 14) {
      expect(due()).not.toContain(`${COURSE}.signal.2`);
      await ride(store, day() % 2 === 0 ? house : other, day() % 2 === 0 ? other : house);
    }
    expect(due()).toEqual([`${COURSE}.signal.1`, `${COURSE}.signal.2`]);
    stop();
  });

  test("[R-WORLD-030] given a line due, when the character stands on the street, at the house's door or inside it, then only home counts as home", async () => {
    const store = await adaStore();
    const view: PlayerView = store.getState().view!;
    stand("place.ojuelegba");
    expect(atHome(view)).toBe(false);
    stand("place.family-house");
    expect(atHome(view)).toBe(true);
    stand("place.family-house", true);
    expect(atHome(view)).toBe(true);
    localStorage.removeItem(CITY_LAST_KEY);
    // The game opens at home when it knows no place (R-WORLD-014).
    expect(atHome(view)).toBe(true);
  });

  test("[R-WORLD-030] given lines waiting, when they are told, then they wait no longer, and the next month they come again on their days", async () => {
    const store = await adaStore();
    const stop = watchDays(store);
    const [house, other] = twoStops();
    store.getState().addToPlan({ activity: COURSE, param: null });
    await ride(store, house, other);
    const view = store.getState().view!;
    const waiting = waitingSignals(currentDays()!, view, store.getState().plan);
    expect(waiting.map((signal) => signal.key)).toEqual([`${COURSE}.signal.1`]);
    tellSignals(waiting.map((signal) => signal.key));
    expect(waitingSignals(currentDays()!, view, store.getState().plan)).toEqual([]);
    await store.getState().endMonth();
    store.getState().addToPlan({ activity: COURSE, param: null });
    expect(waitingSignals(currentDays()!, store.getState().view!, store.getState().plan)).toEqual([]);
    await ride(store, house, other);
    expect(waitingSignals(currentDays()!, store.getState().view!, store.getState().plan).map((signal) => signal.key)).toEqual([`${COURSE}.signal.1`]);
    stop();
  });
});
