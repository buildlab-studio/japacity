// The way home from an overstay on the bag's Go home (place:view-carries-way-home, place:leaving-an-overstay-bans,
// place:returns-service-takes-you-home, return:standing-by-return-shape, world:costly-acts-confirmed): the card says the ban the way would bring in
// words, read from the engine's forecast; where the status has the returns service, a second, quiet button with its own
// line (the ticket paid, the money to start again at home, the longer ban) asks once more before it sends the return.
import type { Currency, PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AskSheet } from "../../../shared/world/AskSheet";
import { graceView, overstayingGame } from "../../../shared/testing/overstay";
import { abroadGame } from "../../../shared/testing/fixtures";
import { renderWithGame } from "../../../shared/testing/person";
import { renderWithView } from "../../../shared/testing/render";
import { stubWebGL, unstubWebGL } from "../../../shared/testing/webgl";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { City } from "../City";
import { pressFanAct } from "../fan/fan.testing";
import { goHomeAsk } from "./goHome";

vi.mock("../scene/CityScene", async () => ({ default: (await import("../fan/fan.testing")).StandInScene }));
vi.mock("../../../shared/three/manifest", async (original) => (await import("../../../shared/testing/manifest")).fromDisk(original));

beforeEach(() => {
  stubWebGL();
  window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.the-room"]));
});

afterEach(() => {
  vi.restoreAllMocks();
  unstubWebGL();
  window.localStorage.clear();
});

const hands = { who: "The shared room", go: () => undefined, scheme: () => undefined, dismiss: () => undefined };

/** The way home the engine forecasts for this view, which must have one. */
function wayOf(view: PlayerView): NonNullable<PlayerView["place"]["wayHome"]> {
  const way = view.place.wayHome;
  if (way === null) throw new Error("No way home in this view.");
  return way;
}

describe("the way home from an overstay", () => {
  test("[place:leaving-an-overstay-bans] [return:standing-by-return-shape] given the grace, when the card is drawn, then it says there is no ban, since the life leaves in time", () => {
    const view = graceView();
    expect(wayOf(view).banMonths).toBe(0);
    expect(goHomeAsk(view, hands)?.facts).toContain(say("ui.world.go-home.ban.none"));
  });

  test("[place:leaving-an-overstay-bans] [place:view-carries-way-home] given the grace passed, when the card is drawn, then it says in words when the life can come back, from the engine's ban", () => {
    const view = overstayingGame().view();
    const months = wayOf(view).banMonths;
    expect(months).toBe(12);
    expect(goHomeAsk(view, hands)?.facts).toContain(say("ui.world.go-home.ban", { months }));
  });

  test("[place:view-carries-way-home] given a status that is not an overstay, when the card is drawn, then it says no ban at all", () => {
    const facts = goHomeAsk(abroadGame().view(), hands)?.facts ?? [];
    expect(facts.some((fact) => fact.includes(say("ui.world.go-home.ban.none")) || /come back/.test(fact))).toBe(false);
  });

  test("[place:view-carries-way-home] given the UAE's fine within the fare, when the card is drawn, then the fine is said as money beside the fare", () => {
    const view = overstayingGame().view();
    const way = wayOf(view);
    const fined: PlayerView = { ...view, place: { ...view.place, wayHome: { ...way, fine: { currency: "AED", amount: 300_000 } } } };
    expect(goHomeAsk(fined, hands)?.facts).toContain(say("ui.world.go-home.fine", { fine: formatMoney(300_000, "AED") }));
  });

  test("[place:returns-service-takes-you-home] given a UK overstay with the fare in hand, when the card is drawn, then the returns service is its second way, with the ticket paid, the grant in naira and its ban in its own line", () => {
    const view = overstayingGame().view();
    const scheme = wayOf(view).scheme;
    if (scheme === null) throw new Error("The UK overstay has no returns service.");
    const other = goHomeAsk(view, hands)?.other;
    expect(other?.button).toBe(say("ui.world.go-home.scheme"));
    expect(other?.line).toBe(say("ui.world.go-home.scheme.line", { grant: formatMoney(scheme.grant.amount, scheme.grant.currency), months: scheme.banMonths }));
    expect(other?.sure.line).toBe(say("ui.world.go-home.scheme.sure", { months: scheme.banMonths }));
  });

  test("[world:costly-acts-confirmed] [place:returns-service-takes-you-home] given the returns service on the card, when it is tapped, then the card asks once more and names the ban, the safe choice is the main button, the service wears the warning colour apart, and only then does it go", async () => {
    const view = overstayingGame().view();
    const go = vi.fn();
    const ask = goHomeAsk(view, { ...hands, scheme: go });
    await renderWithView(<AskSheet ask={ask} formatMoney={(amount, currency) => formatMoney(amount, currency as Currency)} />, view);
    const card = screen.getByRole("dialog");
    const quiet = within(card).getByRole("button", { name: say("ui.world.go-home.scheme") });
    expect(card.querySelector("[data-ask-other]")?.textContent).toContain(ask!.other!.line);
    fireEvent.click(quiet);
    expect(go).not.toHaveBeenCalled();
    const sure = card.querySelector<HTMLElement>("[data-ask-sure]");
    expect(sure?.textContent).toContain(ask!.other!.sure.line);
    // The main button is now the safe one, and the first; the costly one is in the warning colour, after it.
    const keep = within(sure!).getByRole("button", { name: say("ui.world.go-home.scheme.keep") });
    const leave = within(sure!).getByRole("button", { name: say("ui.world.go-home.scheme.go") });
    expect(keep.className).toContain("press-button");
    expect(leave.className).toContain("text-bad");
    expect(leave.className).not.toContain("bg-accent");
    expect(keep.compareDocumentPosition(leave) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.querySelectorAll("[data-ask-main]")).toHaveLength(0);
    fireEvent.click(keep);
    expect(card.querySelector("[data-ask-sure]")).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: say("ui.world.go-home.scheme") }));
    fireEvent.click(within(card.querySelector<HTMLElement>("[data-ask-sure]")!).getByRole("button", { name: say("ui.world.go-home.scheme.go") }));
    expect(go).toHaveBeenCalledTimes(1);
  });

  test("[place:returns-service-takes-you-home] given a UK overstay in the room, when the bag's Go home is tapped and the returns service chosen and confirmed, then return/home is sent asking for the service", async () => {
    const game = overstayingGame();
    const { authority } = await renderWithGame(<City world />, game);
    await pressFanAct("bag", "go-home");
    const card = await screen.findByRole("dialog");
    fireEvent.click(within(card).getByRole("button", { name: say("ui.world.go-home.scheme") }));
    fireEvent.click(within(card).getByRole("button", { name: say("ui.world.go-home.scheme.go") }));
    await waitFor(() => expect(authority.sent.filter((command) => command.type === "return/home")).toEqual([expect.objectContaining({ type: "return/home", scheme: true })]));
  });
});
