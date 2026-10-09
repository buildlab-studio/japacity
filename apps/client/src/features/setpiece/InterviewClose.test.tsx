// The interview's close as the world shows it: the officer's last
// line holds the sheet open with one button, and the sound notice sits in the sheet's header, never over the band.
import { content, OFFICER_REACTIONS, text } from "@japacity/content";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { NORTHGATE, draw, drawnQuestions, readyLife, seedWhere, toApplied, uk } from "../../../../../packages/sim/src/route/route.journey";
import { offerChanceBp } from "../../../../../packages/sim/src/route/route.logic";
import type { Game } from "../../../../../packages/sim/src/testing/play";
import { useView } from "../../authority/GameProvider";
import { fakeSound } from "../../shared/sound/fakeSound";
import { installSoundWake, NOTICE_MS, setSoundBackend } from "../../shared/sound/sound";
import { SoundNotice } from "../../shared/sound/SoundNotice";
import { soundText } from "../../shared/sound/sound.words";
import { renderWithGame } from "../../shared/testing/people";
import { CLOSE, roomStore, VOICED } from "./room.store";
import { roomText } from "./room.words";
import { SetpieceView, useClosingOpen } from "./SetpieceView";

const entry = content.setpiece[VOICED]!;
const CLEAN = entry.questions.map((question) => question.id).filter((id) => id !== "deposit");
const northgateOffers = (seed: string) => draw(seed, "school", 1, 10000) < offerChanceBp(content.school[NORTHGATE]!, 4, content.tuning.route);

function interviewGame(): Game {
  const seed = seedWhere((candidate) => northgateOffers(candidate) && drawnQuestions(candidate, CLEAN, entry.ask)[0] === "who-pays");
  const game = readyLife(content, { seed });
  toApplied(game);
  return game;
}

/** What the world's asks sheet holds: the set piece while it is open, and while its closing line still shows. */
function AsksHost() {
  const view = useView();
  const closing = useClosingOpen();
  return view.setpiece === null && !closing ? <p data-host="empty" /> : <SetpieceView />;
}

async function after(ms: number): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

function room(): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-scene='${VOICED}']`);
  if (found === null) throw new Error("The interview room is not on screen.");
  return found;
}

async function open(options: Parameters<typeof fakeSound>[0], game = interviewGame()): Promise<Game> {
  setSoundBackend(fakeSound(options).backend);
  await renderWithGame(
    <>
      <SoundNotice />
      <AsksHost />
    </>,
    game,
  );
  fireEvent.click(within(room()).getByRole("button", { name: roomText["room.enter"]! }));
  await after(0);
  return game;
}

/** Answers with the first allowed answer until the set piece closes. */
async function answerAll(game: Game): Promise<void> {
  for (let guard = 0; guard < 8 && game.view().setpiece !== null; guard += 1) {
    const answers = document.querySelector<HTMLElement>("[data-answers='open']");
    if (answers === null) throw new Error("No answers on screen.");
    fireEvent.click(within(answers).getAllByRole("button").find((button) => !(button as HTMLButtonElement).disabled)!);
    await after(0);
  }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  installSoundWake(document);
  localStorage.clear();
  roomStore.setState({ opened: 0, inRoom: false, entered: false, prelude: null, answered: false, closing: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the interview's close", () => {
  test("[R-INTERVIEW-005] given the last answer given, when the interview closes, then the sheet stays with the officer's reaction and closing line and one button, and the score is in", async () => {
    const game = await open({ supported: false });
    await answerAll(game);
    expect(game.view().setpiece).toBeNull();
    expect(uk(game).visa?.interviewScore).not.toBeNull();
    const closing = document.querySelector<HTMLElement>("[data-room='closing']");
    expect(closing).not.toBeNull();
    expect(within(closing!).getByText(text[CLOSE]!)).toBeDefined();
    expect(OFFICER_REACTIONS).toContain(closing!.querySelector("[data-line]")?.getAttribute("data-line"));
    expect(within(closing!).getAllByRole("button").filter((button) => button.textContent === roomText["room.leave"])).toHaveLength(1);
  });

  test("[R-INTERVIEW-005] given the closing line on screen, when Leave the room is tapped, then the sheet has nothing more to hold and closes", async () => {
    const game = await open({ supported: false });
    await answerAll(game);
    fireEvent.click(screen.getByRole("button", { name: roomText["room.leave"]! }));
    await after(0);
    expect(document.querySelector("[data-room='closing']")).toBeNull();
    expect(document.querySelector("[data-host='empty']")).not.toBeNull();
  });
});

describe("the sound notice in the room", () => {
  test("[R-WORLD-001] given sound on and the room entered, when the sound-on notice is raised, then it shows in the sheet's header and the corner over the band stays empty, and it goes by itself", async () => {
    await open({});
    const here = room().querySelector("[data-notice-here]");
    expect(here?.getAttribute("data-sound-notice")).toBe("on");
    expect(within(here as HTMLElement).getByRole("button", { name: new RegExp(soundText["sound.notice.on"]!) })).toBeDefined();
    const corner = [...document.querySelectorAll("[data-sound-notice]")].find((region) => !room().contains(region));
    expect(corner?.getAttribute("data-sound-notice")).toBe("none");
    expect(corner?.childElementCount).toBe(0);
    await after(NOTICE_MS);
    expect(here?.getAttribute("data-sound-notice")).toBe("none");
  });
});
