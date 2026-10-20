import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { PRIVACY_PATH, TERMS_PATH } from "../../shared/ui/LegalLinks";
import { say } from "../../shared/words/text";
import { GuidesMenu } from "./GuidesMenu";

describe("the terms and the privacy notice from the guides menu", () => {
  test("given the guides menu, where how the game was made is, when it is opened, then both pages are linked from it, opened beside the game", async () => {
    await renderWithView(<GuidesMenu />, engineView("scenario.graduate"));
    fireEvent.click(screen.getByRole("button", { name: say("guide.page.menu") }));
    const menu = screen.getByRole("navigation", { name: say("guide.page.menu") });
    const links = [say("ui.legal.terms"), say("ui.legal.privacy")].map((name) => {
      const link = within(menu).getByRole("link", { name });
      return { href: link.getAttribute("href"), target: link.getAttribute("target") };
    });
    expect(links).toEqual([
      { href: TERMS_PATH, target: "_blank" },
      { href: PRIVACY_PATH, target: "_blank" },
    ]);
  });
});
