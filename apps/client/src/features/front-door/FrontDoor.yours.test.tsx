// "Make it yours" kept in sight (prologue:front-door-three-screens, the door's first screen with Make it yours as a disclosure),
// since an expanded section can open below the fold: opened, the section is brought into view once its
// rows stand, and each colour picked brings the next part to choose into view, smoothly, or at once under reduced motion.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { forgetOwnColours, type OwnColours, reportOwn } from "../../shared/front-door/style";
import { stubReducedMotion } from "../../shared/testing/motion";
import { say } from "../../shared/words/text";
import { FrontDoor } from "./FrontDoor";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

/** Each element the door brought into view, and how. */
const brought: { element: Element; options: ScrollIntoViewOptions | boolean | undefined }[] = [];

beforeEach(() => {
  brought.length = 0;
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: function (this: Element, options?: ScrollIntoViewOptions | boolean) {
      brought.push({ element: this, options });
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  vi.unstubAllGlobals();
  localStorage.clear();
  act(forgetOwnColours);
});

function door(): void {
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "yours-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  render(
    <GameProvider store={store}>
      <FrontDoor />
    </GameProvider>,
  );
}

const lookShown = (): string => document.querySelector("[data-gate]")?.getAttribute("data-look") ?? "";
const openYours = (): void => {
  fireEvent.click(screen.getByRole("button", { name: say("ui.door.yours") }));
};
const swatch = (part: string, colour: string) => document.querySelector<HTMLElement>(`[data-swatches='${part}'] [data-swatch='${colour}']`)!;
/** The marks of what was brought into view, in turn. */
const marks = (): string[] =>
  brought.map(({ element }) => (element.hasAttribute("data-door-yours") ? "yours" : `row:${element.getAttribute("data-yours-row") ?? "?"}`));

/** A look with every part: skin, hair, a top and a printed top's fabric. */
const PRINTED: OwnColours = { skin: "skin4", hair: "hair", top: "indigo", fabric: "ankara" };

describe("Make it yours in view", () => {
  test("[prologue:front-door-three-screens] given Make it yours shut, when it is opened and its rows stand, then its section is brought into view smoothly, once", () => {
    stubReducedMotion(false);
    door();
    openYours();
    // Nothing to see until the figure is read: the rows stand only then.
    expect(brought).toHaveLength(0);
    act(() => reportOwn(lookShown(), PRINTED));
    expect(marks()).toEqual(["yours"]);
    expect(brought[0]?.options).toEqual({ block: "nearest", behavior: "smooth" });
    // A pick on the screen is no new opening: the section is not brought again.
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bisi" } });
    expect(marks()).toEqual(["yours"]);
  });

  test("[prologue:front-door-three-screens] given the figure already read, when Make it yours is opened, shut and opened again, then each opening brings it into view", () => {
    stubReducedMotion(false);
    door();
    act(() => reportOwn(lookShown(), PRINTED));
    openYours();
    openYours();
    openYours();
    expect(marks()).toEqual(["yours", "yours"]);
  });

  test("[prologue:front-door-three-screens] given reduced motion, when Make it yours is opened and a colour picked, then each is brought into view at once, with no smooth scroll", () => {
    stubReducedMotion(true);
    door();
    act(() => reportOwn(lookShown(), PRINTED));
    openYours();
    fireEvent.click(swatch("skin", "skin1"));
    expect(marks()).toEqual(["yours", "row:hair"]);
    expect(brought.map(({ options }) => options)).toEqual([
      { block: "nearest", behavior: "instant" },
      { block: "nearest", behavior: "instant" },
    ]);
  });

  test("[prologue:front-door-three-screens] given Make it yours open, when a colour is picked in each part in turn, then the next part to choose is brought into view, and the last brings nothing", () => {
    stubReducedMotion(false);
    door();
    act(() => reportOwn(lookShown(), PRINTED));
    openYours();
    fireEvent.click(swatch("skin", "skin2"));
    fireEvent.click(swatch("hair", "gold"));
    fireEvent.click(swatch("top", "teal"));
    fireEvent.click(document.querySelector<HTMLElement>("[data-fabric='adire']")!);
    expect(marks()).toEqual(["yours", "row:hair", "row:top", "row:fabric"]);
    expect(brought.slice(1).map(({ options }) => options)).toEqual([
      { block: "nearest", behavior: "smooth" },
      { block: "nearest", behavior: "smooth" },
      { block: "nearest", behavior: "smooth" },
    ]);
  });

  test("[prologue:front-door-three-screens] given a look with no hair to read, when the skin is picked, then the top, the next part shown, is brought into view", () => {
    stubReducedMotion(false);
    door();
    act(() => reportOwn(lookShown(), { ...PRINTED, hair: null }));
    openYours();
    fireEvent.click(swatch("skin", "skin2"));
    expect(marks()).toEqual(["yours", "row:top"]);
  });
});
