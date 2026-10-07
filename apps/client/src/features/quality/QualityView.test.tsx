import { content, text } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
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
});
