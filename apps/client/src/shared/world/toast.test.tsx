// A toast stands long enough to read and holds while touched (world:things-are-tappable-models): at least four seconds, a second more
// for every twelve letters past forty, and its time stops while a finger or the pointer rests on it.
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { MONEY_TOAST_MS, MoneyToast } from "./MoneyToast";
import { SAID_TOAST_MS, SaidToast, toastMs } from "./SaidToast";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("a toast's time", () => {
  test("[world:things-are-tappable-models] given words of every length, when a toast's time is read, then it is at least four seconds and a second more for every twelve letters past forty", () => {
    expect(SAID_TOAST_MS).toBe(4000);
    expect(MONEY_TOAST_MS).toBe(4000);
    expect(toastMs("Fetch water")).toBe(4000);
    expect(toastMs("x".repeat(40))).toBe(4000);
    expect(toastMs("x".repeat(41))).toBe(5000);
    expect(toastMs("x".repeat(52))).toBe(5000);
    expect(toastMs("x".repeat(53))).toBe(6000);
  });

  test("[world:things-are-tappable-models] given a said toast, when it stands, then it goes at its time and not before", () => {
    const gone = vi.fn();
    render(<SaidToast said={{ at: 1, words: "Fetch water", picture: "activity.fetch-water" }} onGone={gone} />);
    act(() => {
      vi.advanceTimersByTime(SAID_TOAST_MS - 1);
    });
    expect(gone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(gone).toHaveBeenCalledTimes(1);
  });

  test("[world:things-are-tappable-models] given a said toast, when a finger rests on it past its time, then it stays, and goes once let go with the time it had left", () => {
    const gone = vi.fn();
    const { container } = render(<SaidToast said={{ at: 2, words: "Fetch water", picture: "activity.fetch-water" }} onGone={gone} />);
    const toast = container.querySelector<HTMLElement>("[data-said-toast]")!;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.pointerDown(toast);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(gone).not.toHaveBeenCalled();
    fireEvent.pointerUp(toast);
    act(() => {
      vi.advanceTimersByTime(SAID_TOAST_MS - 1000 - 1);
    });
    expect(gone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(gone).toHaveBeenCalledTimes(1);
  });

  test("[world:things-are-tappable-models] given a money toast, when the pointer rests on it, then it holds, and goes after the pointer leaves", () => {
    const gone = vi.fn();
    const { container } = render(<MoneyToast toast={{ at: 3, title: "Side gig", amount: "+₦5,000", picture: "activity.side-gig" }} onGone={gone} />);
    const toast = container.querySelector<HTMLElement>("[data-money-toast]")!;
    fireEvent.pointerEnter(toast);
    act(() => {
      vi.advanceTimersByTime(MONEY_TOAST_MS * 3);
    });
    expect(gone).not.toHaveBeenCalled();
    fireEvent.pointerLeave(toast);
    act(() => {
      vi.advanceTimersByTime(MONEY_TOAST_MS);
    });
    expect(gone).toHaveBeenCalledTimes(1);
  });
});
