import { content, text } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { QualityView } from "./QualityView";

describe("the profile", () => {
  test("given a new life, then every shown quality is named from content and hidden ones are not", async () => {
    const view = engineView();
    await renderWithView(<QualityView />, view);
    const onScreen = view.qualities.filter(({ id }) => screen.queryByText(text[`${id}.name`]!) !== null).map(({ id }) => id);
    const shown = view.qualities.filter(({ id }) => content.quality[id]?.shown === true).map(({ id }) => id);
    expect(onScreen).toEqual(shown);
  });

  test("given a level content names, then the name is shown instead of the number", async () => {
    const view = engineView();
    await renderWithView(<QualityView />, view);
    const level = view.qualities.find((quality) => quality.id === "quality.edu-level")!;
    expect(screen.getByText(text[`quality.edu-level.value.${String(level.value)}`]!)).toBeDefined();
  });

  test("given a life at home, then the qualities that count abroad and sit at nothing wait in one closed group", async () => {
    const view = engineView();
    await renderWithView(<QualityView />, view);
    const later = document.querySelector("details[data-later]");
    if (!(later instanceof HTMLDetailsElement)) throw new Error("There is no later group.");
    expect(later.open).toBe(false);
    expect(later.textContent).toContain(say("ui.profile.later"));
    for (const id of ["quality.credit-mark", "quality.care"] as const) expect(later.textContent).toContain(text[`${id}.name`]!);
    expect(later.textContent).not.toContain(text["quality.english.name"]!);
  });

  test("given an abroad quality that has moved at home, then it shows with the rest", async () => {
    const view = engineView();
    const qualities = view.qualities.map((quality) => (quality.id === "quality.land" ? { ...quality, value: 1 } : quality));
    await renderWithView(<QualityView />, { ...view, qualities });
    const later = document.querySelector("details[data-later]");
    expect(later?.textContent ?? "").not.toContain(text["quality.land.name"]!);
    expect(screen.getByText(text["quality.land.name"]!)).toBeDefined();
  });
});
