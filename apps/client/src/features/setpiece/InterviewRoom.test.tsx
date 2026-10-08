import { content, OFFICER_REACTIONS, setpieceVoice, text } from "@japacity/content";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { NORTHGATE, draw, drawnQuestions, readyLife, seedWhere, toApplied, uk } from "../../../../../packages/sim/src/route/route.journey";
import { offerChanceBp } from "../../../../../packages/sim/src/route/route.logic";
import type { Game } from "../../../../../packages/sim/src/testing/play";
import { fakeSound, type FakeSound, type FakeSoundOptions } from "../../shared/sound/fakeSound";
import { MARGIN_MS, NOTICE_MS, READY_MS, setSoundBackend } from "../../shared/sound/sound";
import { soundText } from "../../shared/sound/sound.words";
import { renderWithGame } from "../../shared/testing/people";
import { CLOSE, drawReaction, GREET, roomStore, VOICED } from "./room.store";
import { roomText } from "./room.words";
import { SetpieceView } from "./SetpieceView";

const entry = content.setpiece[VOICED]!;
const CLEAN = entry.questions.map((question) => question.id).filter((id) => id !== "deposit");
const northgateOffers = (seed: string) => draw(seed, "school", 1, 10000) < offerChanceBp(content.school[NORTHGATE]!, 4, content.tuning.route);
/** The longest line, so waiting this long lets any line's answers show. */
const LONGEST = Math.max(...Object.values(setpieceVoice).map((voice) => voice.ms));

/** A life whose visa interview has just opened, asking who pays first. */
function interviewGame(): Game {
  const seed = seedWhere((candidate) => northgateOffers(candidate) && drawnQuestions(candidate, CLEAN, entry.ask)[0] === "who-pays");
  const game = readyLife(content, { seed });
  toApplied(game);
  return game;
}

function clipOf(key: string): string {
  return `/voice/${setpieceVoice[key]!.clip}`;
}

async function after(ms: number): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

