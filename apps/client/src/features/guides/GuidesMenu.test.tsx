import { content } from "@japacity/content";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { createGameStore } from "../../authority/store";
import { engineView, fakeAuthority, richView } from "../../shared/testing/fixtures";
import { found, renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { App } from "../../App";
import { GuidesMenu } from "./GuidesMenu";
import { guidePath, MADE_PATH } from "./paths";

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: say("guide.page.menu") }));
}

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

  test("[R-GUIDE-011] given the menu, when it is opened, then how the game was made is reachable, and no link leads to a credits or sources page", async () => {
    await renderWithView(<GuidesMenu />, engineView("scenario.ada"));
    openMenu();
    expect(screen.getByRole("link", { name: say("guide.page.made") }).getAttribute("href")).toBe(MADE_PATH);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.filter((href) => href.startsWith("/guides/credits") || href.startsWith("/guides/sources"))).toEqual([]);
  });

  test("[R-GUIDE-005] given a life in play in the world, when the phone's Settings opens, then the guides menu is under About the game, beside the credits, and opens every guide", async () => {
    const store = createGameStore(fakeAuthority(engineView("scenario.ada")));
    await store.getState().refresh();
    render(<App store={store} />);
    // The world is the game (R-WORLD-001): the old page's header is gone, and the guides sit in the phone's Settings.
    fireEvent.click(await waitFor(() => found("[data-thumb='phone']"), { timeout: 10_000 }));
    fireEvent.click(await waitFor(() => found('[data-app="settings"]')));
    const menu = await screen.findByRole("button", { name: say("guide.page.menu") });
    expect(menu.closest("[data-about]")).not.toBeNull();
    openMenu();
    for (const id of Object.keys(content.guide)) expect(screen.getByRole("link", { name: say(`${id}.title`) }).getAttribute("href")).toBe(guidePath(id));
  });
});
