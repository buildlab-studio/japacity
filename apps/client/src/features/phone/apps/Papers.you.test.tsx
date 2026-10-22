// The person in Papers, as content names them: every quality marked shown is named
// from content and the hidden ones are not, a level content names reads as its name, and at home the qualities that
// count abroad wait folded while they sit at nothing.
import { content, text } from "@japacity/content";
import { within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../../shared/testing/fixtures";
import { say } from "../../../shared/words/text";
import { openPapers } from "../phone.testing";

function you(): HTMLElement {
  const section = document.querySelector<HTMLElement>("[data-papers-you]");
  if (section === null) throw new Error("No person in Papers.");
  return section;
}

describe("the person, in Papers", () => {
  test("given a new life, then every shown quality is named from content and hidden ones are not", async () => {
    const view = engineView();
    await openPapers(view);
    const onScreen = view.qualities.filter(({ id }) => within(you()).queryByText(text[`${id}.name`]!) !== null).map(({ id }) => id);
    const shown = view.qualities.filter(({ id }) => content.quality[id]?.shown === true).map(({ id }) => id);
    expect(onScreen).toEqual(shown);
  });

  test("given a level content names, then the name is shown instead of the number", async () => {
    const view = engineView();
    await openPapers(view);
    const level = view.qualities.find((quality) => quality.id === "quality.education-level")!;
    expect(within(you()).getByText(text[`quality.education-level.value.${String(level.value)}`]!)).toBeDefined();
  });

  test("given a life at home, then the qualities that count abroad and sit at nothing wait in one closed group", async () => {
    await openPapers(engineView());
    const later = you().querySelector("details[data-later]");
    if (!(later instanceof HTMLDetailsElement)) throw new Error("There is no later group.");
    expect(later.open).toBe(false);
    expect(later.textContent).toContain(say("ui.profile.later"));
    for (const id of ["quality.credit-mark", "quality.care"] as const) expect(later.textContent).toContain(text[`${id}.name`]!);
    expect(later.textContent).not.toContain(text["quality.english.name"]!);
  });

  test("given an abroad quality that has moved at home, then it shows with the rest", async () => {
    const view = engineView();
    const qualities = view.qualities.map((quality) => (quality.id === "quality.land" ? { ...quality, value: 1 } : quality));
    await openPapers({ ...view, qualities });
    const later = you().querySelector("details[data-later]");
    expect(later?.textContent ?? "").not.toContain(text["quality.land.name"]!);
    expect(within(you()).getByText(text["quality.land.name"]!)).toBeDefined();
  });
});
