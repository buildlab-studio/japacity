// The invite card in the lively dress (docs/rules/pair.md R-PAIR-007, people.md R-PEOPLE-010; design page 13 section 2):
// a white card with the character's face sticker, the looking line as a sticker chip, the pressed yellow button for the
// one action and a ghost button to take the card back. What it shows and what it sends are its own tests'
// (PeopleOnPhone.test); this proves the dress and the face.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { keepPerson } from "../../authority/person";
import { LOOKS, lookForName } from "../../shared/frontdoor/looks";
import { peopleGame, renderWithGame } from "../../shared/testing/people";
import { nameOf, say } from "../../shared/words/text";
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

describe("the invite card in the lively dress", () => {
  test("[R-PAIR-007] given the card maker, when it shows, then the card is a white lively card with the character's face sticker, its looking line a sticker chip, and Make the card the one pressed yellow button", async () => {
    const { form } = await maker();
    fireEvent.change(within(form).getByLabelText(say("ui.people.invite.fill")), { target: { value: "who-codes" } });
    const card = form.querySelector<HTMLElement>("[data-invite-card]");
    expect(card?.className).toContain("lively-card");
    // No look kept on this device: the face is one of the door's looks, picked from the character's name.
    expect(card?.querySelector("[data-face-sticker]")?.getAttribute("data-face-sticker")).toBe(lookForName(nameOf("scenario.tunde")));
    expect(LOOKS.map((look) => look.id)).toContain(lookForName(nameOf("scenario.tunde")));
    expect(card?.querySelector("[data-invite-looking]")?.closest("[data-sticker-chip]")).not.toBeNull();
    const yellow = form.querySelectorAll("[data-press-button]");
    expect(yellow).toHaveLength(1);
    expect(yellow[0]?.textContent).toBe(say("ui.people.invite.make"));
  });

  test("[R-PAIR-007] [R-PEOPLE-010] given a look kept from the door and the card out, then the card wears that look's face, says it is out on a sticker chip, and Take the card back is a ghost button", async () => {
    keepPerson({ look: "chr_kemi", name: "Kemi", archetype: "developer" });
    const { form, authority } = await maker();
    expect(form.querySelector("[data-invite-card] [data-face-sticker]")?.getAttribute("data-face-sticker")).toBe("chr_kemi");
    fireEvent.click(within(form).getByRole("button", { name: say("ui.people.invite.make") }));
    await waitFor(() => expect(document.querySelector('[data-slot="partner"]')?.getAttribute("data-state")).toBe("invited"));
    expect(authority.sent.at(-1)).toMatchObject({ type: "people/invite", slot: "partner" });
    const out = document.querySelector<HTMLElement>("[data-invite-out]");
    expect(out?.querySelector("[data-invite-state='out']")?.closest("[data-sticker-chip]")?.textContent).toBe(say("ui.people.invite.out"));
    expect(out?.querySelector("[data-invite-card] [data-face-sticker]")?.getAttribute("data-face-sticker")).toBe("chr_kemi");
    const back = within(out as HTMLElement).getByRole("button", { name: say("ui.people.invite.withdraw") });
    expect(back.className).toContain("phone-ghost");
    // The slot itself is a lively card now, never the old panel.
    expect(document.querySelector('[data-slot="partner"]')?.className).toContain("lively-card");
  });
});
