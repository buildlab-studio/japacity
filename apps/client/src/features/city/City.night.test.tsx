// The night and sleep (docs/rules/world.md R-WORLD-025; activity.md R-ACTIVITY-020; clock.md R-CLOCK-033; decision
// 0036): the month turns only from the bed, at any hour of the world's day, once the bed's timed sleep runs out
// (City.sleep.test.tsx tells the sleep itself); a life's first night is told once on a small card before it; at night the nudge sends the player to bed unless someone waits; and a spent body says so where
// an act's button was. The place file is the one the game ships; the scene is a stand-in that hands the city the taps.
import { type DayPart, type WorldClock, worldClockAt } from "@japacity/sim";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { applyEffects } from "../../../../../packages/sim/src/route/route.journey";
import type { GameStore } from "../../authority/store";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/people";
import { say } from "../../shared/words/text";
import { AskSheet } from "../../shared/world/AskSheet";
import type { Act, Ask, Thing } from "../../shared/world/contract";
import { wasTaught } from "../../shared/world/taught";
import { actsOffered, withSpent } from "./acts";
import { chipNode } from "./chip";
import { City, RESULTS_BEAT_MS } from "./City";
import { atNight, NIGHT } from "./nudge";
import { SLEEP_MS } from "./sleep";

type Pick = { kind: "thing"; thing: Thing } | { kind: "act"; thing: Thing; act: Act };

vi.mock("./CityScene", () => ({
  default: ({ things, onPick }: { things?: Thing[]; onPick: (pick: Pick) => void }) => (
    <div data-stand-in-scene>
      {(things ?? []).map((thing) => (
        <span key={thing.id}>
          <button type="button" data-stand-in-thing={thing.id} onClick={() => onPick({ kind: "thing", thing })} />
          {thing.acts.map((one) => (
            <button key={one.id} type="button" data-stand-in-act={`${thing.id}:${one.id}`} onClick={() => onPick({ kind: "act", thing, act: one })} />
          ))}
        </span>
      ))}
    </div>
  ),
}));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../../shared/three/manifest", async (original) => {
  const real = await original<typeof import("../../shared/three/manifest")>();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const assets = path.join(import.meta.dirname, "..", "..", "..", "public", "assets");
  return {
    ...real,
    loadManifest: () => Promise.resolve({ files: {} }),
    loadJson: (_manifest: unknown, under: string) => {
      const file = path.join(assets, under);
      return Promise.resolve(fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as unknown) : null);
    },
  };
});

beforeEach(() => {
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
  window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
});

function found(selector: string): HTMLElement {
  const one = document.querySelector<HTMLElement>(selector);
  if (one === null) throw new Error(`Nothing at ${selector}.`);
  return one;
}

const WATER = "activity.fetch-water";

/** The world's clock at a part of its day, as a reply carries it. */
function clockAt(part: DayPart): { tick: number; nextTickAt: number; nextTurnAt: null; morningAt: number; world: WorldClock } {
  const world = worldClockAt(Date.now());
  return { tick: 0, nextTickAt: 0, nextTurnAt: null, morningAt: world.morningAt, world: { ...world, part } };
}

function setPart(store: GameStore, part: DayPart): void {
  act(() => store.setState({ clock: clockAt(part) }));
}

/** Ada in the parlour by the bed: a new life, or one with `months` behind it. */
async function inTheParlour(months = 0, before: (game: ReturnType<typeof newGame>) => void = () => undefined) {
  const game = newGame("scenario.ada");
  for (let month = 0; month < months; month += 1) game.endTurn();
  before(game);
  const rendered = await renderWithGame(<City world results={(place) => <p data-results-for={place} />} />, game);
  fireEvent.click(await waitFor(() => found('[data-stand-in-act="house:enter"]')));
  await waitFor(() => found('[data-stand-in-thing="bed"]'), { timeout: 3000 });
  return { game, ...rendered };
}

const turns = (sent: readonly { type: string }[]): number => sent.filter((command) => command.type === "turn/end").length;

/** The bed's timed sleep runs its length (R-WORLD-025), on clocks faked once the parlour is up. */
async function sleepThrough(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SLEEP_MS);
  });
}

