// A bond's parts in the lively dress (person:proposing-a-step, person:view-shows-people; design page 09 section 2): the
// person's face sticker over what is known of them, the mark and the facts as sticker chips, what waits on a white card,
// the pressed yellow button for the one action and ghost buttons for the rest. What each part says and sends is
// PeopleOnPhone.test's; this proves the dress and the face.
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { useView } from "../../authority/GameProvider";
import { lookForName } from "../../shared/frontdoor/looks";
import { bondName } from "../../shared/sim/person";
import { courted, eagerContent, linkedFriend, partnered, peopleGame, renderWithGame, TOBI } from "../../shared/testing/person";
import { say } from "../../shared/words/text";
import { PairApiProvider } from "./pairApi";
import { BondHead, PeopleSlots } from "./PeopleOnPhone";

function Head({ id }: { id: string }) {
  const view = useView();
  const bond = view.people.bonds.find((one) => one.id === id);
  return bond === undefined ? null : <BondHead bond={bond} api={null} />;
}

const offline = (ui: React.ReactElement) => <PairApiProvider value={null}>{ui}</PairApiProvider>;

function row(bond: string, id: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-bond-head="${bond}"] [data-head-row="${id}"]`);
  if (found === null) throw new Error(`No row ${id}.`);
  if (!found.hasAttribute("open")) fireEvent.click(found.querySelector("summary") as HTMLElement);
  return found;
}

describe("a bond in the lively dress", () => {
  test("[person:view-shows-people] given a computer partner courted, when the head's stage row opens, then the facts stand under the person's face sticker, picked from their name, each fact a sticker chip", async () => {
    const game = peopleGame();
    const bond = courted(game, TOBI);
    await renderWithGame(offline(<Head id={bond} />), game);
    const facts = row(bond, "stage").querySelector<HTMLElement>("[data-bond-facts]");
    const held = game.view().people.bonds.find((one) => one.id === bond);
    expect(held).toBeDefined();
    expect(facts?.querySelector("[data-face-sticker]")?.getAttribute("data-face-sticker")).toBe(lookForName(bondName(held!)));
    const chips = [...(facts?.querySelectorAll("li") ?? [])];
    expect(chips.length).toBeGreaterThan(2);
    for (const chip of chips) expect(chip.className).toContain("sticker-chip");
  });

  test("[person:proposing-a-step] given the moments partners need, when the ask row opens, then asking is the one pressed yellow button, and once partners marrying is yellow and applying together a ghost beside it", async () => {
    const game = peopleGame(eagerContent());
    const bond = courted(game, TOBI, game.content.tuning.people.partnerMoments);
    await renderWithGame(offline(<Head id={bond} />), game);
    const ask = row(bond, "ask");
    const yellow = ask.querySelectorAll("[data-press-button]");
    expect(yellow).toHaveLength(1);
    expect(yellow[0]?.textContent).toBe(say("ui.people.propose.partner"));

    document.body.innerHTML = "";
    const together = peopleGame(eagerContent());
    const partners = partnered(together);
    await renderWithGame(offline(<Head id={partners} />), together);
    const next = row(partners, "ask");
    expect([...next.querySelectorAll("[data-press-button]")].map((button) => button.textContent)).toEqual([say("ui.people.propose.marry")]);
    const joint = within(next).getByRole("button", { name: say("ui.people.propose.joint") });
    expect(joint.className).toContain("phone-ghost");
  });

  test("[person:proposing-a-step] [person:ender-pays-in-standing] given a friend's question waiting and the end row opened, then the question sits on a white card with yes as the one yellow button and no a ghost, and ending says its cost on a white card with ghost buttons only", async () => {
    const game = peopleGame();
    const bond = linkedFriend(game);
    game.accept({ type: "people/court", with: bond });
    game.accept({ type: "people/proposal", pair: "pair-1", proposal: { step: "partner", route: null, lead: null } }, "authority");
    await renderWithGame(offline(<Head id={bond} />), game);
    const pending = row(bond, "pending").querySelector<HTMLElement>("[data-bond-pending]");
    expect(pending?.className).toContain("lively-card");
    expect([...(pending?.querySelectorAll("[data-press-button]") ?? [])].map((button) => button.textContent)).toEqual([say("ui.people.answer.yes")]);
    expect(within(pending as HTMLElement).getByRole("button", { name: say("ui.people.answer.no") }).className).toContain("phone-ghost");
    const end = row(bond, "end").querySelector<HTMLElement>("[data-bond-end]");
    expect(end?.className).toContain("lively-card");
    expect(end?.querySelectorAll("[data-press-button]")).toHaveLength(0);
    for (const button of within(end as HTMLElement).getAllByRole("button")) expect(button.className).toContain("phone-ghost");
  });

  test("[person:view-shows-people] given the People row, when a computer sibling and a parent show, then each slot is a lively card with the person's face sticker, and the quiet mark is a sticker chip", async () => {
    const game = peopleGame();
    if (game.state.turn.banked === 0) game.grant(1);
    game.endTurn([]);
    await renderWithGame(offline(<PeopleSlots api={null} />), game);
    const mother = document.querySelector<HTMLElement>('[data-slot="mother"]');
    expect(mother?.className).toContain("lively-card");
    const sibling = document.querySelector<HTMLElement>('[data-slot^="sibling-"][data-state="computer"]');
    expect(sibling?.className).toContain("lively-card");
    expect(sibling?.querySelector("[data-face-sticker]")).not.toBeNull();
    expect(sibling?.querySelector("[data-mark-label='computer'] [data-sticker-chip]")).not.toBeNull();
  });
});
