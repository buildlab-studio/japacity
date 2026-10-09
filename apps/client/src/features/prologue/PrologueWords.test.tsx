// The prologue in the situation's words: no threshold on a greyed
// answer, no figure in what an answer moved, and a handover that names the first step and the real band.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "../../App";
import { createGameStore } from "../../authority/store";
import { gameAuthority, newGame } from "../../shared/testing/fixtures";
import { valueWords } from "../../shared/words/quality";
import { say, words } from "../../shared/words/text";
import { firstStep, situationLine, whyNot } from "./PrologueView";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";
import { onTheClassicPage } from "../../shared/testing/classic";

const PROLOGUE = "scenario.prologue";
const WELLBEING = "quality.wellbeing";

onTheClassicPage();

function card(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-prologue-card]");
  if (found === null) throw new Error("No prologue card on screen.");
  return found;
}

/** Plays a life from sixteen through the screen, pressing `pick`'s answer, and keeps what each card showed for its greyed answers. */
async function walk(seed: string, pick: (allowed: readonly string[], step: string) => string) {
  const game = newGame(PROLOGUE, seed);
  const store = createGameStore(gameAuthority(game));
  await store.getState().refresh();
  render(<App store={store} />);
  const greyed = new Map<string, string>();
  const outcomes: string[] = [];
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    await screen.findByRole("heading", { name: words(`prologue.${prologue.step}.card`) });
    outcomes.push(document.querySelector("[data-prologue-outcome]")?.textContent ?? "");
    for (const answer of prologue.answers.filter((candidate) => !candidate.allowed)) greyed.set(`${prologue.step}.${answer.id}`, card().querySelector(`[data-answer='${answer.id}']`)?.textContent ?? "");
    const chosen = pick(prologue.answers.filter((answer) => answer.allowed).map((answer) => answer.id), prologue.step);
    const v = game.state.v;
    fireEvent.click(within(card()).getByRole("button", { name: words(`prologue.${prologue.step}.answer.${chosen}`) }));
    await waitFor(() => expect(store.getState().view?.v).toBeGreaterThan(v));
  }
  return { game, greyed, outcomes };
}

function line(key: string, params: ReportLine["params"]): ReportLine {
  return { key, params, tone: "good", attention: false, counts: [] };
}