function room(): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-scene='${VOICED}']`);
  if (found === null) throw new Error("The interview room is not on screen.");
  return found;
}

function notice(): string | null {
  return document.querySelector("[data-sound-notice]")?.getAttribute("data-sound-notice") ?? null;
}

function answersOpen(): boolean {
  return document.querySelector("[data-answers='open']") !== null;
}

async function open(options: FakeSoundOptions, game = interviewGame()): Promise<{ fake: FakeSound; game: Game }> {
  const fake = fakeSound(options);
  setSoundBackend(fake.backend);
  await renderWithGame(<SetpieceView />, game);
  return { fake, game };
}

async function enter(): Promise<void> {
  fireEvent.click(within(room()).getByRole("button", { name: roomText["room.enter"]! }));
  await after(0);
}

/** Waits for the answers without tapping anything, at most `limit` milliseconds. */
async function waitForAnswers(limit: number): Promise<number> {
  let waited = 0;
  while (!answersOpen() && waited < limit) {
    await after(50);
    waited += 50;
  }
  expect(answersOpen(), `the answers showed within ${String(limit)} ms`).toBe(true);
  return waited;
}

/** In the room, answers with the first allowed answer until the closing line, never tapping to skip. */
async function playThrough(limit: number): Promise<void> {
  for (let guard = 0; guard < 8 && document.querySelector("[data-room='closing']") === null; guard += 1) {
    await waitForAnswers(limit);
    const first = within(document.querySelector<HTMLElement>("[data-answers='open']")!).getAllByRole("button").find((button) => !(button as HTMLButtonElement).disabled)!;
    fireEvent.click(first);
    await after(0);
  }
  expect(document.querySelector("[data-room='closing']")).not.toBeNull();
  expect(screen.getByText(text[CLOSE]!)).toBeDefined();
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  localStorage.clear();
  roomStore.setState({ opened: 0, inRoom: false, entered: false, prelude: null, answered: false, closing: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("walking in", () => {
  test("given the application just sent, then the room waits for the player to enter, with no answers yet, and only this interview's clips are fetched ahead", async () => {
    const { fake, game } = await open({});
    await after(0);
    expect(within(room()).getByRole("button", { name: roomText["room.enter"]! })).toBeDefined();
    expect(answersOpen()).toBe(false);
    const first = `${VOICED}.q.${game.view().setpiece!.question!.id}`;
    const expected = [GREET, first, ...OFFICER_REACTIONS, CLOSE].map((key) => `${clipOf(key)}.opus`);
    expect([...fake.fetched].sort()).toEqual([...expected].sort());
  });

  test("given sound on, when the player enters, then that tap wakes sound, the greeting and the question are shown at once and spoken in turn, and the answers come when the officer finishes", async () => {
    const { fake, game } = await open({});
    await enter();
    expect(fake.wakes).toBeGreaterThan(0);
    const question = game.view().setpiece!.question!;
    expect(within(room()).getByText(text[GREET]!)).toBeDefined();
    expect(within(room()).getByText(text[`${VOICED}.q.${question.id}`]!)).toBeDefined();
    expect(answersOpen()).toBe(false);
    expect(fake.played).toEqual([`${clipOf(GREET)}.opus`]);
    expect(notice()).toBe("on");
    fake.endPlaying();
    await after(0);
    expect(fake.played).toEqual([`${clipOf(GREET)}.opus`, `${clipOf(`${VOICED}.q.${question.id}`)}.opus`]);
    expect(answersOpen()).toBe(false);
    fake.endPlaying();
    await after(0);
    expect(answersOpen()).toBe(true);
  });

  test("given the officer speaking, when the player taps to skip, then the answers show at once and the clip stops", async () => {
    const { fake } = await open({});
    await enter();
    fireEvent.click(within(room()).getByRole("button", { name: roomText["room.skip"]! }));
    await after(0);
    expect(answersOpen()).toBe(true);
    expect(fake.played).toHaveLength(1);
  });
});

describe("the notice never blocks an answer", () => {
  test("given the sound-on notice showing, when an answer is tapped, then it is sent, the notice still there; and the notice goes by itself", async () => {
    const { fake, game } = await open({});
    await enter();
    fireEvent.click(within(room()).getByRole("button", { name: roomText["room.skip"]! }));
    await after(0);
    expect(notice()).toBe("on");
    const answer = game.view().setpiece!.question!.answers[1]!;
    fireEvent.click(within(room()).getByRole("button", { name: new RegExp(text[`${VOICED}.a.who-pays.${answer}`]!) }));
    await after(0);
    expect(game.state.setpiece.given[VOICED]?.["who-pays"]).toBe(answer);
    expect(notice()).toBe("on");
    await after(NOTICE_MS);
    expect(notice()).toBe("none");
    expect(fake.played.length).toBeGreaterThan(0);
  });

  test("given the sound-on notice, when it is tapped, then sound mutes and the switch shows it", async () => {
    await open({});
    await enter();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(soundText["sound.notice.on"]!) }));
    await after(0);
    expect(screen.getByRole("button", { name: soundText["sound.unmute"]! }).getAttribute("aria-pressed")).toBe("true");
  });

  test("given the notice is announced, then it sits in a polite live region and takes no focus", async () => {
    await open({});
    await enter();
    const region = document.querySelector("[data-sound-notice]")!;
    expect(region.getAttribute("role")).toBe("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.contains(document.activeElement)).toBe(false);
  });
});

describe("the scene completes whatever sound does", () => {
  test("given the browser holding sound back, then the notice offers sound, each question's answers show within the wait for the tap, and the scene runs to its closing line", async () => {
    const { fake, game } = await open({ blocked: true });
    await enter();
    await after(READY_MS);
    expect(notice()).toBe("blocked");
    await playThrough(READY_MS + 100);
    expect(fake.played).toEqual([]);
    expect(uk(game).visa?.interviewScore).not.toBeNull();
  });

  test("given the blocked notice, when it is tapped, then the question is spoken", async () => {
    const { fake } = await open({ blocked: true });
    await enter();
    await after(READY_MS);
    fake.allow();
    fireEvent.click(screen.getByRole("button", { name: soundText["sound.notice.blocked"]! }));
    await after(0);
    expect(notice()).toBe("none");
    expect(fake.played).toEqual([`${clipOf(`${VOICED}.q.who-pays`)}.opus`]);
  });

  test("given every question's clip missing, then the voice-like sound stands in for each and the scene runs to its closing line", async () => {
    const missing = Object.keys(setpieceVoice).filter((key) => key.includes(".q.")).map((key) => setpieceVoice[key]!.clip);
    const { fake } = await open({ missing, autoEnd: true });
    await enter();
    await playThrough(100);
    expect(fake.babbled.length).toBeGreaterThanOrEqual(entry.ask);
    expect(fake.played.some((url) => url.includes("/q-"))).toBe(false);
  });

  test("given clips that never finish loading, then each question's answers show at its known length plus the margin and the scene runs to its closing line", async () => {
    const hanging = Object.values(setpieceVoice).map((voice) => voice.clip);
    const { fake } = await open({ hanging });
    await enter();
    const greet = setpieceVoice[GREET]!.ms + MARGIN_MS;
    await after(greet - 50);
    expect(answersOpen()).toBe(false);
    await playThrough(2 * (LONGEST + MARGIN_MS) + 100);
    expect(fake.played).toEqual([]);
  });

  test("given the tab hidden mid-clip, then the clip stops and on return the text and answers are there", async () => {
    const { fake } = await open({});
    await enter();
    expect(fake.played).toHaveLength(1);
    expect(answersOpen()).toBe(false);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await after(0);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await after(0);
    expect(answersOpen()).toBe(true);
    expect(fake.sleeps).toBe(1);
    expect(fake.played).toHaveLength(1);
  });

  test("given data-saver on, then nothing is fetched, the notice says sound is off to save data, the answers show at once and the scene runs to its closing line", async () => {
    const { fake } = await open({ saveData: true, awake: true });
    await enter();
    expect(notice()).toBe("saver");
    expect(answersOpen()).toBe(true);
    await playThrough(0);
    expect(fake.fetched).toEqual([]);
  });

  test("given data-saver on, when its notice is tapped, then the clips are fetched and the question is spoken", async () => {
    const { fake, game } = await open({ saveData: true, awake: true });
    await enter();
    fireEvent.click(screen.getByRole("button", { name: soundText["sound.notice.saver"]! }));
    await after(0);
    const question = `${clipOf(`${VOICED}.q.${game.view().setpiece!.question!.id}`)}.opus`;
    expect(fake.fetched).toContain(question);
    expect(fake.played).toEqual([question]);
  });

  test("given a browser that cannot play the clips, then the notice says the scene plays in text, the answers show at once, and tapping the notice does nothing", async () => {
    await open({ supported: false });
    await enter();
    expect(notice()).toBe("unsupported");
    expect(screen.queryByRole("button", { name: soundText["sound.notice.unsupported"]! })).toBeNull();
    expect(answersOpen()).toBe(true);
  });

  test("given muted with the scene's switch, then nothing is fetched or played, no notice shows, and the switch is remembered", async () => {
    localStorage.setItem("japacity.sound.muted", "1");
    const { fake } = await open({ awake: true });
    await enter();
    expect(answersOpen()).toBe(true);
    expect(fake.fetched).toEqual([]);
    expect(notice()).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: soundText["sound.unmute"]! }));
    expect(localStorage.getItem("japacity.sound.muted")).toBe("0");
  });
});

describe("what the officer says", () => {
  test("[R-SETPIECE-008] [R-SETPIECE-005] given a sponsor as the answer, then a neutral reaction drawn from the four is shown, then the follow-up marked as one, counted in the total", async () => {
    await open({ supported: false });
    await enter();
    fireEvent.click(within(room()).getByRole("button", { name: new RegExp(text[`${VOICED}.a.who-pays.sponsor`]!) }));
    await after(0);
    const reaction = room().querySelector("[data-line]")!.getAttribute("data-line")!;
    expect(OFFICER_REACTIONS).toContain(reaction);
    expect(within(room()).getByText(text[`${VOICED}.q.sponsor-who`]!)).toBeDefined();
    expect(within(room()).getByText(roomText["room.follow-up"]!)).toBeDefined();
    expect(within(room()).getByText(`Question 2 of ${String(entry.ask + 1)}`)).toBeDefined();
  });

  test("[R-SETPIECE-005] given the random draw at each of four values, when a reaction is drawn, then each of the four is said: the draw reads no score", () => {
    const seen = new Set<string>();
    const spy = vi.spyOn(crypto, "getRandomValues");
    for (let index = 0; index < 4; index += 1) {
      spy.mockImplementationOnce(<T extends ArrayBufferView | null>(array: T): T => {
        (array as unknown as Uint32Array)[0] = index;
        return array;
      });
      seen.add(drawReaction());
    }
    expect([...seen].sort()).toEqual([...OFFICER_REACTIONS].sort());
  });
});
