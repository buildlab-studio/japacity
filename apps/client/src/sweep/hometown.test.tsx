// Lines from home name where the life is from (prologue.md R-PROLOGUE-002): content's `{hometown}` is filled from the view of the life on screen, so one line serves every hometown, and
// no line ever shows its brace.
import { content, HOMETOWN_FILL, text } from "@japacity/content";
import { afterEach, describe, expect, test } from "vitest";

import { PairApiProvider } from "../features/person/pairApi";
import { PeopleSlots } from "../features/person/PeopleOnPhone";
import { engineView } from "../shared/testing/fixtures";
import { renderWithView } from "../shared/testing/render";
import { setNow } from "../shared/words/now";
import { blurbOf, hometownWords, nameOf, say, words } from "../shared/words/text";

afterEach(() => {
  setNow(null);
});

/** Every line in content's tables, the interface's own among them, that names where the life is from. */
function hometownKeys(): string[] {
  return Object.entries(text)
    .filter(([, line]) => line.includes(`{${HOMETOWN_FILL}}`))
    .map(([key]) => key)
    .sort();
}

describe("lines from home", () => {
  test("[R-PROLOGUE-002] given a life from Enugu on screen, when the wider family's asks, the sibling who stayed and the opening card are said, then each names Enugu, while Mama's own asks and the parents stay at home in Lagos; an explicit town wins; with no life on screen they say your hometown", () => {
    setNow(4, "hometown.enugu");
    expect(hometownWords()).toBe("Enugu");
    // Who asks stands in the ask's name pill, and the line is theirs alone.
    expect([say("offer.roof.who"), words("offer.roof.body", { cost: 4500000 })]).toEqual(["Papa", "“Rain entered the roof of the house in Enugu, and the carpenter wants ₦45,000 for zinc and labour.”"]);
    expect(say("offer.harvest.who")).toBe("Your uncle");
    expect(words("offer.harvest.body", { cost: 1500000 })).toMatch(/^“They are calling families by name at the harvest in Enugu,/);
    expect(say("offer.uncle-burial.who")).toBe("Papa");
    expect(words("offer.uncle-burial.body", { cost: 5000000 })).toMatch(/^“The family in Enugu is contributing for the burial,/);
    expect(say("ui.prologue.town.city")).toBe("Your family is from Enugu, a city.");
    expect(nameOf("person.sib-home")).toBe("Your sibling in Enugu");
    expect(blurbOf("person.sib-home")).toBe("Still in Enugu, still in the family's business, still asking how far.");
    // Mama and Papa live in the family's Lagos house: their own asks and the People screen say home, never the town.
    expect(words("offer.nepa-bill.body", { cost: 1800000 })).toMatch(/^“They want ₦18,000 or they cut the light, and your father says he will handle it o\.”$/);
    expect(words("offer.mum-shop.body", { cost: 1800000 })).toMatch(/^“The supplier has stopped my credit/);
    for (const key of ["offer.nepa-bill.body", "offer.mum-shop.body"]) expect(words(key, { cost: 1800000 })).not.toContain("Enugu");
    expect(say("ui.people.parent.blurb.mother")).toBe("At home, as she has always been. She calls when there is news.");
    expect(blurbOf("activity.call-home")).toBe("You call your mother and listen to all of it.");
    // The card's title is where the family is from, its place of origin, never "Family in".
    expect(say("ui.page.family.from", { hometown: "Kano" })).toBe("Family from Kano");
    // The family there is the wider family: the hometown's events never put Mama in the town.
    expect(words("offer.harvest.said.give", {})).toBe("You gave to the harvest. The family's name was called, and your uncle stood up for all of you.");
    expect(words("offer.roof.said.pay", {})).toBe("You paid for the roof. The house back home stayed dry, and your father told everyone who paid.");
    expect(words("offer.roof.said.no", {})).toBe("You told your father you could not pay for the roof. The rain came into the house back home again.");
    setNow(null);
    expect(nameOf("person.sib-home")).toBe("Your sibling in your hometown");
  });

  test("[R-PROLOGUE-002] given every line that names where the life is from, when it is said for every hometown in content, then no brace is left and the town's own name stands in it, in the lines content holds", () => {
    const keys = hometownKeys();
    expect(keys).toEqual(
      [
        "line.prologue.drawn",
        "offer.harvest.body",
        "offer.roof.body",
        "offer.uncle-burial.body",
        "person.sib-home.blurb",
        "person.sib-home.name",
        "ui.page.family.from",
        "ui.prologue.town.city",
        "ui.prologue.town.town",
      ].sort(),
    );
    const { city, town, byHome } = content.tuning.prologue.hometowns;
    for (const hometown of [...city, ...town, ...Object.values(byHome)]) {
      setNow(1, hometown);
      const name = text[`${hometown}.name`]!;
      for (const key of keys) {
        const said = words(key, { cost: 100000, siblings: 2 });
        expect(said).not.toContain("{");
        expect(said).toContain(name);
      }
    }
  });

  test("[R-PROLOGUE-002] given Ada's life, from Enugu, on the People screen, then her mother and father are at home in Lagos, and no brace shows", async () => {
    const view = engineView("scenario.ada");
    expect(view.hometown).toBe("hometown.enugu");
    // Chats' People row, the slots.
    await renderWithView(
      <PairApiProvider value={null}>
        <PeopleSlots api={null} />
      </PairApiProvider>,
      view,
    );
    expect(document.querySelector('[data-slot="mother"]')?.textContent).toContain("At home, as she has always been.");
    expect(document.body.textContent).toContain("At home, as she has always been.");
    expect(document.body.textContent).not.toContain("{hometown}");
  });
});
