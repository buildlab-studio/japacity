// The guest's "Not saved" chip over the world (account:guest-reminded-to-secure, account:guest-secures-the-life): a sticker chip,
// there while the life is a guest's, that opens the keep-this-life sheet; gone once the life is saved, and never for a secured
// account or the local game.
import type { AccountView } from "@japacity/api";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import type { AccountApi } from "../../shared/net/auth";
import { accountView, engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { loadLaterWords } from "../../shared/words/later";
import { say } from "../../shared/words/text";
import { codeAccount, type Faked } from "./code.testing";
import { SaveChip } from "./SaveChip";

beforeAll(() => loadLaterWords("sheet"));

const ANDROID_WHATSAPP = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24.1";

let made = 0;

/** An account read as `state`, which turns secured once the right code is typed, as the server's read does. */
function account(state: AccountView["state"]): Faked {
  made += 1;
  let held = accountView({ id: `account-chip-${String(made)}`, state });
  const faked: Faked = codeAccount({
    view: () => Promise.resolve(held),
    signInWithCode: () => {
      held = accountView({ id: held.id, state: "secured" });
      return Promise.resolve({ ok: true });
    },
    passkeysWork: () => Promise.resolve(false),
  });
  return faked;
}

async function mount(given: AccountApi | null, agent?: string): Promise<void> {
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, given === null ? {} : { account: given });
  await store.getState().refresh();
  render(
    <GameProvider store={store}>
      <SaveChip {...(agent === undefined ? {} : { agent })} />
    </GameProvider>,
  );
}

const chip = () => screen.queryByRole("button", { name: say("ui.guest.chip") });

describe("the Not saved chip", () => {
  test("[account:guest-reminded-to-secure] [account:guest-secures-the-life] given a guest's life, then the chip says Not saved as a sticker chip, with no count or figure, and a tap opens the keep-this-life sheet with Google and the email", async () => {
    await mount(account("guest"));
    const button = await screen.findByRole("button", { name: say("ui.guest.chip") });
    expect(say("ui.guest.chip")).toBe("Not saved");
    expect(button.textContent).toBe("Not saved");
    expect(button.className).toContain("sticker-chip");
    // world:reach-and-read: the tap's pad is 44 px whatever the chip's drawn size.
    expect(button.className).toContain("reach");
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    fireEvent.click(button);
    const sheet = await screen.findByRole("dialog", { name: say("ui.secure.title") });
    expect(within(sheet).getByText(say("ui.secure.why"))).toBeDefined();
    expect(within(sheet).getByRole("button", { name: say("ui.secure.google") })).toBeDefined();
    expect(within(sheet).getByLabelText(say("ui.account.email.label"))).toBeDefined();
  });

  test("[account:guest-reminded-to-secure] given a secured account, or the local game with no account, then there is no chip", async () => {
    await mount(account("secured"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(chip()).toBeNull();
    cleanup();
    await mount(null);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(chip()).toBeNull();
  });

  test("[account:guest-secures-the-life] [account:guest-reminded-to-secure] given a guest saving the life by the code through the chip, when the right code is typed, then the sheet says Saved and the chip is gone", async () => {
    await mount(account("guest"));
    fireEvent.click(await screen.findByRole("button", { name: say("ui.guest.chip") }));
    const sheet = await screen.findByRole("dialog", { name: say("ui.secure.title") });
    fireEvent.change(within(sheet).getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.secure.code.send") }));
    fireEvent.change(await within(sheet).findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.secure.code.go") }));
    expect(await screen.findByText(say("ui.secure.done"))).toBeDefined();
    await waitFor(() => expect(chip()).toBeNull());
    // The sheet stays in its Kept state with the chip gone under it.
    expect(screen.getByRole("dialog", { name: say("ui.secure.done.title") })).toBeDefined();
  });

  test("[account:guest-secures-the-life] given a guest inside an in-app browser, when the chip is tapped, then the same sheet opens and offers the email alone", async () => {
    await mount(account("guest"), ANDROID_WHATSAPP);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.guest.chip") }));
    const sheet = await screen.findByRole("dialog", { name: say("ui.secure.title") });
    expect(within(sheet).queryByRole("button", { name: say("ui.secure.google") })).toBeNull();
    expect(within(sheet).getByText(say("ui.secure.in-app"))).toBeDefined();
    expect(within(sheet).getByLabelText(say("ui.account.email.label"))).toBeDefined();
  });
});
