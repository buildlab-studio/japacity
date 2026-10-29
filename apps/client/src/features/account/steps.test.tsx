// The account sheet says one thing at a time (world:one-action-one-sheet, world:sheets-one-frame): a step takes the body as
// its own view with one Back, its heading taking the focus, and a refusal goes with its step; the sheet stands in three blocks
// and a quiet foot (account:passkeys-listed-and-removed, analytics:player-can-stop-usage-counts); a guest's sheet keeps its
// reminder and its two labelled rows, with the username's change behind a quiet link (account:username-and-unconfirmed-email).
import type { AccountView } from "@japacity/api";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import type { AccountApi } from "../../shared/net/auth";
import { engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { loadLaterWords } from "../../shared/words/later";
import { say } from "../../shared/words/text";
import { codeAccount } from "./code.testing";
import { AccountSettings } from "./Settings";

// The account sheet's words ride a chunk of their own (engine:first-download-has-budget): added before the sheet is drawn, as its row adds them before it opens.
beforeAll(() => loadLaterWords("sheet"));

function me(state: AccountView["state"], over: Partial<AccountView> = {}): AccountView {
  return { id: "account-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1", sendUsageCounts: true, admin: false, state, username: "ada_lagos", renameFrom: 0, ways: state === "guest" ? { google: null, email: null, passkeys: 0 } : { google: null, email: "ada@example.com", passkeys: 0 }, ...over };
}

async function sheet(view: AccountView, over: Partial<AccountApi> = {}): Promise<void> {
  const account = codeAccount({ view: () => Promise.resolve(view), ...over });
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
  await store.getState().refresh();
  render(
    <GameProvider store={store}>
      <AccountSettings account={account} />
    </GameProvider>,
  );
  await screen.findByText(say("ui.account.name.current", { name: view.username }));
}

const blocks = () => [...document.querySelectorAll("[data-block]")].map((block) => block.getAttribute("data-block"));

describe("a step takes the body (world:one-action-one-sheet, world:sheets-one-frame)", () => {
  test("[world:one-action-one-sheet] [account:username-and-unconfirmed-email] given Change it pressed, then the change takes the body as its own view: the rows are gone, one Back, and its heading takes the focus; Back brings the sheet back with the focus on Change it", async () => {
    await sheet(me("secured"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.change") }));
    const heading = screen.getByRole("heading", { name: say("ui.account.name.step") });
    expect(document.activeElement).toBe(heading);
    expect(blocks()).toEqual([]);
    expect(screen.queryByRole("button", { name: say("ui.account.sign-out") })).toBeNull();
    expect(screen.getAllByRole("button", { name: say("ui.account.back") })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.back") }));
    expect(blocks()).toEqual(["you", "passkeys", "leaving"]);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: say("ui.account.name.change") })));
  });

  test("[world:one-action-one-sheet] [account:username-and-unconfirmed-email] given a new name refused, when the step is left and opened again, then the refusal went with it", async () => {
    await sheet(me("secured"), { rename: () => Promise.resolve({ ok: false, why: "taken" }) });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.change") }));
    fireEvent.change(screen.getByLabelText(say("ui.account.name.label")), { target: { value: "ada_ibadan" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.change.go") }));
    expect(await screen.findByText(say("ui.account.name.taken"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.back") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.change") }));
    expect(screen.queryByText(say("ui.account.name.taken"))).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("[world:one-action-one-sheet] [account:player-deletes-account] given Delete my account pressed, then the deletion takes the body as its own view under its heading, and Keep my account brings the sheet back", async () => {
    await sheet(me("secured"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.delete") }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: say("ui.account.delete") }));
    expect(blocks()).toEqual([]);
    expect(screen.getByText(say("ui.account.delete.warn"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.delete.keep") }));
    expect(blocks()).toEqual(["you", "passkeys", "leaving"]);
    expect(screen.queryByText(say("ui.account.delete.warn"))).toBeNull();
  });

  test("[world:one-action-one-sheet] given a question asked in place, when a step is opened, then the question is gone when the sheet comes back: one thing open at a time", async () => {
    await sheet(me("secured"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.sign-out.all") }));
    expect(screen.getByText(say("ui.account.sign-out.all.warn"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.change") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.back") }));
    expect(screen.queryByText(say("ui.account.sign-out.all.warn"))).toBeNull();
    expect(screen.getByRole("button", { name: say("ui.account.sign-out.all") })).toBeDefined();
  });
});

describe("the guest's sheet (account:guest-and-secured-states, account:username-and-unconfirmed-email)", () => {
  test("[account:username-and-unconfirmed-email] given a guest's sheet, then the username is a row with Change it as a quiet link, and Your first change is free shows only inside the change's step", async () => {
    await sheet(me("guest"));
    const change = screen.getByRole("button", { name: say("ui.account.name.change") });
    expect(change.className).toContain("underline");
    expect(change.className).not.toContain("bg-accent");
    expect(change.closest("[data-username]")?.textContent).toContain(say("ui.account.name.label"));
    expect(screen.queryByText(say("ui.account.name.free"))).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(change);
    expect(screen.getByText(say("ui.account.name.free"))).toBeDefined();
    expect(screen.getByRole("textbox", { name: say("ui.account.name.label") })).toBeDefined();
  });

  test("[account:guest-reminded-to-secure] [account:guest-and-secured-states] given a guest's sheet, then the reminder heads it, then the you block and the leaving block with its one row, and no passkeys", async () => {
    await sheet(me("guest"));
    const reminder = screen.getByText(say("ui.guest.reminder"));
    const you = document.querySelector('[data-block="you"]') as HTMLElement;
    expect(reminder.compareDocumentPosition(you) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(blocks()).toEqual(["you", "leaving"]);
    const leaving = document.querySelector('[data-block="leaving"]') as HTMLElement;
    expect(within(leaving).getAllByRole("button").map((button) => button.textContent)).toEqual([say("ui.account.delete")]);
  });
});

describe("the saved account's sheet (account:passkeys-listed-and-removed, analytics:player-can-stop-usage-counts)", () => {
  test("[account:passkeys-listed-and-removed] [account:sign-out-ends-the-session] given a saved life's sheet, then it stands in three blocks, you, passkeys and leaving, with the usage counts and the legal links in a quiet foot after them", async () => {
    await sheet(me("secured"));
    expect(blocks()).toEqual(["you", "passkeys", "leaving"]);
    const foot = document.querySelector("[data-quiet-foot]") as HTMLElement;
    const leaving = document.querySelector('[data-block="leaving"]') as HTMLElement;
    expect(leaving.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(foot).getByRole("checkbox", { name: say("ui.account.usage") })).toBeDefined();
    expect(within(foot).getByRole("navigation", { name: say("ui.legal.label") })).toBeDefined();
    expect(within(leaving).getByRole("button", { name: say("ui.account.sign-out") })).toBeDefined();
    expect(within(leaving).getByRole("button", { name: say("ui.account.delete") })).toBeDefined();
  });

  test("[analytics:player-can-stop-usage-counts] given the usage counts in the foot, then the setting stands and its help folds behind a quiet What is this?, which opens it and closes it", async () => {
    await sheet(me("secured"));
    const box = screen.getByRole("checkbox", { name: say("ui.account.usage") });
    expect(box).toBeDefined();
    const help = document.querySelector<HTMLElement>("[data-usage-help]");
    expect(help?.hidden).toBe(true);
    const what = screen.getByRole("button", { name: say("ui.account.usage.what") });
    expect(what.className).toContain("underline");
    expect(what.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(what);
    expect(help?.hidden).toBe(false);
    expect(help?.textContent).toBe(say("ui.account.usage.help"));
    expect(what.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(what);
    expect(help?.hidden).toBe(true);
  });
});
