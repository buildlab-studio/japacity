// The typed name (prologue.md R-PROLOGUE-009; the review): a first name the player types, checked as the
// username is (account.md R-ACCOUNT-024): letters, a length, and never a reserved or a blocked word in any spelling.
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { DOOR_LISTS, NAME_LONGEST, NAME_SHORTEST, nameProblem, problemWords } from "./name";

const lists = { reserved: ["japacity", "admin", "support"], blocked: ["badword"] };

describe("the typed name", () => {
  test("[R-PROLOGUE-009] given a first name of letters inside the length, then it passes, with the marks Yoruba and Igbo names carry", () => {
    expect(["Ada", "Tobi", "Chukwuemeka", "Adébáyọ̀", "Ọlá", "Ngozi"].map((name) => nameProblem(name, lists))).toEqual([null, null, null, null, null, null]);
    expect(nameProblem("  Ada  ", lists)).toBeNull();
  });

  test("[R-PROLOGUE-009] given a name at each edge of the length, then the shortest and the longest pass and one past either is refused", () => {
    expect(nameProblem("A".repeat(NAME_SHORTEST), lists)).toBeNull();
    expect(nameProblem("A".repeat(NAME_SHORTEST - 1), lists)).toBe("short");
    expect(nameProblem("", lists)).toBe("short");
    expect(nameProblem("A".repeat(NAME_LONGEST), lists)).toBeNull();
    expect(nameProblem("A".repeat(NAME_LONGEST + 1), lists)).toBe("long");
  });

  test("[R-PROLOGUE-009] given anything but letters, then it is refused: digits, spaces, signs and emoji", () => {
    expect(["Ada1", "Ada Obi", "Ada_", "Ada!", "@ada", "Ada😀"].map((name) => nameProblem(name, lists))).toEqual(Array.from({ length: 6 }, () => "letters"));
  });

  test("[R-PROLOGUE-009] given a reserved or a blocked word in any spelling, then it is refused, as the username's are", () => {
    expect(nameProblem("Japacity", lists)).toBe("reserved");
    expect(nameProblem("AAdmin", lists)).toBe("reserved");
    expect(nameProblem("Supporter", lists)).toBe("reserved");
    expect(nameProblem("Badwordy", lists)).toBe("blocked");
    expect(nameProblem("BBadword", lists)).toBe("blocked");
  });

  test("[R-PROLOGUE-009] given the door's own lists, then the reserved words the username rule names are in them, so the game's name is never a character's", () => {
    const words = ["japacity", "admin", "support", "staff", "official", "moderator"];
    expect(words.map((word) => nameProblem(word[0]!.toUpperCase() + word.slice(1), DOOR_LISTS))).toEqual(words.map(() => "reserved"));
  });

  test("[R-PROLOGUE-009] given each problem, then the door says it in content's words", () => {
    for (const problem of ["short", "long", "letters", "reserved", "blocked"] as const) {
      expect(problemWords(problem)).toBe(say(`prologue.door.name.${problem}`, { shortest: NAME_SHORTEST, longest: NAME_LONGEST }));
      expect(problemWords(problem)).not.toMatch(/[{}]/);
    }
  });
});
