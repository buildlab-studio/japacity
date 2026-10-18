// The voiced visa interview as the room's tests open it, and what they read of the room.
import { content } from "@japacity/content";
import { drawnQuestions, type Game, northgateOffers, readyLife, seedWhere, toApplied } from "@japacity/sim/testing";
import { act } from "@testing-library/react";
import { vi } from "vitest";

import { VOICED } from "./room.store";

const entry = content.setpiece[VOICED]!;
const CLEAN = entry.questions.map((question) => question.id).filter((id) => id !== "deposit");

/** A life whose visa interview has just opened, asking who pays first. */
export function interviewOpened(): Game {
  const seed = seedWhere((candidate) => northgateOffers(content, candidate) && drawnQuestions(candidate, CLEAN, entry.ask)[0] === "who-pays");
  const game = readyLife(content, { seed });
  toApplied(game);
  return game;
}

/** The fake clock moved on by `ms`, inside act. */
export async function after(ms: number): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

/** The interview room on screen, or a throw. */
export function room(): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-scene='${VOICED}']`);
  if (found === null) throw new Error("The interview room is not on screen.");
  return found;
}
