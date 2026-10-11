import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { engineView } from "../../shared/testing/fixtures";
import { PRIVACY_PATH, TERMS_PATH } from "../../shared/ui/LegalLinks";
import { say } from "../../shared/words/text";
import { AccountGate } from "./AccountGate";
import { AccountSettings } from "./Settings";
import { TEST_SITE_KEY, type LoadTurnstile } from "./Turnstile";

const OK: AuthResult = { ok: true };

function account(): AccountApi {
  const ok = () => Promise.resolve(OK);
  return {
    ageStatus: () => Promise.resolve("unasked"),
    declareAge: () => Promise.resolve("passed"),
    sendCode: ok,
    signInWithCode: ok,
    startGuest: () => Promise.resolve({ ok: true }),
    view: () => Promise.resolve(null),
    rename: () => Promise.resolve({ ok: true }),
    signInWithGoogle: ok,
    returnedFromGoogle: () => null,
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

/** Each link's address and where it opens, as found in `scope`. */
function legalLinks(scope: HTMLElement): { href: string | null; target: string | null }[] {
  return [say("ui.legal.terms"), say("ui.legal.privacy")].map((name) => {
    const link = within(scope).getByRole("link", { name });
    return { href: link.getAttribute("href"), target: link.getAttribute("target") };
  });
}

const BOTH = [
  { href: TERMS_PATH, target: "_blank" },
  { href: PRIVACY_PATH, target: "_blank" },
];

describe("the terms and the privacy notice from the account screens", () => {
  test("given the start screen, when it shows, then both pages are linked from it, opened beside the game", async () => {
    const store = storeFor(account());
    store.getState().leave(null);
    render(
      <GameProvider store={store}>
        <AccountGate load={noTurnstile} sitekey={TEST_SITE_KEY} />
      </GameProvider>,
    );
    await screen.findByRole("button", { name: say("ui.account.start.play") });
    expect(legalLinks(document.body)).toEqual(BOTH);
  });

  test("given the settings sheet, when it shows, then both pages are linked from it, opened beside the game", () => {
    const api = account();
    const { container } = render(
      <GameProvider store={storeFor(api)}>
        <AccountSettings account={api} />
      </GameProvider>,
    );
    expect(legalLinks(container)).toEqual(BOTH);
  });

  test("[R-CITY-021] given the settings sheet and the Credits row the shell hands in, when it shows, then the row stands just above the two pages", () => {
    const api = account();
    const { container } = render(
      <GameProvider store={storeFor(api)}>
        <AccountSettings account={api} credits={<button type="button">Credits</button>} />
      </GameProvider>,
    );
    const row = within(container).getByRole("button", { name: "Credits" });
    expect(row.nextElementSibling?.getAttribute("aria-label")).toBe(say("ui.legal.label"));
  });
});
