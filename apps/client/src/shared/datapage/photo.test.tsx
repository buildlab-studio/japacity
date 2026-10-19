// The page's photo in the player's own colours (prologue:player-colours-on-looks): the figure rendered in its colours and
// kept with the person, falling back to the look's picture as made or where WebGL is missing.
import { render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { keepPerson, readPerson } from "../frontdoor/person";
import { createGameStore } from "../../authority/store";
import { gateLook } from "../frontdoor/Gate";
import { lookOf } from "../frontdoor/looks";
import { PERSON_KEY } from "../kept/storage";
import { DataPage } from "./DataPage";
import { pageOf } from "./PageSheet";
import { PHOTO_BOX, PHOTO_MIN_PX, photoHeight, photoWidth, sharpEnough } from "./photo.size";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

afterEach(() => {
  localStorage.clear();
});

const PHOTO = "data:image/webp;base64,UklGRg==";
const photo = (): string | null => document.querySelector("[data-photo] img")?.getAttribute("src") ?? null;

describe("the page's photo", () => {
  test("[prologue:player-colours-on-looks] given a person kept in a style with its photo, when the page is shown in the world, then the photo is the one drawn in the player's colours", async () => {
    keepPerson({ look: "person_tunde", name: "Kola", archetype: null, style: { top: "wine" }, photo: PHOTO });
    const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "photo-seed", now: () => 0 });
    const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
    await store.getState().chooseLife("scenario.ada");
    const page = pageOf(store.getState().view!);
    expect(page.wear).toEqual({ look: "person_tunde", style: { top: "wine" }, photo: PHOTO });
    render(
      <GameProvider store={store}>
        <DataPage page={page} />
      </GameProvider>,
    );
    expect(photo()).toBe(PHOTO);
    expect(document.querySelector("[data-photo-made]")).not.toBeNull();
  });

  test("[prologue:player-colours-on-looks] given WebGL missing, as made or in a style, then the photo is the look's own picture, and only there", () => {
    const picture = lookOf("person_tunde")!.picture;
    const fields = { name: "Kola", age: "", path: "", ready: "", photo: picture };
    const { unmount } = render(<DataPage page={{ ...fields, wear: { look: "person_tunde" } }} />);
    expect(photo()).toBe(picture);
    unmount();
    keepPerson({ look: "person_tunde", name: "Kola", archetype: null, style: { top: "wine" } });
    render(<DataPage page={{ ...fields, wear: { look: "person_tunde", style: { top: "wine" } } }} />);
    expect(photo()).toBe(picture);
    expect(document.querySelector("[data-photo-made]")).toBeNull();
    // Nothing was drawn, so nothing is kept as the photo.
    expect(readPerson()?.photo).toBeUndefined();
  });
});

describe("the photo's size", () => {
  test("[prologue:player-colours-on-looks] given a screen's pixel ratio, when the photo is drawn, then it is the box's displayed 98 by 128 px times the ratio held to 2 to 3, so a Pixel 7 at 2.625 gets 258 by 337", () => {
    expect(PHOTO_BOX).toEqual({ width: 98, height: 128 });
    expect([1, 2, 2.5, 2.625, 3, 4].map(photoWidth)).toEqual([196, 196, 245, 258, 294, 294]);
    expect(photoWidth(Number.NaN)).toBe(PHOTO_MIN_PX);
    expect(PHOTO_MIN_PX).toBe(196);
    expect([196, 258, 294].map(photoHeight)).toEqual([256, 337, 384]);
  });

  test("[prologue:player-colours-on-looks] given a photo kept without its width, or narrower than the screen wants, then it is drawn again; one as wide is kept", () => {
    expect(sharpEnough(undefined, 2)).toBe(false);
    expect(sharpEnough(172, 2)).toBe(false);
    expect(sharpEnough(196, 3)).toBe(false);
    expect(sharpEnough(196, 2)).toBe(true);
    expect(sharpEnough(294, 3)).toBe(true);
    // A photo saved at a larger width is sharp enough already.
    expect(sharpEnough(480, 3)).toBe(true);
  });

  test("[prologue:player-colours-on-looks] given a person kept with a photo and its width, when the person is read and the page is made, then the width goes with the photo; a width with no photo is dropped", async () => {
    keepPerson({ look: "person_tunde", name: "Kola", archetype: null, style: { top: "wine" }, photo: PHOTO, photoPx: 480 });
    expect(readPerson()?.photoPx).toBe(480);
    const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "photo-seed", now: () => 0 });
    const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
    await store.getState().chooseLife("scenario.ada");
    expect(pageOf(store.getState().view!).wear).toEqual({ look: "person_tunde", style: { top: "wine" }, photo: PHOTO, photoPx: 480 });
    keepPerson({ look: "person_tunde", name: "Kola", archetype: null, style: { top: "wine" }, photoPx: 480 });
    expect(readPerson()?.photoPx).toBeUndefined();
  });

  test("[prologue:front-door-builds-a-person] given a person kept with an old chr_ look, when the page is made, then it shows the look a person with none would show, with the name, the colours and the photo kept", async () => {
    localStorage.setItem(PERSON_KEY, JSON.stringify({ look: "chr_ada", name: "Bola", archetype: null, style: { top: "wine" }, photo: PHOTO, photoPx: 480 }));
    const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "photo-seed", now: () => 0 });
    const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
    await store.getState().chooseLife("scenario.ada");
    const page = pageOf(store.getState().view!);
    expect(page.name).toContain("Bola");
    expect(page.wear).toEqual({ look: gateLook(undefined), style: { top: "wine" }, photo: PHOTO, photoPx: 480 });
    expect(page.wear?.look).toMatch(/^person_/);
  });
});
