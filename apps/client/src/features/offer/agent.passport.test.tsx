// The Dubai agent asks for the passport (docs/rules/advice.md R-ADVICE-006, route-gates.md): he never takes "₦1,300,000
// and your passport" from a trader who holds none while Japa ticks "An agent with a real contract". Paying him needs the passport in hand; until then the ask says it is still
// needed and the route's agent step stays unticked. Real content.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import type { Game } from "@japacity/sim/testing";
import { applyEffects, readyLife, slot } from "@japacity/sim/testing";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { openOffer } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { words } from "../../shared/words/text";
import { OfferView } from "./OfferView";

const GULF = "route.gulf-contract" as const;
const AGENT = "offer.gulf-agent" as const;
const PASSPORT = "document.passport" as const;

function agentStep(view: PlayerView): boolean | undefined {
  return view.routes.find((route) => route.id === GULF)?.checklist.find((item) => item.id === "agent")?.met;
}

/** A life with no papers, the Gulf's window open, that heard of the Gulf at the motor park and read its page. */
function noPassport(): Game {
  const game = readyLife(content, { quiet: true, documents: [], vars: () => ({ "var.uae-window": 1 }) });
  game.endTurn([slot("activity.ask-around")]);
  for (let month = 0; month < 5 && game.state.route[GULF]?.state !== "heard"; month += 1) game.endTurn();
  game.endTurn([slot("activity.look-into-route", GULF)]);
  expect(game.state.route[GULF]?.state).toBe("known");
  return game;
}

describe("the Dubai agent and the passport", () => {
  test("[R-ADVICE-006] given a life holding no passport with the Dubai agent's ask open, when it is read, then paying him is shut, the ask says the passport is still needed, and the agent step stays unticked; once the passport is held, paying him opens", async () => {
    const game = noPassport();
    expect(game.view().documents.some((paper) => paper.id === PASSPORT && paper.state === "held")).toBe(false);
    const offer = openOffer(game, AGENT);
    const take = offer.choices.find((choice) => choice.id === "take");
    expect(take?.allowed).toBe(false);
    game.expectRejected({ type: "offer/choose", offer: offer.id, choice: "take" }, "not-legal");
    expect(agentStep(game.view())).not.toBe(true);
    await renderWithView(<OfferView only={(candidate) => candidate.id === offer.id} />, game.view());
    expect(document.querySelector('[data-choice-shut="take"]')?.textContent).toBe(words(`${AGENT}.choice.take.shut`));
    expect(screen.getByText(words(`${AGENT}.choice.take.shut`)).textContent).toMatch(/passport/);

    applyEffects(game, [{ type: "document/grant", document: PASSPORT }]);
    expect(game.view().offers.find((candidate) => candidate.id === offer.id)?.choices.find((choice) => choice.id === "take")?.allowed).toBe(true);
  });
});
