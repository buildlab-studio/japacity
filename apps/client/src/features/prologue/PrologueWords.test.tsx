// The prologue in the situation's words: no threshold on a greyed
// answer, no figure in what an answer moved, and a page as the handover (R-PROLOGUE-014) that names the first step,
// the money as it stands, and the story's facts as chips.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "../../App";
import { createGameStore } from "../../authority/store";
import { gameAuthority, newGame } from "../../shared/testing/fixtures";
import { formatMoney } from "../../shared/words/format";
import { say, words } from "../../shared/words/text";
import { firstStep, situationLine, whyNot } from "./PrologueView";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

const PROLOGUE = "scenario.prologue";

/** The text of a story chip on the page, or "" when the page has none of that kind. */
/** The story's own chips on the page: the grid's, and where the life starts beside the cheering figure (the door's second design). */
const STORY = ["[data-handover-story]", "[data-starts-in]"];

function storyChip(id: string): string {
  return document.querySelector(STORY.map((place) => `${place} [data-fact='${id}']`).join(", "))?.textContent ?? "";
}

/** Everything the story's chips say. */
function storyText(): string {
  return [...document.querySelectorAll(STORY.join(", "))].map((place) => place.textContent).join(" ");
}

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
    // The portfolio has band words, so from nothing it is said by its band (R-TEXT-005).
    expect(words(portfolio.key, portfolio.params)).toBe(`${say("ui.band.quality.portfolio.0")}.`);
  });

  test("[R-TEXT-005] given a whole life from sixteen, when every card's outcome is read, then none says a quality's figure", async () => {
    const { outcomes } = await walk("prologue-first", (allowed) => allowed[0] ?? "");
    expect(outcomes.some((outcome) => outcome.includes(`${say("quality.edu-level.name")} now:`))).toBe(true);
    for (const outcome of outcomes) expect(outcome).not.toMatch(/ up \d+, to \d+| down \d+, to \d+|grade \d/);
  });
});

describe("the page as the handover", () => {
  test("[R-PROLOGUE-006] [R-PROLOGUE-014] given the last card answered, when the page shows, then it names the story's first step above its button, and the money is the life's as it stands", async () => {
    const { game } = await walk("prologue-first", (allowed) => allowed[0] ?? "");
    await screen.findByRole("heading", { name: words("line.prologue.closed") });
    const view = game.view();
    const step = firstStep(view);
    expect(step).toBe(say("chapter.find-your-feet.item.job.nudge"));
    expect(document.querySelector("[data-first-step]")?.textContent).toBe(`Your first step: ${step ?? ""}.`);
    const go = screen.getByRole("button", { name: say("ui.prologue.start", { month: 1 }) });
    expect(go.previousElementSibling).toBe(document.querySelector("[data-first-step]"));
    expect(document.querySelector("[data-stat='money']")?.textContent).toBe(`${formatMoney(view.pockets.NGN.bank + view.pockets.NGN.cash, "NGN")}${say("ui.page.money")}`);
  });
});

describe("the life from sixteen keeps the story its prologue built", () => {
  /** Spare parts under a master, the settlement, no way out heard at the send-off, and the family house. */
  const TRADER = ["apprentice", "spare-parts", "stay", "settle", "nowhere", "family-house"];
  const trader = (allowed: readonly string[]) => TRADER.find((id) => allowed.includes(id)) ?? allowed[0] ?? "";

  test("[R-PROLOGUE-008] given a generous settlement, when the send-off card shows what happened, then the money is named as the settlement, not as side work", async () => {
    const { outcomes } = await walk("sixteen-0", trader);
    const afterSettlement = outcomes.find((outcome) => outcome.includes(words("prologue.settlement.outcome.generous")));
    expect(afterSettlement).toBeDefined();
    expect(afterSettlement).toContain("The settlement: ₦6,000,000.");
    expect(afterSettlement).not.toContain("side work");
  });

  test("[R-TEXT-005] [R-PROLOGUE-010] [R-PROLOGUE-014] given a trader settled generously, at the family house, when the page shows, then the settlement's plot is said in words with no figure, the capital is a chip with its sum, the house and its living costs are said, and the motor park comes first", async () => {
    const { game } = await walk("sixteen-0", trader);
    await screen.findByRole("heading", { name: words("line.prologue.closed") });
    const view = game.view();
    expect(view.qualities.find((quality) => quality.id === "quality.land")?.value).toBe(1);
    const settlement = document.querySelector("[data-years] [data-fact='settlement']");
    expect(settlement?.textContent).toBe(`${say("ui.page.year.settlement")}${say("ui.page.year.settlement.generous")}`);
    expect(settlement?.textContent).toMatch(/plot/);
    expect(settlement?.textContent).not.toMatch(/\d/);
    expect(storyChip("capital")).toBe("A shop's capital₦6,000,000");
    // Decision 0035 (R-HOME-012): the family's living is bought as you go, so the page names no figure for next month.
    expect(storyChip("home")).toBe("You start in the family house, SurulereFood, water and fares as you go");
    // The Gulf is heard at the motor park, so a trade's first step is there, not at the meetup.
    expect(document.querySelector("[data-first-step]")?.textContent).toBe("Your first step: Ask around at the motor park.");
  });

  test("[R-PROLOGUE-008] [R-PROLOGUE-014] given a graduate at the family house, when the page shows, then it says where he sleeps and what it costs, and speaks of no shop's capital", async () => {
    await walk("prologue-first", (allowed) => allowed[0] ?? "");
    await screen.findByRole("heading", { name: words("line.prologue.closed") });
    // Decision 0035 (R-HOME-012): what the house costs is the living bought as you go, with no figure taken next month.
    expect(storyChip("home")).toBe("You start in the family house, SurulereFood, water and fares as you go");
    expect(storyChip("capital")).toBe("");
    expect(storyText()).toContain(say("ui.page.home.family-house"));
    expect(storyText()).not.toMatch(/capital/);
  });
});

