// The homes the door offers (prologue:front-door-three-screens): your own room first, the
// hostel room second, the family house last as one more reason to leave, each with a line; Makoko for the child of the
// water alone. The tile's preset still picks when the player does not, and a life with no choice starts at the family house.
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { ARCHETYPES, archetypeOf, homeOf, homesFor, withHome } from "./archetypes";

describe("the homes on the door", () => {
  test("[prologue:front-door-three-screens] given every tile, when its homes are listed, then they come as the room in a compound, the hostel room and the family house, Makoko after them for the child of the water alone", () => {
    for (const tile of ARCHETYPES) {
      const offered = homesFor(tile);
      expect({ tile: tile.id, offered }).toEqual({ tile: tile.id, offered: tile.id === "water" ? ["compound-room", "hostel-room", "family-house", "makoko"] : ["compound-room", "hostel-room", "family-house"] });
    }
  });

  test("[prologue:front-door-three-screens] [text:show-then-tell] given each home on the door, when its line is read, then it says what living there is in a few words, the family house as one more reason to leave, and never what its cost line already says", () => {
    expect(say("ui.door.home.line.compound-room")).toBe("Your things, your spot by the gate");
    expect(say("ui.door.home.line.hostel-room")).toBe("The corridor never sleeps");
    expect(say("ui.door.home.line.family-house")).toBe("A free roof, Mama's parlour, one more reason to leave");
    expect(say("ui.door.home.line.makoko")).toBe("On the water, and some months the settlement is cleared");
    // The cost line carries the rent, the month and the share; the line beside it never says them again.
    for (const home of ["compound-room", "hostel-room", "family-house", "makoko"]) expect(say(`ui.door.home.line.${home}`)).not.toMatch(/by the year|by the month|cheap|your share|rent/i);
  });

  test("[prologue:front-door-three-screens] [text:show-then-tell] given the door's lines under its headings and the page's line under japacity, when they are read, then each is one short sentence that never tells the player to swipe or that a roof has a price", () => {
    for (const key of ["ui.door.life.line", "ui.door.home.hint", "prologue.door.name.hint"]) {
      const line = say(key);
      expect({ key, words: line.split(/\s+/).length <= 7, sentences: line.split(". ").length }).toEqual({ key, words: true, sentences: 1 });
    }
    expect(say("ui.door.life.line")).not.toMatch(/[Ss]wipe/);
    expect(say("ui.door.home.hint")).not.toMatch(/price/);
    expect(say("ui.page.japacity.line").split(/\s+/).length).toBeLessThanOrEqual(10);
  });

  test("[prologue:front-door-three-screens] [prologue:archetype-presets-answers] given a tile with no home picked, when its home is read, then its own preset picks it, else the family house; a home picked on the door becomes the preset", () => {
    for (const tile of ARCHETYPES) expect(homeOf(tile)).toBe(tile.id === "water" ? "makoko" : "family-house");
    const developer = archetypeOf("developer");
    if (developer === null) throw new Error("No developer tile");
    expect(homeOf(withHome(developer, "hostel-room"))).toBe("hostel-room");
    expect(homeOf(withHome(developer, "nowhere"))).toBe("family-house");
  });
});