describe("sleep, the way the month turns", () => {
  test("[R-WORLD-025] given a new life's first night, when the bed's Sleep is tapped, then one small card says each night you sleep is a month of your life and nothing is sent until its Sleep; then the sleep runs and the month ends, and the next night has no card", async () => {
    const { store, authority, game } = await inTheParlour();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    expect(game.view().month).toBe(0);
    fireEvent.click(found('[data-stand-in-act="bed:end-month"]'));
    const card = found("[data-night-teach]");
    expect(card.textContent).toContain("Each night you sleep is a month of your life.");
    expect(card.textContent).toContain(say("ui.night.first"));
    // On a laptop the card stands in the centred column with the world around it (decision 0038).
    expect(card.closest("[data-centred-column]")).not.toBeNull();
    expect(turns(authority.sent)).toBe(0);
    fireEvent.click(found("[data-night-teach-ok]"));
    // The card's Sleep starts the bed's timed sleep: the month turns once it runs out, not at the tap (R-WORLD-025 as
    // amended on 12 Oct 2026), so the wait below runs the sleep before the turn is counted.
    expect(found("[data-asleep]")).toBeTruthy();
    expect(turns(authority.sent)).toBe(0);
    await sleepThrough();
    expect(turns(authority.sent)).toBe(1);
    expect(document.querySelector("[data-night-teach]")).toBeNull();
    expect(wasTaught("night", "scenario.ada")).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESULTS_BEAT_MS + 1500);
    });
    found("[data-results-for]");
    act(() => store.getState().setReportOpen(false));
    fireEvent.click(found('[data-stand-in-act="bed:end-month"]'));
    expect(document.querySelector("[data-night-teach]")).toBeNull();
    await sleepThrough();
    expect(turns(authority.sent)).toBe(2);
  });

  test("[R-WORLD-025] [R-CLOCK-033] given the world's morning, then its night, when the bed's Sleep is tapped each time and the sleep runs out, then the month ends either way", async () => {
    const { store, authority } = await inTheParlour(1);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    setPart(store, "morning");
    fireEvent.click(found('[data-stand-in-act="bed:end-month"]'));
    // The sleep runs its length before the month turns (R-WORLD-025 as amended on 12 Oct 2026).
    await sleepThrough();
    expect(turns(authority.sent)).toBe(1);
    expect(store.getState().reportOpen).toBe(true);
    act(() => store.getState().setReportOpen(false));
    setPart(store, "night");
    fireEvent.click(found('[data-stand-in-act="bed:end-month"]'));
    await sleepThrough();
    expect(turns(authority.sent)).toBe(2);
  });
});

/** The body worn down to under thirty energy, so the night asks for bed (R-CLOCK-033 as amended). */
const worn = (game: ReturnType<typeof newGame>): void => applyEffects(game, [{ type: "quality/add", quality: "quality.energy", amount: -50 }]);

describe("the night's nudge", () => {
  test("[R-CLOCK-033] [R-WORLD-025] given the world's night, a tired body and nothing waiting on the player, when the band's second row shows, then the nudge reads Night. Go to bed, and its tap opens the bed's chip", async () => {
    const { store, game } = await inTheParlour(0, worn);
    expect(game.view().offers).toEqual([]);
    expect(game.view().qualities.find((quality) => quality.id === "quality.energy")?.value).toBeLessThan(30);
    setPart(store, "afternoon");
    expect(document.querySelector("[data-nudge]")?.textContent ?? "").not.toContain(say(NIGHT));
    setPart(store, "night");
    const nudge = await waitFor(() => found("[data-nudge]"));
    expect(nudge.textContent).toContain("Night. Go to bed");
    fireEvent.click(found("[data-nudge-open]"));
    // A thing's chip is open, so the band's second row steps back (R-WORLD-003).
    await waitFor(() => expect(document.querySelector("[data-nudge]")).toBeNull());
  });

  test("[R-CLOCK-033] given the world's night and a body that can still take it, when the band's second row shows, then the nudge stands as it was: nobody is sent to bed (the decision 41)", async () => {
    const { store, game } = await inTheParlour();
    expect(game.view().qualities.find((quality) => quality.id === "quality.energy")?.value).toBeGreaterThanOrEqual(30);
    setPart(store, "night");
    await waitFor(() => expect(found("[data-band-month]").textContent).toContain("Night"));
    expect(document.querySelector("[data-nudge]")?.textContent ?? "").not.toContain(say(NIGHT));
  });

  test("[R-CLOCK-033] given the world's night and a person asking, when the band's second row shows, then the nudge stays on the person asking", async () => {
    const { store, game } = await inTheParlour(1);
    expect(game.view().offers.length).toBeGreaterThan(0);
    setPart(store, "night");
    expect((await waitFor(() => found("[data-nudge]"))).textContent).toContain(say("ui.nudge.offer"));
  });

  test("[R-CLOCK-033] given the night and a tired body, when the nudge is chosen, then a question or a person asking still leads, anything else gives way to bed; a body still fresh, or the day, changes nothing", () => {
    expect(atNight({ key: "ui.nudge.offer", about: "offer" }, "night", true)).toEqual({ key: "ui.nudge.offer", about: "offer" });
    expect(atNight({ key: "ui.nudge.setpiece", about: "setpiece" }, "night", true)).toEqual({ key: "ui.nudge.setpiece", about: "setpiece" });
    expect(atNight({ key: "chapter.find-your-feet.item.job", about: "step" }, "night", true)).toEqual({ key: NIGHT, about: "end" });
    expect(atNight({ key: "ui.nudge.report", about: "report" }, "night", true)).toEqual({ key: NIGHT, about: "end" });
    expect(atNight({ key: "chapter.find-your-feet.item.job", about: "step" }, "night", false)).toEqual({ key: "chapter.find-your-feet.item.job", about: "step" });
    for (const part of ["morning", "afternoon", "evening"] as const) expect(atNight({ key: "chapter.find-your-feet.item.job", about: "step" }, part, true)).toEqual({ key: "chapter.find-your-feet.item.job", about: "step" });
    expect(atNight(null, "night", true)).toBeNull();
    expect(say(NIGHT)).toBe("Night. Go to bed");
  });
});

