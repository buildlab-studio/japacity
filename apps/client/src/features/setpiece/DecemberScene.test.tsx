import { content, text } from "@japacity/content";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { decemberGame, setPockets, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say, words } from "../../shared/words/text";
import { answerPrice, DECEMBER, sceneOrder } from "./DecemberScene";
import { SetpieceView } from "./SetpieceView";

function answerItem(scene: HTMLElement, answer: string): HTMLElement {
  const item = scene.querySelector(`[data-answer='${answer}']`);
  if (item === null) throw new Error(`No answer ${answer} on screen.`);
  return item as HTMLElement;
}

describe("the December visit", () => {
  test("[R-RETURN-005] [R-SETPIECE-005] given December abroad, then the visit takes the whole screen with one question, the free answer first and each price in pounds", async () => {
    const view = decemberGame().view();
    const question = view.setpiece!.question!;
    expect(view.setpiece!.entry).toBe(DECEMBER);
    await renderWithView(<SetpieceView />, view);
    const scene = await screen.findByRole("dialog", { name: words(`${DECEMBER}.q.${question.id}`) });
    expect(within(scene).getByText(nameOf(DECEMBER))).toBeDefined();
    expect(scene.querySelector(`[data-scene='${DECEMBER}']`)).not.toBeNull();
    expect(within(scene).getByRole("heading", { name: words(`${DECEMBER}.q.${question.id}`) })).toBeDefined();
    const shown = [...scene.querySelectorAll("[data-answer]")].map((item) => item.getAttribute("data-answer"));
    expect(shown).toEqual(sceneOrder(question.id, question.answers));
    expect(answerPrice(question.id, shown[0]!)).toEqual([]);
    expect(within(answerItem(scene, shown[0]!)).getByText(say("ui.december.free"))).toBeDefined();
    for (const answer of shown.slice(1)) {
      const price = answerPrice(question.id, answer!);
      expect(price.map((money) => money.currency)).toEqual(["GBP"]);
      expect(within(answerItem(scene, answer!)).getByText(formatMoney(price[0]!.amount, "GBP"))).toBeDefined();
    }
  });

  test("[R-SETPIECE-003] given no pounds for the flight, then going is greyed but still shown, with the rejection's words and what it needs", async () => {
    const game = decemberGame();
    setPockets(game, { GBP: 0 });
    const view = game.view();
    const question = view.setpiece!.question!;
    expect(question.id).toBe("go-uk");
    expect(question.allowed).toEqual(["stay"]);
    await renderWithView(<SetpieceView />, view);
    const scene = await screen.findByRole("dialog");
    const go = answerItem(scene, "go");
    expect(go.getAttribute("data-allowed")).toBe("false");
    expect(within(go).getByRole("button").hasAttribute("disabled")).toBe(true);
    const fare = answerPrice("go-uk", "go")[0]!;
    expect(within(go).getByText(`${text["reject.not-legal"]!} ${say("ui.december.short", { need: formatMoney(fare.amount, "GBP"), have: formatMoney(0, "GBP") })}`)).toBeDefined();
    expect(within(answerItem(scene, "stay")).getByRole("button").hasAttribute("disabled")).toBe(false);
  });

  test("[R-RETURN-005] given pounds enough, when the flight is booked, then setpiece/answer names the question and the answer", async () => {
    const game = decemberGame();
    const fare = answerPrice("go-uk", "go")[0]!;
    const view = viewAfter(game, [{ type: "money/add", currency: "GBP", pocket: "bank", amount: fare.amount, reason: "gift" }]);
    expect(view.setpiece!.question!.allowed).toContain("go");
    const { authority } = await renderWithView(<SetpieceView />, view);
    const scene = await screen.findByRole("dialog");
    fireEvent.click(within(answerItem(scene, "go")).getByRole("button"));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "setpiece/answer", question: "go-uk", answer: "go", basedOn: view.v }]));
  });

  test("[R-SETPIECE-002] given the report still open, then the scene waits; set aside, a tile in the plan opens it again", async () => {
    const { store } = await renderWithView(<SetpieceView />, decemberGame().view());
    await screen.findByRole("dialog");
    store.getState().setReportOpen(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    store.getState().setReportOpen(false);
    const scene = await screen.findByRole("dialog");
    fireEvent.click(within(scene).getByRole("button", { name: say("ui.december.set-aside") }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.querySelector("[data-december-tile]")?.textContent).toContain(say("ui.setpiece.blocks"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.december.open") }));
    expect(await screen.findByRole("dialog")).toBeDefined();
  });

  test("[R-RETURN-005] given every country's visit in content, then each question's free answer is shown first", () => {
    for (const question of content.setpiece[DECEMBER]!.questions) {
      const order = sceneOrder(question.id, question.answers.map((answer) => answer.id));
      expect(answerPrice(question.id, order[0]!)).toEqual([]);
    }
  });
});
