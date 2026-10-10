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
