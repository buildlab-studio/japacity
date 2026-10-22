// The people of this life as the phone shows them (docs/rules/person.md; world:nobody-picked-from-list): the slots on Chats'
// People row, with the invite card behind a tap, and a bond's thread head with its rows, each assertion
// against the element the phone shows.
import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { useView } from "../../authority/GameProvider";
import { bondName, interviewName, personOf } from "../../shared/view/person";
import { renderWithView } from "../../shared/testing/render";
import { courted, eagerContent, FRIEND, interviewGame, linkedFriend, partnered, peopleGame, renderWithGame, TOBI } from "../../shared/testing/person";
import { formatBp, formatMoney } from "../../shared/words/format";
import { forMonths, inMonths, nameOf, say, sayCount } from "../../shared/words/text";
import { PairApiProvider } from "./pairApi";
import { BondHead, PeopleSlots, togetherWords } from "./PeopleOnPhone";

const people = content.tuning.people;

function offline(ui: React.ReactElement) {
  return <PairApiProvider value={null}>{ui}</PairApiProvider>;
}

/** A bond's head as Chats shows it over the thread, read from the view so it follows the engine. */
function Head({ id }: { id: string }) {
  const view = useView();
  const bond = view.people.bonds.find((one) => one.id === id);
  return bond === undefined ? null : <BondHead bond={bond} api={null} />;
}

