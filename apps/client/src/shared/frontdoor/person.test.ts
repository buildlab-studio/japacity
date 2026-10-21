// The person kept beside the save (prologue:front-door-builds-a-person, prologue:player-colours-on-looks): the look, the name, the archetype, and the
// player's own colours on the look with the page's photo drawn in them.
import { describe, expect, test } from "vitest";

import { adoptPerson, keepPerson, keptLookFile, keptStyleOf, personToSend, playerName, readPerson } from "./person";
import { PERSON_KEY } from "../kept/storage";
import { memoryStorage } from "../testing/storage";

const PHOTO = "data:image/webp;base64,UklGRg==";

describe("the person's own colours, kept", () => {
  test("[prologue:player-colours-on-looks] given a person kept with a style and a photo, when it is read back, then the style and the photo come back with the look and the name", () => {
    const storage = memoryStorage();
    keepPerson({ look: "person_tunde", name: "Kola", archetype: "developer", style: { skin: "skin2", top: "wine", fabric: "plain" }, photo: PHOTO }, storage);
    expect(readPerson(storage)).toEqual({ look: "person_tunde", name: "Kola", archetype: "developer", style: { skin: "skin2", top: "wine", fabric: "plain" }, photo: PHOTO });
    expect(keptStyleOf("shared/person/person_tunde.glb", storage)).toEqual({ skin: "skin2", top: "wine", fabric: "plain" });
    // Another look's file wears nothing of it.
    expect(keptStyleOf("shared/person/person_ada.glb", storage)).toBeUndefined();
  });

  test("[prologue:player-colours-on-looks] given a person kept as made, or kept with no colours at all, then it reads back with no style and no photo", () => {
    const storage = memoryStorage();
    storage.setItem(PERSON_KEY, JSON.stringify({ look: "person_ada", name: "Ada", archetype: null }));
    expect(readPerson(storage)).toEqual({ look: "person_ada", name: "Ada", archetype: null });
    expect(keptStyleOf("shared/person/person_ada.glb", storage)).toBeUndefined();
  });

  test("[prologue:player-colours-on-looks] given a person kept as made with the photo drawn as made, when it is read back, then the photo and its width come back with no style", () => {
    const storage = memoryStorage();
    keepPerson({ look: "person_ada", name: "Ada", archetype: null, photo: PHOTO, photoPx: 258 }, storage);
    expect(readPerson(storage)).toEqual({ look: "person_ada", name: "Ada", archetype: null, photo: PHOTO, photoPx: 258 });
  });

  test("[prologue:player-colours-on-looks] given a style that is not the palette's, or a photo that is not an image of its own, when it is read back, then those are dropped and the person stands", () => {
    const storage = memoryStorage();
    storage.setItem(PERSON_KEY, JSON.stringify({ look: "person_ada", name: "Ada", archetype: null, style: { skin: "#ff00ff", hair: "gold", fabric: "silk", strength: 9 }, photo: "https://example.com/face.png" }));
    expect(readPerson(storage)).toEqual({ look: "person_ada", name: "Ada", archetype: null, style: { hair: "gold" } });
    storage.setItem(PERSON_KEY, JSON.stringify({ look: "person_ada", name: "Ada", archetype: null, style: { skin: "nothing" }, photo: PHOTO }));
    expect(readPerson(storage)).toEqual({ look: "person_ada", name: "Ada", archetype: null });
  });
});

describe("a kept look the game no longer knows", () => {
  test("[prologue:front-door-builds-a-person] given a person kept with an old chr_ look, or any look the game does not ship, when it is read back, then only the look is dropped: the name, the archetype, the colours and the photo stand", () => {
    const storage = memoryStorage();
    for (const look of ["chr_ada", "person_nobody", ""]) {
      storage.setItem(PERSON_KEY, JSON.stringify({ look, name: "Bola", archetype: "nurse", style: { top: "wine" }, photo: PHOTO, photoPx: 258 }));
      expect(readPerson(storage)).toEqual({ name: "Bola", archetype: "nurse", style: { top: "wine" }, photo: PHOTO, photoPx: 258 });
      expect(keptLookFile(storage)).toBeNull();
    }
    storage.setItem(PERSON_KEY, JSON.stringify({ look: "chr_ada", name: "Bola", archetype: "nurse" }));
    expect(readPerson(storage)).toEqual({ name: "Bola", archetype: "nurse" });
    expect(playerName({ scenario: "scenario.graduate" }, storage)).toBe("Bola");
    // A shipped look is kept as it is.
    storage.setItem(PERSON_KEY, JSON.stringify({ look: "person_tunde", name: "Bola", archetype: "nurse" }));
    expect(readPerson(storage)?.look).toBe("person_tunde");
    expect(keptLookFile(storage)).toBe("shared/person/person_tunde.glb");
  });
});

describe("the person kept with the character", () => {
  test("[account:person-kept-with-character] given a person kept with its photo, when it is sent, then it goes without the photo; a person with no look the game ships, or none, sends nothing", () => {
    const storage = memoryStorage();
    expect(personToSend(storage)).toBeNull();
    keepPerson({ look: "person_ada", name: "Ada", archetype: null, style: { skin: "skin2" }, photo: PHOTO, photoPx: 258 }, storage);
    expect(personToSend(storage)).toEqual({ look: "person_ada", name: "Ada", archetype: null, style: { skin: "skin2" } });
    storage.setItem(PERSON_KEY, JSON.stringify({ look: "chr_ada", name: "Ada", archetype: null }));
    expect(personToSend(storage)).toBeNull();
  });

  test("[account:person-kept-with-character] given what the server sends, when it is taken onto the phone, then anything not a person is refused, a photo it carries is never kept, and a look the game no longer ships drops alone", () => {
    const storage = memoryStorage();
    expect(adoptPerson({ look: "person_ada" }, storage)).toBe(false);
    expect(readPerson(storage)).toBeNull();
    expect(adoptPerson({ look: "person_ada", name: "Ada", archetype: null, photo: PHOTO }, storage)).toBe(true);
    expect(readPerson(storage)).toEqual({ look: "person_ada", name: "Ada", archetype: null });
    expect(adoptPerson({ look: "chr_ada", name: "Ada", archetype: "nurse" }, storage)).toBe(true);
    expect(readPerson(storage)).toEqual({ name: "Ada", archetype: "nurse" });
  });
});
