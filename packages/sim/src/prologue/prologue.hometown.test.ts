// Where the life is from (prologue.md R-PROLOGUE-002): read from the
// family drawn, never drawn on its own, and kept in the view after the prologue closes.
import { content, hometownRegion, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { divFloor } from "../engine/int";
import type { Id, PrologueSlice } from "../engine/types";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { familyHometown, hometownOf } from "./prologue.logic";
import { PROLOGUE } from "../testing/ids";

const numbers = content.tuning.prologue;
type Draw = NonNullable<PrologueSlice["draw"]>;

function newGame(seed: string): Game {
  return start({ scenario: PROLOGUE, seed, content });
}

/** Plays the prologue to its close with the first answer allowed, or `home` at the step of that name where it is allowed. */
function playOut(game: Game, home: string | null = null): void {
  for (let index = 0; game.state.prologue.open; index += 1) {
    if (index > 40) throw new Error("The prologue did not close in 40 answers.");
    const step = game.state.prologue.step ?? "";
    const answers = (game.view().prologue?.answers ?? []).filter((answer) => answer.allowed);
    const wanted = step === "home" && home !== null ? answers.find((answer) => answer.id === home) : undefined;
    const answer = wanted ?? answers[0];
    if (answer === undefined) throw new Error(`No answer is allowed at ${step}.`);
    game.accept({ type: "prologue/choose", step, answer: answer.id });
  }
}

/** Every family the draw can make, with how likely each is in parts of a whole: means, siblings, then the parents' schooling. */
function everyFamily(): { draw: Draw; weight: number }[] {
  const found: { draw: Draw; weight: number }[] = [];
  for (let means = numbers.familyMeans[0]; means <= numbers.familyMeans[1]; means += 1) {
    const educatedBp = numbers.parentsEducatedBp + numbers.parentsEducatedPerPoint * means;
    for (let siblings = numbers.siblings[0]; siblings <= numbers.siblings[1]; siblings += 1) {
      for (const town of ["city", "town"] as const) {
        found.push({ draw: { familyMeans: means, town, siblings, parentsEducated: true }, weight: educatedBp });
        found.push({ draw: { familyMeans: means, town, siblings, parentsEducated: false }, weight: 10000 - educatedBp });
      }
    }
  }
  return found;
}

describe("where the life is from", () => {
  test("[R-PROLOGUE-002] given a new prologue, when nothing is drawn yet, then the view names no hometown; once the family is drawn it names one from the draw's own list, reading it moves no stream, and it stays in the view after the prologue closes", () => {
    for (let run = 0; run < 40; run += 1) {
      const game = newGame(`hometown-${String(run)}`);
      expect(game.view().hometown).toBeNull();
      game.accept({ type: "prologue/choose", step: "draw", answer: "begin" });
      const draw = game.state.prologue.draw!;
      const drawn = game.state.draws.prologue;
      const hometown = game.view().hometown;
      expect(draw.town === "city" ? numbers.hometowns.city : numbers.hometowns.town).toContain(hometown);
      // Read twice, the same; and nothing new was drawn to read it.
      expect(game.view().hometown).toBe(hometown);
      expect(game.state.draws.prologue).toBe(drawn);
      playOut(game, "family-house");
      expect(game.view().prologue).toBeNull();
      expect(game.view().hometown).toBe(hometown);
    }
  });

  test("[R-PROLOGUE-002] given every family the draw can make, when its hometown is read, then a family drawn in the city is from a city and one in a town from a town, every hometown is someone's, and none is more than a fifth above its fair share", () => {
    const families = everyFamily();
    for (const side of ["city", "town"] as const) {
      const list = numbers.hometowns[side];
      const share: Record<string, number> = Object.fromEntries(list.map((hometown) => [hometown, 0]));
      let whole = 0;
      for (const { draw, weight } of families.filter((family) => family.draw.town === side)) {
        const hometown = familyHometown(draw, numbers);
        expect(list).toContain(hometown);
        share[hometown!] = (share[hometown!] ?? 0) + weight;
        whole += weight;
      }
      const fair = divFloor(whole, list.length);
      expect(Object.values(share).filter((weight) => weight === 0)).toEqual([]);
      expect(Object.entries(share).filter(([, weight]) => weight * 5 > fair * 6)).toEqual([]);
    }
  });

  test("[R-PROLOGUE-002] given the same family drawn twice, as a sibling's life holds its inviter's draw (R-PEOPLE-011), when the hometown is read, then it is the same place", () => {
    for (const { draw } of everyFamily().slice(0, 200)) expect(familyHometown({ ...draw }, numbers)).toBe(familyHometown(draw, numbers));
  });

  test("[R-PROLOGUE-002] [R-PROLOGUE-012] given the child of the water, whose home answer is Makoko, when the prologue closes, then the life is from Lagos, whatever the family drawn", () => {
    expect(numbers.hometowns.byHome["makoko"]).toBe("hometown.lagos");
    const game = newGame("hometown-water");
    playOut(game, "makoko");
    expect(game.state.prologue.choices["home"]).toBe("makoko");
    expect(game.view().hometown).toBe("hometown.lagos");
  });

  test("[R-PROLOGUE-002] given every fixed life, when it starts, then it is from its own hometown, named in content, and never Lagos", () => {
    const fixed = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => id !== PROLOGUE);
    expect(fixed.length).toBeGreaterThan(0);
    for (const life of fixed) {
      const game = start({ scenario: life, content });
      const own = content.scenario[life]?.hometown;
      expect(own).toMatch(/^hometown\.[a-z-]+$/);
      expect(own).not.toBe("hometown.lagos");
      expect(game.view().hometown).toBe(own);
      expect(hometownOf(game.state, content)).toBe(own);
    }
  });

  test("[R-PROLOGUE-002] given every hometown in content, when its words are looked up, then it has a name, none repeats, Lagos is in neither list, and both lists reach the north and the south", () => {
    const all = [...numbers.hometowns.city, ...numbers.hometowns.town, ...Object.values(numbers.hometowns.byHome)];
    expect(all.filter((hometown) => (text[`${hometown}.name`] ?? "").trim() === "")).toEqual([]);
    const listed = [...numbers.hometowns.city, ...numbers.hometowns.town];
    expect(listed.filter((hometown, index) => listed.indexOf(hometown) !== index)).toEqual([]);
    expect(listed).not.toContain("hometown.lagos");
    expect(numbers.hometowns.city.length).toBeGreaterThanOrEqual(20);
    expect(numbers.hometowns.town.length).toBeGreaterThanOrEqual(12);
    for (const list of [numbers.hometowns.city, numbers.hometowns.town]) {
      const north = list.filter((hometown) => hometownRegion[hometown] === "north").length;
      const south = list.filter((hometown) => hometownRegion[hometown] === "south").length;
      expect(north + south).toBe(list.length);
      // Neither half of the country is more than a few towns ahead of the other.
      expect(Math.abs(north - south)).toBeLessThanOrEqual(2);
    }
  });
});
