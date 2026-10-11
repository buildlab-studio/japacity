// The Lotto app offline (docs/rules/world.md R-WORLD-018): the street kiosk
// runs its own draw, so the app says where the tickets are sold, by the street's name, this month's tickets, and the
// last draw's result from the month's results when that month had a ticket. Never a bare one-line screen.
import { content } from "@japacity/content";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { nameOf, words } from "../../../shared/words/text";
import { phoneWords } from "../phone.words";
import { kioskDrawLine, kioskStreet, Lotto } from "./Lotto";

describe("the Lotto app offline", () => {
  test("[R-WORLD-018] given a life offline with no ticket yet, when the Lotto app opens, then it names the kiosk's street, Bode Thomas Street, and says no ticket this month, more than one bare line", async () => {
    const game = newGame("scenario.ada");
    expect(game.view().lottery).toBeNull();
    expect(content.place["place.bode-thomas"]?.stages).toContain("activity.play-lotto");
    expect(kioskStreet()).toBe(nameOf("place.bode-thomas"));
    expect(kioskStreet()).toBe("Bode Thomas Street");
    await renderWithView(<Lotto />, game.view());
    const app = document.querySelector("[data-lotto-kiosk]");
    expect(app?.querySelector("[data-lotto-street]")?.textContent).toBe(phoneWords("phone.lotto.kiosk", { street: "Bode Thomas Street" }));
    expect(app?.querySelector("[data-lotto-none]")?.textContent).toBe(phoneWords("phone.lotto.none-month"));
    expect(app?.querySelectorAll("p").length).toBeGreaterThanOrEqual(2);
    expect(app?.textContent).not.toMatch(/phone\.|ui\.|line\./);
  });

  test("[R-WORLD-018] [R-LUCK-005] given a ticket bought at the kiosk this month, when the Lotto app opens, then it says the month's ticket and no longer says none", async () => {
    const game = newGame("scenario.ada");
    const lines = game.accept({ type: "activity/now", activity: "activity.play-lotto", param: "1" }).lines;
    const { store } = await renderWithView(<Lotto />, game.view());
    act(() => store.setState({ monthLines: lines }));
    expect(document.querySelector("[data-lotto-month]")?.textContent).toContain(phoneWords("phone.lotto.month.one"));
    expect(document.querySelector("[data-lotto-none]")).toBeNull();
    expect(document.querySelector("[data-lotto-street]")).not.toBeNull();
  });

  test("[R-WORLD-018] given last month's results with the kiosk's draw in them, when the Lotto app opens, then it shows the last draw's result in the results' own words", async () => {
    const game = newGame("scenario.ada");
    game.accept({ type: "activity/now", activity: "activity.play-lotto", param: "1" });
    game.endTurn();
    const view = game.view();
    const line = kioskDrawLine(view.report?.lines ?? []);
    if (line === null) throw new Error("The month's results hold no draw.");
    await renderWithView(<Lotto />, view);
    const last = document.querySelector("[data-last-draw-line]");
    expect(last?.textContent).toContain(words(line.key, line.params));
    expect(last?.textContent).not.toMatch(/line\.|\{/);
    // A month with no ticket has no draw to tell.
    document.body.innerHTML = "";
    game.endTurn();
    expect(kioskDrawLine(game.view().report?.lines ?? [])).toBeNull();
    await renderWithView(<Lotto />, game.view());
    expect(document.querySelector("[data-last-draw-line]")).toBeNull();
    expect(document.querySelector("[data-lotto-street]")).not.toBeNull();
  });
});