describe("the handover says the archetype's own first step", () => {
  /** The nurse's path: science, the exam, nursing, books, focus, the service year, the UK crowd, the family house. */
  const NURSE = ["begin", "science", "jamb", "study", "again", "nursing", "federal", "wait", "back", "books", "focus", "results-nurse", "serve", "uk", "family-house"];
  const nurse = (allowed: readonly string[]) => NURSE.find((id) => allowed.includes(id)) ?? allowed[0] ?? "";

  test("[R-PROLOGUE-010] given a nurse from sixteen, when the handover shows, then her first step is the staff nurse's job at the clinic", async () => {
    const { game } = await walk("nurse-handover", nurse);
    await screen.findByRole("heading", { name: words("line.prologue.closed") });
    expect(game.view().qualities.find((quality) => quality.id === "quality.care")?.value).toBe(60);
    expect(document.querySelector("[data-first-step]")?.textContent).toBe("Your first step: Apply for the staff nurse job at the clinic.");
  });

  test("[R-PROLOGUE-010] given a shop worker from sixteen, when the handover shows, then the first step is asking around at the motor park", async () => {
    const shop = ["begin", "commercial", "work", "save", "nowhere", "family-house"];
    await walk("shop-handover", (allowed) => shop.find((id) => allowed.includes(id)) ?? allowed[0] ?? "");
    await screen.findByRole("heading", { name: words("line.prologue.closed") });
    expect(document.querySelector("[data-first-step]")?.textContent).toBe("Your first step: Ask around at the motor park.");
  });

  /** A graduate who took nothing for the grade: code on the side, freelance in the final year. */
  const LOOSE = ["begin", "science", "jamb", "study", "again", "computer-science", "federal", "wait", "back", "code", "freelance", "results", "serve", "nowhere", "family-house"];
  const loose = (allowed: readonly string[]) => LOOSE.find((id) => allowed.includes(id)) ?? allowed[0] ?? "";

  /** The first seed whose loose graduate's grade lands on `low` (true: under the master's bar), played on the engine alone. */
  function seedWhose(low: boolean): string {
    const bar = content.route["route.uk-masters"]?.checklist.flatMap((item) => (item.requirement.type === "quality/min" && item.requirement.quality === "quality.edu-grade" ? [item.requirement.value] : []))[0] ?? 0;
    for (let n = 0; n < 40; n += 1) {
      const game = newGame(PROLOGUE, `grade-${String(n)}`);
      for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
        const prologue = game.view().prologue!;
        game.accept({ type: "prologue/choose", step: prologue.step, answer: loose(prologue.answers.filter((answer) => answer.allowed).map((answer) => answer.id)) });
      }
      const grade = game.view().qualities.find((quality) => quality.id === "quality.edu-grade")?.value ?? 0;
      if (grade < bar === low) return `grade-${String(n)}`;
    }
    throw new Error("No seed in 40 lands there.");
  }

  test("[R-PROLOGUE-010] [R-PROLOGUE-014] given a graduate whose grade is under second class lower, when the page shows, then a setback chip says the master's and the bank are shut", async () => {
    await walk(seedWhose(true), loose);
    await screen.findByRole("heading", { name: words("line.prologue.closed") });
    expect(storyChip("grade")).toBe("GradeMaster's and bank shut");
    expect(document.querySelector("[data-handover-story] [data-fact='grade']")?.getAttribute("data-state")).toBe("setback");
  });

  test("[R-PROLOGUE-010] [R-PROLOGUE-014] given a graduate at the bar, when the page shows, then no chip speaks of the grade", async () => {
    await walk(seedWhose(false), loose);
    await screen.findByRole("heading", { name: words("line.prologue.closed") });
    expect(storyChip("grade")).toBe("");
    expect(storyText()).toContain(say("ui.page.home.family-house"));
    expect(storyText()).not.toMatch(/grade/i);
  });
});
