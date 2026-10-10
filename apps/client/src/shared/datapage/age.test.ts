// The age on the door (prologue.md R-PROLOGUE-004, R-PROLOGUE-009; decision 0023) on the real content: never typed,
// from the year a tile's path reaches with no setback to a few years older inside 18 to 29; the year picked is sent on
// the path's age card and is the year the life starts at, older with the years worked, their saving and from two years
// the passport.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { AGE_CARDS, answersInOrder, ARCHETYPES, type Archetype, lowestYear, presetAnswer, withAge } from "../frontdoor/archetypes";
import { newGame } from "../testing/fixtures";
import { formatMoney } from "../words/format";
import { say } from "../words/text";
import { ageStepWords, OLDEST, startYearFor, stepsOpen, STEPS_OLDER, WORK_CARD, yearsWorked, YOUNGEST, youngLimitYears } from "./age";

const PROLOGUE = "scenario.prologue";
const AGE = "quality.age-months";
const PASSPORT = "document.passport";

/** Plays the tile's preset stepped `older` years, the open cards as the tile leans; the answer sent at its age card, and the game. */
function play(archetype: Archetype, older: number, seed: string) {
  const game = newGame(PROLOGUE, seed);
  let sent: string | null = null;
  const tile = withAge(archetype, older);
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = presetAnswer(tile, prologue) ?? answersInOrder(tile, prologue.step, prologue.answers).find((one) => one.allowed)?.id;
    if (answer === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    if (AGE_CARDS.includes(prologue.step)) sent = answer;
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  if (sent === null) throw new Error("No age card came.");
  return { game, sent };
}

const naira = (game: ReturnType<typeof newGame>): number => game.view().pockets.NGN.bank + game.view().pockets.NGN.cash;

describe("the age cards", () => {
  test("[R-PROLOGUE-004] given the real content, then each path after school has an age card of the years 18 to 29, and the send-off leads to the years worked, never a card, then home", () => {
    expect([...AGE_CARDS].sort()).toEqual(["age-degree", "age-shop", "age-trade"]);
    for (const card of AGE_CARDS) {
      expect(content.prologue[card]?.months).toBe(0);
      expect(content.prologue[card]?.answers.map((answer) => answer.id)).toEqual(Array.from({ length: 12 }, (_, at) => `start-${String(18 + at)}`));
    }
    expect(content.prologue["after-school"]?.answers.map((answer) => answer.next)).toEqual(["age-degree", "age-trade", "age-shop"]);
    expect(content.prologue["friend"]?.next).toBe(WORK_CARD);
    expect(content.prologue[WORK_CARD]?.next).toBe("home");
    expect(YOUNGEST).toBe(18);
    expect(OLDEST).toBe(29);
  });

  test("[R-PROLOGUE-004] [R-PROLOGUE-009] given each tile, then its own year is the year its path reaches with no setback, and the door steps it up to three years older, never past 29", () => {
    expect(Object.fromEntries(ARCHETYPES.map((archetype) => [archetype.id, lowestYear(archetype)]))).toEqual({ developer: 23, nurse: 23, accountant: 23, writer: 23, trader: 23, "shop-worker": 21, water: 21 });
    for (const archetype of ARCHETYPES) {
      expect(stepsOpen(archetype)).toEqual(Array.from({ length: STEPS_OLDER + 1 }, (_, at) => at));
      expect(startYearFor(archetype, STEPS_OLDER)).toBeLessThanOrEqual(OLDEST);
    }
  });

  test("[R-PROLOGUE-004] [R-PROLOGUE-009] given every tile and every step the door offers, when its run is played over seeds, then the life starts in the year picked, with each year worked saved and from two years the passport", () => {
    const wrong: string[] = [];
    let compared = 0;
    for (const archetype of ARCHETYPES) {
      for (let at = 0; at < 6; at += 1) {
        const seed = `age-${archetype.id}-${String(at)}`;
        const own = play(archetype, 0, seed);
        if (Math.floor((own.game.state.quality[AGE] ?? 0) / 12) !== lowestYear(archetype)) wrong.push(`${seed}: not at its own year`);
        for (const older of stepsOpen(archetype)) {
          const { game, sent } = play(archetype, older, seed);
          const year = startYearFor(archetype, older);
          const age = game.state.quality[AGE] ?? 0;
          if (game.state.prologue.open) wrong.push(`${seed} +${String(older)}: still open`);
          if (sent !== `start-${String(year)}`) wrong.push(`${seed} +${String(older)}: sent ${sent}`);
          if (Math.floor(age / 12) !== year) wrong.push(`${seed} +${String(older)}: ${String(age)} months, picked ${String(year)}`);
          // At its own year no setback is drawn, so a life stepped older whose years went the same way differs only by
          // the years worked: their saving, and from two years the passport.
          const plain = (one: ReturnType<typeof newGame>) => JSON.stringify(one.state.prologue.choices).replace(/start-\d+/g, "");
          if (plain(game) !== plain(own.game)) continue;
          compared += 1;
          if (naira(game) - naira(own.game) !== yearsWorked(older).saved) wrong.push(`${seed} +${String(older)}: saved ${String(naira(game) - naira(own.game))}`);
          const passport = game.view().documents.some((paper) => paper.id === PASSPORT && paper.state === "held");
          if (passport !== yearsWorked(older).passport) wrong.push(`${seed} +${String(older)}: passport ${String(passport)}`);
        }
      }
    }
    expect(wrong).toEqual([]);
    expect(compared).toBeGreaterThan(ARCHETYPES.length * 6 * 2);
    expect(yearsWorked(0)).toEqual({ saved: 0, passport: false });
    expect(yearsWorked(1)).toEqual({ saved: 12000000, passport: false });
    expect(yearsWorked(2)).toEqual({ saved: 24000000, passport: true });
    expect(yearsWorked(3)).toEqual({ saved: 36000000, passport: true });
  });

  test("[R-PROLOGUE-009] given a year the card has shut, when the run reaches it, then the nearest open year above is sent, else the nearest below", () => {
    const developer = ARCHETYPES[0]!;
    expect(withAge(developer, 2).preset["age-degree"]?.slice(0, 3)).toEqual(["start-25", "start-26", "start-27"]);
    expect(withAge(developer, 2).preset["age-degree"]?.at(-1)).toBe("start-18");
    expect(withAge(developer, 0).preset["age-degree"]?.[0]).toBe("start-23");
    // A tile with no step sends the youngest year open: the year its path reaches.
    expect(developer.preset["age-degree"]?.[0]).toBe("start-18");
  });

  test("[R-PROLOGUE-009] given an age step, then the page says what it does in content's words: the years worked, their saving and the passport, or at the tile's own year the years before Canada's age points fall", () => {
    const limit = youngLimitYears();
    expect(limit).toBe(30);
    expect(ageStepWords(2, 23)).toBe(say("prologue.age.older.passport", { amount: formatMoney(yearsWorked(2).saved, "NGN") }));
    expect(ageStepWords(1, 23)).toBe(say("prologue.age.older", { amount: formatMoney(yearsWorked(1).saved, "NGN") }));
    // From the year printed: 23 is 7 whole years before 30.
    expect(ageStepWords(0, 23)).toBe(say("prologue.age.as-is", { count: limit - 23 }));
    expect(ageStepWords(0, 21)).toBe(say("prologue.age.as-is", { count: limit - 21 }));
    expect(ageStepWords(1, 23)).toContain("₦120,000");
    expect(ageStepWords(2, 23)).toContain("passport");
  });
});
