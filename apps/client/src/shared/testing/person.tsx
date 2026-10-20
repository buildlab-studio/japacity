// Lives with people in them, for the people, interview, route and plan
// screens: a computer courted and met, a friend linked through a card, an
// interview opened by the authority. Every state comes from the real engine
// and the real content through commands, as the rule tests reach them.
import { content } from "@japacity/content";
import type { Content, Id, PersonFacts, SlotPick } from "@japacity/sim";
import { bondWith, start, type Game } from "@japacity/sim/testing";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import { gameAuthority } from "./fixtures";
import "./render";

const BANKER: Id<"scenario"> = "scenario.banker";
export const TOBI: Id<"person"> = "person.tobi-bank";
export const SEE: SlotPick = { activity: "activity.see-someone", param: null };
export const PAIR = "pair-1";

/** A copy of the real content where every computer partner agrees at once and waits on nothing. */
export function eagerContent(): Content {
  const copy = JSON.parse(JSON.stringify(content)) as Content;
  for (const entry of Object.values(copy.person)) {
    entry.behaviour.agreeBp = 10000;
    entry.behaviour.courtMonths = 0;
    entry.behaviour.marryAfterMonths = 0;
  }
  return copy;
}

/** Tunde's life on the real content, or on the content given. */
export function peopleGame(given: Content = content): Game {
  return start({ scenario: BANKER, content: given });
}

/** Ends a month with these slots, granting a month first when none is banked. */
export function playMonth(game: Game, slots: SlotPick[] = []): void {
  if (game.state.turn.banked === 0) game.grant(1);
  game.endTurn(slots);
}

/** Courts a computer and spends `months` months seeing them. */
export function courted(game: Game, person: Id<"person"> = TOBI, months = 0): string {
  game.accept({ type: "people/court", with: person });
  for (let month = 0; month < months; month += 1) playMonth(game, [SEE]);
  return bondWith(game, person);
}

/** Courts Tobi to the moments partners need and asks; on eager content they agree. */
export function partnered(game: Game): string {
  const bond = courted(game, TOBI, game.content.tuning.people.partnerMoments);
  game.accept({ type: "people/propose", bond, step: "partner" });
  return bond;
}

export const FRIEND: PersonFacts = {
  label: "player",
  ageMonths: 340,
  where: "abroad",
  country: "country.uk",
  status: "status.uk-settled",
  statusMonthsLeft: null,
  monthsInCountry: 30,
  job: "activity.job-uk-senior-care",
  meetsFloor: { "route.uk-partner": true, "route.ca-spouse": true },
  eduLevel: 3,
  englishBand: 70,
  home: "town",
  joint: null,
  funds: null,
  assistanceTaken: 0,
  sponsorReady: "route.uk-partner",
};

/** A friend who took the partner card, linked by the authority as `pair-1`. Returns the bond. */
export function linkedFriend(game: Game, facts: PersonFacts = FRIEND): string {
  game.accept({ type: "people/invite", slot: "partner", looking: "partner", fill: "already-in-uk" });
  game.accept({ type: "people/link", slot: "partner", pair: PAIR, facts }, "authority");
  const found = Object.entries(game.state.people.bonds).find(([, bond]) => bond.with.kind === "player");
  if (found === undefined) throw new Error("The link made no bond.");
  return found[0];
}

/** Two questions the authority opens for a linked friend, as it would for a partner application. */
export const QUESTIONS = [
  { id: "times-met", options: ["not-yet", "one-to-three", "four-to-eight", "nine-to-fifteen"] },
  { id: "partner-home", options: ["city", "town", "not-sure"] },
];

/** A linked friend and the interview the authority opens on the UK partner route. */
export function interviewGame(): Game {
  const game = peopleGame();
  linkedFriend(game);
  game.accept({ type: "interview/open", pair: PAIR, route: "route.uk-partner", questions: QUESTIONS }, "authority");
  return game;
}

/** Renders a screen over a live game: the real engine answers every command. */
export async function renderWithGame(ui: ReactElement, game: Game): Promise<{ store: GameStore; authority: ReturnType<typeof gameAuthority> }> {
  const authority = gameAuthority(game);
  const store = createGameStore(authority);
  await store.getState().refresh();
  render(<GameProvider store={store}>{ui}</GameProvider>);
  return { store, authority };
}
