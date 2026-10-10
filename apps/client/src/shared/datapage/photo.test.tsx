// The page's photo in the player's own colours (prologue.md R-PROLOGUE-015): the figure rendered in its colours and
// kept with the person, falling back to the look's picture as made or where WebGL is missing.
import { render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { keepPerson, readPerson } from "../../authority/person";
import { createGameStore } from "../../authority/store";
import { lookOf } from "../frontdoor/looks";
import { DataPage } from "./DataPage";
import { pageOf } from "./PageSheet";
import { PHOTO_MIN_PX, photoHeight, photoWidth, sharpEnough } from "./photo.size";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

afterEach(() => {
  localStorage.clear();
});

const PHOTO = "data:image/webp;base64,UklGRg==";
const photo = (): string | null => document.querySelector("[data-photo] img")?.getAttribute("src") ?? null;

describe("the page's photo", () => {
  test("[R-PROLOGUE-015] given a person kept in a style with its photo, when the page is shown in the world, then the photo is the one drawn in the player's colours", async () => {
    keepPerson({ look: "chr_tunde", name: "Kola", archetype: null, style: { top: "wine" }, photo: PHOTO });
    const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "photo-seed", now: () => 0 });
    const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
    await store.getState().chooseLife("scenario.ada");
    const page = pageOf(store.getState().view!);
    expect(page.wear).toEqual({ look: "chr_tunde", style: { top: "wine" }, photo: PHOTO });
    render(
      <GameProvider store={store}>
        <DataPage page={page} />
      </GameProvider>,
    );
    expect(photo()).toBe(PHOTO);
    expect(document.querySelector("[data-photo-made]")).not.toBeNull();
  });

  test("[R-PROLOGUE-015] given the look as made, or a style where WebGL is missing, then the photo is the look's own picture", () => {
    const picture = lookOf("chr_tunde")!.picture;
    const fields = { name: "Kola", age: "", path: "", ready: "", photo: picture };
    const { unmount } = render(<DataPage page={{ ...fields, wear: { look: "chr_tunde" } }} />);
    expect(photo()).toBe(picture);
    unmount();
    keepPerson({ look: "chr_tunde", name: "Kola", archetype: null, style: { top: "wine" } });
    render(<DataPage page={{ ...fields, wear: { look: "chr_tunde", style: { top: "wine" } } }} />);
    expect(photo()).toBe(picture);
    expect(document.querySelector("[data-photo-made]")).toBeNull();
    // Nothing was drawn, so nothing is kept as the photo.
    expect(readPerson()?.photo).toBeUndefined();
  });
});

describe("the photo's size", () => {
  test("[R-PROLOGUE-015] given a screen's pixel ratio, when the photo is drawn, then it is the box's 160 px times the ratio, never under 320 px nor over 480 px across, in the box's shape", () => {
    expect([1, 2, 2.5, 3, 4].map(photoWidth)).toEqual([320, 320, 400, 480, 480]);
    expect(photoWidth(Number.NaN)).toBe(PHOTO_MIN_PX);
    expect(photoHeight(320)).toBe(417);
    expect(photoHeight(480)).toBe(625);
  });

  test("[R-PROLOGUE-015] given a photo kept without its width, or narrower than the screen wants, then it is drawn again; one as wide is kept", () => {
    expect(sharpEnough(undefined, 2)).toBe(false);
    expect(sharpEnough(172, 2)).toBe(false);
    expect(sharpEnough(320, 3)).toBe(false);
    expect(sharpEnough(320, 2)).toBe(true);
    expect(sharpEnough(480, 3)).toBe(true);
  });

  test("[R-PROLOGUE-015] given a person kept with a photo and its width, when the person is read and the page is made, then the width goes with the photo; a width with no photo is dropped", async () => {
    keepPerson({ look: "chr_tunde", name: "Kola", archetype: null, style: { top: "wine" }, photo: PHOTO, photoPx: 480 });
    expect(readPerson()?.photoPx).toBe(480);
    const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "photo-seed", now: () => 0 });
    const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
    await store.getState().chooseLife("scenario.ada");
    expect(pageOf(store.getState().view!).wear).toEqual({ look: "chr_tunde", style: { top: "wine" }, photo: PHOTO, photoPx: 480 });
    keepPerson({ look: "chr_tunde", name: "Kola", archetype: null, style: { top: "wine" }, photoPx: 480 });
    expect(readPerson()?.photoPx).toBeUndefined();
  });
});
