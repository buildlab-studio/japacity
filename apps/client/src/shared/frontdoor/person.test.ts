// The person kept beside the save (prologue.md R-PROLOGUE-009, 015): the look, the name, the archetype, and the
// player's own colours on the look with the page's photo drawn in them.
import { describe, expect, test } from "vitest";

import { keepPerson, keptStyleOf, readPerson } from "./person";
import { PERSON_KEY } from "../kept/storage";
import { memoryStorage } from "../testing/storage";

const PHOTO = "data:image/webp;base64,UklGRg==";

describe("the person's own colours, kept", () => {
  test("[R-PROLOGUE-015] given a person kept with a style and a photo, when it is read back, then the style and the photo come back with the look and the name", () => {
    const storage = memoryStorage();
    keepPerson({ look: "chr_tunde", name: "Kola", archetype: "developer", style: { skin: "skin2", top: "wine", fabric: "plain" }, photo: PHOTO }, storage);
    expect(readPerson(storage)).toEqual({ look: "chr_tunde", name: "Kola", archetype: "developer", style: { skin: "skin2", top: "wine", fabric: "plain" }, photo: PHOTO });
    expect(keptStyleOf("shared/chr/chr_tunde.glb", storage)).toEqual({ skin: "skin2", top: "wine", fabric: "plain" });
    // Another look's file wears nothing of it.
    expect(keptStyleOf("shared/chr/chr_ada.glb", storage)).toBeUndefined();
  });

  test("[R-PROLOGUE-015] given a person kept as made, or kept before colours existed, then it reads back with no style and no photo", () => {
    const storage = memoryStorage();
    storage.setItem(PERSON_KEY, JSON.stringify({ look: "chr_ada", name: "Ada", archetype: null }));
    expect(readPerson(storage)).toEqual({ look: "chr_ada", name: "Ada", archetype: null });
    expect(keptStyleOf("shared/chr/chr_ada.glb", storage)).toBeUndefined();
  });

  test("[R-PROLOGUE-015] given a person kept as made with the photo drawn as made, when it is read back, then the photo and its width come back with no style", () => {
    const storage = memoryStorage();
    keepPerson({ look: "chr_ada", name: "Ada", archetype: null, photo: PHOTO, photoPx: 258 }, storage);
    expect(readPerson(storage)).toEqual({ look: "chr_ada", name: "Ada", archetype: null, photo: PHOTO, photoPx: 258 });
  });

  test("[R-PROLOGUE-015] given a style that is not the palette's, or a photo that is not an image of its own, when it is read back, then those are dropped and the person stands", () => {
    const storage = memoryStorage();
    storage.setItem(PERSON_KEY, JSON.stringify({ look: "chr_ada", name: "Ada", archetype: null, style: { skin: "#ff00ff", hair: "gold", fabric: "silk", strength: 9 }, photo: "https://example.com/face.png" }));
    expect(readPerson(storage)).toEqual({ look: "chr_ada", name: "Ada", archetype: null, style: { hair: "gold" } });
    storage.setItem(PERSON_KEY, JSON.stringify({ look: "chr_ada", name: "Ada", archetype: null, style: { skin: "nothing" }, photo: PHOTO }));
    expect(readPerson(storage)).toEqual({ look: "chr_ada", name: "Ada", archetype: null });
  });
});
