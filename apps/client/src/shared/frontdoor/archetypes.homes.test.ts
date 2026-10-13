// The homes the door offers (prologue.md R-PROLOGUE-013 as the home's wave asks it amended): your own room first, the
// hostel room second, the family house last as one more reason to leave, each with a line; Makoko for the child of the
// water alone. The tile's preset still picks when the player does not, and a life with no choice starts at the family house.
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { ARCHETYPES, archetypeOf, homeOf, homesFor, withHome } from "./archetypes";

describe("the homes on the door", () => {
  test("[R-PROLOGUE-013] given every tile, when its homes are listed, then they come as the room in a compound, the hostel room and the family house, Makoko after them for the child of the water alone", () => {
    for (const tile of ARCHETYPES) {
      const offered = homesFor(tile);
      expect({ tile: tile.id, offered }).toEqual({ tile: tile.id, offered: tile.id === "water" ? ["compound-room", "hostel-room", "family-house", "makoko"] : ["compound-room", "hostel-room", "family-house"] });
    }
  });

  test("[R-PROLOGUE-013] given each home on the door, when its line is read, then it says what living there is in a few words, the family house as one more reason to leave", () => {
    expect(say("ui.door.home.line.compound-room")).toBe("Rent by the year, your things, your spot by the gate");
    expect(say("ui.door.home.line.hostel-room")).toBe("Cheap, by the month, the corridor never sleeps");
    expect(say("ui.door.home.line.family-house")).toBe("A free roof, your share for the house, Mama's parlour; one more reason to leave");
  });

  test("[R-PROLOGUE-013] [R-PROLOGUE-010] given a tile with no home picked, when its home is read, then its own preset picks it, else the family house; a home picked on the door becomes the preset", () => {
    for (const tile of ARCHETYPES) expect(homeOf(tile)).toBe(tile.id === "water" ? "makoko" : "family-house");
    const developer = archetypeOf("developer");
    if (developer === null) throw new Error("No developer tile");
    expect(homeOf(withHome(developer, "hostel-room"))).toBe("hostel-room");
    expect(homeOf(withHome(developer, "nowhere"))).toBe("family-house");
  });
});
