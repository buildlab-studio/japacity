// The people of this life on the phone (docs/rules/world.md R-WORLD-020, R-WORLD-006, R-WORLD-018; people.md R-PEOPLE-010,
// R-PEOPLE-014, R-PEOPLE-016): once courting, a bond's Chats thread carries a head with its stage and its choices, one row
// each, and its rows send the bond's commands; Chats' People row opens the slots with the invite card. Chats as the
// shell hands it the people feature's screens, over a real life played through the engine.
import { content } from "@japacity/content";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { moderationApi } from "../../shared/moderation/api";
import { ModerationProvider } from "../../shared/moderation/ModerationProvider";
import { api } from "../../shared/net/http";
import { slotOrder } from "../../shared/sim/people";
import { BASE, fakeServer } from "../../shared/testing/server";
import { courted, eagerContent, linkedFriend, peopleGame, renderWithGame, TOBI } from "../../shared/testing/people";
import { nameOf, say, sayCount } from "../../shared/words/text";
import { Chats, PhonePeople } from "../phone/apps/Chats";
import { phoneWords } from "../phone/phone.words";
import { pairApiFor } from "./pairApi";
import { BondHead, PeopleSlots } from "./PeopleOnPhone";

const people = content.tuning.people;

function chats() {
  return (
    <PhonePeople value={{ head: (bond) => <BondHead bond={bond} api={null} />, slots: <PeopleSlots api={null} /> }}>
      <Chats />
    </PhonePeople>
  );
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
function open(element: HTMLElement): void {
  const summary = element.querySelector("summary");
  if (summary === null) throw new Error("A row with no line.");
  fireEvent.click(summary);
}

describe("the People row", () => {
  test("[R-WORLD-020] [R-PEOPLE-010] given a new life, when Chats' People row is opened, then the slots of this life show, partner, siblings, mother and father, and an empty partner slot makes the invite card behind a tap once the early win is in", async () => {
    const game = peopleGame();
    game.grant(1);
    game.endTurn([]);
    const { store, authority } = await renderWithGame(chats(), game);
    const first = document.querySelector<HTMLElement>("[data-chat-row]");
    expect(first?.dataset.chatRow).toBe("people");
    expect(within(first!).getByText(phoneWords("phone.chats.slots"))).toBeDefined();
    fireEvent.click(first!);
    const slots = document.querySelector<HTMLElement>("[data-people-slots]")!;
    expect([...slots.querySelectorAll<HTMLElement>("[data-slot]")].map((slot) => slot.dataset.slot)).toEqual(slotOrder(Object.keys(game.state.people.slots)));
    expect(slots.querySelector('[data-slot="partner"]')?.getAttribute("data-state")).toBe("empty");
    expect(slots.querySelector('[data-slot="mother"]')).not.toBeNull();
    expect(slots.querySelector('[data-slot="father"]')).not.toBeNull();
    expect(slots.querySelectorAll('[data-slot^="sibling-"]').length).toBe(Object.keys(game.state.people.slots).filter((key) => key.startsWith("sibling-")).length);
    // Never a list of strangers: no candidate is shown here.
    expect(slots.querySelector("[data-candidate]")).toBeNull();
    // An invite is an ask, so it waits for the early win (R-GUIDE-015).
    act(() => store.setState({ earlyWin: false }));
    expect(screen.queryByRole("button", { name: say("ui.people.partner.invite") })).toBeNull();
    act(() => store.setState({ earlyWin: true }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.people.partner.invite") }));
    const maker = screen.getByRole("form", { name: say("ui.people.invite.title") });
    expect(within(maker).getByText(/Japacity is a game/)).toBeDefined();
    fireEvent.click(within(maker).getByRole("button", { name: say("ui.people.invite.make") }));
    await waitFor(() => expect(document.querySelector('[data-slot="partner"]')?.getAttribute("data-state")).toBe("invited"));
    expect(authority.sent.at(-1)).toMatchObject({ type: "people/invite", slot: "partner", looking: "partner" });
    // A computer sibling offers the same card.
    expect(screen.getAllByRole("button", { name: say("ui.people.sibling.invite") }).length).toBeGreaterThan(0);
  });
});

describe("a bond's thread head", () => {
  test("[R-WORLD-020] [R-WORLD-006] given Tobi courted, when his thread is opened, then the computer mark stands by the name, its head says the stage on one row with the moments, and what can be asked waits behind its own row", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI, 1);
    await renderWithGame(chats(), game);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-chat-row="${bond}"]`)!);
    const stage = row(bond, "stage");
    const line = stage.querySelector("summary")!;
    expect(line.textContent).toContain(say("ui.people.stage.courting"));
    expect(line.textContent).toContain(sayCount("ui.people.head.moments", 1, { count: 1 }));
    // The computer mark stands beside the name over the thread.
    expect(document.querySelector('h3 [data-person-mark="computer"]')?.textContent).toBe(say("ui.people.mark.computer"));
    // The facts fold behind the row.
    expect(stage.hasAttribute("open")).toBe(false);
    const left = people.partnerMoments - 1;
    const ask = row(bond, "ask");
    expect(ask.querySelector("summary")?.textContent).toContain(sayCount("ui.people.head.moments-left", left, { count: left }));
    open(ask);
    expect(within(ask).getByText(sayCount("ui.people.courting.next", left, { count: left }))).toBeDefined();
    // The thread itself follows the head.
    expect(document.querySelector(`[data-chat="${bond}"]`)).not.toBeNull();
    expect(screen.getByRole("heading", { name: new RegExp(`^${nameOf(TOBI)}`) })).toBeDefined();
  });

  test("[R-PEOPLE-016] [R-WORLD-020] given Tobi courted to the moments partners need, when the head's ask row proposes, then people/propose goes to the engine and the head says partners", async () => {
    const game = peopleGame(eagerContent());
    const bond = courted(game, TOBI, people.partnerMoments);
    const { authority } = await renderWithGame(chats(), game);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-chat-row="${bond}"]`)!);
    open(row(bond, "ask"));
    fireEvent.click(within(row(bond, "ask")).getByRole("button", { name: say("ui.people.propose.partner") }));
    await waitFor(() => expect(row(bond, "stage").querySelector("summary")?.textContent).toContain(say("ui.people.stage.partner")));
    expect(authority.sent.at(-1)).toMatchObject({ type: "people/propose", bond, step: "partner" });
  });

  test("[R-PEOPLE-016] [R-WORLD-020] given a friend who asked to be partners, when their thread is opened, then the answer waits open at the top of the head and Yes sends people/answer", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    game.accept({ type: "people/court", with: "pair-1" });
    game.accept({ type: "people/proposal", pair: "pair-1", proposal: { step: "partner", route: null, lead: null } }, "authority");
    const { authority } = await renderWithGame(chats(), game);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-chat-row="${bond}"]`)!);
    const pending = row(bond, "pending");
    expect(pending.hasAttribute("open")).toBe(true);
    expect(pending.querySelector("summary")?.textContent).toContain(say("ui.people.head.asked.theirs"));
    expect(head(bond).querySelector('[data-head-row="ask"]')).toBeNull();
    fireEvent.click(within(pending).getByRole("button", { name: say("ui.people.answer.yes") }));
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "people/answer", bond, step: "partner", yes: true }));
  });

  test("[R-PEOPLE-035] [R-WORLD-020] given a bond courting, when the head's end row is opened, then the cost is said at once and ending it sends people/end", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI, 1);
    const { authority, store } = await renderWithGame(chats(), game);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-chat-row="${bond}"]`)!);
    const end = row(bond, "end");
    expect(end.querySelector("summary")?.textContent).toContain(say("ui.people.head.end.standing"));
    open(end);
    expect(within(end).getByText(say("ui.people.end.cost"))).toBeDefined();
    fireEvent.click(within(end).getByRole("button", { name: say("ui.people.end.confirm") }));
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "people/end", bond }));
    expect(store.getState().view?.people.bonds.find((one) => one.id === bond)?.stage).toBe("ended");
  });

  test("[R-PAIR-014] [R-WORLD-020] given a friend who plays, online, when their thread is opened, then its head carries block and report one tap away, and a computer's head carries neither", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    const computer = courted(game, TOBI);
    const server = fakeServer();
    const pairs = pairApiFor(BASE, server.fetch);
    await renderWithGame(
      <ModerationProvider api={moderationApi(api({ baseUrl: BASE, fetch: server.fetch }))}>
        <PhonePeople value={{ head: (one) => <BondHead bond={one} api={pairs} />, slots: <PeopleSlots api={pairs} /> }}>
          <Chats />
        </PhonePeople>
      </ModerationProvider>,
      game,
    );
    fireEvent.click(document.querySelector<HTMLElement>(`[data-chat-row="${bond}"]`)!);
    const moderation = head(bond).querySelector<HTMLElement>('[data-moderation="pair"]');
    expect(moderation).not.toBeNull();
    expect(within(moderation!).getByRole("button", { name: "Block" })).toBeDefined();
    expect(within(moderation!).getByRole("button", { name: "Report" })).toBeDefined();
    fireEvent.click(document.querySelector<HTMLElement>("[data-chats-back]")!);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-chat-row="${computer}"]`)!);
    expect(head(computer).querySelector("[data-moderation]")).toBeNull();
  });
});
