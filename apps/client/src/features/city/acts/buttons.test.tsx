// The main button says the act's verb (world:one-action-one-sheet): the card's title names the act, and its one button says the
// verb in one or two words, from content's `<id>.button` beside the name, with the price where the act has one.
import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { richView } from "../../../shared/testing/fixtures";
import { found, renderWithView } from "../../../shared/testing/render";
import { stubWebGL, unstubWebGL } from "../../../shared/testing/webgl";
import { buttonOf } from "../../../shared/words/acts";
import { nameOf, say } from "../../../shared/words/text";
import { City } from "../City";
import { pressFanAct } from "../fan/fan.testing";

vi.mock("../scene/CityScene", async () => ({ default: (await import("../fan/fan.testing")).StandInScene }));
vi.mock("../../../shared/three/manifest", async (original) => (await import("../../../shared/testing/manifest")).fromDisk(original));

beforeEach(() => stubWebGL());
afterEach(() => {
  vi.restoreAllMocks();
  unstubWebGL();
  window.localStorage.clear();
});

/** What a main button's words must be: one or two words, sentence case, no stop at the end, never a bare "it". */
function verbProblem(words: string): string | null {
  const parts = words.split(" ");
  if (parts.length > 2) return "more than two words";
  if (words.charAt(0) !== words.charAt(0).toUpperCase()) return "not in sentence case";
  if (parts.slice(1).some((part) => part !== part.toLowerCase() && part !== "Papa")) return "not in sentence case";
  if (/[.!?]$/.test(words)) return "a stop at its end";
  if (parts.some((part) => part.toLowerCase() === "it")) return "a bare it";
  return null;
}

/** Every act a card can stand for: the acts of the month's free time and the acts outside it (the jobs open the hunt's card). */
const CARDED = Object.values(content.activity).filter((entry) => entry.slot === "free" || entry.slot === "none");

/** The sheets of the world and the phone whose title names the thing, with the words of their main button. */
const SHEET_BUTTONS: readonly { title: string; button: string }[] = [
  { title: "ui.world.pay-back", button: "ui.world.pay-back.button" },
  { title: "ui.route.pay-deposit", button: "ui.route.pay-deposit.button" },
  { title: "ui.world.go-home", button: "ui.world.go-home.button" },
  { title: "ui.world.go-home.title.assisted", button: "ui.world.go-home.button.assisted" },
  { title: "ui.wallet.convert", button: "phone.bank.change.button" },
  { title: "ui.wallet.move", button: "phone.bank.move.button" },
  { title: "phone.jobs.take.title", button: "phone.jobs.take.button" },
  { title: "offer.parcel-shipped.title", button: "offer.parcel-shipped.choice.aunty-phone" },
  { title: "phone.app.bills", button: "phone.bills.loan.button" },
  { title: "phone.app.bills", button: "phone.bills.car.button" },
  { title: "phone.app.bills", button: "phone.bills.undertaking.button" },
  { title: "phone.app.bills", button: "phone.bills.tuition.button" },
  { title: "phone.app.bills", button: "ui.obligation.return" },
];

describe("the main button says the verb", () => {
  test("[world:one-action-one-sheet] given every act a card stands for, when its button words are read, then content holds them beside the name, one or two words in sentence case with no stop and no bare it, and never the name again", () => {
    const problems = CARDED.flatMap((entry) => {
      const key = `${entry.id}.button`;
      const words = text[key];
      if (words === undefined) return [`${entry.id}: no ${key}`];
      if (words === nameOf(entry.id)) return [`${entry.id}: says its name again`];
      const problem = verbProblem(words);
      return problem === null ? [] : [`${entry.id}: "${words}" has ${problem}`];
    });
    expect(problems).toEqual([]);
    expect(buttonOf("activity.nurse-certification")).toBe("Sit exam");
  });

  test("[world:one-action-one-sheet] given a job that titles its card with its own words, when the hunt's card button is read, then it says the job's own verb, not the title", () => {
    const racks = "activity.job-fish-racks";
    expect(text[`${racks}.button`]).toBeDefined();
    expect(buttonOf("activity.job-hunt", racks)).toBe(text[`${racks}.button`]);
    expect(buttonOf("activity.job-hunt", racks)).not.toBe(text[`${racks}.act`]);
    expect(buttonOf("activity.job-hunt", "activity.job-nurse")).toBe(text["activity.job-hunt.button"]);
  });

  test("[world:one-action-one-sheet] given the sheets of the world and the phone, when their main button's words are read, then each is a verb in one or two words and none says its title again", () => {
    const problems = SHEET_BUTTONS.flatMap(({ title, button }) => {
      const words = text[button];
      if (words === undefined || text[title] === undefined) return [`${button}: no words`];
      if (words === text[title]) return [`${button}: says its title again`];
      const problem = verbProblem(words);
      return problem === null ? [] : [`${button}: "${words}" has ${problem}`];
    });
    expect(problems).toEqual([]);
    // The asking person's card is titled with their name; its button asks them out and never names them again.
    expect(say("ui.people.court")).not.toMatch(/\{name\}/);
    expect(verbProblem(say("ui.people.court"))).toBeNull();
  });

  test("[world:one-action-one-sheet] given the deposit's card at the bank, when it opens, then the title names it, the one button says the verb, never the title, and the price stands on the card", async () => {
    window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.olokun-office"]));
    const rich = richView();
    const view: PlayerView = { ...rich, pockets: { ...rich.pockets, NGN: { ...rich.pockets.NGN, bank: 9_000_000_000 } } };
    await renderWithView(<City world />, view);
    await pressFanAct("counter", "deposit");
    const card = await screen.findByRole("dialog");
    const title = within(card).getByRole("heading").textContent ?? "";
    expect(title).toBe(say("ui.route.pay-deposit"));
    const main = found("[data-ask-main]");
    expect(main.textContent?.startsWith(say("ui.route.pay-deposit.button"))).toBe(true);
    expect(main.textContent).not.toContain(title);
    // The deposit is paid in pounds from naira, so the price has its own row and the button says the naira left.
    expect(card.textContent).toMatch(/£/);
    // The button's name for a screen reader holds its visible words.
    expect(within(card).getByRole("button", { name: new RegExp(`^${say("ui.route.pay-deposit.button")}`) })).toBe(main);
    fireEvent.keyDown(document, { key: "Escape" });
  });
});
