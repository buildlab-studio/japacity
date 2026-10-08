import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { text } from "@japacity/content";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { GuidesMenu } from "../guides/GuidesMenu";
import { AccountGate } from "./AccountGate";
import { LEGAL_LINKS, PRIVACY_PATH, TERMS_PATH } from "./LegalLinks";
import { AccountSettings } from "./Settings";
import { TEST_SITE_KEY, type LoadTurnstile } from "./Turnstile";

const PUBLIC = join(process.cwd(), "apps/client/public");
const OK: AuthResult = { ok: true };

function publicFile(href: string): string {
  return `${PUBLIC}${href}`;
}

function account(): AccountApi {
  const ok = () => Promise.resolve(OK);
  return {
    ageStatus: () => Promise.resolve("passed"),
    declareAge: () => Promise.resolve("passed"),
    sendCode: ok,
    signInWithCode: ok,
    signInWithGoogle: ok,
    signInWithPasskey: ok,
    addPasskey: ok,
    email: () => Promise.resolve("ada@example.test"),
    deleteAccount: ok,
    signOut: () => Promise.resolve(),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: () => Promise.resolve(true),
  };
}

const noTurnstile: LoadTurnstile = () => Promise.resolve({ render: () => "widget", reset: () => undefined, remove: () => undefined });

function storeFor(api: AccountApi) {
  return createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account: api });
}

function expectBothLinks(scope: HTMLElement) {
  const terms = within(scope).getByRole("link", { name: say("ui.legal.terms") });
  const privacy = within(scope).getByRole("link", { name: say("ui.legal.privacy") });
  expect(terms.getAttribute("href")).toBe(TERMS_PATH);
  expect(privacy.getAttribute("href")).toBe(PRIVACY_PATH);
  for (const link of [terms, privacy]) expect(link.getAttribute("target")).toBe("_blank");
}

describe("the terms and the privacy notice", () => {
  test("given each link, when its path is looked up in the client's public folder, then a page is there with its own title", () => {
    for (const link of LEGAL_LINKS) {
      const file = publicFile(link.href);
      expect(existsSync(file), link.href).toBe(true);
      const page = readFileSync(file, "utf8");
      expect(page).toContain(`<title>${say(link.words)}</title>`);
      expect(page).toContain('<meta name="viewport"');
    }
  });

  test("given the two pages, when they are read, then each links to the other and back to the game", () => {
    const terms = readFileSync(publicFile(TERMS_PATH), "utf8");
    const privacy = readFileSync(publicFile(PRIVACY_PATH), "utf8");
    expect(terms).toContain(`href="${PRIVACY_PATH}"`);
    expect(privacy).toContain(`href="${TERMS_PATH}"`);
    for (const page of [terms, privacy]) expect(page).toContain('href="/"');
  });

  test("given the terms, when they are read, then they carry the notice on real names in the about page's own words", () => {
    const terms = readFileSync(publicFile(TERMS_PATH), "utf8");
    expect(terms).toContain(text["guide.page.about.names"]);
  });

  test("given the sign-in screen, when it shows, then both pages are linked from it", async () => {
    const store = storeFor(account());
    store.getState().leave(null);
    render(
      <GameProvider store={store}>
        <AccountGate load={noTurnstile} sitekey={TEST_SITE_KEY} />
      </GameProvider>,
    );
    await screen.findByRole("button", { name: say("ui.account.google") });
    expectBothLinks(document.body);
  });

  test("given the settings sheet, when it shows, then both pages are linked from it", () => {
    const api = account();
    render(
      <GameProvider store={storeFor(api)}>
        <AccountSettings account={api} />
      </GameProvider>,
    );
    expectBothLinks(document.body);
  });

  test("given the guides menu, where the credits and how the game was made are, when it is opened, then both pages are linked from it", async () => {
    await renderWithView(<GuidesMenu />, engineView("scenario.ada"));
    fireEvent.click(screen.getByRole("button", { name: say("guide.page.menu") }));
    expectBothLinks(screen.getByRole("navigation", { name: say("guide.page.menu") }));
  });
});