function head(bond: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-bond-head="${bond}"]`);
  if (found === null) throw new Error(`No head for ${bond}.`);
  return found;
}

function row(bond: string, id: string): HTMLElement {
  const found = head(bond).querySelector<HTMLElement>(`[data-head-row="${id}"]`);
  if (found === null) throw new Error(`No row ${id} for ${bond}.`);
  return found;
}

/** Opens a row: a tap on its one line. */
function open(element: HTMLElement): HTMLElement {
  const summary = element.querySelector("summary");
  if (summary === null) throw new Error("A row with no line.");
  if (!element.hasAttribute("open")) fireEvent.click(summary);
  return element;
}

function playFirst(game: ReturnType<typeof peopleGame>): void {
  if (game.state.turn.banked === 0) game.grant(1);
  game.endTurn([]);
}

describe("the slots on the People row", () => {
  test("[person:family-and-partner-slots] given a new fixed life, when the People row opens, then the partner slot is empty, each sibling and both parents are shown, and the computer ones carry the quiet mark", async () => {
    const game = peopleGame();
    playFirst(game);
    await renderWithGame(offline(<PeopleSlots api={null} />), game);
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

  test("[person:family-and-partner-slots] given the family played by the game, when the People row opens, then the quiet mark stands in one place on every card, beside who the slot is, and no slot is a numbered placeholder", async () => {
    // "Not a player" stands in the same place for a sibling and for a parent, and no slot reads as a numbered
    // placeholder such as "Sibling 2".
    const game = peopleGame();
    playFirst(game);
    await renderWithGame(offline(<PeopleSlots api={null} />), game);
    for (const slot of ["sibling-1", "sibling-2", "mother", "father"]) {
      const card = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
      const title = card.querySelector<HTMLElement>("[data-slot-title]")!;
      expect(title.querySelector("[data-mark-label='computer']")).not.toBeNull();
      expect(card.querySelectorAll("[data-mark-label]")).toHaveLength(1);
      expect(title.textContent).not.toMatch(/\d/);
    }
    expect(document.querySelector('[data-slot="sibling-1"] [data-slot-title]')!.textContent).toContain(say("ui.people.slot.sibling"));
  });

  test("[person:computer-siblings-drawn-with-family] given computer siblings drawn with the family, then each sibling's card names them from content where the facts tell them apart, and says where they live", async () => {
    const game = peopleGame();
    playFirst(game);
    const { store } = await renderWithGame(offline(<PeopleSlots api={null} />), game);
    for (const slot of ["sibling-1", "sibling-2"]) {
      const held = game.state.people.slots[slot]!;
      const bond = store.getState().view!.people.bonds.find((entry) => entry.id === held.bond)!;
      const found = personOf(bond);
      expect([null, held.person]).toContain(found);
      const shown = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
      expect(within(shown).getByText(bondName(bond, store.getState().view!.people.bonds))).toBeDefined();
      expect(shown.textContent).toMatch(/At home\.|In /);
    }
  });

  test("[person:family-and-partner-slots] given the parents played by the game, then each is named as the character's mother or father, with she or he, and never with the mark's words as a name", async () => {
    const game = peopleGame();
    playFirst(game);
    await renderWithGame(offline(<PeopleSlots api={null} />), game);
    const mother = document.querySelector<HTMLElement>('[data-slot="mother"]')!;
    const father = document.querySelector<HTMLElement>('[data-slot="father"]')!;
    expect(within(mother).getByText(say("ui.people.parent.name.mother"))).toBeDefined();
    expect(within(mother).getByText(say("ui.people.parent.blurb.mother"))).toBeDefined();
    expect(within(father).getByText(say("ui.people.parent.blurb.father"))).toBeDefined();
    expect(mother.textContent).toMatch(/\bshe\b/i);
    expect(mother.textContent).not.toMatch(/\bthey\b/i);
    expect(mother.textContent).not.toContain(say("ui.people.slot.state.computer"));
    // The mark stays a short tag, never a name: "Not a player".
    expect(say("ui.people.mark.computer")).toBe("Not a player");
    expect(say("ui.people.parent.name.mother")).not.toContain(say("ui.people.mark.computer"));
    expect(within(mother).getByText(say("ui.people.mark.computer")).textContent).toBe(say("ui.people.mark.computer"));
  });

  test("[undertaking:sponsored-arrivals-wait-to-sponsor] given a bar on sponsoring, then the People row says the month it lifts and who is sponsored", async () => {
    const game = peopleGame();
    const view = game.view();
    const shown: PlayerView = { ...view, month: 10, people: { ...view.people, barUntilMonth: 70, sponsoring: { bond: "bond-9", route: "route.ca-spouse", month: 7 } } };
    await renderWithView(offline(<PeopleSlots api={null} />), shown);
    const sponsoring = document.querySelector<HTMLElement>("[data-people-slots] [data-sponsoring]")!;
    // How long the bar holds and when the promise was made, as months away and ago, never a month number (world:top-band-is-lively-pill).
    expect(within(sponsoring).getByText(say("ui.people.bar", { when: forMonths(70, 10) }))).toBeDefined();
    expect(forMonths(70, 10)).toBe("for 60 more months");
    expect(within(sponsoring).getByText(say("ui.people.sponsoring", { route: nameOf("route.ca-spouse"), when: "3 months ago" }))).toBeDefined();
    expect(sponsoring.textContent).not.toMatch(/month \d+/i);
  });
});

describe("the invite card behind a tap", () => {
  test("[guide:nothing-asked-before-early-win] given a new life before its early win, then no invite is asked for: no card maker and no sibling invite; after the win, both show", async () => {
    const game = peopleGame();
    playFirst(game);
    const { store } = await renderWithGame(offline(<PeopleSlots api={null} />), game);
    act(() => store.setState({ earlyWin: false }));
    expect(screen.queryByRole("form", { name: say("ui.people.invite.title") })).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.people.partner.invite") })).toBeNull();
    expect(screen.queryAllByRole("button", { name: say("ui.people.sibling.invite") })).toEqual([]);
    act(() => store.setState({ earlyWin: true }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.partner.invite") }));
    expect(screen.getByRole("form", { name: say("ui.people.invite.title") })).toBeDefined();
    expect(screen.getAllByRole("button", { name: say("ui.people.sibling.invite") }).length).toBeGreaterThan(0);
  });

  test("[pair:invite-card-contents] given the card maker, when a fill is picked, then the card shows the character's name, the looking line, the game's words and nothing else about the player", async () => {
    const game = peopleGame();
    const { store } = await renderWithGame(offline(<PeopleSlots api={null} />), game);
    act(() => store.setState({ earlyWin: true }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.partner.invite") }));
    const maker = screen.getByRole("form", { name: say("ui.people.invite.title") });
    fireEvent.change(within(maker).getByLabelText(say("ui.people.invite.fill")), { target: { value: "who-codes" } });
    const face = maker.querySelector<HTMLElement>("[data-invite-card]")!;
    // The card names the life by its scenario's words, and a ready life has none of its own (scenario.md).
    expect(text["scenario.banker.name"]).toBeUndefined();
    expect(face.textContent).toContain(say("ui.invite.someone"));
    expect(face.textContent).toContain(`Looking for: ${text["card.invite.slot.partner"]!} ${text["card.invite.fill.who-codes"]!}`);
    expect(face.textContent).toContain(text["card.invite.game"]!);
    expect(face.textContent).not.toMatch(/[₦£$]|@|\d{6,}/);
  });

  test("[person:invite-fills-a-slot] given the card made and then taken back, then the slot shows the card while it is out and is empty again after", async () => {
    const game = peopleGame();
    const { authority, store } = await renderWithGame(offline(<PeopleSlots api={null} />), game);
    act(() => store.setState({ earlyWin: true }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.partner.invite") }));
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

describe("a bond's thread head", () => {
  test("[person:money-counted-never-moved] given a friend's facts with funds only where consent put them, then the head shows the funds, and the floor only as met or not", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    const view = (await renderWithGame(offline(<Head id={bond} />), game)).store.getState().view!;
    expect(head(bond).textContent).not.toContain(say("ui.people.facts.funds", { amount: "" }).trim());
    const withFunds: PlayerView = {
      ...view,
      people: { ...view.people, bonds: view.people.bonds.map((entry) => (entry.id === bond ? { ...entry, stage: "partner", facts: { ...FRIEND, funds: { currency: "GBP", amount: 450_000 } } } : entry)) },
    };
    document.body.innerHTML = "";
    await renderWithView(offline(<Head id={bond} />), withFunds);
    const stage = open(row(bond, "stage"));
    expect(within(stage).getByText(say("ui.people.facts.funds", { amount: formatMoney(450_000, "GBP") }))).toBeDefined();
    expect(within(stage).getAllByText(/Earns above the floor/).length).toBeGreaterThan(0);
  });

  test("[person:proposing-a-step] given a bond with the moments partners need, when the player asks, then the proposal goes to the engine and the answer shows on the head, with marrying and its share next", async () => {
    const game = peopleGame(eagerContent());
    const bond = courted(game, TOBI, people.partnerMoments);
    const { authority } = await renderWithGame(offline(<Head id={bond} />), game);
    fireEvent.click(within(open(row(bond, "ask"))).getByRole("button", { name: say("ui.people.propose.partner") }));
    await waitFor(() => expect(row(bond, "stage").querySelector("summary")?.textContent).toContain(say("ui.people.stage.partner")));
    expect(authority.sent.at(-1)).toMatchObject({ type: "people/propose", bond, step: "partner" });
    const ask = open(row(bond, "ask"));
    expect(within(ask).getByRole("button", { name: say("ui.people.propose.marry") })).toBeDefined();
    expect(within(ask).getByText(say("ui.people.propose.marry-share", { amount: formatMoney(people.weddingShare, "NGN") }))).toBeDefined();
  });

  test("[person:proposing-a-step] given a computer who says no, then the head says the question waits for the cooldown", async () => {
    const copy = eagerContent();
    for (const entry of Object.values(copy.person)) entry.behaviour.agreeBp = 0;
    const game = peopleGame(copy);
    const bond = courted(game, TOBI, people.partnerMoments);
    await renderWithGame(offline(<Head id={bond} />), game);
    fireEvent.click(within(open(row(bond, "ask"))).getByRole("button", { name: say("ui.people.propose.partner") }));
    expect(await within(head(bond)).findByText(sayCount("ui.people.declined.cooldown", people.proposeCooldown, { months: people.proposeCooldown }))).toBeDefined();
    const held = game.view().people.bonds.find((entry) => entry.id === bond)!;
    expect(held.cooldownUntil).not.toBeNull();
    expect(within(head(bond)).queryByRole("button", { name: say("ui.people.propose.partner") })).toBeNull();
    expect(within(head(bond)).getByText(say("ui.people.cooldown", { when: inMonths(held.cooldownUntil!, game.view().month) }))).toBeDefined();
    expect(head(bond).textContent).not.toMatch(/month \d+/i);
  });

  test("[person:proposing-a-step] given a friend's proposal waiting, when the player says yes, then the answer goes with the step; their question is the only ask on the head", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    game.accept({ type: "people/court", with: bond });
    game.accept({ type: "people/proposal", pair: "pair-1", proposal: { step: "partner", route: null, lead: null } }, "authority");
    const { authority } = await renderWithGame(offline(<Head id={bond} />), game);
    const pending = row(bond, "pending");
    expect(within(pending).getByText(say("ui.people.pending.theirs", { step: say("ui.people.step.partner") }))).toBeDefined();
    expect(within(head(bond)).queryByRole("button", { name: say("ui.people.propose.partner") })).toBeNull();
    expect(head(bond).textContent).not.toMatch(/more moments? before you can ask/);
    fireEvent.click(within(pending).getByRole("button", { name: say("ui.people.answer.yes") }));
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "people/answer", bond, step: "partner", yes: true }));
  });

  test("[person:joint-application-proposed] given partners and a route that brings a partner, when the player asks to apply together, then the route and the lead go with the proposal", async () => {
    const game = peopleGame(eagerContent());
    const bond = partnered(game);
    const view = game.view();
    const routes = view.routes.map((route) => (route.id === "route.uk-skilled" ? { ...route, state: "known" as const } : route));
    const { authority } = await renderWithView(offline(<Head id={bond} />), { ...view, routes });
    const ask = open(row(bond, "ask"));
    fireEvent.click(within(ask).getByRole("button", { name: say("ui.people.propose.joint") }));
    const form = within(ask).getByRole("form", { name: say("ui.people.propose.joint") });
    fireEvent.change(within(form).getByLabelText(say("ui.people.propose.joint.route")), { target: { value: "route.uk-skilled" } });
    fireEvent.click(within(form).getByLabelText(say("ui.people.propose.joint.lead.them")));
    fireEvent.click(within(form).getByRole("button", { name: say("ui.people.propose.joint.send") }));
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "people/propose", bond, step: "joint", route: "route.uk-skilled", lead: "them" }));
  });

  test("[person:ender-pays-in-standing] given each stage, when the player goes to end it, then the standing and wellbeing it costs are said before, with more while a joint application is applying", async () => {
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
      const { authority } = await renderWithView(offline(<Head id={bond} />), changed);
      const end = open(row(bond, "end"));
      expect(end.querySelector("summary")?.textContent).toContain(say("ui.people.end"));
      expect(within(end).getByText(say("ui.people.end.cost", { standing: String(Math.abs(standing)), wellbeing: String(Math.abs(people.endWellbeing)) }))).toBeDefined();
      expect(within(end).queryByText(say("ui.people.end.joint")) !== null).toBe(applying);
      fireEvent.click(within(end).getByRole("button", { name: say("ui.people.end.confirm") }));
      await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "people/end", bond }));
    }
  });

  test("[person:stand-in-acts-narrowly] given the stand-in on for a friend, then the head says so and ending it costs nobody anything", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    game.accept({ type: "people/stand-in", pair: "pair-1", stage: "on" }, "authority");
    await renderWithGame(offline(<Head id={bond} />), game);
    expect(within(row(bond, "stage")).getByText(say("ui.people.stand-in.on", { piece: interviewName() }))).toBeDefined();
    const end = open(row(bond, "end"));
    expect(end.querySelector("summary")?.textContent).toContain(say("ui.people.head.end.nothing"));
    expect(within(end).getByText(say("ui.people.end.absence"))).toBeDefined();
  });

  test("[person:stand-in-after-absence] given a friend quiet for a week, then the head warns that a stand-in takes over at two weeks", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    game.accept({ type: "people/stand-in", pair: "pair-1", stage: "warned" }, "authority");
    await renderWithGame(offline(<Head id={bond} />), game);
    expect(within(row(bond, "stage")).getByText(say("ui.people.stand-in.warned"))).toBeDefined();
  });

  test("[person:gossip-when-two-timing] given a partner and someone else courted, then the courted head warns that people talk, at the tuning's chance", async () => {
    const game = peopleGame(eagerContent());
    partnered(game);
    const other = courted(game, "person.amaka-nurse");
    await renderWithGame(offline(<Head id={other} />), game);
    expect(within(row(other, "stage")).getByText(say("ui.people.gossip", { chance: formatBp(people.gossipBp) }))).toBeDefined();
  });

  test("[person:computer-partner-drifts] given a computer partner with no time together for a month short of its patience, then the head warns it will stop waiting; with time together it only states the rule", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI, 1);
    const patience = content.person[TOBI]!.behaviour.patienceMonths!;
    const base = game.view();
    const last = base.people.bonds.find((entry) => entry.id === bond)!.moments!.at(-1)!;
    const era = { id: "era.test" as const, since: 0, until: 100, sinceMonth: 0, untilMonth: 100 };
    const at = (month: number): PlayerView => ({ ...base, month: last.tick + month, era });
    await renderWithView(offline(<Head id={bond} />), at(patience - 1));
    const name = bondName(base.people.bonds.find((entry) => entry.id === bond)!);
    expect(within(row(bond, "stage")).getByText(sayCount("ui.people.drift.near", patience - 1, { months: patience - 1, patience, name }))).toBeDefined();
    document.body.innerHTML = "";
    await renderWithView(offline(<Head id={bond} />), at(0));
    expect(within(row(bond, "stage")).getByText(say("ui.people.drift.rule", { name, patience }))).toBeDefined();
  });

  test("[interview:one-question-at-a-time] given an interview open, then the bond's moments are hidden and the head says the player answers from memory", async () => {
    const game = interviewGame();
    const bond = Object.keys(game.state.people.bonds).find((id) => game.state.people.bonds[id]!.with.kind === "player")!;
    await renderWithGame(offline(<Head id={bond} />), game);
    const line = row(bond, "stage").querySelector("summary")!;
    expect(within(line).getByText(say("ui.people.moments.hidden", { piece: interviewName() }))).toBeDefined();
    expect(line.textContent).not.toContain(togetherWords(0));
  });

  test("[person:ended-bond-record-kept] given a bond ended, then its head is read only with no choices on it, and says when the two may start again", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI, 1);
    game.accept({ type: "people/end", bond });
    await renderWithGame(offline(<Head id={bond} />), game);
    const shown = head(bond);
    expect(shown.dataset.ended).toBeDefined();
    expect(within(shown).queryAllByRole("button")).toHaveLength(0);
    expect(shown.querySelector("[data-head-row]")).toBeNull();
    expect(within(shown).getByText(say("ui.people.ended.recourt", { months: people.recourtMonths }))).toBeDefined();
  });
});
