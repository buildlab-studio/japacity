// The start screen's lockup (account.md R-ACCOUNT-029): the wordmark for the ground under it, by day and by night, so the
// word never goes navy on the night's navy.
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { StartScreen } from "./StartScreen";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  delete document.documentElement.dataset.paint;
});

describe("the start screen's lockup", () => {
  test("[R-ACCOUNT-029] given the start screen, then its one lockup is the light ground's by day and the dark ground's under the night paint, following the paint as it turns", async () => {
    render(<StartScreen onPlay={() => undefined} onReturning={() => undefined} />);
    expect(document.querySelectorAll("[data-wordmark]")).toHaveLength(1);
    expect(document.querySelector("[data-wordmark='light']")).not.toBeNull();
    await act(async () => {
      document.documentElement.dataset.paint = "night";
      await Promise.resolve();
    });
    expect(document.querySelectorAll("[data-wordmark]")).toHaveLength(1);
    expect(document.querySelector("[data-wordmark='dark']")).not.toBeNull();
  });
});