describe("a spent body", () => {
  test("[R-ACTIVITY-020] given the body spent by fetching water, when the drum's act is read, then it stays on the drum marked spent, and a tap on it sends nothing", async () => {
    const { authority, game } = await inTheParlour(0, (life) => {
      while (life.view().activities.find((option) => option.id === WATER)?.spent !== true) life.accept({ type: "activity/now", activity: WATER, param: null });
    });
    const view = game.view();
    expect(view.activities.find((option) => option.id === WATER)).toMatchObject({ allowed: false, spent: true });
    expect(actsOffered(view)).toContain(WATER);
    const drum = await waitFor(() => found('[data-stand-in-act="drum:fetch-water"]'));
    fireEvent.click(drum);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(authority.sent.filter((command) => command.type === "activity/now")).toHaveLength(0);
  });

  test("[R-ACTIVITY-020] given a spent act done at once, when its thing's chip is built, then it says You are spent. Sleep. where the act's button was, and has no button for it", () => {
    const thing: Thing = { id: "drum", label: "scene.thing.drum", at: [0, 0], acts: [{ id: "fetch-water", label: "city.act.fetch-water", kind: "do", stages: WATER }] } as unknown as Thing;
    const spentView = { activities: [{ id: WATER, allowed: false, missing: [], params: null, cost: [], affordable: true, when: "now", done: false, spent: true }] } as never;
    const marked = withSpent(thing, spentView);
    expect(marked.acts[0]?.spent).toBe(true);
    expect(withSpent(thing, { activities: [] })).toBe(thing);
    const chip = chipNode(marked, () => undefined);
    expect(chip.querySelector("[data-act-spent]")?.textContent).toBe("You are spent. Sleep.");
    expect(chip.querySelector("button[data-act]")).toBeNull();
  });

  test("[R-ACTIVITY-020] given an act's card whose body is spent, when it opens, then You are spent. Sleep. stands where its button was and there is no main button", () => {
    const ask: Ask = { form: "card", icon: "hand", who: "The family house", title: "Nap", line: "Twenty minutes.", cost: null, button: "Nap", when: "now", time: "A morning", spent: say("ui.act.spent"), act: () => undefined, dismiss: () => undefined };
    render(<AskSheet ask={ask} formatMoney={(amount) => String(amount)} />);
    expect(found("[data-ask-spent]").textContent).toBe("You are spent. Sleep.");
    expect(document.querySelector("[data-ask-main]")).toBeNull();
  });

});

describe("the first night's card as drawn", () => {
  test("[R-WORLD-025] given a new life's first night, when the bed's Sleep is tapped, then the card has its title, the line, Not yet and Sleep; Not yet puts it away with nothing sent and nothing kept, so the next Sleep shows it again", async () => {
    const { authority } = await inTheParlour();
    fireEvent.click(found('[data-stand-in-act="bed:end-month"]'));
    const card = found("[data-night-teach]");
    expect(card.textContent).toContain(say("ui.night.first.title"));
    expect(card.textContent).toContain(say("ui.night.first"));
    fireEvent.click(found("[data-night-teach-later]"));
    expect(document.querySelector("[data-night-teach]")).toBeNull();
    expect(document.querySelector("[data-asleep]")).toBeNull();
    expect(turns(authority.sent)).toBe(0);
    expect(wasTaught("night", "scenario.ada")).toBe(false);
    fireEvent.click(found('[data-stand-in-act="bed:end-month"]'));
    expect(found("[data-night-teach]")).toBeTruthy();
  });
});
