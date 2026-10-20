// The month passes as the player moves (world:month-passes-as-lived, for the lived month): the day is
// read from the view's halfDays, the share of the month's free time the acts have spent, never past the month, and
// the lines each month-act says of itself, on the real content and the real engine through the real store.
import { activitySignals, content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { localAuthority } from "../../authority/local";
import { createGameStore, type GameStore } from "../../authority/store";
import { DAYS_IN_MONTH, dayOfView, dueSignals, isMonthAct, monthActs, signalsOf, waitingSignals } from "./days";
import { atHome } from "./standing";
import { currentDays, forgetDays, tellSignals, watchDays } from "./days.store";
import { CITY_LAST_KEY } from "../kept/storage";

/** The month-acts of activity:now-acts-and-month-acts beside every job and side job. */
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

// Decision 0012 (activity:acts-may-repeat-in-month): the coding course answers at once and repeats, so it is never planned; the course
// that carries on as a commitment is a master's at home, whose lines come in its first and third weeks.
const COURSE = "activity.masters-at-home" as Id<"activity">;
/** A nap: an act that spends a morning of the month's free time and costs nothing. */
const NAP = "activity.nap" as Id<"activity">;

async function graduateStore(): Promise<GameStore> {
  const authority = localAuthority({ fastClock: true, storage: null, scenario: "scenario.graduate", makeSeed: () => "month-signals", now: () => 0 });
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

/** Spends the month's free time a morning at a time, as naps, until the view's day is `target`. */
async function liveUntil(store: GameStore, target: number): Promise<void> {
  for (let guard = 0; guard < 200 && dayOfView(store.getState().view!) < target; guard += 1) {
    const reply = await store.getState().send({ type: "activity/now", activity: NAP, param: null });
    if (reply === null || !reply.ok) throw new Error("The nap was refused.");
  }
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
  test("[world:month-passes-as-lived] given every job, side job and month-act in content, when its lines are looked up, then it has one or two, each with a week of the month", () => {
    const acts = [...Object.values(content.activity).filter((entry) => entry.slot === "main" || entry.slot === "side").map((entry) => entry.id as string), ...MONTH_ACTS_FREE];
    expect(acts.length).toBeGreaterThan(40);
    const wrong = acts.filter((id) => {
      const lines = signalsOf(id);
      const weeksFit = lines.every((line) => line.week >= 1 && line.week <= DAYS_IN_MONTH / 7);
      return !(id in content.activity) || lines.length < 1 || lines.length > 2 || !isMonthAct(id) || !weeksFit;
    });
    expect(wrong).toEqual([]);
  });

  test("[world:month-passes-as-lived] given every line in content, when its key is read, then it names an activity in content, its words are short, and they carry no figure in braces", () => {
    const wrong = Object.entries(activitySignals).filter(([key, signal]) => {
      const found = /^(activity\.[a-z-]+)\.signal\.([12])$/.exec(key);
      return found === null || !(found[1]! in content.activity) || /[{}]/.test(signal.words) || signal.words.length > 100;
    });
    expect(wrong).toEqual([]);
  });

  test("[world:month-passes-as-lived] given a now-act, when it is asked whether it tells of itself, then it does not: the kiosk, asking around and the job hunt answer at once", () => {
    const nowActs = ["activity.play-lotto", "activity.ask-around", "activity.job-hunt", "activity.get-passport", "activity.meetup"];
    expect(nowActs.filter((id) => isMonthAct(id) || signalsOf(id).length > 0)).toEqual([]);
  });
});

describe("the days of the month", () => {
  test("[world:month-passes-as-lived] given a new month, when a ride is accepted or a course planned, then the days do not move; when acts spend the month's free time, the day is the share of it spent", async () => {
    // Decision 0011, with world:month-passes-as-lived for the lived month: the day is read from the view's
    // halfDays; a ride and a plan spend none of it, the acts that answer at once do.
    const store = await graduateStore();
    const stop = watchDays(store);
    const [house, other] = twoStops();
    expect(day()).toBe(0);
    await ride(store, house, other);
    expect(day()).toBe(0);
    expect(store.getState().addToPlan({ activity: COURSE, param: null })).toBe(true);
    expect(day()).toBe(0);
    await store.getState().send({ type: "activity/now", activity: "activity.learn-tech", param: null });
    await store.getState().send({ type: "activity/now", activity: "activity.cook-at-home", param: null });
    const { spent, free } = store.getState().view!.halfDays;
    expect(spent).toBe(3);
    expect(day()).toBe(Math.floor((spent * DAYS_IN_MONTH) / free));
    expect(day()).toBe(1);
    await ride(store, other, house);
    expect(day()).toBe(1);
    stop();
  });

  test("[world:month-passes-as-lived] given acts that spend the whole month's free time and more, when the days are counted, then they stop at four weeks and never pass the month", async () => {
    // Decision 0011, with world:month-passes-as-lived: the days are the view's time spent, so it is acts, not
    // rides, that fill them; once the free time is spent the night falls and the month waits for Sleep (decision 0011).
    const free = (await graduateStore()).getState().view!.halfDays.free;
    expect(dayOfView({ halfDays: { spent: free, free } })).toBe(DAYS_IN_MONTH);
    expect(dayOfView({ halfDays: { spent: free + 4, free } })).toBe(DAYS_IN_MONTH);
    const store = await graduateStore();
    const stop = watchDays(store);
    const month = store.getState().view!.month;
    for (let nap = 1; nap < free; nap += 1) await store.getState().send({ type: "activity/now", activity: NAP, param: null });
    expect(store.getState().view!.halfDays.spent).toBe(free - 1);
    expect(day()).toBe(DAYS_IN_MONTH - 1);
    expect(DAYS_IN_MONTH).toBe(28);
    await store.getState().send({ type: "activity/now", activity: NAP, param: null });
    expect(store.getState().view!.halfDays.spent).toBe(free);
    expect(day()).toBe(DAYS_IN_MONTH);
    await store.getState().send({ type: "activity/now", activity: NAP, param: null });
    expect(day()).toBe(DAYS_IN_MONTH);
    expect(store.getState().view!.month).toBe(month);
    await store.getState().endMonth(true);
    await vi.waitFor(() => expect(store.getState().view!.month).toBe(month + 1));
    expect(day()).toBe(0);
    stop();
  });

  test("[world:month-passes-as-lived] given days gone this month, when the page is turned, then the next month starts at its first day", async () => {
    const store = await graduateStore();
    const stop = watchDays(store);
    // Decision 0011, with world:month-passes-as-lived: the days go as the acts spend the month's time.
    await liveUntil(store, 2);
    expect(day()).toBe(2);
    const month = store.getState().view!.month;
    await store.getState().endMonth();
    expect(store.getState().view!.month).toBe(month + 1);
    expect(day()).toBe(0);
    expect(currentDays()?.month).toBe(month + 1);
    stop();
  });

  test("[world:month-passes-as-lived] given the days counted, when the store is watched twice, then each move still counts once", async () => {
    // Decision 0011, with world:month-passes-as-lived: the day is the view's share of the time spent, so two
    // watches read the same day, and with no watch left nothing is kept.
    const store = await graduateStore();
    const first = watchDays(store);
    const second = watchDays(store);
    await liveUntil(store, 1);
    expect(day()).toBe(1);
    second();
    await liveUntil(store, 2);
    expect(day()).toBe(2);
    first();
    await liveUntil(store, 3);
    expect(day()).toBe(2);
  });
});

describe("a planned course tells of itself on its day, at home", () => {
  test("[world:month-passes-as-lived] given a master's course planned, when the days pass, then its first line comes the day after and its second in its third week", async () => {
    // Decision 0012: the course that carries on is the master's at home; the days pass as the acts spend the month's
    // time (world:month-passes-as-lived, decision 0011), so planning takes no day and a ride passes none.
    const store = await graduateStore();
    const stop = watchDays(store);
    const [house, other] = twoStops();
    const lines = signalsOf(COURSE);
    expect(lines.map((line) => line.week)).toEqual([1, 3]);
    store.getState().addToPlan({ activity: COURSE, param: null });
    const due = () => dueSignals(currentDays()!, store.getState().view!, store.getState().plan).map((signal) => signal.key);
    expect(monthActs(store.getState().view!, store.getState().plan)).toContain(COURSE);
    // Nothing of the course has happened yet, and a ride spends none of the month's time.
    expect(due()).toEqual([]);
    await ride(store, house, other);
    expect(due()).toEqual([]);
    // Planned on the month's first day, the course's first day is the next; its third week starts two weeks on.
    expect(currentDays()?.since[COURSE]).toBe(0);
    await liveUntil(store, 1);
    expect(due()).toEqual([`${COURSE}.signal.1`]);
    while (day() < 1 + 14) {
      expect(due()).not.toContain(`${COURSE}.signal.2`);
      await liveUntil(store, day() + 1);
    }
    expect(due()).toEqual([`${COURSE}.signal.1`, `${COURSE}.signal.2`]);
    stop();
  });

  test("[world:month-passes-as-lived] given a line due, when the character stands on the street, at the house's door or inside it, then only home counts as home", async () => {
    const store = await graduateStore();
    const view: PlayerView = store.getState().view!;
    stand("place.ojuelegba");
    expect(atHome(view)).toBe(false);
    stand("place.family-house");
    expect(atHome(view)).toBe(true);
    stand("place.family-house", true);
    expect(atHome(view)).toBe(true);
    localStorage.removeItem(CITY_LAST_KEY);
    // The game opens at home when it knows no place (world:opens-where-last-stopped).
    expect(atHome(view)).toBe(true);
  });

  test("[world:month-passes-as-lived] given lines waiting, when they are told, then they wait no longer, and the next month they come again on their days", async () => {
    const store = await graduateStore();
    const stop = watchDays(store);
    const [house, other] = twoStops();
    store.getState().addToPlan({ activity: COURSE, param: null });
    // Decision 0011, with world:month-passes-as-lived: a day passes as the acts spend the month's time.
    await liveUntil(store, 1);
    const view = store.getState().view!;
    const waiting = waitingSignals(currentDays()!, view, store.getState().plan);
    expect(waiting.map((signal) => signal.key)).toEqual([`${COURSE}.signal.1`]);
    tellSignals(waiting.map((signal) => signal.key));
    expect(waitingSignals(currentDays()!, view, store.getState().plan)).toEqual([]);
    await store.getState().endMonth();
    // The course carries on into the next month without being started again (world:month-acts-carry-on).
    expect(store.getState().plan).toContainEqual({ activity: COURSE, param: null });
    expect(waitingSignals(currentDays()!, store.getState().view!, store.getState().plan)).toEqual([]);
    await ride(store, house, other);
    expect(waitingSignals(currentDays()!, store.getState().view!, store.getState().plan)).toEqual([]);
    await liveUntil(store, 1);
    expect(waitingSignals(currentDays()!, store.getState().view!, store.getState().plan).map((signal) => signal.key)).toEqual([`${COURSE}.signal.1`]);
    stop();
  });
});
