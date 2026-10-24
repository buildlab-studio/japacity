// The fan as a component (docs/design/09-the-games-look.md section 3; world:things-are-tappable-models, world:one-action-one-sheet): it
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
  return { id, from: "cook", kind: "now", act: { id: "cook", label: "city.act.cook", kind: "sheet", stages: id }, name: `Act ${id}`, picture: "🍜", tint: "food", price: "₦1,500", balance: { before: { amount: 4_850_000, words: "₦48,500" }, after: { amount: 4_700_000, words: "₦47,000" } }, refusal: null, param: null, ...change };
}

function fanOf(entries: FanEntry[], thing = "cooking") {
  const onAct = vi.fn();
  const onFallback = vi.fn();
  const onPreview = vi.fn();
  render(<Fan thing={thing} title="The cooking corner" entries={entries} onAct={onAct} onFallback={onFallback} onPreview={onPreview} />);
  return { onAct, onFallback, onPreview };
}

function buttons(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-fan-act] button")];
}

describe("the fan", () => {
  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] [world:one-action-one-sheet] given a thing fanned, when the scene first says where it stands, then its buttons show with each name and its price in the yellow pill alone; a free meal says Free, a free rest says nothing, and a press previews what would be left", () => {
    const { onPreview } = fanOf([entry("a"), entry("b", { price: null, balance: null, free: true }), entry("c", { price: null, balance: null })], "cooking-1");
    expect(buttons()).toHaveLength(0);
    act(() => anchorFan("cooking-1", { x: 100, y: 380 }));
    expect(buttons()).toHaveLength(3);
    expect(screen.getByRole("group", { name: "The cooking corner" }).dataset.fanSide).toBe("right");
    const first = document.querySelector<HTMLElement>('[data-fan-act="a"]');
    expect(first?.querySelector("[data-fan-price]")?.textContent).toBe("₦1,500");
    // Chips earn their place (docs/design/09-the-games-look.md section 2): no balance pair, no "No cost" beside a button in the scene.
    expect(first?.querySelector("[data-balance-before], [data-balance]")).toBeNull();
    expect(document.querySelector("[data-fan]")?.textContent).not.toContain("No cost");
    const free = document.querySelector<HTMLElement>('[data-fan-act="b"]');
    expect(free?.querySelector("[data-fan-price]")?.textContent).toBe(say("ui.world.free"));
    expect(document.querySelector('[data-fan-act="c"] [data-fan-price]')).toBeNull();
    fireEvent.pointerDown(document.querySelector<HTMLElement>('[data-fan-act="a"] button')!);
    expect(onPreview).toHaveBeenLastCalledWith(4_700_000);
    fireEvent.pointerUp(document.querySelector<HTMLElement>('[data-fan-act="a"] button')!);
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given a button that can be had, when it is tapped, then the fan acts with its entry; a refused one shakes and acts not", () => {
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

  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given a locked act, when the fan shows, then it says why in place of its price, with a lock", () => {
    fanOf([entry("a", { refusal: { kind: "locked", words: "Needs a big pot" } })], "cooking-3");
    act(() => anchorFan("cooking-3", { x: 100, y: 380 }));
    const locked = document.querySelector<HTMLElement>('[data-fan-act="a"]');
    expect(locked?.dataset.fanRefused).toBe("locked");
    expect(locked?.querySelector('[data-fan-refusal="locked"]')?.textContent).toContain("Needs a big pot");
    expect(locked?.querySelector("[data-fan-price]")).toBeNull();
  });

  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given a thing in the very middle of the screen, or off it, when the fan would open, then it shows nothing and hands over to the sheet", () => {
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

  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given seven acts, when the fan opens, then six stand before the fold and the seventh peeks; a tap on it brings it up the curve rather than acting", () => {
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

