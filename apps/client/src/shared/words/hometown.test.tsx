// Lines from home name where the life is from (prologue.md R-PROLOGUE-002, amended 11 Oct 2026; the decision of
// 14:47): content's `{hometown}` is filled from the view of the life on screen, so one line serves every hometown, and
// no line ever shows its brace.
import { content, HOMETOWN_FILL, text } from "@japacity/content";
import { afterEach, describe, expect, test } from "vitest";

import { PeopleView } from "../../features/people/PeopleView";
import { engineView } from "../testing/fixtures";
import { renderWithView } from "../testing/render";
import { setNow } from "./now";
import { blurbOf, hometownWords, nameOf, say, words } from "./text";
import { uiText } from "./ui";

afterEach(() => {
  setNow(null);
});

/** Every line in content's tables and the interface's own that names where the life is from. */
function hometownKeys(): string[] {
  return Object.entries({ ...text, ...uiText })
    .filter(([, line]) => line.includes(`{${HOMETOWN_FILL}}`))
    .map(([key]) => key)
    .sort();
}

describe("lines from home", () => {
  test("[R-PROLOGUE-002] given a life from Enugu on screen, when Mama's ask, Papa's, the parents on the People screen and the sibling at home are said, then each names Enugu; an explicit town wins; with no life on screen they say your hometown", () => {
    setNow(4, "hometown.enugu");
    expect(hometownWords()).toBe("Enugu");
    expect(words("offer.roof.body", { cost: 4500000 })).toMatch(/^Mama calls from Enugu: 'Rain entered the parlour again\. The carpenter wants ₦45,000 for zinc and labour\.'$/);
    expect(words("offer.nepa-bill.body", { cost: 1800000 })).toContain("Mama, on the phone from Enugu:");
    expect(words("offer.uncle-burial.body", { cost: 5000000 })).toMatch(/^Your father, from Enugu: 'The family is contributing/);
    expect(say("ui.people.parent.blurb.mother")).toBe("In Enugu, as she has always been. She calls when there is news.");
    expect(nameOf("person.sib-home")).toBe("Your sibling in Enugu");
    expect(blurbOf("person.sib-home")).toBe("Still in Enugu, still in the family's business, still asking how far.");
    expect(say("ui.page.family.in", { hometown: "Kano" })).toBe("Family in Kano");
    setNow(null);
    expect(say("ui.people.parent.blurb.father")).toBe("In your hometown, as he has always been. He calls when there is news.");
    expect(nameOf("person.sib-home")).toBe("Your sibling in your hometown");
  });

  test("[R-PROLOGUE-002] given every line that names where the life is from, when it is said for every hometown in content, then no brace is left and the town's own name stands in it; the lines are the ones decided on 11 Oct 2026", () => {
    const keys = hometownKeys();
    expect(keys).toEqual(
      [
        "activity.call-home.blurb",
        "line.prologue.drawn",
        "offer.harvest.body",
        "offer.mum-shop.body",
        "offer.nepa-bill.body",
        "offer.roof.body",
        "offer.uncle-burial.body",
        "person.sib-home.blurb",
        "person.sib-home.name",
        "ui.page.family.in",
        "ui.people.parent.blurb.father",
        "ui.people.parent.blurb.mother",
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

  test("[R-PROLOGUE-002] given Ada's life, from Enugu, on the People screen, then her mother and father are in Enugu, as the view names it", async () => {
    const view = engineView("scenario.ada");
    expect(view.hometown).toBe("hometown.enugu");
    await renderWithView(<PeopleView />, view);
    expect(document.body.textContent).toContain(say("ui.people.parent.blurb.mother"));
    expect(document.body.textContent).toContain("In Enugu, as she has always been.");
    expect(document.body.textContent).not.toContain("{hometown}");
  });
});
