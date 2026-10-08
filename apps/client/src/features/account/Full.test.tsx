import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { Full, type FullCheck } from "./Full";

const WAIT_S = 30;

function checker(answers: (FullCheck | "down")[]): { check: () => Promise<FullCheck>; asked: () => number } {
  let asked = 0;
  return {
    check: () => {
      const answer = answers[Math.min(asked, answers.length - 1)] ?? "full";
      asked += 1;
      return answer === "down" ? Promise.reject(new Error("unreachable")) : Promise.resolve(answer);
    },
    asked: () => asked,
  };
}

async function pass(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("the full screen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("[R-SERVER-032] given sign-ups switched off, when the screen shows, then it says the game is full, offers no sign-in form, and its button waits", () => {
    render(<Full retryAfter={WAIT_S} check={checker(["full"]).check} onOpen={() => undefined} />);
    expect(screen.getByText(say("server.full"))).toBeDefined();
    expect(say("server.full")).toBe("Japacity is full right now. Try again shortly.");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.querySelector("input")).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: say("ui.full.check") }).disabled).toBe(true);
  });

  test("[R-SERVER-032] given the wait, when a millisecond short of it passes, then nothing is asked; when it ends, then the server is asked once, and again after each wait while it stays full", async () => {
    const { check, asked } = checker(["full"]);
    render(<Full retryAfter={WAIT_S} check={check} onOpen={() => undefined} />);
    await pass(WAIT_S * 1000 - 1);
    expect(asked()).toBe(0);
    await pass(1);
    expect(asked()).toBe(1);
    await pass(WAIT_S * 1000 - 1);
    expect(asked()).toBe(1);
    await pass(1);
    expect(asked()).toBe(2);
  });

  test("[R-SERVER-032] given the server open again, when the wait ends, then the screen hands over once and asks no more", async () => {
    const { check, asked } = checker(["full", "open"]);
    const onOpen = vi.fn();
    render(<Full retryAfter={WAIT_S} check={check} onOpen={onOpen} />);
    await pass(WAIT_S * 1000);
    expect(onOpen).not.toHaveBeenCalled();
    await pass(WAIT_S * 1000);
    expect(onOpen).toHaveBeenCalledTimes(1);
    await pass(WAIT_S * 3000);
    expect(asked()).toBe(2);
  });

  test("[R-SERVER-032] given the server unreachable when the wait ends, when the visitor presses the button, then it is asked again at once", async () => {
    const { check, asked } = checker(["down", "open"]);
    const onOpen = vi.fn();
    render(<Full retryAfter={WAIT_S} check={check} onOpen={onOpen} />);
    await pass(WAIT_S * 1000);
    expect(screen.getByRole("alert").textContent).toBe(say("ui.account.fail.unreachable"));
    const button = screen.getByRole<HTMLButtonElement>("button", { name: say("ui.full.check") });
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    await pass(0);
    expect(asked()).toBe(2);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
