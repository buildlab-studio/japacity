// The invite card in the game's look (pair:invite-card-contents, person:invite-fills-a-slot; docs/design/09-the-games-look.md section 2):
// a white card with the looking line as a sticker chip, the character's face sticker beside the maker's heading (never on
// the card, which carries no look to the friend), the pressed yellow button for the one action and a ghost button to take
// the card back. What it shows and what it sends are its own tests'
// (PeopleOnPhone.test); this proves the dress and the face.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { keepPerson } from "../../shared/front-door/person";
import { LOOKS, lookForName } from "../../shared/front-door/looks";
import { peopleGame, renderWithGame } from "../../shared/testing/person";
import { say } from "../../shared/words/text";
import { PairApiProvider } from "./pairApi";
import { PeopleSlots } from "./PeopleOnPhone";

afterEach(() => window.localStorage.clear());

async function maker() {
  const game = peopleGame();
  const rendered = await renderWithGame(
    <PairApiProvider value={null}>
      <PeopleSlots api={null} />
    </PairApiProvider>,
    game,
  );
  act(() => rendered.store.setState({ earlyWin: true }));
  fireEvent.click(screen.getByRole("button", { name: say("ui.people.partner.invite") }));
  return { ...rendered, form: screen.getByRole("form", { name: say("ui.people.invite.title") }) };
}

describe("the invite card in the game's look", () => {
  test("[pair:invite-card-contents] given the card maker, when it shows, then the character's face sticker stands beside the heading and not on the card, the card is a white look card with its looking line a sticker chip, and Make the card the one pressed yellow button", async () => {
    const { form } = await maker();
    fireEvent.change(within(form).getByLabelText(say("ui.people.invite.fill")), { target: { value: "who-codes" } });
    const card = form.querySelector<HTMLElement>("[data-invite-card]");
    expect(card?.className).toContain("look-card");
    // The card is the friend's, and no look travels with it (pair:invite-card-contents): its face is the maker's, beside the heading.
    expect(card?.querySelector("[data-face-sticker]")).toBeNull();
    const heading = within(form).getByRole("heading", { name: say("ui.people.invite.title") });
    // No look kept on this device: the face is one of the door's looks, picked from the character's name.
    expect(heading.parentElement?.querySelector("[data-face-sticker]")?.getAttribute("data-face-sticker")).toBe(lookForName(say("ui.invite.someone")));
    expect(LOOKS.map((look) => look.id)).toContain(lookForName(say("ui.invite.someone")));
    expect(card?.querySelector("[data-invite-looking]")?.closest("[data-sticker-chip]")).not.toBeNull();
    const yellow = form.querySelectorAll("[data-press-button]");
    expect(yellow).toHaveLength(1);
    expect(yellow[0]?.textContent).toBe(say("ui.people.invite.make"));
  });

  test("[pair:invite-card-contents] [account:person-kept-with-character] given the person built at the door kept on this phone, when the card maker shows, then the card names the character by its first name", async () => {
    keepPerson({ look: "person_kemi", name: "Kemi", archetype: "developer" });
    const { form } = await maker();
    const card = form.querySelector<HTMLElement>("[data-invite-card]");
    expect(card?.textContent).toContain("Kemi");
    expect(card?.textContent).not.toContain(say("ui.invite.someone"));
  });

  test("[pair:invite-card-contents] [person:invite-fills-a-slot] given a look kept from the door and the card out, then the maker wears that look's face, the card out carries none, the slot says it is out once, and Take the card back is a ghost button", async () => {
    keepPerson({ look: "person_kemi", name: "Kemi", archetype: "developer" });
    const { form, authority } = await maker();
    expect(within(form).getByRole("heading", { name: say("ui.people.invite.title") }).parentElement?.querySelector("[data-face-sticker]")?.getAttribute("data-face-sticker")).toBe("person_kemi");
    fireEvent.click(within(form).getByRole("button", { name: say("ui.people.invite.make") }));
    await waitFor(() => expect(document.querySelector('[data-slot="partner"]')?.getAttribute("data-state")).toBe("invited"));
    expect(authority.sent.at(-1)).toMatchObject({ type: "people/invite", slot: "partner" });
    const out = document.querySelector<HTMLElement>("[data-invite-out]");
    expect(out?.querySelector("[data-invite-card] [data-face-sticker]")).toBeNull();
    const slot = document.querySelector<HTMLElement>('[data-slot="partner"]');
    expect(slot?.textContent?.split(say("ui.people.invite.out")).length).toBe(2);
    const back = within(out as HTMLElement).getByRole("button", { name: say("ui.people.invite.withdraw") });
    expect(back.hasAttribute("data-ghost-button")).toBe(true);
    // The slot itself is a look card.
    expect(document.querySelector('[data-slot="partner"]')?.className).toContain("look-card");
  });
});
