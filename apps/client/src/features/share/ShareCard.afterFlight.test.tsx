// The cards after the flight (share:card-contents): the japacity
// figure is how ready the move is, so once flown no card carries it. The graduate's recorded life, landed in
// London, hunts the shop job twice, takes it and works a month: the first pay card abroad comes with
// no "100% Ready to go", and speaks of the landing instead.
import type { PlayerView } from "@japacity/sim";
import { render } from "@testing-library/react";
import { setPockets } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { cardFace, cardWords } from "../../shared/share/face";
import { cardSteps } from "../../shared/share/layout";
import { measure } from "../../shared/share/share.testing";
import { recordedGame } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { ShareCardFace } from "./ShareCard";

type Card = NonNullable<PlayerView["card"]>;

/** The graduate's careful life to its first pay abroad: two hunts for the shop job, the offer taken, a month worked. */
function firstPayCard(): Card {
  const game = recordedGame("graduate-careful");
  // Pounds enough that the landing's bills are paid and nothing but the work moves the story.
  setPockets(game, { GBP: 2_000_000 });
  for (let month = 0; month < 4 && game.view().card?.kind !== "first-pay-abroad"; month += 1) {
    const offer = game.view().offers.find((open) => open.entry === "offer.job");
    if (offer !== undefined) game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
    game.endTurn(game.view().job.id === null ? [{ activity: "activity.job-hunt", param: "activity.job-uk-retail-part" }] : []);
  }
  const card = game.view().card;
  if (card?.kind !== "first-pay-abroad") throw new Error("The graduate's first pay abroad did not come within four months.");
  return card;
}

describe("the cards after the flight", () => {
  test("[share:card-contents] given the graduate's first pay abroad, when its card is read, then the japacity figure is gone though the view still carries it, and the card speaks of the landing", () => {
    const card = firstPayCard();
    expect(card.percent).toBe(100);
    const face = cardFace(card, "scenario.graduate");
    expect(face.percent).toBeNull();
    expect(face.body).toBe(cardWords("share.first-pay-abroad.body"));
    expect(face.body).toBe("A room with a lock, a job, and the first month's pay in.");
    expect(face.route).not.toBeNull();
  });

  test("[share:card-contents] [share:card-carries-no-money] given the first pay card on screen and drawn, then no percent and no Ready to go show, and no sum of money", () => {
    const card = firstPayCard();
    const { container } = render(<ShareCardFace card={card} scenario="scenario.graduate" />);
    expect(container.textContent).not.toContain("%");
    expect(container.textContent).not.toContain(say("share.japacity"));
    expect(container.textContent).toContain(cardWords("share.first-pay-abroad.body"));
    expect(container.textContent).not.toMatch(/[£$₦]\s?\d/);
    const roles = cardSteps(cardFace(card, "scenario.graduate"), { width: 1080, height: 1920 }, measure).flatMap((step) => (step.op === "text" ? [step.role] : []));
    expect(roles).not.toContain("percent");
    expect(roles).not.toContain("percent-sign");
    expect(roles).toContain("body");
  });

  test("[share:card-contents] given a card for a moment after the flight, a status secured, the December visit, the landing's chapter or the one after, then none carries the japacity figure", () => {
    const card = firstPayCard();
    for (const after of [{ kind: "secured" }, { kind: "december" }, { kind: "chapter", chapter: "chapter.landing" }, { kind: "chapter", chapter: "chapter.secure" }] as const) {
      expect([after.kind, cardFace({ ...card, ...after }, "scenario.graduate").percent]).toEqual([after.kind, null]);
    }
  });

  test("[share:card-contents] given a moment before the flight or on its day, the visa granted, a chapter at home, the send-off, a draw won, then the japacity figure stays", () => {
    const card = firstPayCard();
    for (const before of [{ kind: "granted" }, { kind: "chapter", chapter: "chapter.build-the-file" }, { kind: "send-off" }, { kind: "draw-win" }] as const) {
      expect([before.kind, cardFace({ ...card, chapter: null, ...before }, "scenario.graduate").percent]).toEqual([before.kind, 100]);
    }
  });
});
