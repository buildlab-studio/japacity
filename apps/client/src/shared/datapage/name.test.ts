// The typed name (prologue:front-door-builds-a-person): a first name the player types, checked as the
// username is (account:username-and-unconfirmed-email): letters, a length, and never a reserved or a blocked word in any spelling.
import { blockedWords, reservedNames } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { DOOR_LISTS, NAME_LONGEST, NAME_SHORTEST, nameProblem, problemWords } from "./name";

const lists = { reserved: ["japacity", "admin", "support"], blocked: ["badword"] };

describe("the typed name", () => {
  test("[prologue:front-door-builds-a-person] given a first name of letters inside the length, then it passes, with the marks Yoruba and Igbo names carry", () => {
    expect(["Ada", "Tobi", "Chukwuemeka", "Adébáyọ̀", "Ọlá", "Ngozi"].map((name) => nameProblem(name, lists))).toEqual([null, null, null, null, null, null]);
    expect(nameProblem("  Ada  ", lists)).toBeNull();
  });

  test("[prologue:front-door-builds-a-person] given a name at each edge of the length, then the shortest and the longest pass and one past either is refused", () => {
    expect(nameProblem("A".repeat(NAME_SHORTEST), lists)).toBeNull();
    expect(nameProblem("A".repeat(NAME_SHORTEST - 1), lists)).toBe("short");
    expect(nameProblem("", lists)).toBe("short");
    expect(nameProblem("A".repeat(NAME_LONGEST), lists)).toBeNull();
    expect(nameProblem("A".repeat(NAME_LONGEST + 1), lists)).toBe("long");
  });

  test("[prologue:front-door-builds-a-person] given anything but letters, then it is refused: digits, spaces, signs and emoji", () => {
    expect(["Ada1", "Ada Obi", "Ada_", "Ada!", "@ada", "Ada😀"].map((name) => nameProblem(name, lists))).toEqual(Array.from({ length: 6 }, () => "letters"));
  });

  test("[prologue:front-door-builds-a-person] given a reserved or a blocked word in any spelling, then it is refused, as the username's are", () => {
    expect(nameProblem("Japacity", lists)).toBe("reserved");
    expect(nameProblem("AAdmin", lists)).toBe("reserved");
    expect(nameProblem("Supporter", lists)).toBe("reserved");
    expect(nameProblem("Badwordy", lists)).toBe("blocked");
    expect(nameProblem("BBadword", lists)).toBe("blocked");
  });

  test("[prologue:front-door-builds-a-person] given the door's own lists, then the reserved words the username rule names are in them, so the game's name is never a character's", () => {
    const words = ["japacity", "admin", "support", "staff", "official", "moderator"];
    expect(words.map((word) => nameProblem(word[0]!.toUpperCase() + word.slice(1), DOOR_LISTS))).toEqual(words.map(() => "reserved"));
  });

  test("[prologue:front-door-builds-a-person] given a blocked word from content's list, in capitals, with marks or with a letter said twice, when it is typed as the name, then the door refuses it", () => {
    expect(DOOR_LISTS.blocked).toBe(blockedWords);
    expect(DOOR_LISTS.reserved).toBe(reservedNames);
    expect(blockedWords).toContain("ashawo");
    expect(["Ashawo", "ASHAWO", "Àshawo", "Asshawwo", "Bigashawo"].map((name) => nameProblem(name))).toEqual(Array.from({ length: 5 }, () => "blocked"));
    expect(nameProblem("Ada")).toBeNull();
  });

  test("[prologue:front-door-builds-a-person] given each problem, then the door says it in content's words", () => {
    for (const problem of ["short", "long", "letters", "reserved", "blocked"] as const) {
      expect(problemWords(problem)).toBe(say(`prologue.door.name.${problem}`, { shortest: NAME_SHORTEST, longest: NAME_LONGEST }));
      expect(problemWords(problem)).not.toMatch(/[{}]/);
    }
  });
});