// The fan's own rule is world:fan-of-sticker-buttons; these tests cite it beside world:things-are-tappable-models.
describe("world:fan-of-sticker-buttons the fan's pictures", () => {
  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given a thing fanned, when its buttons show, then each picture is the act's tile cut as the look's sticker", () => {
    fanOf([entry("activity.cook-at-home", { picture: "activity.cook-at-home" })], "cooking-tile");
    act(() => anchorFan("cooking-tile", { x: 100, y: 380 }));
    const picture = document.querySelector<HTMLElement>('[data-fan-act="activity.cook-at-home"] [data-fan-picture]');
    expect(picture?.querySelector("[data-sticker] [data-sticker-cut] [data-tile]")?.getAttribute("data-tile")).toBe("activity.cook-at-home");
  });
});

describe("world:fan-of-sticker-buttons every thing fans", () => {
  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given a thing fanned, when its buttons show, then the thing's name stands in a pill over it, and a person the game plays carries the quiet mark beside it", () => {
    render(<Fan thing="dele" title="Dele" mark="computer" entries={[entry("talk", { kind: "act", picture: "act.talk", price: null, balance: null })]} onAct={vi.fn()} onFallback={vi.fn()} />);
    act(() => anchorFan("dele", { x: 100, y: 380 }));
    const title = document.querySelector<HTMLElement>('[data-fan="dele"] [data-fan-title]');
    expect(title?.textContent).toContain("Dele");
    expect(title?.querySelector('[data-person-mark="computer"]')?.textContent).toBe("Not a player");
  });

  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given someone standing as themselves with no act, when they are tapped, then their name shows alone and nothing hands over to a sheet", () => {
    const onFallback = vi.fn();
    render(<Fan thing="graduate-partner" title="Bola" mark="computer" entries={[]} onAct={vi.fn()} onFallback={onFallback} />);
    act(() => anchorFan("graduate-partner", { x: 195, y: 380 }));
    expect(document.querySelector('[data-fan="graduate-partner"] [data-fan-title]')?.textContent).toContain("Bola");
    expect(buttons()).toHaveLength(0);
    expect(onFallback).not.toHaveBeenCalled();
  });

  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given a pose, Sleep and a word with someone, when they fan, then each is a button with its own name and glyph, no price pill and no Free, and a tap acts with it", () => {
    const glyphs = [entry("sit", { kind: "act", picture: "act.sit", price: null, balance: null }), entry("end-month", { kind: "act", picture: "act.sleep", price: null, balance: null }), entry("talk", { kind: "act", picture: "act.talk", price: null, balance: null })];
    const { onAct } = fanOf(glyphs, "sofa-glyphs");
    act(() => anchorFan("sofa-glyphs", { x: 100, y: 380 }));
    expect([...document.querySelectorAll<HTMLElement>("[data-fan-act] [data-tile]")].map((tile) => tile.dataset.glyph)).toEqual(["sit", "sleep", "talk"]);
    expect(document.querySelector("[data-fan-price]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Act end-month" }));
    expect(onAct).toHaveBeenCalledWith(expect.objectContaining({ id: "end-month", kind: "act" }));
  });

  test("[world:fan-of-sticker-buttons] [world:month-acts-carry-on] given an act carrying on in the plan, when it fans, then its button says Ongoing and is shut, and the stop beside it can be had", () => {
    const { onAct } = fanOf([entry("activity.apprentice-repair", { kind: "act", price: null, balance: null, refusal: { kind: "planned", words: "Ongoing" } }), entry("apprentice:stop", { kind: "stop", name: "Stop", label: "Stop Learn repairs", picture: "act.stop", price: null, balance: null })], "stall-planned");
    act(() => anchorFan("stall-planned", { x: 100, y: 380 }));
    const shut = screen.getByRole("button", { name: "Act activity.apprentice-repair: Ongoing" });
    expect(shut.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(shut);
    expect(onAct).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stop Learn repairs" }));
    expect(onAct).toHaveBeenCalledWith(expect.objectContaining({ kind: "stop" }));
  });

  test("[world:fan-of-sticker-buttons] [world:things-are-tappable-models] given more acts than a fan holds, when it would open, then the list hands over to the sheet", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((id) => entry(id));
    const { onFallback } = fanOf(many, "cooking-long");
    act(() => anchorFan("cooking-long", { x: 60, y: 360 }));
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(buttons()).toHaveLength(0);
  });
});
