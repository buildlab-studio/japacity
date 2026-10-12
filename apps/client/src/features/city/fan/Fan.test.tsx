// The fan as a component (docs/design/13-the-lively-layer.md section 3; docs/rules/world.md R-WORLD-005, R-WORLD-006): it
// lays out once the scene says where its thing stands, a tap on a button that can be had acts, a refusal shakes and sends
// nothing, a thing with no room beside it hands over to the sheet, and a long list drags along its curve.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { say } from "../../../shared/words/text";
import { anchorFan } from "./anchor";
import { Fan } from "./Fan";
import type { FanEntry } from "./fanActs";

const SCREEN = { width: window.innerWidth, height: window.innerHeight };

/** A phone's screen, 390 by 844, as the game is built for. */
beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "innerWidth", { value: SCREEN.width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: SCREEN.height, configurable: true });
});

function entry(id: string, change: Partial<FanEntry> = {}): FanEntry {
  return { id, name: `Act ${id}`, picture: "🍜", tint: "food", price: "₦1,500", balance: { before: { amount: 4_850_000, words: "₦48,500" }, after: { amount: 4_700_000, words: "₦47,000" } }, refusal: null, param: null, ...change };
}

function fanOf(entries: FanEntry[], thing = "cooking") {
  const onAct = vi.fn();
  const onFallback = vi.fn();
  render(<Fan thing={thing} title="The cooking corner" entries={entries} onAct={onAct} onFallback={onFallback} />);
  return { onAct, onFallback };
}

function buttons(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-fan-act] button")];
}

describe("the fan", () => {
  test("[R-WORLD-005] [R-WORLD-006] given a thing fanned, when the scene first says where it stands, then its buttons show with each name, its price in the yellow pill and the balance before struck and after", () => {
    fanOf([entry("a"), entry("b", { price: null, balance: null })], "cooking-1");
    expect(buttons()).toHaveLength(0);
    act(() => anchorFan("cooking-1", { x: 100, y: 380 }));
    expect(buttons()).toHaveLength(2);
    expect(screen.getByRole("group", { name: "The cooking corner" }).dataset.fanSide).toBe("right");
    const first = document.querySelector<HTMLElement>('[data-fan-act="a"]');
    expect(first?.querySelector("[data-fan-price]")?.textContent).toBe("₦1,500");
    expect(first?.querySelector("[data-balance-before]")?.textContent).toBe("₦48,500");
    expect(first?.querySelector("[data-balance-before]")?.tagName).toBe("S");
    expect(first?.querySelector("[data-balance-after]")?.textContent).toBe("₦47,000");
    const free = document.querySelector<HTMLElement>('[data-fan-act="b"]');
    expect(free?.querySelector("[data-fan-price]")?.textContent).toBe(say("ui.world.free"));
    expect(free?.querySelector("[data-balance-before]")).toBeNull();
  });

  test("[R-WORLD-005] given a button that can be had, when it is tapped, then the fan acts with its entry; a refused one shakes and acts not", () => {
    const { onAct } = fanOf([entry("a"), entry("b", { refusal: { kind: "short", words: "₦500 short" } })], "cooking-2");
    act(() => anchorFan("cooking-2", { x: 100, y: 380 }));
    fireEvent.click(screen.getByRole("button", { name: "Act a: ₦1,500" }));
    expect(onAct).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    const refused = screen.getByRole("button", { name: "Act b: ₦500 short" });
    expect(refused.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(refused);
    expect(onAct).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-fan-act="b"] button')?.className).toContain("fan-shake");
    expect(document.querySelector('[data-fan-act="b"] [data-fan-refusal="short"]')?.textContent).toBe("₦500 short");
  });

  test("[R-WORLD-005] given a locked act, when the fan shows, then it says why in place of its price, with a lock", () => {
    fanOf([entry("a", { refusal: { kind: "locked", words: "Needs a big pot" } })], "cooking-3");
    act(() => anchorFan("cooking-3", { x: 100, y: 380 }));
    const locked = document.querySelector<HTMLElement>('[data-fan-act="a"]');
    expect(locked?.dataset.fanRefused).toBe("locked");
    expect(locked?.querySelector('[data-fan-refusal="locked"]')?.textContent).toContain("Needs a big pot");
    expect(locked?.querySelector("[data-fan-price]")).toBeNull();
  });

  test("[R-WORLD-005] given a thing in the very middle of the screen, or off it, when the fan would open, then it shows nothing and hands over to the sheet", () => {
    const middle = fanOf([entry("a"), entry("b")], "cooking-4");
    act(() => anchorFan("cooking-4", { x: window.innerWidth / 2, y: 380 }));
    expect(middle.onFallback).toHaveBeenCalledTimes(1);
    expect(buttons()).toHaveLength(0);
    cleanup();
    const off = fanOf([entry("a")], "cooking-5");
    act(() => anchorFan("cooking-5", null));
    expect(off.onFallback).toHaveBeenCalledTimes(1);
    expect(buttons()).toHaveLength(0);
  });

  test("[R-WORLD-005] given seven acts, when the fan opens, then six stand before the fold and the seventh peeks; a tap on it brings it up the curve rather than acting", () => {
    const seven = ["a", "b", "c", "d", "e", "f", "g"].map((id) => entry(id));
    const { onAct } = fanOf(seven, "cooking-6");
    act(() => anchorFan("cooking-6", { x: 60, y: 360 }));
    const folded = () => [...document.querySelectorAll<HTMLElement>("[data-fan-folded]")].map((node) => node.dataset.fanAct);
    expect(folded()).toEqual(["g"]);
    fireEvent.click(screen.getByRole("button", { name: "Act g: ₦1,500", hidden: true }));
    expect(onAct).not.toHaveBeenCalled();
    expect(folded()).toEqual(["a"]);
  });
});
