// The deck of lives picks the card swiped to its middle (prologue:front-door-three-screens), measured inside the deck itself: the
// deck sits in a door laid out round it, so a card's place on the page is not its place in the deck's scroll.
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ARCHETYPES } from "../../shared/front-door/archetypes";
import { LOOKS } from "../../shared/front-door/looks";
import { LifeScreen } from "./LifeScreen";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

/** The deck's width, the card's width with its gap, and the deck's left edge on the page, as a phone lays the door out. */
const DECK = 600;
const STEP = 296;
const CARD = 282;
const PAD = DECK / 2 - CARD / 2;
const DECK_LEFT = 452;

function rect(left: number, width: number): DOMRect {
  return { left, right: left + width, width, top: 0, bottom: 400, height: 400, x: left, y: 0, toJSON: () => ({}) };
}

/** Lays the deck out as the browser does: the cards' page offsets measured from the door round the deck, and their boxes moving with its scroll. */
function layOut(deck: HTMLElement): void {
  Object.defineProperty(deck, "clientWidth", { configurable: true, value: DECK });
  deck.getBoundingClientRect = () => rect(DECK_LEFT, DECK);
  [...deck.children].forEach((child, index) => {
    const card = child as HTMLElement;
    Object.defineProperty(card, "offsetWidth", { configurable: true, value: CARD });
    Object.defineProperty(card, "offsetLeft", { configurable: true, value: DECK_LEFT + PAD + index * STEP });
    card.getBoundingClientRect = () => rect(DECK_LEFT + PAD + index * STEP - deck.scrollLeft, CARD);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the deck of lives", () => {
  test.each([1, 2, 4, ARCHETYPES.length - 1])("[prologue:front-door-three-screens] given the first life picked, when the deck is swiped to card %i and comes to rest, then that card's life is picked", (to) => {
    const onPick = vi.fn();
    const { container } = render(<LifeScreen look={LOOKS[0]!.id} picked={ARCHETYPES[0]!} once={false} onPick={onPick} lowest={22} older={0} open={[0, 1, 2]} onStep={() => undefined} />);
    const deck = container.querySelector<HTMLElement>("[data-archetypes]")!;
    layOut(deck);
    deck.scrollLeft = to * STEP;
    fireEvent.scroll(deck);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(ARCHETYPES[to]);
  });

  test("[prologue:front-door-three-screens] given the first life picked, when the deck is nudged less than half a card and comes to rest, then nothing new is picked", () => {
    const onPick = vi.fn();
    const { container } = render(<LifeScreen look={LOOKS[0]!.id} picked={ARCHETYPES[0]!} once={false} onPick={onPick} lowest={22} older={0} open={[0, 1, 2]} onStep={() => undefined} />);
    const deck = container.querySelector<HTMLElement>("[data-archetypes]")!;
    layOut(deck);
    deck.scrollLeft = STEP / 2 - 10;
    fireEvent.scroll(deck);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onPick).not.toHaveBeenCalled();
  });
});