describe("a greyed answer", () => {
  test("[R-PROLOGUE-008] given every answer in content that can be shut, when its reason is read, then it says the situation in words and names no threshold", () => {
    const shut = Object.values(content.prologue).flatMap((step) => step.answers.filter((answer) => answer.requires.length > 0).map((answer) => ({ step: step.id, answer: answer.id })));
    expect(shut.length).toBeGreaterThan(5);
    for (const { step, answer } of shut) {
      const [reason, ...more] = whyNot(step, answer);
      expect(more, `${step}.${answer}`).toEqual([]);
      expect(reason, `${step}.${answer}`).toMatch(/^[a-z].*\.$/);
      expect(reason, `${step}.${answer}`).not.toMatch(/ or (less|more)|One of|Family means|Tech skill|Network|\{/);
    }
  });

  test("[R-PROLOGUE-008] given a city child of a family that gets by, when WAEC is written, then the trade under a master is greyed with \"Not for you: your family would not have it.\"", async () => {
    const { greyed } = await walk("prologue-first", (allowed) => allowed[0] ?? "");
    const shown = greyed.get("after-school.apprentice");
    expect(shown).toBeDefined();
    expect(shown).toContain(`${say("prologue.not-for-you")} ${whyNot("after-school", "apprentice")[0] ?? ""}`);
    expect(shown).toContain("Not for you: your family would not have it.");
    expect(shown).not.toMatch(/39|13|Family means/);
  });
});

describe("what an answer moved", () => {
  test("[R-PROLOGUE-008] given schooling moved up a level, when the line is told, then it says the level, never \"up 1, to 1\"", () => {
    const told = situationLine(line("line.quality.gain", { quality: "quality.edu-level", points: 1, value: 1 }));
    expect(told).not.toBeNull();
    expect(words(told!.key, told!.params)).toBe(`${say("quality.edu-level.name")} now: ${say("quality.edu-level.value.1")}.`);
    expect(words(told!.key, told!.params)).not.toMatch(/\d/);
  });

  test("[R-PROLOGUE-008] given the degree graded, when the lines are told, then the grade is said by its name once, and land is said without a figure", () => {
    const graded = line("line.prologue.graded", { grade: 3 });
    const gain = line("line.quality.gain", { quality: "quality.edu-grade", points: 3, value: 3 });
    expect(situationLine(gain, [gain, graded])).toBeNull();
    const told = situationLine(graded, [gain, graded])!;
    expect(words(told.key, told.params)).toBe(`Your degree comes out: ${say("quality.edu-grade.value.3")}.`);
    const land = situationLine(line("line.quality.gain", { quality: "quality.land", points: 1, value: 1 }))!;
    expect(words(land.key, land.params)).not.toMatch(/\d/);
    const portfolio = situationLine(line("line.quality.gain", { quality: "quality.portfolio", points: 1, value: 1 }))!;
    // The portfolio has band words now, so from nothing it is said by its band (R-TEXT-005).
    expect(words(portfolio.key, portfolio.params)).toBe(`${say("ui.band.quality.portfolio.0")}.`);
  });

  test("[R-TEXT-005] given a whole life from sixteen, when every card's outcome is read, then none says a quality's figure", async () => {
    const { outcomes } = await walk("prologue-first", (allowed) => allowed[0] ?? "");
    expect(outcomes.some((outcome) => outcome.includes(`${say("quality.edu-level.name")} now:`))).toBe(true);
    for (const outcome of outcomes) expect(outcome).not.toMatch(/ up \d+, to \d+| down \d+, to \d+|grade \d/);
  });
});

describe("the handover", () => {
  test("[R-PROLOGUE-006] given the last card answered, when the handover shows, then it names the story's first step above its button, and the wellbeing is the band of the life as it stands", async () => {
    const { game } = await walk("prologue-first", (allowed) => allowed[0] ?? "");
    await screen.findByRole("heading", { name: words("line.prologue.closed") });
    const view = game.view();
    const step = firstStep(view);
    expect(step).toBe(say("chapter.find-your-feet.item.job.nudge"));
    expect(document.querySelector("[data-first-step]")?.textContent).toBe(`Your first step: ${step ?? ""}.`);
    const go = screen.getByRole("button", { name: say("ui.prologue.start", { month: 1 }) });
    expect(go.previousElementSibling).toBe(document.querySelector("[data-first-step]"));
    const wellbeing = view.qualities.find((quality) => quality.id === WELLBEING)?.value ?? -1;
    expect(document.querySelector("[data-life-so-far]")?.textContent).toContain(valueWords(WELLBEING, wellbeing));
  });
});

describe("the life from sixteen keeps the story its prologue built", () => {
  /** Spare parts under a master, the settlement, no way out heard at the send-off, and a room of his own. */
  const TRADER = ["apprentice", "spare-parts", "stay", "settle", "nowhere", "room"];
  const trader = (allowed: readonly string[]) => TRADER.find((id) => allowed.includes(id)) ?? allowed[0] ?? "";

  test("[R-PROLOGUE-008] given a generous settlement, when the send-off card shows what happened, then the money is named as the settlement, not as side work", async () => {
    const { outcomes } = await walk("sixteen-0", trader);
    const afterSettlement = outcomes.find((outcome) => outcome.includes(words("prologue.settlement.outcome.generous")));
    expect(afterSettlement).toBeDefined();
    expect(afterSettlement).toContain("The settlement: ₦6,000,000.");
    expect(afterSettlement).not.toContain("side work");
  });

  test("[R-TEXT-005] given a trader settled generously, in a room of his own, when the handover shows, then land is said in words, the capital is named with what it can do now, the room and its living costs are said, and the meetup comes first", async () => {
    const { game } = await walk("sixteen-0", trader);
    await screen.findByRole("heading", { name: words("line.prologue.closed") });
    const view = game.view();
    expect(view.qualities.find((quality) => quality.id === "quality.land")?.value).toBe(1);
    const held = [...document.querySelectorAll("[data-life-so-far] dd")].map((value) => value.textContent);
    expect(held).toContain(say("ui.band.quality.land.1"));
    expect(held.filter((value) => /\d/.test(value))).toEqual([]);
    const story = document.querySelector("[data-handover-story]")?.textContent ?? "";
    expect(story).toContain("₦6,000,000 in hand, the shop's capital. It is the move's money now, if you want it to be.");
    expect(story).toContain("You sleep in a room of your own. Living costs: ₦180,000 a month.");
    expect(document.querySelector("[data-first-step]")?.textContent).toBe("Your first step: Go to the meetup in Yaba and hear of a way out.");
  });

  test("[R-PROLOGUE-008] given a graduate at the family house, when the handover shows, then it says where he sleeps and what it costs, and speaks of no shop's capital", async () => {
    await walk("prologue-first", (allowed) => allowed[0] ?? "");
    await screen.findByRole("heading", { name: words("line.prologue.closed") });
    const story = document.querySelector("[data-handover-story]")?.textContent ?? "";
    expect(story).toContain("You sleep in the family house. Living costs: ₦95,000 a month.");
    expect(story).not.toMatch(/capital/);
  });
});
