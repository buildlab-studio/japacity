import { content } from "@japacity/content";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { createGameStore } from "../../authority/store";
import { engineView, fakeAuthority, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { App } from "../../App";
import { GuidesMenu } from "./GuidesMenu";
import { CREDITS_PATH, guidePath, MADE_PATH, SOURCES_PATH } from "./paths";
import { onTheClassicPage } from "../../shared/testing/classic";

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: say("guide.page.menu") }));
}

// The old month page these tests drive opens only with ?classic (R-WORLD-024).
onTheClassicPage();

describe("the guides from the game", () => {
  test("[R-GUIDE-005] given a life in play, when the menu is opened, then every guide links to its page, opened beside the game", async () => {
    await renderWithView(<GuidesMenu />, engineView("scenario.ada"));
    openMenu();
    for (const id of Object.keys(content.guide)) {
      const link = screen.getByRole("link", { name: say(`${id}.title`) });
      expect(link.getAttribute("href")).toBe(guidePath(id));
      expect(link.getAttribute("target")).toBe("_blank");
    }
  });

  test("[R-GUIDE-005] given a life aiming at a route, when the menu is opened, then the route's own guide comes first", async () => {
    await renderWithView(<GuidesMenu />, richView());
    openMenu();
    const first = screen.getAllByRole("link")[0];
    expect(first?.getAttribute("href")).toBe(guidePath("guide.uk-masters"));
    expect(first?.textContent).toContain(say("guide.page.route-link"));
  });

  test("[R-GUIDE-008] given the menu, when it is opened, then the credits, the sources and how the game was made are reachable", async () => {
    await renderWithView(<GuidesMenu />, engineView("scenario.ada"));
    openMenu();
    expect(screen.getByRole("link", { name: say("guide.page.credits") }).getAttribute("href")).toBe(CREDITS_PATH);
    expect(screen.getByRole("link", { name: say("guide.page.sources-page") }).getAttribute("href")).toBe(SOURCES_PATH);
    expect(screen.getByRole("link", { name: say("guide.page.made") }).getAttribute("href")).toBe(MADE_PATH);
  });

  test("[R-GUIDE-005] given the game's header, when a life is in play, then the guides menu is in it", async () => {
    const store = createGameStore(fakeAuthority(engineView("scenario.ada")));
    render(<App store={store} />);
    expect(await screen.findByRole("button", { name: say("guide.page.menu") })).toBeDefined();
  });
});
