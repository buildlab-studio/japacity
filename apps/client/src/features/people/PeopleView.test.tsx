import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { bondName, interviewName, momentWords, personOf } from "../../shared/sim/people";
import { renderWithView } from "../../shared/testing/render";
import { courted, eagerContent, FRIEND, interviewGame, linkedFriend, partnered, peopleGame, renderWithGame, TOBI } from "../../shared/testing/people";
import { formatBp, formatMoney } from "../../shared/words/format";
import { nameOf, say, sayCount } from "../../shared/words/text";
import { PairApiProvider } from "./pairApi";
import { PeopleView } from "./PeopleView";

const people = content.tuning.people;

function offline(ui: React.ReactElement) {
  return <PairApiProvider value={null}>{ui}</PairApiProvider>;
}

function card(bond: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-bond="${bond}"]`);
  if (found === null) throw new Error(`No card for ${bond}.`);
  return found;
}

describe("the slots", () => {
  test("[R-PEOPLE-007] given a new fixed life, when the people tab opens, then the partner slot is empty, each sibling and both parents are shown, and the computer ones carry the quiet mark", async () => {
    const game = peopleGame();
    playFirst(game);
    await renderWithGame(offline(<PeopleView />), game);
    const partner = document.querySelector<HTMLElement>('[data-slot="partner"]')!;
    expect(partner.dataset.state).toBe("empty");
    expect(within(partner).getByText(say("ui.people.slot.state.empty"))).toBeDefined();
    for (const slot of ["sibling-1", "sibling-2", "mother", "father"]) {
      const shown = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
      expect(shown.dataset.state).toBe("computer");
      expect(within(shown).getByText(say("ui.people.mark.computer"))).toBeDefined();
    }
    const order = [...document.querySelectorAll<HTMLElement>("[data-slot]")].map((slot) => slot.dataset.slot);
    expect(order).toEqual(["partner", "sibling-1", "sibling-2", "mother", "father"]);
  });

  test("[R-PEOPLE-047] given computer siblings drawn with the family, then each sibling's card names them from content where the facts tell them apart, and says where they live", async () => {
    const game = peopleGame();
    playFirst(game);
    const { store } = await renderWithGame(offline(<PeopleView />), game);
    for (const slot of ["sibling-1", "sibling-2"]) {
      const held = game.state.people.slots[slot]!;
      const bond = store.getState().view!.people.bonds.find((entry) => entry.id === held.bond)!;
      const found = personOf(bond);
      expect([null, held.person]).toContain(found);
      const shown = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
      expect(within(shown).getByText(bondName(bond))).toBeDefined();
      expect(shown.textContent).toMatch(/At home\.|In /);
    }
  });
});

function playFirst(game: ReturnType<typeof peopleGame>): void {
  if (game.state.turn.banked === 0) game.grant(1);
  game.endTurn([]);
}

describe("candidates and the quiet mark", () => {
  test("[R-PEOPLE-009] given an empty partner slot, then every candidate in the view is listed with its blurb and the computer mark", async () => {
    const game = peopleGame();
    const { store } = await renderWithGame(offline(<PeopleView />), game);
    const candidates = store.getState().view!.people.candidates;
    expect(candidates.length).toBeGreaterThan(0);
    for (const { person } of candidates) {
      const shown = document.querySelector<HTMLElement>(`[data-candidate="${person}"]`)!;
      expect(within(shown).getByText(nameOf(person))).toBeDefined();
      expect(within(shown).getByText(text[`${person}.blurb`]!)).toBeDefined();
      expect(within(shown).getByText(say("ui.people.mark.computer"))).toBeDefined();
    }
  });

  test("[R-PEOPLE-054] given a computer candidate, when the player starts seeing them, then one plain line says they live in the game, and no other banner says so", async () => {
    const game = peopleGame();
    const { authority } = await renderWithGame(offline(<PeopleView />), game);
    expect(screen.queryByText(say("ui.people.chosen", { name: nameOf(TOBI) }))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.court", { name: nameOf(TOBI) }) }));
    await screen.findByText(say("ui.people.chosen", { name: nameOf(TOBI) }));
    expect(authority.sent.at(-1)).toMatchObject({ type: "people/court", with: TOBI });
    expect(document.body.textContent.split(say("ui.people.chosen", { name: nameOf(TOBI) })).length).toBe(2);
    expect(screen.getAllByText(/computer character/i)).toHaveLength(1);
  });
});

describe("the invite card", () => {
  test("[R-PAIR-007] given the card maker, when a fill is picked, then the card shows the character's name, the looking line, the game's words and nothing else about the player", async () => {
    const game = peopleGame();
    await renderWithGame(offline(<PeopleView />), game);
    const maker = screen.getByRole("form", { name: say("ui.people.invite.title") });
    fireEvent.change(within(maker).getByLabelText(say("ui.people.invite.fill")), { target: { value: "who-codes" } });
    const face = maker.querySelector<HTMLElement>("[data-invite-card]")!;
    expect(face.textContent).toContain(nameOf("scenario.tunde"));
    expect(face.textContent).toContain(`Looking for: ${text["card.invite.slot.partner"]!} ${text["card.invite.fill.who-codes"]!}`);
    expect(face.textContent).toContain(text["card.invite.game"]!);
    expect(face.textContent).not.toMatch(/[₦£$]|@|\d{6,}/);
  });

  test("[R-PEOPLE-010] given the card made and then taken back, then the slot shows the card while it is out and is empty again after", async () => {
    const game = peopleGame();
    const { authority } = await renderWithGame(offline(<PeopleView />), game);
    const maker = screen.getByRole("form", { name: say("ui.people.invite.title") });
    fireEvent.change(within(maker).getByLabelText(say("ui.people.invite.fill")), { target: { value: "already-in-uk" } });
    fireEvent.click(within(maker).getByRole("button", { name: say("ui.people.invite.make") }));
    await waitFor(() => expect(document.querySelector('[data-slot="partner"]')?.getAttribute("data-state")).toBe("invited"));
    expect(authority.sent.at(-1)).toMatchObject({ type: "people/invite", slot: "partner", looking: "partner", fill: "already-in-uk" });
    expect(screen.getByText(say("ui.people.invite.offline"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.invite.withdraw") }));
    await waitFor(() => expect(document.querySelector('[data-slot="partner"]')?.getAttribute("data-state")).toBe("empty"));
    expect(authority.sent.at(-1)).toEqual({ type: "people/invite", slot: "partner", basedOn: expect.any(Number) as number });
  });
});

describe("a bond", () => {
  test("[R-PEOPLE-051] given a computer courted and met, then the card names them, gives the stage, the moments in words and the facts, and never a sum of their money", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI, 2);
    const { store } = await renderWithGame(offline(<PeopleView />), game);
    const shown = card(bond);
    const view = store.getState().view!;
    const held = view.people.bonds.find((entry) => entry.id === bond)!;
    expect(within(shown).getByText(nameOf(TOBI))).toBeDefined();
    expect(within(shown).getByText(say("ui.people.stage.courting"))).toBeDefined();
    for (const moment of held.moments!) expect(within(shown).getByText(momentWords(moment))).toBeDefined();
    expect(within(shown).getByText(say("ui.people.facts.home"))).toBeDefined();
    expect(shown.textContent).not.toMatch(/[₦£$]|people\.|person\./);
    const left = people.partnerMoments - held.moments!.length;
    expect(within(shown).getByText(sayCount("ui.people.courting.next", left, { count: left }))).toBeDefined();
  });

  test("[R-PEOPLE-004] given a friend's facts with funds only where consent put them, then the card shows the funds, and the floor only as met or not", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    const view = (await renderWithGame(offline(<PeopleView />), game)).store.getState().view!;
    expect(card(bond).textContent).not.toContain(say("ui.people.facts.funds", { amount: "" }).trim());
    const withFunds: PlayerView = {
      ...view,
      people: { ...view.people, bonds: view.people.bonds.map((entry) => (entry.id === bond ? { ...entry, stage: "partner", facts: { ...FRIEND, funds: { currency: "GBP", amount: 450_000 } } } : entry)) },
    };
    document.body.innerHTML = "";
    await renderWithView(offline(<PeopleView />), withFunds);
    const shown = card(bond);
    expect(within(shown).getByText(say("ui.people.facts.funds", { amount: formatMoney(450_000, "GBP") }))).toBeDefined();
    expect(within(shown).getAllByText(/Earns above the floor/).length).toBeGreaterThan(0);
  });

  test("[R-PEOPLE-016] given a bond with the moments partners need, when the player asks, then the proposal goes to the engine and the answer shows on the card", async () => {
    const game = peopleGame(eagerContent());
    const bond = courted(game, TOBI, people.partnerMoments);
    const { authority } = await renderWithGame(offline(<PeopleView />), game);
    fireEvent.click(within(card(bond)).getByRole("button", { name: say("ui.people.propose.partner") }));
    await waitFor(() => expect(within(card(bond)).getByText(say("ui.people.stage.partner"))).toBeDefined());
    expect(authority.sent.at(-1)).toMatchObject({ type: "people/propose", bond, step: "partner" });
    expect(within(card(bond)).getByRole("button", { name: say("ui.people.propose.marry") })).toBeDefined();
    expect(within(card(bond)).getByText(say("ui.people.propose.marry-share", { amount: formatMoney(people.weddingShare, "NGN") }))).toBeDefined();
  });

  test("[R-PEOPLE-016] given a computer who says no, then the card says the question waits for the cooldown", async () => {
    const copy = eagerContent();
    for (const entry of Object.values(copy.person)) entry.behaviour.agreeBp = 0;
    const game = peopleGame(copy);
    const bond = courted(game, TOBI, people.partnerMoments);
    await renderWithGame(offline(<PeopleView />), game);
    fireEvent.click(within(card(bond)).getByRole("button", { name: say("ui.people.propose.partner") }));
    expect(await within(card(bond)).findByText(sayCount("ui.people.declined.cooldown", people.proposeCooldown, { months: people.proposeCooldown }))).toBeDefined();
  });

  test("[R-PEOPLE-016] given a friend's proposal waiting, when the player says yes, then the answer goes with the step; and their own proposal can be taken back", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    game.accept({ type: "people/court", with: bond });
    game.accept({ type: "people/proposal", pair: "pair-1", proposal: { step: "partner", route: null, lead: null } }, "authority");
    const { authority } = await renderWithGame(offline(<PeopleView />), game);
    expect(within(card(bond)).getByText(say("ui.people.pending.theirs", { step: say("ui.people.step.partner") }))).toBeDefined();
    fireEvent.click(within(card(bond)).getByRole("button", { name: say("ui.people.answer.yes") }));
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "people/answer", bond, step: "partner", yes: true }));
  });

  test("[R-PEOPLE-021] given partners and a route that brings a partner, when the player asks to apply together, then the route and the lead go with the proposal", async () => {
    const game = peopleGame(eagerContent());
    const bond = partnered(game);
    const view = game.view();
    const routes = view.routes.map((route) => (route.id === "route.uk-skilled" ? { ...route, state: "known" as const } : route));
    const { authority } = await renderWithView(offline(<PeopleView />), { ...view, routes });
    fireEvent.click(within(card(bond)).getByRole("button", { name: say("ui.people.propose.joint") }));
    const form = within(card(bond)).getByRole("form", { name: say("ui.people.propose.joint") });
    fireEvent.change(within(form).getByLabelText(say("ui.people.propose.joint.route")), { target: { value: "route.uk-skilled" } });
    fireEvent.click(within(form).getByLabelText(say("ui.people.propose.joint.lead.them")));
    fireEvent.click(within(form).getByRole("button", { name: say("ui.people.propose.joint.send") }));
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "people/propose", bond, step: "joint", route: "route.uk-skilled", lead: "them" }));
  });

  test("[R-PEOPLE-037] given each stage, when the player goes to end it, then the standing and wellbeing it costs are said before, with more while a joint application is applying", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI);
    const view = game.view();
    const cases: [PlayerView["people"]["bonds"][number]["stage"], boolean, number][] = [
      ["courting", false, people.endStanding.courting],
      ["partner", false, people.endStanding.partner],
      ["married", false, people.endStanding.married],
      ["married", true, people.endStanding.married + people.endStanding.applying],
    ];
    for (const [stage, applying, standing] of cases) {
      document.body.innerHTML = "";
      const routes = view.routes.map((route) => (route.id === "route.uk-skilled" ? { ...route, state: applying ? ("applying" as const) : ("known" as const) } : route));
      const joint = applying ? { bond, route: "route.uk-skilled" as const, lead: "me" as const, myScore: null, theirScore: null } : null;
      const changed: PlayerView = { ...view, routes, people: { ...view.people, joint, bonds: view.people.bonds.map((entry) => (entry.id === bond ? { ...entry, stage } : entry)) } };
      const { authority } = await renderWithView(offline(<PeopleView />), changed);
      fireEvent.click(within(card(bond)).getByRole("button", { name: say("ui.people.end") }));
      expect(within(card(bond)).getByText(say("ui.people.end.cost", { standing: String(Math.abs(standing)), wellbeing: String(Math.abs(people.endWellbeing)) }))).toBeDefined();
      expect(within(card(bond)).queryByText(say("ui.people.end.joint")) !== null).toBe(applying);
      fireEvent.click(within(card(bond)).getByRole("button", { name: say("ui.people.end.confirm") }));
      await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "people/end", bond }));
    }
  });

  test("[R-PEOPLE-044] given the stand-in on for a friend, then the card says so and ending it costs nobody anything", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    game.accept({ type: "people/stand-in", pair: "pair-1", stage: "on" }, "authority");
    await renderWithGame(offline(<PeopleView />), game);
    expect(within(card(bond)).getByText(say("ui.people.stand-in.on", { piece: interviewName() }))).toBeDefined();
    expect(within(card(bond)).getByText(say("ui.people.mark.stand-in"))).toBeDefined();
    fireEvent.click(within(card(bond)).getByRole("button", { name: say("ui.people.end") }));
    expect(within(card(bond)).getByText(say("ui.people.end.absence"))).toBeDefined();
  });

  test("[R-PEOPLE-043] given a friend quiet for a week, then the card warns that a stand-in takes over at two weeks", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    game.accept({ type: "people/stand-in", pair: "pair-1", stage: "warned" }, "authority");
    await renderWithGame(offline(<PeopleView />), game);
    expect(within(card(bond)).getByText(say("ui.people.stand-in.warned"))).toBeDefined();
  });

  test("[R-PEOPLE-041] given a partner and someone else courted, then the courted card warns that people talk, at the tuning's chance", async () => {
    const game = peopleGame(eagerContent());
    partnered(game);
    const other = courted(game, "person.amaka-nurse");
    await renderWithGame(offline(<PeopleView />), game);
    expect(within(card(other)).getByText(say("ui.people.gossip", { chance: formatBp(people.gossipBp) }))).toBeDefined();
  });

  test("[R-PEOPLE-042] given a computer partner with no time together for a month short of its patience, then the card warns it will stop waiting; with time together it only states the rule", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI, 1);
    const patience = content.person[TOBI]!.behaviour.patienceMonths!;
    const base = game.view();
    const last = base.people.bonds.find((entry) => entry.id === bond)!.moments!.at(-1)!;
    const era = { id: "era.test" as const, since: 0, until: 100, sinceMonth: 0, untilMonth: 100 };
    const at = (month: number): PlayerView => ({ ...base, month: last.tick + month, era });
    await renderWithView(offline(<PeopleView />), at(patience - 1));
    const name = bondName(base.people.bonds.find((entry) => entry.id === bond)!);
    expect(within(card(bond)).getByText(sayCount("ui.people.drift.near", patience - 1, { months: patience - 1, patience, name }))).toBeDefined();
    document.body.innerHTML = "";
    await renderWithView(offline(<PeopleView />), at(0));
    expect(within(card(bond)).getByText(say("ui.people.drift.rule", { name, patience }))).toBeDefined();
  });

  test("[R-INTERVIEW-005] given an interview open, then the bond's moments are hidden and the card says the player answers from memory", async () => {
    const game = interviewGame();
    await renderWithGame(offline(<PeopleView />), game);
    const bond = Object.keys(game.state.people.bonds).find((id) => game.state.people.bonds[id]!.with.kind === "player")!;
    expect(within(card(bond)).getByText(say("ui.people.moments.hidden", { piece: interviewName() }))).toBeDefined();
  });

  test("[R-PEOPLE-039] given a bond ended, then it is kept read-only under the earlier ones with no choices on it", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI, 1);
    game.accept({ type: "people/end", bond });
    await renderWithGame(offline(<PeopleView />), game);
    const shown = card(bond);
    expect(shown.closest("[data-ended]")).not.toBeNull();
    expect(within(shown).queryAllByRole("button")).toHaveLength(0);
    expect(within(shown).getByText(say("ui.people.ended.recourt", { months: people.recourtMonths }))).toBeDefined();
  });

  test("[R-PEOPLE-051] given a computer bond, then no block or report shows on it, since it is no player", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI);
    await renderWithGame(offline(<PeopleView />), game);
    expect(card(bond).querySelector("[data-safety]")).toBeNull();
  });
});

describe("the sponsor's side", () => {
  test("[R-UNDERTAKING-004] given a bar on sponsoring, then the people tab says the month it lifts", async () => {
    const game = peopleGame();
    const view = game.view();
    await renderWithView(offline(<PeopleView />), { ...view, people: { ...view.people, barUntilMonth: 70, sponsoring: { bond: "bond-9", route: "route.ca-spouse", month: 20 } } });
    expect(screen.getByText(say("ui.people.bar", { month: "70" }))).toBeDefined();
    expect(screen.getByText(say("ui.people.sponsoring", { route: nameOf("route.ca-spouse"), month: "20" }))).toBeDefined();
  });
});
